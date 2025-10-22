/**
 * Azure Function: Get Compliance Policy By ID
 * HTTP GET endpoint to retrieve a device compliance policy by its ID
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { deviceCompliancePolicyService } from '../services/DeviceCompliancePolicyService';
import { handleError, successResponse, ValidationError } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import { validateFunctionKey } from '../middleware/authentication';
import { validateId } from '../utils/validator';

async function getCompliancePolicyById(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    logger.setContext({
      functionName: context.functionName,
      invocationId: context.invocationId
    });

    logger.info('Processing get compliance policy by ID request');

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

    // Get policyId from route parameters
    const policyId = request.params.policyId;

    // Validate policyId
    const validationResult = validateId(policyId);
    if (!validationResult.valid) {
      throw new ValidationError(validationResult.error || 'Invalid policy ID');
    }

    logger.info('Request validation successful', { policyId });

    // Get compliance policy by ID
    const policy = await deviceCompliancePolicyService.getCompliancePolicyById(policyId!);

    logger.info('Compliance policy retrieved successfully', {
      policyId,
      displayName: policy.displayName,
      policyType: policy['@odata.type']
    });

    return successResponse(policy);
  } catch (error) {
    return handleError(error, context, request);
  } finally {
    logger.clearContext();
  }
}

app.http('getCompliancePolicyById', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'compliance-policies/{policyId}',
  handler: getCompliancePolicyById
});
