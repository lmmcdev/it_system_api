# Swagger UI Setup Guide

## Overview

This project includes integrated Swagger UI for interactive API documentation. The implementation uses:

- **OpenAPI 3.0** specification
- **swagger-ui-dist** for the user interface
- **Azure Functions** endpoints to serve the documentation

## Features

✅ Complete API documentation for all endpoints
✅ Interactive testing interface
✅ Request/response examples
✅ Schema validation
✅ Try-it-out functionality
✅ OpenAPI 3.0 JSON specification export

## Files Created

### 1. OpenAPI Specification
**File:** `src/config/openapi.ts`

Contains the complete OpenAPI 3.0 specification with:
- All CRUD endpoints (Create, Read, Update, Delete)
- All Search endpoints (Basic, Advanced, Department, Suggestions)
- Request/response schemas
- Parameter definitions
- Error responses
- Data models

### 2. Swagger UI Endpoints
**File:** `src/functions/swagger.ts`

Provides two HTTP endpoints:
- `GET /api/swagger` - Serves the Swagger UI interface
- `GET /api/swagger/openapi.json` - Returns the OpenAPI specification

## Access Points

### Local Development
Once you start the Azure Functions runtime:

```bash
npm start
```

Access Swagger UI at:
```
http://localhost:7071/api/swagger
```

Access OpenAPI JSON at:
```
http://localhost:7071/api/swagger/openapi.json
```

### Production
After deployment to Azure:

```
https://your-function-app.azurewebsites.net/api/swagger
https://your-function-app.azurewebsites.net/api/swagger/openapi.json
```

## Usage

### 1. Interactive Testing

1. Navigate to `http://localhost:7071/api/swagger`
2. Browse available endpoints organized by tags
3. Click on any endpoint to expand details
4. Click "Try it out" button
5. Fill in required parameters
6. Click "Execute"
7. View the response below

### 2. Import into API Clients

You can import the OpenAPI specification into:

#### Postman
1. Open Postman
2. Click "Import"
3. Select "Link"
4. Paste: `http://localhost:7071/api/swagger/openapi.json`
5. Click "Continue"

#### Insomnia
1. Open Insomnia
2. Click "Create" → "Import From URL"
3. Paste: `http://localhost:7071/api/swagger/openapi.json`
4. Click "Fetch and Import"

#### VS Code REST Client
Download the OpenAPI spec and use with REST Client extension.

## Customization

### Update API Information

Edit `src/config/openapi.ts`:

```typescript
info: {
  title: 'IT System API',  // Change API title
  version: '1.0.0',        // Update version
  description: '...',      // Update description
  contact: {
    name: 'API Support',   // Update contact
    email: 'support@example.com'
  }
}
```

### Update Server URLs

Edit the `servers` array in `src/config/openapi.ts`:

```typescript
servers: [
  {
    url: 'http://localhost:7071/api',
    description: 'Local development server'
  },
  {
    url: 'https://your-function-app.azurewebsites.net/api',
    description: 'Production server'  // Update with your URL
  }
]
```

### Add New Endpoints

When adding new endpoints to your API:

1. Create the Azure Function in `src/functions/`
2. Add the endpoint definition to `src/config/openapi.ts` under `paths`
3. Define request/response schemas under `components.schemas`
4. Rebuild the project: `npm run build`

Example:

```typescript
'/my-new-endpoint': {
  get: {
    tags: ['My Tag'],
    summary: 'My endpoint summary',
    operationId: 'myOperation',
    responses: {
      '200': {
        description: 'Success',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/MySchema'
            }
          }
        }
      }
    }
  }
}
```

## Authentication

Currently, the Swagger UI endpoints are set to `anonymous` authentication level:

```typescript
authLevel: 'anonymous'
```

### Securing Swagger UI

For production, you may want to secure access:

#### Option 1: Function Key
Change `authLevel` to `'function'`:

```typescript
app.http('swagger', {
  methods: ['GET'],
  route: 'swagger',
  authLevel: 'function',  // Requires function key
  handler: async (request, context) => { ... }
});
```

Access with: `http://localhost:7071/api/swagger?code=YOUR_FUNCTION_KEY`

#### Option 2: Azure AD Authentication
Configure Azure AD authentication in your Function App settings.

#### Option 3: IP Restrictions
Set up IP restrictions in Azure Portal for your Function App.

## Troubleshooting

### Swagger UI Not Loading

1. **Check if Functions are running:**
   ```bash
   npm start
   ```
   Look for: `swagger: [GET] http://localhost:7071/api/swagger`

2. **Check browser console for errors:**
   Open Developer Tools (F12) and check the Console tab

3. **Verify OpenAPI JSON is accessible:**
   Navigate to: `http://localhost:7071/api/swagger/openapi.json`

### OpenAPI Spec Not Updating

1. **Rebuild the project:**
   ```bash
   npm run build
   ```

2. **Restart Azure Functions:**
   Stop and restart `npm start`

### CORS Errors

If accessing from a different domain, ensure CORS is configured in `host.json`:

```json
{
  "extensions": {
    "http": {
      "routePrefix": "api",
      "cors": {
        "allowedOrigins": ["*"],
        "allowedMethods": ["GET", "POST", "PUT", "DELETE"],
        "allowedHeaders": ["*"]
      }
    }
  }
}
```

## Best Practices

### 1. Keep Documentation in Sync
- Update OpenAPI spec whenever you modify endpoints
- Use consistent naming conventions
- Document all error responses

### 2. Use Tags Effectively
Organize endpoints with tags:
```typescript
tags: ['IT Systems', 'Search', 'Documentation']
```

### 3. Provide Examples
Include request/response examples in schemas:
```typescript
example: {
  name: "Customer Portal",
  status: "active"
}
```

### 4. Document Error Codes
List all possible error codes and their meanings:
```typescript
responses: {
  '400': { description: 'Validation error' },
  '404': { description: 'Resource not found' },
  '500': { description: 'Internal server error' }
}
```

### 5. Version Your API
Update version in `openapi.ts` when making breaking changes:
```typescript
version: '2.0.0'
```

## Dependencies

The following packages are required:

```json
{
  "dependencies": {
    "swagger-ui-dist": "^5.10.3"
  }
}
```

These are already included in `package.json`.

## Additional Resources

- [OpenAPI Specification](https://spec.openapis.org/oas/v3.0.0)
- [Swagger UI Documentation](https://swagger.io/docs/open-source-tools/swagger-ui/usage/installation/)
- [Azure Functions HTTP Triggers](https://docs.microsoft.com/en-us/azure/azure-functions/functions-bindings-http-webhook-trigger)

## Support

For issues or questions:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review Azure Functions logs
3. Verify OpenAPI specification syntax
4. Check browser console for JavaScript errors
