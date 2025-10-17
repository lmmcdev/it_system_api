import { HttpRequest } from '@azure/functions';
import { logger } from '../utils/logger';

/**
 * Rate limit configuration interface
 */
export interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Maximum requests allowed in the window
}

/**
 * Rate limit result interface
 */
export interface RateLimitResult {
  allowed: boolean;      // Whether the request is allowed
  retryAfter?: number;   // Seconds to wait before retrying (if blocked)
  remaining?: number;    // Remaining requests in current window
  resetTime?: number;    // Unix timestamp when the limit resets
}

/**
 * Internal rate limit store entry
 */
interface RateLimitEntry {
  requests: number[];    // Array of request timestamps
  resetTime: number;     // When the current window resets
}

/**
 * In-memory rate limit store
 * NOTE: For production with multiple Azure Function instances,
 * replace with Azure Redis Cache or Azure Table Storage
 */
const rateLimitStore: Map<string, RateLimitEntry> = new Map();

/**
 * Cleanup interval for expired entries (run every 5 minutes)
 */
let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Initialize cleanup interval
 */
function initializeCleanup(): void {
  if (!cleanupInterval) {
    cleanupInterval = setInterval(() => {
      const now = Date.now();
      let cleaned = 0;

      for (const [key, entry] of rateLimitStore.entries()) {
        if (entry.resetTime < now && entry.requests.length === 0) {
          rateLimitStore.delete(key);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        logger.info('[RateLimit] Cleanup completed', { entriesRemoved: cleaned });
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }
}

// Initialize cleanup on module load
initializeCleanup();

/**
 * Get client identifier from request
 * Priority: x-client-id > x-forwarded-for > x-real-ip > 'unknown'
 */
function getClientIdentifier(request: HttpRequest): string {
  const clientId =
    request.headers.get('x-client-id') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  return clientId;
}

/**
 * Check if a request should be rate limited
 *
 * @param request - HTTP request object
 * @param endpoint - Endpoint identifier for separate limits
 * @param config - Rate limit configuration
 * @returns Rate limit result indicating if request is allowed
 *
 * @example
 * const result = checkRateLimit(request, 'search', RATE_LIMITS.search);
 * if (!result.allowed) {
 *   return { status: 429, jsonBody: { error: 'Rate limit exceeded' } };
 * }
 */
export function checkRateLimit(
  request: HttpRequest,
  endpoint: string,
  config: RateLimitConfig
): RateLimitResult {
  const clientId = getClientIdentifier(request);
  const now = Date.now();
  const key = `${endpoint}:${clientId}`;

  // Get or initialize entry
  let entry = rateLimitStore.get(key);

  if (!entry || entry.resetTime < now) {
    // Initialize new window
    entry = {
      requests: [],
      resetTime: now + config.windowMs
    };
    rateLimitStore.set(key, entry);
  }

  // Remove requests outside the sliding window
  entry.requests = entry.requests.filter(
    timestamp => timestamp > now - config.windowMs
  );

  // Check if limit exceeded
  if (entry.requests.length >= config.maxRequests) {
    const oldestRequest = Math.min(...entry.requests);
    const retryAfter = Math.ceil((oldestRequest + config.windowMs - now) / 1000);

    logger.warn('[RateLimit] Request blocked - limit exceeded', {
      endpoint,
      clientId: clientId.substring(0, 10) + '***',
      requests: entry.requests.length,
      maxRequests: config.maxRequests,
      windowMs: config.windowMs,
      retryAfter,
      url: request.url,
      method: request.method
    });

    return {
      allowed: false,
      retryAfter,
      remaining: 0,
      resetTime: oldestRequest + config.windowMs
    };
  }

  // Record this request
  entry.requests.push(now);

  const remaining = config.maxRequests - entry.requests.length;

  logger.debug('[RateLimit] Request allowed', {
    endpoint,
    clientId: clientId.substring(0, 10) + '***',
    requests: entry.requests.length,
    remaining,
    maxRequests: config.maxRequests
  });

  return {
    allowed: true,
    remaining,
    resetTime: entry.resetTime
  };
}

/**
 * Create standardized 429 Too Many Requests response
 */
export function createRateLimitResponse(result: RateLimitResult) {
  return {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': (result.retryAfter || 60).toString(),
      'X-RateLimit-Limit': '0',
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': result.resetTime?.toString() || ''
    },
    jsonBody: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please retry after the specified time.',
        details: {
          retryAfter: result.retryAfter
        }
      },
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Preset rate limit configurations for different endpoint types
 *
 * Adjust these values based on your specific requirements and Azure service limits
 */
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Search operations (more expensive, lower limit)
  search: {
    windowMs: 60000,        // 1 minute
    maxRequests: 100        // 100 requests per minute
  },

  // Suggestions/autocomplete (frequent, higher limit)
  suggestions: {
    windowMs: 60000,        // 1 minute
    maxRequests: 200        // 200 requests per minute
  },

  // Get by ID (cheap operation, higher limit)
  getById: {
    windowMs: 60000,        // 1 minute
    maxRequests: 500        // 500 requests per minute
  },

  // Get all with filters (moderate cost)
  getAll: {
    windowMs: 60000,        // 1 minute
    maxRequests: 200        // 200 requests per minute
  },

  // Swagger documentation (low priority)
  swagger: {
    windowMs: 60000,        // 1 minute
    maxRequests: 20         // 20 requests per minute
  }
};

/**
 * Clear all rate limit data (useful for testing)
 * @internal
 */
export function clearRateLimitStore(): void {
  rateLimitStore.clear();
  logger.info('[RateLimit] Store cleared');
}

/**
 * Get current rate limit statistics
 * @internal
 */
export function getRateLimitStats(): { totalClients: number; totalRequests: number } {
  let totalRequests = 0;

  for (const entry of rateLimitStore.values()) {
    totalRequests += entry.requests.length;
  }

  return {
    totalClients: rateLimitStore.size,
    totalRequests
  };
}
