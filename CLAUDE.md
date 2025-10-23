# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Alert Events API - Azure Functions TypeScript project for managing:
- Security Alert Events from Microsoft Graph Security API
- Managed Devices (Intune) from Microsoft Graph Device Management API
- CosmosDB storage with Azure Cognitive Search integration
- Automated synchronization with timer triggers

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
  - `[Graph API]` - Microsoft Graph API calls
  - `[ManagedDevices Sync]` - Device synchronization operations
  - `[CosmosDB Query Trace]` - Query execution details
  - `[Azure Search Query Trace]` - Search execution details
  - `[Graph API Query Trace]` - Graph API call details
- Always log execution time, request charges (RU), item counts for data operations
- Set/clear logger context in function handlers

## Managed Device Synchronization

### Overview
Automatic synchronization of managed devices from Microsoft Graph API to CosmosDB:
- **Timer Trigger**: Runs every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)
- **Manual Trigger**: HTTP endpoint `/trigger/sync-managed-devices`
- **Target**: ~2000 devices from Microsoft Intune
- **Performance**: < 5 minutes for full sync

### Architecture
```
┌──────────────────────────────────────────────────┐
│  syncManagedDevicesTimer (Timer Trigger)         │
│  triggerSyncManagedDevices (HTTP Trigger)        │
└────────────────┬─────────────────────────────────┘
                 │
                 v
┌──────────────────────────────────────────────────┐
│  ManagedDeviceSyncService                        │
│  - Orchestrates full sync workflow               │
│  - Tracks progress and errors                    │
│  - Updates sync metadata                         │
└────────────┬──────────────┬──────────────────────┘
             │              │
             v              v
┌─────────────────────┐  ┌──────────────────────────┐
│ ManagedDevice       │  │ ManagedDeviceCosmos      │
│ Repository          │  │ Repository               │
│ (Graph API Read)    │  │ (CosmosDB Write)         │
└─────────────────────┘  └──────────────────────────┘
```

### Key Components

1. **ManagedDeviceRepository** (`src/repositories/ManagedDeviceRepository.ts`)
   - Reads from Microsoft Graph API: `/deviceManagement/managedDevices`
   - Handles pagination with `@odata.nextLink`
   - Method: `getAllDevicesPaginated()` - fetches all devices

2. **ManagedDeviceCosmosRepository** (`src/repositories/ManagedDeviceCosmosRepository.ts`)
   - Writes to CosmosDB container: `devices_intune`
   - Methods:
     - `upsertDevice()` - Single device UPSERT
     - `bulkUpsertDevices()` - Batch UPSERT (100 devices per batch)
     - `getSyncMetadata()` - Retrieve sync status
     - `updateSyncMetadata()` - Update sync tracking
   - Features:
     - Exponential backoff retry on 429 throttling
     - Bulk operations for performance
     - Comprehensive error tracking

3. **ManagedDeviceSyncService** (`src/services/ManagedDeviceSyncService.ts`)
   - Orchestrates full sync workflow
   - Phase 1: Fetch all devices from Graph API
   - Phase 2: Batch upsert to CosmosDB (100 devices/batch)
   - Phase 3: Update sync metadata
   - Error handling: Continues on partial failures
   - Progress callbacks for monitoring

4. **SyncMetadata Model** (`src/models/SyncMetadata.ts`)
   - Singleton document (id: `sync_metadata`)
   - Tracks:
     - Last sync time and status
     - Devices processed/failed counts
     - Graph API and CosmosDB metrics
     - Individual device errors (last 100)

### Sync Process Flow

```
1. Timer/Manual Trigger Initiates
   ↓
2. Fetch Previous Sync Metadata
   ↓
3. Fetch All Devices from Graph API (with pagination)
   ↓
4. Create Batches (100 devices each)
   ↓
5. For Each Batch:
   - Bulk UPSERT to CosmosDB
   - Track success/failure
   - Log RU consumption
   - Continue on errors
   ↓
6. Calculate Final Status (success/partial/failed)
   ↓
7. Update Sync Metadata
   ↓
8. Return Results
```

### Environment Variables

Required in `local.settings.json` or Azure App Settings:
```json
{
  "COSMOS_CONTAINER_DEVICES_INTUNE": "devices_intune",
  "DEVICE_SYNC_BATCH_SIZE": "100",
  "DEVICE_SYNC_TIMER_SCHEDULE": "0 0 */6 * * *",
  "GRAPH_CLIENT_ID": "your-client-id",
  "GRAPH_TENANT_ID": "your-tenant-id",
  "GRAPH_CLIENT_SECRET": "your-client-secret"
}
```

### Error Handling Strategy

1. **Graph API Errors**:
   - 429 Throttling: Handled by repository with `Retry-After` header
   - Network errors: Logged and fail sync
   - 401/403: Authentication failure, fail immediately

2. **CosmosDB Errors**:
   - 429 Throttling: Exponential backoff retry (max 3 attempts)
   - 409 Conflict: Logged (shouldn't occur with UPSERT)
   - Individual device failures: Track and continue

3. **Service Level**:
   - Partial failures: Mark sync as `partial` status
   - Complete failures: Mark sync as `failed` status
   - Error limit: Track up to 100 recent errors

### Performance Considerations

- **Batch Size**: 100 devices (configurable via `DEVICE_SYNC_BATCH_SIZE`)
- **Expected RU Cost**: ~0.5 RU per device UPSERT = ~1000 RU total
- **Target Execution Time**: < 5 minutes for 2000 devices
- **Graph API Calls**: ~3-4 calls (999 items per page)
- **CosmosDB Writes**: 20 bulk operations (100 devices each)

### Monitoring and Debugging

Logs to watch for:
- `[ManagedDevices Sync] Starting device synchronization` - Sync initiated
- `[Graph API] Full device fetch completed` - All devices fetched
- `[CosmosDB] Bulk upsert operation completed` - Batch processing status
- `[ManagedDevices Sync] Synchronization completed` - Final results

Metrics tracked:
- `totalDevicesFetched` - Devices from Graph API
- `devicesProcessed` - Successfully written to CosmosDB
- `devicesFailed` - Failed to write
- `totalRuConsumed` - CosmosDB request units
- `executionTimeMs` - Total sync time

### Testing

Test files:
- `tests/repositories/ManagedDeviceCosmosRepository.test.ts`
- `tests/services/ManagedDeviceSyncService.test.ts`
- `tests/functions/syncManagedDevicesTimer.test.ts`

Run tests:
```bash
npm test -- ManagedDevice
```

## Local Development Setup

1. Install dependencies: `npm install`
2. Create `local.settings.json` with required environment variables (including device sync variables)
3. Ensure Azure CosmosDB and Azure Cognitive Search services are configured
4. Build project: `npm run build`
5. Start in development mode with watch: `npm run watch` + `npm start` (separate terminals)
6. Access Swagger UI: `http://localhost:7071/api/swagger`
7. Test endpoints with function key: Add `?code=<your-key>` or header `x-functions-key: <your-key>`
8. Manually trigger device sync: `GET http://localhost:7071/api/trigger/sync-managed-devices?code=<your-key>`
