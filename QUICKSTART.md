# IT System API - Quick Start Guide

Get your IT System API up and running in 5 minutes!

## Prerequisites Checklist

- [ ] Node.js 18+ installed
- [ ] npm installed
- [ ] Azure Functions Core Tools v4 installed
- [ ] Azure account with CosmosDB and Cognitive Search (or ready to create)

## Step 1: Install Dependencies (1 minute)

```bash
cd E:\it_system_api
npm install
```

## Step 2: Configure Environment (2 minutes)

### Option A: Local Development with Azure Resources

Edit `E:\it_system_api\local.settings.json`:

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "COSMOS_ENDPOINT": "https://YOUR-ACCOUNT.documents.azure.com:443/",
    "COSMOS_KEY": "YOUR-COSMOS-KEY",
    "COSMOS_DATABASE_ID": "it-system-db",
    "COSMOS_CONTAINER_ID": "it-system",
    "SEARCH_ENDPOINT": "https://YOUR-SEARCH.search.windows.net",
    "SEARCH_API_KEY": "YOUR-SEARCH-KEY",
    "SEARCH_INDEX_NAME": "it-systems-index",
    "NODE_ENV": "development",
    "LOG_LEVEL": "info"
  },
  "Host": {
    "LocalHttpPort": 7071,
    "CORS": "*"
  }
}
```

**Get your Azure credentials:**

1. **CosmosDB**:
   - Go to Azure Portal > Your CosmosDB Account > Keys
   - Copy URI (COSMOS_ENDPOINT)
   - Copy Primary Key (COSMOS_KEY)

2. **Cognitive Search**:
   - Go to Azure Portal > Your Search Service > Keys
   - Copy URL (SEARCH_ENDPOINT)
   - Copy Admin Key (SEARCH_API_KEY)

### Option B: Mock/Development Mode (Coming Soon)

For development without Azure resources, use the included mock services.

## Step 3: Create Azure Resources (if needed)

### Create CosmosDB Resources

```bash
# Create database
az cosmosdb sql database create \
  --account-name YOUR-ACCOUNT \
  --resource-group YOUR-RG \
  --name it-system-db

# Create container
az cosmosdb sql container create \
  --account-name YOUR-ACCOUNT \
  --resource-group YOUR-RG \
  --database-name it-system-db \
  --name it-system \
  --partition-key-path "/id" \
  --throughput 400
```

### Create Search Index

Use Azure Portal or REST API to create index with this schema:

```json
{
  "name": "it-systems-index",
  "fields": [
    {"name": "id", "type": "Edm.String", "key": true, "searchable": false},
    {"name": "name", "type": "Edm.String", "searchable": true, "filterable": true, "sortable": true},
    {"name": "description", "type": "Edm.String", "searchable": true},
    {"name": "owner", "type": "Edm.String", "searchable": true, "filterable": true},
    {"name": "department", "type": "Edm.String", "searchable": true, "filterable": true, "facetable": true},
    {"name": "status", "type": "Edm.String", "filterable": true, "facetable": true},
    {"name": "technology", "type": "Collection(Edm.String)", "searchable": true, "filterable": true},
    {"name": "version", "type": "Edm.String", "searchable": true},
    {"name": "criticality", "type": "Edm.String", "filterable": true, "facetable": true},
    {"name": "tags", "type": "Collection(Edm.String)", "searchable": true, "filterable": true}
  ]
}
```

## Step 4: Build and Run (1 minute)

```bash
# Build TypeScript
npm run build

# Start the Functions runtime
npm start
```

You should see output like:

```
Azure Functions Core Tools
Core Tools Version:       4.x.x
Function Runtime Version: 4.x.x

Functions:
  createITSystem: [POST] http://localhost:7071/api/it-systems
  getAllITSystems: [GET] http://localhost:7071/api/it-systems
  getITSystemById: [GET] http://localhost:7071/api/it-systems/{id}
  updateITSystem: [PUT,PATCH] http://localhost:7071/api/it-systems/{id}
  deleteITSystem: [DELETE] http://localhost:7071/api/it-systems/{id}
  searchITSystems: [GET] http://localhost:7071/api/search/it-systems
  advancedSearch: [POST] http://localhost:7071/api/search/advanced
  searchByDepartment: [GET] http://localhost:7071/api/search/department/{department}
  searchSuggestions: [GET] http://localhost:7071/api/search/suggestions

For detailed output, run func with --verbose flag.
```

## Step 5: Test the API (1 minute)

### Create your first IT System

```bash
curl -X POST http://localhost:7071/api/it-systems \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Customer Portal",
    "description": "Main customer-facing portal",
    "owner": "John Doe",
    "department": "Engineering",
    "status": "Active",
    "technology": ["React", "Node.js", "PostgreSQL"],
    "version": "1.0.0",
    "deploymentDate": "2024-01-15T00:00:00Z",
    "criticality": "Critical",
    "tags": ["web", "customer-facing"]
  }'
```

### Get all IT Systems

```bash
curl http://localhost:7071/api/it-systems
```

### Search IT Systems

```bash
curl "http://localhost:7071/api/search/it-systems?q=customer"
```

## Development Workflow

### Watch Mode (Recommended)

For active development, use watch mode:

**Terminal 1** - TypeScript compiler in watch mode:
```bash
npm run watch
```

**Terminal 2** - Azure Functions runtime:
```bash
npm start
```

Now any changes to `.ts` files will automatically recompile!

### Single Terminal Mode

Or use this approach:

```bash
# Make changes to .ts files
# When ready to test:
npm run build && npm start
```

## Common Commands

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Clean build artifacts
npm run clean

# Rebuild from scratch
npm run prebuild && npm run build

# Start Functions locally
npm start

# Watch TypeScript for changes
npm run watch

# Run linter
npm run lint

# Fix linting issues
npm run lint:fix
```

## Testing with Postman

Import this collection to test all endpoints:

1. Create new Postman collection: "IT System API"
2. Set base URL variable: `{{baseUrl}}` = `http://localhost:7071/api`
3. Import requests from `API_REFERENCE.md`

## Troubleshooting Quick Fixes

### Error: "Missing required environment variables"

**Fix**: Check `local.settings.json` has all required variables set.

### Error: "Failed to initialize database connection"

**Fix**: Verify CosmosDB endpoint and key are correct. Test connection in Azure Portal.

### Error: "Cannot find module"

**Fix**: Run `npm install` and `npm run build`

### Error: Port 7071 already in use

**Fix**:
```bash
# Windows
netstat -ano | findstr :7071
taskkill /PID <PID> /F

# Linux/Mac
lsof -i :7071
kill -9 <PID>
```

### TypeScript errors

**Fix**:
```bash
npm run clean
npm run build
```

## Next Steps

1. **Read the documentation**:
   - `README.md` - Complete setup guide
   - `API_REFERENCE.md` - Full API documentation
   - `PROJECT_SUMMARY.md` - Architecture overview

2. **Explore the code**:
   - `src/functions/` - HTTP endpoints
   - `src/services/` - Business logic
   - `src/repositories/` - Data access
   - `src/models/` - Type definitions

3. **Customize for your needs**:
   - Add new fields to IT System model
   - Create additional endpoints
   - Implement authentication
   - Add custom validation rules

4. **Deploy to Azure**:
   - See README.md "Deployment" section
   - Configure CI/CD pipeline
   - Set up monitoring

## Quick Reference Card

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/it-systems` | Create IT system |
| GET | `/api/it-systems` | Get all IT systems |
| GET | `/api/it-systems/{id}` | Get by ID |
| PUT/PATCH | `/api/it-systems/{id}` | Update IT system |
| DELETE | `/api/it-systems/{id}` | Delete IT system |
| GET | `/api/search/it-systems` | Basic search |
| POST | `/api/search/advanced` | Advanced search |
| GET | `/api/search/department/{dept}` | Search by dept |
| GET | `/api/search/suggestions` | Autocomplete |

### Key Files

| File | Purpose |
|------|---------|
| `local.settings.json` | Local configuration |
| `host.json` | Functions runtime config |
| `package.json` | Dependencies |
| `tsconfig.json` | TypeScript config |

### Project Structure

```
src/
├── config/         # Environment config
├── functions/      # HTTP endpoints
├── services/       # Business logic
├── repositories/   # Data access
├── models/         # Type definitions
└── utils/          # Shared utilities
```

## Support Resources

- **Full Documentation**: `README.md`
- **API Reference**: `API_REFERENCE.md`
- **Architecture**: `PROJECT_SUMMARY.md`
- **Azure Docs**: https://docs.microsoft.com/azure/azure-functions/

## Success Checklist

- [ ] Dependencies installed
- [ ] Azure resources created (CosmosDB + Search)
- [ ] Configuration set in `local.settings.json`
- [ ] Project builds successfully (`npm run build`)
- [ ] Functions start successfully (`npm start`)
- [ ] Can create IT system via POST
- [ ] Can retrieve IT systems via GET
- [ ] Search functionality works

## You're All Set!

Your IT System API is now running!

**API Base URL**: `http://localhost:7071/api`

Start making requests and building amazing things! 🚀
