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
        'confirmedSafe',
        'remediated',
        'dismissed',
        'atRisk',
        'confirmedCompromised',
        'unknownFutureValue'
      ];

      if (!allowedRiskStates.includes(riskStateResult.value)) {
        errors.push(`riskState: Must be one of ${allowedRiskStates.join(', ')}`);
      } else {
        sanitized.riskState = riskStateResult.value;
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
