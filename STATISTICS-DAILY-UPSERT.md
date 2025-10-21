# Alert Statistics - Daily UPSERT Pattern

**Last Updated:** 2025-10-21
**Status:** ✅ Implemented and Security Reviewed

## Overview

The alert statistics generation system implements a **daily UPSERT pattern** that ensures exactly **one statistics document per day per type** (4 files per day total). This prevents duplicate statistics and enables easy querying by date.

## Key Features

### 1. Daily UPSERT Pattern
- **One Document Per Day Per Type**: Each statistics type creates a single document per day
- **Automatic Updates**: Subsequent runs on the same day **update** the existing document instead of creating duplicates
- **Consistent IDs**: Documents use simplified ID format `{type}_{YYYY-MM-DD}` without timestamps

### 2. Statistics Types (4 files per day)
1. `detectionSource_{YYYY-MM-DD}` - Detection source aggregations
2. `userImpact_{YYYY-MM-DD}` - User impact statistics
3. `ipThreats_{YYYY-MM-DD}` - IP threat analysis
4. `attackTypes_{YYYY-MM-DD}` - Attack type categorization

### 3. Full Day Coverage
- **Period**: Always covers complete day (00:00:00.000 to 23:59:59.999 UTC)
- **Consistency**: Timer executions at different times generate the same document
- **Reliable**: Ensures all alerts for a day are included in statistics

## Implementation Details

### Document ID Format

**Current (UPSERT Pattern):**
```
{type}_{YYYY-MM-DD}
```

Examples:
- `detectionSource_2025-10-20`
- `userImpact_2025-10-19`
- `ipThreats_2025-10-18`
- `attackTypes_2025-10-17`

**Previous (Deprecated - with timestamp):**
```
{type}_{periodStart}_{periodEnd}_{timestamp}
```

Example:
- `detectionSource_2025-10-20_2025-10-20_2025-10-20T17-30-45-123Z`

### Partition Key

All statistics use `periodStartDate` (YYYY-MM-DD) as the partition key, enabling efficient queries by date range.

### UPSERT Behavior

The system uses CosmosDB's built-in `upsert()` operation:

1. **First Run of Day** (e.g., 10:00 AM):
   - ID: `detectionSource_2025-10-20`
   - Action: **CREATE** new document
   - Period: `2025-10-20T00:00:00.000Z` to `2025-10-20T23:59:59.999Z`

2. **Second Run of Day** (e.g., 14:00 PM):
   - ID: `detectionSource_2025-10-20` (same)
   - Action: **UPDATE** existing document
   - Period: `2025-10-20T00:00:00.000Z` to `2025-10-20T23:59:59.999Z` (same)

3. **Third Run of Day** (e.g., 20:00 PM):
   - ID: `detectionSource_2025-10-20` (same)
   - Action: **UPDATE** existing document
   - Period: `2025-10-20T00:00:00.000Z` to `2025-10-20T23:59:59.999Z` (same)

**Result**: Only **one document** per day with the latest statistics.

## Timer Configuration

The statistics generation timer runs automatically every hour:

```typescript
// Schedule: Every hour at :00 minutes
schedule: '0 0 * * * *'
```

Next 5 occurrences (example):
- 09:00:00 UTC
- 10:00:00 UTC
- 11:00:00 UTC
- 12:00:00 UTC
- 13:00:00 UTC

## Querying Statistics

### By Specific Date

Get statistics for a specific day:

```bash
GET /api/statistics?type=detectionSource&startDate=2025-10-20&endDate=2025-10-20&code=your-key
```

Response (exactly ONE document per type):
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
        "processingTimeMs": 2345
      },
      "detectionSourceStats": {
        "totalAlerts": 150,
        "sources": [
          { "source": "azureAdIdentityProtection", "count": 45 },
          { "source": "microsoftDefenderForEndpoint", "count": 35 },
          ...
        ]
      }
    }
  ],
  "pagination": {
    "count": 1,
    "hasMore": false
  }
}
```

### By Date Range

Get statistics for multiple days:

```bash
GET /api/statistics?type=userImpact&startDate=2025-10-15&endDate=2025-10-20&code=your-key
```

Returns exactly **6 documents** (one per day: Oct 15-20).

### All Statistics Types for a Day

Query each type separately for the same date to get all 4 statistics files:

```bash
# Detection sources
GET /api/statistics?type=detectionSource&startDate=2025-10-20&endDate=2025-10-20

# User impact
GET /api/statistics?type=userImpact&startDate=2025-10-20&endDate=2025-10-20

# IP threats
GET /api/statistics?type=ipThreats&startDate=2025-10-20&endDate=2025-10-20

# Attack types
GET /api/statistics?type=attackTypes&startDate=2025-10-20&endDate=2025-10-20
```

## Manual Trigger

Generate statistics manually via HTTP endpoint:

```bash
GET /api/trigger/generate-statistics?code=your-function-key
```

Response:
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
      {
        "type": "detectionSource",
        "id": "detectionSource_2025-10-20",
        "alertsProcessed": 150,
        "processingTimeMs": 2234
      },
      {
        "type": "userImpact",
        "id": "userImpact_2025-10-20",
        "alertsProcessed": 150,
        "processingTimeMs": 2145
      },
      {
        "type": "ipThreats",
        "id": "ipThreats_2025-10-20",
        "alertsProcessed": 150,
        "processingTimeMs": 2256
      },
      {
        "type": "attackTypes",
        "id": "attackTypes_2025-10-20",
        "alertsProcessed": 150,
        "processingTimeMs": 2285
      }
    ]
  }
}
```

## Initial Run vs. Daily Run

### Initial Run (First Time)
- **Trigger**: First time statistics generation runs (no existing statistics in database)
- **Period**: Current day only (00:00:00 to 23:59:59.999 UTC)
- **Behavior**: Creates 4 new documents for today
- **Historical Backfill**: To process historical data, trigger manually for each past day

### Daily Run (Subsequent)
- **Trigger**: Timer executes every hour OR manual trigger
- **Period**: Current day only (00:00:00 to 23:59:59.999 UTC)
- **Behavior**: UPSERTs (updates) today's 4 documents

Both runs use identical logic and produce the same results for consistency.

## Security Features

### Input Validation
- **Runtime Type Validation**: Statistics type validated against enum
- **Date Format Validation**: All dates validated in ISO 8601 format
- **Partition Key Validation**: YYYY-MM-DD format verified before use

### Date Handling
- **UTC Time**: All dates use UTC timezone to avoid DST issues
- **Edge Case Protection**: Validates date calculations for year boundaries, leap years
- **Precision**: Uses millisecond precision (86400000ms - 1ms for end of day)

### Error Handling
- **Validation Errors**: Invalid inputs throw `ValidationError` (400)
- **Date Errors**: Invalid date calculations throw `ServiceError` (500)
- **Logging**: All security validations logged for audit trail

## Code Structure

### Modified Files

1. **src/services/AlertStatisticsService.ts**
   - ID generation: `${type}_${periodStartDate}` (no timestamp)
   - Input validation for `type` and `periodStartDate`
   - Date format validation with constants

2. **src/utils/statisticsGenerationHelper.ts**
   - Full day period calculation (00:00:00.000 to 23:59:59.999 UTC)
   - Robust date handling with edge case protection
   - Validation of generated dates

3. **src/functions/generateAlertStatisticsTimer.ts**
   - Timer schedule: `process.env.STATISTICS_TIMER_SCHEDULE || '0 0 * * * *'`
   - Automatic execution every hour

### Key Constants

```typescript
// Date format validation
const DATE_FORMAT_LENGTH = 10; // YYYY-MM-DD
const DATE_FORMAT_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Day duration in milliseconds
const DAY_MS = 86400000; // 24 hours
```

## CosmosDB Storage

### Container: `alerts_statistics`

**Partition Key**: `/periodStartDate`

**Index Policy**: Default (all properties indexed)

**Document Structure**:
```json
{
  "id": "detectionSource_2025-10-20",
  "periodStartDate": "2025-10-20",
  "type": "detectionSource",
  "period": {
    "startDate": "2025-10-20T00:00:00.000Z",
    "endDate": "2025-10-20T23:59:59.999Z",
    "periodType": "daily"
  },
  "generatedAt": "2025-10-20T20:00:15.123Z",
  "processingInfo": {
    "totalAlertsProcessed": 150,
    "processingTimeMs": 2234,
    "lastProcessedAlertDate": "2025-10-20T19:58:32.456Z"
  },
  "detectionSourceStats": { ... },
  "_rid": "...",
  "_etag": "...",
  "_ts": 1729454415
}
```

## Performance Characteristics

### Request Units (RU) Consumption
- **UPSERT operation**: ~10-15 RU per document (depends on size)
- **Query by date**: ~3 RU per batch (with in-memory filtering)
- **Total per generation**: ~50-70 RU (4 types × processing + 4 UPSERTs)

### Execution Time
- **Full generation**: 8-12 seconds (for 4 types)
- **Per type**: 2-3 seconds (depends on alert volume)
- **In-memory filtering**: Minimal overhead (<100ms per batch)

### Scalability
- **Max alerts per batch**: 1000 (configurable via `STATISTICS_BATCH_SIZE`)
- **Pagination**: Automatic for large datasets
- **Memory usage**: Efficient (filters in-memory after fetch)

## Troubleshooting

### Issue: Duplicate Documents

**Symptom**: Multiple documents for the same day

**Cause**: Old statistics (with timestamp in ID) still exist

**Solution**: Old and new formats coexist safely. Query by date range filters correctly.

### Issue: Statistics Not Updating

**Symptom**: `generatedAt` timestamp not changing

**Cause**: Check timer is running and alerts exist for the day

**Solution**:
```bash
# Check Azure Functions logs
func start --verbose

# Manually trigger
curl http://localhost:7071/api/trigger/generate-statistics?code=your-key
```

### Issue: No Statistics Generated

**Symptom**: `totalAlertsProcessed: 0`

**Cause**: No alerts match the date range

**Solution**: Verify alerts exist in `alert_events` container for the current day.

## Migration Notes

### Backward Compatibility

- **Old Format Preserved**: Documents with timestamp in ID remain in database
- **Coexistence**: Both formats work side-by-side
- **No Data Loss**: No migration required

### Historical Backfill

To generate statistics for past days:

**Option 1: Manual Trigger per Day**
```bash
# Modify period in code temporarily for each historical day
# Or create backfill script
```

**Option 2: Backfill Script** (recommended)
```typescript
async function backfillStatistics(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = start; d <= end; d.setDate(d.getDate() + 1)) {
    const dayStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
    const dayEnd = new Date(dayStart.getTime() + 86400000 - 1);

    const period = {
      startDate: dayStart.toISOString(),
      endDate: dayEnd.toISOString(),
      periodType: 'daily'
    };

    await alertStatisticsService.generateStatisticsForPeriod(period, false);
  }
}

// Usage: Backfill Oct 1-20, 2025
await backfillStatistics('2025-10-01', '2025-10-20');
```

## Security Audit Results

**Status**: ✅ **HIGH Priority Issues Resolved**

### Fixed Issues
1. ✅ Runtime validation for `type` parameter
2. ✅ Validation for `periodStartDate` before ID generation
3. ✅ Robust date handling with edge case protection
4. ✅ Comprehensive input validation

### Remaining Recommendations
- 🔄 Implement singleton lock for timer (race condition prevention)
- 🔄 Add rate limiting between statistics types
- 🔄 Add timeout protection for UPSERT operations

See `SECURITY-AUDIT.md` for full security review.

## Testing

### Unit Tests (Recommended)

```typescript
describe('AlertStatisticsService - UPSERT Pattern', () => {
  it('should generate same ID for same day', () => {
    const period1 = determineDailyPeriod();
    const period2 = determineDailyPeriod();

    expect(period1.startDate).toBe(period2.startDate);
    expect(period1.endDate).toBe(period2.endDate);
  });

  it('should cover full day (00:00:00 to 23:59:59.999)', () => {
    const period = determineDailyPeriod();

    expect(period.startDate).toMatch(/T00:00:00.000Z$/);
    expect(period.endDate).toMatch(/T23:59:59.999Z$/);
  });

  it('should validate invalid statistics type', async () => {
    await expect(
      service.generateStatisticsByType('invalid' as any, period, false)
    ).rejects.toThrow(ValidationError);
  });
});
```

### Integration Tests

```bash
# Test 1: Run twice, verify same IDs
curl http://localhost:7071/api/trigger/generate-statistics?code=key
# Note the IDs in response

# Wait 1 minute
curl http://localhost:7071/api/trigger/generate-statistics?code=key
# Verify IDs match (not new IDs with timestamps)

# Test 2: Verify single document per type
curl "http://localhost:7071/api/statistics?type=detectionSource&startDate=2025-10-20&endDate=2025-10-20&code=key"
# Should return exactly ONE document
```

## References

- **CLAUDE.md**: Project development guidelines
- **SOLUTION-SUMMARY.md**: In-memory filtering implementation
- **API_REFERENCE.md**: (Deprecated - see Swagger UI)
- **Swagger UI**: http://localhost:7071/api/swagger

## Support

For issues or questions:
1. Check Azure Functions logs: `func start --verbose`
2. Review CosmosDB query traces in logs
3. Verify environment variables in `local.settings.json`
4. Test endpoints with Swagger UI

---

**Implementation Date**: 2025-10-21
**Last Security Review**: 2025-10-21
**Next Review**: 2025-11-21
