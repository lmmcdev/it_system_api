/**
 * HTTP GET endpoint to query alert statistics with filters
 * GET /api/statistics
 *
 * Query parameters:
 * - date: Specific date (YYYY-MM-DD) - returns all 4 statistics types for that day
 * - type: Statistics type (detectionSource, userImpact, ipThreats, attackTypes)
 * - startDate: Start date filter (ISO 8601)
 * - endDate: End date filter (ISO 8601)
 * - periodType: Period type (hourly, daily, weekly, monthly, custom)
 * - pageSize: Number of results per page (max 100)
 * - continuationToken: Pagination token
 *
 * Note: If 'date' parameter is provided, it overrides startDate/endDate and returns all 4 types
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { alertStatisticsService } from '../services/AlertStatisticsService';
import { validateFunctionKey } from '../middleware/authentication';
import { handleError, successResponse } from '../utils/errorHandler';
import { validatePaginationParams, validateStatisticsFilters, validateDateString } from '../utils/validator';
import { logger } from '../utils/logger';
import { StatisticsType } from '../models/AlertStatistics';

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
      const dateParam = request.query.get('date');
      let type = request.query.get('type') || undefined;
      let startDate = request.query.get('startDate') || undefined;
      let endDate = request.query.get('endDate') || undefined;
      const periodType = request.query.get('periodType') || undefined;
      const pageSize = request.query.get('pageSize');
      const continuationToken = request.query.get('continuationToken');

      // If 'date' parameter provided, it overrides startDate/endDate and type
      let getAllTypes = false;
      if (dateParam) {
        const validationResult = validateDateString(dateParam, { allowFuture: true });

        if (!validationResult.valid || !validationResult.date) {
          logger.warn('[Validation] Invalid date parameter', {
            date: dateParam,
            error: validationResult.error
          });

          return {
            status: 400,
            jsonBody: {
              error: 'Validation Error',
              message: validationResult.error || 'Invalid date parameter'
            }
          };
        }

        // Convert date to full day range (00:00:00 to 23:59:59.999 UTC)
        const validatedDate = validationResult.date;
        const dayStart = new Date(Date.UTC(
          validatedDate.getUTCFullYear(),
          validatedDate.getUTCMonth(),
          validatedDate.getUTCDate(),
          0, 0, 0, 0
        ));
        const dayEnd = new Date(dayStart.getTime() + 86400000 - 1);

        startDate = dayStart.toISOString();
        endDate = dayEnd.toISOString();

        // When using 'date' parameter, fetch all 4 types
        getAllTypes = true;
        type = undefined; // Ignore type parameter

        logger.info('[HTTP] Using date parameter - will fetch all statistics types', {
          date: dateParam,
          startDate,
          endDate
        });
      }

      // Validate filters (only if not using 'date' shortcut)
      if (!getAllTypes) {
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
      let result;

      if (getAllTypes) {
        // Fetch all 4 statistics types for the specified date
        const types: StatisticsType[] = [
          StatisticsType.DetectionSource,
          StatisticsType.UserImpact,
          StatisticsType.IpThreats,
          StatisticsType.AttackTypes
        ];

        const allStatistics = [];

        for (const statType of types) {
          const typeResult = await alertStatisticsService.queryStatistics(
            {
              type: statType,
              startDate,
              endDate,
              periodType: periodType as any
            },
            {
              pageSize: 1, // Only expect 1 document per type per day
              continuationToken: undefined
            }
          );

          // Add all items from this type
          allStatistics.push(...typeResult.items);
        }

        logger.info('[HTTP] All statistics types queried successfully for date', {
          date: dateParam,
          totalStatistics: allStatistics.length
        });

        // Return combined result
        result = {
          items: allStatistics,
          count: allStatistics.length,
          hasMore: false,
          continuationToken: undefined
        };
      } else {
        // Single type or filtered query (original behavior)
        result = await alertStatisticsService.queryStatistics(
          {
            type: type as any,
            startDate,
            endDate,
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
      }

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
