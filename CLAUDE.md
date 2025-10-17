# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Alert Events API - Azure Functions TypeScript project for managing Security Alert Events from Microsoft Graph Security API with CosmosDB storage and Azure Cognitive Search integration.

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
npm test               # Run Jest tests (when implemented)
npm run test:watch     # Run tests in watch mode
```

## Architecture

### Layered Architecture Pattern

```
┌─────────────────────────────────────────┐
│    HTTP Functions Layer                 │  Azure Functions HTTP triggers
├─────────────────────────────────────────┤
│    Middleware Layer                     │  Authentication, validation
├─────────────────────────────────────────┤
│    Service Layer                        │  Business logic orchestration
├─────────────────────────────────────────┤
│    Repository Layer                     │  Data access abstraction
├─────────────────────────────────────────┤
│    Data Sources                         │  CosmosDB + Azure Search
└─────────────────────────────────────────┘
```

### Key Architectural Patterns

1. **Singleton Repositories & Services**: All repositories and services are exported as singleton instances (e.g., `export const alertEventRepository = new AlertEventRepository()`). Import and use these singletons directly.

2. **Error Handling Hierarchy**:
   - `AppError` (base class)
   - `ValidationError` (400) - Input validation failures
   - `NotFoundError` (404) - Resource not found
   - `ConflictError` (409) - CosmosDB conflicts
   - `ServiceError` (500) - Internal errors
   - All errors are sanitized before sending to client (see `errorHandler.ts`)

3. **Pagination Pattern**: Both CosmosDB and Azure Search use consistent pagination:
   - `top` parameter (max 100 items per page)
   - `continuationToken` (CosmosDB) or `skip` (Azure Search)
   - Response includes `count`, `hasMore`, `totalCount`

4. **Query Tracing**: All database/search operations log execution traces:
   - Query text/parameters
   - Request Charge (RU for CosmosDB)
   - Execution time (ms)
   - Item count
   - Logged with `[CosmosDB]` or `[Azure Search]` prefixes

5. **Authentication Flow**: All endpoints use function key authentication:
   - `validateFunctionKey(request)` checks `x-functions-key` header or `code` query param
   - Returns `AuthResult` with `authenticated`, `userId`, `error`
   - Authentication failures return 401 with `WWW-Authenticate: FunctionKey` header

## Critical Implementation Details

### CosmosDB Data Structure
Alert events have properties at **root level** (not nested under "value"):
```typescript
{
  id: "uuid",           // Partition key
  alertId: "...",       // Microsoft Graph Alert ID
  severity: "high",
  status: "new",
  createdDateTime: "ISO8601",
  // ... other properties at root
  _rid, _etag, _ts      // CosmosDB metadata
}
```
Queries use `c.property` NOT `c.value.property`.

### Azure Cognitive Search Index
- Index name: `alerts-index` (configurable via env var)
- Suggester name: `sg` (used for autocomplete/suggestions)
- Fields match CosmosDB structure with additional collection fields:
  - `userAccountNames`, `ipAddresses`, `mitreTechniques`, etc.
  - Vector fields: `titleVector`, `descriptionVector` (for semantic search)
- OData filters built with `buildFilterString()` method (handles escaping)

### Environment Configuration
Required environment variables (see `src/config/environment.ts`):
- **CosmosDB**: `COSMOS_ENDPOINT`, `COSMOS_KEY`, `COSMOS_DATABASE_ID`, `COSMOS_CONTAINER_ALERT`
- **Search**: `SEARCH_ENDPOINT`, `SEARCH_API_KEY`, `SEARCH_INDEX_NAME`
- **Auth**: `FUNCTION_KEY` (optional, for validation)
- Configuration is validated on startup, throws error if missing required vars

### Input Validation
All query parameters are validated before use (see `src/utils/validator.ts`):
- `validateId()` - UUID format (v4)
- `validateISODate()` - ISO 8601 date format
- `sanitizeQueryParam()` - Removes XSS vectors, control characters
- `validatePaginationParams()` - Enforces max 100 items
- `validateAlertFilters()` - Validates enums and date ranges

Filters accept:
- **Severity**: `informational`, `low`, `medium`, `high`, `critical`
- **Status**: `new`, `inProgress`, `resolved`
- **Category**: MITRE ATT&CK categories (12 types)

### Search Query Building
Azure Search filters use OData syntax:
- Multiple values for same field: OR logic `(severity eq 'high' or severity eq 'critical')`
- Different fields: AND logic `(severity eq 'high') and (status eq 'new')`
- Single quotes in values escaped: `value.replace(/'/g, "''")`
- Date filters: `createdDateTime ge 2025-10-01T00:00:00Z`

## Adding New Endpoints

1. **Create function file** in `src/functions/`:
   ```typescript
   import { app } from '@azure/functions';
   import { validateFunctionKey } from '../middleware/authentication';
   import { handleError, successResponse } from '../utils/errorHandler';

   app.http('functionName', {
     methods: ['GET'],
     authLevel: 'anonymous',  // Auth handled in code
     route: 'your-route',
     handler: async (request, context) => {
       // 1. Set logger context
       logger.setContext({ functionName, invocationId });

       // 2. Validate authentication
       const authResult = validateFunctionKey(request);
       if (!authResult.authenticated) { /* return 401 */ }

       // 3. Validate parameters
       // 4. Call service layer
       // 5. Return successResponse(data)
       // 6. Catch errors with handleError(error, context, request)
       // 7. Finally: logger.clearContext()
     }
   });
   ```

2. **Add to OpenAPI spec** in `src/config/openapi.ts`:
   - Add path to `paths` object
   - Define parameters, request/response schemas
   - Add to appropriate tag

3. **Update README.md** with endpoint documentation and examples

## TypeScript Configuration Notes

- **Strict mode enabled**: All strict checks active
- **No implicit any**: All types must be explicit
- **Unused variables**: Caught at compile time (prefix with `_` to bypass)
- **Module resolution**: Node style (`commonjs`)
- **Target**: ES2022

## Security Considerations

1. **Never commit** `local.settings.json` (contains secrets)
2. **Error sanitization**: All errors stripped of sensitive data (keys, passwords, paths) before returning to client
3. **Parameterized queries**: CosmosDB uses parameterized queries, Azure Search uses OData escaping
4. **Function keys**: Primary authentication mechanism (stored in Azure, not in code)
5. **Input validation**: All parameters validated/sanitized before use
6. **Max pagination**: Hard limit of 100 items per page to prevent resource exhaustion

## Common Issues

### Swagger UI "No layout defined for StandaloneLayout"
- Ensure both `swagger-ui-bundle.js` AND `swagger-ui-standalone-preset.js` are loaded
- Current implementation uses CDN for reliability
- Clear browser cache if issue persists

### CosmosDB 409 Conflict Errors
- Handled explicitly in repository with `ConflictError`
- Logged with `[CosmosDB]` prefix
- Check for concurrent updates to same document

### Azure Search Type Assertions
- SDK types don't match field selection well, use `as any` for:
  - `select` parameter
  - `orderBy` parameter
  - `facets` parameter
- This is expected and safe for these specific cases

### Function Loading Issues
- Ensure `.funcignore` excludes `src/` and `*.ts` files
- Functions runtime should only see `dist/` output
- Check `npm run build` completes without errors

## Logging Conventions

- Use structured logging: `logger.info('message', { context })`
- Prefix log messages with operation type:
  - `[CosmosDB]` - Database operations
  - `[Azure Search]` - Search operations
  - `[CosmosDB Query Trace]` - Query execution details
  - `[Azure Search Query Trace]` - Search execution details
- Always log execution time, request charges (RU), item counts for data operations
- Set/clear logger context in function handlers

## Local Development Setup

1. Install dependencies: `npm install`
2. Create `local.settings.json` with required environment variables
3. Ensure Azure CosmosDB and Azure Cognitive Search services are configured
4. Build project: `npm run build`
5. Start in development mode with watch: `npm run watch` + `npm start` (separate terminals)
6. Access Swagger UI: `http://localhost:7071/api/swagger`
7. Test endpoints with function key: Add `?code=<your-key>` or header `x-functions-key: <your-key>`
