/**
 * Azure Function: Get Non-Compliant Devices
 * HTTP GET endpoint to retrieve all devices with non-compliant status
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { managedDeviceService } from '../services/ManagedDeviceService';
import { handleError, successResponse, ValidationError } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import { validateFunctionKey } from '../middleware/authentication';

async function getNonCompliantDevices(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    logger.setContext({
      functionName: context.functionName,
      invocationId: context.invocationId
    });

    logger.info('Processing get non-compliant devices request');

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
      pageSize: validatedPageSize,
      hasNextLink: !!nextLink
    });

    // Get non-compliant devices
    const result = await managedDeviceService.getNonCompliantDevices({
      pageSize: validatedPageSize,
      nextLink: nextLink || undefined
    });

    logger.info('Non-compliant devices retrieved successfully', {
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

app.http('getNonCompliantDevices', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'managed-devices/compliance/non-compliant',
  handler: getNonCompliantDevices
});
