/**
 * Defender Device Sync Service
 * Orchestrates synchronization of defender devices from Microsoft Defender for Endpoint API to CosmosDB
 *
 * Features:
 * - Fetches all devices from Defender API with pagination
 * - Batch upserts to CosmosDB for performance
 * - Comprehensive error tracking and recovery
 * - Sync metadata tracking
 * - Parallel batch processing where safe
 */

import { defenderDeviceRepository } from '../repositories/DefenderDeviceRepository';
import { defenderDeviceCosmosRepository } from '../repositories/DefenderDeviceCosmosRepository';
import { DefenderDevice } from '../models/DefenderDevice';
import { SyncResult, DeviceSyncError, SyncStatus, SyncMetadata } from '../models/SyncMetadata';
import { config } from '../config/environment';
import { logger } from '../utils/logger';

/**
 * Sync progress callback type
 */
export type SyncProgressCallback = (progress: {
  phase: string;
  devicesProcessed: number;
  totalDevices: number;
  batchNumber: number;
  totalBatches: number;
}) => void;

export class DefenderDeviceSyncService {
  private readonly BATCH_SIZE: number;
  private readonly SYNC_VERSION = '1.0.0';
  private readonly MAX_ERRORS_TO_TRACK = 100; // Limit error array size

  constructor() {
    this.BATCH_SIZE = config.defenderDeviceSync.batchSize;
  }

  /**
   * Execute full device synchronization
   * Fetches all devices from Defender API and upserts them to CosmosDB
   *
   * @param progressCallback - Optional callback for progress updates
   * @returns SyncResult with detailed metrics and errors
   */
  async syncDevices(progressCallback?: SyncProgressCallback): Promise<SyncResult> {
    const syncStartTime = Date.now();
    const startTimestamp = new Date().toISOString();

    let totalDevicesFetched = 0;
    let devicesProcessed = 0;
    let devicesFailed = 0;
    const errors: DeviceSyncError[] = [];
    let graphApiCalls = 0;
    let graphApiPages = 0;
    let totalGraphRequestTimeMs = 0;
    let cosmosDbWrites = 0;
    let totalRuConsumed = 0;

    try {
      logger.info('[DefenderDevices Sync] Starting device synchronization', {
        syncVersion: this.SYNC_VERSION,
        batchSize: this.BATCH_SIZE,
        startTime: startTimestamp
      });

      // Get previous sync metadata for comparison
      const previousMetadata = await defenderDeviceCosmosRepository.getSyncMetadata();
      logger.info('[DefenderDevices Sync] Retrieved previous sync metadata', {
        previousSyncTime: previousMetadata.lastSyncEndTime,
        previousStatus: previousMetadata.lastSyncStatus,
        previousDeviceCount: previousMetadata.devicesProcessed
      });

      // Phase 1: Fetch all devices from Defender API
      if (progressCallback) {
        progressCallback({
          phase: 'Fetching devices from Defender API',
          devicesProcessed: 0,
          totalDevices: 0,
          batchNumber: 0,
          totalBatches: 0
        });
      }

      const fetchStartTime = Date.now();
      logger.info('[DefenderDevices Sync] Phase 1: Fetching devices from Microsoft Defender for Endpoint API');

      let allDevices: DefenderDevice[];
      try {
        allDevices = await defenderDeviceRepository.getAllDevicesPaginated();
        graphApiPages = Math.ceil(allDevices.length / 10000); // Defender API max page size
        graphApiCalls = graphApiPages + 1; // +1 for initial call
        totalGraphRequestTimeMs = Date.now() - fetchStartTime;
        totalDevicesFetched = allDevices.length;

        logger.info('[DefenderDevices Sync] Successfully fetched all devices from Defender API', {
          totalDevices: totalDevicesFetched,
          pages: graphApiPages,
          executionTime: `${totalGraphRequestTimeMs}ms`
        });
      } catch (error) {
        logger.error('[DefenderDevices Sync] Failed to fetch devices from Defender API', error as Error, {
          executionTime: `${Date.now() - fetchStartTime}ms`
        });

        // Update metadata with failure
        await this.updateSyncMetadataOnFailure(
          startTimestamp,
          previousMetadata,
          error as Error,
          Date.now() - syncStartTime
        );

        return {
          success: false,
          status: 'failed',
          devicesProcessed: 0,
          devicesFailed: 0,
          totalDevicesFetched: 0,
          executionTimeMs: Date.now() - syncStartTime,
          errors: [{
            deviceId: 'defender_api_fetch',
            error: (error as Error).message || 'Failed to fetch devices from Defender API',
            timestamp: new Date().toISOString()
          }],
          graphApiMetrics: {
            calls: graphApiCalls,
            pages: graphApiPages,
            totalRequestTimeMs: totalGraphRequestTimeMs
          },
          cosmosDbMetrics: {
            writes: 0,
            totalRuConsumed: 0
          }
        };
      }

      // Handle empty result
      if (allDevices.length === 0) {
        logger.warn('[DefenderDevices Sync] No devices returned from Defender API');

        const endTimestamp = new Date().toISOString();
        const executionTimeMs = Date.now() - syncStartTime;

        // Update metadata
        const metadata: SyncMetadata = {
          id: 'sync_metadata_defender',
          lastSyncStartTime: startTimestamp,
          lastSyncEndTime: endTimestamp,
          lastSyncStatus: 'success',
          devicesProcessed: 0,
          devicesFailed: 0,
          totalDevicesFetched: 0,
          executionTimeMs,
          errors: [],
          graphApiCalls,
          graphApiPages,
          totalRequestTimeMs: totalGraphRequestTimeMs,
          cosmosDbWrites: 0,
          totalRuConsumed: 0,
          previousSyncTime: previousMetadata.lastSyncEndTime,
          previousDeviceCount: previousMetadata.devicesProcessed,
          syncVersion: this.SYNC_VERSION,
          updatedAt: endTimestamp
        };

        await defenderDeviceCosmosRepository.updateSyncMetadata(metadata);

        return {
          success: true,
          status: 'success',
          devicesProcessed: 0,
          devicesFailed: 0,
          totalDevicesFetched: 0,
          executionTimeMs,
          errors: [],
          graphApiMetrics: {
            calls: graphApiCalls,
            pages: graphApiPages,
            totalRequestTimeMs: totalGraphRequestTimeMs
          },
          cosmosDbMetrics: {
            writes: 0,
            totalRuConsumed: 0
          }
        };
      }

      // Phase 2: Batch upsert to CosmosDB
      logger.info('[DefenderDevices Sync] Phase 2: Upserting devices to CosmosDB', {
        totalDevices: allDevices.length,
        batchSize: this.BATCH_SIZE
      });

      const batches = this.createBatches(allDevices, this.BATCH_SIZE);
      const totalBatches = batches.length;

      logger.info('[DefenderDevices Sync] Created batches for processing', {
        totalBatches,
        batchSize: this.BATCH_SIZE,
        lastBatchSize: batches[batches.length - 1].length
      });

      // Process batches sequentially to avoid overwhelming CosmosDB
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const batchNumber = i + 1;

        logger.info('[DefenderDevices Sync] Processing batch', {
          batchNumber,
          totalBatches,
          batchSize: batch.length,
          devicesProcessedSoFar: devicesProcessed
        });

        if (progressCallback) {
          progressCallback({
            phase: 'Upserting devices to CosmosDB',
            devicesProcessed,
            totalDevices: totalDevicesFetched,
            batchNumber,
            totalBatches
          });
        }

        try {
          const batchStartTime = Date.now();
          const result = await defenderDeviceCosmosRepository.bulkUpsertDevices(batch);
          const batchExecutionTime = Date.now() - batchStartTime;

          devicesProcessed += result.successCount;
          devicesFailed += result.failureCount;
          totalRuConsumed += result.totalRuConsumed;
          cosmosDbWrites += result.successCount;

          // Track errors (limit to MAX_ERRORS_TO_TRACK)
          for (const error of result.errors) {
            if (errors.length < this.MAX_ERRORS_TO_TRACK) {
              errors.push({
                deviceId: error.deviceId,
                deviceName: error.deviceName,
                error: error.error,
                timestamp: new Date().toISOString()
              });
            }
          }

          logger.info('[DefenderDevices Sync] Batch processed', {
            batchNumber,
            totalBatches,
            successCount: result.successCount,
            failureCount: result.failureCount,
            ruConsumed: `${result.totalRuConsumed.toFixed(2)} RU`,
            executionTime: `${batchExecutionTime}ms`,
            devicesProcessedTotal: devicesProcessed,
            devicesFailedTotal: devicesFailed
          });

          if (result.failureCount > 0) {
            logger.warn('[DefenderDevices Sync] Some devices failed in batch', {
              batchNumber,
              failureCount: result.failureCount,
              sampleErrors: result.errors.slice(0, 3)
            });
          }

        } catch (error) {
          logger.error('[DefenderDevices Sync] Batch processing failed', error as Error, {
            batchNumber,
            totalBatches,
            batchSize: batch.length
          });

          // Track batch-level error
          devicesFailed += batch.length;

          if (errors.length < this.MAX_ERRORS_TO_TRACK) {
            errors.push({
              deviceId: `batch_${batchNumber}`,
              error: (error as Error).message || 'Batch processing failed',
              timestamp: new Date().toISOString()
            });
          }
        }
      }

      // Phase 3: Finalize sync
      const endTimestamp = new Date().toISOString();
      const executionTimeMs = Date.now() - syncStartTime;

      // Determine sync status
      let syncStatus: SyncStatus;
      if (devicesFailed === 0) {
        syncStatus = 'success';
      } else if (devicesProcessed > 0) {
        syncStatus = 'partial';
      } else {
        syncStatus = 'failed';
      }

      logger.info('[DefenderDevices Sync] Synchronization completed', {
        status: syncStatus,
        totalDevicesFetched,
        devicesProcessed,
        devicesFailed,
        errorCount: errors.length,
        executionTime: `${executionTimeMs}ms`,
        totalRuConsumed: `${totalRuConsumed.toFixed(2)} RU`
      });

      // Update sync metadata
      const metadata: SyncMetadata = {
        id: 'sync_metadata_defender',
        lastSyncStartTime: startTimestamp,
        lastSyncEndTime: endTimestamp,
        lastSyncStatus: syncStatus,
        devicesProcessed,
        devicesFailed,
        totalDevicesFetched,
        executionTimeMs,
        errors: errors.slice(0, this.MAX_ERRORS_TO_TRACK), // Limit errors stored
        graphApiCalls,
        graphApiPages,
        totalRequestTimeMs: totalGraphRequestTimeMs,
        cosmosDbWrites,
        totalRuConsumed,
        previousSyncTime: previousMetadata.lastSyncEndTime,
        previousDeviceCount: previousMetadata.devicesProcessed,
        syncVersion: this.SYNC_VERSION,
        updatedAt: endTimestamp
      };

      try {
        await defenderDeviceCosmosRepository.updateSyncMetadata(metadata);
        logger.info('[DefenderDevices Sync] Sync metadata updated successfully');
      } catch (error) {
        logger.error('[DefenderDevices Sync] Failed to update sync metadata', error as Error);
        // Don't fail the sync if metadata update fails
      }

      // Return sync result
      return {
        success: syncStatus !== 'failed',
        status: syncStatus,
        devicesProcessed,
        devicesFailed,
        totalDevicesFetched,
        executionTimeMs,
        errors,
        graphApiMetrics: {
          calls: graphApiCalls,
          pages: graphApiPages,
          totalRequestTimeMs: totalGraphRequestTimeMs
        },
        cosmosDbMetrics: {
          writes: cosmosDbWrites,
          totalRuConsumed
        }
      };

    } catch (error) {
      const executionTimeMs = Date.now() - syncStartTime;

      logger.error('[DefenderDevices Sync] Unexpected error during synchronization', error as Error, {
        devicesProcessedBeforeError: devicesProcessed,
        devicesFailedBeforeError: devicesFailed,
        executionTime: `${executionTimeMs}ms`
      });

      // Try to update metadata with failure
      try {
        const previousMetadata = await defenderDeviceCosmosRepository.getSyncMetadata();
        await this.updateSyncMetadataOnFailure(
          startTimestamp,
          previousMetadata,
          error as Error,
          executionTimeMs
        );
      } catch (metadataError) {
        logger.error('[DefenderDevices Sync] Failed to update metadata after sync error', metadataError as Error);
      }

      return {
        success: false,
        status: 'failed',
        devicesProcessed,
        devicesFailed,
        totalDevicesFetched,
        executionTimeMs,
        errors: [{
          deviceId: 'sync_service',
          error: (error as Error).message || 'Unexpected error during synchronization',
          timestamp: new Date().toISOString()
        }, ...errors],
        graphApiMetrics: {
          calls: graphApiCalls,
          pages: graphApiPages,
          totalRequestTimeMs: totalGraphRequestTimeMs
        },
        cosmosDbMetrics: {
          writes: cosmosDbWrites,
          totalRuConsumed
        }
      };
    }
  }

  /**
   * Create batches from device array
   */
  private createBatches(devices: DefenderDevice[], batchSize: number): DefenderDevice[][] {
    const batches: DefenderDevice[][] = [];

    for (let i = 0; i < devices.length; i += batchSize) {
      batches.push(devices.slice(i, i + batchSize));
    }

    return batches;
  }

  /**
   * Update sync metadata when sync fails
   */
  private async updateSyncMetadataOnFailure(
    startTimestamp: string,
    previousMetadata: SyncMetadata,
    error: Error,
    executionTimeMs: number
  ): Promise<void> {
    const endTimestamp = new Date().toISOString();

    const metadata: SyncMetadata = {
      id: 'sync_metadata_defender',
      lastSyncStartTime: startTimestamp,
      lastSyncEndTime: endTimestamp,
      lastSyncStatus: 'failed',
      devicesProcessed: 0,
      devicesFailed: 0,
      totalDevicesFetched: 0,
      executionTimeMs,
      errors: [{
        deviceId: 'sync_failure',
        error: error.message || 'Synchronization failed',
        timestamp: endTimestamp
      }],
      graphApiCalls: 0,
      graphApiPages: 0,
      totalRequestTimeMs: 0,
      cosmosDbWrites: 0,
      totalRuConsumed: 0,
      previousSyncTime: previousMetadata.lastSyncEndTime,
      previousDeviceCount: previousMetadata.devicesProcessed,
      syncVersion: this.SYNC_VERSION,
      updatedAt: endTimestamp
    };

    await defenderDeviceCosmosRepository.updateSyncMetadata(metadata);
  }

  /**
   * Get current sync metadata
   */
  async getSyncMetadata(): Promise<SyncMetadata> {
    return defenderDeviceCosmosRepository.getSyncMetadata();
  }
}

// Export singleton instance
export const defenderDeviceSyncService = new DefenderDeviceSyncService();
