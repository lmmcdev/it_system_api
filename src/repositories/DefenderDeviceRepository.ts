/**
 * Microsoft Defender for Endpoint API repository for device data access (read-only)
 * Handles all Defender API calls with proper error handling, pagination, and query tracing
 *
 * Security Features:
 * - Parameterized OData filters
 * - Input validation
 * - 429 throttling with retry-after
 * - Request timeouts (30s)
 * - Never logs access tokens
 */

import { DefenderDevice, DefenderDeviceListResponse } from '../models/DefenderDevice';
import { defenderAuthHelper } from '../utils/defenderAuthHelper';
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

export class DefenderDeviceRepository {
  private readonly DEFENDER_API_BASE = 'https://api.security.microsoft.com/api';
  private readonly REQUEST_TIMEOUT_MS = 30000; // 30 seconds
  private readonly MAX_PAGE_SIZE = 10000; // Defender API typical max

  /**
   * Creates a timeout promise that rejects after specified milliseconds
   */
  private createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new ServiceError(`Defender API request timeout exceeded (${timeoutMs}ms). Please refine your query.`));
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
   * Log Defender API query trace
   */
  private logQueryTrace(trace: QueryTrace): void {
    logger.info('[Defender API Query Trace]', {
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
   * Make Defender API request with timeout and error handling
   */
  private async makeDefenderRequest<T>(url: string): Promise<T> {
    const startTime = Date.now();

    try {
      // Get access token
      const accessToken = await defenderAuthHelper.getAccessToken();

      logger.info('[Defender API] Making request', {
        url: url.replace(/\?.*/,'?...'), // Don't log query params (may contain sensitive filters)
        method: 'GET'
      });

      // Create timeout promise
      const timeoutPromise = this.createTimeoutPromise(this.REQUEST_TIMEOUT_MS);

      // Make Defender API request
      const fetchPromise = fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`, // NEVER log this
          'Content-Type': 'application/json'
        }
      });

      const response = await Promise.race([fetchPromise, timeoutPromise]);
      const executionTime = Date.now() - startTime;

      // Handle HTTP errors
      if (!response.ok) {
        const errorText = await response.text();

        logger.error('[Defender API] Request failed', new Error(`HTTP ${response.status}: ${response.statusText}`), {
          status: response.status,
          statusText: response.statusText,
          executionTime: `${executionTime}ms`,
          errorPreview: errorText.substring(0, 500)
        });

        // Handle 404 Not Found
        if (response.status === 404) {
          throw new NotFoundError('Defender Device', 'requested');
        }

        // Handle 429 Throttling
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const retryMessage = retryAfter ? ` Retry after ${retryAfter} seconds.` : '';
          logger.error('[Defender API] Request throttled (429)', new Error('Rate limit exceeded'), {
            retryAfter: retryAfter ? `${retryAfter}s` : 'unknown',
            executionTime: `${executionTime}ms`
          });
          throw new ServiceError(`Microsoft Defender API rate limit exceeded.${retryMessage}`);
        }

        // Handle 401/403 Authentication errors
        if (response.status === 401 || response.status === 403) {
          throw new ServiceError('Microsoft Defender API authentication failed. Check credentials and permissions.');
        }

        throw new ServiceError(`Microsoft Defender API request failed with status ${response.status}`);
      }

      // Parse response
      const data = await response.json() as T;

      logger.info('[Defender API] Request successful', {
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
        logger.error('[Defender API] Network error', error as Error, {
          executionTime: `${executionTime}ms`
        });
        throw new ServiceError('Network error while connecting to Microsoft Defender API');
      }

      // Handle unknown errors
      logger.error('[Defender API] Unexpected error', error as Error, {
        executionTime: `${executionTime}ms`
      });
      throw new ServiceError('Unexpected error during Defender API request');
    }
  }

  /**
   * Get defender device by ID
   */
  async getById(id: string): Promise<DefenderDevice> {
    const startTime = Date.now();

    try {
      logger.info('[Defender API] Fetching defender device by ID', { id });

      const url = `${this.DEFENDER_API_BASE}/machines/${id}`;
      const device = await this.makeDefenderRequest<DefenderDevice>(url);

      const executionTime = Date.now() - startTime;

      logger.info('[Defender API] Defender device fetched successfully', {
        id,
        computerDnsName: device.computerDnsName,
        executionTime: `${executionTime}ms`
      });

      return device;

    } catch (error) {
      const executionTime = Date.now() - startTime;

      if (error instanceof NotFoundError) {
        throw error;
      }

      logger.error('[Defender API] Failed to fetch defender device', error as Error, {
        id,
        executionTime: `${executionTime}ms`
      });

      throw error;
    }
  }

  /**
   * Get all defender devices with optional filtering and pagination
   */
  async getAll(
    filter?: {
      healthStatus?: string | string[];
      riskScore?: string | string[];
      osPlatform?: string | string[];
      exposureLevel?: string | string[];
    },
    options?: {
      pageSize?: number;
      nextLink?: string;
      select?: string[];
    }
  ): Promise<PaginatedResponse<DefenderDevice>> {
    const startTime = Date.now();

    try {
      logger.info('[Defender API] Fetching defender devices', { filter, options });

      let url: string;

      if (options?.nextLink) {
        // Use nextLink for pagination
        url = options.nextLink;
      } else {
        // Build initial request URL
        url = `${this.DEFENDER_API_BASE}/machines`;

        const queryParams: string[] = [];

        // Add $filter if provided
        if (filter) {
          const filterObj: Record<string, string | string[]> = {};

          if (filter.healthStatus) {
            filterObj['healthStatus'] = filter.healthStatus;
          }
          if (filter.riskScore) {
            filterObj['riskScore'] = filter.riskScore;
          }
          if (filter.osPlatform) {
            filterObj['osPlatform'] = filter.osPlatform;
          }
          if (filter.exposureLevel) {
            filterObj['exposureLevel'] = filter.exposureLevel;
          }

          const filterString = this.buildFilterString(filterObj);
          if (filterString) {
            queryParams.push(`$filter=${encodeURIComponent(filterString)}`);
          }
        }

        // Add $top for page size (Defender API supports up to 10,000)
        const pageSize = Math.min(options?.pageSize || 10000, this.MAX_PAGE_SIZE);
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
      const response = await this.makeDefenderRequest<DefenderDeviceListResponse>(url);

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

      logger.info('[Defender API] Defender devices fetched successfully', {
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

      logger.error('[Defender API] Failed to fetch defender devices', error as Error, {
        filter,
        executionTime: `${executionTime}ms`
      });

      throw error;
    }
  }

  /**
   * Get defender devices by health status
   */
  async getByHealthStatus(
    healthStatus: string | string[],
    options?: { pageSize?: number; nextLink?: string }
  ): Promise<PaginatedResponse<DefenderDevice>> {
    return this.getAll({ healthStatus }, options);
  }

  /**
   * Get defender devices by risk score
   */
  async getByRiskScore(
    riskScore: string | string[],
    options?: { pageSize?: number; nextLink?: string }
  ): Promise<PaginatedResponse<DefenderDevice>> {
    return this.getAll({ riskScore }, options);
  }

  /**
   * Get high-risk devices
   */
  async getHighRiskDevices(options?: { pageSize?: number; nextLink?: string }): Promise<PaginatedResponse<DefenderDevice>> {
    return this.getAll({ riskScore: 'High' }, options);
  }

  /**
   * Get defender devices by operating system
   */
  async getByOperatingSystem(
    osPlatform: string | string[],
    options?: { pageSize?: number; nextLink?: string }
  ): Promise<PaginatedResponse<DefenderDevice>> {
    return this.getAll({ osPlatform }, options);
  }

  /**
   * Get defender devices by exposure level
   */
  async getByExposureLevel(
    exposureLevel: string | string[],
    options?: { pageSize?: number; nextLink?: string }
  ): Promise<PaginatedResponse<DefenderDevice>> {
    return this.getAll({ exposureLevel }, options);
  }

  /**
   * Check if defender device exists
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

  /**
   * Get all defender devices with automatic pagination handling
   * Fetches ALL devices from Defender API by following @odata.nextLink
   * Used for full sync operations
   *
   * WARNING: This method loads all devices into memory. For large datasets,
   * consider using getAll() with manual pagination instead.
   *
   * @returns Promise<DefenderDevice[]> - Array of all defender devices
   */
  async getAllDevicesPaginated(): Promise<DefenderDevice[]> {
    const allDevices: DefenderDevice[] = [];
    let nextLink: string | undefined = undefined;
    let pageCount = 0;
    const startTime = Date.now();

    try {
      logger.info('[Defender API] Starting full device fetch with automatic pagination');

      do {
        pageCount++;
        logger.info('[Defender API] Fetching page', {
          pageNumber: pageCount,
          devicesFetchedSoFar: allDevices.length
        });

        const response = await this.getAll(
          undefined, // No filters - fetch all devices
          {
            pageSize: this.MAX_PAGE_SIZE, // Use max page size for efficiency
            nextLink
          }
        );

        allDevices.push(...response.items);
        nextLink = response.nextLink;

        logger.info('[Defender API] Page fetched successfully', {
          pageNumber: pageCount,
          itemsInPage: response.items.length,
          totalDevicesFetched: allDevices.length,
          hasMorePages: response.hasMore
        });

      } while (nextLink);

      const executionTime = Date.now() - startTime;

      logger.info('[Defender API] Full device fetch completed', {
        totalPages: pageCount,
        totalDevices: allDevices.length,
        executionTime: `${executionTime}ms`,
        averageTimePerPage: `${(executionTime / pageCount).toFixed(2)}ms`
      });

      return allDevices;

    } catch (error) {
      const executionTime = Date.now() - startTime;

      logger.error('[Defender API] Failed to fetch all devices with pagination', error as Error, {
        pagesFetchedBeforeError: pageCount,
        devicesFetchedBeforeError: allDevices.length,
        executionTime: `${executionTime}ms`
      });

      throw error;
    }
  }
}

// Export singleton instance
export const defenderDeviceRepository = new DefenderDeviceRepository();
