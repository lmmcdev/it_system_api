/**
 * Azure Function: Get All Vulnerabilities
 * HTTP GET endpoint to retrieve all vulnerabilities with optional filtering and pagination
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { vulnerabilityDefenderService } from '../services/VulnerabilityDefenderService';
import { handleError, successResponse, ValidationError } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import { validateFunctionKey } from '../middleware/authentication';
import { checkRateLimit, createRateLimitResponse, RATE_LIMITS } from '../middleware/rateLimit';
import { validatePaginationParams, sanitizeQueryParam, validateISODate } from '../utils/validator';

async function getAllVulnerabilities(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    logger.setContext({
      functionName: context.functionName,
      invocationId: context.invocationId
    });

    logger.info('Processing get all vulnerabilities request');

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
    const pageSize = request.query.get('top') || request.query.get('pageSize');
    const continuationToken = request.query.get('continuationToken');

    const paginationValidation = validatePaginationParams(pageSize, continuationToken);
    if (!paginationValidation.valid) {
      throw new ValidationError(paginationValidation.error || 'Invalid pagination parameters');
    }

    // Parse and validate filter parameters
    const name = request.query.get('name');
    const severityParam = request.query.get('severity');
    const updatedOnFrom = request.query.get('updatedOnFrom');
    const updatedOnTo = request.query.get('updatedOnTo');

    // Sanitize name parameter
    const nameResult = name ? sanitizeQueryParam(name) : { isValid: true, value: undefined };
    if (!nameResult.isValid) {
      throw new ValidationError(nameResult.error || 'Invalid name parameter');
    }
    const sanitizedName = nameResult.value;

    // Parse severity (can be comma-separated list)
    let severityArray: string[] | undefined;
    if (severityParam) {
      const severityResult = sanitizeQueryParam(severityParam);
      if (!severityResult.isValid) {
        throw new ValidationError(severityResult.error || 'Invalid severity parameter');
      }

      if (severityResult.value) {
        severityArray = severityResult.value.split(',').map(s => s.trim()).filter(s => s.length > 0);

        // Validate each severity value
        const validSeverities = ['Low', 'Medium', 'High', 'Critical'];
        const invalidSeverities = severityArray.filter(s => !validSeverities.includes(s));
        if (invalidSeverities.length > 0) {
          throw new ValidationError(
            `Invalid severity values: ${invalidSeverities.join(', ')}. Must be one of: ${validSeverities.join(', ')}`
          );
        }
      }
    }

    // Validate date parameters
    if (updatedOnFrom) {
      const dateValidation = validateISODate(updatedOnFrom);
      if (!dateValidation.valid) {
        throw new ValidationError(
          `Invalid updatedOnFrom format: ${dateValidation.error || 'Must be ISO 8601 date'}`
        );
      }
    }

    if (updatedOnTo) {
      const dateValidation = validateISODate(updatedOnTo);
      if (!dateValidation.valid) {
        throw new ValidationError(
          `Invalid updatedOnTo format: ${dateValidation.error || 'Must be ISO 8601 date'}`
        );
      }
    }

    const filters = {
      name: sanitizedName,
      severity: severityArray,
      updatedOnFrom: updatedOnFrom || undefined,
      updatedOnTo: updatedOnTo || undefined
    };

    logger.info('Request validation successful', {
      filters,
      pageSize: paginationValidation.pageSize,
      hasContinuationToken: !!paginationValidation.continuationToken
    });

    // Get vulnerabilities with pagination
    const result = await vulnerabilityDefenderService.getAllVulnerabilities(
      filters,
      {
        pageSize: paginationValidation.pageSize,
        continuationToken: paginationValidation.continuationToken
      }
    );

    logger.info('Vulnerabilities retrieved successfully', {
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

app.http('getAllVulnerabilities', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'vulnerabilities',
  handler: getAllVulnerabilities
});
