/**
 * HTTP GET endpoint for IP threat statistics
 * GET /api/statistics/ip-threats
 *
 * Query parameters:
 * - startDate: Start date filter (ISO 8601)
 * - endDate: End date filter (ISO 8601)
 * - pageSize: Number of results per page (max 100)
 * - continuationToken: Pagination token
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { alertStatisticsService } from '../services/AlertStatisticsService';
import { StatisticsType } from '../models/AlertStatistics';
import { validateFunctionKey } from '../middleware/authentication';
import { handleError, successResponse } from '../utils/errorHandler';
import { validatePaginationParams, validateStatisticsFilters } from '../utils/validator';
import { logger } from '../utils/logger';

app.http('getIpThreatStatistics', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'statistics/ip-threats',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const functionName = 'getIpThreatStatistics';
    const invocationId = context.invocationId;

    logger.setContext({ functionName, invocationId });

    try {
      const authResult = validateFunctionKey(request);

      if (!authResult.authenticated) {
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

      const startDate = request.query.get('startDate');
      const endDate = request.query.get('endDate');
      const pageSize = request.query.get('pageSize');
      const continuationToken = request.query.get('continuationToken');

      const filterValidation = validateStatisticsFilters({ startDate, endDate });
      if (!filterValidation.valid) {
        return {
          status: 400,
          jsonBody: {
            error: 'Validation Error',
            message: 'Invalid query parameters',
            details: filterValidation.errors
          }
        };
      }

      const paginationValidation = validatePaginationParams(pageSize, continuationToken);
      if (!paginationValidation.valid) {
        return {
          status: 400,
          jsonBody: {
            error: 'Validation Error',
            message: paginationValidation.error
          }
        };
      }

      const result = await alertStatisticsService.queryStatistics(
        {
          type: StatisticsType.IpThreats,
          startDate: filterValidation.sanitized?.startDate,
          endDate: filterValidation.sanitized?.endDate
        },
        {
          pageSize: paginationValidation.pageSize,
          continuationToken: paginationValidation.continuationToken
        }
      );

      logger.info('[HTTP] IP threat statistics query completed', {
        itemCount: result.items.length
      });

      return successResponse({
        statistics: result.items,
        pagination: {
          count: result.count,
          hasMore: result.hasMore,
          continuationToken: result.continuationToken
        }
      });

    } catch (error) {
      return handleError(error as Error, context, request);
    } finally {
      logger.clearContext();
    }
  }
});
