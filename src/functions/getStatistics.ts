/**
 * HTTP GET endpoint to query alert statistics with filters
 * GET /api/statistics
 *
 * Query parameters:
 * - type: Statistics type (detectionSource, userImpact, ipThreats, attackTypes)
 * - startDate: Start date filter (ISO 8601)
 * - endDate: End date filter (ISO 8601)
 * - periodType: Period type (hourly, daily, weekly, monthly, custom)
 * - pageSize: Number of results per page (max 100)
 * - continuationToken: Pagination token
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { alertStatisticsService } from '../services/AlertStatisticsService';
import { validateFunctionKey } from '../middleware/authentication';
import { handleError, successResponse } from '../utils/errorHandler';
import { validatePaginationParams, validateStatisticsFilters } from '../utils/validator';
import { logger } from '../utils/logger';

app.http('getStatistics', {
  methods: ['GET'],
  authLevel: 'anonymous', // Auth handled in code
  route: 'statistics',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const functionName = 'getStatistics';
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

      logger.info('[HTTP] Statistics query request received', {
        userId: authResult.userId
      });

      // 2. Extract and validate query parameters
      const type = request.query.get('type');
      const startDate = request.query.get('startDate');
      const endDate = request.query.get('endDate');
      const periodType = request.query.get('periodType');
      const pageSize = request.query.get('pageSize');
      const continuationToken = request.query.get('continuationToken');

      // Validate filters
      const filterValidation = validateStatisticsFilters({
        type,
        startDate,
        endDate
      });

      if (!filterValidation.valid) {
        logger.warn('[Validation] Invalid filter parameters', {
          errors: filterValidation.errors
        });

        return {
          status: 400,
          jsonBody: {
            error: 'Validation Error',
            message: 'Invalid query parameters',
            details: filterValidation.errors
          }
        };
      }

      // Validate periodType if provided
      if (periodType) {
        const allowedPeriodTypes = ['hourly', 'daily', 'weekly', 'monthly', 'custom'];
        if (!allowedPeriodTypes.includes(periodType)) {
          return {
            status: 400,
            jsonBody: {
              error: 'Validation Error',
              message: `Invalid periodType. Must be one of: ${allowedPeriodTypes.join(', ')}`
            }
          };
        }
      }

      // Validate pagination parameters
      const paginationValidation = validatePaginationParams(pageSize, continuationToken);

      if (!paginationValidation.valid) {
        logger.warn('[Validation] Invalid pagination parameters', {
          error: paginationValidation.error
        });

        return {
          status: 400,
          jsonBody: {
            error: 'Validation Error',
            message: paginationValidation.error
          }
        };
      }

      // 3. Query statistics
      const result = await alertStatisticsService.queryStatistics(
        {
          type: filterValidation.sanitized?.type as any,
          startDate: filterValidation.sanitized?.startDate,
          endDate: filterValidation.sanitized?.endDate,
          periodType: periodType as any
        },
        {
          pageSize: paginationValidation.pageSize,
          continuationToken: paginationValidation.continuationToken
        }
      );

      logger.info('[HTTP] Statistics query completed successfully', {
        itemCount: result.items.length,
        hasMore: result.hasMore
      });

      // 4. Return results
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
