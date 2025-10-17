/**
 * Azure Function: Get Alert Event by ID
 * HTTP GET endpoint to retrieve a specific alert event by its ID
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { alertEventService } from '../services/AlertEventService';
import { handleError, successResponse, ValidationError } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import { validateFunctionKey } from '../middleware/authentication';
import { validateId } from '../utils/validator';

async function getAlertEventById(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    logger.setContext({
      functionName: context.functionName,
      invocationId: context.invocationId
    });

    logger.info('Processing get alert event by ID request');

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

    // Get and validate ID parameter
    const id = request.params.id;
    const idValidation = validateId(id);

    if (!idValidation.valid) {
      logger.warn('ID validation failed', { id, error: idValidation.error });
      throw new ValidationError(idValidation.error || 'Invalid ID format');
    }

    logger.info('Request validation successful', { id });

    // Get alert event
    const alertEvent = await alertEventService.getAlertEventById(id!);

    logger.info('Alert event retrieved successfully', { id });

    return successResponse(alertEvent);
  } catch (error) {
    return handleError(error, context, request);
  } finally {
    logger.clearContext();
  }
}

app.http('getAlertEventById', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'alert-events/{id}',
  handler: getAlertEventById
});
