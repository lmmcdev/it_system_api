/**
 * Remediations (GET /api/remediations)
 * Atera Tickets
 *
 * Query Parameters:
 * - TODO: Add query parameters
 *
 * Response:
 * - TODO: Add response description
 *
 * Use Cases:
 * - TODO: Add use cases
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { remediationsService } from '../services/RemediationsService';
import { validateFunctionKey } from '../middleware/authentication';
import { handleError, successResponse } from '../utils/errorHandler';
import { logger } from '../utils/logger';

/**
 * HTTP GET handler for remediations
 */
async function remediations(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const functionName = 'remediations';
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
      logger.warn('[Remediations] Authentication failed', {
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
    const pageSizeParam = request.query.get('pageSize') || '50';
    const continuationToken = request.query.get('continuationToken');

    // Validate pageSize
    const pageSize = parseInt(pageSizeParam, 10);
    if (isNaN(pageSize) || pageSize < 1 || pageSize > 100) {
      logger.warn('[Remediations] Invalid pageSize parameter', {
        pageSize: pageSizeParam
      });

      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: {
          error: 'Bad Request',
          message: 'pageSize must be a number between 1 and 100'
        }
      };
    }

    logger.info('[Remediations] Processing request', {
      pageSize,
      hasContinuationToken: !!continuationToken
    });

    // Call service layer
    const result = await remediationsService.getAllTickets(pageSize, continuationToken || undefined);

    logger.info('[Remediations] Request completed successfully', {
      count: result.pagination.count,
      hasMore: result.pagination.hasMore
    });

    return successResponse({
      tickets: result.tickets,
      pagination: result.pagination,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('[Remediations] Request failed', error as Error);
    return handleError(error as Error, context, request);

  } finally {
    // Clear logger context
    logger.clearContext();
  }
}

// Register HTTP endpoint
app.http('remediations', {
  methods: ['GET'],
  authLevel: 'anonymous', // Authentication handled in code
  route: 'remediations',
  handler: remediations
});
