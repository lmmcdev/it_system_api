/**
 * CosmosDB repository for Alert Event data access (read-only)
 * Handles all CosmosDB read operations with proper error handling, pagination, and query tracing
 */

import { CosmosClient, Container, Database } from '@azure/cosmos';
import { AlertEvent, AlertEventDocument, AlertValidation } from '../models/AlertEvent';
import { config } from '../config/environment';
import { logger } from '../utils/logger';
import { NotFoundError, ServiceError, ValidationError, ConflictError } from '../utils/errorHandler';

/**
 * Paginated response interface
 */
export interface PaginatedResponse<T> {
  items: T[];
  continuationToken?: string;
  hasMore: boolean;
  count: number;
}

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

export class AlertEventRepository {
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
      this.container = this.database.container(config.cosmos.alertContainerId);
      this.isInitialized = true;

      logger.info('[CosmosDB] Repository initialized successfully', {
        database: config.cosmos.databaseId,
        container: config.cosmos.alertContainerId
      });
    } catch (error) {
      logger.error('[CosmosDB] Failed to initialize repository', error as Error);
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
   * Get alert event by ID
   */
  async getById(id: string): Promise<AlertEvent> {
    const startTime = Date.now();

    try {
      const container = await this.getContainer();

      logger.info('[CosmosDB] Fetching alert event by ID', { id });

      // Add timeout protection
      const readPromise = container.item(id, id).read<AlertEventDocument>();
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
        logger.warn('[CosmosDB] Alert event not found', { id });
        throw new NotFoundError('Alert Event', id);
      }

      logger.info('[CosmosDB] Alert event fetched successfully', {
        id,
        executionTime: `${executionTime}ms`
      });

      return this.mapToAlertEvent(response.resource);
    } catch (error) {
      const executionTime = Date.now() - startTime;

      if (error instanceof NotFoundError) {
        throw error;
      }

      // Handle 404 from CosmosDB
      if ((error as { code?: number }).code === 404) {
        logger.warn('[CosmosDB] Alert event not found (404)', { id, executionTime: `${executionTime}ms` });
        throw new NotFoundError('Alert Event', id);
      }

      // Handle 409 Conflict errors
      if ((error as { code?: number }).code === 409) {
        logger.error('[CosmosDB] Conflict error (409)', error as Error, { id });
        throw new ConflictError('Conflict occurred while accessing alert event');
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

      logger.error('[CosmosDB] Failed to fetch alert event', error as Error, {
        id,
        errorCode: (error as { code?: number }).code,
        executionTime: `${executionTime}ms`
      });

      throw new ServiceError('Failed to fetch alert event');
    }
  }

  /**
   * Get all alert events with optional filtering and pagination
   * Uses parameterized queries to prevent SQL injection
   */
  async getAll(
    filter?: {
      severity?: string;
      status?: string;
      category?: string;
      startDate?: string;
      endDate?: string;
    },
    options?: {
      pageSize?: number;
      continuationToken?: string;
    }
  ): Promise<PaginatedResponse<AlertEvent>> {
    const startTime = Date.now();

    try {
      // Validate filter inputs
      if (filter?.severity && !AlertValidation.isValidSeverity(filter.severity)) {
        throw new ValidationError(
          `Invalid severity value: ${filter.severity}. Must be one of: informational, low, medium, high, critical`
        );
      }

      if (filter?.status && !AlertValidation.isValidStatus(filter.status)) {
        throw new ValidationError(
          `Invalid status value: ${filter.status}. Must be one of: new, inProgress, resolved`
        );
      }

      if (filter?.category && !AlertValidation.isValidCategory(filter.category)) {
        throw new ValidationError(`Invalid category value: ${filter.category}`);
      }

      // Validate date formats (ISO 8601)
      if (filter?.startDate && isNaN(Date.parse(filter.startDate))) {
        throw new ValidationError(
          `Invalid startDate format: ${filter.startDate}. Must be a valid ISO 8601 date string`
        );
      }

      if (filter?.endDate && isNaN(Date.parse(filter.endDate))) {
        throw new ValidationError(
          `Invalid endDate format: ${filter.endDate}. Must be a valid ISO 8601 date string`
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
      if (filter?.severity) {
        conditions.push('c["value"]["severity"] = @severity');
        parameters.push({ name: '@severity', value: filter.severity });
      }

      if (filter?.status) {
        conditions.push('c["value"]["status"] = @status');
        parameters.push({ name: '@status', value: filter.status });
      }

      if (filter?.category) {
        conditions.push('c["value"]["category"] = @category');
        parameters.push({ name: '@category', value: filter.category });
      }

      if (filter?.startDate) {
        conditions.push('c["value"]["createdDateTime"] >= @startDate');
        parameters.push({ name: '@startDate', value: filter.startDate });
      }

      if (filter?.endDate) {
        conditions.push('c["value"]["createdDateTime"] <= @endDate');
        parameters.push({ name: '@endDate', value: filter.endDate });
      }

      // Build WHERE clause
      // NOTE: IS_DEFINED() filter removed - causing "invalid input" error in this container
      // All valid documents have c.value property based on testing
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      // NOTE: ORDER BY commented out due to missing composite index
      // To re-enable: Create composite index in Azure Portal:
      // Path: /value/createdDateTime (DESC)
      // query += ' ORDER BY c["value"]["createdDateTime"] DESC';

      logger.info('[CosmosDB] Executing query with pagination', {
        filter,
        pageSize,
        hasContinuationToken: !!options?.continuationToken
      });

      // Execute query with pagination and timeout protection
      const queryIterator = container.items.query<AlertEventDocument>(
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

      logger.info('[CosmosDB] Query executed successfully', {
        itemCount: response.resources.length,
        hasMore: response.hasMoreResults,
        requestCharge: `${(response.requestCharge || 0).toFixed(2)} RU`,
        executionTime: `${executionTime}ms`
      });

      return {
        items: response.resources.map(resource => this.mapToAlertEvent(resource)),
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
        logger.error('[CosmosDB] Conflict error (409) during query', error as Error, {
          filter,
          executionTime: `${executionTime}ms`
        });
        throw new ConflictError('Conflict occurred while querying alert events');
      }

      // Handle 429 Throttling
      if ((error as { code?: number }).code === 429) {
        const retryAfter = (error as any).retryAfterInMilliseconds || 1000;
        logger.error('[CosmosDB] Request throttled (429) during query', error as Error, {
          filter,
          retryAfter: `${retryAfter}ms`,
          executionTime: `${executionTime}ms`
        });
        throw new ServiceError('Service temporarily unavailable, please retry', {
          retryAfter
        });
      }

      logger.error('[CosmosDB] Query failed', error as Error, {
        filter,
        errorCode: (error as { code?: number }).code,
        executionTime: `${executionTime}ms`
      });

      throw new ServiceError('Failed to fetch alert events');
    }
  }

  /**
   * Get alert events by severity
   */
  async getBySeverity(severity: string, options?: { pageSize?: number; continuationToken?: string }): Promise<PaginatedResponse<AlertEvent>> {
    return this.getAll({ severity }, options);
  }

  /**
   * Get alert events by status
   */
  async getByStatus(status: string, options?: { pageSize?: number; continuationToken?: string }): Promise<PaginatedResponse<AlertEvent>> {
    return this.getAll({ status }, options);
  }

  /**
   * Get alert events by category
   */
  async getByCategory(category: string, options?: { pageSize?: number; continuationToken?: string }): Promise<PaginatedResponse<AlertEvent>> {
    return this.getAll({ category }, options);
  }

  /**
   * Get alert events within a date range
   */
  async getByDateRange(
    startDate: string,
    endDate: string,
    options?: { pageSize?: number; continuationToken?: string }
  ): Promise<PaginatedResponse<AlertEvent>> {
    return this.getAll({ startDate, endDate }, options);
  }

  /**
   * Check if alert event exists
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
   * Map CosmosDB document to AlertEvent model
   * CosmosDB documents have a nested structure where all fields are under "value" property
   * We need to extract and flatten the structure for the API response
   */
  private mapToAlertEvent(doc: any): AlertEvent {
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

    return result as AlertEvent;
  }
}

// Export singleton instance
export const alertEventRepository = new AlertEventRepository();
