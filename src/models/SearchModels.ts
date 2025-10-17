/**
 * Azure Cognitive Search models for Alert Events
 * Represents the indexed alert data structure
 */

/**
 * Alert search document (matches Azure Search index structure)
 */
export interface AlertSearchDocument {
  // Key field
  id: string;

  // Core alert fields
  category: string;
  title: string;
  description: string;
  productName: string;
  severity: string;
  status: string;
  classification: string | null;

  // Date fields
  createdDateTime: string;
  lastUpdateDateTime: string;
  firstActivityDateTime: string | null;
  lastActivityDateTime: string | null;
  resolvedDateTime: string | null;

  // Additional fields
  recommendedActions: string;
  incidentId: number | null;
  providerAlertId: string;
  detectionSource: string;
  detectorId: string;
  serviceSource: string;
  alertWebUrl: string;
  incidentWebUrl: string;
  assignedTo: string | null;
  tenantId: string;

  // Collection fields
  mitreTechniques: string[];
  systemTags: string[];
  userAccountNames: string[];
  userPrincipalNames: string[];
  userDisplayNames: string[];
  azureAdUserIds: string[];
  ipAddresses: string[];
  countryCodes: string[];
  cities: string[];
  states: string[];
  userAgents: string[];
  sessionIds: string[];
  requestIds: string[];
  verdicts: string[];
  deviceDnsNames: string[];
  deviceIds: string[];

  // Search score
  '@search.score'?: number;
}

/**
 * Search query parameters
 */
export interface SearchQueryParams {
  // Search text (supports OData full-text search)
  searchText?: string;

  // Filters (OData filter syntax)
  filter?: {
    severity?: string[];
    status?: string[];
    category?: string[];
    classification?: string[];
    productName?: string[];
    detectionSource?: string[];
    serviceSource?: string[];
    incidentId?: number;
    tenantId?: string;
    assignedTo?: string;
    createdDateStart?: string;
    createdDateEnd?: string;
    resolvedDateStart?: string;
    resolvedDateEnd?: string;
  };

  // Field selection (select specific fields to return)
  select?: string[];

  // Ordering
  orderBy?: string[];

  // Pagination
  top?: number;
  skip?: number;

  // Search mode
  searchMode?: 'any' | 'all';

  // Highlighting
  highlight?: string[];

  // Facets
  facets?: string[];

  // Semantic search
  useSemanticSearch?: boolean;

  // Suggestions
  suggestionMode?: boolean;
}

/**
 * Search response with pagination
 */
export interface SearchResponse {
  results: AlertSearchDocument[];
  count: number;
  totalCount?: number;
  facets?: Record<string, Array<{ value: string; count: number }>>;
  '@odata.nextLink'?: string;
}

/**
 * Suggestion response
 */
export interface SuggestionResponse {
  suggestions: Array<{
    text: string;
    document: AlertSearchDocument;
  }>;
  count: number;
}

/**
 * Available fields for selection
 */
export const AVAILABLE_SEARCH_FIELDS = [
  'id',
  'category',
  'title',
  'description',
  'productName',
  'severity',
  'status',
  'classification',
  'createdDateTime',
  'lastUpdateDateTime',
  'firstActivityDateTime',
  'lastActivityDateTime',
  'resolvedDateTime',
  'recommendedActions',
  'incidentId',
  'providerAlertId',
  'detectionSource',
  'detectorId',
  'serviceSource',
  'alertWebUrl',
  'incidentWebUrl',
  'assignedTo',
  'tenantId',
  'mitreTechniques',
  'systemTags',
  'userAccountNames',
  'userPrincipalNames',
  'userDisplayNames',
  'azureAdUserIds',
  'ipAddresses',
  'countryCodes',
  'cities',
  'states',
  'userAgents',
  'sessionIds',
  'requestIds',
  'verdicts',
  'deviceDnsNames',
  'deviceIds'
] as const;

/**
 * Available facet fields
 */
export const AVAILABLE_FACET_FIELDS = [
  'severity',
  'status',
  'category',
  'classification',
  'productName',
  'detectionSource',
  'serviceSource',
  'incidentId',
  'tenantId',
  'countryCodes',
  'cities',
  'states',
  'mitreTechniques',
  'systemTags',
  'verdicts'
] as const;

/**
 * Available sortable fields
 */
export const AVAILABLE_SORT_FIELDS = [
  'id',
  'category',
  'productName',
  'severity',
  'status',
  'classification',
  'createdDateTime',
  'lastUpdateDateTime',
  'firstActivityDateTime',
  'lastActivityDateTime',
  'resolvedDateTime',
  'incidentId',
  'detectionSource',
  'serviceSource'
] as const;
