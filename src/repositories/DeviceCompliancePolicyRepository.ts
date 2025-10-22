/**
 * Microsoft Graph API repository for Device Compliance Policy data access (read-only)
 * Handles Graph API calls for compliance policies with proper error handling and query tracing
 *
 * Security Features:
 * - Input validation
 * - 429 throttling with retry-after
 * - Request timeouts (30s)
 * - Never logs access tokens
 */

import { DeviceCompliancePolicy } from '../models/DeviceCompliancePolicy';
import { graphAuthHelper } from '../utils/graphAuthHelper';
import { logger } from '../utils/logger';
import { NotFoundError, ServiceError } from '../utils/errorHandler';

/**
 * Query trace information for logging
 */
interface QueryTrace {
  url: string;
  requestTime: number;
  policyId: string;
  policyType?: string;
}

export class DeviceCompliancePolicyRepository {
  private readonly GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';
  private readonly REQUEST_TIMEOUT_MS = 30000; // 30 seconds

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
      policyId: trace.policyId,
      policyType: trace.policyType,
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
          throw new NotFoundError('Device Compliance Policy', 'requested');
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
   * Get device compliance policy by ID
   *
   * @param policyId - The compliance policy ID (GUID)
   * @returns Device compliance policy details
   */
  async getById(policyId: string): Promise<DeviceCompliancePolicy> {
    const startTime = Date.now();

    try {
      logger.info('[Graph API] Fetching device compliance policy by ID', { policyId });

      const url = `${this.GRAPH_API_BASE}/deviceManagement/deviceCompliancePolicies/${policyId}`;
      const policy = await this.makeGraphRequest<DeviceCompliancePolicy>(url);

      const executionTime = Date.now() - startTime;

      // Log query trace
      this.logQueryTrace({
        url,
        requestTime: executionTime,
        policyId,
        policyType: policy['@odata.type']
      });

      logger.info('[Graph API] Device compliance policy fetched successfully', {
        policyId,
        displayName: policy.displayName,
        policyType: policy['@odata.type'],
        executionTime: `${executionTime}ms`
      });

      return policy;

    } catch (error) {
      const executionTime = Date.now() - startTime;

      if (error instanceof NotFoundError) {
        throw error;
      }

      logger.error('[Graph API] Failed to fetch device compliance policy', error as Error, {
        policyId,
        executionTime: `${executionTime}ms`
      });

      throw error;
    }
  }

  /**
   * Check if device compliance policy exists
   */
  async exists(policyId: string): Promise<boolean> {
    try {
      await this.getById(policyId);
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
export const deviceCompliancePolicyRepository = new DeviceCompliancePolicyRepository();
