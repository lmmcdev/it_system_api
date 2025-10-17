/**
 * Authentication middleware
 * Validates function keys and provides basic authentication
 */

import { HttpRequest } from '@azure/functions';
import { logger } from '../utils/logger';

export interface AuthResult {
  authenticated: boolean;
  userId?: string;
  error?: string;
}

/**
 * Validates function key from request headers or query parameters
 */
export function validateFunctionKey(request: HttpRequest): AuthResult {
  // Check for function key in headers
  const headerKey = request.headers.get('x-functions-key');

  // Check for function key in query parameters
  const queryKey = request.query.get('code');

  const providedKey = headerKey || queryKey;

  if (!providedKey) {
    logger.warn('Authentication failed: No function key provided', {
      url: request.url,
      method: request.method
    });
    return {
      authenticated: false,
      error: 'Authentication required. Provide function key via x-functions-key header or code query parameter.'
    };
  }

  // In Azure Functions, the runtime validates the function key
  // This is a secondary check for logging and monitoring
  const expectedKey = process.env.FUNCTION_KEY;

  if (expectedKey && providedKey !== expectedKey) {
    logger.warn('Authentication failed: Invalid function key', {
      url: request.url,
      method: request.method,
      providedKeyPrefix: providedKey.substring(0, 8) + '***'
    });
    return {
      authenticated: false,
      error: 'Invalid authentication credentials.'
    };
  }

  // Extract user identifier from key or IP for logging
  const userId = request.headers.get('x-ms-client-principal-id') ||
                 request.headers.get('x-forwarded-for') ||
                 'anonymous';

  logger.info('Authentication successful', {
    userId: userId.substring(0, 8) + '***',
    url: request.url,
    method: request.method
  });

  return {
    authenticated: true,
    userId
  };
}

/**
 * Validates API key for additional security layer
 */
export function validateApiKey(request: HttpRequest): AuthResult {
  const apiKey = request.headers.get('x-api-key');

  if (!apiKey) {
    return {
      authenticated: false,
      error: 'API key required in x-api-key header.'
    };
  }

  const validApiKey = process.env.API_KEY;

  if (!validApiKey) {
    logger.error('API_KEY environment variable not configured');
    return {
      authenticated: false,
      error: 'Authentication system misconfigured.'
    };
  }

  if (apiKey !== validApiKey) {
    logger.warn('Invalid API key provided', {
      providedKeyPrefix: apiKey.substring(0, 8) + '***'
    });
    return {
      authenticated: false,
      error: 'Invalid API key.'
    };
  }

  return {
    authenticated: true,
    userId: 'api-key-user'
  };
}

/**
 * Check if request is from localhost (development)
 */
export function isLocalRequest(request: HttpRequest): boolean {
  const host = request.headers.get('host') || '';
  return host.includes('localhost') || host.includes('127.0.0.1');
}
