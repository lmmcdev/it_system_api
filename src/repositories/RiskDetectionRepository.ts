/**
 * CosmosDB repository for Risk Detection Event data access (read-only)
 * Handles all CosmosDB read operations with proper error handling, pagination, and query tracing
 */

import { CosmosClient, Container, Database } from '@azure/cosmos';
import { RiskDetectionEvent, RiskDetectionEventDocument, RiskDetectionValidation } from '../models/RiskDetectionEvent';
import { PaginatedResponse as AlertPaginatedResponse } from './AlertEventRepository';
import { config } from '../config/environment';
import { logger } from '../utils/logger';
import { NotFoundError, ServiceError, ValidationError, ConflictError } from '../utils/errorHandler';

/**
 * Re-export PaginatedResponse for convenience
 */
export type PaginatedResponse<T> = AlertPaginatedResponse<T>;

/**
 * Query trace information for logging
 */
interface QueryTrace {
  query: string;
  parameters?: Array<{ name: string; value: string }>;
  requestCharge: number;
  executionTime: number;
  itemCount: number;
}

export class RiskDetectionRepository {
  private client: CosmosClient;
  private database: Database | null = null;
  private container: Container | null = null;
  private isInitialized: boolean = false;
  private readonly QUERY_TIMEOUT_MS = 30000; // 30 seconds

  constructor() {
    this.client = new CosmosClient({
      endpoint: config.cosmos.endpoint,
      key: config.cosmos.key
    });
  }

  /**
   * Creates a timeout promise that rejects after specified milliseconds
   */
  private createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new ServiceError(`Query timeout exceeded (${timeoutMs}ms). Please refine your query.`));
      }, timeoutMs);
    });
  }

  /**
   * Initialize database and container connections
   */
  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.database = this.client.database(config.cosmos.databaseId);
      this.container = this.database.container(config.cosmos.riskDetectionContainerId);
      this.isInitialized = true;

      logger.info('[CosmosDB] Risk Detection Repository initialized successfully', {
        database: config.cosmos.databaseId,
        container: config.cosmos.riskDetectionContainerId
      });
    } catch (error) {
      logger.error('[CosmosDB] Failed to initialize Risk Detection Repository', error as Error);
      throw new ServiceError('Database initialization failed');
    }
  }

  /**
   * Get container instance
   */
  private async getContainer(): Promise<Container> {
    await this.ensureInitialized();
    if (!this.container) {
      throw new ServiceError('Container not initialized');
    }
    return this.container;
  }

  /**
   * Log query execution trace
   */
  private logQueryTrace(trace: QueryTrace): void {
    logger.info('[CosmosDB Query Trace]', {
      query: trace.query,
      parameters: trace.parameters,
      requestCharge: `${trace.requestCharge.toFixed(2)} RU`,
      executionTime: `${trace.executionTime}ms`,
      itemCount: trace.itemCount,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get risk detection event by ID
   */
  async getById(id: string): Promise<RiskDetectionEvent> {
    const startTime = Date.now();

    try {
      const container = await this.getContainer();

      logger.info('[CosmosDB] Fetching risk detection event by ID', { id });

      // Add timeout protection
      const readPromise = container.item(id, id).read<RiskDetectionEventDocument>();
      const response = await Promise.race([
        readPromise,
        this.createTimeoutPromise(this.QUERY_TIMEOUT_MS)
      ]);

      const executionTime = Date.now() - startTime;

      // Log trace
      this.logQueryTrace({
        query: `Point read: id=${id}`,
        requestCharge: response.requestCharge || 0,
        executionTime,
        itemCount: response.resource ? 1 : 0
      });

      if (!response.resource) {
        logger.warn('[CosmosDB] Risk detection event not found', { id });
        throw new NotFoundError('Risk Detection Event', id);
      }

      logger.info('[CosmosDB] Risk detection event fetched successfully', {
        id,
        executionTime: `${executionTime}ms`
      });

      return this.mapToRiskDetectionEvent(response.resource);
    } catch (error) {
      const executionTime = Date.now() - startTime;

      if (error instanceof NotFoundError) {
        throw error;
      }

      // Handle 404 from CosmosDB
      if ((error as { code?: number }).code === 404) {
        logger.warn('[CosmosDB] Risk detection event not found (404)', { id, executionTime: `${executionTime}ms` });
        throw new NotFoundError('Risk Detection Event', id);
      }

      // Handle 409 Conflict errors
      if ((error as { code?: number }).code === 409) {
        logger.error('[CosmosDB] Conflict error (409)', error as Error, { id });
        throw new ConflictError('Conflict occurred while accessing risk detection event');
      }

      // Handle 429 Throttling
      if ((error as { code?: number }).code === 429) {
        const retryAfter = (error as any).retryAfterInMilliseconds || 1000;
        logger.error('[CosmosDB] Request throttled (429)', error as Error, {
          id,
          retryAfter: `${retryAfter}ms`
        });
        throw new ServiceError('Service temporarily unavailable, please retry', {
          retryAfter
        });
      }

      logger.error('[CosmosDB] Failed to fetch risk detection event', error as Error, {
        id,
        errorCode: (error as { code?: number }).code,
        executionTime: `${executionTime}ms`
      });

      throw new ServiceError('Failed to fetch risk detection event');
    }
  }

  /**
   * Get all risk detection events with optional filtering and pagination
   * Uses parameterized queries to prevent SQL injection
   */
  async getAll(
    filter?: {
      riskLevel?: string;
      riskState?: string;
      userId?: string;
      startDate?: string;
      endDate?: string;
    },
    options?: {
      pageSize?: number;
      continuationToken?: string;
    }
  ): Promise<AlertPaginatedResponse<RiskDetectionEvent>> {
    const startTime = Date.now();

    try {
      // Validate filter inputs
      if (filter?.riskLevel && !RiskDetectionValidation.isValidRiskLevel(filter.riskLevel)) {
        throw new ValidationError(
          `Invalid riskLevel value: ${filter.riskLevel}. Must be one of: low, medium, high, hidden, none, unknownFutureValue`
        );
      }

      if (filter?.riskState && !RiskDetectionValidation.isValidRiskState(filter.riskState)) {
        throw new ValidationError(
          `Invalid riskState value: ${filter.riskState}. Must be one of: none, confirmedSafe, remediated, dismissed, atRisk, confirmedCompromised, unknownFutureValue`
        );
      }

      // Validate date formats (accepts both YYYY-MM-DD and ISO 8601)
      if (filter?.startDate && isNaN(Date.parse(filter.startDate))) {
        throw new ValidationError(
          `Invalid startDate format: ${filter.startDate}. Must be a valid date string (YYYY-MM-DD or ISO 8601)`
        );
      }

      if (filter?.endDate && isNaN(Date.parse(filter.endDate))) {
        throw new ValidationError(
          `Invalid endDate format: ${filter.endDate}. Must be a valid date string (YYYY-MM-DD or ISO 8601)`
        );
      }

      const container = await this.getContainer();

      // Set pagination defaults
      const pageSize = Math.min(options?.pageSize || 50, 100); // Max 100 items per page

      let query = 'SELECT * FROM c';
      const conditions: string[] = [];
      const parameters: { name: string; value: string }[] = [];

      // Build parameterized query to prevent SQL injection
      // NOTE: Documents use nested structure with all fields under c["value"]["fieldName"]
      if (filter?.riskLevel) {
        conditions.push('c["value"]["riskLevel"] = @riskLevel');
        parameters.push({ name: '@riskLevel', value: filter.riskLevel });
      }

      if (filter?.riskState) {
        conditions.push('c["value"]["riskState"] = @riskState');
        parameters.push({ name: '@riskState', value: filter.riskState });
      }

      if (filter?.userId) {
        conditions.push('c["value"]["userId"] = @userId');
        parameters.push({ name: '@userId', value: filter.userId });
      }

      if (filter?.startDate) {
        conditions.push('c["value"]["detectedDateTime"] >= @startDate');
        parameters.push({ name: '@startDate', value: filter.startDate });
      }

      if (filter?.endDate) {
        conditions.push('c["value"]["detectedDateTime"] <= @endDate');
        parameters.push({ name: '@endDate', value: filter.endDate });
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      // Order by detected date descending (most recent first)
      query += ' ORDER BY c["value"]["detectedDateTime"] DESC';

      logger.info('[CosmosDB] Executing risk detection query with pagination', {
        filter,
        pageSize,
        hasContinuationToken: !!options?.continuationToken
      });

      // Execute query with pagination and timeout protection
      const queryIterator = container.items.query<RiskDetectionEventDocument>(
        {
          query: query,
          parameters: parameters
        },
        {
          maxItemCount: pageSize,
          continuationToken: options?.continuationToken
        }
      );

      const queryPromise = queryIterator.fetchNext();
      const response = await Promise.race([
        queryPromise,
        this.createTimeoutPromise(this.QUERY_TIMEOUT_MS)
      ]);

      const executionTime = Date.now() - startTime;

      // Log query trace
      this.logQueryTrace({
        query,
        parameters,
        requestCharge: response.requestCharge || 0,
        executionTime,
        itemCount: response.resources.length
      });

      logger.info('[CosmosDB] Risk detection query executed successfully', {
        itemCount: response.resources.length,
        hasMore: response.hasMoreResults,
        requestCharge: `${(response.requestCharge || 0).toFixed(2)} RU`,
        executionTime: `${executionTime}ms`
      });

      return {
        items: response.resources.map(resource => this.mapToRiskDetectionEvent(resource)),
        continuationToken: response.continuationToken,
        hasMore: response.hasMoreResults,
        count: response.resources.length
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      // Preserve ValidationError
      if (error instanceof ValidationError) {
        throw error;
      }

      // Handle 409 Conflict errors
      if ((error as { code?: number }).code === 409) {
        logger.error('[CosmosDB] Conflict error (409) during risk detection query', error as Error, {
          filter,
          executionTime: `${executionTime}ms`
        });
        throw new ConflictError('Conflict occurred while querying risk detection events');
      }

      // Handle 429 Throttling
      if ((error as { code?: number }).code === 429) {
        const retryAfter = (error as any).retryAfterInMilliseconds || 1000;
        logger.error('[CosmosDB] Request throttled (429) during risk detection query', error as Error, {
          filter,
          retryAfter: `${retryAfter}ms`,
          executionTime: `${executionTime}ms`
        });
        throw new ServiceError('Service temporarily unavailable, please retry', {
          retryAfter
        });
      }

      logger.error('[CosmosDB] Risk detection query failed', error as Error, {
        filter,
        errorCode: (error as { code?: number }).code,
        executionTime: `${executionTime}ms`
      });

      throw new ServiceError('Failed to fetch risk detection events');
    }
  }

  /**
   * Get risk detection events by risk level
   */
  async getByRiskLevel(riskLevel: string, options?: { pageSize?: number; continuationToken?: string }): Promise<AlertPaginatedResponse<RiskDetectionEvent>> {
    return this.getAll({ riskLevel }, options);
  }

  /**
   * Get risk detection events by risk state
   */
  async getByRiskState(riskState: string, options?: { pageSize?: number; continuationToken?: string }): Promise<AlertPaginatedResponse<RiskDetectionEvent>> {
    return this.getAll({ riskState }, options);
  }

  /**
   * Get risk detection events by user ID
   */
  async getByUserId(userId: string, options?: { pageSize?: number; continuationToken?: string }): Promise<AlertPaginatedResponse<RiskDetectionEvent>> {
    return this.getAll({ userId }, options);
  }

  /**
   * Get risk detection events within a date range
   */
  async getByDateRange(
    startDate: string,
    endDate: string,
    options?: { pageSize?: number; continuationToken?: string }
  ): Promise<AlertPaginatedResponse<RiskDetectionEvent>> {
    return this.getAll({ startDate, endDate }, options);
  }

  /**
   * Check if risk detection event exists
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
   * Map CosmosDB document to RiskDetectionEvent model
   * CosmosDB documents have a nested structure where all fields are under "value" property
   * We need to extract and flatten the structure for the API response
   */
  private mapToRiskDetectionEvent(doc: any): RiskDetectionEvent {
    // Documents are stored with nested structure: { id, value: { ...fields }, _rid, _etag, _ts }
    // Extract the value object and merge with document-level metadata
    const value = doc.value || {};

    const result: any = {
      id: doc.id,
      ...value
    };

    // Preserve CosmosDB metadata only if present (avoid adding undefined fields)
    if (doc._rid !== undefined) result._rid = doc._rid;
    if (doc._self !== undefined) result._self = doc._self;
    if (doc._etag !== undefined) result._etag = doc._etag;
    if (doc._attachments !== undefined) result._attachments = doc._attachments;
    if (doc._ts !== undefined) result._ts = doc._ts;

    return result as RiskDetectionEvent;
  }
}

// Export singleton instance
export const riskDetectionRepository = new RiskDetectionRepository();
