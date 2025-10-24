/**
 * Get Synced Devices (GET /api/devices/sync-all)
 * Retrieves cross-matched device sync documents from devices_all container
 *
 * Query Parameters:
 * - syncState (optional): Filter by sync state (matched | only_intune | only_defender)
 * - pageSize (optional): Items per page (1-100, default 50)
 * - continuationToken (optional): Pagination token from previous response
 *
 * Response:
 * - devices: Array of sync documents with intune/defender device data
 * - pagination: Count, hasMore flag, and continuationToken
 *
 * Use Cases:
 * - Get all synced devices
 * - Filter by matched/intune-only/defender-only
 * - Paginate through large result sets
 * - Monitor device coverage across platforms
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { deviceSyncService } from '../services/DeviceSyncService';
import { validateFunctionKey } from '../middleware/authentication';
import { handleError, successResponse } from '../utils/errorHandler';
import { validatePaginationParams } from '../utils/validator';
import { logger } from '../utils/logger';

/**
 * HTTP GET handler for synced devices
 */
async function getSyncedDevices(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const functionName = 'getSyncedDevices';
  const invocationId = context.invocationId;

  // Set logger context
  logger.setContext({
    functionName,
    invocationId,
    method: request.method,
    url: request.url
  });

  try {
    // Validate authentication
    const authResult = validateFunctionKey(request);

    if (!authResult.authenticated) {
      logger.warn('[Get Synced Devices] Authentication failed', {
        reason: authResult.error
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

    // Extract and validate query parameters
    const syncStateParam = request.query.get('syncState');
    const pageSizeParam = request.query.get('pageSize') || '50';
    const continuationToken = request.query.get('continuationToken');

    // Validate pagination parameters
    const paginationValidation = validatePaginationParams(
      pageSizeParam,
      continuationToken
    );

    if (!paginationValidation.valid) {
      logger.warn('[Get Synced Devices] Invalid pagination parameters', {
        error: paginationValidation.error,
        pageSize: pageSizeParam
      });

      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: {
          error: 'Bad Request',
          message: paginationValidation.error
        }
      };
    }

    // Validate syncState if provided
    let syncState: 'matched' | 'only_intune' | 'only_defender' | undefined;

    if (syncStateParam) {
      const validStates = ['matched', 'only_intune', 'only_defender'];
      if (!validStates.includes(syncStateParam)) {
        logger.warn('[Get Synced Devices] Invalid syncState parameter', {
          syncState: syncStateParam
        });

        return {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
          jsonBody: {
            error: 'Bad Request',
            message: `Invalid syncState. Must be one of: ${validStates.join(', ')}`
          }
        };
      }

      syncState = syncStateParam as 'matched' | 'only_intune' | 'only_defender';
    }

    const pageSize = paginationValidation.pageSize!;

    logger.info('[Get Synced Devices] Processing request', {
      syncState: syncState || 'all',
      pageSize,
      hasContinuationToken: !!continuationToken
    });

    // Get synced devices from service
    const result = await deviceSyncService.getSyncedDevices(
      syncState,
      pageSize,
      paginationValidation.continuationToken
    );

    logger.info('[Get Synced Devices] Request completed successfully', {
      count: result.pagination.count,
      hasMore: result.pagination.hasMore,
      syncState: syncState || 'all'
    });

    return successResponse({
      devices: result.devices,
      pagination: result.pagination,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('[Get Synced Devices] Request failed', error as Error);
    return handleError(error as Error, context, request);

  } finally {
    // Clear logger context
    logger.clearContext();
  }
}

// Register HTTP endpoint
app.http('getSyncedDevices', {
  methods: ['GET'],
  authLevel: 'anonymous', // Authentication handled in code
  route: 'devices/sync-all',
  handler: getSyncedDevices
});
