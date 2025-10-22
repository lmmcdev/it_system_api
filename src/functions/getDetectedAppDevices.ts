/**
 * Azure Function: Get Detected App Devices
 * HTTP GET endpoint to retrieve managed devices that have a specific detected app installed
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { detectedAppService } from '../services/DetectedAppService';
import { handleError, successResponse, ValidationError } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import { validateFunctionKey } from '../middleware/authentication';
import { validateId, validatePaginationParams } from '../utils/validator';

async function getDetectedAppDevices(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    logger.setContext({
      functionName: context.functionName,
      invocationId: context.invocationId
    });

    logger.info('Processing get detected app devices request');

    // Authentication check
    const authResult = validateFunctionKey(request);
    if (!authResult.authenticated) {
      logger.warn('Authentication failed', { error: authResult.error });
      return {
        status: 401,
        jsonBody: {
          success: false,
          error: {
            code: 'AUTHENTICATION_FAILED',
            message: authResult.error || 'Authentication required'
          },
          timestamp: new Date().toISOString()
        },
        headers: {
          'Content-Type': 'application/json',
          'WWW-Authenticate': 'FunctionKey'
        }
      };
    }

    logger.info('Authentication successful', { userId: authResult.userId });

    // Get appId from route parameters
    const appId = request.params.appId;

    // Validate appId
    const validationResult = validateId(appId);
    if (!validationResult.valid) {
      throw new ValidationError(validationResult.error || 'Invalid app ID');
    }

    // Get pagination parameters from query string
    const pageSize = request.query.get('pageSize');
    const nextLink = request.query.get('nextLink');

    // Validate pagination parameters
    const paginationResult = validatePaginationParams(pageSize, nextLink);
    if (!paginationResult.valid) {
      throw new ValidationError(paginationResult.error || 'Invalid pagination parameters');
    }

    logger.info('Request validation successful', {
      appId,
      pageSize: paginationResult.pageSize,
      hasNextLink: !!paginationResult.continuationToken
    });

    // Get managed devices for the detected app
    const result = await detectedAppService.getAppManagedDevices(appId!, {
      pageSize: paginationResult.pageSize,
      nextLink: paginationResult.continuationToken
    });

    logger.info('Detected app devices retrieved successfully', {
      appId,
      count: result.count,
      hasMore: result.hasMore
    });

    return successResponse(result);
  } catch (error) {
    return handleError(error, context, request);
  } finally {
    logger.clearContext();
  }
}

app.http('getDetectedAppDevices', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'detected-apps/{appId}/devices',
  handler: getDetectedAppDevices
});
