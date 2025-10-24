/**
 * Search Devices (GET /api/devices/search)
 * Search across synced device documents with flexible filtering
 *
 * Query Parameters:
 * - syncKey (optional): Azure AD Device ID or sync key
 * - syncState (optional): Filter by sync state (matched | only_intune | only_defender)
 * - deviceName (optional): Search in Intune device name (case-insensitive, partial match)
 * - operatingSystem (optional): Search in Intune OS (case-insensitive, partial match)
 * - computerDnsName (optional): Search in Defender DNS name (case-insensitive, partial match)
 * - osPlatform (optional): Search in Defender OS platform (case-insensitive, partial match)
 * - lastIpAddress (optional): Search in Defender last IP address (exact match)
 * - pageSize (optional): Items per page (1-100, default 50)
 * - continuationToken (optional): Pagination token from previous response
 *
 * Response:
 * - devices: Array of matching sync documents
 * - pagination: Count, hasMore flag, and continuationToken
 *
 * Use Cases:
 * - Find devices by hostname or partial name
 * - Search devices by IP address
 * - Filter by operating system
 * - Locate specific device using Azure AD Device ID
 * - Combine multiple filters for refined search
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { deviceSyncService } from '../services/DeviceSyncService';
import { validateFunctionKey } from '../middleware/authentication';
import { handleError, successResponse } from '../utils/errorHandler';
import { validatePaginationParams, validateDeviceSearchFilters } from '../utils/validator';
import { logger } from '../utils/logger';

/**
 * HTTP GET handler for device search
 */
async function searchDevices(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const functionName = 'searchDevices';
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
      logger.warn('[Search Devices] Authentication failed', {
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

    // Extract query parameters
    const deviceId = request.query.get('deviceId');
    const syncKey = request.query.get('syncKey');
    const syncState = request.query.get('syncState');
    const deviceName = request.query.get('deviceName');
    const operatingSystem = request.query.get('operatingSystem');
    const computerDnsName = request.query.get('computerDnsName');
    const osPlatform = request.query.get('osPlatform');
    const lastIpAddress = request.query.get('lastIpAddress');
    const pageSizeParam = request.query.get('pageSize') || '50';
    const continuationToken = request.query.get('continuationToken');

    // Validate pagination parameters
    const paginationValidation = validatePaginationParams(
      pageSizeParam,
      continuationToken
    );

    if (!paginationValidation.valid) {
      logger.warn('[Search Devices] Invalid pagination parameters', {
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

    // Validate search filters
    const filtersValidation = validateDeviceSearchFilters({
      deviceId,
      syncKey,
      syncState,
      deviceName,
      operatingSystem,
      computerDnsName,
      osPlatform,
      lastIpAddress
    });

    if (!filtersValidation.valid) {
      logger.warn('[Search Devices] Invalid search filters', {
        errors: filtersValidation.errors
      });

      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: {
          error: 'Bad Request',
          message: 'Invalid search parameters',
          details: filtersValidation.errors
        }
      };
    }

    const pageSize = paginationValidation.pageSize!;
    const sanitizedFilters = filtersValidation.sanitized || {};

    // Check if at least one filter is provided
    if (Object.keys(sanitizedFilters).length === 0) {
      logger.warn('[Search Devices] No search filters provided');

      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: {
          error: 'Bad Request',
          message: 'At least one search parameter is required (syncKey, syncState, deviceName, operatingSystem, computerDnsName, osPlatform, or lastIpAddress)'
        }
      };
    }

    logger.info('[Search Devices] Processing search request', {
      filters: sanitizedFilters,
      pageSize,
      hasContinuationToken: !!continuationToken
    });

    // Search devices through service
    const result = await deviceSyncService.searchDevices(
      sanitizedFilters,
      pageSize,
      paginationValidation.continuationToken
    );

    logger.info('[Search Devices] Search completed successfully', {
      count: result.pagination.count,
      hasMore: result.pagination.hasMore,
      filterCount: Object.keys(sanitizedFilters).length
    });

    return successResponse({
      devices: result.devices,
      pagination: result.pagination,
      filters: sanitizedFilters,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('[Search Devices] Search failed', error as Error);
    return handleError(error as Error, context, request);

  } finally {
    // Clear logger context
    logger.clearContext();
  }
}

// Register HTTP endpoint
app.http('searchDevices', {
  methods: ['GET'],
  authLevel: 'anonymous', // Authentication handled in code
  route: 'devices/search',
  handler: searchDevices
});
