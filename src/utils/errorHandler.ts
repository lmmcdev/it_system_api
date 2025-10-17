/**
 * Error handling utilities
 * Provides custom error classes and error handling functions
 */

import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { ApiResponse } from '../models';
import { logger } from './logger';

/**
 * Custom error class for application errors
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Custom error class for validation errors
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, 'VALIDATION_ERROR', message, details);
    this.name = 'ValidationError';
  }
}

/**
 * Custom error class for not found errors
 */
export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(404, 'NOT_FOUND', `${resource} with ID '${id}' not found`);
    this.name = 'NotFoundError';
  }
}

/**
 * Custom error class for conflict errors
 */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, 'CONFLICT', message);
    this.name = 'ConflictError';
  }
}

/**
 * Custom error class for service errors
 */
export class ServiceError extends AppError {
  constructor(message: string, details?: unknown) {
    super(500, 'SERVICE_ERROR', message, details);
    this.name = 'ServiceError';
  }
}

/**
 * Sanitizes error details before sending to client
 * Removes sensitive information like stack traces, internal paths, etc.
 */
function sanitizeErrorDetails(details: unknown, isDevelopment: boolean): unknown {
  if (!isDevelopment) {
    // In production, never expose details
    return undefined;
  }

  // In development, sanitize sensitive patterns
  if (typeof details === 'string') {
    return details
      .replace(/COSMOS_KEY=[\w\-]+/gi, 'COSMOS_KEY=***')
      .replace(/key=[\w\-]+/gi, 'key=***')
      .replace(/password=[\w\-]+/gi, 'password=***')
      .replace(/Bearer [\w\-\.]+/gi, 'Bearer ***')
      .replace(/[A-Za-z]:\\[\w\\\-\.]+/g, '[PATH]') // Windows paths
      .replace(/\/[\w\/\-\.]+/g, (match) => {
        // Unix paths - only sanitize if looks like full path
        return match.startsWith('/home') || match.startsWith('/var') || match.startsWith('/usr')
          ? '[PATH]'
          : match;
      });
  }

  if (typeof details === 'object' && details !== null) {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(details)) {
      // Skip sensitive fields
      if (['key', 'password', 'secret', 'token', 'authorization'].some(s => key.toLowerCase().includes(s))) {
        sanitized[key] = '***';
      } else {
        sanitized[key] = sanitizeErrorDetails(value, isDevelopment);
      }
    }
    return sanitized;
  }

  return details;
}

/**
 * Sanitizes error message to remove sensitive information
 */
function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/COSMOS_KEY=[\w\-]+/gi, 'COSMOS_KEY=***')
    .replace(/key=[\w\-]+/gi, 'key=***')
    .replace(/password=[\w\-]+/gi, 'password=***')
    .replace(/Bearer [\w\-\.]+/gi, 'Bearer ***')
    .replace(/at [\w\\/\-\.:\s]+/g, 'at [INTERNAL]') // Stack trace locations
    .replace(/[A-Za-z]:\\[\w\\\-\.]+/g, '[PATH]'); // File paths
}

/**
 * Handles errors and returns appropriate HTTP response
 */
export function handleError(
  error: unknown,
  context: InvocationContext,
  request?: HttpRequest
): HttpResponseInit {
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Log the error with full details (server-side only)
  const errorContext = {
    functionName: context.functionName,
    invocationId: context.invocationId,
    url: request?.url,
    method: request?.method
  };

  if (error instanceof AppError) {
    logger.error(error.message, error, errorContext);

    const response: ApiResponse = {
      success: false,
      error: {
        code: error.code,
        message: sanitizeErrorMessage(error.message),
        details: sanitizeErrorDetails(error.details, isDevelopment)
      },
      timestamp: new Date().toISOString()
    };

    return {
      status: error.statusCode,
      jsonBody: response,
      headers: {
        'Content-Type': 'application/json'
      }
    };
  }

  // Handle standard errors
  if (error instanceof Error) {
    logger.error(error.message, error, errorContext);

    const response: ApiResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred'
        // Never expose error.message for unexpected errors - could contain sensitive info
      },
      timestamp: new Date().toISOString()
    };

    return {
      status: 500,
      jsonBody: response,
      headers: {
        'Content-Type': 'application/json'
      }
    };
  }

  // Handle unknown errors
  logger.error('Unknown error occurred', undefined, { error, ...errorContext });

  const response: ApiResponse = {
    success: false,
    error: {
      code: 'UNKNOWN_ERROR',
      message: 'An unknown error occurred'
    },
    timestamp: new Date().toISOString()
  };

  return {
    status: 500,
    jsonBody: response,
    headers: {
      'Content-Type': 'application/json'
    }
  };
}

/**
 * Creates a success response
 */
export function successResponse<T>(data: T, statusCode: number = 200): HttpResponseInit {
  const response: ApiResponse<T> = {
    success: true,
    data,
    timestamp: new Date().toISOString()
  };

  return {
    status: statusCode,
    jsonBody: response,
    headers: {
      'Content-Type': 'application/json'
    }
  };
}
