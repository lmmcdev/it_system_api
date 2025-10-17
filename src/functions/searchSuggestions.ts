/**
 * Azure Function: Search Suggestions
 * HTTP GET endpoint to get search suggestions for alert events
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { searchService } from '../services/SearchService';
import { handleError, successResponse, ValidationError } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import { validateFunctionKey } from '../middleware/authentication';

async function searchSuggestions(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    logger.setContext({
      functionName: context.functionName,
      invocationId: context.invocationId
    });

    logger.info('Processing search suggestions request');

    // Authentication check
    const authResult = validateFunctionKey(request);
    if (!authResult.authenticated) {
      logger.warn('Authentication failed', { error: authResult.error });
      return {
        status: 401,
        jsonBody: {
          success: false,
          error: {
            code: 'AUTHENTICATION_FAILED',
            message: authResult.error || 'Authentication required'
          },
          timestamp: new Date().toISOString()
        },
        headers: {
          'Content-Type': 'application/json',
          'WWW-Authenticate': 'FunctionKey'
        }
      };
    }

    logger.info('Authentication successful', { userId: authResult.userId });

    // Get query parameters
    const searchText = request.query.get('q') || request.query.get('search');
    const top = request.query.get('top');
    const mode = request.query.get('mode'); // 'suggest' or 'autocomplete'

    // Validate search text
    if (!searchText) {
      throw new ValidationError('Search text is required. Use "q" or "search" query parameter.');
    }

    if (searchText.length < 2) {
      throw new ValidationError('Search text must be at least 2 characters long.');
    }

    if (searchText.length > 100) {
      throw new ValidationError('Search text cannot exceed 100 characters.');
    }

    // Validate and parse top parameter
    const topNum = top ? parseInt(top, 10) : 5;
    if (top && isNaN(topNum)) {
      throw new ValidationError('Parameter "top" must be a valid number');
    }

    if (topNum > 20) {
      throw new ValidationError('Parameter "top" cannot exceed 20 for suggestions');
    }

    if (topNum < 1) {
      throw new ValidationError('Parameter "top" must be at least 1');
    }

    logger.info('Request validation successful', { searchText, top: topNum, mode });

    // Get suggestions based on mode
    if (mode === 'autocomplete') {
      const autocompleteResults = await searchService.getAutocomplete(searchText, topNum);

      logger.info('Autocomplete completed successfully', {
        count: autocompleteResults.length
      });

      return successResponse({
        suggestions: autocompleteResults,
        count: autocompleteResults.length,
        mode: 'autocomplete'
      });
    } else {
      // Default to suggest mode
      const suggestionResults = await searchService.getSuggestions(searchText, topNum);

      logger.info('Suggestions completed successfully', {
        count: suggestionResults.count
      });

      return successResponse({
        suggestions: suggestionResults.suggestions,
        count: suggestionResults.count,
        mode: 'suggest'
      });
    }
  } catch (error) {
    return handleError(error, context, request);
  } finally {
    logger.clearContext();
  }
}

app.http('searchSuggestions', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'search/suggestions',
  handler: searchSuggestions
});
