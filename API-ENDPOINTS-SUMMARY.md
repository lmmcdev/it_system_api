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

## 💻 Managed Devices (Microsoft Intune)

### GET /managed-devices
**Description**: Get all managed devices with filters and pagination

**Query Parameters**:
- `complianceState` (optional): `unknown` | `compliant` | `noncompliant` | `conflict` | `error` | `inGracePeriod` | `configManager`
- `operatingSystem` (optional): Operating system name (e.g., `Windows`, `iOS`, `Android`)
- `deviceType` (optional): Device type (e.g., `Desktop`, `Phone`, `Tablet`)
- `managementState` (optional): `managed` | `retirePending` | `wipePending` | `unhealthy` | etc.
- `userId` (optional): Azure AD user ID
- `pageSize` (optional): 1-999, default 100
- `nextLink` (optional): Pagination link from previous response

**Example**:
```bash
GET /managed-devices?complianceState=noncompliant&operatingSystem=Windows&pageSize=50&code=your-key
```

**Response**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "device-uuid",
        "deviceName": "DESKTOP-ABC123",
        "userId": "user-uuid",
        "complianceState": "noncompliant",
        "operatingSystem": "Windows",
        "osVersion": "10.0.19044",
        "deviceType": "Desktop",
        "managementState": "managed",
        "userDisplayName": "John Doe",
        "userPrincipalName": "john.doe@example.com",
        "lastSyncDateTime": "2025-10-22T10:30:00Z",
        "enrolledDateTime": "2024-01-15T08:00:00Z"
      }
    ],
    "pagination": {
      "count": 50,
      "hasMore": true,
      "nextLink": "https://graph.microsoft.com/v1.0/deviceManagement/managedDevices?$skip=50"
    }
  },
  "timestamp": "2025-10-22T12:00:00.000Z"
}
```

---

### GET /managed-devices/{id}
**Description**: Get single managed device by ID

**Path Parameters**:
- `id`: Device UUID from Microsoft Graph

**Example**:
```bash
GET /managed-devices/12345678-1234-1234-1234-123456789abc?code=your-key
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "12345678-1234-1234-1234-123456789abc",
    "deviceName": "DESKTOP-ABC123",
    "userId": "user-uuid",
    "complianceState": "compliant",
    "operatingSystem": "Windows",
    "osVersion": "10.0.19044",
    "manufacturer": "Microsoft Corporation",
    "model": "Surface Laptop 4",
    "serialNumber": "ABC123XYZ",
    "managementState": "managed",
    "azureADRegistered": true,
    "azureADDeviceId": "azure-device-id",
    "isEncrypted": true,
    "totalStorageSpaceInBytes": 512000000000,
    "freeStorageSpaceInBytes": 256000000000
  },
  "timestamp": "2025-10-22T12:00:00.000Z"
}
```

---

### GET /managed-devices/user/{userId}
**Description**: Get all managed devices for a specific user

**Path Parameters**:
- `userId`: Azure AD user ID

**Query Parameters**:
- `pageSize` (optional): 1-999, default 100
- `nextLink` (optional): Pagination link from previous response

**Example**:
```bash
GET /managed-devices/user/87654321-4321-4321-4321-210987654321?code=your-key
```

**Response**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "device-1",
        "deviceName": "iPhone 13",
        "userId": "87654321-4321-4321-4321-210987654321",
        "operatingSystem": "iOS",
        "osVersion": "16.5"
      },
      {
        "id": "device-2",
        "deviceName": "MacBook Pro",
        "userId": "87654321-4321-4321-4321-210987654321",
        "operatingSystem": "macOS",
        "osVersion": "13.2"
      }
    ],
    "pagination": {
      "count": 2,
      "hasMore": false,
      "nextLink": null
    }
  },
  "timestamp": "2025-10-22T12:00:00.000Z"
}
```

---

### GET /managed-devices/compliance/non-compliant
**Description**: Get all devices with non-compliant status

**Query Parameters**:
- `pageSize` (optional): 1-999, default 100
- `nextLink` (optional): Pagination link from previous response

**Example**:
```bash
GET /managed-devices/compliance/non-compliant?pageSize=100&code=your-key
```

**Response**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "device-uuid",
        "deviceName": "LAPTOP-XYZ789",
        "complianceState": "noncompliant",
        "operatingSystem": "Windows",
        "userDisplayName": "Jane Smith",
        "complianceGracePeriodExpirationDateTime": "2025-10-25T00:00:00Z"
      }
    ],
    "pagination": {
      "count": 1,
      "hasMore": false,
      "nextLink": null
    }
  },
  "timestamp": "2025-10-22T12:00:00.000Z"
}
```

---

## 🔍 Detected Apps (Microsoft Intune)

### GET /detected-apps/{appId}/devices
**Description**: Get all managed devices that have a specific detected app installed

**Path Parameters**:
- `appId`: Detected app ID from Microsoft Graph

**Query Parameters**:
- `pageSize` (optional): 1-999, default 100
- `nextLink` (optional): Pagination link from previous response

**Example**:
```bash
GET /detected-apps/app-12345/devices?pageSize=50&code=your-key
```

**Response**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "device-uuid",
        "deviceName": "DESKTOP-ABC123",
        "userId": "user-uuid",
        "operatingSystem": "Windows",
        "osVersion": "10.0.19044",
        "deviceType": "Desktop",
        "complianceState": "compliant",
        "managementState": "managed",
        "userDisplayName": "John Doe",
        "userPrincipalName": "john.doe@example.com",
        "manufacturer": "Microsoft",
        "model": "Surface Pro",
        "isEncrypted": true,
        "enrolledDateTime": "2025-01-01T00:00:00Z",
        "lastSyncDateTime": "2025-10-22T10:00:00Z"
      }
    ],
    "pagination": {
      "count": 1,
      "hasMore": false,
      "nextLink": null
    }
  },
  "timestamp": "2025-10-22T12:00:00.000Z"
}
```

---

## 📋 Device Compliance Policies (Microsoft Intune)

### GET /compliance-policies/{policyId}
**Description**: Get a specific device compliance policy by ID

**Path Parameters**:
- `policyId`: Compliance policy ID from Microsoft Graph

**Example**:
```bash
GET /compliance-policies/policy-12345?code=your-key
```

**Response**:
```json
{
  "success": true,
  "data": {
    "@odata.type": "#microsoft.graph.windows10CompliancePolicy",
    "id": "policy-12345",
    "displayName": "Windows 10 Security Policy",
    "description": "Corporate Windows 10 security requirements",
    "createdDateTime": "2025-01-01T00:00:00Z",
    "lastModifiedDateTime": "2025-10-22T10:00:00Z",
    "version": 1,
    "passwordRequired": true,
    "passwordMinimumLength": 8,
    "passwordRequiredType": "alphanumeric",
    "bitLockerEnabled": true,
    "secureBootEnabled": true,
    "codeIntegrityEnabled": true,
    "osMinimumVersion": "10.0.19041",
    "defenderEnabled": true,
    "antivirusRequired": true
  },
  "timestamp": "2025-10-22T12:00:00.000Z"
}
```

**Supported Policy Types**:
- `#microsoft.graph.windows10CompliancePolicy`
- `#microsoft.graph.androidCompliancePolicy`
- `#microsoft.graph.iosCompliancePolicy`
- `#microsoft.graph.macOSCompliancePolicy`

---

## 🔄 Device Sync Triggers

### GET /trigger/sync-managed-devices
**Description**: Manually trigger synchronization of managed devices from Microsoft Graph API to CosmosDB

**Query Parameters**: None (uses function key for authentication)

**Example**:
```bash
GET /trigger/sync-managed-devices?code=your-key
```

**Response**:
```json
{
  "success": true,
  "status": "success",
  "summary": {
    "totalDevicesFetched": 2000,
    "devicesProcessed": 1995,
    "devicesFailed": 5,
    "executionTimeMs": 245000
  },
  "graphApiMetrics": {
    "calls": 4,
    "pages": 3,
    "totalRequestTimeMs": 15000,
    "averageRequestTimeMs": "3750.00"
  },
  "cosmosDbMetrics": {
    "writes": 1995,
    "totalRuConsumed": "997.50",
    "averageRuPerWrite": "0.50"
  },
  "errors": {
    "count": 5,
    "sample": [
      {
        "deviceId": "device-123",
        "deviceName": "LAPTOP-XYZ",
        "error": "HTTP 429: Throttled",
        "timestamp": "2025-10-23T10:30:15Z"
      }
    ],
    "hasMore": false
  },
  "timestamp": "2025-10-23T10:35:00.000Z"
}
```

**Sync Status Values**:
- `success`: All devices synced successfully
- `partial`: Some devices failed but majority succeeded
- `failed`: Sync failed completely

**Notes**:
- Syncs approximately 2000 devices from Microsoft Graph API
- Uses bulk UPSERT operations for performance
- Handles pagination automatically
- Target completion time: < 5 minutes
- Tracks sync metadata in CosmosDB

---

### syncManagedDevicesTimer (Timer Trigger)
**Description**: Automatically synchronizes managed devices every 6 hours

**Schedule**: `0 0 */6 * * *` (runs at 00:00, 06:00, 12:00, 18:00 UTC)

**Not Directly Callable** (use `/trigger/sync-managed-devices` for manual sync)

**Behavior**:
- Fetches all managed devices from Microsoft Graph API
- Uses pagination to handle ~2000 devices
- Processes devices in batches of 100
- Performs bulk UPSERT to CosmosDB `devices_intune` container
- Updates sync metadata with results and errors
- Logs comprehensive metrics (RU consumption, execution time, etc.)

**Automatic Features**:
- Exponential backoff retry on 429 throttling
- Individual device error tracking
- Continues processing even if individual batches fail
- Maintains sync history and statistics

---

### GET /trigger/sync-defender-devices
**Description**: Manually trigger synchronization of Defender devices from Microsoft Defender for Endpoint API to CosmosDB

**Query Parameters**: None (uses function key for authentication)

**Example**:
```bash
GET /trigger/sync-defender-devices?code=your-key
```

**Response**:
```json
{
  "success": true,
  "status": "success",
  "summary": {
    "totalDevicesFetched": 5000,
    "devicesProcessed": 4998,
    "devicesFailed": 2,
    "executionTimeMs": 180000
  },
  "graphApiMetrics": {
    "calls": 2,
    "pages": 1,
    "totalRequestTimeMs": 8000,
    "averageRequestTimeMs": "4000.00"
  },
  "cosmosDbMetrics": {
    "writes": 4998,
    "totalRuConsumed": "2499.00",
    "averageRuPerWrite": "0.50"
  },
  "errors": {
    "count": 2,
    "sample": [
      {
        "deviceId": "device-abc123",
        "deviceName": "WORKSTATION-01",
        "error": "HTTP 429: Throttled",
        "timestamp": "2025-10-23T14:25:10Z"
      }
    ],
    "hasMore": false
  },
  "timestamp": "2025-10-23T14:28:00.000Z"
}
```

**Sync Status Values**:
- `success`: All devices synced successfully
- `partial`: Some devices failed but majority succeeded
- `failed`: Sync failed completely

**Notes**:
- Syncs devices from Microsoft Defender for Endpoint API
- Defender API returns up to 10,000 devices per page
- Uses bulk UPSERT operations for performance
- Handles pagination automatically
- Target completion time: < 5 minutes
- Tracks sync metadata in CosmosDB

---

### syncDefenderDevicesTimer (Timer Trigger)
**Description**: Automatically synchronizes Defender devices every 6 hours

**Schedule**: `0 0 */6 * * *` (runs at 00:00, 06:00, 12:00, 18:00 UTC)

**Not Directly Callable** (use `/trigger/sync-defender-devices` for manual sync)

**Behavior**:
- Fetches all devices from Microsoft Defender for Endpoint API
- Uses pagination to handle large device counts
- Processes devices in batches of 100
- Performs bulk UPSERT to CosmosDB `devices_defender` container
- Updates sync metadata with results and errors
- Logs comprehensive metrics (RU consumption, execution time, etc.)

**Automatic Features**:
- Exponential backoff retry on 429 throttling
- Individual device error tracking
- Continues processing even if individual batches fail
- Maintains sync history and statistics
- Improved throttle retry logic with individual device retry

**Device Properties Synchronized**:
- Device ID, computer DNS name, OS platform/version
- Health status (Active, Inactive, ImpairedCommunication, etc.)
- Risk score (None, Informational, Low, Medium, High)
- Exposure level (None, Low, Medium, High)
- Network information (IP addresses, MAC addresses)
- Azure AD device ID
- RBAC group information
- Machine tags
- First seen / Last seen timestamps

---

### POST /devices/sync-cross
**Description**: Manually trigger cross-synchronization of Intune and Defender devices

**Authentication**: Function key required

**Rate Limit**: 10 requests per hour

**Query Parameters**: None (uses function key for authentication)

**Example**:
```bash
POST /devices/sync-cross?code=your-key
```

**Response**:
```json
{
  "success": true,
  "message": "Device cross-sync completed successfully",
  "timestamp": "2025-10-24T15:30:45.123Z",
  "data": {
    "statistics": {
      "totalProcessed": 1523,
      "matched": 1245,
      "onlyIntune": 198,
      "onlyDefender": 80,
      "errorCount": 0
    },
    "percentages": {
      "matched": 81.75,
      "onlyIntune": 13.00,
      "onlyDefender": 5.25
    },
    "performance": {
      "totalExecutionTimeMs": 45230,
      "phases": {
        "fetchDefenderMs": 8542,
        "fetchIntuneMs": 7891,
        "matchingMs": 2345,
        "clearMs": 1234,
        "upsertMs": 25218
      }
    },
    "resourceUsage": {
      "totalRuConsumed": 3847.52,
      "breakdown": {
        "fetchDefenderRu": 245.30,
        "fetchIntuneRu": 198.45,
        "clearRu": 892.15,
        "upsertRu": 2511.62
      }
    },
    "errors": []
  }
}
```

**Sync States**:
- `matched`: Device exists in both Intune and Defender
- `only_intune`: Device only in Intune
- `only_defender`: Device only in Defender

**Output Container**: `devices_all`

**Document Structure**:
```json
{
  "id": "uuid",
  "syncKey": "azureADDeviceId",
  "syncState": "matched",
  "syncTimestamp": "2025-10-24T15:30:00.000Z",
  "intune": { /* IntuneDevice */ },
  "defender": { /* DefenderDevice */ }
}
```

**Notes**:
- Cross-matches devices by Azure AD Device ID
- Clears `devices_all` container before each sync
- Processes devices in batches of 100
- Target completion time: < 1 minute for 1500 devices
- See `DEVICE-CROSS-SYNC-GUIDE.md` for detailed documentation

---

### syncDevicesCrossTimer (Timer Trigger)
**Description**: Automatically synchronizes cross-matched devices at scheduled times

**Schedule**: `0 0 6,12,18 * * *` (runs at 06:00, 12:00, 18:00 UTC)

**Not Directly Callable** (use `POST /devices/sync-cross` for manual sync)

**Behavior**:
- Fetches all devices from `devices_defender` and `devices_intune` containers
- Cross-matches devices by Azure AD Device ID
- Generates unified sync documents with three states:
  - `matched`: Device in both systems
  - `only_intune`: Device only in Intune
  - `only_defender`: Device only in Defender
- Clears `devices_all` container
- Performs bulk UPSERT to `devices_all` container
- Logs comprehensive statistics and performance metrics

**Automatic Features**:
- Runs 1 hour after device syncs (Defender at 5 AM/5 PM, Intune at 11 AM/11 PM)
- 429 throttling retry with exponential backoff
- Individual device error tracking
- Performance and RU consumption monitoring

**Matching Algorithm**:
- Primary key: `aadDeviceId` (Defender) ↔ `azureADDeviceId` (Intune)
- Handles null device IDs gracefully
- Generates unique sync keys for unmatched devices

---

## 📚 Documentation Links

- **Swagger UI**: `http://localhost:7071/api/swagger`
- **OpenAPI Spec**: `http://localhost:7071/api/swagger/openapi.json`
- **Statistics Guide**: `STATISTICS-DAILY-UPSERT.md`
- **Device Sync Guide**: `DEVICE-SYNC-PROCESS.md`
- **Device Cross-Sync Guide**: `DEVICE-CROSS-SYNC-GUIDE.md`
- **Project Docs**: `README.md`, `CLAUDE.md`

---

**Last Updated**: 2025-10-24
**API Version**: 1.0
**Total Endpoints**: 27 (24 HTTP + 4 Timer Triggers)
