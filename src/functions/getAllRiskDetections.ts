/**
 * Azure Function: Get All Risk Detection Events
 * HTTP GET endpoint to retrieve all risk detection events with optional filtering and pagination
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { riskDetectionService } from '../services/RiskDetectionService';
import { handleError, successResponse, ValidationError } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import { validateFunctionKey } from '../middleware/authentication';
import { checkRateLimit, createRateLimitResponse, RATE_LIMITS } from '../middleware/rateLimit';
import { validateRiskFilters, validatePaginationParams } from '../utils/validator';

async function getAllRiskDetections(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    logger.setContext({
      functionName: context.functionName,
      invocationId: context.invocationId
    });

    logger.info('Processing get all risk detection events request');

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
      riskLevel: request.query.get('riskLevel'),
      riskState: request.query.get('riskState'),
      userId: request.query.get('userId'),
      startDate: request.query.get('startDate'),
      endDate: request.query.get('endDate')
    };

    // Validate filters
    const filterValidation = validateRiskFilters(filters);
    if (!filterValidation.valid) {
      const errorMessage = filterValidation.errors?.join(', ') || 'Invalid filter parameters';
      throw new ValidationError(errorMessage);
    }

    logger.info('Request validation successful', {
      filters: filterValidation.sanitized,
      pageSize: paginationValidation.pageSize,
      hasContinuationToken: !!paginationValidation.continuationToken
    });

    // Get risk detection events with pagination
    const result = await riskDetectionService.getAllRiskDetectionEvents(
      filterValidation.sanitized,
      {
        pageSize: paginationValidation.pageSize,
        continuationToken: paginationValidation.continuationToken
      }
    );

    logger.info('Risk detection events retrieved successfully', {
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

app.http('getAllRiskDetections', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'risk-detections',
  handler: getAllRiskDetections
});
