# API Endpoints - Quick Reference

**Base URL**: `http://localhost:7071/api` (local) | `https://{function-app}.azurewebsites.net/api` (production)

**Authentication**: All endpoints require function key via:
- Header: `x-functions-key: {your-key}`
- Query: `?code={your-key}`

---

## 📋 Alert Events

### GET /alert-events
**Description**: Get all alert events with pagination and filters

**Query Parameters**:
- `severity` (optional): `informational` | `low` | `medium` | `high` | `critical`
- `status` (optional): `new` | `inProgress` | `resolved`
- `category` (optional): MITRE ATT&CK category
- `startDate` (optional): ISO 8601 date (e.g., `2025-10-01T00:00:00Z`)
- `endDate` (optional): ISO 8601 date
- `pageSize` (optional): 1-100, default 50
- `continuationToken` (optional): Pagination token

**Example**:
```bash
GET /alert-events?severity=high&status=new&pageSize=20&code=your-key
```

**Response**:
```json
{
  "alerts": [...],
  "pagination": {
    "count": 20,
    "hasMore": true,
    "continuationToken": "token123"
  }
}
```

---

### GET /alert-events/{id}
**Description**: Get single alert event by ID

**Path Parameters**:
- `id`: Alert UUID

**Example**:
```bash
GET /alert-events/4ca57b0e-1851-4966-a375-fa9c69e9d273?code=your-key
```

**Response**:
```json
{
  "id": "4ca57b0e-1851-4966-a375-fa9c69e9d273",
  "value": {
    "severity": "high",
    "status": "resolved",
    "createdDateTime": "2025-10-10T22:48:46.063Z",
    ...
  }
}
```

---

## 🔍 Search

### GET /search/alerts
**Description**: Full-text search with Azure Cognitive Search

**Query Parameters**:
- `q` (required): Search query text
- `filter` (optional): OData filter (e.g., `severity eq 'high'`)
- `searchFields` (optional): Fields to search (comma-separated)
- `select` (optional): Fields to return (comma-separated)
- `orderBy` (optional): Sort field(s)
- `top` (optional): 1-100, default 50
- `skip` (optional): Number of results to skip
- `facets` (optional): Facet fields (comma-separated)
- `searchMode` (optional): `any` | `all`

**Example**:
```bash
GET /search/alerts?q=malware&filter=severity eq 'high'&top=10&code=your-key
```

**Response**:
```json
{
  "results": [...],
  "count": 10,
  "totalCount": 45,
  "facets": {
    "severity": [
      { "value": "high", "count": 30 },
      { "value": "medium", "count": 15 }
    ]
  }
}
```

---

### GET /search/suggestions
**Description**: Autocomplete suggestions for search

**Query Parameters**:
- `q` (required): Partial search text
- `suggesterName` (optional): Default `sg`
- `searchFields` (optional): Fields to search
- `top` (optional): 1-100, default 10

**Example**:
```bash
GET /search/suggestions?q=mal&top=5&code=your-key
```

**Response**:
```json
{
  "suggestions": [
    { "text": "malware detected", "score": 0.95 },
    { "text": "malicious activity", "score": 0.89 }
  ],
  "count": 2
}
```

---

## 📊 Statistics

### GET /statistics
**Description**: Query statistics with filters (returns one document per day per type)

**Query Parameters**:
- `type` (optional): `detectionSource` | `userImpact` | `ipThreats` | `attackTypes`
- `startDate` (optional): Date in YYYY-MM-DD format (e.g., `2025-10-21`) - filters by `periodStartDate` field
- `endDate` (optional): Date in YYYY-MM-DD format (e.g., `2025-10-22`) - filters by `periodStartDate` field
- `periodType` (optional): `hourly` | `daily` | `weekly` | `monthly` | `custom`
- `pageSize` (optional): 1-100, default 50
- `continuationToken` (optional): Pagination token

**Date Filtering**: Returns statistics documents where `periodStartDate` falls within the specified range (inclusive). Both YYYY-MM-DD and ISO 8601 formats are accepted (normalized to YYYY-MM-DD internally).

**Example**:
```bash
# Get detection source stats for Oct 20, 2025 (single day)
GET /statistics?type=detectionSource&startDate=2025-10-20&endDate=2025-10-20&code=your-key

# Get all stats for Oct 20-22, 2025 (date range)
GET /statistics?startDate=2025-10-20&endDate=2025-10-22&code=your-key
```

**Response** (one document per day):
```json
{
  "statistics": [
    {
      "id": "detectionSource_2025-10-20",
      "type": "detectionSource",
      "periodStartDate": "2025-10-20",
      "period": {
        "startDate": "2025-10-20T00:00:00.000Z",
        "endDate": "2025-10-20T23:59:59.999Z",
        "periodType": "daily"
      },
      "generatedAt": "2025-10-20T20:00:15.123Z",
      "processingInfo": {
        "totalAlertsProcessed": 150,
        "processingTimeMs": 2234
      },
      "detectionSourceStats": {
        "totalAlerts": 150,
        "sources": [
          { "source": "azureAdIdentityProtection", "count": 45 },
          { "source": "microsoftDefenderForEndpoint", "count": 35 }
        ]
      }
    }
  ],
  "pagination": { "count": 1, "hasMore": false }
}
```

---

### GET /statistics/by-id/{id}
**Description**: Get single statistics document by ID

**Path Parameters**:
- `id`: Statistics ID (format: `{type}_{YYYY-MM-DD}`)

**Query Parameters**:
- `partitionKey` (required): Partition key (periodStartDate in YYYY-MM-DD format)

**Example**:
```bash
GET /statistics/by-id/detectionSource_2025-10-20?partitionKey=2025-10-20&code=your-key
```

---

### GET /statistics/detection-sources
**Description**: Get detection source statistics filtered by date range

**Query Parameters**:
- `startDate` (optional): Date in YYYY-MM-DD format (e.g., `2025-10-21`) - filters by `periodStartDate` field
- `endDate` (optional): Date in YYYY-MM-DD format (e.g., `2025-10-22`) - filters by `periodStartDate` field
- `pageSize` (optional): 1-100, default 50
- `continuationToken` (optional): Pagination token

**Date Filtering**: Returns statistics documents where `periodStartDate` falls within the specified range (inclusive).

**Example**:
```bash
# Get detection source stats for Oct 20-22, 2025
GET /statistics/detection-sources?startDate=2025-10-20&endDate=2025-10-22&code=your-key

# Get stats for a single day
GET /statistics/detection-sources?startDate=2025-10-21&endDate=2025-10-21&code=your-key
```

---

### GET /statistics/user-impact
**Description**: Get user impact statistics filtered by date range

**Query Parameters**:
- `startDate` (optional): Date in YYYY-MM-DD format (e.g., `2025-10-21`) - filters by `periodStartDate` field
- `endDate` (optional): Date in YYYY-MM-DD format (e.g., `2025-10-22`) - filters by `periodStartDate` field
- `pageSize` (optional): 1-100, default 50
- `continuationToken` (optional): Pagination token

**Date Filtering**: Returns statistics documents where `periodStartDate` falls within the specified range (inclusive).

**Example**:
```bash
GET /statistics/user-impact?startDate=2025-10-21&endDate=2025-10-22&code=your-key
```

---

### GET /statistics/ip-threats
**Description**: Get IP threat statistics filtered by date range

**Query Parameters**:
- `startDate` (optional): Date in YYYY-MM-DD format (e.g., `2025-10-21`) - filters by `periodStartDate` field
- `endDate` (optional): Date in YYYY-MM-DD format (e.g., `2025-10-22`) - filters by `periodStartDate` field
- `pageSize` (optional): 1-100, default 50
- `continuationToken` (optional): Pagination token

**Date Filtering**: Returns statistics documents where `periodStartDate` falls within the specified range (inclusive).

**Example**:
```bash
GET /statistics/ip-threats?startDate=2025-10-21&endDate=2025-10-22&code=your-key
```

---

### GET /statistics/attack-types
**Description**: Get attack type statistics filtered by date range

**Query Parameters**:
- `startDate` (optional): Date in YYYY-MM-DD format (e.g., `2025-10-21`) - filters by `periodStartDate` field
- `endDate` (optional): Date in YYYY-MM-DD format (e.g., `2025-10-22`) - filters by `periodStartDate` field
- `pageSize` (optional): 1-100, default 50
- `continuationToken` (optional): Pagination token

**Date Filtering**: Returns statistics documents where `periodStartDate` falls within the specified range (inclusive).

**Example**:
```bash
GET /statistics/attack-types?startDate=2025-10-21&endDate=2025-10-22&code=your-key
```

---

### GET /trigger/generate-statistics
**Description**: Manually trigger statistics generation for a specific day or current day

**Query Parameters**:
- `date` (optional): Date in YYYY-MM-DD format (e.g., `2025-10-15`)
  - If not provided, uses **current day** (backward compatible)
  - Cannot be a future date
  - Must be a valid date (no Feb 30, etc.)

**Examples**:
```bash
# Generate for today (default - backward compatible)
GET /trigger/generate-statistics?code=your-key

# Generate for specific date (historical backfill)
GET /trigger/generate-statistics?date=2025-10-15&code=your-key
```

**Response**:
```json
{
  "message": "Statistics generation completed successfully",
  "details": {
    "isInitialRun": false,
    "period": {
      "startDate": "2025-10-20T00:00:00.000Z",
      "endDate": "2025-10-20T23:59:59.999Z",
      "periodType": "daily"
    },
    "typesGenerated": 4,
    "totalAlertsProcessed": 150,
    "totalProcessingTimeMs": 8920,
    "results": [
      { "type": "detectionSource", "id": "detectionSource_2025-10-20", ... },
      { "type": "userImpact", "id": "userImpact_2025-10-20", ... },
      { "type": "ipThreats", "id": "ipThreats_2025-10-20", ... },
      { "type": "attackTypes", "id": "attackTypes_2025-10-20", ... }
    ]
  }
}
```

---

## 🔐 Risk Detections

### GET /risk-detections
**Description**: Get all risk detections with pagination and filters

**Query Parameters**:
- `riskState` (optional): `atRisk` | `confirmedCompromised` | `remediated` | `dismissed`
- `riskLevel` (optional): `low` | `medium` | `high` | `hidden` | `none` | `unknownFutureValue`
- `startDate` (optional): ISO 8601 date
- `endDate` (optional): ISO 8601 date
- `pageSize` (optional): 1-100, default 50
- `continuationToken` (optional): Pagination token

**Example**:
```bash
GET /risk-detections?riskLevel=high&riskState=atRisk&code=your-key
```

---

### GET /risk-detections/{id}
**Description**: Get single risk detection by ID

**Path Parameters**:
- `id`: Risk detection UUID

---

## 📖 Documentation

### GET /swagger
**Description**: Interactive Swagger UI for API documentation

**No Parameters Required**

**Example**:
```bash
# Browser
http://localhost:7071/api/swagger
```

---

### GET /swagger/openapi.json
**Description**: OpenAPI 3.0 specification in JSON format

**No Parameters Required**

**Example**:
```bash
GET /swagger/openapi.json
```

---

## 📅 Timer Triggers (Automatic)

### generateAlertStatisticsTimer
**Description**: Automatically generates statistics every hour

**Schedule**: `0 0 * * * *` (every hour at :00 minutes)

**Not Directly Callable** (use `/trigger/generate-statistics` instead)

**Behavior**:
- Runs every hour
- Generates/updates 4 statistics documents for current day
- Uses UPSERT pattern (one document per day per type)

---

## 🔑 Common Parameters

### Pagination
- `pageSize`: 1-100 (default varies by endpoint)
- `continuationToken`: Token from previous response
- `skip`: Number of results to skip (search only)

### Date Filters
- **Alert Events**: ISO 8601 format (`YYYY-MM-DDTHH:mm:ss.sssZ`)
  - Example: `2025-10-20T00:00:00.000Z`
- **Statistics Queries**: YYYY-MM-DD format (preferred)
  - Example: `2025-10-21`
  - Also accepts ISO 8601 (automatically normalized to YYYY-MM-DD)
  - Filters by the `periodStartDate` field

### Severity Values
- `informational`
- `low`
- `medium`
- `high`
- `critical`

### Status Values
- `new`
- `inProgress`
- `resolved`

### Statistics Types
- `detectionSource`
- `userImpact`
- `ipThreats`
- `attackTypes`

---

## 📊 Quick Examples

### Get High Severity Alerts from Today
```bash
GET /alert-events?severity=high&startDate=2025-10-20T00:00:00Z&pageSize=50&code=your-key
```

### Search for "malware" in High Priority Alerts
```bash
GET /search/alerts?q=malware&filter=severity eq 'high'&top=20&code=your-key
```

### Get Statistics for Last Week
```bash
GET /statistics?type=detectionSource&startDate=2025-10-14&endDate=2025-10-20&code=your-key
```

### Trigger Statistics Generation
```bash
GET /trigger/generate-statistics?code=your-key
```

---

## 📝 Response Format

All endpoints return JSON with consistent structure:

### Success (200)
```json
{
  "data": { ... },
  "pagination": { ... }  // if applicable
}
```

### Error (4xx/5xx)
```json
{
  "error": "Error Type",
  "message": "Human-readable message",
  "details": { ... }  // optional
}
```

---

## 🔒 Authentication Errors

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Valid function key required"
}
```

**Headers**: `WWW-Authenticate: FunctionKey`

---

## ⚡ Performance Notes

- **Max Page Size**: 100 items
- **Default Page Size**: 50 items (varies by endpoint)
- **Statistics Generation**: ~8-12 seconds for all 4 types
- **Search Response Time**: <1 second typical
- **CosmosDB RU Cost**: ~3-5 RU per query, ~10-15 RU per statistics generation

---

## 📚 Documentation Links

- **Swagger UI**: `http://localhost:7071/api/swagger`
- **OpenAPI Spec**: `http://localhost:7071/api/swagger/openapi.json`
- **Statistics Guide**: `STATISTICS-DAILY-UPSERT.md`
- **Project Docs**: `README.md`, `CLAUDE.md`

---

**Last Updated**: 2025-10-21
**API Version**: 1.0
**Total Endpoints**: 16 (15 HTTP + 1 Timer)
