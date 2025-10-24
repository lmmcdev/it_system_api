/**
 * Search Remediations (GET /api/remediations/search)
 * Flexible search for Atera Tickets with multiple filters
 *
 * Query Parameters:
 * - ticketId (optional): Exact match on Ticket_ID
 * - title (optional): Case-insensitive search in Ticket_title
 * - priority (optional): Low | Medium | High | Critical
 * - type (optional): Ticket type (e.g., Incident, Request)
 * - status (optional): Activity status (e.g., Read, In Progress)
 * - source (optional): Ticket source (e.g., Email, Portal)
 * - productFamily (optional): Case-insensitive search in Product_Family
 * - siteName (optional): Case-insensitive search in Site_name
 * - technicianEmail (optional): Exact match on Technician_email
 * - endUserEmail (optional): Exact match on End_User_email
 * - createdFrom (optional): Filter tickets created after date (YYYY-MM-DD or ISO 8601)
 * - createdTo (optional): Filter tickets created before date (YYYY-MM-DD or ISO 8601)
 * - pageSize (optional): 1-100, default 50
 * - continuationToken (optional): Pagination token
 *
 * Response:
 * - 200: Paginated tickets matching filters
 * - 400: Invalid filters or no filters provided
 * - 401: Unauthorized
 * - 500: Internal server error
 *
 * Use Cases:
 * - Search tickets by priority and status
 * - Find tickets for specific technician or end user
 * - Filter tickets by date range
 * - Search tickets by product family or site
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { remediationsService } from '../services/RemediationsService';
import { validateFunctionKey } from '../middleware/authentication';
import { handleError, successResponse } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import { validatePaginationParams, validateTicketSearchFilters } from '../utils/validator';

/**
 * HTTP GET handler for remediation search
 */
async function searchRemediations(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const functionName = 'searchRemediations';
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
      logger.warn('[SearchRemediations] Authentication failed', {
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

    // Extract pagination parameters
    const pageSizeParam = request.query.get('pageSize');
    const continuationTokenParam = request.query.get('continuationToken');

    const paginationValidation = validatePaginationParams(pageSizeParam, continuationTokenParam);
    if (!paginationValidation.valid) {
      logger.warn('[SearchRemediations] Invalid pagination parameters', {
        error: paginationValidation.error
      });

      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: {
          error: 'Bad Request',
          message: paginationValidation.error
        }
      };
    }

    const pageSize = paginationValidation.pageSize!;
    const continuationToken = paginationValidation.continuationToken;

    // Extract search filters from query parameters
    const filters = {
      ticketId: request.query.get('ticketId'),
      title: request.query.get('title'),
      priority: request.query.get('priority'),
      type: request.query.get('type'),
      status: request.query.get('status'),
      source: request.query.get('source'),
      productFamily: request.query.get('productFamily'),
      siteName: request.query.get('siteName'),
      technicianEmail: request.query.get('technicianEmail'),
      endUserEmail: request.query.get('endUserEmail'),
      createdFrom: request.query.get('createdFrom'),
      createdTo: request.query.get('createdTo')
    };

    // Validate search filters
    const filterValidation = validateTicketSearchFilters(filters);
    if (!filterValidation.valid) {
      logger.warn('[SearchRemediations] Invalid search filters', {
        errors: filterValidation.errors
      });

      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: {
          error: 'Bad Request',
          message: 'Invalid search filters',
          details: filterValidation.errors
        }
      };
    }

    const sanitizedFilters = filterValidation.sanitized!;

    logger.info('[SearchRemediations] Processing request', {
      filters: sanitizedFilters,
      pageSize,
      hasContinuationToken: !!continuationToken
    });

    // Call service layer
    const result = await remediationsService.searchTickets(
      sanitizedFilters,
      pageSize,
      continuationToken
    );

    logger.info('[SearchRemediations] Request completed successfully', {
      count: result.pagination.count,
      hasMore: result.pagination.hasMore
    });

    return successResponse({
      tickets: result.tickets,
      pagination: result.pagination,
      appliedFilters: sanitizedFilters,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('[SearchRemediations] Request failed', error as Error);
    return handleError(error as Error, context, request);

  } finally {
    // Clear logger context
    logger.clearContext();
  }
}

// Register HTTP endpoint
app.http('searchRemediations', {
  methods: ['GET'],
  authLevel: 'anonymous', // Authentication handled in code
  route: 'remediations/search',
  handler: searchRemediations
});
