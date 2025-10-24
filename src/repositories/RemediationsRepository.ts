/**
 * Remediations Repository
 * Data access layer for Atera Tickets (atera_tickets container)
 *
 * Responsibilities:
 * - CosmosDB queries for IT incident tickets
 * - Data transformation and mapping
 * - Error handling with proper logging
 * - Pagination support
 */

import { CosmosClient, Container, Database, FeedResponse } from '@azure/cosmos';
import { config } from '../config/environment';
import { logger } from '../utils/logger';
import { ServiceError } from '../utils/errorHandler';

/**
 * Atera Ticket Document Interface
 */
export interface AteraTicketDocument {
  id: string;
  doc_type: string;
  Ticket_ID: string;
  Ticket_impact?: string;
  Ticket_number?: string;
  Activity_status?: string;
  Ticket_priority?: string;
  Ticket_resolved_Date?: string;
  Ticket_resolved_Time?: string;
  Ticket_source?: string;
  Ticket_title?: string;
  Ticket_type?: string;
  Closed_Ticket_Date_Include_Total_Active_Time_Hour?: string;
  Product_Family?: string;
  Total_Active_Time_In_Hours?: string;
  Total_Active_Time_In_Minutes?: string;
  Ticket_created_Time?: string;
  Closed_ticket_final_due_Time?: string;
  Public_IP_address?: string;
  End_User_email?: string;
  Technician_email?: string;
  Site_name?: string;
  comments?: Array<{
    Date: string;
    Comment: string;
    CommentHtml?: string;
    EndUserID?: number | null;
    TechnicianContactID?: number | null;
    Email: string;
    FirstName: string;
    LastName: string;
    IsInternal: boolean;
  }>;
  comments_metadata?: {
    totalItemCount: number;
    page: number;
    itemsInPage: number;
    totalPages: number;
  };
  Working_Hours?: Array<{
    TicketID: number;
    WorkHoursID: number;
    StartWorkHour: string;
    EndWorkHour: string;
    TechnicianContactID: number;
    Billiable: boolean;
    OnCustomerSite: boolean;
    TechnicianFullName: string;
    TechnicianEmail: string;
    RateID: number;
    RateAmount: number;
  }>;
  last_updated?: string;
  _rid?: string;
  _self?: string;
  _etag?: string;
  _attachments?: string;
  _ts?: number;
}

/**
 * Ticket Search Filters Interface
 * Supports flexible search criteria for Atera tickets
 */
export interface TicketSearchFilters {
  ticketId?: string;           // Exact match on Ticket_ID
  title?: string;              // Case-insensitive CONTAINS on Ticket_title
  priority?: string;           // Exact match on Ticket_priority
  type?: string;               // Exact match on Ticket_type
  status?: string;             // Exact match on Activity_status
  source?: string;             // Exact match on Ticket_source
  productFamily?: string;      // Case-insensitive CONTAINS on Product_Family
  siteName?: string;           // Case-insensitive CONTAINS on Site_name
  technicianEmail?: string;    // Exact match on Technician_email
  endUserEmail?: string;       // Exact match on End_User_email
  createdFrom?: string;        // Ticket_created_Time >= date
  createdTo?: string;          // Ticket_created_Time <= date
}

/**
 * Remediations Repository Class
 */
export class RemediationsRepository {
  private client: CosmosClient;
  private database: Database | null = null;
  private container: Container | null = null;
  private isInitialized: boolean = false;
  private readonly QUERY_TIMEOUT_MS = 30000; // 30 seconds timeout

  constructor() {
    this.client = new CosmosClient({
      endpoint: config.cosmos.endpoint,
      key: config.cosmos.key
    });
  }

  /**
   * Initialize database and container connections
   */
  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.database = this.client.database(config.cosmos.databaseId);
      this.container = this.database.container(config.cosmos.remediationsContainerId);
      this.isInitialized = true;

      logger.info('[RemediationsRepository] Initialized successfully', {
        database: config.cosmos.databaseId,
        container: config.cosmos.remediationsContainerId
      });
    } catch (error) {
      logger.error('[RemediationsRepository] Initialization failed', error as Error);
      throw new ServiceError('Failed to initialize remediations repository');
    }
  }

  /**
   * Create timeout promise for query operations
   */
  private createTimeoutPromise(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new ServiceError(`Query timeout after ${ms}ms`));
      }, ms);
    });
  }

  /**
   * Log query trace with execution details
   */
  private logQueryTrace(params: {
    query: string;
    parameters?: Array<{ name: string; value: unknown }>;
    requestCharge: number;
    executionTime: number;
    itemCount: number;
  }): void {
    logger.info('[CosmosDB Query Trace]', {
      query: params.query,
      parameters: params.parameters,
      requestCharge: `${params.requestCharge.toFixed(2)} RU`,
      executionTime: `${params.executionTime}ms`,
      itemCount: params.itemCount
    });
  }

  /**
   * Get ticket by document ID (direct read - fastest method)
   *
   * @param id - Document ID (same as partition key)
   * @returns Ticket document or null if not found
   */
  async getById(id: string): Promise<AteraTicketDocument | null> {
    const startTime = Date.now();

    try {
      await this.ensureInitialized();

      if (!this.container) {
        throw new ServiceError('Container not initialized');
      }

      logger.info('[RemediationsRepository] Getting ticket by ID', { id });

      // Direct point read (uses id as partition key)
      const response = await this.container.item(id, id).read<AteraTicketDocument>();

      const executionTime = Date.now() - startTime;

      if (response.resource) {
        logger.info('[RemediationsRepository] Ticket found by ID', {
          id,
          ticketId: response.resource.Ticket_ID,
          requestCharge: `${(response.requestCharge || 0).toFixed(2)} RU`,
          executionTime: `${executionTime}ms`
        });

        return response.resource;
      }

      logger.info('[RemediationsRepository] Ticket not found by ID', {
        id,
        executionTime: `${executionTime}ms`
      });

      return null;

    } catch (error: unknown) {
      const executionTime = Date.now() - startTime;

      // Handle 404 Not Found
      if ((error as { code?: number }).code === 404) {
        logger.info('[RemediationsRepository] Ticket not found (404)', {
          id,
          executionTime: `${executionTime}ms`
        });
        return null;
      }

      logger.error('[RemediationsRepository] Failed to get ticket by ID', error as Error, {
        id,
        errorCode: (error as { code?: number }).code,
        executionTime: `${executionTime}ms`
      });

      throw new ServiceError('Failed to get ticket by ID');
    }
  }

  /**
   * Search ticket by Ticket_ID field (query-based search)
   * Use this when you have the Ticket_ID but not the document id
   *
   * @param ticketId - Ticket_ID value to search for
   * @returns Ticket document or null if not found
   */
  async searchByTicketId(ticketId: string): Promise<AteraTicketDocument | null> {
    const startTime = Date.now();

    try {
      await this.ensureInitialized();

      if (!this.container) {
        throw new ServiceError('Container not initialized');
      }

      logger.info('[RemediationsRepository] Searching ticket by Ticket_ID', { ticketId });

      const query = 'SELECT * FROM c WHERE c.Ticket_ID = @ticketId';
      const parameters = [{ name: '@ticketId', value: ticketId }];

      // NOTE: ORDER BY removed - CosmosDB provides continuation tokens without explicit ordering
      // If you need specific ordering, create a composite index in Azure Portal first

      logger.info(`QUERY EXE: ${query}`);

      const querySpec = {
        query,
        parameters
      };

      const operation = async () => {
        return this.container!.items
          .query<AteraTicketDocument>(querySpec)
          .fetchAll();
      };

      const response = await Promise.race([
        operation(),
        this.createTimeoutPromise(this.QUERY_TIMEOUT_MS)
      ]);

      const executionTime = Date.now() - startTime;

      this.logQueryTrace({
        query,
        parameters,
        requestCharge: response.requestCharge || 0,
        executionTime,
        itemCount: response.resources.length
      });

      if (response.resources.length > 0) {
        logger.info('[RemediationsRepository] Ticket found by Ticket_ID', {
          ticketId,
          documentId: response.resources[0].id,
          count: response.resources.length,
          executionTime: `${executionTime}ms`
        });

        // Return first match (Ticket_ID should be unique)
        return response.resources[0];
      }

      logger.info('[RemediationsRepository] Ticket not found by Ticket_ID', {
        ticketId,
        executionTime: `${executionTime}ms`
      });

      return null;

    } catch (error) {
      const executionTime = Date.now() - startTime;

      logger.error('[RemediationsRepository] Failed to search ticket by Ticket_ID', error as Error, {
        ticketId,
        errorCode: (error as { code?: number }).code,
        executionTime: `${executionTime}ms`
      });

      throw new ServiceError('Failed to search ticket by Ticket_ID');
    }
  }

  /**
   * Get all tickets with pagination support
   *
   * @param pageSize - Number of items per page (default 50, max 100)
   * @param continuationToken - Token for pagination
   * @returns Paginated tickets with continuation token
   */
  async getAll(
    pageSize: number = 50,
    continuationToken?: string
  ): Promise<{
    tickets: AteraTicketDocument[];
    hasMore: boolean;
    continuationToken?: string;
    count: number;
    ruConsumed: number;
  }> {
    const startTime = Date.now();

    try {
      await this.ensureInitialized();

      if (!this.container) {
        throw new ServiceError('Container not initialized');
      }

      logger.info('[RemediationsRepository] Getting all tickets', {
        pageSize,
        hasContinuationToken: !!continuationToken
      });

      const query = 'SELECT * FROM c';

      // NOTE: ORDER BY removed - CosmosDB provides continuation tokens without explicit ordering
      // If you need specific ordering, create a composite index in Azure Portal first

      logger.info(`QUERY EXE: ${query}`);

      const querySpec = { query };

      const operation = async () => {
        return this.container!.items
          .query<AteraTicketDocument>(querySpec, {
            maxItemCount: pageSize,
            continuationToken
          })
          .fetchNext();
      };

      const response: FeedResponse<AteraTicketDocument> = await Promise.race([
        operation(),
        this.createTimeoutPromise(this.QUERY_TIMEOUT_MS)
      ]);

      const executionTime = Date.now() - startTime;
      const ruConsumed = response.requestCharge || 0;

      this.logQueryTrace({
        query,
        requestCharge: ruConsumed,
        executionTime,
        itemCount: response.resources.length
      });

      logger.info('[RemediationsRepository] Tickets query completed', {
        count: response.resources.length,
        hasMore: response.hasMoreResults,
        hasContinuationToken: !!response.continuationToken,
        continuationTokenLength: response.continuationToken?.length || 0,
        ruConsumed: `${ruConsumed.toFixed(2)} RU`,
        executionTime: `${executionTime}ms`
      });

      // Debug: Log warning if hasMore but no continuation token
      if (response.hasMoreResults && !response.continuationToken) {
        logger.warn('[CosmosDB] WARNING: hasMoreResults=true but no continuationToken returned!', {
          query,
          pageSize,
          itemCount: response.resources.length
        });
      }

      return {
        tickets: response.resources,
        hasMore: response.hasMoreResults,
        continuationToken: response.continuationToken,
        count: response.resources.length,
        ruConsumed
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;

      logger.error('[RemediationsRepository] Failed to get all tickets', error as Error, {
        pageSize,
        errorCode: (error as { code?: number }).code,
        executionTime: `${executionTime}ms`
      });

      throw new ServiceError('Failed to get all tickets');
    }
  }

  /**
   * Get tickets by doc_type with pagination
   *
   * @param docType - Document type filter (e.g., "it_incident")
   * @param pageSize - Number of items per page
   * @param continuationToken - Token for pagination
   * @returns Paginated tickets filtered by doc_type
   */
  async getByDocType(
    docType: string,
    pageSize: number = 50,
    continuationToken?: string
  ): Promise<{
    tickets: AteraTicketDocument[];
    hasMore: boolean;
    continuationToken?: string;
    count: number;
    ruConsumed: number;
  }> {
    const startTime = Date.now();

    try {
      await this.ensureInitialized();

      if (!this.container) {
        throw new ServiceError('Container not initialized');
      }

      logger.info('[RemediationsRepository] Getting tickets by doc_type', {
        docType,
        pageSize,
        hasContinuationToken: !!continuationToken
      });

      const query = 'SELECT * FROM c WHERE c.doc_type = @docType';
      const parameters = [{ name: '@docType', value: docType }];

      // NOTE: ORDER BY removed - CosmosDB provides continuation tokens without explicit ordering
      // If you need specific ordering, create a composite index in Azure Portal first

      logger.info(`QUERY EXE: ${query}`);

      const querySpec = {
        query,
        parameters
      };

      const operation = async () => {
        return this.container!.items
          .query<AteraTicketDocument>(querySpec, {
            maxItemCount: pageSize,
            continuationToken
          })
          .fetchNext();
      };

      const response: FeedResponse<AteraTicketDocument> = await Promise.race([
        operation(),
        this.createTimeoutPromise(this.QUERY_TIMEOUT_MS)
      ]);

      const executionTime = Date.now() - startTime;
      const ruConsumed = response.requestCharge || 0;

      this.logQueryTrace({
        query,
        parameters,
        requestCharge: ruConsumed,
        executionTime,
        itemCount: response.resources.length
      });

      logger.info('[RemediationsRepository] Tickets by doc_type query completed', {
        docType,
        count: response.resources.length,
        hasMore: response.hasMoreResults,
        hasContinuationToken: !!response.continuationToken,
        continuationTokenLength: response.continuationToken?.length || 0,
        ruConsumed: `${ruConsumed.toFixed(2)} RU`,
        executionTime: `${executionTime}ms`
      });

      // Debug: Log warning if hasMore but no continuation token
      if (response.hasMoreResults && !response.continuationToken) {
        logger.warn('[CosmosDB] WARNING: hasMoreResults=true but no continuationToken returned!', {
          query,
          pageSize,
          docType,
          itemCount: response.resources.length
        });
      }

      return {
        tickets: response.resources,
        hasMore: response.hasMoreResults,
        continuationToken: response.continuationToken,
        count: response.resources.length,
        ruConsumed
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;

      logger.error('[RemediationsRepository] Failed to get tickets by doc_type', error as Error, {
        docType,
        pageSize,
        errorCode: (error as { code?: number }).code,
        executionTime: `${executionTime}ms`
      });

      throw new ServiceError('Failed to get tickets by doc_type');
    }
  }

  /**
   * Search tickets with flexible filters
   * Supports multiple search criteria with case-insensitive text matching
   *
   * @param filters - Search filter criteria
   * @param pageSize - Number of items per page
   * @param continuationToken - Token for pagination
   * @returns Paginated tickets matching the filters
   */
  async searchTickets(
    filters: TicketSearchFilters,
    pageSize: number = 50,
    continuationToken?: string
  ): Promise<{
    tickets: AteraTicketDocument[];
    hasMore: boolean;
    continuationToken?: string;
    count: number;
    ruConsumed: number;
  }> {
    const startTime = Date.now();

    try {
      await this.ensureInitialized();

      if (!this.container) {
        throw new ServiceError('Container not initialized');
      }

      logger.info('[RemediationsRepository] Searching tickets with filters', {
        filters,
        pageSize,
        hasContinuationToken: !!continuationToken
      });

      // Build query dynamically based on provided filters
      const whereClauses: string[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parameters: Array<{ name: string; value: any }> = [];

      // Exact match filters
      if (filters.ticketId) {
        whereClauses.push('c.Ticket_ID = @ticketId');
        parameters.push({ name: '@ticketId', value: filters.ticketId });
      }

      if (filters.priority) {
        whereClauses.push('c.Ticket_priority = @priority');
        parameters.push({ name: '@priority', value: filters.priority });
      }

      if (filters.type) {
        whereClauses.push('c.Ticket_type = @type');
        parameters.push({ name: '@type', value: filters.type });
      }

      if (filters.status) {
        whereClauses.push('c.Activity_status = @status');
        parameters.push({ name: '@status', value: filters.status });
      }

      if (filters.source) {
        whereClauses.push('c.Ticket_source = @source');
        parameters.push({ name: '@source', value: filters.source });
      }

      if (filters.technicianEmail) {
        whereClauses.push('c.Technician_email = @technicianEmail');
        parameters.push({ name: '@technicianEmail', value: filters.technicianEmail });
      }

      if (filters.endUserEmail) {
        whereClauses.push('c.End_User_email = @endUserEmail');
        parameters.push({ name: '@endUserEmail', value: filters.endUserEmail });
      }

      // Case-insensitive CONTAINS filters using UPPER()
      if (filters.title) {
        whereClauses.push('CONTAINS(UPPER(c.Ticket_title), @title)');
        parameters.push({ name: '@title', value: filters.title.toUpperCase() });
      }

      if (filters.productFamily) {
        whereClauses.push('CONTAINS(UPPER(c.Product_Family), @productFamily)');
        parameters.push({ name: '@productFamily', value: filters.productFamily.toUpperCase() });
      }

      if (filters.siteName) {
        whereClauses.push('CONTAINS(UPPER(c.Site_name), @siteName)');
        parameters.push({ name: '@siteName', value: filters.siteName.toUpperCase() });
      }

      // Date range filters
      if (filters.createdFrom) {
        whereClauses.push('c.Ticket_created_Time >= @createdFrom');
        parameters.push({ name: '@createdFrom', value: filters.createdFrom });
      }

      if (filters.createdTo) {
        whereClauses.push('c.Ticket_created_Time <= @createdTo');
        parameters.push({ name: '@createdTo', value: filters.createdTo });
      }

      // Ensure at least one filter is provided
      if (whereClauses.length === 0) {
        throw new ServiceError('At least one search filter is required');
      }

      // Build complete query with AND logic
      const query = `SELECT * FROM c WHERE ${whereClauses.join(' AND ')}`;

      // NOTE: ORDER BY removed - CosmosDB provides continuation tokens without explicit ordering
      // If you need specific ordering, create a composite index in Azure Portal first

      logger.info(`QUERY EXE: ${query}`);

      const querySpec = {
        query,
        parameters
      };

      const operation = async () => {
        return this.container!.items
          .query<AteraTicketDocument>(querySpec, {
            maxItemCount: pageSize,
            continuationToken
          })
          .fetchNext();
      };

      const response: FeedResponse<AteraTicketDocument> = await Promise.race([
        operation(),
        this.createTimeoutPromise(this.QUERY_TIMEOUT_MS)
      ]);

      const executionTime = Date.now() - startTime;
      const ruConsumed = response.requestCharge || 0;

      this.logQueryTrace({
        query,
        parameters,
        requestCharge: ruConsumed,
        executionTime,
        itemCount: response.resources.length
      });

      logger.info('[RemediationsRepository] Ticket search completed', {
        count: response.resources.length,
        hasMore: response.hasMoreResults,
        hasContinuationToken: !!response.continuationToken,
        continuationTokenLength: response.continuationToken?.length || 0,
        ruConsumed: `${ruConsumed.toFixed(2)} RU`,
        executionTime: `${executionTime}ms`
      });

      // Debug: Log warning if hasMore but no continuation token
      if (response.hasMoreResults && !response.continuationToken) {
        logger.warn('[CosmosDB] WARNING: hasMoreResults=true but no continuationToken returned!', {
          query,
          pageSize,
          itemCount: response.resources.length
        });
      }

      return {
        tickets: response.resources,
        hasMore: response.hasMoreResults,
        continuationToken: response.continuationToken,
        count: response.resources.length,
        ruConsumed
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;

      logger.error('[RemediationsRepository] Failed to search tickets', error as Error, {
        filters,
        pageSize,
        errorCode: (error as { code?: number }).code,
        executionTime: `${executionTime}ms`
      });

      throw new ServiceError('Failed to search tickets');
    }
  }
}

// Export singleton instance
export const remediationsRepository = new RemediationsRepository();
