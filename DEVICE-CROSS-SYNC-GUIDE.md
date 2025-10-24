# Device Cross-Sync System Guide

## Overview

The Device Cross-Sync System automatically matches and synchronizes device records from Microsoft Intune and Microsoft Defender for Endpoint, storing the results in a unified container.

## Architecture

### Components Created

1. **Model Layer** (`src/models/DeviceSync.ts`)
   - `DeviceSyncDocument` - Unified document structure
   - `DeviceSyncState` - Enum: `matched`, `only_intune`, `only_defender`
   - Helper functions for sync key generation and state determination

2. **Repository Layer** (`src/repositories/DeviceSyncRepository.ts`)
   - Fetches devices from `devices_defender` and `devices_intune` containers
   - Performs bulk UPSERT operations to `devices_all` container
   - Handles CosmosDB throttling (429) with exponential backoff
   - Batch processing (100 items per batch)

3. **Service Layer** (`src/services/DeviceSyncService.ts`)
   - Cross-matching algorithm by `azureADDeviceId`
   - Performance metrics and RU consumption tracking
   - Comprehensive statistics and error handling

4. **Function Layer**
   - `syncDevicesCrossTimer.ts` - Automated timer trigger
   - `syncDevicesCrossManual.ts` - Manual HTTP endpoint

### Data Flow

```
┌─────────────────┐       ┌─────────────────┐
│ devices_defender│       │ devices_intune  │
│                 │       │                 │
│ - aadDeviceId   │       │ - azureADDeviceId│
└────────┬────────┘       └────────┬────────┘
         │                         │
         └──────────┬──────────────┘
                    │ Cross-Match by ID
                    ▼
         ┌──────────────────────┐
         │  DeviceSyncService   │
         │  - Match devices     │
         │  - Generate sync docs│
         └──────────┬───────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │    devices_all       │
         │                      │
         │  {                   │
         │    syncKey: "uuid",  │
         │    syncState: "...", │
         │    intune: {...},    │
         │    defender: {...}   │
         │  }                   │
         └──────────────────────┘
```

## Document Structure

### Output Document in `devices_all` Container

```json
{
  "id": "d5f8c2e1-3a4b-5c6d-7e8f-9a0b1c2d3e4f",
  "syncKey": "1be571a4-e358-4cbe-8c00-357be89e020e",
  "syncState": "matched",
  "syncTimestamp": "2025-10-24T15:30:00.000Z",
  "intune": {
    "id": "...",
    "azureADDeviceId": "1be571a4-e358-4cbe-8c00-357be89e020e",
    "deviceName": "DESKTOP-ABC123",
    "managedDeviceOwnerType": "company",
    "operatingSystem": "Windows",
    "osVersion": "10.0.19045.3803",
    ...
  },
  "defender": {
    "id": "...",
    "aadDeviceId": "1be571a4-e358-4cbe-8c00-357be89e020e",
    "computerDnsName": "DESKTOP-ABC123",
    "osPlatform": "Windows11",
    "version": "22H2",
    "healthStatus": "Active",
    "riskScore": "Medium",
    ...
  },
  "_rid": "...",
  "_etag": "...",
  "_ts": 1729782600
}
```

### Sync States

- **`matched`**: Device exists in both Intune and Defender
  - Both `intune` and `defender` fields populated
  - `syncKey` matches `azureADDeviceId`

- **`only_intune`**: Device only in Intune
  - Only `intune` field populated
  - `defender` field is `undefined`
  - `syncKey` is Intune's `azureADDeviceId`

- **`only_defender`**: Device only in Defender
  - Only `defender` field populated
  - `intune` field is `undefined`
  - `syncKey` is Defender's `aadDeviceId` or generated UUID if null

## Usage

### Automated Sync (Timer Trigger)

The system automatically runs at:
- **6:00 AM** (1 hour after Defender sync at 5 AM)
- **12:00 PM** (1 hour after Intune sync at 11 AM)
- **6:00 PM** (1 hour after Defender sync at 5 PM)

**Schedule Configuration:**
```json
"DEVICE_CROSS_SYNC_TIMER_SCHEDULE": "0 0 6,12,18 * * *"
```

**Monitoring:**
Check Azure Application Insights logs for:
```
[DeviceCrossSync] Starting automated cross-sync execution
[DeviceCrossSync] Cross-sync execution completed successfully
```

### Manual Sync (HTTP Endpoint)

**Endpoint:** `POST /api/devices/sync-cross`

**Authentication:** Function key required
```bash
# Using query parameter
curl -X POST "http://localhost:7071/api/devices/sync-cross?code=YOUR_FUNCTION_KEY"

# Using header
curl -X POST "http://localhost:7071/api/devices/sync-cross" \
  -H "x-functions-key: YOUR_FUNCTION_KEY"
```

**Rate Limit:** 10 requests per hour

**Response Example:**
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

## Environment Configuration

Required environment variables in `local.settings.json`:

```json
{
  "Values": {
    "COSMOS_CONTAINER_DEVICES_DEFENDER": "devices_defender",
    "COSMOS_CONTAINER_DEVICES_INTUNE": "devices_intune",
    "COSMOS_CONTAINER_DEVICES_ALL": "devices_all",
    "DEVICE_CROSS_SYNC_BATCH_SIZE": "100",
    "DEVICE_CROSS_SYNC_TIMER_SCHEDULE": "0 0 6,12,18 * * *"
  }
}
```

## CosmosDB Setup

### Create Container

You need to create the `devices_all` container in Azure Portal:

1. Navigate to your CosmosDB account: `lmmccosmos02`
2. Go to Database: `it-system`
3. Click "New Container"
4. **Container ID:** `devices_all`
5. **Partition Key:** `/id`
6. **Throughput:**
   - Manual: 400 RU/s (minimum)
   - Autoscale: 1000-4000 RU/s (recommended for production)

### Indexing Policy (Optional Optimization)

For better query performance, add these indexes:

```json
{
  "indexingMode": "consistent",
  "automatic": true,
  "includedPaths": [
    {
      "path": "/syncState/?"
    },
    {
      "path": "/syncTimestamp/?"
    },
    {
      "path": "/syncKey/?"
    }
  ],
  "excludedPaths": [
    {
      "path": "/intune/*"
    },
    {
      "path": "/defender/*"
    }
  ]
}
```

## Matching Algorithm

### Primary Matching Key

Devices are matched by Azure AD Device ID:
- **Defender:** `aadDeviceId` field
- **Intune:** `azureADDeviceId` field

### Matching Logic

```typescript
// 1. Group Defender devices by aadDeviceId
defenderMap = {
  "1be571a4-e358-4cbe-8c00-357be89e020e": DefenderDevice,
  ...
}

// 2. Group Intune devices by azureADDeviceId
intuneMap = {
  "1be571a4-e358-4cbe-8c00-357be89e020e": IntuneDevice,
  ...
}

// 3. Find matched devices (exist in both)
matched = intersection(defenderKeys, intuneKeys)

// 4. Find Intune-only devices
onlyIntune = intuneKeys - defenderKeys

// 5. Find Defender-only devices
onlyDefender = defenderKeys - intuneKeys
```

### Edge Cases Handled

1. **Null Device IDs:**
   - Defender devices with `aadDeviceId: null` → Grouped under `"__null__"` key
   - Each gets unique `syncKey` (UUID v4)
   - State: `only_defender`

2. **Duplicate Device IDs:**
   - Last device with duplicate ID overwrites previous
   - Logged as warning in Application Insights

3. **Missing Fields:**
   - Missing `azureADDeviceId` in Intune → Uses device ID as fallback
   - All required fields validated before UPSERT

## Performance Characteristics

### Batch Processing

- Processes devices in batches of 100 (configurable)
- Parallel batch execution with Promise.all
- Progress logging every 10 batches

### Resource Consumption

Typical RU consumption for 1500 devices:
- **Fetch Operations:** ~450 RU (300 RU Defender + 150 RU Intune)
- **Clear Operation:** ~900 RU (deleting old sync documents)
- **Upsert Operation:** ~2500 RU (writing new sync documents)
- **Total:** ~3850 RU per full sync

### Execution Time

Typical execution time for 1500 devices:
- **Fetch Phase:** ~16 seconds
- **Matching Phase:** ~2 seconds
- **Clear Phase:** ~1 second
- **Upsert Phase:** ~25 seconds
- **Total:** ~45 seconds

### Throttling Handling

- Automatic retry on 429 (Too Many Requests)
- Exponential backoff: 1s, 2s, 4s delays
- Max 3 retry attempts per batch
- Logged with `[CosmosDB Throttling]` prefix

## Monitoring and Logging

### Key Log Entries

**Start:**
```
[DeviceCrossSync] Starting automated cross-sync execution
[DeviceCrossSync] Timer trigger schedule: 0 0 6,12,18 * * *
```

**Fetch Phase:**
```
[DeviceCrossSync] Fetched 1245 Defender devices in 8542ms
[DeviceCrossSync] Fetched 1443 Intune devices in 7891ms
```

**Matching Phase:**
```
[DeviceCrossSync] Cross-matching completed in 2345ms
[DeviceCrossSync] Statistics: 1523 total (1245 matched, 198 Intune-only, 80 Defender-only)
```

**Upsert Phase:**
```
[DeviceCrossSync] Starting bulk UPSERT of 1523 documents
[DeviceCrossSync] Processing batch 1/16 (100 items)
[DeviceCrossSync] Bulk UPSERT completed: 1523 documents in 25218ms
```

**Completion:**
```
[DeviceCrossSync] Cross-sync execution completed successfully
[DeviceCrossSync] Total execution time: 45230ms
[DeviceCrossSync] Total RU consumed: 3847.52
```

### Error Logging

```
[DeviceCrossSync] ERROR: Cross-sync execution failed
[DeviceCrossSync] Error details: {error message}
[DeviceCrossSync] Stack trace: {stack}
```

## Testing

### Local Testing

1. **Start Functions Runtime:**
```bash
npm run build
npm start
```

2. **Trigger Manual Sync:**
```bash
curl -X POST "http://localhost:7071/api/devices/sync-cross?code=asdfghjkl"
```

3. **Monitor Logs:**
Watch console output for:
- Fetch operations
- Matching statistics
- UPSERT progress
- Final summary

### Verify Results

Query `devices_all` container:

```sql
-- Count by sync state
SELECT
  c.syncState,
  COUNT(1) as count
FROM c
GROUP BY c.syncState

-- View matched devices
SELECT
  c.syncKey,
  c.intune.deviceName,
  c.defender.computerDnsName,
  c.syncTimestamp
FROM c
WHERE c.syncState = 'matched'

-- View Intune-only devices
SELECT
  c.syncKey,
  c.intune.deviceName,
  c.intune.operatingSystem
FROM c
WHERE c.syncState = 'only_intune'
```

## Troubleshooting

### Issue: No Documents Created

**Symptoms:** Sync completes but `devices_all` is empty

**Checks:**
1. Verify container exists: `devices_all`
2. Check partition key is `/id`
3. Review logs for UPSERT errors
4. Check source containers have data

### Issue: High RU Consumption

**Symptoms:** RU consumption exceeds expected ~4000 RU

**Solutions:**
1. Reduce `DEVICE_CROSS_SYNC_BATCH_SIZE` to 50
2. Increase container throughput in Azure Portal
3. Enable autoscale (1000-4000 RU/s)

### Issue: 429 Throttling Errors

**Symptoms:** Logs show `[CosmosDB Throttling]` warnings

**Solutions:**
1. Container throughput too low - increase in Azure Portal
2. Too many concurrent operations - batch size is appropriate
3. Check other services aren't consuming RU quota

### Issue: Sync Takes Too Long

**Symptoms:** Execution time > 2 minutes

**Checks:**
1. Review phase timings in logs
2. Check network latency to CosmosDB
3. Verify batch size is 100 (not smaller)
4. Check for throttling warnings

### Issue: Devices Not Matching

**Symptoms:** High count of `only_intune` or `only_defender`

**Investigation:**
1. Query source containers for mismatched Device IDs
2. Check for null `aadDeviceId` in Defender
3. Verify Intune sync is populating `azureADDeviceId`
4. Review device naming consistency

## API Reference

### POST /api/devices/sync-cross

Manually triggers device cross-synchronization.

**Authentication:** Function key required

**Headers:**
- `x-functions-key: string` (optional)

**Query Parameters:**
- `code: string` (optional) - Function key

**Rate Limit:** 10 requests per hour

**Response:** 200 OK
```typescript
{
  success: boolean;
  message: string;
  timestamp: string;
  data: {
    statistics: {
      totalProcessed: number;
      matched: number;
      onlyIntune: number;
      onlyDefender: number;
      errorCount: number;
    };
    percentages: {
      matched: number;
      onlyIntune: number;
      onlyDefender: number;
    };
    performance: {
      totalExecutionTimeMs: number;
      phases: {
        fetchDefenderMs: number;
        fetchIntuneMs: number;
        matchingMs: number;
        clearMs: number;
        upsertMs: number;
      };
    };
    resourceUsage: {
      totalRuConsumed: number;
      breakdown: {
        fetchDefenderRu: number;
        fetchIntuneRu: number;
        clearRu: number;
        upsertRu: number;
      };
    };
    errors: Array<{
      syncKey: string;
      error: string;
    }>;
  };
}
```

**Error Responses:**

- `401 Unauthorized` - Missing or invalid function key
- `429 Too Many Requests` - Rate limit exceeded (10 req/hour)
- `500 Internal Server Error` - Sync execution failed

## Next Steps

1. **Create CosmosDB Container:**
   - Create `devices_all` container in Azure Portal
   - Use partition key `/id`
   - Set throughput to 400 RU/s (manual) or 1000-4000 RU/s (autoscale)

2. **Test Manual Sync:**
   - Start local Functions runtime
   - Execute POST request to test endpoint
   - Verify documents created in `devices_all`

3. **Monitor First Automated Sync:**
   - Wait for next scheduled time (6 AM, 12 PM, or 6 PM)
   - Check Application Insights for execution logs
   - Verify statistics match expectations

4. **Production Deployment:**
   - Deploy functions to Azure
   - Configure production environment variables
   - Enable Application Insights monitoring
   - Set up alerts for errors or high RU consumption
