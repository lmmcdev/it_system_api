/**
 * Azure Function: Get Managed Devices By User
 * HTTP GET endpoint to retrieve all managed devices for a specific user
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { managedDeviceService } from '../services/ManagedDeviceService';
import { handleError, successResponse, ValidationError } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import { validateFunctionKey } from '../middleware/authentication';
import { sanitizeQueryParam } from '../utils/validator';

async function getManagedDevicesByUser(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    logger.setContext({
      functionName: context.functionName,
      invocationId: context.invocationId
    });

    logger.info('Processing get managed devices by user request');

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

    // Get userId from route parameters
    const userId = request.params.userId;

    if (!userId) {
      throw new ValidationError('userId is required');
    }

    // Validate and sanitize userId
    const userIdResult = sanitizeQueryParam(userId, 200, /^[a-zA-Z0-9\-_@.]+$/);
    if (!userIdResult.isValid) {
      throw new ValidationError(userIdResult.error || 'Invalid userId format');
    }

    // Parse pagination parameters
    const pageSize = request.query.get('pageSize');
    const nextLink = request.query.get('nextLink');

    // Validate page size
    let validatedPageSize = 100; // Default
    if (pageSize) {
      const parsed = parseInt(pageSize, 10);
      if (isNaN(parsed) || parsed < 1 || parsed > 999) {
        throw new ValidationError('pageSize must be between 1 and 999');
      }
      validatedPageSize = parsed;
    }

    logger.info('Request validation successful', {
      userId: userIdResult.value,
      pageSize: validatedPageSize,
      hasNextLink: !!nextLink
    });

    // Get managed devices by user ID
    const result = await managedDeviceService.getManagedDevicesByUserId(
      userIdResult.value!,
      {
        pageSize: validatedPageSize,
        nextLink: nextLink || undefined
      }
    );

    logger.info('Managed devices by user retrieved successfully', {
      userId: userIdResult.value,
      count: result.count,
      hasMore: result.hasMore
    });

    return successResponse({
      items: result.items,
      pagination: {
        count: result.count,
        hasMore: result.hasMore,
        nextLink: result.nextLink
      }
    });
  } catch (error) {
    return handleError(error, context, request);
  } finally {
    logger.clearContext();
  }
}

app.http('getManagedDevicesByUser', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'managed-devices/user/{userId}',
  handler: getManagedDevicesByUser
});
