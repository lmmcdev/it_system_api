/**
 * Search service layer
 * Contains business logic for Alert Event search operations
 */

import { SearchQueryParams, SearchResponse, SuggestionResponse } from '../models/SearchModels';
import { searchRepository } from '../repositories/SearchRepository';
import { logger } from '../utils/logger';

export class SearchService {
  /**
   * Search alert events with full-text search and filters
   */
  async searchAlerts(params: SearchQueryParams): Promise<SearchResponse> {
    logger.info('Service: Searching alerts', { params });

    const response = await searchRepository.search(params);

    logger.info('Service: Search completed', {
      resultCount: response.count,
      totalCount: response.totalCount
    });

    return response;
  }

  /**
   * Get search suggestions
   */
  async getSuggestions(searchText: string, top: number = 5): Promise<SuggestionResponse> {
    logger.info('Service: Getting suggestions', { searchText, top });

    const response = await searchRepository.suggest(searchText, top);

    logger.info('Service: Suggestions retrieved', { count: response.count });

    return response;
  }

  /**
   * Get autocomplete suggestions
   */
  async getAutocomplete(searchText: string, top: number = 5): Promise<string[]> {
    logger.info('Service: Getting autocomplete', { searchText, top });

    const suggestions = await searchRepository.autocomplete(searchText, 'sg', top);

    logger.info('Service: Autocomplete retrieved', { count: suggestions.length });

    return suggestions;
  }
}

// Export singleton instance
export const searchService = new SearchService();
