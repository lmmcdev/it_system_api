# Troubleshooting: Azure Functions "No Job Functions Found" Error

## Problem Summary

Azure Functions runtime fails to load any functions with the following error:

```
[2025-10-23T15:17:45.184Z] Generating 0 job function(s)
[2025-10-23T15:17:45.184Z] No job functions found. Try making your job classes and methods public...
[2025-10-23T15:17:45.190Z] Initializing function HTTP routes
[2025-10-23T15:17:45.190Z] No HTTP routes mapped
```

## Root Cause

**Missing Required Environment Variable**: The vulnerability management feature requires the `COSMOS_CONTAINER_VULNERABILITIES_DEFENDER` environment variable, which was not present in `local.settings.json`.

### Why This Causes Complete Failure

1. Azure Functions runtime loads function files from `dist/src/functions/`
2. Function files import dependencies, including `src/config/environment.ts`
3. **Environment validation runs at module load time** (when the file is imported)
4. If validation fails, it throws an error: `Missing required environment variables: COSMOS_CONTAINER_VULNERABILITIES_DEFENDER`
5. The entire Node.js worker process fails to initialize
6. Result: **Zero functions load**, even functions that don't use vulnerabilities

### Technical Details

The issue manifests in the verbose logs as:

```
[2025-10-23T15:20:14.616Z] Loading entry point file "dist/src/functions/createVulnerability.js"
[2025-10-23T15:20:14.616Z] Worker was unable to load entry point "dist/src/functions/createVulnerability.js":
Missing required environment variables: COSMOS_CONTAINER_VULNERABILITIES_DEFENDER
[2025-10-23T15:20:14.703Z] 0 functions found (Host)
```

## Solution

Add the missing environment variable to `local.settings.json`:

### Step 1: Edit local.settings.json

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "COSMOS_ENDPOINT": "https://your-cosmos.documents.azure.com:443/",
    "COSMOS_KEY": "your-cosmos-key",
    "COSMOS_DATABASE_ID": "it-system",
    "COSMOS_CONTAINER_ALERT": "alert_events",
    "COSMOS_CONTAINER_RISK_DETECTION": "risk_detection_events",
    "COSMOS_CONTAINER_ALERT_STATISTICS": "alerts_statistics",
    "COSMOS_CONTAINER_DEVICES_INTUNE": "devices_intune",
    "COSMOS_CONTAINER_DEVICES_DEFENDER": "devices_defender",
    "COSMOS_CONTAINER_VULNERABILITIES_DEFENDER": "vulnerabilities_defender",  // <-- ADD THIS LINE
    // ... rest of configuration
  }
}
```

### Step 2: Rebuild and Restart

```bash
npm run build
npm start
```

### Step 3: Verify Success

You should see output similar to:

```
Functions:

	createVulnerability: [POST] http://localhost:7081/api/vulnerabilities
	deleteVulnerability: [DELETE] http://localhost:7081/api/vulnerabilities/{id}
	getAlertEventById: [GET] http://localhost:7081/api/alert-events/{id}
	getAllAlertEvents: [GET] http://localhost:7081/api/alert-events
	... (31 HTTP functions total)

	generateAlertStatisticsTimer: timerTrigger
	syncDefenderDevicesTimer: timerTrigger
	syncManagedDevicesTimer: timerTrigger

Host started (237ms)
Job host started
```

## Complete List of Required Environment Variables

Based on `src/config/environment.ts`, the following variables are **strictly required**:

### CosmosDB Configuration (Required)
```
COSMOS_ENDPOINT                              # CosmosDB endpoint URL
COSMOS_KEY                                   # CosmosDB access key
COSMOS_DATABASE_ID                           # Database name (e.g., "it-system")
COSMOS_CONTAINER_ALERT                       # Alert events container
COSMOS_CONTAINER_RISK_DETECTION              # Risk detection events container
COSMOS_CONTAINER_DEVICES_INTUNE              # Intune managed devices container
COSMOS_CONTAINER_DEVICES_DEFENDER            # Defender devices container
COSMOS_CONTAINER_VULNERABILITIES_DEFENDER    # Vulnerabilities container (NEW)
```

### Azure Cognitive Search Configuration (Required)
```
SEARCH_ENDPOINT                              # Search service endpoint
SEARCH_API_KEY                               # Search service admin key
SEARCH_INDEX_NAME                            # Search index name (e.g., "alerts-index")
```

### Optional Configuration (with defaults)
```
COSMOS_CONTAINER_ALERT_STATISTICS            # Default: "alerts_statistics"
STATISTICS_BATCH_SIZE                        # Default: "100"
STATISTICS_TOP_N_DEFAULT                     # Default: "10"
STATISTICS_TIMER_SCHEDULE                    # Default: "0 0 * * * *" (hourly)
DEVICE_SYNC_BATCH_SIZE                       # Default: "100"
DEVICE_SYNC_TIMER_SCHEDULE                   # Default: "0 0 */6 * * *" (every 6 hours)
DEFENDER_SYNC_BATCH_SIZE                     # Default: "100"
DEFENDER_SYNC_TIMER_SCHEDULE                 # Default: "0 0 */6 * * *"
NODE_ENV                                     # Default: "development"
LOG_LEVEL                                    # Default: "info"
FUNCTION_KEY                                 # Optional: For authentication validation
GRAPH_CLIENT_ID                              # Optional: Microsoft Graph API
GRAPH_TENANT_ID                              # Optional: Microsoft Graph API
GRAPH_CLIENT_SECRET                          # Optional: Microsoft Graph API
GRAPH_SCOPE                                  # Default: "https://graph.microsoft.com/.default"
DEFENDER_CLIENT_ID                           # Optional: Defender API (falls back to GRAPH_CLIENT_ID)
DEFENDER_TENANT_ID                           # Optional: Defender API (falls back to GRAPH_TENANT_ID)
DEFENDER_CLIENT_SECRET                       # Optional: Defender API (falls back to GRAPH_CLIENT_SECRET)
DEFENDER_SCOPE                               # Default: "https://api.securitycenter.microsoft.com/.default"
```

## Debugging Steps for Similar Issues

If you encounter "No job functions found" errors in the future:

### 1. Check Verbose Logs

```bash
func start --verbose 2>&1 | tee function-startup.log
```

Look for lines containing:
- `Worker was unable to load entry point`
- `Missing required environment variables`
- Any exceptions during module loading

### 2. Verify Build Output

```bash
npm run build
ls -la dist/src/functions/
```

Ensure:
- TypeScript compiles without errors
- JavaScript files exist in `dist/src/functions/`
- Each function has corresponding `.js` and `.js.map` files

### 3. Test Environment Configuration Manually

```bash
node -e "require('./dist/src/config/environment.js'); console.log('Environment OK')"
```

This will fail immediately if required variables are missing.

### 4. Check .funcignore

Ensure `.funcignore` doesn't exclude the `dist/` folder:

```
# .funcignore should have:
src/           # Exclude TypeScript source
*.ts           # Exclude TypeScript files
!dist/         # INCLUDE dist folder
```

### 5. Verify host.json

Ensure `host.json` is configured for Azure Functions v4:

```json
{
  "version": "2.0",
  "extensionBundle": {
    "id": "Microsoft.Azure.Functions.ExtensionBundle",
    "version": "[4.*, 5.0.0)"
  }
}
```

## Architectural Consideration: Environment Validation Timing

### Current Behavior (Module-Level Validation)

```typescript
// src/config/environment.ts
export function getEnvironmentConfig(): EnvironmentConfig {
  const requiredVars = [...];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
  // ...
}

// This runs when the module is imported
export const config = getEnvironmentConfig();
```

**Pros:**
- Fails fast - catches configuration errors immediately
- Prevents partial system initialization with bad configuration
- Clear error messages at startup

**Cons:**
- **Single missing variable breaks ALL functions** (even unrelated ones)
- No graceful degradation
- Difficult to run subset of functionality

### Alternative Approach (Lazy Validation)

For future consideration, you could implement lazy validation:

```typescript
// Only validate when config is actually accessed
export function getEnvironmentConfig(): EnvironmentConfig {
  return {
    cosmos: {
      get vulnerabilitiesDefenderContainerId() {
        const value = process.env.COSMOS_CONTAINER_VULNERABILITIES_DEFENDER;
        if (!value) {
          throw new Error('Missing COSMOS_CONTAINER_VULNERABILITIES_DEFENDER');
        }
        return value;
      }
    }
  };
}
```

This would allow non-vulnerability functions to work even if `COSMOS_CONTAINER_VULNERABILITIES_DEFENDER` is missing.

## Related Files

- **E:\it_system_api\src\config\environment.ts** - Environment validation logic
- **E:\it_system_api\local.settings.json** - Local environment configuration
- **E:\it_system_api\.funcignore** - Controls which files Azure Functions loads
- **E:\it_system_api\host.json** - Azure Functions host configuration
- **E:\it_system_api\tsconfig.json** - TypeScript compilation settings

## Date

Fixed: 2025-10-23

## Author

Claude Code (Azure Functions Architecture Expert)
