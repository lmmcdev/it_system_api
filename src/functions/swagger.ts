/**
 * Swagger UI endpoint
 * Serves OpenAPI documentation interface
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { openApiSpec } from '../config/openapi';
import { checkRateLimit, createRateLimitResponse, RATE_LIMITS } from '../middleware/rateLimit';

/**
 * Serve OpenAPI JSON specification
 */
app.http('swaggerJson', {
  methods: ['GET'],
  route: 'swagger/openapi.json',
  authLevel: 'anonymous',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    context.log('Serving OpenAPI specification');

    // Rate limiting check
    const rateLimitResult = checkRateLimit(request, 'swagger', RATE_LIMITS.swagger);
    if (!rateLimitResult.allowed) {
      return createRateLimitResponse(rateLimitResult);
    }

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: openApiSpec
    };
  }
});

/**
 * Serve Swagger UI
 */
app.http('swagger', {
  methods: ['GET'],
  route: 'swagger',
  authLevel: 'anonymous',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    context.log('Serving Swagger UI');

    // Rate limiting check
    const rateLimitResult = checkRateLimit(request, 'swagger', RATE_LIMITS.swagger);
    if (!rateLimitResult.allowed) {
      return createRateLimitResponse(rateLimitResult);
    }

    try {
      // Get the base URL from the request
      const url = new URL(request.url);
      const baseUrl = `${url.protocol}//${url.host}`;

      // Always use CDN for reliability (includes standalone preset)
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Alert Events API - Swagger UI</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.10.3/swagger-ui.css" />
  <style>
    html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin:0; padding:0; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.10.3/swagger-ui-bundle.js" charset="UTF-8"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.10.3/swagger-ui-standalone-preset.js" charset="UTF-8"></script>
  <script>
    window.onload = function() {
      window.ui = SwaggerUIBundle({
        url: '${baseUrl}/api/swagger/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout"
      });
    };
  </script>
</body>
</html>`;

      return {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'no-cache'
        },
        body: html
      };

    } catch (error) {
      context.error('Error serving Swagger UI', error);

      return {
        status: 500,
        headers: {
          'Content-Type': 'text/plain'
        },
        body: 'Error loading Swagger UI'
      };
    }
  }
});
