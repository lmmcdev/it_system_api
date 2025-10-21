/**
 * CosmosDB repository for Alert Statistics data access
 * Handles statistics storage, retrieval, and alert event aggregation queries
 */

import { CosmosClient, Container, Database } from '@azure/cosmos';
import {
  AlertStatisticsDocument,
  StatisticsType,
  StatisticsQueryFilter
} from '../models/AlertStatistics';
import { AlertEventDocument } from '../models/AlertEvent';
import { config } from '../config/environment';
import { logger } from '../utils/logger';
import { NotFoundError, ServiceError, ValidationError, ConflictError } from '../utils/errorHandler';
import { validateISODate } from '../utils/validator';

/**
 * Paginated response for statistics queries
 */
export interface StatisticsPaginatedResponse<T> {
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
  parameters?: Array<{ name: string; value: string | number }>;
  requestCharge: number;
  executionTime: number;
  itemCount: number;
}

export class AlertStatisticsRepository {
  private client: CosmosClient;
  private database: Database | null = null;
  private statisticsContainer: Container | null = null;
  private alertEventsContainer: Container | null = null;
  private isInitialized: boolean = false;
  private readonly QUERY_TIMEOUT_MS = 60000; // 60 seconds for aggregation queries

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
      this.statisticsContainer = this.database.container(config.cosmos.alertStatisticsContainerId);
      this.alertEventsContainer = this.database.container(config.cosmos.alertContainerId);
      this.isInitialized = true;

      logger.info('[CosmosDB] Alert Statistics Repository initialized successfully', {
        database: config.cosmos.databaseId,
        statisticsContainer: config.cosmos.alertStatisticsContainerId,
        alertEventsContainer: config.cosmos.alertContainerId
      });
    } catch (error) {
      logger.error('[CosmosDB] Failed to initialize Alert Statistics Repository', error as Error);
      throw new ServiceError('Database initialization failed');
    }
  }

  /**
   * Get statistics container instance
   */
  private async getStatisticsContainer(): Promise<Container> {
    await this.ensureInitialized();
    if (!this.statisticsContainer) {
      throw new ServiceError('Statistics container not initialized');
    }
    return this.statisticsContainer;
  }

  /**
   * Get alert events container instance
   */
  private async getAlertEventsContainer(): Promise<Container> {
    await this.ensureInitialized();
    if (!this.alertEventsContainer) {
      throw new ServiceError('Alert events container not initialized');
    }
    return this.alertEventsContainer;
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
   * Save or update alert statistics document
   */
  async saveStatistics(statistics: AlertStatisticsDocument): Promise<AlertStatisticsDocument> {
    const startTime = Date.now();

    try {
      const container = await this.getStatisticsContainer();

      logger.info('[CosmosDB] Saving alert statistics', {
        id: statistics.id,
        type: statistics.type,
        period: statistics.period
      });

      const { resource, requestCharge } = await container.items.upsert(statistics);

      const executionTime = Date.now() - startTime;

      this.logQueryTrace({
        query: `Upsert statistics document: ${statistics.id}`,
        requestCharge: requestCharge || 0,
        executionTime,
        itemCount: 1
      });

      logger.info('[CosmosDB] Alert statistics saved successfully', {
        id: statistics.id,
        type: statistics.type,
        requestCharge: `${(requestCharge || 0).toFixed(2)} RU`,
        executionTime: `${executionTime}ms`
      });

      return resource as AlertStatisticsDocument;
    } catch (error) {
      const executionTime = Date.now() - startTime;

      // Handle 409 Conflict errors
      if ((error as { code?: number }).code === 409) {
        logger.error('[CosmosDB] Conflict error (409) while saving statistics', error as Error, {
          id: statistics.id,
          executionTime: `${executionTime}ms`
        });
        throw new ConflictError('Conflict occurred while saving statistics');
      }

      // Handle 429 Throttling
      if ((error as { code?: number }).code === 429) {
        const retryAfter = (error as any).retryAfterInMilliseconds || 1000;
        logger.error('[CosmosDB] Request throttled (429) while saving statistics', error as Error, {
          id: statistics.id,
          retryAfter: `${retryAfter}ms`,
          executionTime: `${executionTime}ms`
        });
        throw new ServiceError('Service temporarily unavailable, please retry', {
          retryAfter
        });
      }

      logger.error('[CosmosDB] Failed to save alert statistics', error as Error, {
        id: statistics.id,
        errorCode: (error as { code?: number }).code,
        executionTime: `${executionTime}ms`
      });

      throw new ServiceError('Failed to save alert statistics');
    }
  }

  /**
   * Get alert statistics by ID
   */
  async getById(id: string, partitionKey: string): Promise<AlertStatisticsDocument> {
    const startTime = Date.now();

    try {
      const container = await this.getStatisticsContainer();

      logger.info('[CosmosDB] Fetching alert statistics by ID', { id, partitionKey });

      const readPromise = container.item(id, partitionKey).read<AlertStatisticsDocument>();
      const response = await Promise.race([
        readPromise,
        this.createTimeoutPromise(this.QUERY_TIMEOUT_MS)
      ]);

      const executionTime = Date.now() - startTime;

      this.logQueryTrace({
        query: `Point read: id=${id}, partitionKey=${partitionKey}`,
        requestCharge: response.requestCharge || 0,
        executionTime,
        itemCount: response.resource ? 1 : 0
      });

      if (!response.resource) {
        logger.warn('[CosmosDB] Alert statistics not found', { id, partitionKey });
        throw new NotFoundError('Alert Statistics', id);
      }

      logger.info('[CosmosDB] Alert statistics fetched successfully', {
        id,
        executionTime: `${executionTime}ms`
      });

      return response.resource;
    } catch (error) {
      const executionTime = Date.now() - startTime;

      if (error instanceof NotFoundError) {
        throw error;
      }

      if ((error as { code?: number }).code === 404) {
        logger.warn('[CosmosDB] Alert statistics not found (404)', { id, partitionKey, executionTime: `${executionTime}ms` });
        throw new NotFoundError('Alert Statistics', id);
      }

      logger.error('[CosmosDB] Failed to fetch alert statistics', error as Error, {
        id,
        partitionKey,
        errorCode: (error as { code?: number }).code,
        executionTime: `${executionTime}ms`
      });

      throw new ServiceError('Failed to fetch alert statistics');
    }
  }

  /**
   * Query alert statistics with filters and pagination
   */
  async queryStatistics(
    filter: StatisticsQueryFilter,
    options?: {
      pageSize?: number;
      continuationToken?: string;
    }
  ): Promise<StatisticsPaginatedResponse<AlertStatisticsDocument>> {
    const startTime = Date.now();

    try {
      // Validate date filters
      // Accept both YYYY-MM-DD and ISO 8601 formats, normalize to YYYY-MM-DD
      if (filter.startDate) {
        // Check if it's already in YYYY-MM-DD format (10 characters)
        const isSimpleDate = filter.startDate.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(filter.startDate);

        if (isSimpleDate) {
          // Already in correct format, validate it's a valid date
          const date = new Date(filter.startDate + 'T00:00:00.000Z');
          if (isNaN(date.getTime())) {
            throw new ValidationError(`Invalid startDate: Date value is invalid`);
          }
        } else {
          // Try as ISO 8601 format
          const validation = validateISODate(filter.startDate);
          if (!validation.valid) {
            throw new ValidationError(`Invalid startDate: ${validation.error}`);
          }
        }
      }

      if (filter.endDate) {
        // Check if it's already in YYYY-MM-DD format (10 characters)
        const isSimpleDate = filter.endDate.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(filter.endDate);

        if (isSimpleDate) {
          // Already in correct format, validate it's a valid date
          const date = new Date(filter.endDate + 'T00:00:00.000Z');
          if (isNaN(date.getTime())) {
            throw new ValidationError(`Invalid endDate: Date value is invalid`);
          }
        } else {
          // Try as ISO 8601 format
          const validation = validateISODate(filter.endDate);
          if (!validation.valid) {
            throw new ValidationError(`Invalid endDate: ${validation.error}`);
          }
        }
      }

      const container = await this.getStatisticsContainer();
      const pageSize = Math.min(options?.pageSize || 50, 100);

      let query = 'SELECT * FROM c';
      const conditions: string[] = [];
      const parameters: Array<{ name: string; value: string }> = [];

      // Build query filters
      if (filter.type) {
        conditions.push('c.type = @type');
        parameters.push({ name: '@type', value: filter.type });
      }

      if (filter.startDate) {
        conditions.push('c.periodStartDate >= @startDate');
        parameters.push({ name: '@startDate', value: filter.startDate.substring(0, 10) }); // YYYY-MM-DD
      }

      if (filter.endDate) {
        conditions.push('c.periodStartDate <= @endDate');
        parameters.push({ name: '@endDate', value: filter.endDate.substring(0, 10) }); // YYYY-MM-DD
      }

      if (filter.periodType) {
        conditions.push('c.period.periodType = @periodType');
        parameters.push({ name: '@periodType', value: filter.periodType });
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      // NOTE: ORDER BY commented out due to missing composite index
      // To re-enable: Create composite index in Azure Portal:
      // Path 1: /periodStartDate (DESC), Path 2: /generatedAt (DESC)
      // query += ' ORDER BY c.periodStartDate DESC, c.generatedAt DESC';

      logger.info('[CosmosDB] Executing statistics query', {
        filter,
        pageSize,
        hasContinuationToken: !!options?.continuationToken
      });

      const queryIterator = container.items.query<AlertStatisticsDocument>(
        { query, parameters },
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

      // Defensive: CosmosDB SDK may return undefined resources in edge cases
      const items = response.resources ?? [];
      const itemCount = items.length;
      const hasMore = response.hasMoreResults ?? false;

      this.logQueryTrace({
        query,
        parameters,
        requestCharge: response.requestCharge || 0,
        executionTime,
        itemCount
      });

      logger.info('[CosmosDB] Statistics query executed successfully', {
        itemCount,
        hasMore,
        requestCharge: `${(response.requestCharge || 0).toFixed(2)} RU`,
        executionTime: `${executionTime}ms`
      });

      return {
        items,
        continuationToken: response.continuationToken,
        hasMore,
        count: itemCount
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      if (error instanceof ValidationError) {
        throw error;
      }

      logger.error('[CosmosDB] Statistics query failed', error as Error, {
        filter,
        errorCode: (error as { code?: number }).code,
        executionTime: `${executionTime}ms`
      });

      throw new ServiceError('Failed to query alert statistics');
    }
  }

  /**
   * Query alert events for aggregation
   * Returns alert events in batches for statistics generation
   *
   * IMPORTANT: This container has a limitation - it cannot query nested paths (c.value.*)
   * Therefore, we fetch ALL documents and filter by date in memory.
   */
  async queryAlertEventsForAggregation(
    filter: {
      startDate?: string;
      endDate?: string;
    },
    options?: {
      batchSize?: number;
      continuationToken?: string;
    }
  ): Promise<StatisticsPaginatedResponse<AlertEventDocument>> {
    const startTime = Date.now();

    try {
      const container = await this.getAlertEventsContainer();

      // NOTE: We use a larger batch size since we can't filter by date in CosmosDB
      // We'll filter in memory after fetching
      const batchSize = Math.min(options?.batchSize || config.statistics.batchSize, 1000);

      // Simple query - no WHERE clause for dates (container limitation: cannot query nested paths)
      const query = 'SELECT * FROM c';

      logger.info('[CosmosDB] Querying alert events for aggregation (in-memory filtering)', {
        filter,
        batchSize,
        hasContinuationToken: !!options?.continuationToken,
        startDate: filter.startDate,
        endDate: filter.endDate,
        note: 'Fetching all documents, will filter by date in memory'
      });

      const queryIterator = container.items.query<AlertEventDocument>(
        { query },
        {
          maxItemCount: batchSize,
          continuationToken: options?.continuationToken
        }
      );

      const queryPromise = queryIterator.fetchNext();
      const response = await Promise.race([
        queryPromise,
        this.createTimeoutPromise(this.QUERY_TIMEOUT_MS)
      ]);

      const executionTime = Date.now() - startTime;

      // Defensive: CosmosDB SDK may return undefined resources in edge cases
      const allItems = response.resources ?? [];

      // FILTER IN MEMORY by date range
      let filteredItems = allItems;

      if (filter.startDate || filter.endDate) {
        const startDate = filter.startDate ? new Date(filter.startDate) : null;
        const endDate = filter.endDate ? new Date(filter.endDate) : null;

        filteredItems = allItems.filter(doc => {
          // Skip documents without createdDateTime
          if (!doc.value?.createdDateTime) {
            logger.warn('[CosmosDB] Skipping document without createdDateTime', {
              id: doc.id,
              hasValue: !!doc.value
            });
            return false;
          }

          try {
            const docDate = new Date(doc.value.createdDateTime);

            // Check if date is valid
            if (isNaN(docDate.getTime())) {
              logger.warn('[CosmosDB] Invalid createdDateTime format', {
                id: doc.id,
                createdDateTime: doc.value.createdDateTime
              });
              return false;
            }

            // Apply date filters
            if (startDate && docDate < startDate) {
              return false;
            }

            if (endDate && docDate > endDate) {
              return false;
            }

            return true;
          } catch (error) {
            logger.error('[CosmosDB] Error parsing date for document', error as Error, {
              id: doc.id,
              createdDateTime: doc.value.createdDateTime
            });
            return false;
          }
        });

        logger.info('[CosmosDB] In-memory filtering applied', {
          totalFetched: allItems.length,
          afterFiltering: filteredItems.length,
          filtered: allItems.length - filteredItems.length
        });
      }

      const itemCount = filteredItems.length;
      const hasMore = response.hasMoreResults ?? false;

      this.logQueryTrace({
        query,
        requestCharge: response.requestCharge || 0,
        executionTime,
        itemCount: allItems.length // Log original count from CosmosDB
      });

      // Log sample alert data for debugging (first item only)
      if (itemCount > 0 && filteredItems.length > 0) {
        const sampleAlert = filteredItems[0];
        logger.info('[CosmosDB] Sample alert from filtered results', {
          id: sampleAlert.id,
          hasValue: !!sampleAlert.value,
          createdDateTime: sampleAlert.value?.createdDateTime,
          createdDateTimeType: typeof sampleAlert.value?.createdDateTime,
          severity: sampleAlert.value?.severity,
          status: sampleAlert.value?.status,
          detectionSource: sampleAlert.value?.detectionSource,
          category: sampleAlert.value?.category,
          hasEvidence: !!sampleAlert.value?.evidence,
          evidenceCount: sampleAlert.value?.evidence?.length || 0
        });
      } else {
        logger.warn('[CosmosDB] No alert events matched filter criteria', {
          totalFetched: allItems.length,
          afterFiltering: filteredItems.length,
          filterStartDate: filter.startDate,
          filterEndDate: filter.endDate
        });
      }

      logger.info('[CosmosDB] Alert events query for aggregation completed', {
        totalFetchedFromDB: allItems.length,
        filteredItemCount: itemCount,
        hasMore,
        requestCharge: `${(response.requestCharge || 0).toFixed(2)} RU`,
        executionTime: `${executionTime}ms`
      });

      return {
        items: filteredItems, // Return filtered items
        continuationToken: response.continuationToken,
        hasMore,
        count: itemCount // Count of filtered items
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      logger.error('[CosmosDB] Failed to query alert events for aggregation', error as Error, {
        filter,
        errorCode: (error as { code?: number }).code,
        executionTime: `${executionTime}ms`
      });

      throw new ServiceError('Failed to query alert events for aggregation');
    }
  }

  /**
   * Delete alert statistics by ID
   */
  async deleteById(id: string, partitionKey: string): Promise<void> {
    const startTime = Date.now();

    try {
      const container = await this.getStatisticsContainer();

      logger.info('[CosmosDB] Deleting alert statistics', { id, partitionKey });

      const { requestCharge } = await container.item(id, partitionKey).delete();

      const executionTime = Date.now() - startTime;

      this.logQueryTrace({
        query: `Delete: id=${id}, partitionKey=${partitionKey}`,
        requestCharge: requestCharge || 0,
        executionTime,
        itemCount: 1
      });

      logger.info('[CosmosDB] Alert statistics deleted successfully', {
        id,
        partitionKey,
        executionTime: `${executionTime}ms`
      });
    } catch (error) {
      const executionTime = Date.now() - startTime;

      if ((error as { code?: number }).code === 404) {
        logger.warn('[CosmosDB] Alert statistics not found for deletion (404)', {
          id,
          partitionKey,
          executionTime: `${executionTime}ms`
        });
        throw new NotFoundError('Alert Statistics', id);
      }

      logger.error('[CosmosDB] Failed to delete alert statistics', error as Error, {
        id,
        partitionKey,
        errorCode: (error as { code?: number }).code,
        executionTime: `${executionTime}ms`
      });

      throw new ServiceError('Failed to delete alert statistics');
    }
  }

  /**
   * Check if statistics exist for a given type and period
   * DEPRECATED: Use getLatestForPeriod() for historical tracking
   */
  async existsForPeriod(
    type: StatisticsType,
    periodStartDate: string
  ): Promise<AlertStatisticsDocument | null> {
    const startTime = Date.now();

    try {
      const container = await this.getStatisticsContainer();

      // NOTE: ORDER BY commented out due to missing composite index
      const query = 'SELECT * FROM c WHERE c.type = @type AND c.periodStartDate = @periodStartDate';
      const parameters = [
        { name: '@type', value: type },
        { name: '@periodStartDate', value: periodStartDate }
      ];

      logger.info('[CosmosDB] Checking if statistics exist', { type, periodStartDate });

      const queryIterator = container.items.query<AlertStatisticsDocument>(
        { query, parameters },
        { maxItemCount: 1 }
      );

      const response = await queryIterator.fetchNext();
      const executionTime = Date.now() - startTime;

      // Defensive: CosmosDB SDK may return undefined resources in edge cases
      const items = response.resources ?? [];

      this.logQueryTrace({
        query,
        parameters,
        requestCharge: response.requestCharge || 0,
        executionTime,
        itemCount: items.length
      });

      if (items.length > 0) {
        logger.info('[CosmosDB] Statistics found', {
          type,
          periodStartDate,
          id: items[0].id
        });
        return items[0];
      }

      logger.info('[CosmosDB] No statistics found', { type, periodStartDate });
      return null;
    } catch (error) {
      const executionTime = Date.now() - startTime;

      logger.error('[CosmosDB] Failed to check statistics existence', error as Error, {
        type,
        periodStartDate,
        executionTime: `${executionTime}ms`
      });

      throw new ServiceError('Failed to check statistics existence');
    }
  }

  /**
   * Get the latest statistics for a given type and period date
   * Returns the most recent statistics document based on generatedAt timestamp
   */
  async getLatestForPeriod(
    type: StatisticsType,
    periodStartDate: string
  ): Promise<AlertStatisticsDocument | null> {
    const startTime = Date.now();

    try {
      const container = await this.getStatisticsContainer();

      // NOTE: ORDER BY commented out due to missing composite index
      const query = 'SELECT * FROM c WHERE c.type = @type AND c.periodStartDate = @periodStartDate';
      const parameters = [
        { name: '@type', value: type },
        { name: '@periodStartDate', value: periodStartDate }
      ];

      logger.info('[CosmosDB] Getting latest statistics for period', { type, periodStartDate });

      const queryIterator = container.items.query<AlertStatisticsDocument>(
        { query, parameters },
        { maxItemCount: 1 }
      );

      const response = await queryIterator.fetchNext();
      const executionTime = Date.now() - startTime;

      const items = response.resources ?? [];

      this.logQueryTrace({
        query,
        parameters,
        requestCharge: response.requestCharge || 0,
        executionTime,
        itemCount: items.length
      });

      if (items.length > 0) {
        logger.info('[CosmosDB] Latest statistics found', {
          type,
          periodStartDate,
          id: items[0].id,
          generatedAt: items[0].generatedAt
        });
        return items[0];
      }

      logger.info('[CosmosDB] No statistics found for period', { type, periodStartDate });
      return null;
    } catch (error) {
      const executionTime = Date.now() - startTime;

      logger.error('[CosmosDB] Failed to get latest statistics', error as Error, {
        type,
        periodStartDate,
        executionTime: `${executionTime}ms`
      });

      throw new ServiceError('Failed to get latest statistics');
    }
  }

  /**
   * Get all historical statistics for a given type and period date
   * Returns all statistics documents ordered by generation time (newest first)
   */
  async getAllHistoricalForPeriod(
    type: StatisticsType,
    periodStartDate: string,
    options?: {
      pageSize?: number;
      continuationToken?: string;
    }
  ): Promise<StatisticsPaginatedResponse<AlertStatisticsDocument>> {
    const startTime = Date.now();

    try {
      const container = await this.getStatisticsContainer();
      const pageSize = Math.min(options?.pageSize || 50, 100);

      // NOTE: ORDER BY commented out due to missing composite index
      const query = 'SELECT * FROM c WHERE c.type = @type AND c.periodStartDate = @periodStartDate';
      const parameters = [
        { name: '@type', value: type },
        { name: '@periodStartDate', value: periodStartDate }
      ];

      logger.info('[CosmosDB] Getting all historical statistics for period', {
        type,
        periodStartDate,
        pageSize
      });

      const queryIterator = container.items.query<AlertStatisticsDocument>(
        { query, parameters },
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

      const items = response.resources ?? [];
      const itemCount = items.length;
      const hasMore = response.hasMoreResults ?? false;

      this.logQueryTrace({
        query,
        parameters,
        requestCharge: response.requestCharge || 0,
        executionTime,
        itemCount
      });

      logger.info('[CosmosDB] Historical statistics query completed', {
        type,
        periodStartDate,
        itemCount,
        hasMore,
        requestCharge: `${(response.requestCharge || 0).toFixed(2)} RU`,
        executionTime: `${executionTime}ms`
      });

      return {
        items,
        continuationToken: response.continuationToken,
        hasMore,
        count: itemCount
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      logger.error('[CosmosDB] Failed to get historical statistics', error as Error, {
        type,
        periodStartDate,
        executionTime: `${executionTime}ms`
      });

      throw new ServiceError('Failed to get historical statistics');
    }
  }
}

// Export singleton instance
export const alertStatisticsRepository = new AlertStatisticsRepository();
