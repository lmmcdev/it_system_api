/**
 * Validation utilities for input data
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface SanitizationResult {
  value?: string;
  isValid: boolean;
  error?: string;
}

/**
 * Validates ID parameter (UUID format)
 */
export function validateId(id: string | undefined): ValidationResult {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    return { valid: false, error: 'ID is required and must be a non-empty string' };
  }

  // Validate UUID format (v4)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(id.trim())) {
    return {
      valid: false,
      error: 'ID must be a valid UUID format (e.g., 123e4567-e89b-12d3-a456-426614174000)'
    };
  }

  return { valid: true };
}

/**
 * Validates ISO 8601 date string
 */
export function validateISODate(dateString: string): ValidationResult {
  if (!dateString || typeof dateString !== 'string') {
    return { valid: false, error: 'Date string is required' };
  }

  // Check for ISO 8601 format
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,7})?Z?$/;

  if (!isoDateRegex.test(dateString)) {
    return {
      valid: false,
      error: 'Date must be in ISO 8601 format (e.g., 2025-10-16T12:00:00Z)'
    };
  }

  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return { valid: false, error: 'Invalid date value' };
  }

  return { valid: true };
}

/**
 * Validates query parameter value against allowed values
 */
export function validateQueryParam(
  value: string | null | undefined,
  allowedValues: string[]
): ValidationResult {
  if (!value) {
    return { valid: true }; // Optional parameter
  }

  if (!allowedValues.includes(value)) {
    return {
      valid: false,
      error: `Invalid value. Must be one of: ${allowedValues.join(', ')}`
    };
  }

  return { valid: true };
}

/**
 * Sanitizes query parameter with length and pattern validation
 */
export function sanitizeQueryParam(
  value: string | null | undefined,
  maxLength: number = 100,
  allowedPattern?: RegExp
): SanitizationResult {
  if (!value) {
    return { isValid: true, value: undefined };
  }

  // Check length
  if (value.length > maxLength) {
    return {
      isValid: false,
      error: `Parameter exceeds maximum length of ${maxLength} characters`
    };
  }

  // Remove potentially dangerous characters
  const sanitized = value
    .trim()
    .replace(/[<>\"'`]/g, '') // Remove XSS vectors
    .replace(/[\x00-\x1F\x7F]/g, ''); // Remove control characters

  // Check if sanitization removed too much
  if (sanitized.length === 0 && value.length > 0) {
    return {
      isValid: false,
      error: 'Parameter contains only invalid characters'
    };
  }

  // Validate against pattern if provided
  if (allowedPattern && sanitized.length > 0 && !allowedPattern.test(sanitized)) {
    return {
      isValid: false,
      error: 'Parameter contains invalid characters or format'
    };
  }

  return { isValid: true, value: sanitized || undefined };
}

/**
 * Validates pagination parameters
 */
export function validatePaginationParams(
  pageSize: string | null | undefined,
  continuationToken: string | null | undefined
): {
  valid: boolean;
  pageSize?: number;
  continuationToken?: string;
  error?: string;
} {
  let validatedPageSize = 50; // Default page size

  if (pageSize) {
    const parsed = parseInt(pageSize, 10);

    if (isNaN(parsed)) {
      return {
        valid: false,
        error: 'pageSize must be a valid number'
      };
    }

    if (parsed < 1) {
      return {
        valid: false,
        error: 'pageSize must be at least 1'
      };
    }

    if (parsed > 100) {
      return {
        valid: false,
        error: 'pageSize cannot exceed 100'
      };
    }

    validatedPageSize = parsed;
  }

  // Validate continuation token if provided
  let validatedToken: string | undefined;

  if (continuationToken) {
    // Continuation tokens should be base64 encoded strings from CosmosDB
    // Basic validation - check it's not suspiciously long or contains invalid chars
    if (continuationToken.length > 10000) {
      return {
        valid: false,
        error: 'continuationToken is too long'
      };
    }

    // Remove any potential injection attempts
    const sanitized = continuationToken.replace(/[<>\"'`]/g, '');

    if (sanitized !== continuationToken) {
      return {
        valid: false,
        error: 'continuationToken contains invalid characters'
      };
    }

    validatedToken = continuationToken;
  }

  return {
    valid: true,
    pageSize: validatedPageSize,
    continuationToken: validatedToken
  };
}

/**
 * Validates filter object for alert events
 */
export function validateAlertFilters(filters: {
  severity?: string | null;
  status?: string | null;
  category?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}): {
  valid: boolean;
  errors?: string[];
  sanitized?: {
    severity?: string;
    status?: string;
    category?: string;
    startDate?: string;
    endDate?: string;
  };
} {
  const errors: string[] = [];
  const sanitized: {
    severity?: string;
    status?: string;
    category?: string;
    startDate?: string;
    endDate?: string;
  } = {};

  // Validate severity
  if (filters.severity) {
    const severityResult = sanitizeQueryParam(
      filters.severity,
      20,
      /^[a-z]+$/i
    );

    if (!severityResult.isValid) {
      errors.push(`severity: ${severityResult.error}`);
    } else if (severityResult.value) {
      const allowedSeverities = ['informational', 'low', 'medium', 'high', 'critical'];
      if (!allowedSeverities.includes(severityResult.value.toLowerCase())) {
        errors.push(`severity: Must be one of ${allowedSeverities.join(', ')}`);
      } else {
        sanitized.severity = severityResult.value.toLowerCase();
      }
    }
  }

  // Validate status
  if (filters.status) {
    const statusResult = sanitizeQueryParam(
      filters.status,
      20,
      /^[a-zA-Z]+$/
    );

    if (!statusResult.isValid) {
      errors.push(`status: ${statusResult.error}`);
    } else if (statusResult.value) {
      const allowedStatuses = ['new', 'inProgress', 'resolved'];
      if (!allowedStatuses.includes(statusResult.value)) {
        errors.push(`status: Must be one of ${allowedStatuses.join(', ')}`);
      } else {
        sanitized.status = statusResult.value;
      }
    }
  }

  // Validate category
  if (filters.category) {
    const categoryResult = sanitizeQueryParam(
      filters.category,
      50,
      /^[a-zA-Z]+$/
    );

    if (!categoryResult.isValid) {
      errors.push(`category: ${categoryResult.error}`);
    } else if (categoryResult.value) {
      const allowedCategories = [
        'InitialAccess',
        'Execution',
        'Persistence',
        'PrivilegeEscalation',
        'DefenseEvasion',
        'CredentialAccess',
        'Discovery',
        'LateralMovement',
        'Collection',
        'Exfiltration',
        'CommandAndControl',
        'Impact'
      ];

      if (!allowedCategories.includes(categoryResult.value)) {
        errors.push(`category: Must be one of ${allowedCategories.join(', ')}`);
      } else {
        sanitized.category = categoryResult.value;
      }
    }
  }

  // Validate startDate
  if (filters.startDate) {
    const dateResult = validateISODate(filters.startDate);
    if (!dateResult.valid) {
      errors.push(`startDate: ${dateResult.error}`);
    } else {
      sanitized.startDate = filters.startDate;
    }
  }

  // Validate endDate
  if (filters.endDate) {
    const dateResult = validateISODate(filters.endDate);
    if (!dateResult.valid) {
      errors.push(`endDate: ${dateResult.error}`);
    } else {
      sanitized.endDate = filters.endDate;
    }
  }

  // Validate date range logic
  if (sanitized.startDate && sanitized.endDate) {
    const start = new Date(sanitized.startDate);
    const end = new Date(sanitized.endDate);

    if (start > end) {
      errors.push('startDate must be before or equal to endDate');
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    sanitized: Object.keys(sanitized).length > 0 ? sanitized : undefined
  };
}
