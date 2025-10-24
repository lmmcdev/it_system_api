/**
 * Get Remediation by ID (GET /api/remediations/{id})
 * Atera Ticket by Document ID (numeric ID)
 *
 * Path Parameters:
 * - id: Numeric ticket ID (e.g., "5876") - NOT UUID
 *
 * Response:
 * - 200: Ticket document
 * - 404: Ticket not found
 * - 401: Unauthorized
 * - 400: Invalid ID format
 * - 500: Internal server error
 *
 * Use Cases:
 * - Retrieve ticket details by ticket ID
 * - Direct lookup using numeric ID (fast read)
 *
 * Note: Atera tickets use integer IDs, not UUIDs
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { remediationsService } from '../services/RemediationsService';
import { validateFunctionKey } from '../middleware/authentication';
import { handleError, successResponse, NotFoundError } from '../utils/errorHandler';
import { logger } from '../utils/logger';

/**
 * HTTP GET handler for remediation by ID
 */
async function getRemediationById(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const functionName = 'getRemediationById';
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
      logger.warn('[GetRemediationById] Authentication failed', {
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

    // Extract ID from path parameters
    const id = request.params.id;

    if (!id) {
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: {
          error: 'Bad Request',
          message: 'ID parameter is required'
        }
      };
    }

    // Validate ID parameter (must be numeric - Atera uses integer IDs)
    const idStr = id.trim();
    if (!/^\d+$/.test(idStr)) {
      logger.warn('[GetRemediationById] Invalid ID format - must be numeric', {
        id
      });

      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: {
          error: 'Bad Request',
          message: 'ID must be a numeric value (e.g., 5876)'
        }
      };
    }

    // Validate ID range
    const idNum = parseInt(idStr, 10);
    if (idNum < 1 || idNum > 999999999) {
      logger.warn('[GetRemediationById] ID out of valid range', {
        id,
        idNum
      });

      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: {
          error: 'Bad Request',
          message: 'ID must be between 1 and 999999999'
        }
      };
    }

    logger.info('[GetRemediationById] Processing request', { id });

    // Call service layer
    const ticket = await remediationsService.getTicketById(id);

    logger.info('[GetRemediationById] Request completed successfully', {
      id,
      ticketId: (ticket as { Ticket_ID?: string }).Ticket_ID
    });

    return successResponse({
      ticket,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    if (error instanceof NotFoundError) {
      logger.info('[GetRemediationById] Ticket not found', {
        id: request.params.id
      });

      return {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: {
          error: 'Not Found',
          message: 'Ticket not found'
        }
      };
    }

    logger.error('[GetRemediationById] Request failed', error as Error);
    return handleError(error as Error, context, request);

  } finally {
    // Clear logger context
    logger.clearContext();
  }
}

// Register HTTP endpoint
app.http('getRemediationById', {
  methods: ['GET'],
  authLevel: 'anonymous', // Authentication handled in code
  route: 'remediations/{id}',
  handler: getRemediationById
});
