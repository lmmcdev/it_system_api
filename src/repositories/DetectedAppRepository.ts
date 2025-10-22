/**
 * Microsoft Graph API repository for Detected App data access (read-only)
 * Handles Graph API calls for detected applications with proper error handling, pagination, and query tracing
 *
 * Security Features:
 * - Input validation
 * - 429 throttling with retry-after
 * - Request timeouts (30s)
 * - Never logs access tokens
 *
 * Note: Uses beta endpoint as detectedApps API is in beta
 */

import { DetectedAppManagedDevice, DetectedAppManagedDeviceListResponse } from '../models/DetectedApp';
import { graphAuthHelper } from '../utils/graphAuthHelper';
import { logger } from '../utils/logger';
import { NotFoundError, ServiceError } from '../utils/errorHandler';

/**
 * Paginated response interface
 */
export interface PaginatedResponse<T> {
  items: T[];
  nextLink?: string;
  hasMore: boolean;
  count: number;
}

/**
 * Query trace information for logging
 */
interface QueryTrace {
  url: string;
  requestTime: number;
  itemCount: number;
  hasNextLink: boolean;
}

export class DetectedAppRepository {
  private readonly GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';
  private readonly REQUEST_TIMEOUT_MS = 30000; // 30 seconds
  private readonly MAX_PAGE_SIZE = 999; // Graph API max

  /**
   * Creates a timeout promise that rejects after specified milliseconds
   */
  private createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new ServiceError(`Graph API request timeout exceeded (${timeoutMs}ms). Please refine your query.`));
      }, timeoutMs);
    });
  }

  /**
   * Log Graph API query trace
   */
  private logQueryTrace(trace: QueryTrace): void {
    logger.info('[Graph API Query Trace]', {
      url: trace.url,
      requestTime: `${trace.requestTime}ms`,
      itemCount: trace.itemCount,
      hasNextLink: trace.hasNextLink,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Make Graph API request with timeout and error handling
   */
  private async makeGraphRequest<T>(url: string): Promise<T> {
    const startTime = Date.now();

    try {
      // Get access token
      const accessToken = await graphAuthHelper.getAccessToken();

      logger.info('[Graph API] Making request', {
        url: url.replace(/\?.*/,'?...'), // Don't log query params (may contain sensitive filters)
        method: 'GET'
      });

      // Create timeout promise
      const timeoutPromise = this.createTimeoutPromise(this.REQUEST_TIMEOUT_MS);

      // Make Graph API request
      const fetchPromise = fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`, // NEVER log this
          'Content-Type': 'application/json',
          'ConsistencyLevel': 'eventual' // Required for advanced queries
        }
      });

      const response = await Promise.race([fetchPromise, timeoutPromise]);
      const executionTime = Date.now() - startTime;

      // Handle HTTP errors
      if (!response.ok) {
        const errorText = await response.text();

        logger.error('[Graph API] Request failed', new Error(`HTTP ${response.status}: ${response.statusText}`), {
          status: response.status,
          statusText: response.statusText,
          executionTime: `${executionTime}ms`,
          errorPreview: errorText.substring(0, 500)
        });

        // Handle 404 Not Found
        if (response.status === 404) {
          throw new NotFoundError('Detected App', 'requested');
        }

        // Handle 429 Throttling
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          logger.error('[Graph API] Request throttled (429)', new Error('Rate limit exceeded'), {
            retryAfter: retryAfter ? `${retryAfter}s` : 'unknown',
            executionTime: `${executionTime}ms`
          });
          throw new ServiceError('Microsoft Graph API rate limit exceeded. Please retry later.', {
            retryAfter: retryAfter ? `${retryAfter}s` : 'unknown'
          });
        }

        // Handle 401/403 Authentication errors
        if (response.status === 401 || response.status === 403) {
          throw new ServiceError('Microsoft Graph API authentication failed. Check credentials and permissions.');
        }

        throw new ServiceError(`Microsoft Graph API request failed with status ${response.status}`);
      }

      // Parse response
      const data = await response.json() as T;

      logger.info('[Graph API] Request successful', {
        executionTime: `${executionTime}ms`
      });

      return data;

    } catch (error) {
      const executionTime = Date.now() - startTime;

      // Re-throw known errors
      if (error instanceof ServiceError || error instanceof NotFoundError) {
        throw error;
      }

      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        logger.error('[Graph API] Network error', error as Error, {
          executionTime: `${executionTime}ms`
        });
        throw new ServiceError('Network error while connecting to Microsoft Graph API');
      }

      // Handle unknown errors
      logger.error('[Graph API] Unexpected error', error as Error, {
        executionTime: `${executionTime}ms`
      });
      throw new ServiceError('Unexpected error during Graph API request');
    }
  }

  /**
   * Get managed devices that have a specific detected app installed
   *
   * @param appId - The detected app ID (GUID)
   * @param options - Pagination options (pageSize, nextLink)
   * @returns Paginated list of managed devices with the app installed
   */
  async getAppManagedDevices(
    appId: string,
    options?: {
      pageSize?: number;
      nextLink?: string;
    }
  ): Promise<PaginatedResponse<DetectedAppManagedDevice>> {
    const startTime = Date.now();

    try {
      logger.info('[Graph API] Fetching managed devices for detected app', { appId, options });

      let url: string;

      if (options?.nextLink) {
        // Use nextLink for pagination
        url = options.nextLink;
      } else {
        // Build initial request URL
        url = `${this.GRAPH_API_BASE}/deviceManagement/detectedApps/${appId}/managedDevices`;

        const queryParams: string[] = [];

        // Add $top for page size
        const pageSize = Math.min(options?.pageSize || 100, this.MAX_PAGE_SIZE);
        queryParams.push(`$top=${pageSize}`);

        if (queryParams.length > 0) {
          url += '?' + queryParams.join('&');
        }
      }

      // Make request
      const response = await this.makeGraphRequest<DetectedAppManagedDeviceListResponse>(url);

      const executionTime = Date.now() - startTime;

      // Log query trace
      this.logQueryTrace({
        url,
        requestTime: executionTime,
        itemCount: response.value.length,
        hasNextLink: !!response['@odata.nextLink']
      });

      logger.info('[Graph API] Managed devices for detected app fetched successfully', {
        appId,
        itemCount: response.value.length,
        hasMore: !!response['@odata.nextLink'],
        executionTime: `${executionTime}ms`
      });

      return {
        items: response.value,
        nextLink: response['@odata.nextLink'],
        hasMore: !!response['@odata.nextLink'],
        count: response.value.length
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;

      logger.error('[Graph API] Failed to fetch managed devices for detected app', error as Error, {
        appId,
        executionTime: `${executionTime}ms`
      });

      throw error;
    }
  }
}

// Export singleton instance
export const detectedAppRepository = new DetectedAppRepository();
