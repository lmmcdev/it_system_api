/**
 * OpenAPI 3.0 Specification
 * API documentation for Alert Events API
 */

export const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Alert Events API',
    version: '1.0.0',
    description: 'Azure Functions API for managing Security Alert Events from Microsoft Graph Security API with CosmosDB storage',
    contact: {
      name: 'API Support',
      email: 'support@example.com'
    }
  },
  servers: [
    {
      url: 'http://localhost:7071/api',
      description: 'Local development server'
    },
    {
      url: 'https://your-function-app.azurewebsites.net/api',
      description: 'Production server'
    }
  ],
  tags: [
    {
      name: 'Alert Events',
      description: 'Operations for security alert events'
    },
    {
      name: 'Search',
      description: 'Search operations using Azure Cognitive Search'
    },
    {
      name: 'Documentation',
      description: 'API documentation endpoints'
    }
  ],
  paths: {
    '/alert-events': {
      get: {
        tags: ['Alert Events'],
        summary: 'Get all alert events',
        description: 'Retrieves all security alert events from CosmosDB with optional filters',
        operationId: 'getAllAlertEvents',
        parameters: [
          {
            name: 'severity',
            in: 'query',
            description: 'Filter by severity level',
            schema: {
              type: 'string',
              enum: ['informational', 'low', 'medium', 'high', 'critical']
            }
          },
          {
            name: 'status',
            in: 'query',
            description: 'Filter by alert status',
            schema: {
              type: 'string',
              enum: ['new', 'inProgress', 'resolved']
            }
          },
          {
            name: 'category',
            in: 'query',
            description: 'Filter by MITRE ATT&CK category',
            schema: {
              type: 'string',
              enum: [
                'InitialAccess',
                'Execution',
                'Persistence',
                'PrivilegeEscalation',
                'DefenseEvasion',
                'CredentialAccess',
                'Discovery',
                'LateralMovement',
                'Collection',
                'Exfiltration',
                'CommandAndControl',
                'Impact'
              ]
            }
          },
          {
            name: 'createdDateTime',
            in: 'query',
            description: 'Filter by creation date (ISO 8601 format)',
            schema: {
              type: 'string',
              format: 'date-time',
              example: '2025-10-10T00:00:00Z'
            }
          },
          {
            name: 'resolvedDateTime',
            in: 'query',
            description: 'Filter by resolution date (ISO 8601 format)',
            schema: {
              type: 'string',
              format: 'date-time',
              example: '2025-10-13T00:00:00Z'
            }
          }
        ],
        responses: {
          '200': {
            description: 'List of alert events retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    {
                      $ref: '#/components/schemas/SuccessResponse'
                    },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'array',
                          items: {
                            $ref: '#/components/schemas/AlertEvent'
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          '400': {
            description: 'Invalid filter parameters',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          },
          '500': {
            description: 'Internal server error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          }
        }
      }
    },
    '/alert-events/{id}': {
      get: {
        tags: ['Alert Events'],
        summary: 'Get alert event by ID',
        description: 'Retrieves a specific security alert event by its document ID',
        operationId: 'getAlertEventById',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Alert Event document ID (partition key)',
            schema: {
              type: 'string',
              format: 'uuid',
              example: '4ca57b0e-1851-4966-a375-fa9c69e9d273'
            }
          }
        ],
        responses: {
          '200': {
            description: 'Alert event retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    {
                      $ref: '#/components/schemas/SuccessResponse'
                    },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          $ref: '#/components/schemas/AlertEvent'
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          '404': {
            description: 'Alert event not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          },
          '500': {
            description: 'Internal server error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          }
        }
      }
    },
    '/search/alerts': {
      get: {
        tags: ['Search'],
        summary: 'Search alert events',
        description: 'Search alert events using Azure Cognitive Search with full-text search, filters, field selection, and faceting',
        operationId: 'searchAlerts',
        parameters: [
          {
            name: 'q',
            in: 'query',
            description: 'Search text (full-text search across title, description, and other searchable fields)',
            schema: {
              type: 'string',
              example: 'phishing attack'
            }
          },
          {
            name: 'severity',
            in: 'query',
            description: 'Filter by severity (comma-separated for multiple values)',
            schema: {
              type: 'string',
              example: 'high,critical'
            }
          },
          {
            name: 'status',
            in: 'query',
            description: 'Filter by status (comma-separated for multiple values)',
            schema: {
              type: 'string',
              example: 'new,inProgress'
            }
          },
          {
            name: 'category',
            in: 'query',
            description: 'Filter by category (comma-separated for multiple values)',
            schema: {
              type: 'string',
              example: 'InitialAccess,Execution'
            }
          },
          {
            name: 'classification',
            in: 'query',
            description: 'Filter by classification (comma-separated for multiple values)',
            schema: {
              type: 'string',
              example: 'truePositive'
            }
          },
          {
            name: 'productName',
            in: 'query',
            description: 'Filter by product name (comma-separated for multiple values)',
            schema: {
              type: 'string',
              example: 'Microsoft Defender for Office 365'
            }
          },
          {
            name: 'detectionSource',
            in: 'query',
            description: 'Filter by detection source (comma-separated for multiple values)',
            schema: {
              type: 'string',
              example: 'microsoftDefenderForOffice365'
            }
          },
          {
            name: 'serviceSource',
            in: 'query',
            description: 'Filter by service source (comma-separated for multiple values)',
            schema: {
              type: 'string',
              example: 'microsoftDefenderForOffice365'
            }
          },
          {
            name: 'incidentId',
            in: 'query',
            description: 'Filter by incident ID',
            schema: {
              type: 'integer',
              example: 1700
            }
          },
          {
            name: 'tenantId',
            in: 'query',
            description: 'Filter by tenant ID',
            schema: {
              type: 'string',
              format: 'uuid'
            }
          },
          {
            name: 'assignedTo',
            in: 'query',
            description: 'Filter by assigned user',
            schema: {
              type: 'string'
            }
          },
          {
            name: 'createdDateStart',
            in: 'query',
            description: 'Filter by created date start (ISO 8601)',
            schema: {
              type: 'string',
              format: 'date-time',
              example: '2025-10-01T00:00:00Z'
            }
          },
          {
            name: 'createdDateEnd',
            in: 'query',
            description: 'Filter by created date end (ISO 8601)',
            schema: {
              type: 'string',
              format: 'date-time',
              example: '2025-10-31T23:59:59Z'
            }
          },
          {
            name: 'resolvedDateStart',
            in: 'query',
            description: 'Filter by resolved date start (ISO 8601)',
            schema: {
              type: 'string',
              format: 'date-time'
            }
          },
          {
            name: 'resolvedDateEnd',
            in: 'query',
            description: 'Filter by resolved date end (ISO 8601)',
            schema: {
              type: 'string',
              format: 'date-time'
            }
          },
          {
            name: 'select',
            in: 'query',
            description: 'Select specific fields to return (comma-separated)',
            schema: {
              type: 'string',
              example: 'id,title,severity,status,createdDateTime'
            }
          },
          {
            name: 'orderBy',
            in: 'query',
            description: 'Order results by field (comma-separated, add "desc" for descending)',
            schema: {
              type: 'string',
              example: 'createdDateTime desc,severity desc'
            }
          },
          {
            name: 'top',
            in: 'query',
            description: 'Number of results to return (max 100)',
            schema: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50
            }
          },
          {
            name: 'skip',
            in: 'query',
            description: 'Number of results to skip for pagination',
            schema: {
              type: 'integer',
              minimum: 0,
              default: 0
            }
          },
          {
            name: 'searchMode',
            in: 'query',
            description: 'Search mode for multiple terms',
            schema: {
              type: 'string',
              enum: ['any', 'all'],
              default: 'any'
            }
          },
          {
            name: 'highlight',
            in: 'query',
            description: 'Fields to highlight in results (comma-separated)',
            schema: {
              type: 'string',
              example: 'title,description'
            }
          },
          {
            name: 'facets',
            in: 'query',
            description: 'Fields to return facet counts for (comma-separated)',
            schema: {
              type: 'string',
              example: 'severity,status,category'
            }
          },
          {
            name: 'semantic',
            in: 'query',
            description: 'Enable semantic search for better relevance',
            schema: {
              type: 'boolean',
              default: false
            }
          }
        ],
        responses: {
          '200': {
            description: 'Search results retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true
                    },
                    data: {
                      type: 'object',
                      properties: {
                        results: {
                          type: 'array',
                          items: {
                            $ref: '#/components/schemas/AlertSearchDocument'
                          }
                        },
                        count: {
                          type: 'integer',
                          description: 'Number of results in this page'
                        },
                        totalCount: {
                          type: 'integer',
                          description: 'Total number of matching documents'
                        },
                        facets: {
                          type: 'object',
                          description: 'Facet results if requested'
                        },
                        pagination: {
                          type: 'object',
                          properties: {
                            top: {
                              type: 'integer'
                            },
                            skip: {
                              type: 'integer'
                            }
                          }
                        }
                      }
                    },
                    timestamp: {
                      type: 'string',
                      format: 'date-time'
                    }
                  }
                }
              }
            }
          },
          '400': {
            description: 'Invalid search parameters',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          },
          '500': {
            description: 'Internal server error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          }
        }
      }
    },
    '/search/suggestions': {
      get: {
        tags: ['Search'],
        summary: 'Get search suggestions',
        description: 'Get search suggestions or autocomplete results for alert events',
        operationId: 'searchSuggestions',
        parameters: [
          {
            name: 'q',
            in: 'query',
            required: true,
            description: 'Search text to get suggestions for (minimum 2 characters)',
            schema: {
              type: 'string',
              minLength: 2,
              maxLength: 100,
              example: 'phish'
            }
          },
          {
            name: 'top',
            in: 'query',
            description: 'Number of suggestions to return (max 20)',
            schema: {
              type: 'integer',
              minimum: 1,
              maximum: 20,
              default: 5
            }
          },
          {
            name: 'mode',
            in: 'query',
            description: 'Suggestion mode',
            schema: {
              type: 'string',
              enum: ['suggest', 'autocomplete'],
              default: 'suggest'
            }
          }
        ],
        responses: {
          '200': {
            description: 'Suggestions retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true
                    },
                    data: {
                      type: 'object',
                      properties: {
                        suggestions: {
                          type: 'array',
                          items: {
                            oneOf: [
                              {
                                type: 'string',
                                description: 'Autocomplete suggestion'
                              },
                              {
                                type: 'object',
                                description: 'Suggest suggestion with document',
                                properties: {
                                  text: {
                                    type: 'string'
                                  },
                                  document: {
                                    $ref: '#/components/schemas/AlertSearchDocument'
                                  }
                                }
                              }
                            ]
                          }
                        },
                        count: {
                          type: 'integer'
                        },
                        mode: {
                          type: 'string',
                          enum: ['suggest', 'autocomplete']
                        }
                      }
                    },
                    timestamp: {
                      type: 'string',
                      format: 'date-time'
                    }
                  }
                }
              }
            }
          },
          '400': {
            description: 'Invalid parameters',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          },
          '500': {
            description: 'Internal server error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          }
        }
      }
    }
  },
  components: {
    schemas: {
      AlertEvent: {
        type: 'object',
        description: 'Microsoft Graph Security Alert Event',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Document ID (partition key)'
          },
          alertId: {
            type: 'string',
            description: 'Microsoft Graph Alert ID'
          },
          alertWebUrl: {
            type: 'string',
            format: 'uri',
            description: 'URL to view alert in Microsoft 365 Defender portal'
          },
          assignedTo: {
            type: 'string',
            description: 'User ID assigned to this alert'
          },
          category: {
            type: 'string',
            enum: [
              'InitialAccess',
              'Execution',
              'Persistence',
              'PrivilegeEscalation',
              'DefenseEvasion',
              'CredentialAccess',
              'Discovery',
              'LateralMovement',
              'Collection',
              'Exfiltration',
              'CommandAndControl',
              'Impact'
            ],
            description: 'MITRE ATT&CK category'
          },
          classification: {
            type: 'string',
            enum: ['unknown', 'falsePositive', 'truePositive', 'benignPositive', 'unknownFutureValue'],
            description: 'Alert classification'
          },
          comments: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'Comments on the alert'
          },
          createdDateTime: {
            type: 'string',
            format: 'date-time',
            description: 'Alert creation timestamp'
          },
          description: {
            type: 'string',
            description: 'Alert description'
          },
          detectionSource: {
            type: 'string',
            description: 'Detection source identifier'
          },
          detectorId: {
            type: 'string',
            description: 'Detector identifier'
          },
          evidence: {
            type: 'array',
            items: {
              type: 'object'
            },
            description: 'Array of evidence objects'
          },
          firstActivityDateTime: {
            type: 'string',
            format: 'date-time',
            description: 'First activity timestamp'
          },
          incidentId: {
            type: 'integer',
            description: 'Related incident ID'
          },
          incidentWebUrl: {
            type: 'string',
            format: 'uri',
            description: 'URL to view incident'
          },
          lastActivityDateTime: {
            type: 'string',
            format: 'date-time',
            description: 'Last activity timestamp'
          },
          lastUpdateDateTime: {
            type: 'string',
            format: 'date-time',
            description: 'Last update timestamp'
          },
          mitreTechniques: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'MITRE ATT&CK technique IDs'
          },
          productName: {
            type: 'string',
            description: 'Product name that generated the alert'
          },
          providerAlertId: {
            type: 'string',
            description: 'Provider-specific alert ID'
          },
          recommendedActions: {
            type: 'string',
            description: 'Recommended remediation actions'
          },
          resolvedDateTime: {
            type: 'string',
            format: 'date-time',
            description: 'Resolution timestamp'
          },
          serviceSource: {
            type: 'string',
            description: 'Service source identifier'
          },
          severity: {
            type: 'string',
            enum: ['informational', 'low', 'medium', 'high', 'critical'],
            description: 'Alert severity level'
          },
          status: {
            type: 'string',
            enum: ['new', 'inProgress', 'resolved'],
            description: 'Alert status'
          },
          systemTags: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'System-generated tags'
          },
          tenantId: {
            type: 'string',
            format: 'uuid',
            description: 'Azure AD tenant ID'
          },
          title: {
            type: 'string',
            description: 'Alert title'
          }
        },
        required: ['id', 'alertId', 'severity', 'status', 'title']
      },
      AlertSearchDocument: {
        type: 'object',
        description: 'Alert search result from Azure Cognitive Search',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Document ID'
          },
          category: {
            type: 'string',
            description: 'Alert category'
          },
          title: {
            type: 'string',
            description: 'Alert title'
          },
          description: {
            type: 'string',
            description: 'Alert description'
          },
          productName: {
            type: 'string',
            description: 'Product name'
          },
          severity: {
            type: 'string',
            enum: ['informational', 'low', 'medium', 'high', 'critical']
          },
          status: {
            type: 'string',
            enum: ['new', 'inProgress', 'resolved']
          },
          classification: {
            type: 'string',
            nullable: true
          },
          createdDateTime: {
            type: 'string',
            format: 'date-time'
          },
          lastUpdateDateTime: {
            type: 'string',
            format: 'date-time'
          },
          firstActivityDateTime: {
            type: 'string',
            format: 'date-time',
            nullable: true
          },
          lastActivityDateTime: {
            type: 'string',
            format: 'date-time',
            nullable: true
          },
          resolvedDateTime: {
            type: 'string',
            format: 'date-time',
            nullable: true
          },
          recommendedActions: {
            type: 'string'
          },
          incidentId: {
            type: 'integer',
            nullable: true
          },
          providerAlertId: {
            type: 'string'
          },
          detectionSource: {
            type: 'string'
          },
          detectorId: {
            type: 'string'
          },
          serviceSource: {
            type: 'string'
          },
          alertWebUrl: {
            type: 'string'
          },
          incidentWebUrl: {
            type: 'string'
          },
          assignedTo: {
            type: 'string',
            nullable: true
          },
          tenantId: {
            type: 'string',
            format: 'uuid'
          },
          mitreTechniques: {
            type: 'array',
            items: {
              type: 'string'
            }
          },
          systemTags: {
            type: 'array',
            items: {
              type: 'string'
            }
          },
          userAccountNames: {
            type: 'array',
            items: {
              type: 'string'
            }
          },
          userPrincipalNames: {
            type: 'array',
            items: {
              type: 'string'
            }
          },
          userDisplayNames: {
            type: 'array',
            items: {
              type: 'string'
            }
          },
          azureAdUserIds: {
            type: 'array',
            items: {
              type: 'string'
            }
          },
          ipAddresses: {
            type: 'array',
            items: {
              type: 'string'
            }
          },
          countryCodes: {
            type: 'array',
            items: {
              type: 'string'
            }
          },
          cities: {
            type: 'array',
            items: {
              type: 'string'
            }
          },
          states: {
            type: 'array',
            items: {
              type: 'string'
            }
          },
          userAgents: {
            type: 'array',
            items: {
              type: 'string'
            }
          },
          sessionIds: {
            type: 'array',
            items: {
              type: 'string'
            }
          },
          requestIds: {
            type: 'array',
            items: {
              type: 'string'
            }
          },
          verdicts: {
            type: 'array',
            items: {
              type: 'string'
            }
          },
          deviceDnsNames: {
            type: 'array',
            items: {
              type: 'string'
            }
          },
          deviceIds: {
            type: 'array',
            items: {
              type: 'string'
            }
          },
          '@search.score': {
            type: 'number',
            description: 'Search relevance score'
          }
        }
      },
      SuccessResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true
          },
          data: {
            type: 'object',
            description: 'Response data'
          },
          timestamp: {
            type: 'string',
            format: 'date-time'
          }
        }
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false
          },
          error: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                description: 'Error code'
              },
              message: {
                type: 'string',
                description: 'Error message'
              },
              details: {
                type: 'object',
                description: 'Additional error details'
              }
            }
          },
          timestamp: {
            type: 'string',
            format: 'date-time'
          }
        }
      }
    }
  }
};
