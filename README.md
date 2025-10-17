# Alert Events API - Azure Functions

A production-ready Azure Functions TypeScript project for managing Security Alert Events from Microsoft Graph Security API with CosmosDB storage and Azure Cognitive Search.

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running Locally](#running-locally)
- [API Documentation](#api-documentation)
- [API Endpoints](#api-endpoints)
- [Deployment](#deployment)
- [Development](#development)
- [Security](#security)

## Features

- **Alert Event Management**: Read operations for security alert events from Microsoft Graph Security API
- **Azure CosmosDB Integration**: Reliable NoSQL data storage with automatic scaling
- **Azure Cognitive Search**: Full-text search with filters, field selection, faceting, and semantic search
- **Swagger UI**: Interactive API documentation with OpenAPI 3.0 specification
- **TypeScript**: Strict type safety and modern JavaScript features
- **Modular Architecture**: Clear separation of concerns with layers (functions, services, repositories)
- **Error Handling**: Comprehensive error handling with custom error classes
- **Input Validation**: Robust validation for all incoming requests with SQL injection prevention
- **Structured Logging**: JSON-formatted logs for easy monitoring and debugging
- **Async/Await**: Modern asynchronous patterns throughout
- **Security First**: Parameterized queries, input validation, authentication, and security best practices
- **Pagination**: Support for pagination in both CosmosDB queries and search results (max 100 items per page)
- **Authentication**: Function key-based authentication for all endpoints

## Architecture

The project follows a layered architecture pattern:

```
┌─────────────────────────────────────────┐
│         HTTP Functions Layer            │  (Route handling, request/response)
├─────────────────────────────────────────┤
│          Service Layer                  │  (Business logic)
├─────────────────────────────────────────┤
│      Repository Layer                   │  (Data access)
├─────────────────────────────────────────┤
│         Azure CosmosDB                  │  (Data storage)
└─────────────────────────────────────────┘
```

### Layers

- **Functions Layer** (`src/functions`): HTTP-triggered Azure Functions that handle routing and HTTP concerns
- **Services Layer** (`src/services`): Business logic and orchestration
- **Repository Layer** (`src/repositories`): Data access with CosmosDB
- **Models Layer** (`src/models`): TypeScript interfaces and types
- **Utils Layer** (`src/utils`): Shared utilities (logging, validation, error handling)

## Prerequisites

- **Node.js** 18.x or higher
- **npm** 9.x or higher
- **Azure Functions Core Tools** v4
- **Azure Subscription** (for deployment)
- **Azure CosmosDB** account with database and container configured
- **Azure Cognitive Search** service with index configured
- **Microsoft Graph Security API** access (for alert event data)

## Project Structure

```
it_system_api/
├── src/
│   ├── config/
│   │   ├── environment.ts       # Environment configuration
│   │   └── openapi.ts          # OpenAPI 3.0 specification
│   ├── functions/
│   │   ├── getAllAlertEvents.ts # GET /api/alert-events
│   │   ├── getAlertEventById.ts # GET /api/alert-events/{id}
│   │   ├── searchAlerts.ts      # GET /api/search/alerts
│   │   ├── searchSuggestions.ts # GET /api/search/suggestions
│   │   └── swagger.ts           # Swagger UI endpoints
│   ├── middleware/
│   │   └── authentication.ts    # Function key authentication
│   ├── services/
│   │   ├── AlertEventService.ts # Alert event business logic
│   │   ├── SearchService.ts     # Search business logic
│   │   └── index.ts
│   ├── repositories/
│   │   ├── AlertEventRepository.ts # CosmosDB data access
│   │   ├── SearchRepository.ts     # Azure Cognitive Search data access
│   │   └── index.ts
│   ├── models/
│   │   ├── AlertEvent.ts        # Alert event models and enums
│   │   ├── SearchModels.ts      # Search models and interfaces
│   │   ├── ApiResponse.ts       # API response types
│   │   └── index.ts
│   └── utils/
│       ├── errorHandler.ts      # Error handling utilities
│       ├── logger.ts            # Structured logging
│       └── validator.ts         # Input validation
├── host.json                    # Azure Functions host configuration
├── local.settings.json          # Local environment variables
├── package.json
├── tsconfig.json
├── .funcignore
├── .gitignore
└── README.md
```

## Installation

1. **Clone the repository**:
```bash
git clone <repository-url>
cd it_system_api
```

2. **Install dependencies**:
```bash
npm install
```

3. **Install Azure Functions Core Tools** (if not already installed):
```bash
npm install -g azure-functions-core-tools@4
```

## Configuration

### 1. Azure CosmosDB Setup

Create a CosmosDB account and configure:

**Database Configuration:**
- Database Name: `alert-events-db`
- Container Name: `alert-events`
- Partition Key: `/id`

**Container Settings:**
- Throughput: 400 RU/s (or Autoscale)
- Indexing Policy: Optimize for common queries

**Recommended Indexing Policy:**
```json
{
  "indexingMode": "consistent",
  "includedPaths": [
    {
      "path": "/value/severity/?",
      "indexes": [{ "kind": "Range", "dataType": "String" }]
    },
    {
      "path": "/value/status/?",
      "indexes": [{ "kind": "Range", "dataType": "String" }]
    },
    {
      "path": "/value/category/?",
      "indexes": [{ "kind": "Range", "dataType": "String" }]
    },
    {
      "path": "/value/createdDateTime/?",
      "indexes": [{ "kind": "Range", "dataType": "String" }]
    }
  ],
  "excludedPaths": [
    { "path": "/value/evidence/*" }
  ]
}
```

### 2. Azure Cognitive Search Setup

Create an Azure Cognitive Search service and index:

**Search Service Configuration:**
- Service Name: `your-search-service`
- Pricing Tier: Basic or higher (for production)
- Index Name: `alerts-index`

**Index Fields:**
The index should include the following fields (see full schema in user-provided index structure):
- `id` (String, Key, Filterable, Sortable)
- `title` (String, Searchable, Analyzer: standard.lucene)
- `description` (String, Searchable, Analyzer: standard.lucene)
- `severity` (String, Searchable, Filterable, Sortable, Facetable)
- `status` (String, Searchable, Filterable, Sortable, Facetable)
- `category` (String, Searchable, Filterable, Sortable, Facetable)
- Collection fields: `userAccountNames`, `ipAddresses`, `mitreTechniques`, etc.
- Date fields: `createdDateTime`, `lastUpdateDateTime`, etc.

**Suggester Configuration:**
- Name: `sg`
- Source Fields: `title`, `category`, `description`, `productName`, `detectorId`

**Semantic Configuration** (optional):
- Name: `semantic-config`
- Title Field: `title`
- Content Fields: `description`, `recommendedActions`
- Keywords Fields: `category`, `productName`, `severity`, `detectorId`

### 3. Local Settings

Create or update `local.settings.json`:

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "COSMOS_ENDPOINT": "https://your-cosmos-account.documents.azure.com:443/",
    "COSMOS_KEY": "<your-cosmos-primary-key>",
    "COSMOS_DATABASE_ID": "alert-events-db",
    "COSMOS_CONTAINER_ALERT": "alert-events",
    "SEARCH_ENDPOINT": "https://your-search-service.search.windows.net",
    "SEARCH_API_KEY": "<your-search-admin-key>",
    "SEARCH_INDEX_NAME": "alerts-index",
    "FUNCTION_KEY": "<your-function-key>"
  }
}
```

**⚠️ SECURITY WARNING**:
- **NEVER** commit `local.settings.json` to version control
- Add it to `.gitignore` immediately
- Rotate keys if accidentally exposed
- Use Azure Key Vault for production

### 4. Environment Variables

The application uses the following environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `COSMOS_ENDPOINT` | CosmosDB account endpoint | `https://....documents.azure.com:443/` |
| `COSMOS_KEY` | CosmosDB primary or secondary key | `<your-key>` |
| `COSMOS_DATABASE_ID` | Database name | `alert-events-db` |
| `COSMOS_CONTAINER_ALERT` | Container name | `alert-events` |
| `SEARCH_ENDPOINT` | Azure Cognitive Search endpoint | `https://....search.windows.net` |
| `SEARCH_API_KEY` | Search service admin key | `<your-key>` |
| `SEARCH_INDEX_NAME` | Search index name | `alerts-index` |
| `FUNCTION_KEY` | Function authentication key (optional) | `<your-key>` |

## Running Locally

1. **Build the project**:
```bash
npm run build
```

2. **Start Azure Functions runtime**:
```bash
npm start
```

The API will be available at `http://localhost:7071/api`

3. **Watch mode** (for development):

In separate terminals:

```bash
# Terminal 1: Watch TypeScript compilation
npm run watch

# Terminal 2: Start Functions runtime
npm start
```

## API Documentation

### Swagger UI

Interactive API documentation is available via Swagger UI:

**Local Development:**
```
http://localhost:7071/api/swagger
```

**Production:**
```
https://your-function-app.azurewebsites.net/api/swagger
```

The Swagger UI provides:
- Complete API documentation with request/response examples
- Interactive testing of all endpoints
- Schema definitions for all models
- Try-it-out functionality for testing endpoints directly

**OpenAPI Specification:**

The OpenAPI 3.0 specification is available at:
```
http://localhost:7071/api/swagger/openapi.json
```

You can import this specification into tools like Postman, Insomnia, or other API clients.

## API Endpoints

### Alert Events

#### Get All Alert Events
```
GET /api/alert-events
```

**Query Parameters:**
- `severity` (optional): Filter by severity (`informational`, `low`, `medium`, `high`, `critical`)
- `status` (optional): Filter by status (`new`, `inProgress`, `resolved`)
- `category` (optional): Filter by MITRE ATT&CK category
- `createdDateTime` (optional): Filter by creation date (ISO 8601)
- `resolvedDateTime` (optional): Filter by resolution date (ISO 8601)

**Example:**
```bash
curl "http://localhost:7071/api/alert-events?severity=high&status=new"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "4ca57b0e-1851-4966-a375-fa9c69e9d273",
      "alertId": "ad70a5593fb59b890a1ec64a180b1a9a49aa8a1cba",
      "title": "Unfamiliar sign-in properties",
      "severity": "high",
      "status": "resolved",
      "category": "InitialAccess",
      "createdDateTime": "2025-10-10T22:48:46.0633333Z",
      ...
    }
  ],
  "timestamp": "2025-10-16T14:30:00.000Z"
}
```

#### Get Alert Event by ID
```
GET /api/alert-events/{id}
```

**Path Parameters:**
- `id`: Alert event document ID (UUID)

**Example:**
```bash
curl "http://localhost:7071/api/alert-events/4ca57b0e-1851-4966-a375-fa9c69e9d273"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "4ca57b0e-1851-4966-a375-fa9c69e9d273",
    "alertId": "ad70a5593fb59b890a1ec64a180b1a9a49aa8a1cba",
    "title": "Unfamiliar sign-in properties",
    "severity": "high",
    "status": "resolved",
    "category": "InitialAccess",
    "classification": "truePositive",
    "createdDateTime": "2025-10-10T22:48:46.0633333Z",
    "evidence": [...],
    ...
  },
  "timestamp": "2025-10-16T14:30:00.000Z"
}
```

### Search

#### Search Alerts
```
GET /api/search/alerts
```

Full-text search across alert events using Azure Cognitive Search with advanced filtering and field selection.

**Query Parameters:**
- `q` or `search` (optional): Search text for full-text search
- `severity` (optional): Filter by severity (comma-separated)
- `status` (optional): Filter by status (comma-separated)
- `category` (optional): Filter by category (comma-separated)
- `classification` (optional): Filter by classification (comma-separated)
- `productName` (optional): Filter by product name (comma-separated)
- `detectionSource` (optional): Filter by detection source (comma-separated)
- `serviceSource` (optional): Filter by service source (comma-separated)
- `incidentId` (optional): Filter by incident ID
- `tenantId` (optional): Filter by tenant ID
- `assignedTo` (optional): Filter by assigned user
- `createdDateStart` (optional): Filter by created date start (ISO 8601)
- `createdDateEnd` (optional): Filter by created date end (ISO 8601)
- `resolvedDateStart` (optional): Filter by resolved date start (ISO 8601)
- `resolvedDateEnd` (optional): Filter by resolved date end (ISO 8601)
- `select` (optional): Select specific fields (comma-separated)
- `orderBy` (optional): Order results (e.g., "createdDateTime desc")
- `top` (optional): Number of results to return (max 100, default 50)
- `skip` (optional): Number of results to skip for pagination
- `searchMode` (optional): Search mode for multiple terms (`any` or `all`)
- `highlight` (optional): Fields to highlight (comma-separated)
- `facets` (optional): Fields to return facet counts (comma-separated)
- `semantic` (optional): Enable semantic search (`true` or `false`)

**Example - Basic Search:**
```bash
curl "http://localhost:7071/api/search/alerts?q=phishing&severity=high,critical"
```

**Example - Advanced Search with Field Selection:**
```bash
curl "http://localhost:7071/api/search/alerts?q=failed%20login&select=id,title,severity,status,createdDateTime&orderBy=createdDateTime%20desc&top=20"
```

**Example - Search with Facets:**
```bash
curl "http://localhost:7071/api/search/alerts?q=*&facets=severity,status,category&top=10"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": "a286de18-c902-4617-ba02-c07b14a4412b",
        "category": "InitialAccess",
        "title": "Email reported by user as junk",
        "severity": "low",
        "status": "new",
        "createdDateTime": "2025-10-10T14:53:14.103Z",
        "@search.score": 1.0,
        ...
      }
    ],
    "count": 10,
    "totalCount": 150,
    "facets": {
      "severity": [
        { "value": "high", "count": 45 },
        { "value": "medium", "count": 32 }
      ],
      "status": [
        { "value": "new", "count": 89 },
        { "value": "inProgress", "count": 61 }
      ]
    },
    "pagination": {
      "top": 10,
      "skip": 0
    }
  },
  "timestamp": "2025-10-17T14:30:00.000Z"
}
```

#### Search Suggestions
```
GET /api/search/suggestions
```

Get search suggestions or autocomplete results for alert events.

**Query Parameters:**
- `q` or `search` (required): Search text (minimum 2 characters)
- `top` (optional): Number of suggestions to return (max 20, default 5)
- `mode` (optional): Suggestion mode (`suggest` or `autocomplete`, default `suggest`)

**Example - Suggestions:**
```bash
curl "http://localhost:7071/api/search/suggestions?q=phish&mode=suggest&top=5"
```

**Example - Autocomplete:**
```bash
curl "http://localhost:7071/api/search/suggestions?q=phish&mode=autocomplete&top=5"
```

**Response (Suggest mode):**
```json
{
  "success": true,
  "data": {
    "suggestions": [
      {
        "text": "Email reported by user as phishing",
        "document": {
          "id": "...",
          "title": "Email reported by user as phishing",
          "severity": "medium",
          "status": "new",
          "category": "InitialAccess"
        }
      }
    ],
    "count": 5,
    "mode": "suggest"
  },
  "timestamp": "2025-10-17T14:30:00.000Z"
}
```

**Response (Autocomplete mode):**
```json
{
  "success": true,
  "data": {
    "suggestions": [
      "phishing",
      "phishing attack",
      "phishing email"
    ],
    "count": 3,
    "mode": "autocomplete"
  },
  "timestamp": "2025-10-17T14:30:00.000Z"
}
```

### Documentation

#### Swagger UI
```
GET /api/swagger
```
Returns the interactive Swagger UI interface.

#### OpenAPI Specification
```
GET /api/swagger/openapi.json
```
Returns the OpenAPI 3.0 specification in JSON format.

## Deployment

### Deploy to Azure

1. **Create Azure Function App**:
```bash
az functionapp create \
  --resource-group <resource-group> \
  --consumption-plan-location <location> \
  --runtime node \
  --runtime-version 18 \
  --functions-version 4 \
  --name <function-app-name> \
  --storage-account <storage-account>
```

2. **Configure Application Settings**:
```bash
az functionapp config appsettings set \
  --name <function-app-name> \
  --resource-group <resource-group> \
  --settings \
    COSMOS_ENDPOINT="https://your-cosmos.documents.azure.com:443/" \
    COSMOS_KEY="<your-key>" \
    COSMOS_DATABASE_NAME="alert-events-db" \
    COSMOS_CONTAINER_NAME="alert-events"
```

3. **Deploy the application**:
```bash
npm run build
func azure functionapp publish <function-app-name>
```

### Production Checklist

- [ ] Migrate secrets to Azure Key Vault
- [ ] Configure CORS with specific allowed origins
- [ ] Enable Application Insights
- [ ] Set up monitoring and alerts
- [ ] Configure authentication (Function Keys or Azure AD)
- [ ] Review and optimize CosmosDB indexing policy
- [ ] Set up CI/CD pipeline
- [ ] Configure rate limiting (API Management)
- [ ] Review security settings

## Development

### Available Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run watch` - Watch TypeScript files for changes
- `npm run clean` - Remove dist folder
- `npm start` - Start Azure Functions runtime
- `npm run lint` - Run ESLint (if configured)

### Code Quality

The project follows strict TypeScript configuration:
- Strict mode enabled
- No implicit any
- Strict null checks
- Strict function types

### Testing

Run tests (when implemented):
```bash
npm test
```

## Security

### Implemented Security Features

1. **SQL Injection Prevention**: Parameterized queries for all CosmosDB operations
2. **Input Validation**: Enum-based validation for severity, status, category
3. **Date Validation**: ISO 8601 format validation
4. **Error Handling**: Custom error classes with appropriate HTTP status codes
5. **Structured Logging**: Security events logged for audit trails

### Security Best Practices

1. **Secrets Management**:
   - Never commit `local.settings.json`
   - Use Azure Key Vault for production secrets
   - Rotate keys regularly

2. **Authentication**:
   - Use Function Keys for basic authentication
   - Consider Azure AD for enterprise scenarios

3. **CORS**:
   - Restrict allowed origins in production
   - Never use `*` in production environments

4. **Rate Limiting**:
   - Implement via Azure API Management
   - Or use custom middleware

5. **Monitoring**:
   - Enable Application Insights
   - Set up alerts for anomalous activity
   - Review logs regularly

## CosmosDB Document Structure

Alert events are stored with the following structure:

```json
{
  "id": "4ca57b0e-1851-4966-a375-fa9c69e9d273",  // Partition key
  "value": {
    "id": "ad70a5593fb59b890a1ec64a180b1a9a49aa8a1cba",  // Alert ID
    "title": "Unfamiliar sign-in properties",
    "severity": "high",
    "status": "resolved",
    "category": "InitialAccess",
    "classification": "truePositive",
    "createdDateTime": "2025-10-10T22:48:46.0633333Z",
    "evidence": [...],
    // ... other Microsoft Graph Security Alert properties
  },
  "_rid": "...",
  "_etag": "...",
  "_ts": 1760538905
}
```

**Key Points:**
- Document-level `id` is the partition key
- Alert data is nested under `value` property
- Queries use `c.value.property` pattern

## Troubleshooting

### Functions Not Loading

**Error**: `Worker was unable to load entry point "dist/src/functions/*.js"`

**Solution**: Ensure `.funcignore` exists and excludes TypeScript source files.

### CosmosDB Connection Issues

**Error**: `Failed to fetch alert events`

**Solutions**:
1. Verify CosmosDB endpoint and key in `local.settings.json`
2. Check network connectivity to CosmosDB
3. Ensure database and container exist
4. Verify partition key configuration (`/id`)

### Invalid Partition Key Error

**Error**: `Invalid \partitionKey`

**Solution**: Ensure queries include `maxItemCount` option for cross-partition queries.

## Support

For issues or questions:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review Azure Functions logs
3. Verify CosmosDB connection and configuration
4. Check Swagger UI for API documentation

## License

[Your License Here]

## Contributing

[Your Contributing Guidelines Here]
