/**
 * CosmosDB repository for Device Sync operations
 * Handles cross-matching devices from Intune and Defender sources
 *
 * Security Features:
 * - Parameterized queries to prevent injection
 * - 429 throttling with exponential backoff
 * - Request timeouts
 * - Proper error handling
 *
 * Responsibilities:
 * - Fetch all devices from devices_defender container
 * - Fetch all devices from devices_intune container
 * - UPSERT sync documents to devices_all container
 * - Bulk operations with retry logic
 * - Clear all sync documents for fresh sync
 */

import { CosmosClient, Container, Database, FeedResponse } from '@azure/cosmos';
import { DeviceSyncDocument } from '../models/DeviceSync';
import { DefenderDevice } from '../models/DefenderDevice';
import { ManagedDevice } from '../models/ManagedDevice';
import { config } from '../config/environment';
import { logger } from '../utils/logger';
import { ServiceError } from '../utils/errorHandler';

/**
 * Bulk operation result
 */
export interface BulkUpsertResult {
  successCount: number;
  failureCount: number;
  totalRuConsumed: number;
  executionTimeMs: number;
  errors: Array<{
    syncKey: string;
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

export class DeviceSyncRepository {
  private client: CosmosClient;
  private database: Database | null = null;
  private devicesAllContainer: Container | null = null;
  private devicesDefenderContainer: Container | null = null;
  private devicesIntuneContainer: Container | null = null;
  private isInitialized: boolean = false;
  private readonly QUERY_TIMEOUT_MS = 60000; // 60 seconds (increased for large datasets)
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
  private ensureInitialized(): void {
    if (this.isInitialized) {
      return;
    }

    try {
      this.database = this.client.database(config.cosmos.databaseId);
      this.devicesAllContainer = this.database.container(config.deviceCrossSync.devicesAllContainerId);
      this.devicesDefenderContainer = this.database.container(config.cosmos.devicesDefenderContainerId);
      this.devicesIntuneContainer = this.database.container(config.cosmos.devicesIntuneContainerId);
      this.isInitialized = true;

      logger.info('[CosmosDB] Device Sync Repository initialized successfully', {
        database: config.cosmos.databaseId,
        devicesAllContainer: config.deviceCrossSync.devicesAllContainerId,
        devicesDefenderContainer: config.cosmos.devicesDefenderContainerId,
        devicesIntuneContainer: config.cosmos.devicesIntuneContainerId
      });
    } catch (error) {
      logger.error('[CosmosDB] Failed to initialize Device Sync Repository', error as Error);
      throw new ServiceError('Device Sync Repository initialization failed');
    }
  }

  /**
   * Get containers
   */
  private getDevicesAllContainer(): Container {
    this.ensureInitialized();
    if (!this.devicesAllContainer) {
      throw new ServiceError('Devices All container not initialized');
    }
    return this.devicesAllContainer;
  }

  private getDevicesDefenderContainer(): Container {
    this.ensureInitialized();
    if (!this.devicesDefenderContainer) {
      throw new ServiceError('Devices Defender container not initialized');
    }
    return this.devicesDefenderContainer;
  }

  private getDevicesIntuneContainer(): Container {
    this.ensureInitialized();
    if (!this.devicesIntuneContainer) {
      throw new ServiceError('Devices Intune container not initialized');
    }
    return this.devicesIntuneContainer;
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
        const errorWithRetry = error as { retryAfterInMilliseconds?: number };
        const retryAfter = errorWithRetry.retryAfterInMilliseconds ||
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
   * Fetch all documents from a container with pagination
   * Uses parameterized query for safety
   */
  private async fetchAllDocuments<T>(
    container: Container,
    containerName: string
  ): Promise<{ documents: T[]; totalRuConsumed: number }> {
    const startTime = Date.now();
    const documents: T[] = [];
    let totalRuConsumed = 0;
    let hasMore = true;
    let continuationToken: string | undefined = undefined;

    logger.info(`[CosmosDB] Starting to fetch all documents from ${containerName}`);

    try {
      while (hasMore) {
        const query = 'SELECT * FROM c';
        const querySpec = { query };

        const operation = async () => {
          return container.items
            .query<T>(querySpec, {
              maxItemCount: 100,
              continuationToken
            })
            .fetchNext();
        };

        const response: FeedResponse<T> = await Promise.race([
          this.retryWithBackoff(operation),
          this.createTimeoutPromise(this.QUERY_TIMEOUT_MS)
        ]);

        documents.push(...response.resources);
        totalRuConsumed += response.requestCharge || 0;
        continuationToken = response.continuationToken;
        hasMore = !!continuationToken;

        logger.debug(`[CosmosDB] Fetched batch from ${containerName}`, {
          batchSize: response.resources.length,
          totalFetched: documents.length,
          hasMore,
          ruCharge: `${(response.requestCharge || 0).toFixed(2)} RU`
        });
      }

      const executionTime = Date.now() - startTime;

      this.logQueryTrace({
        operation: `Fetch all documents from ${containerName}`,
        requestCharge: totalRuConsumed,
        executionTime,
        itemCount: documents.length
      });

      logger.info(`[CosmosDB] Successfully fetched all documents from ${containerName}`, {
        totalDocuments: documents.length,
        totalRuConsumed: `${totalRuConsumed.toFixed(2)} RU`,
        executionTime: `${executionTime}ms`
      });

      return { documents, totalRuConsumed };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      logger.error(`[CosmosDB] Failed to fetch documents from ${containerName}`, error as Error, {
        documentsFetched: documents.length,
        errorCode: (error as { code?: number }).code,
        executionTime: `${executionTime}ms`
      });

      throw new ServiceError(`Failed to fetch documents from ${containerName}`);
    }
  }

  /**
   * Get all Defender devices from devices_defender container
   */
  async getAllDefenderDevices(): Promise<{ devices: DefenderDevice[]; ruConsumed: number }> {
    const container = this.getDevicesDefenderContainer();
    const result = await this.fetchAllDocuments<DefenderDevice>(
      container,
      'devices_defender'
    );

    return {
      devices: result.documents,
      ruConsumed: result.totalRuConsumed
    };
  }

  /**
   * Get all Intune devices from devices_intune container
   */
  async getAllIntuneDevices(): Promise<{ devices: ManagedDevice[]; ruConsumed: number }> {
    const container = this.getDevicesIntuneContainer();
    const result = await this.fetchAllDocuments<ManagedDevice>(
      container,
      'devices_intune'
    );

    return {
      devices: result.documents,
      ruConsumed: result.totalRuConsumed
    };
  }

  /**
   * Upsert a single sync document to devices_all container
   */
  async upsertSyncDocument(doc: DeviceSyncDocument): Promise<DeviceSyncDocument> {
    const startTime = Date.now();

    try {
      const container = this.getDevicesAllContainer();

      logger.debug('[CosmosDB] Upserting sync document', {
        id: doc.id,
        syncKey: doc.syncKey,
        syncState: doc.syncState
      });

      const operation = async () => {
        const { resource, requestCharge } = await container.items.upsert(doc);
        return { resource, requestCharge };
      };

      const { resource, requestCharge } = await Promise.race([
        this.retryWithBackoff(operation),
        this.createTimeoutPromise(this.QUERY_TIMEOUT_MS)
      ]);

      const executionTime = Date.now() - startTime;

      this.logQueryTrace({
        operation: `Upsert sync document: ${doc.syncKey}`,
        requestCharge: requestCharge || 0,
        executionTime,
        itemCount: 1
      });

      return resource as DeviceSyncDocument;
    } catch (error) {
      const executionTime = Date.now() - startTime;

      logger.error('[CosmosDB] Failed to upsert sync document', error as Error, {
        syncKey: doc.syncKey,
        syncState: doc.syncState,
        errorCode: (error as { code?: number }).code,
        executionTime: `${executionTime}ms`
      });

      throw new ServiceError('Failed to upsert sync document');
    }
  }

  /**
   * Bulk upsert sync documents using CosmosDB bulk operations
   * Processes documents in batches for optimal performance
   */
  async bulkUpsertSyncDocuments(docs: DeviceSyncDocument[]): Promise<BulkUpsertResult> {
    const startTime = Date.now();

    if (docs.length === 0) {
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
      const container = this.getDevicesAllContainer();
      const batchSize = config.deviceCrossSync.batchSize;

      logger.info('[CosmosDB] Starting bulk upsert operation for sync documents', {
        totalDocuments: docs.length,
        batchSize
      });

      let successCount = 0;
      let failureCount = 0;
      let totalRuConsumed = 0;
      const errors: Array<{ syncKey: string; error: string }> = [];

      // Process in batches
      for (let i = 0; i < docs.length; i += batchSize) {
        const batch = docs.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(docs.length / batchSize);

        logger.info(`[CosmosDB] Processing batch ${batchNum}/${totalBatches}`, {
          batchSize: batch.length,
          progress: `${i + batch.length}/${docs.length}`
        });

        // Prepare bulk operations (CosmosDB SDK type issue - DeviceSyncDocument is compatible)
        const operations = batch.map(doc => ({
          operationType: 'Upsert' as const,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
          resourceBody: doc as any
        }));

        // Execute bulk operation with retry logic
        const operation = async () => {
          const response = await container.items.bulk(operations);
          return response;
        };

        const response = await Promise.race([
          this.retryWithBackoff(operation),
          this.createTimeoutPromise(this.QUERY_TIMEOUT_MS)
        ]);

        // Analyze results
        const throttledDocs: DeviceSyncDocument[] = [];

        for (let j = 0; j < response.length; j++) {
          const result = response[j];
          const doc = batch[j];

          totalRuConsumed += result.requestCharge || 0;

          if (result.statusCode >= 200 && result.statusCode < 300) {
            successCount++;
          } else {
            failureCount++;

            // Track throttled documents for retry
            if (result.statusCode === 429) {
              throttledDocs.push(doc);
            }

            errors.push({
              syncKey: doc.syncKey,
              error: `HTTP ${result.statusCode}: ${result.statusCode === 429 ? 'Throttled' : 'Failed'}`
            });
          }
        }

        // Retry throttled documents individually
        if (throttledDocs.length > 0 && throttledDocs.length < batch.length) {
          logger.warn('[CosmosDB] Retrying throttled documents individually', {
            throttledCount: throttledDocs.length,
            waitTimeMs: 2000
          });

          await new Promise(resolve => setTimeout(resolve, 2000));

          for (const doc of throttledDocs) {
            try {
              await this.upsertSyncDocument(doc);
              successCount++;
              failureCount--;

              // Remove error for this document
              const errorIndex = errors.findIndex(e => e.syncKey === doc.syncKey);
              if (errorIndex >= 0) {
                errors.splice(errorIndex, 1);
              }
            } catch (retryError) {
              logger.warn('[CosmosDB] Failed to retry throttled document', {
                syncKey: doc.syncKey,
                error: (retryError as Error).message
              });
            }
          }
        }
      }

      const executionTime = Date.now() - startTime;

      this.logQueryTrace({
        operation: `Bulk upsert sync documents`,
        requestCharge: totalRuConsumed,
        executionTime,
        itemCount: successCount
      });

      logger.info('[CosmosDB] Bulk upsert operation completed', {
        totalDocuments: docs.length,
        successCount,
        failureCount,
        totalRuConsumed: `${totalRuConsumed.toFixed(2)} RU`,
        executionTime: `${executionTime}ms`
      });

      if (failureCount > 0) {
        logger.warn('[CosmosDB] Some documents failed to upsert', {
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
        documentCount: docs.length,
        errorCode: (error as { code?: number }).code,
        executionTime: `${executionTime}ms`
      });

      return {
        successCount: 0,
        failureCount: docs.length,
        totalRuConsumed: 0,
        executionTimeMs: executionTime,
        errors: [{
          syncKey: 'bulk_operation',
          error: (error as Error).message || 'Bulk operation failed'
        }]
      };
    }
  }

  /**
   * Clear all sync documents from devices_all container
   * Used before executing a fresh sync
   */
  async clearAllSyncDocuments(): Promise<{ deletedCount: number; ruConsumed: number }> {
    const startTime = Date.now();

    try {
      const container = this.getDevicesAllContainer();

      logger.info('[CosmosDB] Starting to clear all sync documents');

      // Fetch all documents (just IDs to minimize RU cost)
      const query = 'SELECT c.id FROM c';
      const querySpec = { query };

      const allDocs: Array<{ id: string }> = [];
      let totalRuConsumed = 0;
      let hasMore = true;
      let continuationToken: string | undefined = undefined;

      while (hasMore) {
        const operation = async () => {
          return container.items
            .query<{ id: string }>(querySpec, {
              maxItemCount: 100,
              continuationToken
            })
            .fetchNext();
        };

        const response = await Promise.race([
          this.retryWithBackoff(operation),
          this.createTimeoutPromise(this.QUERY_TIMEOUT_MS)
        ]);

        allDocs.push(...response.resources);
        totalRuConsumed += response.requestCharge || 0;
        continuationToken = response.continuationToken;
        hasMore = !!continuationToken;
      }

      logger.info('[CosmosDB] Fetched document IDs for deletion', {
        totalDocuments: allDocs.length,
        ruConsumed: `${totalRuConsumed.toFixed(2)} RU`
      });

      // Delete documents using bulk operations
      if (allDocs.length > 0) {
        const operations = allDocs.map(doc => ({
          operationType: 'Delete' as const,
          id: doc.id,
          partitionKey: doc.id
        }));

        const operation = async () => {
          const response = await container.items.bulk(operations);
          return response;
        };

        const response = await Promise.race([
          this.retryWithBackoff(operation),
          this.createTimeoutPromise(this.QUERY_TIMEOUT_MS)
        ]);

        let deleteCount = 0;
        for (const result of response) {
          totalRuConsumed += result.requestCharge || 0;
          if (result.statusCode >= 200 && result.statusCode < 300) {
            deleteCount++;
          }
        }

        const executionTime = Date.now() - startTime;

        this.logQueryTrace({
          operation: `Clear all sync documents`,
          requestCharge: totalRuConsumed,
          executionTime,
          itemCount: deleteCount
        });

        logger.info('[CosmosDB] Successfully cleared sync documents', {
          deletedCount: deleteCount,
          totalRuConsumed: `${totalRuConsumed.toFixed(2)} RU`,
          executionTime: `${executionTime}ms`
        });

        return {
          deletedCount: deleteCount,
          ruConsumed: totalRuConsumed
        };
      }

      logger.info('[CosmosDB] No sync documents to clear');
      return { deletedCount: 0, ruConsumed: totalRuConsumed };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      logger.error('[CosmosDB] Failed to clear sync documents', error as Error, {
        errorCode: (error as { code?: number }).code,
        executionTime: `${executionTime}ms`
      });

      throw new ServiceError('Failed to clear sync documents');
    }
  }

  /**
   * Get sync documents with optional filtering and pagination
   *
   * @param syncState - Optional filter by sync state (matched, only_intune, only_defender)
   * @param pageSize - Number of items per page (default 50, max 100)
   * @param continuationToken - Token for pagination
   * @returns Sync documents with pagination info
   */
  async getSyncDocuments(
    syncState?: 'matched' | 'only_intune' | 'only_defender',
    pageSize: number = 50,
    continuationToken?: string
  ): Promise<{
    documents: DeviceSyncDocument[];
    hasMore: boolean;
    continuationToken?: string;
    count: number;
    ruConsumed: number;
  }> {
    const startTime = Date.now();

    try {
      await this.ensureInitialized();
      const container = this.getDevicesAllContainer();

      // Build query
      let query = 'SELECT * FROM c';
      const parameters: Array<{ name: string; value: string }> = [];

      if (syncState) {
        query += ' WHERE c.syncState = @syncState';
        parameters.push({ name: '@syncState', value: syncState });
      }

      // Add ORDER BY for consistent pagination
      query += ' ORDER BY c._ts DESC';

      const querySpec = {
        query,
        parameters
      };

      logger.info('[CosmosDB] Querying sync documents', {
        syncState: syncState || 'all',
        pageSize,
        hasContinuationToken: !!continuationToken
      });

      const operation = async () => {
        return container.items
          .query<DeviceSyncDocument>(querySpec, {
            maxItemCount: pageSize,
            continuationToken
          })
          .fetchNext();
      };

      const response: FeedResponse<DeviceSyncDocument> = await Promise.race([
        this.retryWithBackoff(operation),
        this.createTimeoutPromise(this.QUERY_TIMEOUT_MS)
      ]);

      const executionTime = Date.now() - startTime;
      const ruConsumed = response.requestCharge || 0;

      this.logQueryTrace({
        operation: `Get sync documents (syncState: ${syncState || 'all'})`,
        requestCharge: ruConsumed,
        executionTime,
        itemCount: response.resources.length
      });

      logger.info('[CosmosDB] Sync documents query completed', {
        count: response.resources.length,
        hasMore: response.hasMoreResults,
        ruConsumed: `${ruConsumed.toFixed(2)} RU`,
        executionTime: `${executionTime}ms`
      });

      return {
        documents: response.resources,
        hasMore: response.hasMoreResults,
        continuationToken: response.continuationToken,
        count: response.resources.length,
        ruConsumed
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      logger.error('[CosmosDB] Failed to get sync documents', error as Error, {
        syncState,
        pageSize,
        errorCode: (error as { code?: number }).code,
        executionTime: `${executionTime}ms`
      });

      throw new ServiceError('Failed to get sync documents');
    }
  }
}

// Export singleton instance
export const deviceSyncRepository = new DeviceSyncRepository();
