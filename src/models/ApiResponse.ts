/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  timestamp: string;
}

/**
 * API error details
 */
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Validation error details
 */
export interface ValidationError {
  field: string;
  message: string;
}
