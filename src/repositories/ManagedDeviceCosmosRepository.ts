/**
 * CosmosDB repository for Managed Device data access (write operations)
 * Handles device storage, UPSERT operations, and sync metadata tracking
 *
 * Security Features:
 * - Parameterized queries to prevent injection
 * - 429 throttling with exponential backoff
 * - Request timeouts
 * - Never logs sensitive device data
 * - Proper error handling for 409 conflicts
 */

import { CosmosClient, Container, Database } from '@azure/cosmos';
import { ManagedDevice } from '../models/ManagedDevice';
import { SyncMetadata, createInitialSyncMetadata } from '../models/SyncMetadata';
import { config } from '../config/environment';
import { logger } from '../utils/logger';
import { NotFoundError, ServiceError, ConflictError } from '../utils/errorHandler';

/**
 * Bulk operation result
 */
export interface BulkUpsertResult {
  successCount: number;
  failureCount: number;
  totalRuConsumed: number;
  executionTimeMs: number;
  errors: Array<{
    deviceId: string;
    deviceName?: string;
    error: string;
  }>;
}

/**
 * Query trace information for logging
 */
interface QueryTrace {
  operation: string;
  requestCharge: number;
  executionTime: number;
  itemCount: number;
}

export class ManagedDeviceCosmosRepository {
  private client: CosmosClient;
  private database: Database | null = null;
  private devicesContainer: Container | null = null;
  private isInitialized: boolean = false;
  private readonly QUERY_TIMEOUT_MS = 30000; // 30 seconds
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly INITIAL_RETRY_DELAY_MS = 1000;

  constructor() {
    this.client = new CosmosClient({
      endpoint: config.cosmos.endpoint,
      key: config.cosmos.key
    });
  }

  /**
   * Creates a timeout promise that rejects after specified milliseconds
   */
  private createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new ServiceError(`CosmosDB operation timeout exceeded (${timeoutMs}ms)`));
      }, timeoutMs);
    });
  }

  /**
   * Initialize database and container connections
   */
  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.database = this.client.database(config.cosmos.databaseId);
      this.devicesContainer = this.database.container(config.cosmos.devicesIntuneContainerId);
      this.isInitialized = true;

      logger.info('[CosmosDB] Managed Device Cosmos Repository initialized successfully', {
        database: config.cosmos.databaseId,
        container: config.cosmos.devicesIntuneContainerId
      });
    } catch (error) {
      logger.error('[CosmosDB] Failed to initialize Managed Device Cosmos Repository', error as Error);
      throw new ServiceError('Database initialization failed');
    }
  }

  /**
   * Get devices container instance
   */
  private async getDevicesContainer(): Promise<Container> {
    await this.ensureInitialized();
    if (!this.devicesContainer) {
      throw new ServiceError('Devices container not initialized');
    }
    return this.devicesContainer;
  }

  /**
   * Log query execution trace
   */
  private logQueryTrace(trace: QueryTrace): void {
    logger.info('[CosmosDB Query Trace]', {
      operation: trace.operation,
      requestCharge: `${trace.requestCharge.toFixed(2)} RU`,
      executionTime: `${trace.executionTime}ms`,
      itemCount: trace.itemCount,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Exponential backoff retry for throttling
   */
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    attempt: number = 0
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      // Handle 429 Throttling
      if ((error as { code?: number }).code === 429 && attempt < this.MAX_RETRY_ATTEMPTS) {
        const retryAfter = (error as any).retryAfterInMilliseconds ||
          (this.INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt));

        logger.warn('[CosmosDB] Request throttled (429), retrying with backoff', {
          attempt: attempt + 1,
          maxAttempts: this.MAX_RETRY_ATTEMPTS,
          retryAfter: `${retryAfter}ms`
        });

        await new Promise(resolve => setTimeout(resolve, retryAfter));
        return this.retryWithBackoff(operation, attempt + 1);
      }

      throw error;
    }
  }

  /**
   * Upsert a single managed device
   * Uses UPSERT to insert new or update existing device
   */
  async upsertDevice(device: ManagedDevice): Promise<ManagedDevice> {
    const startTime = Date.now();

    try {
      const container = await this.getDevicesContainer();

      logger.info('[CosmosDB] Upserting managed device', {
        id: device.id,
        deviceName: device.deviceName
      });

      const operation = async () => {
        const { resource, requestCharge } = await container.items.upsert(device);
        return { resource, requestCharge };
      };

      const { resource, requestCharge } = await Promise.race([
        this.retryWithBackoff(operation),
        this.createTimeoutPromise(this.QUERY_TIMEOUT_MS)
      ]);

      const executionTime = Date.now() - startTime;

      this.logQueryTrace({
        operation: `Upsert device: ${device.id}`,
        requestCharge: requestCharge || 0,
        executionTime,
        itemCount: 1
      });

      logger.info('[CosmosDB] Managed device upserted successfully', {
        id: device.id,
        deviceName: device.deviceName,
        requestCharge: `${(requestCharge || 0).toFixed(2)} RU`,
        executionTime: `${executionTime}ms`
      });

      return resource as ManagedDevice;
    } catch (error) {
      const executionTime = Date.now() - startTime;

      // Handle 409 Conflict errors (shouldn't happen with upsert, but defensive)
      if ((error as { code?: number }).code === 409) {
        logger.error('[CosmosDB] Conflict error (409) while upserting device', error as Error, {
          id: device.id,
          executionTime: `${executionTime}ms`
        });
        throw new ConflictError('Conflict occurred while upserting device');
      }

      // Handle 429 after max retries
      if ((error as { code?: number }).code === 429) {
        logger.error('[CosmosDB] Request throttled (429) after max retries', error as Error, {
          id: device.id,
          maxRetries: this.MAX_RETRY_ATTEMPTS,
          executionTime: `${executionTime}ms`
        });
        throw new ServiceError('Service temporarily unavailable after retries');
      }

      logger.error('[CosmosDB] Failed to upsert managed device', error as Error, {
        id: device.id,
        deviceName: device.deviceName,
        errorCode: (error as { code?: number }).code,
        executionTime: `${executionTime}ms`
      });

      throw new ServiceError('Failed to upsert managed device');
    }
  }

  /**
   * Bulk upsert managed devices using CosmosDB bulk operations
   * Processes devices in batches for optimal performance and RU consumption
   *
   * @param devices - Array of devices to upsert
   * @returns Result with success/failure counts and errors
   */
  async bulkUpsertDevices(devices: ManagedDevice[]): Promise<BulkUpsertResult> {
    const startTime = Date.now();

    if (devices.length === 0) {
      logger.warn('[CosmosDB] Bulk upsert called with empty array');
      return {
        successCount: 0,
        failureCount: 0,
        totalRuConsumed: 0,
        executionTimeMs: 0,
        errors: []
      };
    }

    try {
      const container = await this.getDevicesContainer();

      logger.info('[CosmosDB] Starting bulk upsert operation', {
        deviceCount: devices.length
      });

      // Prepare bulk operations
      const operations = devices.map(device => ({
        operationType: 'Upsert' as const,
        resourceBody: device as any // CosmosDB SDK type issue - ManagedDevice is compatible
      }));

      // Execute bulk operation with retry logic
      const operation = async () => {
        const response = await container.items.bulk(operations);
        return response;
      };

      const response = await Promise.race([
        this.retryWithBackoff(operation),
        this.createTimeoutPromise(this.QUERY_TIMEOUT_MS * 2) // Double timeout for bulk ops
      ]);

      const executionTime = Date.now() - startTime;

      // Analyze results
      let successCount = 0;
      let failureCount = 0;
      let totalRuConsumed = 0;
      const errors: Array<{ deviceId: string; deviceName?: string; error: string }> = [];
      const throttledDevices: ManagedDevice[] = [];

      for (let i = 0; i < response.length; i++) {
        const result = response[i];
        const device = devices[i];

        totalRuConsumed += result.requestCharge || 0;

        if (result.statusCode >= 200 && result.statusCode < 300) {
          successCount++;
        } else {
          failureCount++;

          // Track throttled devices for retry
          if (result.statusCode === 429) {
            throttledDevices.push(device);
          }

          errors.push({
            deviceId: device.id,
            deviceName: device.deviceName,
            error: `HTTP ${result.statusCode}: ${result.statusCode === 429 ? 'Throttled' : 'Failed'}`
          });
        }
      }

      // Retry throttled devices individually with exponential backoff
      if (throttledDevices.length > 0 && throttledDevices.length < devices.length) {
        logger.warn('[CosmosDB] Retrying throttled devices individually', {
          throttledCount: throttledDevices.length,
          waitTimeMs: 2000
        });

        // Wait before retry (2 seconds base delay)
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Retry each throttled device individually
        for (const device of throttledDevices) {
          try {
            await this.upsertDevice(device); // Uses retry logic built into upsertDevice

            // Update counts - remove from failures, add to successes
            successCount++;
            failureCount--;

            // Remove error for this device
            const errorIndex = errors.findIndex(e => e.deviceId === device.id);
            if (errorIndex >= 0) {
              errors.splice(errorIndex, 1);
            }

            logger.debug('[CosmosDB] Successfully retried throttled device', {
              deviceId: device.id
            });
          } catch (retryError) {
            logger.warn('[CosmosDB] Failed to retry throttled device', {
              deviceId: device.id,
              error: (retryError as Error).message
            });
            // Keep in errors list
          }
        }
      }

      this.logQueryTrace({
        operation: `Bulk upsert devices`,
        requestCharge: totalRuConsumed,
        executionTime,
        itemCount: successCount
      });

      logger.info('[CosmosDB] Bulk upsert operation completed', {
        totalDevices: devices.length,
        successCount,
        failureCount,
        totalRuConsumed: `${totalRuConsumed.toFixed(2)} RU`,
        executionTime: `${executionTime}ms`
      });

      if (failureCount > 0) {
        logger.warn('[CosmosDB] Some devices failed to upsert in bulk operation', {
          failureCount,
          firstFewErrors: errors.slice(0, 5)
        });
      }

      return {
        successCount,
        failureCount,
        totalRuConsumed,
        executionTimeMs: executionTime,
        errors
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      logger.error('[CosmosDB] Bulk upsert operation failed', error as Error, {
        deviceCount: devices.length,
        errorCode: (error as { code?: number }).code,
        executionTime: `${executionTime}ms`
      });

      // Return failure result instead of throwing to allow partial success tracking
      return {
        successCount: 0,
        failureCount: devices.length,
        totalRuConsumed: 0,
        executionTimeMs: executionTime,
        errors: [{
          deviceId: 'bulk_operation',
          error: (error as Error).message || 'Bulk operation failed'
        }]
      };
    }
  }

  /**
   * Get sync metadata (singleton document)
   * Returns current sync status and metrics
   */
  async getSyncMetadata(): Promise<SyncMetadata> {
    const startTime = Date.now();

    try {
      const container = await this.getDevicesContainer();
      const id = 'sync_metadata';

      logger.info('[CosmosDB] Fetching sync metadata');

      const readPromise = container.item(id, id).read<SyncMetadata>();
      const response = await Promise.race([
        readPromise,
        this.createTimeoutPromise(this.QUERY_TIMEOUT_MS)
      ]);

      const executionTime = Date.now() - startTime;

      this.logQueryTrace({
        operation: `Read sync metadata: ${id}`,
        requestCharge: response.requestCharge || 0,
        executionTime,
        itemCount: response.resource ? 1 : 0
      });

      if (!response.resource) {
        logger.info('[CosmosDB] Sync metadata not found, returning initial metadata');
        return createInitialSyncMetadata();
      }

      logger.info('[CosmosDB] Sync metadata fetched successfully', {
        lastSyncStatus: response.resource.lastSyncStatus,
        lastSyncTime: response.resource.lastSyncEndTime,
        executionTime: `${executionTime}ms`
      });

      return response.resource;
    } catch (error) {
      const executionTime = Date.now() - startTime;

      // If not found (404), return initial metadata
      if ((error as { code?: number }).code === 404) {
        logger.info('[CosmosDB] Sync metadata not found (404), returning initial metadata', {
          executionTime: `${executionTime}ms`
        });
        return createInitialSyncMetadata();
      }

      logger.error('[CosmosDB] Failed to fetch sync metadata', error as Error, {
        errorCode: (error as { code?: number }).code,
        executionTime: `${executionTime}ms`
      });

      // Return initial metadata on error to allow sync to proceed
      logger.warn('[CosmosDB] Returning initial metadata due to error');
      return createInitialSyncMetadata();
    }
  }

  /**
   * Update sync metadata after sync operation
   * Uses UPSERT to create or update the singleton metadata document
   */
  async updateSyncMetadata(metadata: SyncMetadata): Promise<SyncMetadata> {
    const startTime = Date.now();

    try {
      const container = await this.getDevicesContainer();

      // Ensure ID is always 'sync_metadata'
      metadata.id = 'sync_metadata';
      metadata.updatedAt = new Date().toISOString();

      logger.info('[CosmosDB] Updating sync metadata', {
        status: metadata.lastSyncStatus,
        devicesProcessed: metadata.devicesProcessed,
        devicesFailed: metadata.devicesFailed
      });

      const operation = async () => {
        const { resource, requestCharge } = await container.items.upsert(metadata);
        return { resource, requestCharge };
      };

      const { resource, requestCharge } = await Promise.race([
        this.retryWithBackoff(operation),
        this.createTimeoutPromise(this.QUERY_TIMEOUT_MS)
      ]);

      const executionTime = Date.now() - startTime;

      this.logQueryTrace({
        operation: `Upsert sync metadata`,
        requestCharge: requestCharge || 0,
        executionTime,
        itemCount: 1
      });

      logger.info('[CosmosDB] Sync metadata updated successfully', {
        status: metadata.lastSyncStatus,
        requestCharge: `${(requestCharge || 0).toFixed(2)} RU`,
        executionTime: `${executionTime}ms`
      });

      return resource as unknown as SyncMetadata;
    } catch (error) {
      const executionTime = Date.now() - startTime;

      logger.error('[CosmosDB] Failed to update sync metadata', error as Error, {
        errorCode: (error as { code?: number }).code,
        executionTime: `${executionTime}ms`
      });

      throw new ServiceError('Failed to update sync metadata');
    }
  }

  /**
   * Get managed device by ID from CosmosDB
   */
  async getDeviceById(id: string): Promise<ManagedDevice> {
    const startTime = Date.now();

    try {
      const container = await this.getDevicesContainer();

      logger.info('[CosmosDB] Fetching managed device by ID', { id });

      const readPromise = container.item(id, id).read<ManagedDevice>();
      const response = await Promise.race([
        readPromise,
        this.createTimeoutPromise(this.QUERY_TIMEOUT_MS)
      ]);

      const executionTime = Date.now() - startTime;

      this.logQueryTrace({
        operation: `Read device: ${id}`,
        requestCharge: response.requestCharge || 0,
        executionTime,
        itemCount: response.resource ? 1 : 0
      });

      if (!response.resource) {
        logger.warn('[CosmosDB] Managed device not found', { id });
        throw new NotFoundError('Managed Device', id);
      }

      logger.info('[CosmosDB] Managed device fetched successfully', {
        id,
        deviceName: response.resource.deviceName,
        executionTime: `${executionTime}ms`
      });

      return response.resource;
    } catch (error) {
      const executionTime = Date.now() - startTime;

      if (error instanceof NotFoundError) {
        throw error;
      }

      if ((error as { code?: number }).code === 404) {
        logger.warn('[CosmosDB] Managed device not found (404)', { id, executionTime: `${executionTime}ms` });
        throw new NotFoundError('Managed Device', id);
      }

      logger.error('[CosmosDB] Failed to fetch managed device', error as Error, {
        id,
        errorCode: (error as { code?: number }).code,
        executionTime: `${executionTime}ms`
      });

      throw new ServiceError('Failed to fetch managed device');
    }
  }

  /**
   * Check if device exists in CosmosDB
   */
  async deviceExists(id: string): Promise<boolean> {
    try {
      await this.getDeviceById(id);
      return true;
    } catch (error) {
      if (error instanceof NotFoundError) {
        return false;
      }
      throw error;
    }
  }
}

// Export singleton instance
export const managedDeviceCosmosRepository = new ManagedDeviceCosmosRepository();
