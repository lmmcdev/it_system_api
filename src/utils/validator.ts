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

  // Check if sanitization changed the value (contains XSS vectors or control chars)
  if (sanitized !== value.trim()) {
    return {
      isValid: false,
      error: 'Parameter contains invalid characters'
    };
  }

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

/**
 * Validates and sanitizes an array of filter values
 * Prevents excessive array lengths and validates individual values
 */
export function validateFilterArray(
  value: string | null | undefined,
  fieldName: string,
  allowedValues?: string[],
  maxItems: number = 10,
  maxLength: number = 50
): string[] | undefined {
  if (!value) {
    return undefined;
  }

  // Split by comma and trim
  const items = value.split(',').map(s => s.trim()).filter(s => s.length > 0);

  // Check array length
  if (items.length > maxItems) {
    throw new Error(
      `Filter "${fieldName}" can contain at most ${maxItems} values`
    );
  }

  // Validate each item
  const validatedItems: string[] = [];

  for (const item of items) {
    // Check individual value length
    if (item.length > maxLength) {
      throw new Error(
        `Filter value in "${fieldName}" exceeds maximum length of ${maxLength} characters`
      );
    }

    // Check for control characters
    if (/[\x00-\x1F\x7F]/.test(item)) {
      throw new Error(
        `Filter "${fieldName}" contains invalid control characters`
      );
    }

    // Remove XSS vectors
    const sanitized = item.replace(/[<>\"'`]/g, '');

    if (sanitized !== item) {
      throw new Error(
        `Filter "${fieldName}" contains invalid characters`
      );
    }

    // Validate against whitelist if provided
    if (allowedValues && !allowedValues.includes(sanitized)) {
      throw new Error(
        `Invalid value for "${fieldName}": ${sanitized}`
      );
    }

    validatedItems.push(sanitized);
  }

  return validatedItems.length > 0 ? validatedItems : undefined;
}

/**
 * Enhanced search text validation with Unicode normalization
 * Prevents injection attacks and validates content
 */
export function validateSearchText(
  searchText: string | null | undefined,
  minLength: number = 2,
  maxLength: number = 100
): string {
  if (!searchText || typeof searchText !== 'string') {
    throw new Error('Search text is required');
  }

  // Normalize Unicode to prevent normalization attacks
  const normalized = searchText.normalize('NFKC');

  // Check length after normalization
  if (normalized.length < minLength) {
    throw new Error(
      `Search text must be at least ${minLength} characters long`
    );
  }

  if (normalized.length > maxLength) {
    throw new Error(
      `Search text cannot exceed ${maxLength} characters`
    );
  }

  // Reject excessive special characters (potential injection)
  const alphanumericCount = (normalized.match(/[a-zA-Z0-9]/g) || []).length;
  const spaceCount = (normalized.match(/\s/g) || []).length;
  const totalAcceptable = alphanumericCount + spaceCount;

  if (totalAcceptable < normalized.length * 0.3) {
    throw new Error(
      'Search text must contain at least 30% alphanumeric characters'
    );
  }

  // Reject control characters
  if (/[\x00-\x1F\x7F]/.test(normalized)) {
    throw new Error(
      'Search text contains invalid control characters'
    );
  }

  return normalized;
}

/**
 * Validates array of field selections for search
 * Prevents excessive field selection and validates against whitelist
 */
export function validateFieldSelection(
  fields: string[] | undefined,
  allowedFields: string[],
  maxFields: number = 20
): string[] | undefined {
  if (!fields || fields.length === 0) {
    return undefined;
  }

  if (fields.length > maxFields) {
    throw new Error(
      `Cannot select more than ${maxFields} fields`
    );
  }

  const validatedFields: string[] = [];

  for (const field of fields) {
    const trimmed = field.trim();

    if (trimmed.length === 0) {
      continue;
    }

    if (trimmed.length > 50) {
      throw new Error(
        `Field name "${trimmed}" exceeds maximum length`
      );
    }

    if (!allowedFields.includes(trimmed)) {
      throw new Error(
        `Invalid field name: ${trimmed}`
      );
    }

    validatedFields.push(trimmed);
  }

  return validatedFields.length > 0 ? validatedFields : undefined;
}

/**
 * Validates filter object for risk detection events
 */
export function validateRiskFilters(filters: {
  riskLevel?: string | null;
  riskState?: string | null;
  userId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}): {
  valid: boolean;
  errors?: string[];
  sanitized?: {
    riskLevel?: string;
    riskState?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
  };
} {
  const errors: string[] = [];
  const sanitized: {
    riskLevel?: string;
    riskState?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
  } = {};

  // Validate riskLevel
  if (filters.riskLevel) {
    const riskLevelResult = sanitizeQueryParam(
      filters.riskLevel,
      30,
      /^[a-zA-Z]+$/
    );

    if (!riskLevelResult.isValid) {
      errors.push(`riskLevel: ${riskLevelResult.error}`);
    } else if (riskLevelResult.value) {
      const allowedRiskLevels = ['low', 'medium', 'high', 'hidden', 'none', 'unknownfuturevalue'];
      if (!allowedRiskLevels.includes(riskLevelResult.value.toLowerCase())) {
        errors.push(`riskLevel: Must be one of ${allowedRiskLevels.join(', ')}`);
      } else {
        sanitized.riskLevel = riskLevelResult.value.toLowerCase();
      }
    }
  }

  // Validate riskState
  if (filters.riskState) {
    const riskStateResult = sanitizeQueryParam(
      filters.riskState,
      30,
      /^[a-zA-Z]+$/
    );

    if (!riskStateResult.isValid) {
      errors.push(`riskState: ${riskStateResult.error}`);
    } else if (riskStateResult.value) {
      const allowedRiskStates = [
        'none',
        'confirmedsafe',
        'remediated',
        'dismissed',
        'atrisk',
        'confirmedcompromised',
        'unknownfuturevalue'
      ];

      // Normalize to lowercase for consistent comparison (same as riskLevel)
      if (!allowedRiskStates.includes(riskStateResult.value.toLowerCase())) {
        errors.push(`riskState: Must be one of ${allowedRiskStates.join(', ')}`);
      } else {
        sanitized.riskState = riskStateResult.value.toLowerCase();
      }
    }
  }

  // Validate userId
  if (filters.userId) {
    const userIdResult = sanitizeQueryParam(
      filters.userId,
      200,
      /^[a-zA-Z0-9\-_@.]+$/
    );

    if (!userIdResult.isValid) {
      errors.push(`userId: ${userIdResult.error}`);
    } else if (userIdResult.value) {
      sanitized.userId = userIdResult.value;
    }
  }

  // Validate startDate - accepts both YYYY-MM-DD and ISO 8601 formats
  if (filters.startDate) {
    // Try YYYY-MM-DD format first (user-friendly)
    const simpleDateResult = validateDateString(filters.startDate, { allowFuture: true });
    if (simpleDateResult.valid) {
      // Keep original format (YYYY-MM-DD)
      sanitized.startDate = filters.startDate;
    } else {
      // Fall back to ISO 8601 format for backward compatibility
      const isoDateResult = validateISODate(filters.startDate);
      if (isoDateResult.valid) {
        sanitized.startDate = filters.startDate;
      } else {
        errors.push(`startDate: Must be in YYYY-MM-DD format (e.g., 2025-10-21) or ISO 8601 format`);
      }
    }
  }

  // Validate endDate - accepts both YYYY-MM-DD and ISO 8601 formats
  if (filters.endDate) {
    // Try YYYY-MM-DD format first (user-friendly)
    const simpleDateResult = validateDateString(filters.endDate, { allowFuture: true });
    if (simpleDateResult.valid) {
      // Keep original format (YYYY-MM-DD)
      sanitized.endDate = filters.endDate;
    } else {
      // Fall back to ISO 8601 format for backward compatibility
      const isoDateResult = validateISODate(filters.endDate);
      if (isoDateResult.valid) {
        sanitized.endDate = filters.endDate;
      } else {
        errors.push(`endDate: Must be in YYYY-MM-DD format (e.g., 2025-10-21) or ISO 8601 format`);
      }
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

/**
 * Validates date string in YYYY-MM-DD format
 * Validates format, date validity, and ensures date is not in the future
 */
export function validateDateString(
  dateString: string | null | undefined,
  options: {
    allowFuture?: boolean;
    maxDaysBack?: number;
  } = {}
): {
  valid: boolean;
  date?: Date;
  error?: string;
} {
  if (!dateString || typeof dateString !== 'string') {
    return { valid: false, error: 'Date is required' };
  }

  // Validate YYYY-MM-DD format
  const dateFormatRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateFormatRegex.test(dateString)) {
    return {
      valid: false,
      error: 'Date must be in YYYY-MM-DD format (e.g., 2025-10-15)'
    };
  }

  // Parse date components
  const [year, month, day] = dateString.split('-').map(Number);

  // Validate date components
  if (year < 1900 || year > 2100) {
    return {
      valid: false,
      error: 'Year must be between 1900 and 2100'
    };
  }

  if (month < 1 || month > 12) {
    return {
      valid: false,
      error: 'Month must be between 01 and 12'
    };
  }

  if (day < 1 || day > 31) {
    return {
      valid: false,
      error: 'Day must be between 01 and 31'
    };
  }

  // Create date object and validate it's a real date
  // Parse as UTC to avoid timezone issues
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

  if (isNaN(date.getTime())) {
    return {
      valid: false,
      error: 'Invalid date value'
    };
  }

  // Verify the date components match (catches invalid dates like Feb 30)
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return {
      valid: false,
      error: 'Invalid date (e.g., February 30 does not exist)'
    };
  }

  // Check if date is in the future
  if (!options.allowFuture) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    if (date > today) {
      return {
        valid: false,
        error: 'Date cannot be in the future'
      };
    }
  }

  // Check max days back if specified
  if (options.maxDaysBack !== undefined && options.maxDaysBack > 0) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const minDate = new Date(today.getTime() - (options.maxDaysBack * 86400000));

    if (date < minDate) {
      return {
        valid: false,
        error: `Date cannot be more than ${options.maxDaysBack} days in the past`
      };
    }
  }

  return {
    valid: true,
    date
  };
}

/**
 * Validates statistics type parameter
 */
export function validateStatisticsType(type: string | null | undefined): ValidationResult {
  if (!type) {
    return { valid: false, error: 'Statistics type is required' };
  }

  const allowedTypes = ['detectionSource', 'userImpact', 'ipThreats', 'attackTypes'];

  if (!allowedTypes.includes(type)) {
    return {
      valid: false,
      error: `Invalid statistics type. Must be one of: ${allowedTypes.join(', ')}`
    };
  }

  return { valid: true };
}

/**
 * Validates topN parameter for statistics queries
 */
export function validateTopNParam(
  topN: string | null | undefined
): {
  valid: boolean;
  value?: number;
  error?: string;
} {
  // Default value
  if (!topN) {
    return {
      valid: true,
      value: 10
    };
  }

  const parsed = parseInt(topN, 10);

  if (isNaN(parsed)) {
    return {
      valid: false,
      error: 'topN must be a valid number'
    };
  }

  if (parsed < 1) {
    return {
      valid: false,
      error: 'topN must be at least 1'
    };
  }

  if (parsed > 100) {
    return {
      valid: false,
      error: 'topN cannot exceed 100'
    };
  }

  return {
    valid: true,
    value: parsed
  };
}

/**
 * Validates filter object for alert statistics queries
 * IMPORTANT: Statistics queries use YYYY-MM-DD format (not full ISO 8601 timestamps)
 * This matches the periodStartDate field format in the database
 */
export function validateStatisticsFilters(filters: {
  type?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  topN?: string | null;
}): {
  valid: boolean;
  errors?: string[];
  sanitized?: {
    type?: string;
    startDate?: string;
    endDate?: string;
    topN?: number;
  };
} {
  const errors: string[] = [];
  const sanitized: {
    type?: string;
    startDate?: string;
    endDate?: string;
    topN?: number;
  } = {};

  // Validate type
  if (filters.type) {
    const typeResult = validateStatisticsType(filters.type);
    if (!typeResult.valid) {
      errors.push(`type: ${typeResult.error}`);
    } else {
      sanitized.type = filters.type;
    }
  }

  // Validate startDate - accepts both YYYY-MM-DD and ISO 8601 formats
  // Normalizes to YYYY-MM-DD for database queries
  if (filters.startDate) {
    // Try YYYY-MM-DD format first (preferred for statistics)
    const simpleDateResult = validateDateString(filters.startDate, { allowFuture: true });
    if (simpleDateResult.valid) {
      // Extract YYYY-MM-DD format
      sanitized.startDate = filters.startDate.substring(0, 10);
    } else {
      // Fall back to ISO 8601 format for backward compatibility
      const isoDateResult = validateISODate(filters.startDate);
      if (isoDateResult.valid) {
        // Extract YYYY-MM-DD from ISO timestamp
        sanitized.startDate = filters.startDate.substring(0, 10);
      } else {
        errors.push(`startDate: Must be in YYYY-MM-DD format (e.g., 2025-10-21) or ISO 8601 format`);
      }
    }
  }

  // Validate endDate - accepts both YYYY-MM-DD and ISO 8601 formats
  // Normalizes to YYYY-MM-DD for database queries
  if (filters.endDate) {
    // Try YYYY-MM-DD format first (preferred for statistics)
    const simpleDateResult = validateDateString(filters.endDate, { allowFuture: true });
    if (simpleDateResult.valid) {
      // Extract YYYY-MM-DD format
      sanitized.endDate = filters.endDate.substring(0, 10);
    } else {
      // Fall back to ISO 8601 format for backward compatibility
      const isoDateResult = validateISODate(filters.endDate);
      if (isoDateResult.valid) {
        // Extract YYYY-MM-DD from ISO timestamp
        sanitized.endDate = filters.endDate.substring(0, 10);
      } else {
        errors.push(`endDate: Must be in YYYY-MM-DD format (e.g., 2025-10-21) or ISO 8601 format`);
      }
    }
  }

  // Validate date range logic
  if (sanitized.startDate && sanitized.endDate) {
    const start = new Date(sanitized.startDate + 'T00:00:00.000Z');
    const end = new Date(sanitized.endDate + 'T00:00:00.000Z');

    if (start > end) {
      errors.push('startDate must be before or equal to endDate');
    }
  }

  // Validate topN
  if (filters.topN !== null && filters.topN !== undefined) {
    const topNResult = validateTopNParam(filters.topN);
    if (!topNResult.valid) {
      errors.push(`topN: ${topNResult.error}`);
    } else {
      sanitized.topN = topNResult.value;
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    sanitized: Object.keys(sanitized).length > 0 ? sanitized : undefined
  };
}
