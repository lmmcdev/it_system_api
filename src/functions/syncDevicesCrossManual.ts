/**
 * Device Cross-Sync Manual Trigger (HTTP Endpoint)
 * Allows manual triggering of device cross-sync operation via HTTP POST
 *
 * Endpoint: POST /api/devices/sync-cross
 * Authentication: Function key (x-functions-key header or code query parameter)
 * Rate Limiting: 10 requests per hour per client
 *
 * Use Cases:
 * - Manual sync after data updates
 * - Testing and validation
 * - On-demand sync outside of scheduled times
 *
 * Response: JSON with detailed sync statistics and performance metrics
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { deviceSyncService } from '../services/DeviceSyncService';
import { validateFunctionKey } from '../middleware/authentication';
import { checkRateLimit, createRateLimitResponse, RATE_LIMITS } from '../middleware/rateLimit';
import { handleError, successResponse } from '../utils/errorHandler';
import { logger } from '../utils/logger';

/**
 * Manual trigger endpoint for device cross-sync
 */
async function syncDevicesCrossManual(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const functionName = 'syncDevicesCrossManual';
  const invocationId = context.invocationId;

  // Set logger context
  logger.setContext({
    functionName,
    invocationId,
    method: request.method,
    url: request.url
  });

  const startTime = Date.now();

  try {
    // Validate authentication
    const authResult = validateFunctionKey(request);

    if (!authResult.authenticated) {
      logger.warn('[Manual Sync] Authentication failed', {
        reason: authResult.error
      });

      return {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'WWW-Authenticate': 'FunctionKey'
        },
        jsonBody: {
          success: false,
          error: {
            code: 'AUTHENTICATION_FAILED',
            message: authResult.error || 'Authentication required'
          },
          timestamp: new Date().toISOString()
        }
      };
    }

    logger.info('[Manual Sync] Authentication successful', {
      userId: authResult.userId
    });

    // Check rate limit
    const rateLimitResult = checkRateLimit(
      request,
      'deviceCrossSync',
      RATE_LIMITS.deviceCrossSync
    );

    if (!rateLimitResult.allowed) {
      logger.warn('[Manual Sync] Rate limit exceeded', {
        retryAfter: rateLimitResult.retryAfter,
        remaining: rateLimitResult.remaining
      });

      return createRateLimitResponse(rateLimitResult);
    }

    logger.info('[Manual Sync] Rate limit check passed', {
      remaining: rateLimitResult.remaining,
      resetTime: rateLimitResult.resetTime
    });

    // Execute cross-sync operation
    logger.info('[Manual Sync] Starting device cross-sync operation');

    const result = await deviceSyncService.executeCrossSync();

    const executionTime = Date.now() - startTime;

    logger.info('[Manual Sync] Device cross-sync completed successfully', {
      totalProcessed: result.totalProcessed,
      matched: result.matched,
      onlyIntune: result.onlyIntune,
      onlyDefender: result.onlyDefender,
      executionTime: `${executionTime}ms`,
      ruConsumed: `${result.ruConsumed.toFixed(2)} RU`,
      errorCount: result.errors.length
    });

    // Prepare response with detailed statistics
    const response = {
      success: true,
      message: 'Device cross-sync completed successfully',
      data: {
        // Sync statistics
        statistics: {
          totalProcessed: result.totalProcessed,
          matched: result.matched,
          onlyIntune: result.onlyIntune,
          onlyDefender: result.onlyDefender,
          errorCount: result.errors.length
        },

        // Percentages for easier interpretation
        percentages: {
          matched: result.totalProcessed > 0
            ? parseFloat(((result.matched / result.totalProcessed) * 100).toFixed(2))
            : 0,
          onlyIntune: result.totalProcessed > 0
            ? parseFloat(((result.onlyIntune / result.totalProcessed) * 100).toFixed(2))
            : 0,
          onlyDefender: result.totalProcessed > 0
            ? parseFloat(((result.onlyDefender / result.totalProcessed) * 100).toFixed(2))
            : 0
        },

        // Performance metrics
        performance: {
          totalExecutionTimeMs: executionTime,
          serviceExecutionTimeMs: result.executionTime,
          phases: {
            fetchDefenderMs: result.fetchDefenderMs,
            fetchIntuneMs: result.fetchIntuneMs,
            matchingMs: result.matchingMs,
            clearMs: result.clearMs,
            upsertMs: result.upsertMs
          }
        },

        // Resource consumption
        resourceUsage: {
          totalRuConsumed: parseFloat(result.ruConsumed.toFixed(2)),
          breakdown: {
            fetchDefenderRu: parseFloat(result.fetchDefenderRu.toFixed(2)),
            fetchIntuneRu: parseFloat(result.fetchIntuneRu.toFixed(2)),
            clearRu: parseFloat(result.clearRu.toFixed(2)),
            upsertRu: parseFloat(result.upsertRu.toFixed(2))
          }
        },

        // Error details (if any)
        errors: result.errors.length > 0 ? result.errors : undefined
      },
      timestamp: new Date().toISOString(),
      invocationId
    };

    return successResponse(response);

  } catch (error) {
    const executionTime = Date.now() - startTime;

    logger.error('[Manual Sync] Device cross-sync failed', error as Error, {
      executionTime: `${executionTime}ms`
    });

    return handleError(error as Error, context, request);

  } finally {
    // Clear logger context
    logger.clearContext();
  }
}

// Register HTTP endpoint
app.http('syncDevicesCrossManual', {
  methods: ['POST'],
  authLevel: 'anonymous', // Authentication handled in code
  route: 'devices/sync-cross',
  handler: syncDevicesCrossManual
});
