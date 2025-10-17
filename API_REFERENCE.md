# IT System API - Complete API Reference

## Base URL

**Local Development**: `http://localhost:7071/api`
**Production**: `https://<your-function-app>.azurewebsites.net/api`

## Response Format

All API responses follow this structure:

```typescript
{
  "success": boolean,
  "data": T | undefined,           // Present on success
  "error": {                        // Present on error
    "code": string,
    "message": string,
    "details": unknown
  } | undefined,
  "timestamp": string               // ISO 8601 format
}
```

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success (GET, PUT, PATCH) |
| 201 | Created (POST) |
| 204 | Success - No Content (DELETE) |
| 400 | Bad Request (validation error) |
| 404 | Not Found |
| 409 | Conflict |
| 500 | Internal Server Error |

---

## CRUD Endpoints

### 1. Create IT System

Creates a new IT system in the database.

**Endpoint**: `POST /api/it-systems`

**Request Headers**:
```
Content-Type: application/json
```

**Request Body**:
```json
{
  "name": "string (required)",
  "description": "string (required)",
  "owner": "string (required)",
  "department": "string (required)",
  "status": "Active | Inactive | Development | Deprecated | Maintenance (required)",
  "technology": ["string"] (required, non-empty array),
  "version": "string (required)",
  "deploymentDate": "ISO 8601 date (required)",
  "tags": ["string"] (optional),
  "criticality": "Critical | High | Medium | Low (required)",
  "metadata": {
    "key": "value"  (optional)
  }
}
```

**Example Request**:
```bash
curl -X POST http://localhost:7071/api/it-systems \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Customer Portal",
    "description": "Main customer-facing web portal for account management",
    "owner": "John Doe",
    "department": "Engineering",
    "status": "Active",
    "technology": ["React", "Node.js", "PostgreSQL", "Redis"],
    "version": "2.1.0",
    "deploymentDate": "2024-01-15T00:00:00Z",
    "criticality": "Critical",
    "tags": ["web", "customer-facing", "production"],
    "metadata": {
      "region": "us-east-1",
      "environment": "production"
    }
  }'
```

**Success Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "itsys_1705276800000_abc123",
    "name": "Customer Portal",
    "description": "Main customer-facing web portal for account management",
    "owner": "John Doe",
    "department": "Engineering",
    "status": "Active",
    "technology": ["React", "Node.js", "PostgreSQL", "Redis"],
    "version": "2.1.0",
    "deploymentDate": "2024-01-15T00:00:00.000Z",
    "lastUpdated": "2024-01-20T10:30:00.000Z",
    "tags": ["web", "customer-facing", "production"],
    "criticality": "Critical",
    "metadata": {
      "region": "us-east-1",
      "environment": "production"
    }
  },
  "timestamp": "2024-01-20T10:30:00.000Z"
}
```

**Error Response** (400 Validation Error):
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "name",
        "message": "Name is required and must be a non-empty string"
      }
    ]
  },
  "timestamp": "2024-01-20T10:30:00.000Z"
}
```

---

### 2. Get All IT Systems

Retrieves all IT systems with optional filtering.

**Endpoint**: `GET /api/it-systems`

**Query Parameters**:
- `department` (optional): Filter by department name
- `status` (optional): Filter by status

**Example Requests**:
```bash
# Get all IT systems
curl http://localhost:7071/api/it-systems

# Filter by department
curl http://localhost:7071/api/it-systems?department=Engineering

# Filter by status
curl http://localhost:7071/api/it-systems?status=Active

# Multiple filters
curl http://localhost:7071/api/it-systems?department=Engineering&status=Active
```

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "itsys_1705276800000_abc123",
      "name": "Customer Portal",
      "description": "Main customer-facing web portal",
      "owner": "John Doe",
      "department": "Engineering",
      "status": "Active",
      "technology": ["React", "Node.js"],
      "version": "2.1.0",
      "deploymentDate": "2024-01-15T00:00:00.000Z",
      "lastUpdated": "2024-01-20T10:30:00.000Z",
      "tags": ["web", "customer-facing"],
      "criticality": "Critical"
    },
    {
      "id": "itsys_1705276900000_def456",
      "name": "Admin Dashboard",
      "description": "Internal admin dashboard",
      "owner": "Jane Smith",
      "department": "Engineering",
      "status": "Active",
      "technology": ["Vue.js", "Python"],
      "version": "1.5.0",
      "deploymentDate": "2023-11-01T00:00:00.000Z",
      "lastUpdated": "2024-01-18T14:20:00.000Z",
      "tags": ["internal", "admin"],
      "criticality": "High"
    }
  ],
  "timestamp": "2024-01-20T10:35:00.000Z"
}
```

---

### 3. Get IT System by ID

Retrieves a specific IT system by its ID.

**Endpoint**: `GET /api/it-systems/{id}`

**Path Parameters**:
- `id` (required): The IT system ID

**Example Request**:
```bash
curl http://localhost:7071/api/it-systems/itsys_1705276800000_abc123
```

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "itsys_1705276800000_abc123",
    "name": "Customer Portal",
    "description": "Main customer-facing web portal",
    "owner": "John Doe",
    "department": "Engineering",
    "status": "Active",
    "technology": ["React", "Node.js", "PostgreSQL"],
    "version": "2.1.0",
    "deploymentDate": "2024-01-15T00:00:00.000Z",
    "lastUpdated": "2024-01-20T10:30:00.000Z",
    "tags": ["web", "customer-facing"],
    "criticality": "Critical"
  },
  "timestamp": "2024-01-20T10:40:00.000Z"
}
```

**Error Response** (404 Not Found):
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "IT System with ID 'invalid_id' not found"
  },
  "timestamp": "2024-01-20T10:40:00.000Z"
}
```

---

### 4. Update IT System

Updates an existing IT system. Supports both PUT and PATCH methods.

**Endpoint**: `PUT /api/it-systems/{id}` or `PATCH /api/it-systems/{id}`

**Path Parameters**:
- `id` (required): The IT system ID

**Request Headers**:
```
Content-Type: application/json
```

**Request Body** (all fields optional, at least one required):
```json
{
  "name": "string (optional)",
  "description": "string (optional)",
  "owner": "string (optional)",
  "department": "string (optional)",
  "status": "Active | Inactive | Development | Deprecated | Maintenance (optional)",
  "technology": ["string"] (optional),
  "version": "string (optional)",
  "deploymentDate": "ISO 8601 date (optional)",
  "tags": ["string"] (optional),
  "criticality": "Critical | High | Medium | Low (optional)",
  "metadata": {
    "key": "value"  (optional)
  }
}
```

**Example Request**:
```bash
curl -X PUT http://localhost:7071/api/it-systems/itsys_1705276800000_abc123 \
  -H "Content-Type: application/json" \
  -d '{
    "version": "2.2.0",
    "status": "Active",
    "technology": ["React", "Node.js", "PostgreSQL", "Redis", "Docker"]
  }'
```

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "itsys_1705276800000_abc123",
    "name": "Customer Portal",
    "description": "Main customer-facing web portal",
    "owner": "John Doe",
    "department": "Engineering",
    "status": "Active",
    "technology": ["React", "Node.js", "PostgreSQL", "Redis", "Docker"],
    "version": "2.2.0",
    "deploymentDate": "2024-01-15T00:00:00.000Z",
    "lastUpdated": "2024-01-20T11:00:00.000Z",
    "tags": ["web", "customer-facing"],
    "criticality": "Critical"
  },
  "timestamp": "2024-01-20T11:00:00.000Z"
}
```

---

### 5. Delete IT System

Deletes an IT system by ID.

**Endpoint**: `DELETE /api/it-systems/{id}`

**Path Parameters**:
- `id` (required): The IT system ID

**Example Request**:
```bash
curl -X DELETE http://localhost:7071/api/it-systems/itsys_1705276800000_abc123
```

**Success Response** (204 No Content):
```json
{
  "success": true,
  "data": {
    "message": "IT system deleted successfully",
    "id": "itsys_1705276800000_abc123"
  },
  "timestamp": "2024-01-20T11:05:00.000Z"
}
```

**Error Response** (404 Not Found):
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "IT System with ID 'invalid_id' not found"
  },
  "timestamp": "2024-01-20T11:05:00.000Z"
}
```

---

## Search Endpoints

### 6. Basic Search

Performs a basic search across IT systems.

**Endpoint**: `GET /api/search/it-systems`

**Query Parameters**:
- `q` or `searchText` (optional): Search query (defaults to "*" for all)
- `filter` (optional): OData filter expression
- `orderBy` (optional): Comma-separated list of fields to sort by
- `skip` (optional): Number of results to skip (default: 0)
- `top` (optional): Number of results to return (default: 50, max: 1000)

**Example Requests**:
```bash
# Simple search
curl "http://localhost:7071/api/search/it-systems?q=portal"

# Search with pagination
curl "http://localhost:7071/api/search/it-systems?q=customer&skip=0&top=20"

# Search with filter
curl "http://localhost:7071/api/search/it-systems?q=portal&filter=department%20eq%20'Engineering'"

# Search with ordering
curl "http://localhost:7071/api/search/it-systems?q=*&orderBy=name%20asc,criticality%20desc"
```

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": "itsys_1705276800000_abc123",
        "name": "Customer Portal",
        "description": "Main customer-facing web portal",
        "owner": "John Doe",
        "department": "Engineering",
        "status": "Active",
        "technology": ["React", "Node.js"],
        "version": "2.1.0",
        "deploymentDate": "2024-01-15T00:00:00.000Z",
        "lastUpdated": "2024-01-20T10:30:00.000Z",
        "tags": ["web", "customer-facing"],
        "criticality": "Critical"
      }
    ],
    "totalCount": 1,
    "facets": null
  },
  "timestamp": "2024-01-20T11:10:00.000Z"
}
```

---

### 7. Advanced Search

Performs advanced search with complex filtering options.

**Endpoint**: `POST /api/search/advanced`

**Request Headers**:
```
Content-Type: application/json
```

**Request Body**:
```json
{
  "searchText": "string (required)",
  "filters": {
    "department": "string (optional)",
    "status": "string (optional)",
    "criticality": "string (optional)",
    "technologies": ["string"] (optional)
  },
  "pagination": {
    "skip": 0,
    "top": 50
  },
  "orderBy": ["field asc|desc"]
}
```

**Example Request**:
```bash
curl -X POST http://localhost:7071/api/search/advanced \
  -H "Content-Type: application/json" \
  -d '{
    "searchText": "customer portal",
    "filters": {
      "department": "Engineering",
      "status": "Active",
      "criticality": "Critical",
      "technologies": ["React", "Node.js"]
    },
    "pagination": {
      "skip": 0,
      "top": 50
    },
    "orderBy": ["name asc"]
  }'
```

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": "itsys_1705276800000_abc123",
        "name": "Customer Portal",
        "description": "Main customer-facing web portal",
        "owner": "John Doe",
        "department": "Engineering",
        "status": "Active",
        "technology": ["React", "Node.js", "PostgreSQL"],
        "version": "2.1.0",
        "deploymentDate": "2024-01-15T00:00:00.000Z",
        "lastUpdated": "2024-01-20T10:30:00.000Z",
        "tags": ["web", "customer-facing"],
        "criticality": "Critical"
      }
    ],
    "totalCount": 1,
    "facets": null
  },
  "timestamp": "2024-01-20T11:15:00.000Z"
}
```

---

### 8. Search by Department

Searches IT systems within a specific department.

**Endpoint**: `GET /api/search/department/{department}`

**Path Parameters**:
- `department` (required): Department name

**Query Parameters**:
- `q` or `searchText` (optional): Search query (defaults to "*")

**Example Requests**:
```bash
# All systems in department
curl http://localhost:7071/api/search/department/Engineering

# Search within department
curl "http://localhost:7071/api/search/department/Engineering?q=portal"
```

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "itsys_1705276800000_abc123",
      "name": "Customer Portal",
      "department": "Engineering",
      "status": "Active",
      "criticality": "Critical"
      // ... other fields
    }
  ],
  "timestamp": "2024-01-20T11:20:00.000Z"
}
```

---

### 9. Search Suggestions

Provides autocomplete suggestions or search suggestions.

**Endpoint**: `GET /api/search/suggestions`

**Query Parameters**:
- `q` or `searchText` (required): Partial search text
- `type` (optional): "autocomplete" or "suggest" (default: "autocomplete")
- `suggester` (optional): Suggester name (default: "sg")

**Example Requests**:
```bash
# Autocomplete
curl "http://localhost:7071/api/search/suggestions?q=cust&type=autocomplete"

# Suggestions
curl "http://localhost:7071/api/search/suggestions?searchText=porta&type=suggest"
```

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "suggestions": [
      "Customer Portal",
      "Customer Service Dashboard",
      "Customer Analytics Platform"
    ]
  },
  "timestamp": "2024-01-20T11:25:00.000Z"
}
```

---

## Data Models

### IT System

```typescript
{
  id: string;                      // Unique identifier (auto-generated)
  name: string;                    // System name
  description: string;             // Detailed description
  owner: string;                   // System owner name
  department: string;              // Owning department
  status: SystemStatus;            // Current status
  technology: string[];            // Technology stack
  version: string;                 // Current version
  deploymentDate: Date;            // Initial deployment date
  lastUpdated: Date;               // Last modification timestamp
  tags: string[];                  // Custom tags
  criticality: CriticalityLevel;   // Business criticality
  metadata?: Record<string, unknown>; // Additional custom fields
}
```

### System Status Enum

```
Active          // Currently in production use
Inactive        // Not currently in use
Development     // Under development
Deprecated      // Marked for retirement
Maintenance     // Under maintenance
```

### Criticality Level Enum

```
Critical        // Mission-critical system
High            // High importance
Medium          // Medium importance
Low             // Low importance
```

---

## Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Input validation failed |
| `NOT_FOUND` | Resource not found |
| `CONFLICT` | Conflict with existing resource |
| `SERVICE_ERROR` | Service or infrastructure error |
| `INTERNAL_ERROR` | Unexpected internal error |
| `UNKNOWN_ERROR` | Unknown error occurred |

---

## Rate Limiting

Currently no rate limiting is implemented. Consider adding rate limiting in production using:
- Azure API Management
- Function-level rate limiting
- Custom middleware

---

## Authentication

Currently set to `authLevel: 'anonymous'` for development. For production, consider:
- Function key authentication
- Azure AD authentication
- API Management with OAuth 2.0

---

## CORS

CORS is configured in `local.settings.json` for local development:
```json
{
  "Host": {
    "CORS": "*"
  }
}
```

For production, configure specific origins in Azure Function App settings.

---

## Best Practices for API Usage

1. **Always validate responses**: Check `success` field before accessing `data`
2. **Handle errors gracefully**: All errors follow consistent format
3. **Use pagination**: For search endpoints, use `skip` and `top` parameters
4. **Filter at API level**: Use query parameters instead of client-side filtering
5. **Cache when appropriate**: Consider caching frequently accessed data
6. **Use proper HTTP methods**: POST for create, GET for read, PUT/PATCH for update, DELETE for delete
7. **Include request IDs**: For production, include correlation IDs for request tracking

---

## Support

For issues or questions about the API:
1. Check the main README.md for setup instructions
2. Review this API reference
3. Check application logs for detailed error information
4. Review Azure Function logs in Azure Portal

---

**Last Updated**: 2025-10-16
