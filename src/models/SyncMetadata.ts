/**
 * Sync metadata model for tracking managed device synchronization status
 * Stored in CosmosDB to track sync history and errors
 */

/**
 * Sync status type
 */
export type SyncStatus = 'success' | 'partial' | 'failed';

/**
 * Individual device sync error
 */
export interface DeviceSyncError {
  deviceId: string;
  deviceName?: string;
  error: string;
  timestamp: string;
}

/**
 * Sync metadata document
 * Tracks the status and results of each sync operation
 */
export interface SyncMetadata {
  // Document identity
  id: string; // Always 'sync_metadata' for singleton pattern

  // Sync timing
  lastSyncStartTime: string; // ISO 8601 timestamp
  lastSyncEndTime: string; // ISO 8601 timestamp
  lastSyncStatus: SyncStatus;

  // Sync metrics
  devicesProcessed: number; // Successfully processed
  devicesFailed: number; // Failed to process
  totalDevicesFetched: number; // Total fetched from Graph API
  executionTimeMs: number; // Total execution time

  // Error tracking
  errors: DeviceSyncError[]; // Recent errors (limited to last 100)

  // Graph API metrics
  graphApiCalls: number; // Total API calls made
  graphApiPages: number; // Total pages fetched
  totalRequestTimeMs: number; // Total time spent in Graph API calls

  // CosmosDB metrics
  cosmosDbWrites: number; // Total write operations
  totalRuConsumed: number; // Total RU consumed

  // Previous sync info (for comparison)
  previousSyncTime?: string;
  previousDeviceCount?: number;

  // Metadata
  syncVersion: string; // Version of sync logic
  updatedAt: string; // ISO 8601 timestamp
}

/**
 * Sync result returned from sync service
 */
export interface SyncResult {
  success: boolean;
  status: SyncStatus;
  devicesProcessed: number;
  devicesFailed: number;
  totalDevicesFetched: number;
  executionTimeMs: number;
  errors: DeviceSyncError[];
  graphApiMetrics: {
    calls: number;
    pages: number;
    totalRequestTimeMs: number;
  };
  cosmosDbMetrics: {
    writes: number;
    totalRuConsumed: number;
  };
}

/**
 * Default sync metadata for initial state
 */
export const createInitialSyncMetadata = (): SyncMetadata => ({
  id: 'sync_metadata',
  lastSyncStartTime: new Date().toISOString(),
  lastSyncEndTime: new Date().toISOString(),
  lastSyncStatus: 'success',
  devicesProcessed: 0,
  devicesFailed: 0,
  totalDevicesFetched: 0,
  executionTimeMs: 0,
  errors: [],
  graphApiCalls: 0,
  graphApiPages: 0,
  totalRequestTimeMs: 0,
  cosmosDbWrites: 0,
  totalRuConsumed: 0,
  syncVersion: '1.0.0',
  updatedAt: new Date().toISOString()
});
