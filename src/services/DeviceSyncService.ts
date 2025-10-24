/**
 * Device Cross-Sync Service
 * Orchestrates cross-matching of devices from Intune and Defender sources
 *
 * Business Logic:
 * 1. Fetch all devices from devices_defender container
 * 2. Fetch all devices from devices_intune container
 * 3. Cross-match by azureADDeviceId (defender.aadDeviceId === intune.azureADDeviceId)
 * 4. Generate sync documents with appropriate state (matched, only_intune, only_defender)
 * 5. Clear existing documents from devices_all container
 * 6. Bulk upsert new sync documents
 * 7. Return comprehensive statistics
 *
 * Matching Strategy:
 * - Primary key: azureADDeviceId
 * - Defender devices without aadDeviceId are treated as "only_defender"
 * - All sync documents use UUID for id and appropriate syncKey
 */

import { v4 as uuidv4 } from 'uuid';
import { deviceSyncRepository } from '../repositories/DeviceSyncRepository';
import {
  DeviceSyncDocument,
  DeviceSyncState
} from '../models/DeviceSync';
import { DefenderDevice } from '../models/DefenderDevice';
import { ManagedDevice } from '../models/ManagedDevice';
import { logger } from '../utils/logger';
import { ServiceError } from '../utils/errorHandler';

/**
 * Cross-sync execution result with detailed statistics
 */
export interface CrossSyncResult {
  // Sync statistics
  matched: number;
  onlyIntune: number;
  onlyDefender: number;
  totalProcessed: number;

  // Performance metrics
  executionTime: number; // milliseconds
  ruConsumed: number;

  // Detailed breakdown
  fetchDefenderMs: number;
  fetchIntuneMs: number;
  matchingMs: number;
  clearMs: number;
  upsertMs: number;

  // RU breakdown
  fetchDefenderRu: number;
  fetchIntuneRu: number;
  clearRu: number;
  upsertRu: number;

  // Error details
  errors: Array<{
    syncKey: string;
    error: string;
  }>;
}

export class DeviceSyncService {
  /**
   * Execute cross-sync operation
   * Main business logic for matching and syncing devices
   */
  async executeCrossSync(): Promise<CrossSyncResult> {
    const overallStartTime = Date.now();

    logger.info('[DeviceSyncService] Starting cross-sync operation');

    try {
      // Step 1: Fetch all Defender devices
      logger.info('[DeviceSyncService] Step 1: Fetching Defender devices');
      const fetchDefenderStart = Date.now();
      const { devices: defenderDevices, ruConsumed: fetchDefenderRu } =
        await deviceSyncRepository.getAllDefenderDevices();
      const fetchDefenderMs = Date.now() - fetchDefenderStart;

      logger.info('[DeviceSyncService] Defender devices fetched', {
        count: defenderDevices.length,
        ruConsumed: `${fetchDefenderRu.toFixed(2)} RU`,
        executionTime: `${fetchDefenderMs}ms`
      });

      // Step 2: Fetch all Intune devices
      logger.info('[DeviceSyncService] Step 2: Fetching Intune devices');
      const fetchIntuneStart = Date.now();
      const { devices: intuneDevices, ruConsumed: fetchIntuneRu } =
        await deviceSyncRepository.getAllIntuneDevices();
      const fetchIntuneMs = Date.now() - fetchIntuneStart;

      logger.info('[DeviceSyncService] Intune devices fetched', {
        count: intuneDevices.length,
        ruConsumed: `${fetchIntuneRu.toFixed(2)} RU`,
        executionTime: `${fetchIntuneMs}ms`
      });

      // Step 3: Cross-match devices
      logger.info('[DeviceSyncService] Step 3: Cross-matching devices');
      const matchingStart = Date.now();

      const syncDocuments = this.crossMatchDevices(defenderDevices, intuneDevices);

      const matchingMs = Date.now() - matchingStart;

      // Count statistics
      const matched = syncDocuments.filter(d => d.syncState === DeviceSyncState.Matched).length;
      const onlyIntune = syncDocuments.filter(d => d.syncState === DeviceSyncState.OnlyIntune).length;
      const onlyDefender = syncDocuments.filter(d => d.syncState === DeviceSyncState.OnlyDefender).length;

      logger.info('[DeviceSyncService] Cross-matching completed', {
        totalDocuments: syncDocuments.length,
        matched,
        onlyIntune,
        onlyDefender,
        executionTime: `${matchingMs}ms`
      });

      // Step 4: Clear existing sync documents
      logger.info('[DeviceSyncService] Step 4: Clearing existing sync documents');
      const clearStart = Date.now();
      const { deletedCount, ruConsumed: clearRu } =
        await deviceSyncRepository.clearAllSyncDocuments();
      const clearMs = Date.now() - clearStart;

      logger.info('[DeviceSyncService] Existing documents cleared', {
        deletedCount,
        ruConsumed: `${clearRu.toFixed(2)} RU`,
        executionTime: `${clearMs}ms`
      });

      // Step 5: Bulk upsert new sync documents
      logger.info('[DeviceSyncService] Step 5: Upserting new sync documents');
      const upsertStart = Date.now();
      const upsertResult = await deviceSyncRepository.bulkUpsertSyncDocuments(syncDocuments);
      const upsertMs = Date.now() - upsertStart;

      logger.info('[DeviceSyncService] Sync documents upserted', {
        successCount: upsertResult.successCount,
        failureCount: upsertResult.failureCount,
        ruConsumed: `${upsertResult.totalRuConsumed.toFixed(2)} RU`,
        executionTime: `${upsertMs}ms`
      });

      // Calculate total metrics
      const executionTime = Date.now() - overallStartTime;
      const totalRuConsumed =
        fetchDefenderRu + fetchIntuneRu + clearRu + upsertResult.totalRuConsumed;

      const result: CrossSyncResult = {
        matched,
        onlyIntune,
        onlyDefender,
        totalProcessed: syncDocuments.length,
        executionTime,
        ruConsumed: totalRuConsumed,
        fetchDefenderMs,
        fetchIntuneMs,
        matchingMs,
        clearMs,
        upsertMs,
        fetchDefenderRu,
        fetchIntuneRu,
        clearRu,
        upsertRu: upsertResult.totalRuConsumed,
        errors: upsertResult.errors
      };

      logger.info('[DeviceSyncService] Cross-sync operation completed successfully', {
        totalProcessed: result.totalProcessed,
        matched: result.matched,
        onlyIntune: result.onlyIntune,
        onlyDefender: result.onlyDefender,
        executionTime: `${result.executionTime}ms`,
        totalRuConsumed: `${result.ruConsumed.toFixed(2)} RU`,
        failureCount: upsertResult.failureCount
      });

      return result;
    } catch (error) {
      const executionTime = Date.now() - overallStartTime;

      logger.error('[DeviceSyncService] Cross-sync operation failed', error as Error, {
        executionTime: `${executionTime}ms`
      });

      throw new ServiceError('Cross-sync operation failed: ' + (error as Error).message);
    }
  }

  /**
   * Cross-match devices from Defender and Intune sources
   * Creates sync documents with appropriate state
   *
   * Matching logic:
   * 1. Build maps by azureADDeviceId for efficient lookup
   * 2. Iterate through Intune devices and find matches
   * 3. Mark matched Defender devices as processed
   * 4. Create "only_defender" documents for unmatched Defender devices
   */
  private crossMatchDevices(
    defenderDevices: DefenderDevice[],
    intuneDevices: ManagedDevice[]
  ): DeviceSyncDocument[] {
    const syncDocuments: DeviceSyncDocument[] = [];
    const syncTimestamp = new Date().toISOString();

    // Build map of Defender devices by aadDeviceId for efficient lookup
    // Key: aadDeviceId, Value: DefenderDevice
    const defenderByAadId = new Map<string, DefenderDevice>();
    const defenderWithoutAadId: DefenderDevice[] = [];

    for (const defender of defenderDevices) {
      if (defender.aadDeviceId) {
        defenderByAadId.set(defender.aadDeviceId, defender);
      } else {
        // Defender devices without aadDeviceId will be "only_defender"
        defenderWithoutAadId.push(defender);
      }
    }

    logger.info('[DeviceSyncService] Built Defender device maps', {
      withAadId: defenderByAadId.size,
      withoutAadId: defenderWithoutAadId.length
    });

    // Track which Defender devices have been matched
    const matchedDefenderIds = new Set<string>();

    // Process Intune devices
    for (const intune of intuneDevices) {
      if (!intune.azureADDeviceId) {
        // Intune device without azureADDeviceId - treat as "only_intune"
        logger.warn('[DeviceSyncService] Intune device missing azureADDeviceId', {
          id: intune.id,
          deviceName: intune.deviceName
        });

        syncDocuments.push({
          id: uuidv4(),
          syncKey: intune.id, // Fallback to device id
          syncState: DeviceSyncState.OnlyIntune,
          syncTimestamp,
          intune
        });
        continue;
      }

      // Try to find matching Defender device
      const matchingDefender = defenderByAadId.get(intune.azureADDeviceId);

      if (matchingDefender) {
        // MATCHED: Both Intune and Defender
        syncDocuments.push({
          id: uuidv4(),
          syncKey: intune.azureADDeviceId,
          syncState: DeviceSyncState.Matched,
          syncTimestamp,
          intune,
          defender: matchingDefender
        });

        matchedDefenderIds.add(matchingDefender.id);

        logger.debug('[DeviceSyncService] Matched device', {
          azureADDeviceId: intune.azureADDeviceId,
          intuneId: intune.id,
          defenderId: matchingDefender.id
        });
      } else {
        // ONLY INTUNE: No matching Defender device
        syncDocuments.push({
          id: uuidv4(),
          syncKey: intune.azureADDeviceId,
          syncState: DeviceSyncState.OnlyIntune,
          syncTimestamp,
          intune
        });
      }
    }

    // Process unmatched Defender devices (those with aadDeviceId but no match)
    for (const [aadDeviceId, defender] of defenderByAadId.entries()) {
      if (!matchedDefenderIds.has(defender.id)) {
        // ONLY DEFENDER: Has aadDeviceId but no Intune match
        syncDocuments.push({
          id: uuidv4(),
          syncKey: aadDeviceId,
          syncState: DeviceSyncState.OnlyDefender,
          syncTimestamp,
          defender
        });
      }
    }

    // Process Defender devices without aadDeviceId
    for (const defender of defenderWithoutAadId) {
      // ONLY DEFENDER: No aadDeviceId, use device id as syncKey
      syncDocuments.push({
        id: uuidv4(),
        syncKey: defender.id,
        syncState: DeviceSyncState.OnlyDefender,
        syncTimestamp,
        defender
      });

      logger.debug('[DeviceSyncService] Defender device without aadDeviceId', {
        id: defender.id,
        computerDnsName: defender.computerDnsName
      });
    }

    logger.info('[DeviceSyncService] Cross-matching summary', {
      totalSyncDocuments: syncDocuments.length,
      matched: syncDocuments.filter(d => d.syncState === DeviceSyncState.Matched).length,
      onlyIntune: syncDocuments.filter(d => d.syncState === DeviceSyncState.OnlyIntune).length,
      onlyDefender: syncDocuments.filter(d => d.syncState === DeviceSyncState.OnlyDefender).length,
      defenderWithoutAadId: defenderWithoutAadId.length
    });

    return syncDocuments;
  }

  /**
   * Get synced devices with optional filtering by sync state
   *
   * @param syncState - Filter by sync state (matched, only_intune, only_defender)
   * @param pageSize - Number of items per page
   * @param continuationToken - Pagination token
   * @returns Paginated sync documents
   */
  async getSyncedDevices(
    syncState?: 'matched' | 'only_intune' | 'only_defender',
    pageSize: number = 50,
    continuationToken?: string
  ): Promise<{
    devices: DeviceSyncDocument[];
    pagination: {
      count: number;
      hasMore: boolean;
      continuationToken?: string;
    };
  }> {
    try {
      logger.info('[DeviceSyncService] Getting synced devices', {
        syncState: syncState || 'all',
        pageSize
      });

      const result = await deviceSyncRepository.getSyncDocuments(
        syncState,
        pageSize,
        continuationToken
      );

      logger.info('[DeviceSyncService] Synced devices retrieved', {
        count: result.count,
        hasMore: result.hasMore,
        ruConsumed: `${result.ruConsumed.toFixed(2)} RU`
      });

      return {
        devices: result.documents,
        pagination: {
          count: result.count,
          hasMore: result.hasMore,
          continuationToken: result.continuationToken
        }
      };
    } catch (error) {
      logger.error('[DeviceSyncService] Failed to get synced devices', error as Error, {
        syncState,
        pageSize
      });

      throw new ServiceError('Failed to get synced devices');
    }
  }
}

// Export singleton instance
export const deviceSyncService = new DeviceSyncService();
