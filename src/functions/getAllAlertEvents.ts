/**
 * Azure Function: Get All Alert Events
 * HTTP GET endpoint to retrieve all alert events with optional filtering and pagination
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { alertEventService } from '../services/AlertEventService';
import { handleError, successResponse, ValidationError } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import { validateFunctionKey } from '../middleware/authentication';
import { checkRateLimit, createRateLimitResponse, RATE_LIMITS } from '../middleware/rateLimit';
import { validateAlertFilters, validatePaginationParams } from '../utils/validator';

async function getAllAlertEvents(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    logger.setContext({
      functionName: context.functionName,
      invocationId: context.invocationId
    });

    logger.info('Processing get all alert events request');

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
    const rateLimitResult = checkRateLimit(request, 'getAll', RATE_LIMITS.getAll);
    if (!rateLimitResult.allowed) {
      return createRateLimitResponse(rateLimitResult);
    }

    // Parse and validate pagination parameters
    const pageSize = request.query.get('pageSize');
    const continuationToken = request.query.get('continuationToken');

    const paginationValidation = validatePaginationParams(pageSize, continuationToken);
    if (!paginationValidation.valid) {
      throw new ValidationError(paginationValidation.error || 'Invalid pagination parameters');
    }

    // Parse filter parameters
    const filters = {
      severity: request.query.get('severity'),
      status: request.query.get('status'),
      category: request.query.get('category'),
      startDate: request.query.get('startDate'),
      endDate: request.query.get('endDate')
    };

    // Validate filters
    const filterValidation = validateAlertFilters(filters);
    if (!filterValidation.valid) {
      const errorMessage = filterValidation.errors?.join(', ') || 'Invalid filter parameters';
      throw new ValidationError(errorMessage);
    }

    logger.info('Request validation successful', {
      filters: filterValidation.sanitized,
      pageSize: paginationValidation.pageSize,
      hasContinuationToken: !!paginationValidation.continuationToken
    });

    // Get alert events with pagination
    const result = await alertEventService.getAllAlertEvents(
      filterValidation.sanitized,
      {
        pageSize: paginationValidation.pageSize,
        continuationToken: paginationValidation.continuationToken
      }
    );

    logger.info('Alert events retrieved successfully', {
      count: result.count,
      hasMore: result.hasMore
    });

    return successResponse({
      items: result.items,
      pagination: {
        count: result.count,
        hasMore: result.hasMore,
        continuationToken: result.continuationToken
      }
    });
  } catch (error) {
    return handleError(error, context, request);
  } finally {
    logger.clearContext();
  }
}

app.http('getAllAlertEvents', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'alert-events',
  handler: getAllAlertEvents
});
