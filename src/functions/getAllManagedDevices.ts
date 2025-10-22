/**
 * Azure Function: Get All Managed Devices
 * HTTP GET endpoint to retrieve all managed devices with optional filtering and pagination
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { managedDeviceService } from '../services/ManagedDeviceService';
import { handleError, successResponse, ValidationError } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import { validateFunctionKey } from '../middleware/authentication';
import { validateManagedDeviceFilters } from '../utils/validator';

async function getAllManagedDevices(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    logger.setContext({
      functionName: context.functionName,
      invocationId: context.invocationId
    });

    logger.info('Processing get all managed devices request');

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

    // Parse pagination parameters
    const pageSize = request.query.get('pageSize');
    const nextLink = request.query.get('nextLink');

    // Validate page size
    let validatedPageSize = 100; // Default
    if (pageSize) {
      const parsed = parseInt(pageSize, 10);
      if (isNaN(parsed) || parsed < 1 || parsed > 999) {
        throw new ValidationError('pageSize must be between 1 and 999');
      }
      validatedPageSize = parsed;
    }

    // Parse filter parameters
    const filters = {
      complianceState: request.query.get('complianceState'),
      operatingSystem: request.query.get('operatingSystem'),
      deviceType: request.query.get('deviceType'),
      managementState: request.query.get('managementState'),
      userId: request.query.get('userId')
    };

    // Validate filters
    const filterValidation = validateManagedDeviceFilters(filters);
    if (!filterValidation.valid) {
      const errorMessage = filterValidation.errors?.join(', ') || 'Invalid filter parameters';
      throw new ValidationError(errorMessage);
    }

    logger.info('Request validation successful', {
      filters: filterValidation.sanitized,
      pageSize: validatedPageSize,
      hasNextLink: !!nextLink
    });

    // Get managed devices with pagination
    const result = await managedDeviceService.getAllManagedDevices(
      filterValidation.sanitized,
      {
        pageSize: validatedPageSize,
        nextLink: nextLink || undefined
      }
    );

    logger.info('Managed devices retrieved successfully', {
      count: result.count,
      hasMore: result.hasMore
    });

    return successResponse({
      items: result.items,
      pagination: {
        count: result.count,
        hasMore: result.hasMore,
        nextLink: result.nextLink
      }
    });
  } catch (error) {
    return handleError(error, context, request);
  } finally {
    logger.clearContext();
  }
}

app.http('getAllManagedDevices', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'managed-devices',
  handler: getAllManagedDevices
});
