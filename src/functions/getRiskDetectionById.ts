/**
 * Azure Function: Get Risk Detection Event by ID
 * HTTP GET endpoint to retrieve a specific risk detection event by its ID
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { riskDetectionService } from '../services/RiskDetectionService';
import { handleError, successResponse, ValidationError } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import { validateFunctionKey } from '../middleware/authentication';
import { checkRateLimit, createRateLimitResponse, RATE_LIMITS } from '../middleware/rateLimit';
import { validateId } from '../utils/validator';

async function getRiskDetectionById(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    logger.setContext({
      functionName: context.functionName,
      invocationId: context.invocationId
    });

    logger.info('Processing get risk detection event by ID request');

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

    // Rate limiting check
    const rateLimitResult = checkRateLimit(request, 'getById', RATE_LIMITS.getById);
    if (!rateLimitResult.allowed) {
      return createRateLimitResponse(rateLimitResult);
    }

    // Get and validate ID parameter
    const id = request.params.id;
    const idValidation = validateId(id);

    if (!idValidation.valid) {
      logger.warn('ID validation failed', { id, error: idValidation.error });
      throw new ValidationError(idValidation.error || 'Invalid ID format');
    }

    logger.info('Request validation successful', { id });

    // Get risk detection event
    const riskDetectionEvent = await riskDetectionService.getRiskDetectionEventById(id!);

    logger.info('Risk detection event retrieved successfully', { id });

    return successResponse(riskDetectionEvent);
  } catch (error) {
    return handleError(error, context, request);
  } finally {
    logger.clearContext();
  }
}

app.http('getRiskDetectionById', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'risk-detections/{id}',
  handler: getRiskDetectionById
});
