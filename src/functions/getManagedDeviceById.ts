/**
 * Azure Function: Get Managed Device By ID
 * HTTP GET endpoint to retrieve a single managed device by its ID
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { managedDeviceService } from '../services/ManagedDeviceService';
import { handleError, successResponse, ValidationError } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import { validateFunctionKey } from '../middleware/authentication';
import { validateId } from '../utils/validator';

async function getManagedDeviceById(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    logger.setContext({
      functionName: context.functionName,
      invocationId: context.invocationId
    });

    logger.info('Processing get managed device by ID request');

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

    // Get ID from route parameters
    const id = request.params.id;

    // Validate ID
    const validationResult = validateId(id);
    if (!validationResult.valid) {
      throw new ValidationError(validationResult.error || 'Invalid device ID');
    }

    logger.info('Request validation successful', { id });

    // Get managed device by ID
    const device = await managedDeviceService.getManagedDeviceById(id!);

    logger.info('Managed device retrieved successfully', {
      id,
      deviceName: device.deviceName
    });

    return successResponse(device);
  } catch (error) {
    return handleError(error, context, request);
  } finally {
    logger.clearContext();
  }
}

app.http('getManagedDeviceById', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'managed-devices/{id}',
  handler: getManagedDeviceById
});
