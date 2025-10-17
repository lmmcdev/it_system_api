/**
 * Azure Cognitive Search repository for Alert Event searches
 * Handles all search operations with proper error handling, filtering, and query tracing
 */

import {
  SearchClient,
  AzureKeyCredential,
  SearchOptions,
  AutocompleteOptions,
  SuggestOptions
} from '@azure/search-documents';
import {
  AlertSearchDocument,
  SearchQueryParams,
  SearchResponse,
  SuggestionResponse,
  AVAILABLE_SEARCH_FIELDS,
  AVAILABLE_FACET_FIELDS,
  AVAILABLE_SORT_FIELDS
} from '../models/SearchModels';
import { config } from '../config/environment';
import { logger } from '../utils/logger';
import { ServiceError, ValidationError } from '../utils/errorHandler';

/**
 * Query trace information for logging
 */
interface SearchQueryTrace {
  searchText: string;
  filter?: string;
  select?: string[];
  orderBy?: string[];
  top: number;
  skip: number;
  executionTime: number;
  resultCount: number;
  totalCount?: number;
}

export class SearchRepository {
  private client: SearchClient<AlertSearchDocument>;

  constructor() {
    this.client = new SearchClient<AlertSearchDocument>(
      config.search.endpoint,
      config.search.indexName,
      new AzureKeyCredential(config.search.apiKey)
    );

    logger.info('[Azure Search] Repository initialized', {
      endpoint: config.search.endpoint,
      indexName: config.search.indexName
    });
  }

  /**
   * Log search query trace
   */
  private logSearchTrace(trace: SearchQueryTrace): void {
    logger.info('[Azure Search Query Trace]', {
      searchText: trace.searchText,
      filter: trace.filter,
      select: trace.select,
      orderBy: trace.orderBy,
      pagination: { top: trace.top, skip: trace.skip },
      executionTime: `${trace.executionTime}ms`,
      resultCount: trace.resultCount,
      totalCount: trace.totalCount,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Build OData filter string from filter object
   */
  private buildFilterString(filter?: SearchQueryParams['filter']): string | undefined {
    if (!filter) {
      return undefined;
    }

    const conditions: string[] = [];

    // Array filters (OR within same field, AND across fields)
    if (filter.severity && filter.severity.length > 0) {
      const orConditions = filter.severity.map(s => `severity eq '${this.escapeOData(s)}'`).join(' or ');
      conditions.push(`(${orConditions})`);
    }

    if (filter.status && filter.status.length > 0) {
      const orConditions = filter.status.map(s => `status eq '${this.escapeOData(s)}'`).join(' or ');
      conditions.push(`(${orConditions})`);
    }

    if (filter.category && filter.category.length > 0) {
      const orConditions = filter.category.map(c => `category eq '${this.escapeOData(c)}'`).join(' or ');
      conditions.push(`(${orConditions})`);
    }

    if (filter.classification && filter.classification.length > 0) {
      const orConditions = filter.classification.map(c => `classification eq '${this.escapeOData(c)}'`).join(' or ');
      conditions.push(`(${orConditions})`);
    }

    if (filter.productName && filter.productName.length > 0) {
      const orConditions = filter.productName.map(p => `productName eq '${this.escapeOData(p)}'`).join(' or ');
      conditions.push(`(${orConditions})`);
    }

    if (filter.detectionSource && filter.detectionSource.length > 0) {
      const orConditions = filter.detectionSource.map(d => `detectionSource eq '${this.escapeOData(d)}'`).join(' or ');
      conditions.push(`(${orConditions})`);
    }

    if (filter.serviceSource && filter.serviceSource.length > 0) {
      const orConditions = filter.serviceSource.map(s => `serviceSource eq '${this.escapeOData(s)}'`).join(' or ');
      conditions.push(`(${orConditions})`);
    }

    // Single value filters
    if (filter.incidentId !== undefined) {
      conditions.push(`incidentId eq ${filter.incidentId}`);
    }

    if (filter.tenantId) {
      conditions.push(`tenantId eq '${this.escapeOData(filter.tenantId)}'`);
    }

    if (filter.assignedTo) {
      conditions.push(`assignedTo eq '${this.escapeOData(filter.assignedTo)}'`);
    }

    // Date range filters
    if (filter.createdDateStart) {
      conditions.push(`createdDateTime ge ${filter.createdDateStart}`);
    }

    if (filter.createdDateEnd) {
      conditions.push(`createdDateTime le ${filter.createdDateEnd}`);
    }

    if (filter.resolvedDateStart) {
      conditions.push(`resolvedDateTime ge ${filter.resolvedDateStart}`);
    }

    if (filter.resolvedDateEnd) {
      conditions.push(`resolvedDateTime le ${filter.resolvedDateEnd}`);
    }

    return conditions.length > 0 ? conditions.join(' and ') : undefined;
  }

  /**
   * Escape single quotes in OData filter values
   */
  private escapeOData(value: string): string {
    return value.replace(/'/g, "''");
  }

  /**
   * Validate select fields
   */
  private validateSelectFields(fields: string[]): void {
    const invalidFields = fields.filter(f => !AVAILABLE_SEARCH_FIELDS.includes(f as any));
    if (invalidFields.length > 0) {
      throw new ValidationError(`Invalid select fields: ${invalidFields.join(', ')}`);
    }
  }

  /**
   * Validate orderBy fields
   */
  private validateOrderByFields(orderBy: string[]): void {
    for (const order of orderBy) {
      const field = order.replace(/ (asc|desc)$/i, '');
      if (!AVAILABLE_SORT_FIELDS.includes(field as any)) {
        throw new ValidationError(`Invalid orderBy field: ${field}`);
      }
    }
  }

  /**
   * Validate facet fields
   */
  private validateFacetFields(facets: string[]): void {
    const invalidFacets = facets.filter(f => {
      const facetField = f.split(',')[0]; // Remove facet options
      return !AVAILABLE_FACET_FIELDS.includes(facetField as any);
    });
    if (invalidFacets.length > 0) {
      throw new ValidationError(`Invalid facet fields: ${invalidFacets.join(', ')}`);
    }
  }

  /**
   * Search alerts with full-text search and filters
   */
  async search(params: SearchQueryParams): Promise<SearchResponse> {
    const startTime = Date.now();

    try {
      // Validate inputs
      if (params.select) {
        this.validateSelectFields(params.select);
      }

      if (params.orderBy) {
        this.validateOrderByFields(params.orderBy);
      }

      if (params.facets) {
        this.validateFacetFields(params.facets);
      }

      // Build search options
      const searchText = params.searchText || '*'; // Wildcard for all documents
      const top = Math.min(params.top || 50, 100); // Max 100 results per page
      const skip = params.skip || 0;

      const searchOptions: SearchOptions<AlertSearchDocument> = {
        filter: this.buildFilterString(params.filter),
        select: params.select as any, // Type assertion for field selection
        orderBy: params.orderBy as any, // Type assertion for ordering
        top: top,
        skip: skip,
        searchMode: params.searchMode || 'any',
        includeTotalCount: true,
        facets: params.facets as any, // Type assertion for facets
        queryType: params.useSemanticSearch ? 'full' : 'simple' // Full uses advanced features
      };

      // Add highlighting if requested
      if (params.highlight && params.highlight.length > 0) {
        searchOptions.highlightFields = params.highlight.join(',');
        searchOptions.highlightPreTag = '<mark>';
        searchOptions.highlightPostTag = '</mark>';
      }

      logger.info('[Azure Search] Executing search', {
        searchText,
        filter: searchOptions.filter,
        top,
        skip,
        useSemanticSearch: params.useSemanticSearch
      });

      // Execute search
      const searchResults = await this.client.search(searchText, searchOptions);

      // Collect results
      const results: AlertSearchDocument[] = [];
      let count = 0;
      let totalCount: number | undefined;

      for await (const result of searchResults.results) {
        results.push({
          ...result.document,
          '@search.score': result.score
        });
        count++;
      }

      // Get total count from response
      if (searchResults.count !== undefined) {
        totalCount = searchResults.count;
      }

      // Collect facets if requested
      let facets: Record<string, Array<{ value: string; count: number }>> | undefined;
      if (params.facets && searchResults.facets) {
        facets = {};
        for (const [facetName, facetResults] of Object.entries(searchResults.facets)) {
          facets[facetName] = facetResults.map(f => ({
            value: f.value?.toString() || '',
            count: f.count || 0
          }));
        }
      }

      const executionTime = Date.now() - startTime;

      // Log trace
      this.logSearchTrace({
        searchText,
        filter: searchOptions.filter,
        select: params.select,
        orderBy: params.orderBy,
        top,
        skip,
        executionTime,
        resultCount: count,
        totalCount
      });

      logger.info('[Azure Search] Search completed successfully', {
        resultCount: count,
        totalCount,
        executionTime: `${executionTime}ms`
      });

      return {
        results,
        count,
        totalCount,
        facets
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      if (error instanceof ValidationError) {
        throw error;
      }

      logger.error('[Azure Search] Search failed', error as Error, {
        searchText: params.searchText,
        executionTime: `${executionTime}ms`
      });

      throw new ServiceError('Failed to execute search query');
    }
  }

  /**
   * Get search suggestions using the suggester
   */
  async suggest(searchText: string, top: number = 5): Promise<SuggestionResponse> {
    const startTime = Date.now();

    try {
      logger.info('[Azure Search] Getting suggestions', { searchText, top });

      const suggestOptions: SuggestOptions<AlertSearchDocument> = {
        top: Math.min(top, 20), // Max 20 suggestions
        select: ['id', 'title', 'category', 'severity', 'status'] as any
      };

      const suggestResults = await this.client.suggest(searchText, 'sg', suggestOptions);

      const suggestions = suggestResults.results.map(result => ({
        text: result.text,
        document: result.document as AlertSearchDocument
      }));

      const executionTime = Date.now() - startTime;

      logger.info('[Azure Search] Suggestions retrieved', {
        count: suggestions.length,
        executionTime: `${executionTime}ms`
      });

      return {
        suggestions,
        count: suggestions.length
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      logger.error('[Azure Search] Suggestions failed', error as Error, {
        searchText,
        executionTime: `${executionTime}ms`
      });

      throw new ServiceError('Failed to get suggestions');
    }
  }

  /**
   * Get autocomplete suggestions
   */
  async autocomplete(searchText: string, suggesterName: string = 'sg', top: number = 5): Promise<string[]> {
    const startTime = Date.now();

    try {
      logger.info('[Azure Search] Getting autocomplete', { searchText, top });

      const autocompleteOptions: AutocompleteOptions<AlertSearchDocument> = {
        autocompleteMode: 'twoTerms',
        top: Math.min(top, 20) // Max 20 suggestions
      };

      const autocompleteResults = await this.client.autocomplete(searchText, suggesterName, autocompleteOptions);

      const suggestions = autocompleteResults.results.map(result => result.text);

      const executionTime = Date.now() - startTime;

      logger.info('[Azure Search] Autocomplete retrieved', {
        count: suggestions.length,
        executionTime: `${executionTime}ms`
      });

      return suggestions;
    } catch (error) {
      const executionTime = Date.now() - startTime;

      logger.error('[Azure Search] Autocomplete failed', error as Error, {
        searchText,
        executionTime: `${executionTime}ms`
      });

      throw new ServiceError('Failed to get autocomplete suggestions');
    }
  }
}

// Export singleton instance
export const searchRepository = new SearchRepository();
