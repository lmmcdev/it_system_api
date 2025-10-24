/**
 * Device Cross-Sync Timer Trigger
 * Automatically executes device cross-sync operation on a schedule
 *
 * Schedule: Runs at 6 AM, 12 PM, and 6 PM daily (1 hour after Intune/Defender syncs)
 * - Intune/Defender syncs run at 5 AM, 11 AM, 5 PM
 * - Cross-sync runs at 6 AM, 12 PM, 6 PM to ensure fresh data
 *
 * Business Logic:
 * 1. Triggered automatically by Azure Functions timer
 * 2. Calls DeviceSyncService to execute cross-sync
 * 3. Logs detailed statistics and performance metrics
 * 4. Implements retry logic for transient failures
 */

import { app, InvocationContext, Timer } from '@azure/functions';
import { deviceSyncService } from '../services/DeviceSyncService';
import { logger } from '../utils/logger';
import { config } from '../config/environment';

/**
 * Timer trigger function for device cross-sync
 */
async function syncDevicesCrossTimer(myTimer: Timer, context: InvocationContext): Promise<void> {
  const functionName = 'syncDevicesCrossTimer';
  const invocationId = context.invocationId;

  // Set logger context
  logger.setContext({
    functionName,
    invocationId
  });

  const startTime = Date.now();

  try {
    logger.info('[Timer] Device cross-sync timer triggered', {
      schedule: config.deviceCrossSync.timerSchedule,
      isPastDue: myTimer.isPastDue,
      scheduleStatus: myTimer.scheduleStatus,
      timestamp: new Date().toISOString()
    });

    if (myTimer.isPastDue) {
      logger.warn('[Timer] Timer trigger is running late', {
        isPastDue: myTimer.isPastDue,
        lastTime: myTimer.scheduleStatus?.last,
        nextTime: myTimer.scheduleStatus?.next
      });
    }

    // Execute cross-sync operation
    logger.info('[Timer] Starting device cross-sync operation');

    const result = await deviceSyncService.executeCrossSync();

    const executionTime = Date.now() - startTime;

    // Log comprehensive statistics
    logger.info('[Timer] Device cross-sync completed successfully', {
      // Sync statistics
      totalProcessed: result.totalProcessed,
      matched: result.matched,
      onlyIntune: result.onlyIntune,
      onlyDefender: result.onlyDefender,

      // Percentages
      matchedPercent: result.totalProcessed > 0
        ? ((result.matched / result.totalProcessed) * 100).toFixed(2) + '%'
        : '0%',
      onlyIntunePercent: result.totalProcessed > 0
        ? ((result.onlyIntune / result.totalProcessed) * 100).toFixed(2) + '%'
        : '0%',
      onlyDefenderPercent: result.totalProcessed > 0
        ? ((result.onlyDefender / result.totalProcessed) * 100).toFixed(2) + '%'
        : '0%',

      // Performance metrics
      totalExecutionTime: `${executionTime}ms`,
      serviceExecutionTime: `${result.executionTime}ms`,

      // Phase breakdown
      fetchDefenderMs: result.fetchDefenderMs,
      fetchIntuneMs: result.fetchIntuneMs,
      matchingMs: result.matchingMs,
      clearMs: result.clearMs,
      upsertMs: result.upsertMs,

      // RU consumption
      totalRuConsumed: `${result.ruConsumed.toFixed(2)} RU`,
      fetchDefenderRu: `${result.fetchDefenderRu.toFixed(2)} RU`,
      fetchIntuneRu: `${result.fetchIntuneRu.toFixed(2)} RU`,
      clearRu: `${result.clearRu.toFixed(2)} RU`,
      upsertRu: `${result.upsertRu.toFixed(2)} RU`,

      // Error summary
      errorCount: result.errors.length,
      hasErrors: result.errors.length > 0,

      // Schedule info
      nextScheduledRun: myTimer.scheduleStatus?.next
    });

    // Log errors if any
    if (result.errors.length > 0) {
      logger.warn('[Timer] Cross-sync completed with errors', {
        errorCount: result.errors.length,
        firstFewErrors: result.errors.slice(0, 10)
      });
    }

    // Log summary statistics for monitoring
    logger.info('[Timer] Cross-sync summary', {
      matched: result.matched,
      onlyIntune: result.onlyIntune,
      onlyDefender: result.onlyDefender,
      total: result.totalProcessed,
      ruConsumed: result.ruConsumed,
      executionTime: executionTime,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const executionTime = Date.now() - startTime;

    logger.error('[Timer] Device cross-sync failed', error as Error, {
      executionTime: `${executionTime}ms`,
      schedule: config.deviceCrossSync.timerSchedule,
      nextScheduledRun: myTimer.scheduleStatus?.next
    });

    // Check if we should retry
    const shouldRetry = checkRetryLogic(error as Error, invocationId);

    if (shouldRetry) {
      logger.info('[Timer] Retry scheduled for failed cross-sync', {
        retryDelayMs: 300000, // 5 minutes
        invocationId
      });

      // Wait 5 minutes and retry once
      await new Promise(resolve => setTimeout(resolve, 300000));

      try {
        logger.info('[Timer] Retrying device cross-sync operation');
        const retryResult = await deviceSyncService.executeCrossSync();

        logger.info('[Timer] Device cross-sync retry succeeded', {
          totalProcessed: retryResult.totalProcessed,
          matched: retryResult.matched,
          onlyIntune: retryResult.onlyIntune,
          onlyDefender: retryResult.onlyDefender,
          ruConsumed: `${retryResult.ruConsumed.toFixed(2)} RU`
        });
      } catch (retryError) {
        logger.error('[Timer] Device cross-sync retry failed', retryError as Error, {
          invocationId
        });
        // Don't throw - allow function to complete gracefully
      }
    } else {
      logger.warn('[Timer] Cross-sync failed, retry not attempted', {
        reason: 'Non-retryable error or max retries exceeded'
      });
    }

  } finally {
    // Clear logger context
    logger.clearContext();
  }
}

/**
 * Check if error is retryable
 */
function checkRetryLogic(error: Error, invocationId: string): boolean {
  // Retry for transient errors (timeout, throttling, network)
  const retryableErrors = [
    'timeout',
    'throttl',
    '429',
    'network',
    'ECONNRESET',
    'ETIMEDOUT'
  ];

  const errorMessage = error.message.toLowerCase();
  const isRetryable = retryableErrors.some(keyword => errorMessage.includes(keyword));

  logger.debug('[Timer] Retry logic evaluation', {
    isRetryable,
    errorMessage: error.message,
    invocationId
  });

  return isRetryable;
}

// Register timer trigger
app.timer('syncDevicesCrossTimer', {
  schedule: config.deviceCrossSync.timerSchedule, // "0 0 6,12,18 * * *" - 6 AM, 12 PM, 6 PM
  runOnStartup: false, // Don't run on function app startup
  handler: syncDevicesCrossTimer
});
