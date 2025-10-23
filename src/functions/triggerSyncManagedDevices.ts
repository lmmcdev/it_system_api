/**
 * HTTP trigger to manually initiate managed device synchronization
 * Endpoint: GET /trigger/sync-managed-devices
 *
 * Security: Requires function key authentication
 * Returns: Sync result with detailed metrics
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { validateFunctionKey } from '../middleware/authentication';
import { handleError, successResponse } from '../utils/errorHandler';
import { managedDeviceSyncService } from '../services/ManagedDeviceSyncService';
import { logger } from '../utils/logger';

/**
 * HTTP trigger handler for manual device synchronization
 */
async function triggerSyncManagedDevicesHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const functionName = 'triggerSyncManagedDevices';
  const invocationId = context.invocationId;

  // Set logger context
  logger.setContext({
    functionName,
    invocationId
  });

  try {
    logger.info('[ManagedDevices Sync] Manual sync triggered via HTTP', {
      functionName,
      invocationId,
      method: request.method,
      url: request.url
    });

    // Validate authentication
    const authResult = validateFunctionKey(request);
    if (!authResult.authenticated) {
      logger.warn('[ManagedDevices Sync] Authentication failed', {
        error: authResult.error
      });

      return {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'WWW-Authenticate': 'FunctionKey'
        },
        jsonBody: {
          error: 'Unauthorized',
          message: authResult.error || 'Valid function key required'
        }
      };
    }

    logger.info('[ManagedDevices Sync] Authentication successful', {
      userId: authResult.userId
    });

    // Execute synchronization with progress logging
    const syncStartTime = Date.now();

    const result = await managedDeviceSyncService.syncDevices((progress) => {
      logger.info('[ManagedDevices Sync] Progress update', {
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

    const executionTime = Date.now() - syncStartTime;

    // Log final results
    if (result.success) {
      logger.info('[ManagedDevices Sync] Manual sync completed successfully', {
        status: result.status,
        devicesProcessed: result.devicesProcessed,
        devicesFailed: result.devicesFailed,
        totalDevicesFetched: result.totalDevicesFetched,
        executionTime: `${executionTime}ms`,
        graphApiCalls: result.graphApiMetrics.calls,
        graphApiPages: result.graphApiMetrics.pages,
        cosmosDbWrites: result.cosmosDbMetrics.writes,
        totalRuConsumed: `${result.cosmosDbMetrics.totalRuConsumed.toFixed(2)} RU`,
        errorCount: result.errors.length
      });

      if (result.status === 'partial') {
        logger.warn('[ManagedDevices Sync] Sync completed with partial success', {
          devicesProcessed: result.devicesProcessed,
          devicesFailed: result.devicesFailed,
          sampleErrors: result.errors.slice(0, 5)
        });
      }
    } else {
      logger.error('[ManagedDevices Sync] Manual sync completed with errors', undefined, {
        status: result.status,
        devicesProcessed: result.devicesProcessed,
        devicesFailed: result.devicesFailed,
        executionTime: `${executionTime}ms`,
        errorCount: result.errors.length,
        errors: result.errors.slice(0, 10)
      });
    }

    // Return detailed sync result
    return successResponse({
      success: result.success,
      status: result.status,
      summary: {
        totalDevicesFetched: result.totalDevicesFetched,
        devicesProcessed: result.devicesProcessed,
        devicesFailed: result.devicesFailed,
        executionTimeMs: result.executionTimeMs
      },
      graphApiMetrics: {
        calls: result.graphApiMetrics.calls,
        pages: result.graphApiMetrics.pages,
        totalRequestTimeMs: result.graphApiMetrics.totalRequestTimeMs,
        averageRequestTimeMs: result.graphApiMetrics.calls > 0
          ? (result.graphApiMetrics.totalRequestTimeMs / result.graphApiMetrics.calls).toFixed(2)
          : '0'
      },
      cosmosDbMetrics: {
        writes: result.cosmosDbMetrics.writes,
        totalRuConsumed: result.cosmosDbMetrics.totalRuConsumed.toFixed(2),
        averageRuPerWrite: result.cosmosDbMetrics.writes > 0
          ? (result.cosmosDbMetrics.totalRuConsumed / result.cosmosDbMetrics.writes).toFixed(2)
          : '0'
      },
      errors: {
        count: result.errors.length,
        sample: result.errors.slice(0, 10), // Return first 10 errors
        hasMore: result.errors.length > 10
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('[ManagedDevices Sync] Manual sync failed with unexpected error', error as Error, {
      functionName,
      invocationId
    });

    return handleError(error as Error, context, request);
  } finally {
    logger.clearContext();
  }
}

// Register HTTP trigger
app.http('triggerSyncManagedDevices', {
  methods: ['GET'],
  authLevel: 'anonymous', // Auth handled in code
  route: 'trigger/sync-managed-devices',
  handler: triggerSyncManagedDevicesHandler
});
