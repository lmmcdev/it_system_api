/**
 * Azure Function: Search Alert Events
 * HTTP GET endpoint to search alert events using Azure Cognitive Search
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { searchService } from '../services/SearchService';
import { handleError, successResponse, ValidationError } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import { validateFunctionKey } from '../middleware/authentication';
import { checkRateLimit, createRateLimitResponse, RATE_LIMITS } from '../middleware/rateLimit';
import { validateFilterArray, validateSearchText } from '../utils/validator';
import { SearchQueryParams } from '../models/SearchModels';

async function searchAlerts(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    logger.setContext({
      functionName: context.functionName,
      invocationId: context.invocationId
    });

    logger.info('Processing search alerts request');

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

    // Rate limiting check
    const rateLimitResult = checkRateLimit(request, 'search', RATE_LIMITS.search);
    if (!rateLimitResult.allowed) {
      return createRateLimitResponse(rateLimitResult);
    }

    // Parse and validate search text
    const rawSearchText = request.query.get('q') || request.query.get('search');
    let searchText: string | undefined;

    if (rawSearchText) {
      try {
        searchText = validateSearchText(rawSearchText, 1, 200);
      } catch (error) {
        throw new ValidationError((error as Error).message);
      }
    }

    const top = request.query.get('top');
    const skip = request.query.get('skip');
    const select = request.query.get('select');
    const orderBy = request.query.get('orderBy');
    const searchMode = request.query.get('searchMode') as 'any' | 'all' | undefined;
    const highlight = request.query.get('highlight');
    const facets = request.query.get('facets');
    const useSemanticSearch = request.query.get('semantic') === 'true';

    // Parse filter parameters
    const severity = request.query.get('severity');
    const status = request.query.get('status');
    const category = request.query.get('category');
    const classification = request.query.get('classification');
    const productName = request.query.get('productName');
    const detectionSource = request.query.get('detectionSource');
    const serviceSource = request.query.get('serviceSource');
    const incidentId = request.query.get('incidentId');
    const tenantId = request.query.get('tenantId');
    const assignedTo = request.query.get('assignedTo');
    const createdDateStart = request.query.get('createdDateStart');
    const createdDateEnd = request.query.get('createdDateEnd');
    const resolvedDateStart = request.query.get('resolvedDateStart');
    const resolvedDateEnd = request.query.get('resolvedDateEnd');

    // Validate and parse pagination
    const topNum = top ? parseInt(top, 10) : undefined;
    const skipNum = skip ? parseInt(skip, 10) : undefined;

    if (top && isNaN(topNum!)) {
      throw new ValidationError('Parameter "top" must be a valid number');
    }

    if (skip && isNaN(skipNum!)) {
      throw new ValidationError('Parameter "skip" must be a valid number');
    }

    if (topNum && topNum > 100) {
      throw new ValidationError('Parameter "top" cannot exceed 100');
    }

    if (topNum && topNum < 1) {
      throw new ValidationError('Parameter "top" must be at least 1');
    }

    if (skipNum && skipNum < 0) {
      throw new ValidationError('Parameter "skip" must be non-negative');
    }

    // Validate and parse incidentId
    const incidentIdNum = incidentId ? parseInt(incidentId, 10) : undefined;
    if (incidentId && isNaN(incidentIdNum!)) {
      throw new ValidationError('Parameter "incidentId" must be a valid number');
    }

    // Build search query parameters
    const queryParams: SearchQueryParams = {
      searchText: searchText || undefined,
      top: topNum,
      skip: skipNum,
      select: select ? select.split(',').map(s => s.trim()) : undefined,
      orderBy: orderBy ? orderBy.split(',').map(o => o.trim()) : undefined,
      searchMode,
      highlight: highlight ? highlight.split(',').map(h => h.trim()) : undefined,
      facets: facets ? facets.split(',').map(f => f.trim()) : undefined,
      useSemanticSearch
    };

    // Validate and build filter object with enhanced validation
    try {
      const severityValues = ['informational', 'low', 'medium', 'high', 'critical'];
      const statusValues = ['new', 'inProgress', 'resolved'];
      const categoryValues = [
        'InitialAccess', 'Execution', 'Persistence', 'PrivilegeEscalation',
        'DefenseEvasion', 'CredentialAccess', 'Discovery', 'LateralMovement',
        'Collection', 'Exfiltration', 'CommandAndControl', 'Impact'
      ];

      if (
        severity ||
        status ||
        category ||
        classification ||
        productName ||
        detectionSource ||
        serviceSource ||
        incidentId ||
        tenantId ||
        assignedTo ||
        createdDateStart ||
        createdDateEnd ||
        resolvedDateStart ||
        resolvedDateEnd
      ) {
        queryParams.filter = {
          severity: validateFilterArray(severity, 'severity', severityValues),
          status: validateFilterArray(status, 'status', statusValues),
          category: validateFilterArray(category, 'category', categoryValues),
          classification: validateFilterArray(classification, 'classification', undefined, 5),
          productName: validateFilterArray(productName, 'productName', undefined, 10, 100),
          detectionSource: validateFilterArray(detectionSource, 'detectionSource', undefined, 10, 100),
          serviceSource: validateFilterArray(serviceSource, 'serviceSource', undefined, 10, 100),
          incidentId: incidentIdNum,
          tenantId: tenantId || undefined,
          assignedTo: assignedTo || undefined,
          createdDateStart: createdDateStart || undefined,
          createdDateEnd: createdDateEnd || undefined,
          resolvedDateStart: resolvedDateStart || undefined,
          resolvedDateEnd: resolvedDateEnd || undefined
        };
      }
    } catch (error) {
      throw new ValidationError((error as Error).message);
    }

    logger.info('Request validation successful', { queryParams });

    // Execute search
    const searchResults = await searchService.searchAlerts(queryParams);

    logger.info('Search completed successfully', {
      resultCount: searchResults.count,
      totalCount: searchResults.totalCount
    });

    return successResponse({
      results: searchResults.results,
      count: searchResults.count,
      totalCount: searchResults.totalCount,
      facets: searchResults.facets,
      pagination: {
        top: topNum || 50,
        skip: skipNum || 0
      }
    });
  } catch (error) {
    return handleError(error, context, request);
  } finally {
    logger.clearContext();
  }
}

app.http('searchAlerts', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'search/alerts',
  handler: searchAlerts
});
