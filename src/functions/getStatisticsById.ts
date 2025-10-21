/**
 * HTTP GET endpoint to retrieve specific alert statistics by ID
 * GET /api/statistics/{id}
 *
 * Path parameters:
 * - id: Statistics document ID (format: {type}_{startDate}_{endDate})
 *
 * Query parameters:
 * - partitionKey: Partition key (periodStartDate in YYYY-MM-DD format)
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { alertStatisticsService } from '../services/AlertStatisticsService';
import { validateFunctionKey } from '../middleware/authentication';
import { handleError, successResponse } from '../utils/errorHandler';
import { ValidationError } from '../utils/errorHandler';
import { logger } from '../utils/logger';

app.http('getStatisticsById', {
  methods: ['GET'],
  authLevel: 'anonymous', // Auth handled in code
  route: 'statistics/{id}',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const functionName = 'getStatisticsById';
    const invocationId = context.invocationId;

    logger.setContext({ functionName, invocationId });

    try {
      // 1. Validate authentication
      const authResult = validateFunctionKey(request);

      if (!authResult.authenticated) {
        logger.warn('[Auth] Unauthorized access attempt', {
          error: authResult.error
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

      // 2. Extract and validate parameters
      const id = request.params.id;
      const partitionKey = request.query.get('partitionKey');

      if (!id || id.trim().length === 0) {
        throw new ValidationError('Statistics ID is required');
      }

      if (!partitionKey || partitionKey.trim().length === 0) {
        throw new ValidationError('Partition key (periodStartDate) is required');
      }

      // Validate partition key format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(partitionKey)) {
        throw new ValidationError('Partition key must be in YYYY-MM-DD format');
      }

      logger.info('[HTTP] Fetching statistics by ID', {
        id,
        partitionKey,
        userId: authResult.userId
      });

      // 3. Fetch statistics
      const statistics = await alertStatisticsService.getById(id, partitionKey);

      logger.info('[HTTP] Statistics fetched successfully', {
        id,
        type: statistics.type
      });

      // 4. Return result
      return successResponse(statistics);

    } catch (error) {
      return handleError(error as Error, context, request);
    } finally {
      logger.clearContext();
    }
  }
});
