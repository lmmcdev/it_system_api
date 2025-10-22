/**
 * Microsoft Graph API repository for Managed Device data access (read-only)
 * Handles all Graph API calls with proper error handling, pagination, and query tracing
 *
 * Security Features:
 * - Parameterized OData filters
 * - Input validation
 * - 429 throttling with retry-after
 * - Request timeouts (30s)
 * - Never logs access tokens
 */

import { ManagedDevice, ManagedDeviceListResponse } from '../models/ManagedDevice';
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
  filter?: string;
  select?: string[];
  requestTime: number;
  itemCount: number;
  hasNextLink: boolean;
}

export class ManagedDeviceRepository {
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
   * Build OData filter string safely (prevents injection)
   * Multiple values for same field use OR, different fields use AND
   */
  private buildFilterString(filters: Record<string, string | string[]>): string {
    const filterParts: string[] = [];

    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined || value === null) {
        continue;
      }

      if (Array.isArray(value)) {
        if (value.length === 0) continue;

        // Multiple values for same field: OR logic
        const orConditions = value.map(v => {
          const escaped = this.escapeODataString(v);
          return `${key} eq '${escaped}'`;
        });

        filterParts.push(`(${orConditions.join(' or ')})`);
      } else {
        // Single value
        const escaped = this.escapeODataString(value);
        filterParts.push(`${key} eq '${escaped}'`);
      }
    }

    // Join multiple fields with AND
    return filterParts.join(' and ');
  }

  /**
   * Escape single quotes in OData filter values
   */
  private escapeODataString(value: string): string {
    return value.replace(/'/g, "''");
  }

  /**
   * Log Graph API query trace
   */
  private logQueryTrace(trace: QueryTrace): void {
    logger.info('[Graph API Query Trace]', {
      url: trace.url,
      filter: trace.filter,
      select: trace.select,
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
          throw new NotFoundError('Managed Device', 'requested');
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
   * Get managed device by ID
   */
  async getById(id: string): Promise<ManagedDevice> {
    const startTime = Date.now();

    try {
      logger.info('[Graph API] Fetching managed device by ID', { id });

      const url = `${this.GRAPH_API_BASE}/deviceManagement/managedDevices/${id}`;
      const device = await this.makeGraphRequest<ManagedDevice>(url);

      const executionTime = Date.now() - startTime;

      logger.info('[Graph API] Managed device fetched successfully', {
        id,
        deviceName: device.deviceName,
        executionTime: `${executionTime}ms`
      });

      return device;

    } catch (error) {
      const executionTime = Date.now() - startTime;

      if (error instanceof NotFoundError) {
        throw error;
      }

      logger.error('[Graph API] Failed to fetch managed device', error as Error, {
        id,
        executionTime: `${executionTime}ms`
      });

      throw error;
    }
  }

  /**
   * Get all managed devices with optional filtering and pagination
   */
  async getAll(
    filter?: {
      complianceState?: string | string[];
      operatingSystem?: string | string[];
      deviceType?: string | string[];
      managementState?: string | string[];
      userId?: string;
    },
    options?: {
      pageSize?: number;
      nextLink?: string;
      select?: string[];
    }
  ): Promise<PaginatedResponse<ManagedDevice>> {
    const startTime = Date.now();

    try {
      logger.info('[Graph API] Fetching managed devices', { filter, options });

      let url: string;

      if (options?.nextLink) {
        // Use nextLink for pagination
        url = options.nextLink;
      } else {
        // Build initial request URL
        url = `${this.GRAPH_API_BASE}/deviceManagement/managedDevices`;

        const queryParams: string[] = [];

        // Add $filter if provided
        if (filter) {
          const filterObj: Record<string, string | string[]> = {};

          if (filter.complianceState) {
            filterObj['complianceState'] = filter.complianceState;
          }
          if (filter.operatingSystem) {
            filterObj['operatingSystem'] = filter.operatingSystem;
          }
          if (filter.deviceType) {
            filterObj['deviceType'] = filter.deviceType;
          }
          if (filter.managementState) {
            filterObj['managementState'] = filter.managementState;
          }
          if (filter.userId) {
            filterObj['userId'] = filter.userId;
          }

          const filterString = this.buildFilterString(filterObj);
          if (filterString) {
            queryParams.push(`$filter=${encodeURIComponent(filterString)}`);
          }
        }

        // Add $top for page size
        const pageSize = Math.min(options?.pageSize || 100, this.MAX_PAGE_SIZE);
        queryParams.push(`$top=${pageSize}`);

        // Add $select if provided
        if (options?.select && options.select.length > 0) {
          queryParams.push(`$select=${options.select.join(',')}`);
        }

        if (queryParams.length > 0) {
          url += '?' + queryParams.join('&');
        }
      }

      // Make request
      const response = await this.makeGraphRequest<ManagedDeviceListResponse>(url);

      const executionTime = Date.now() - startTime;

      // Log query trace
      this.logQueryTrace({
        url,
        filter: filter ? JSON.stringify(filter) : undefined,
        select: options?.select,
        requestTime: executionTime,
        itemCount: response.value.length,
        hasNextLink: !!response['@odata.nextLink']
      });

      logger.info('[Graph API] Managed devices fetched successfully', {
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

      logger.error('[Graph API] Failed to fetch managed devices', error as Error, {
        filter,
        executionTime: `${executionTime}ms`
      });

      throw error;
    }
  }

  /**
   * Get managed devices by user ID
   */
  async getByUserId(userId: string, options?: { pageSize?: number; nextLink?: string }): Promise<PaginatedResponse<ManagedDevice>> {
    return this.getAll({ userId }, options);
  }

  /**
   * Get managed devices by compliance state
   */
  async getByComplianceState(
    complianceState: string | string[],
    options?: { pageSize?: number; nextLink?: string }
  ): Promise<PaginatedResponse<ManagedDevice>> {
    return this.getAll({ complianceState }, options);
  }

  /**
   * Get non-compliant devices
   */
  async getNonCompliantDevices(options?: { pageSize?: number; nextLink?: string }): Promise<PaginatedResponse<ManagedDevice>> {
    return this.getAll({ complianceState: 'noncompliant' }, options);
  }

  /**
   * Get managed devices by operating system
   */
  async getByOperatingSystem(
    operatingSystem: string | string[],
    options?: { pageSize?: number; nextLink?: string }
  ): Promise<PaginatedResponse<ManagedDevice>> {
    return this.getAll({ operatingSystem }, options);
  }

  /**
   * Get managed devices by device type
   */
  async getByDeviceType(
    deviceType: string | string[],
    options?: { pageSize?: number; nextLink?: string }
  ): Promise<PaginatedResponse<ManagedDevice>> {
    return this.getAll({ deviceType }, options);
  }

  /**
   * Check if managed device exists
   */
  async exists(id: string): Promise<boolean> {
    try {
      await this.getById(id);
      return true;
    } catch (error) {
      if (error instanceof NotFoundError) {
        return false;
      }
      throw error;
    }
  }
}

// Export singleton instance
export const managedDeviceRepository = new ManagedDeviceRepository();
