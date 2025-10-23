/**
 * Timer trigger to sync defender devices from Microsoft Defender for Endpoint API to CosmosDB
 * Runs every 6 hours: 00:00, 06:00, 12:00, 18:00
 *
 * Schedule: 0 0 STAR_SLASH_6 STAR STAR STAR (Cron expression - replace STAR_SLASH with actual symbols)
 * - Second: 0
 * - Minute: 0
 * - Hour: every 6 hours
 * - Day of month: every day
 * - Month: every month
 * - Day of week: every day of week
 */

import { app, InvocationContext, Timer } from '@azure/functions';
import { defenderDeviceSyncService } from '../services/DefenderDeviceSyncService';
import { logger } from '../utils/logger';
import { config } from '../config/environment';

/**
 * Timer trigger handler for defender device synchronization
 */
async function syncDefenderDevicesTimerHandler(timer: Timer, context: InvocationContext): Promise<void> {
  const functionName = 'syncDefenderDevicesTimer';
  const invocationId = context.invocationId;

  // Set logger context
  logger.setContext({
    functionName,
    invocationId
  });

  try {
    logger.info('[DefenderDevices Sync] Timer trigger started', {
      functionName,
      invocationId,
      schedule: config.defenderDeviceSync.timerSchedule,
      isPastDue: timer.isPastDue,
      scheduleStatus: timer.scheduleStatus,
      timestamp: new Date().toISOString()
    });

    if (timer.isPastDue) {
      logger.warn('[DefenderDevices Sync] Timer trigger is past due', {
        scheduleStatus: timer.scheduleStatus
      });
    }

    // Execute synchronization with progress logging
    const result = await defenderDeviceSyncService.syncDevices((progress) => {
      logger.info('[DefenderDevices Sync] Progress update', {
        phase: progress.phase,
        devicesProcessed: progress.devicesProcessed,
        totalDevices: progress.totalDevices,
        batchNumber: progress.batchNumber,
        totalBatches: progress.totalBatches,
        progressPercentage: progress.totalDevices > 0
          ? ((progress.devicesProcessed / progress.totalDevices) * 100).toFixed(2) + '%'
          : '0%'
      });
    });

    // Log final results
    if (result.success) {
      logger.info('[DefenderDevices Sync] Timer trigger completed successfully', {
        status: result.status,
        devicesProcessed: result.devicesProcessed,
        devicesFailed: result.devicesFailed,
        totalDevicesFetched: result.totalDevicesFetched,
        executionTime: `${result.executionTimeMs}ms`,
        graphApiCalls: result.graphApiMetrics.calls,
        graphApiPages: result.graphApiMetrics.pages,
        cosmosDbWrites: result.cosmosDbMetrics.writes,
        totalRuConsumed: `${result.cosmosDbMetrics.totalRuConsumed.toFixed(2)} RU`,
        errorCount: result.errors.length
      });

      if (result.status === 'partial') {
        logger.warn('[DefenderDevices Sync] Sync completed with partial success', {
          devicesProcessed: result.devicesProcessed,
          devicesFailed: result.devicesFailed,
          sampleErrors: result.errors.slice(0, 5)
        });
      }
    } else {
      logger.error('[DefenderDevices Sync] Timer trigger completed with errors', undefined, {
        status: result.status,
        devicesProcessed: result.devicesProcessed,
        devicesFailed: result.devicesFailed,
        executionTime: `${result.executionTimeMs}ms`,
        errorCount: result.errors.length,
        errors: result.errors.slice(0, 10)
      });
    }

  } catch (error) {
    logger.error('[DefenderDevices Sync] Timer trigger failed with unexpected error', error as Error, {
      functionName,
      invocationId
    });

    // Don't throw - let timer continue on schedule
    // Error is already logged and metadata should be updated
  } finally {
    logger.clearContext();
  }
}

// Register timer trigger
app.timer('syncDefenderDevicesTimer', {
  schedule: config.defenderDeviceSync.timerSchedule, // Every 6 hours
  handler: syncDefenderDevicesTimerHandler
});
