# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

IT System API - Azure Functions v4 TypeScript project for managing security alert events, risk detections, managed devices, vulnerabilities, and IT remediation tickets. Integrates with Microsoft Graph Security API, Microsoft Defender, Microsoft Intune, Atera ticketing, CosmosDB, and Azure Cognitive Search.

## Development Commands

### Build & Run
```bash
npm run build          # Compile TypeScript to dist/
npm run watch          # Watch mode for TypeScript compilation
npm start              # Start Azure Functions runtime (after build)
npm run clean          # Remove dist/ directory
```

### Development Workflow
```bash
# Terminal 1: Watch TypeScript compilation
npm run watch

# Terminal 2: Start Functions runtime
npm start
```

### Linting
```bash
npm run lint           # Run ESLint
npm run lint:fix       # Fix ESLint issues automatically
```

### Testing
```bash
npm test                                    # Run all Jest tests
npm run test:watch                          # Run tests in watch mode
npm run test:coverage                       # Run tests with coverage report
npm run test:verbose                        # Run tests with verbose output
npm test -- <test-file-path>               # Run specific test file
npm test -- <keyword>                       # Run tests matching keyword
npm run test:ci                            # CI mode (coverage, max 2 workers)
```

### Code Generation
```bash
npm run generate:endpoint  # Generate new endpoint boilerplate with Plop
```

## Architecture

### Three-Layer Architecture Pattern

```
┌─────────────────────────────────────────┐
│    HTTP Functions Layer                 │  Azure Functions HTTP triggers (src/functions/)
│    - Authentication middleware          │
│    - Input validation                   │
│    - Error handling                     │
├─────────────────────────────────────────┤
│    Service Layer                        │  Business logic orchestration (src/services/)
│    - Orchestrates repositories          │
│    - Business rule enforcement          │
│    - Cross-repository operations        │
├─────────────────────────────────────────┤
│    Repository Layer                     │  Data access abstraction (src/repositories/)
│    - CosmosDB queries                   │
│    - Azure Search operations            │
│    - Graph API calls                    │
├─────────────────────────────────────────┤
│    Data Sources                         │  CosmosDB, Azure Search, Graph API, Defender API
└─────────────────────────────────────────┘
```

### Key Architectural Patterns

#### 1. Singleton Pattern
All repositories and services are exported as singleton instances:
```typescript
// DO THIS
export const alertEventRepository = new AlertEventRepository();

// Import and use directly
import { alertEventRepository } from '../repositories/AlertEventRepository';
```

#### 2. Error Handling Hierarchy
Custom error classes with automatic HTTP status mapping:
- `AppError` (base class)
- `ValidationError` (400) - Input validation failures
- `NotFoundError` (404) - Resource not found
- `ConflictError` (409) - CosmosDB conflicts, concurrent updates
- `ServiceError` (500) - Internal service errors

All errors are sanitized before sending to client (removes sensitive data, stack traces, internal paths).

#### 3. Authentication Flow
All endpoints use function key authentication:
```typescript
const authResult = validateFunctionKey(request);
if (!authResult.authenticated) {
  return {
    status: 401,
    headers: { 'WWW-Authenticate': 'FunctionKey' },
    jsonBody: { error: 'Unauthorized', message: authResult.error }
  };
}
```
- Checks `x-functions-key` header or `code` query parameter
- Returns `AuthResult` with `authenticated`, `userId`, `error`

#### 4. Pagination Pattern
Consistent pagination across CosmosDB and Azure Search:
- **CosmosDB**: `continuationToken` (opaque JSON string with quotes - do NOT sanitize quotes)
- **Azure Search**: `skip` parameter
- **Request**: `pageSize` (1-100, default 50), `continuationToken`
- **Response**: `{ count, hasMore, continuationToken, totalCount? }`

**CRITICAL**: Do NOT use `ORDER BY` clauses in CosmosDB queries. CosmosDB provides continuation tokens without explicit ordering. If ordering is needed, create composite indexes in Azure Portal first.

#### 5. Query Tracing
All database/search operations log execution traces:
```typescript
logger.info('[CosmosDB Query Trace] Executing query', {
  query: querySpec.query,
  parameters: querySpec.parameters,
  requestCharge: response.requestCharge,
  executionTime: Date.now() - startTime,
  itemCount: documents.length
});
```
Log prefixes: `[CosmosDB]`, `[Azure Search]`, `[Graph API]`, `[Defender API]`

## Critical Implementation Details

### CosmosDB Data Structure
Documents have properties at **root level** (not nested under "value"):
```typescript
{
  id: "uuid",           // Partition key for most containers
  alertId: "...",       // Microsoft Graph Alert ID
  severity: "high",
  status: "new",
  createdDateTime: "ISO8601",
  _rid, _etag, _ts      // CosmosDB metadata
}
```
Queries use `c.property` NOT `c.value.property`.

### CosmosDB Containers
Multiple containers for different data types:
- `alerts` - Microsoft Graph Security alert events
- `risk_detections` - Risk detection events
- `alerts_statistics` - Pre-aggregated statistics
- `devices_intune` - Managed devices from Intune
- `devices_defender` - Defender devices
- `devices_all` - Cross-synced devices (Intune + Defender)
- `vulnerabilities_defender` - Vulnerability data
- `atera_tickets` - Remediation tickets from Atera

### Azure Cognitive Search Index
- Index name: `alerts-index` (configurable via env var)
- Suggester name: `sg` (for autocomplete/suggestions)
- Fields match CosmosDB with additional collection fields:
  - `userAccountNames`, `ipAddresses`, `mitreTechniques`
  - Vector fields: `titleVector`, `descriptionVector` (semantic search)
- OData filters built with `buildFilterString()` method (handles quote escaping)

### Input Validation
All query parameters validated before use (`src/utils/validator.ts`):
- `validateId()` - UUID format (v4)
- `validateISODate()` - ISO 8601 date format
- `validateDateString()` - YYYY-MM-DD format
- `sanitizeQueryParam()` - Removes XSS vectors, control characters, **NOT quotes** (quotes are valid in continuation tokens)
- `validatePaginationParams()` - Enforces max 100 items, preserves quotes in tokens
- `validateAlertFilters()` - Validates enums and date ranges
- `validateDeviceSearchFilters()` - Validates device search filters
- `validateTicketSearchFilters()` - **CRITICAL**: Validates numeric ticket IDs (NOT UUIDs)

### Atera Ticket ID Validation
**IMPORTANT**: Atera uses numeric integer IDs, NOT UUIDs
```typescript
// Correct validation pattern
if (!/^\d+$/.test(ticketId)) {
  errors.push('ticketId: Must be a numeric value (e.g., 5876)');
}
const idNum = parseInt(ticketId, 10);
if (idNum < 1 || idNum > 999999999) {
  errors.push('ticketId: Must be between 1 and 999999999');
}
```

### Search Query Building
Azure Search OData filters:
- Multiple values, same field: OR logic - `(severity eq 'high' or severity eq 'critical')`
- Different fields: AND logic - `(severity eq 'high') and (status eq 'new')`
- Single quotes in values: Escape with double quotes - `value.replace(/'/g, "''")`
- Date filters: `createdDateTime ge 2025-10-01T00:00:00Z`

### Environment Configuration
Required environment variables (validated on startup in `src/config/environment.ts`):
- **CosmosDB**: `COSMOS_ENDPOINT`, `COSMOS_KEY`, `COSMOS_DATABASE_ID`, `COSMOS_CONTAINER_*`
- **Search**: `SEARCH_ENDPOINT`, `SEARCH_API_KEY`, `SEARCH_INDEX_NAME`
- **Graph API**: `GRAPH_CLIENT_ID`, `GRAPH_TENANT_ID`, `GRAPH_CLIENT_SECRET`
- **Defender API**: `DEFENDER_CLIENT_ID`, `DEFENDER_TENANT_ID`, `DEFENDER_CLIENT_SECRET`
- Configuration throws error on startup if required vars missing

## Adding New Endpoints

### Using Plop Generator (Recommended)
```bash
npm run generate:endpoint
# Follow prompts for endpoint name, route, HTTP method, service/repository generation
```

### Manual Implementation
1. **Create HTTP function** in `src/functions/`:
```typescript
import { app } from '@azure/functions';
import { validateFunctionKey } from '../middleware/authentication';
import { handleError, successResponse } from '../utils/errorHandler';
import { logger } from '../utils/logger';

app.http('functionName', {
  methods: ['GET'],
  authLevel: 'anonymous',  // Auth handled in code
  route: 'your-route',
  handler: async (request, context) => {
    logger.setContext({ functionName: 'functionName', invocationId: context.invocationId });

    try {
      // 1. Validate authentication
      const authResult = validateFunctionKey(request);
      if (!authResult.authenticated) { /* return 401 */ }

      // 2. Validate input parameters
      // 3. Call service layer
      // 4. Return successResponse(data)
    } catch (error) {
      return handleError(error, context, request);
    } finally {
      logger.clearContext();
    }
  }
});
```

2. **Create service** in `src/services/` (if needed):
```typescript
export class MyService {
  async getData() {
    // Business logic, calls repositories
  }
}
export const myService = new MyService(); // Singleton
```

3. **Create repository** in `src/repositories/` (if needed):
```typescript
export class MyRepository {
  private client: CosmosClient;
  private container: Container | null = null;

  async initialize() {
    // Lazy initialization pattern
  }

  async query() {
    // CosmosDB queries with parameterization
  }
}
export const myRepository = new MyRepository(); // Singleton
```

4. **Update OpenAPI spec** in `src/config/openapi.ts`:
   - Add path to `paths` object
   - Define parameters, request/response schemas
   - Add to appropriate tag

## TypeScript Configuration

- **Strict mode enabled**: All strict checks active
- **No implicit any**: All types must be explicit
- **Unused variables**: Caught at compile time (prefix with `_` to bypass)
- **Module resolution**: Node style (`commonjs`)
- **Target**: ES2022
- **Source maps**: Enabled for debugging

## Testing Conventions

### Test Structure
```typescript
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

describe('MyRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should retrieve data successfully', async () => {
    // Arrange, Act, Assert
  });
});
```

### Running Tests
- All tests: `npm test`
- Single file: `npm test -- src/repositories/MyRepository.test.ts`
- Pattern match: `npm test -- MyRepository`
- With coverage: `npm run test:coverage`
- Watch mode: `npm run test:watch`

## Security Considerations

1. **Never commit** `local.settings.json` (contains secrets)
2. **Error sanitization**: All errors stripped of sensitive data before returning to client
3. **Parameterized queries**: CosmosDB uses parameterized queries, Azure Search uses OData escaping
4. **Function keys**: Primary authentication mechanism (stored in Azure, not in code)
5. **Input validation**: All parameters validated/sanitized before use
6. **Max pagination**: Hard limit of 100 items per page prevents resource exhaustion
7. **Continuation token preservation**: Do NOT sanitize quotes from continuation tokens (valid JSON)

## Common Issues

### CosmosDB Continuation Token Issues
- **Never strip quotes** from continuation tokens - they're valid JSON
- Continuation tokens work WITHOUT `ORDER BY` clauses
- Validator pattern: `/[\x00-\x1F\x7F<>`]/` (excludes quotes)

### Atera Ticket ID Validation
- **IDs are numeric strings** like "5876", NOT UUIDs
- Validation pattern: `/^\d+$/` with range 1-999999999
- Keep as string for CosmosDB queries

### CosmosDB 409 Conflict Errors
- Handled explicitly with `ConflictError`
- Logged with `[CosmosDB]` prefix
- Check for concurrent updates to same document

### Azure Search Type Assertions
SDK types don't match field selection well, use `as any` for:
- `select` parameter
- `orderBy` parameter
- `facets` parameter
This is expected and safe for these specific cases.

### Function Loading Issues
- Ensure `.funcignore` excludes `src/` and `*.ts` files
- Functions runtime should only see `dist/` output
- Check `npm run build` completes without errors

## Logging Conventions

Use structured logging with context:
```typescript
logger.info('message', { context });
logger.error('message', error, { additionalContext });
logger.warn('[ComponentName] Warning message', { details });
```

Prefix patterns:
- `[CosmosDB]` - Database operations
- `[CosmosDB Query Trace]` - Query execution details with RU consumption
- `[Azure Search]` - Search operations
- `[Azure Search Query Trace]` - Search execution details
- `[Graph API]` - Microsoft Graph calls
- `[Defender API]` - Defender API calls

Always log: execution time, request charges (RU), item counts for data operations.

## Local Development Setup

1. Install dependencies: `npm install`
2. Create `local.settings.json` with required environment variables
3. Ensure Azure resources are provisioned (CosmosDB, Search, App Registration)
4. Build: `npm run build`
5. Start in dev mode: `npm run watch` + `npm start` (separate terminals)
6. Access Swagger UI: `http://localhost:7071/api/swagger`
7. Test endpoints: Add `?code=<your-key>` or header `x-functions-key: <your-key>`

## API Documentation

- **Swagger UI**: `http://localhost:7071/api/swagger`
- **OpenAPI Spec**: Defined in `src/config/openapi.ts`
- **Endpoint Summary**: `API-ENDPOINTS-SUMMARY.md`
- All endpoints documented with request/response schemas, examples, error codes
