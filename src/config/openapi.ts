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
      name: 'Risk Detection Events',
      description: 'Operations for risk detection events'
    },
    {
      name: 'Alert Statistics',
      description: 'Operations for alert statistics and aggregations'
    },
    {
      name: 'Search',
      description: 'Search operations using Azure Cognitive Search'
    },
    {
      name: 'Documentation',
      description: 'API documentation endpoints'
    },
    {
      name: 'Managed Devices',
      description: 'Operations for Microsoft Intune managed devices via Graph API'
    },
    {
      name: 'Vulnerabilities',
      description: 'Operations for Microsoft Defender vulnerability data'
    },
    {
      name: 'Device Sync',
      description: 'Operations for cross-synced devices from Intune and Defender'
    },
    {
      name: 'Remediations',
      description: 'Operations for Atera IT incident tickets and remediation tracking'
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
    '/risk-detections': {
      get: {
        tags: ['Risk Detection Events'],
        summary: 'Get all risk detection events',
        description: 'Retrieves all risk detection events from CosmosDB with optional filters',
        operationId: 'getAllRiskDetections',
        parameters: [
          {
            name: 'riskLevel',
            in: 'query',
            description: 'Filter by risk level',
            schema: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'hidden', 'none', 'unknownFutureValue']
            }
          },
          {
            name: 'riskState',
            in: 'query',
            description: 'Filter by risk state',
            schema: {
              type: 'string',
              enum: ['none', 'confirmedSafe', 'remediated', 'dismissed', 'atRisk', 'confirmedCompromised', 'unknownFutureValue']
            }
          },
          {
            name: 'userId',
            in: 'query',
            description: 'Filter by user ID',
            schema: {
              type: 'string',
              example: 'user@example.com'
            }
          },
          {
            name: 'startDate',
            in: 'query',
            description: 'Filter by detection date start (ISO 8601 format)',
            schema: {
              type: 'string',
              format: 'date-time',
              example: '2025-10-01T00:00:00Z'
            }
          },
          {
            name: 'endDate',
            in: 'query',
            description: 'Filter by detection date end (ISO 8601 format)',
            schema: {
              type: 'string',
              format: 'date-time',
              example: '2025-10-31T23:59:59Z'
            }
          },
          {
            name: 'pageSize',
            in: 'query',
            description: 'Number of items per page (max 100)',
            schema: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50
            }
          },
          {
            name: 'continuationToken',
            in: 'query',
            description: 'Continuation token for pagination',
            schema: {
              type: 'string'
            }
          }
        ],
        responses: {
          '200': {
            description: 'List of risk detection events retrieved successfully',
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
                          type: 'object',
                          properties: {
                            items: {
                              type: 'array',
                              items: {
                                $ref: '#/components/schemas/RiskDetectionEvent'
                              }
                            },
                            pagination: {
                              type: 'object',
                              properties: {
                                count: {
                                  type: 'integer',
                                  description: 'Number of items in current page'
                                },
                                hasMore: {
                                  type: 'boolean',
                                  description: 'Whether more pages are available'
                                },
                                continuationToken: {
                                  type: 'string',
                                  description: 'Token for next page'
                                }
                              }
                            }
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
    '/risk-detections/{id}': {
      get: {
        tags: ['Risk Detection Events'],
        summary: 'Get risk detection event by ID',
        description: 'Retrieves a specific risk detection event by its document ID',
        operationId: 'getRiskDetectionById',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Risk Detection Event document ID (partition key)',
            schema: {
              type: 'string',
              format: 'uuid',
              example: '5da67c0f-2962-5077-b486-537815e9e284'
            }
          }
        ],
        responses: {
          '200': {
            description: 'Risk detection event retrieved successfully',
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
                          $ref: '#/components/schemas/RiskDetectionEvent'
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          '404': {
            description: 'Risk detection event not found',
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
    },
    '/statistics': {
      get: {
        tags: ['Alert Statistics'],
        summary: 'Query alert statistics',
        description: 'Retrieves aggregated alert statistics with optional filtering by type, date range, and period',
        operationId: 'getStatistics',
        parameters: [
          {
            name: 'type',
            in: 'query',
            description: 'Statistics type filter',
            schema: {
              type: 'string',
              enum: ['detectionSource', 'userImpact', 'ipThreats', 'attackTypes']
            }
          },
          {
            name: 'startDate',
            in: 'query',
            description: 'Filter by period start date (ISO 8601 format)',
            schema: {
              type: 'string',
              format: 'date-time',
              example: '2025-10-01T00:00:00Z'
            }
          },
          {
            name: 'endDate',
            in: 'query',
            description: 'Filter by period end date (ISO 8601 format)',
            schema: {
              type: 'string',
              format: 'date-time',
              example: '2025-10-31T23:59:59Z'
            }
          },
          {
            name: 'periodType',
            in: 'query',
            description: 'Period type filter',
            schema: {
              type: 'string',
              enum: ['hourly', 'daily', 'weekly', 'monthly', 'custom']
            }
          },
          {
            name: 'pageSize',
            in: 'query',
            description: 'Number of items per page (max 100)',
            schema: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50
            }
          },
          {
            name: 'continuationToken',
            in: 'query',
            description: 'Continuation token for pagination',
            schema: {
              type: 'string'
            }
          }
        ],
        responses: {
          '200': {
            description: 'Statistics retrieved successfully',
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
                          type: 'object',
                          properties: {
                            statistics: {
                              type: 'array',
                              items: {
                                $ref: '#/components/schemas/AlertStatisticsDocument'
                              }
                            },
                            pagination: {
                              $ref: '#/components/schemas/PaginationInfo'
                            }
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
            description: 'Invalid query parameters',
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
    '/statistics/{id}': {
      get: {
        tags: ['Alert Statistics'],
        summary: 'Get alert statistics by ID',
        description: 'Retrieves a specific alert statistics document by its ID and partition key',
        operationId: 'getStatisticsById',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Statistics document ID (format: {type}_{startDate}_{endDate})',
            schema: {
              type: 'string',
              example: 'detectionSource_2025-10-01_2025-10-31'
            }
          },
          {
            name: 'partitionKey',
            in: 'query',
            required: true,
            description: 'Partition key (periodStartDate in YYYY-MM-DD format)',
            schema: {
              type: 'string',
              pattern: '^\\d{4}-\\d{2}-\\d{2}$',
              example: '2025-10-01'
            }
          }
        ],
        responses: {
          '200': {
            description: 'Statistics document retrieved successfully',
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
                          $ref: '#/components/schemas/AlertStatisticsDocument'
                        }
                      }
                    }
                  ]
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
          '404': {
            description: 'Statistics document not found',
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
    '/statistics/detection-sources': {
      get: {
        tags: ['Alert Statistics'],
        summary: 'Get detection source statistics',
        description: 'Retrieves statistics aggregated by detection source (Microsoft Defender products, antivirus, etc.)',
        operationId: 'getDetectionSourceStatistics',
        parameters: [
          {
            name: 'startDate',
            in: 'query',
            description: 'Filter by period start date (ISO 8601 format)',
            schema: {
              type: 'string',
              format: 'date-time',
              example: '2025-10-01T00:00:00Z'
            }
          },
          {
            name: 'endDate',
            in: 'query',
            description: 'Filter by period end date (ISO 8601 format)',
            schema: {
              type: 'string',
              format: 'date-time',
              example: '2025-10-31T23:59:59Z'
            }
          },
          {
            name: 'pageSize',
            in: 'query',
            description: 'Number of items per page (max 100)',
            schema: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50
            }
          },
          {
            name: 'continuationToken',
            in: 'query',
            description: 'Continuation token for pagination',
            schema: {
              type: 'string'
            }
          }
        ],
        responses: {
          '200': {
            description: 'Detection source statistics retrieved successfully',
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
                          type: 'object',
                          properties: {
                            statistics: {
                              type: 'array',
                              items: {
                                $ref: '#/components/schemas/AlertStatisticsDocument'
                              }
                            },
                            pagination: {
                              $ref: '#/components/schemas/PaginationInfo'
                            }
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
            description: 'Invalid query parameters',
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
    '/statistics/user-impact': {
      get: {
        tags: ['Alert Statistics'],
        summary: 'Get user impact statistics',
        description: 'Retrieves statistics about affected users, including top users by alert count and users with critical alerts',
        operationId: 'getUserImpactStatistics',
        parameters: [
          {
            name: 'startDate',
            in: 'query',
            description: 'Filter by period start date (ISO 8601 format)',
            schema: {
              type: 'string',
              format: 'date-time',
              example: '2025-10-01T00:00:00Z'
            }
          },
          {
            name: 'endDate',
            in: 'query',
            description: 'Filter by period end date (ISO 8601 format)',
            schema: {
              type: 'string',
              format: 'date-time',
              example: '2025-10-31T23:59:59Z'
            }
          },
          {
            name: 'pageSize',
            in: 'query',
            description: 'Number of items per page (max 100)',
            schema: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50
            }
          },
          {
            name: 'continuationToken',
            in: 'query',
            description: 'Continuation token for pagination',
            schema: {
              type: 'string'
            }
          }
        ],
        responses: {
          '200': {
            description: 'User impact statistics retrieved successfully',
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
                          type: 'object',
                          properties: {
                            statistics: {
                              type: 'array',
                              items: {
                                $ref: '#/components/schemas/AlertStatisticsDocument'
                              }
                            },
                            pagination: {
                              $ref: '#/components/schemas/PaginationInfo'
                            }
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
            description: 'Invalid query parameters',
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
    '/statistics/ip-threats': {
      get: {
        tags: ['Alert Statistics'],
        summary: 'Get IP threat statistics',
        description: 'Retrieves statistics about threatening IP addresses and domains, including top attackers',
        operationId: 'getIpThreatStatistics',
        parameters: [
          {
            name: 'startDate',
            in: 'query',
            description: 'Filter by period start date (ISO 8601 format)',
            schema: {
              type: 'string',
              format: 'date-time',
              example: '2025-10-01T00:00:00Z'
            }
          },
          {
            name: 'endDate',
            in: 'query',
            description: 'Filter by period end date (ISO 8601 format)',
            schema: {
              type: 'string',
              format: 'date-time',
              example: '2025-10-31T23:59:59Z'
            }
          },
          {
            name: 'pageSize',
            in: 'query',
            description: 'Number of items per page (max 100)',
            schema: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50
            }
          },
          {
            name: 'continuationToken',
            in: 'query',
            description: 'Continuation token for pagination',
            schema: {
              type: 'string'
            }
          }
        ],
        responses: {
          '200': {
            description: 'IP threat statistics retrieved successfully',
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
                          type: 'object',
                          properties: {
                            statistics: {
                              type: 'array',
                              items: {
                                $ref: '#/components/schemas/AlertStatisticsDocument'
                              }
                            },
                            pagination: {
                              $ref: '#/components/schemas/PaginationInfo'
                            }
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
            description: 'Invalid query parameters',
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
    '/statistics/attack-types': {
      get: {
        tags: ['Alert Statistics'],
        summary: 'Get attack type statistics',
        description: 'Retrieves statistics aggregated by attack characteristics (severity, category, MITRE techniques, threat families, status)',
        operationId: 'getAttackTypeStatistics',
        parameters: [
          {
            name: 'startDate',
            in: 'query',
            description: 'Filter by period start date (ISO 8601 format)',
            schema: {
              type: 'string',
              format: 'date-time',
              example: '2025-10-01T00:00:00Z'
            }
          },
          {
            name: 'endDate',
            in: 'query',
            description: 'Filter by period end date (ISO 8601 format)',
            schema: {
              type: 'string',
              format: 'date-time',
              example: '2025-10-31T23:59:59Z'
            }
          },
          {
            name: 'pageSize',
            in: 'query',
            description: 'Number of items per page (max 100)',
            schema: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50
            }
          },
          {
            name: 'continuationToken',
            in: 'query',
            description: 'Continuation token for pagination',
            schema: {
              type: 'string'
            }
          }
        ],
        responses: {
          '200': {
            description: 'Attack type statistics retrieved successfully',
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
                          type: 'object',
                          properties: {
                            statistics: {
                              type: 'array',
                              items: {
                                $ref: '#/components/schemas/AlertStatisticsDocument'
                              }
                            },
                            pagination: {
                              $ref: '#/components/schemas/PaginationInfo'
                            }
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
            description: 'Invalid query parameters',
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
    '/managed-devices': {
      get: {
        tags: ['Managed Devices'],
        summary: 'Get all managed devices',
        description: 'Retrieves managed devices from Microsoft Intune via Microsoft Graph API with optional filters',
        operationId: 'getAllManagedDevices',
        parameters: [
          {
            name: 'userId',
            in: 'query',
            description: 'Filter by user ID',
            schema: {
              type: 'string',
              example: 'user@example.com'
            }
          },
          {
            name: 'operatingSystem',
            in: 'query',
            description: 'Filter by operating system',
            schema: {
              type: 'string',
              enum: ['Windows', 'iOS', 'MacOS', 'Android', 'Linux']
            }
          },
          {
            name: 'complianceState',
            in: 'query',
            description: 'Filter by compliance state',
            schema: {
              type: 'string',
              enum: ['unknown', 'compliant', 'noncompliant', 'conflict', 'error', 'inGracePeriod', 'configManager']
            }
          },
          {
            name: 'managementState',
            in: 'query',
            description: 'Filter by management state',
            schema: {
              type: 'string',
              enum: ['managed', 'retirePending', 'retireFailed', 'wipePending', 'wipeFailed', 'unhealthy', 'deletePending', 'retireIssued', 'wipeIssued', 'wipeCanceled', 'retireCanceled', 'discovered']
            }
          },
          {
            name: 'enrolledDateStart',
            in: 'query',
            description: 'Filter by enrollment date start (ISO 8601 format)',
            schema: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-01T00:00:00Z'
            }
          },
          {
            name: 'enrolledDateEnd',
            in: 'query',
            description: 'Filter by enrollment date end (ISO 8601 format)',
            schema: {
              type: 'string',
              format: 'date-time',
              example: '2025-12-31T23:59:59Z'
            }
          },
          {
            name: 'pageSize',
            in: 'query',
            description: 'Number of items per page (max 100)',
            schema: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50
            }
          },
          {
            name: 'nextLink',
            in: 'query',
            description: 'Next page link for pagination',
            schema: {
              type: 'string'
            }
          }
        ],
        responses: {
          '200': {
            description: 'Managed devices retrieved successfully',
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
                          type: 'object',
                          properties: {
                            devices: {
                              type: 'array',
                              items: {
                                $ref: '#/components/schemas/ManagedDevice'
                              }
                            },
                            pagination: {
                              type: 'object',
                              properties: {
                                count: {
                                  type: 'integer'
                                },
                                hasMore: {
                                  type: 'boolean'
                                },
                                nextLink: {
                                  type: 'string',
                                  nullable: true
                                }
                              }
                            }
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
    '/managed-devices/{id}': {
      get: {
        tags: ['Managed Devices'],
        summary: 'Get managed device by ID',
        description: 'Retrieves a specific managed device from Microsoft Intune by its ID',
        operationId: 'getManagedDeviceById',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Device ID (GUID)',
            schema: {
              type: 'string',
              format: 'uuid',
              example: '6d4ab0e2-3f9a-4c12-b5c8-2a1d9e8f0a3b'
            }
          }
        ],
        responses: {
          '200': {
            description: 'Managed device retrieved successfully',
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
                          $ref: '#/components/schemas/ManagedDevice'
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          '404': {
            description: 'Managed device not found',
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
    '/managed-devices/user/{userId}': {
      get: {
        tags: ['Managed Devices'],
        summary: 'Get managed devices by user',
        description: 'Retrieves all managed devices associated with a specific user',
        operationId: 'getManagedDevicesByUser',
        parameters: [
          {
            name: 'userId',
            in: 'path',
            required: true,
            description: 'User ID or User Principal Name',
            schema: {
              type: 'string',
              example: 'user@example.com'
            }
          },
          {
            name: 'pageSize',
            in: 'query',
            description: 'Number of items per page (max 100)',
            schema: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50
            }
          }
        ],
        responses: {
          '200': {
            description: 'User devices retrieved successfully',
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
                          type: 'object',
                          properties: {
                            devices: {
                              type: 'array',
                              items: {
                                $ref: '#/components/schemas/ManagedDevice'
                              }
                            },
                            userId: {
                              type: 'string'
                            },
                            count: {
                              type: 'integer'
                            }
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          '404': {
            description: 'User not found or has no devices',
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
    '/managed-devices/compliance/non-compliant': {
      get: {
        tags: ['Managed Devices'],
        summary: 'Get non-compliant devices',
        description: 'Retrieves all managed devices that are not in compliance with organizational policies',
        operationId: 'getNonCompliantDevices',
        parameters: [
          {
            name: 'pageSize',
            in: 'query',
            description: 'Number of items per page (max 100)',
            schema: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50
            }
          }
        ],
        responses: {
          '200': {
            description: 'Non-compliant devices retrieved successfully',
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
                          type: 'object',
                          properties: {
                            devices: {
                              type: 'array',
                              items: {
                                $ref: '#/components/schemas/ManagedDevice'
                              }
                            },
                            count: {
                              type: 'integer',
                              description: 'Total number of non-compliant devices'
                            }
                          }
                        }
                      }
                    }
                  ]
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
    '/detected-apps/{appId}/devices': {
      get: {
        tags: ['Managed Devices'],
        summary: 'Get devices with detected app',
        description: 'Retrieves managed devices that have a specific detected application installed',
        operationId: 'getDetectedAppDevices',
        parameters: [
          {
            name: 'appId',
            in: 'path',
            required: true,
            description: 'Detected App ID (GUID)',
            schema: {
              type: 'string',
              format: 'uuid',
              example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
            }
          },
          {
            name: 'pageSize',
            in: 'query',
            description: 'Number of items per page (max 100)',
            schema: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50
            }
          },
          {
            name: 'nextLink',
            in: 'query',
            description: 'Next page link for pagination',
            schema: {
              type: 'string'
            }
          }
        ],
        responses: {
          '200': {
            description: 'Devices retrieved successfully',
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
                          type: 'object',
                          properties: {
                            devices: {
                              type: 'array',
                              items: {
                                $ref: '#/components/schemas/DetectedAppManagedDevice'
                              }
                            },
                            appId: {
                              type: 'string',
                              format: 'uuid'
                            },
                            pagination: {
                              type: 'object',
                              properties: {
                                count: {
                                  type: 'integer'
                                },
                                hasMore: {
                                  type: 'boolean'
                                },
                                nextLink: {
                                  type: 'string',
                                  nullable: true
                                }
                              }
                            }
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
            description: 'Invalid app ID format',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          },
          '404': {
            description: 'Detected app not found',
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
    '/compliance-policies/{policyId}': {
      get: {
        tags: ['Managed Devices'],
        summary: 'Get compliance policy by ID',
        description: 'Retrieves a specific device compliance policy from Microsoft Intune by its ID',
        operationId: 'getCompliancePolicyById',
        parameters: [
          {
            name: 'policyId',
            in: 'path',
            required: true,
            description: 'Device Compliance Policy ID (GUID)',
            schema: {
              type: 'string',
              format: 'uuid',
              example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901'
            }
          }
        ],
        responses: {
          '200': {
            description: 'Compliance policy retrieved successfully',
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
                          $ref: '#/components/schemas/DeviceCompliancePolicy'
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          '400': {
            description: 'Invalid policy ID format',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          },
          '404': {
            description: 'Compliance policy not found',
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
    '/trigger/sync-managed-devices': {
      get: {
        tags: ['Managed Devices'],
        summary: 'Manually trigger device synchronization',
        description: 'Triggers synchronization of managed devices from Microsoft Graph API to CosmosDB. Fetches approximately 2000 devices and performs bulk UPSERT operations.',
        operationId: 'triggerSyncManagedDevices',
        security: [
          {
            FunctionKey: []
          }
        ],
        responses: {
          '200': {
            description: 'Sync completed (check status for success/partial/failed)',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      description: 'Overall sync success (true for success/partial, false for failed)'
                    },
                    status: {
                      type: 'string',
                      enum: ['success', 'partial', 'failed'],
                      description: 'Sync status: success (all devices), partial (some failed), failed (complete failure)'
                    },
                    summary: {
                      type: 'object',
                      properties: {
                        totalDevicesFetched: {
                          type: 'number',
                          description: 'Total devices fetched from Graph API'
                        },
                        devicesProcessed: {
                          type: 'number',
                          description: 'Devices successfully written to CosmosDB'
                        },
                        devicesFailed: {
                          type: 'number',
                          description: 'Devices that failed to write'
                        },
                        executionTimeMs: {
                          type: 'number',
                          description: 'Total execution time in milliseconds'
                        }
                      }
                    },
                    graphApiMetrics: {
                      type: 'object',
                      properties: {
                        calls: {
                          type: 'number',
                          description: 'Total Graph API calls made'
                        },
                        pages: {
                          type: 'number',
                          description: 'Total pages fetched'
                        },
                        totalRequestTimeMs: {
                          type: 'number',
                          description: 'Total time spent in Graph API calls'
                        },
                        averageRequestTimeMs: {
                          type: 'string',
                          description: 'Average request time per call'
                        }
                      }
                    },
                    cosmosDbMetrics: {
                      type: 'object',
                      properties: {
                        writes: {
                          type: 'number',
                          description: 'Total CosmosDB write operations'
                        },
                        totalRuConsumed: {
                          type: 'string',
                          description: 'Total Request Units consumed'
                        },
                        averageRuPerWrite: {
                          type: 'string',
                          description: 'Average RU per write operation'
                        }
                      }
                    },
                    errors: {
                      type: 'object',
                      properties: {
                        count: {
                          type: 'number',
                          description: 'Total error count'
                        },
                        sample: {
                          type: 'array',
                          description: 'Sample of up to 10 errors',
                          items: {
                            type: 'object',
                            properties: {
                              deviceId: {
                                type: 'string',
                                description: 'Device ID that failed'
                              },
                              deviceName: {
                                type: 'string',
                                description: 'Device name (if available)'
                              },
                              error: {
                                type: 'string',
                                description: 'Error message'
                              },
                              timestamp: {
                                type: 'string',
                                format: 'date-time',
                                description: 'Error timestamp'
                              }
                            }
                          }
                        },
                        hasMore: {
                          type: 'boolean',
                          description: 'Whether more errors exist beyond the sample'
                        }
                      }
                    },
                    timestamp: {
                      type: 'string',
                      format: 'date-time',
                      description: 'Response timestamp'
                    }
                  }
                },
                example: {
                  success: true,
                  status: 'success',
                  summary: {
                    totalDevicesFetched: 2000,
                    devicesProcessed: 1995,
                    devicesFailed: 5,
                    executionTimeMs: 245000
                  },
                  graphApiMetrics: {
                    calls: 4,
                    pages: 3,
                    totalRequestTimeMs: 15000,
                    averageRequestTimeMs: '3750.00'
                  },
                  cosmosDbMetrics: {
                    writes: 1995,
                    totalRuConsumed: '997.50',
                    averageRuPerWrite: '0.50'
                  },
                  errors: {
                    count: 5,
                    sample: [
                      {
                        deviceId: 'device-123',
                        deviceName: 'LAPTOP-XYZ',
                        error: 'HTTP 429: Throttled',
                        timestamp: '2025-10-23T10:30:15Z'
                      }
                    ],
                    hasMore: false
                  },
                  timestamp: '2025-10-23T10:35:00.000Z'
                }
              }
            }
          },
          '401': {
            description: 'Unauthorized - Invalid or missing function key',
            headers: {
              'WWW-Authenticate': {
                schema: {
                  type: 'string',
                  example: 'FunctionKey'
                }
              }
            },
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
    '/trigger/sync-defender-devices': {
      get: {
        tags: ['Defender Devices'],
        summary: 'Manually trigger Defender device synchronization',
        description: 'Triggers synchronization of devices from Microsoft Defender for Endpoint API to CosmosDB. Handles large device counts with pagination (up to 10,000 devices per page) and performs bulk UPSERT operations.',
        operationId: 'triggerSyncDefenderDevices',
        security: [
          {
            FunctionKey: []
          }
        ],
        responses: {
          '200': {
            description: 'Sync completed (check status for success/partial/failed)',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      description: 'Overall sync success (true for success/partial, false for failed)'
                    },
                    status: {
                      type: 'string',
                      enum: ['success', 'partial', 'failed'],
                      description: 'Sync status: success (all devices), partial (some failed), failed (complete failure)'
                    },
                    summary: {
                      type: 'object',
                      properties: {
                        totalDevicesFetched: {
                          type: 'number',
                          description: 'Total devices fetched from Defender API'
                        },
                        devicesProcessed: {
                          type: 'number',
                          description: 'Devices successfully written to CosmosDB'
                        },
                        devicesFailed: {
                          type: 'number',
                          description: 'Devices that failed to write'
                        },
                        executionTimeMs: {
                          type: 'number',
                          description: 'Total execution time in milliseconds'
                        }
                      }
                    },
                    graphApiMetrics: {
                      type: 'object',
                      properties: {
                        calls: {
                          type: 'number',
                          description: 'Total Defender API calls made'
                        },
                        pages: {
                          type: 'number',
                          description: 'Total pages fetched'
                        },
                        totalRequestTimeMs: {
                          type: 'number',
                          description: 'Total time spent in Defender API calls'
                        },
                        averageRequestTimeMs: {
                          type: 'string',
                          description: 'Average request time per call'
                        }
                      }
                    },
                    cosmosDbMetrics: {
                      type: 'object',
                      properties: {
                        writes: {
                          type: 'number',
                          description: 'Total CosmosDB write operations'
                        },
                        totalRuConsumed: {
                          type: 'string',
                          description: 'Total Request Units consumed'
                        },
                        averageRuPerWrite: {
                          type: 'string',
                          description: 'Average RU per write operation'
                        }
                      }
                    },
                    errors: {
                      type: 'object',
                      properties: {
                        count: {
                          type: 'number',
                          description: 'Total error count'
                        },
                        sample: {
                          type: 'array',
                          description: 'Sample of up to 10 errors',
                          items: {
                            type: 'object',
                            properties: {
                              deviceId: {
                                type: 'string',
                                description: 'Device ID that failed'
                              },
                              deviceName: {
                                type: 'string',
                                description: 'Device computer DNS name (if available)'
                              },
                              error: {
                                type: 'string',
                                description: 'Error message'
                              },
                              timestamp: {
                                type: 'string',
                                format: 'date-time',
                                description: 'Error timestamp'
                              }
                            }
                          }
                        },
                        hasMore: {
                          type: 'boolean',
                          description: 'Whether more errors exist beyond the sample'
                        }
                      }
                    },
                    timestamp: {
                      type: 'string',
                      format: 'date-time',
                      description: 'Response timestamp'
                    }
                  }
                },
                example: {
                  success: true,
                  status: 'success',
                  summary: {
                    totalDevicesFetched: 5000,
                    devicesProcessed: 4998,
                    devicesFailed: 2,
                    executionTimeMs: 180000
                  },
                  graphApiMetrics: {
                    calls: 2,
                    pages: 1,
                    totalRequestTimeMs: 8000,
                    averageRequestTimeMs: '4000.00'
                  },
                  cosmosDbMetrics: {
                    writes: 4998,
                    totalRuConsumed: '2499.00',
                    averageRuPerWrite: '0.50'
                  },
                  errors: {
                    count: 2,
                    sample: [
                      {
                        deviceId: 'device-abc123',
                        deviceName: 'WORKSTATION-01',
                        error: 'HTTP 429: Throttled',
                        timestamp: '2025-10-23T14:25:10Z'
                      }
                    ],
                    hasMore: false
                  },
                  timestamp: '2025-10-23T14:28:00.000Z'
                }
              }
            }
          },
          '401': {
            description: 'Unauthorized - Invalid or missing function key',
            headers: {
              'WWW-Authenticate': {
                schema: {
                  type: 'string',
                  example: 'FunctionKey'
                }
              }
            },
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
    '/vulnerabilities': {
      get: {
        tags: ['Vulnerabilities'],
        summary: 'Get all vulnerabilities',
        description: 'Retrieves all vulnerabilities from Microsoft Defender with optional filtering and pagination',
        operationId: 'getAllVulnerabilities',
        security: [
          {
            FunctionKey: []
          }
        ],
        parameters: [
          {
            name: 'name',
            in: 'query',
            description: 'Filter by vulnerability name (partial match, case-insensitive)',
            schema: {
              type: 'string',
              example: 'CVE-2024'
            }
          },
          {
            name: 'severity',
            in: 'query',
            description: 'Filter by severity (comma-separated for multiple values)',
            schema: {
              type: 'string',
              example: 'High,Critical'
            }
          },
          {
            name: 'updatedOnFrom',
            in: 'query',
            description: 'Filter by minimum update date (ISO 8601)',
            schema: {
              type: 'string',
              format: 'date-time',
              example: '2024-10-01T00:00:00Z'
            }
          },
          {
            name: 'updatedOnTo',
            in: 'query',
            description: 'Filter by maximum update date (ISO 8601)',
            schema: {
              type: 'string',
              format: 'date-time',
              example: '2024-10-31T23:59:59Z'
            }
          },
          {
            name: 'top',
            in: 'query',
            description: 'Number of items per page (max 100)',
            schema: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50
            }
          },
          {
            name: 'continuationToken',
            in: 'query',
            description: 'Continuation token for pagination',
            schema: {
              type: 'string'
            }
          }
        ],
        responses: {
          '200': {
            description: 'Vulnerabilities retrieved successfully',
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
                          type: 'object',
                          properties: {
                            items: {
                              type: 'array',
                              items: {
                                $ref: '#/components/schemas/VulnerabilityDefender'
                              }
                            },
                            pagination: {
                              $ref: '#/components/schemas/PaginationInfo'
                            }
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
            $ref: '#/components/responses/BadRequest'
          },
          '401': {
            $ref: '#/components/responses/Unauthorized'
          },
          '500': {
            $ref: '#/components/responses/InternalServerError'
          }
        }
      },
      post: {
        tags: ['Vulnerabilities'],
        summary: 'Create vulnerability',
        description: 'Creates a new vulnerability record in CosmosDB',
        operationId: 'createVulnerability',
        security: [
          {
            FunctionKey: []
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateVulnerabilityRequest'
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Vulnerability created successfully',
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
                          $ref: '#/components/schemas/VulnerabilityDefender'
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          '400': {
            $ref: '#/components/responses/BadRequest'
          },
          '401': {
            $ref: '#/components/responses/Unauthorized'
          },
          '409': {
            $ref: '#/components/responses/Conflict'
          },
          '500': {
            $ref: '#/components/responses/InternalServerError'
          }
        }
      }
    },
    '/vulnerabilities/{id}': {
      get: {
        tags: ['Vulnerabilities'],
        summary: 'Get vulnerability by ID',
        description: 'Retrieves a specific vulnerability by its ID',
        operationId: 'getVulnerabilityById',
        security: [
          {
            FunctionKey: []
          }
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Vulnerability ID (UUID)',
            schema: {
              type: 'string',
              format: 'uuid'
            }
          }
        ],
        responses: {
          '200': {
            description: 'Vulnerability retrieved successfully',
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
                          $ref: '#/components/schemas/VulnerabilityDefender'
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          '400': {
            $ref: '#/components/responses/BadRequest'
          },
          '401': {
            $ref: '#/components/responses/Unauthorized'
          },
          '404': {
            $ref: '#/components/responses/NotFound'
          },
          '500': {
            $ref: '#/components/responses/InternalServerError'
          }
        }
      },
      put: {
        tags: ['Vulnerabilities'],
        summary: 'Update vulnerability',
        description: 'Updates an existing vulnerability record',
        operationId: 'updateVulnerability',
        security: [
          {
            FunctionKey: []
          }
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Vulnerability ID (UUID)',
            schema: {
              type: 'string',
              format: 'uuid'
            }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UpdateVulnerabilityRequest'
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Vulnerability updated successfully',
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
                          $ref: '#/components/schemas/VulnerabilityDefender'
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          '400': {
            $ref: '#/components/responses/BadRequest'
          },
          '401': {
            $ref: '#/components/responses/Unauthorized'
          },
          '404': {
            $ref: '#/components/responses/NotFound'
          },
          '409': {
            $ref: '#/components/responses/Conflict'
          },
          '500': {
            $ref: '#/components/responses/InternalServerError'
          }
        }
      },
      delete: {
        tags: ['Vulnerabilities'],
        summary: 'Delete vulnerability',
        description: 'Deletes a vulnerability record from CosmosDB',
        operationId: 'deleteVulnerability',
        security: [
          {
            FunctionKey: []
          }
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Vulnerability ID (UUID)',
            schema: {
              type: 'string',
              format: 'uuid'
            }
          }
        ],
        responses: {
          '200': {
            description: 'Vulnerability deleted successfully',
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
                        message: {
                          type: 'string',
                          example: 'Vulnerability deleted successfully'
                        },
                        id: {
                          type: 'string',
                          format: 'uuid'
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
            $ref: '#/components/responses/BadRequest'
          },
          '401': {
            $ref: '#/components/responses/Unauthorized'
          },
          '404': {
            $ref: '#/components/responses/NotFound'
          },
          '500': {
            $ref: '#/components/responses/InternalServerError'
          }
        }
      }
    },
    '/devices/search': {
      get: {
        tags: ['Device Sync'],
        summary: 'Search synced devices',
        description: 'Search across cross-synced devices from Intune and Defender with flexible filtering. Supports searching in both nested intune and defender objects with case-insensitive partial matching.',
        operationId: 'searchDevices',
        security: [
          {
            FunctionKey: []
          }
        ],
        parameters: [
          {
            name: 'syncKey',
            in: 'query',
            description: 'Azure AD Device ID or sync key (exact match)',
            schema: {
              type: 'string',
              example: 'a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6'
            }
          },
          {
            name: 'syncState',
            in: 'query',
            description: 'Filter by sync state',
            schema: {
              type: 'string',
              enum: ['matched', 'only_intune', 'only_defender'],
              example: 'matched'
            }
          },
          {
            name: 'deviceId',
            in: 'query',
            description: 'Filter by specific device ID (UUID format). Returns only the device matching this exact ID.',
            required: false,
            type: 'string',
            format: 'uuid',
            example: '12345678-1234-5678-1234-567812345678'
          },
          {
            name: 'deviceName',
            in: 'query',
            description: 'Search in Intune device name (case-insensitive, partial match)',
            schema: {
              type: 'string',
              example: 'HEAST-PC57'
            }
          },
          {
            name: 'operatingSystem',
            in: 'query',
            description: 'Search in Intune operating system (case-insensitive, partial match)',
            schema: {
              type: 'string',
              example: 'Windows11'
            }
          },
          {
            name: 'computerDnsName',
            in: 'query',
            description: 'Search in Defender DNS name (case-insensitive, partial match)',
            schema: {
              type: 'string',
              example: 'nmiami-pc47'
            }
          },
          {
            name: 'osPlatform',
            in: 'query',
            description: 'Search in Defender OS platform (case-insensitive, partial match)',
            schema: {
              type: 'string',
              example: 'Windows'
            }
          },
          {
            name: 'lastIpAddress',
            in: 'query',
            description: 'Search in Defender last IP address (exact match)',
            schema: {
              type: 'string',
              example: '10.156.0.108'
            }
          },
          {
            name: 'pageSize',
            in: 'query',
            description: 'Number of items per page (1-100, default 50)',
            schema: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
              example: 50
            }
          },
          {
            name: 'continuationToken',
            in: 'query',
            description: 'Pagination continuation token from previous response',
            schema: {
              type: 'string'
            }
          }
        ],
        responses: {
          '200': {
            description: 'Devices found successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    devices: {
                      type: 'array',
                      items: {
                        $ref: '#/components/schemas/DeviceSyncDocument'
                      }
                    },
                    pagination: {
                      type: 'object',
                      properties: {
                        count: {
                          type: 'integer',
                          example: 25
                        },
                        hasMore: {
                          type: 'boolean',
                          example: true
                        },
                        continuationToken: {
                          type: 'string',
                          nullable: true
                        }
                      }
                    },
                    filters: {
                      type: 'object',
                      description: 'Applied search filters',
                      properties: {
                        syncKey: { type: 'string', nullable: true },
                        syncState: { type: 'string', nullable: true },
                        deviceName: { type: 'string', nullable: true },
                        operatingSystem: { type: 'string', nullable: true },
                        computerDnsName: { type: 'string', nullable: true },
                        osPlatform: { type: 'string', nullable: true },
                        lastIpAddress: { type: 'string', nullable: true }
                      }
                    },
                    timestamp: {
                      type: 'string',
                      format: 'date-time',
                      example: '2025-10-24T10:30:00.000Z'
                    }
                  }
                }
              }
            }
          },
          '400': {
            $ref: '#/components/responses/BadRequest'
          },
          '401': {
            $ref: '#/components/responses/Unauthorized'
          },
          '500': {
            $ref: '#/components/responses/InternalServerError'
          }
        }
      }
    },
    '/remediations': {
      get: {
        tags: ['Remediations'],
        summary: 'Get all remediation tickets',
        description: 'Retrieves all Atera IT incident tickets with pagination support',
        operationId: 'getRemediations',
        security: [
          {
            FunctionKey: []
          }
        ],
        parameters: [
          {
            name: 'pageSize',
            in: 'query',
            description: 'Number of items per page (1-100)',
            required: false,
            schema: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
              example: 50
            }
          },
          {
            name: 'continuationToken',
            in: 'query',
            description: 'Continuation token for pagination (from previous response)',
            required: false,
            schema: {
              type: 'string',
              nullable: true
            }
          }
        ],
        responses: {
          '200': {
            description: 'Tickets retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    tickets: {
                      type: 'array',
                      items: {
                        $ref: '#/components/schemas/AteraTicket'
                      }
                    },
                    pagination: {
                      type: 'object',
                      properties: {
                        count: {
                          type: 'integer',
                          example: 50
                        },
                        hasMore: {
                          type: 'boolean',
                          example: true
                        },
                        continuationToken: {
                          type: 'string',
                          nullable: true
                        }
                      }
                    },
                    timestamp: {
                      type: 'string',
                      format: 'date-time',
                      example: '2025-10-24T10:30:00.000Z'
                    }
                  }
                }
              }
            }
          },
          '400': {
            $ref: '#/components/responses/BadRequest'
          },
          '401': {
            $ref: '#/components/responses/Unauthorized'
          },
          '500': {
            $ref: '#/components/responses/InternalServerError'
          }
        }
      }
    },
    '/remediations/{id}': {
      get: {
        tags: ['Remediations'],
        summary: 'Get remediation ticket by ID',
        description: 'Retrieves a specific Atera ticket by its numeric ID',
        operationId: 'getRemediationById',
        security: [
          {
            FunctionKey: []
          }
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            description: 'Numeric ticket ID (e.g., 5876)',
            required: true,
            schema: {
              type: 'string',
              pattern: '^\\d+$',
              example: '5876'
            }
          }
        ],
        responses: {
          '200': {
            description: 'Ticket found successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ticket: {
                      $ref: '#/components/schemas/AteraTicket'
                    },
                    timestamp: {
                      type: 'string',
                      format: 'date-time',
                      example: '2025-10-24T10:30:00.000Z'
                    }
                  }
                }
              }
            }
          },
          '400': {
            description: 'Invalid ID format',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                },
                example: {
                  error: 'Bad Request',
                  message: 'ID must be a numeric value (e.g., 5876)'
                }
              }
            }
          },
          '404': {
            description: 'Ticket not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                },
                example: {
                  error: 'Not Found',
                  message: 'Ticket not found'
                }
              }
            }
          },
          '401': {
            $ref: '#/components/responses/Unauthorized'
          },
          '500': {
            $ref: '#/components/responses/InternalServerError'
          }
        }
      }
    },
    '/remediations/search': {
      get: {
        tags: ['Remediations'],
        summary: 'Search remediation tickets',
        description: 'Search Atera tickets with flexible filtering by various criteria',
        operationId: 'searchRemediations',
        security: [
          {
            FunctionKey: []
          }
        ],
        parameters: [
          {
            name: 'ticketId',
            in: 'query',
            description: 'Exact match on Ticket_ID (numeric)',
            required: false,
            schema: {
              type: 'string',
              pattern: '^\\d+$',
              example: '5876'
            }
          },
          {
            name: 'title',
            in: 'query',
            description: 'Case-insensitive search in Ticket_title',
            required: false,
            schema: {
              type: 'string',
              example: 'network issue'
            }
          },
          {
            name: 'priority',
            in: 'query',
            description: 'Filter by priority level',
            required: false,
            schema: {
              type: 'string',
              enum: ['Low', 'Medium', 'High', 'Critical'],
              example: 'High'
            }
          },
          {
            name: 'type',
            in: 'query',
            description: 'Filter by ticket type',
            required: false,
            schema: {
              type: 'string',
              example: 'Incident'
            }
          },
          {
            name: 'status',
            in: 'query',
            description: 'Filter by activity status',
            required: false,
            schema: {
              type: 'string',
              example: 'In Progress'
            }
          },
          {
            name: 'source',
            in: 'query',
            description: 'Filter by ticket source',
            required: false,
            schema: {
              type: 'string',
              example: 'Email'
            }
          },
          {
            name: 'productFamily',
            in: 'query',
            description: 'Case-insensitive search in Product_Family',
            required: false,
            schema: {
              type: 'string',
              example: 'Microsoft 365'
            }
          },
          {
            name: 'siteName',
            in: 'query',
            description: 'Case-insensitive search in Site_name',
            required: false,
            schema: {
              type: 'string',
              example: 'Corporate Office'
            }
          },
          {
            name: 'technicianEmail',
            in: 'query',
            description: 'Exact match on Technician_email',
            required: false,
            schema: {
              type: 'string',
              format: 'email',
              example: 'tech@example.com'
            }
          },
          {
            name: 'endUserEmail',
            in: 'query',
            description: 'Exact match on End_User_email',
            required: false,
            schema: {
              type: 'string',
              format: 'email',
              example: 'user@example.com'
            }
          },
          {
            name: 'createdFrom',
            in: 'query',
            description: 'Filter tickets created after this date (YYYY-MM-DD or ISO 8601)',
            required: false,
            schema: {
              type: 'string',
              format: 'date',
              example: '2025-10-01'
            }
          },
          {
            name: 'createdTo',
            in: 'query',
            description: 'Filter tickets created before this date (YYYY-MM-DD or ISO 8601)',
            required: false,
            schema: {
              type: 'string',
              format: 'date',
              example: '2025-10-31'
            }
          },
          {
            name: 'pageSize',
            in: 'query',
            description: 'Number of items per page (1-100)',
            required: false,
            schema: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
              example: 50
            }
          },
          {
            name: 'continuationToken',
            in: 'query',
            description: 'Continuation token for pagination',
            required: false,
            schema: {
              type: 'string',
              nullable: true
            }
          }
        ],
        responses: {
          '200': {
            description: 'Search completed successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    tickets: {
                      type: 'array',
                      items: {
                        $ref: '#/components/schemas/AteraTicket'
                      }
                    },
                    pagination: {
                      type: 'object',
                      properties: {
                        count: {
                          type: 'integer',
                          example: 25
                        },
                        hasMore: {
                          type: 'boolean',
                          example: false
                        },
                        continuationToken: {
                          type: 'string',
                          nullable: true
                        }
                      }
                    },
                    filters: {
                      type: 'object',
                      description: 'Applied search filters',
                      properties: {
                        ticketId: { type: 'string', nullable: true },
                        title: { type: 'string', nullable: true },
                        priority: { type: 'string', nullable: true },
                        type: { type: 'string', nullable: true },
                        status: { type: 'string', nullable: true },
                        source: { type: 'string', nullable: true },
                        productFamily: { type: 'string', nullable: true },
                        siteName: { type: 'string', nullable: true },
                        technicianEmail: { type: 'string', nullable: true },
                        endUserEmail: { type: 'string', nullable: true },
                        createdFrom: { type: 'string', nullable: true },
                        createdTo: { type: 'string', nullable: true }
                      }
                    },
                    timestamp: {
                      type: 'string',
                      format: 'date-time',
                      example: '2025-10-24T10:30:00.000Z'
                    }
                  }
                }
              }
            }
          },
          '400': {
            description: 'Invalid search parameters or no filters provided',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                },
                examples: {
                  noFilters: {
                    summary: 'No filters provided',
                    value: {
                      error: 'Bad Request',
                      message: 'At least one search filter is required'
                    }
                  },
                  invalidTicketId: {
                    summary: 'Invalid ticket ID',
                    value: {
                      error: 'Bad Request',
                      message: 'ticketId: Must be a numeric value (e.g., 5876)'
                    }
                  },
                  invalidDateRange: {
                    summary: 'Invalid date range',
                    value: {
                      error: 'Bad Request',
                      message: 'createdFrom must be before or equal to createdTo'
                    }
                  }
                }
              }
            }
          },
          '401': {
            $ref: '#/components/responses/Unauthorized'
          },
          '500': {
            $ref: '#/components/responses/InternalServerError'
          }
        }
      }
    }
  },
  components: {
    schemas: {
      RiskDetectionEvent: {
        type: 'object',
        description: 'Microsoft Graph Security Risk Detection Event',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Document ID (partition key)'
          },
          userId: {
            type: 'string',
            description: 'User ID associated with the risk detection'
          },
          userDisplayName: {
            type: 'string',
            description: 'User display name'
          },
          userPrincipalName: {
            type: 'string',
            description: 'User principal name'
          },
          riskType: {
            type: 'string',
            enum: [
              'unlikelyTravel',
              'anonymizedIPAddress',
              'maliciousIPAddress',
              'unfamiliarFeatures',
              'malwareInfectedIPAddress',
              'suspiciousIPAddress',
              'leakedCredentials',
              'investigationsThreatIntelligence',
              'generic',
              'adminConfirmedUserCompromised',
              'mcasImpossibleTravel',
              'mcasSuspiciousInboxManipulationRules',
              'investigationsThreatIntelligenceSigninLinked',
              'maliciousIPAddressValidCredentialsBlockedIP',
              'unknownFutureValue'
            ],
            description: 'Type of risk detected'
          },
          riskLevel: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'hidden', 'none', 'unknownFutureValue'],
            description: 'Risk level'
          },
          riskState: {
            type: 'string',
            enum: ['none', 'confirmedSafe', 'remediated', 'dismissed', 'atRisk', 'confirmedCompromised', 'unknownFutureValue'],
            description: 'Risk state'
          },
          riskDetail: {
            type: 'string',
            description: 'Details about the detected risk'
          },
          detectedDateTime: {
            type: 'string',
            format: 'date-time',
            description: 'Date and time the risk was detected'
          },
          lastUpdatedDateTime: {
            type: 'string',
            format: 'date-time',
            description: 'Date and time the risk detection was last updated'
          },
          activity: {
            type: 'string',
            enum: ['signin', 'user', 'unknownFutureValue'],
            description: 'Activity type'
          },
          location: {
            type: 'object',
            properties: {
              city: {
                type: 'string'
              },
              state: {
                type: 'string'
              },
              countryOrRegion: {
                type: 'string'
              },
              geoCoordinates: {
                type: 'object',
                properties: {
                  latitude: {
                    type: 'number'
                  },
                  longitude: {
                    type: 'number'
                  }
                }
              }
            },
            description: 'Location information'
          },
          ipAddress: {
            type: 'string',
            description: 'IP address associated with the risk'
          },
          source: {
            type: 'string',
            description: 'Source of the risk detection'
          },
          requestId: {
            type: 'string',
            description: 'Request ID'
          },
          correlationId: {
            type: 'string',
            description: 'Correlation ID'
          }
        },
        required: ['id', 'userId', 'riskType', 'riskLevel', 'riskState', 'riskDetail', 'detectedDateTime', 'activity']
      },
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
      },
      PaginationInfo: {
        type: 'object',
        description: 'Pagination information',
        properties: {
          count: {
            type: 'integer',
            description: 'Number of items in current response'
          },
          hasMore: {
            type: 'boolean',
            description: 'Whether more results are available'
          },
          continuationToken: {
            type: 'string',
            description: 'Token to fetch next page',
            nullable: true
          }
        }
      },
      AlertStatisticsDocument: {
        type: 'object',
        description: 'Alert statistics document from CosmosDB',
        properties: {
          id: {
            type: 'string',
            description: 'Document ID (format: {type}_{startDate}_{endDate})',
            example: 'detectionSource_2025-10-01_2025-10-31'
          },
          periodStartDate: {
            type: 'string',
            pattern: '^\\d{4}-\\d{2}-\\d{2}$',
            description: 'Partition key - period start date in YYYY-MM-DD format',
            example: '2025-10-01'
          },
          type: {
            type: 'string',
            enum: ['detectionSource', 'userImpact', 'ipThreats', 'attackTypes'],
            description: 'Statistics type'
          },
          period: {
            type: 'object',
            properties: {
              startDate: {
                type: 'string',
                format: 'date-time',
                description: 'Period start date (ISO 8601)'
              },
              endDate: {
                type: 'string',
                format: 'date-time',
                description: 'Period end date (ISO 8601)'
              },
              periodType: {
                type: 'string',
                enum: ['hourly', 'daily', 'weekly', 'monthly', 'custom'],
                description: 'Period type'
              }
            }
          },
          generatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Timestamp when statistics were generated'
          },
          detectionSourceStats: {
            type: 'object',
            description: 'Detection source statistics (only present when type=detectionSource)',
            nullable: true,
            properties: {
              microsoftDefenderForEndpoint: {
                type: 'integer'
              },
              microsoftDefenderForOffice365: {
                type: 'integer'
              },
              microsoftDefenderForCloudApps: {
                type: 'integer'
              },
              microsoftDefenderForIdentity: {
                type: 'integer'
              },
              azureAdIdentityProtection: {
                type: 'integer'
              },
              antivirus: {
                type: 'integer'
              },
              custom: {
                type: 'integer'
              },
              other: {
                type: 'integer'
              },
              total: {
                type: 'integer'
              }
            }
          },
          userImpactStats: {
            type: 'object',
            description: 'User impact statistics (only present when type=userImpact)',
            nullable: true,
            properties: {
              topUsers: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/CountStatistic'
                }
              },
              totalUniqueUsers: {
                type: 'integer'
              },
              totalAlerts: {
                type: 'integer'
              },
              usersWithMultipleAlerts: {
                type: 'integer'
              },
              usersWithCriticalAlerts: {
                type: 'integer'
              }
            }
          },
          ipThreatStats: {
            type: 'object',
            description: 'IP threat statistics (only present when type=ipThreats)',
            nullable: true,
            properties: {
              topThreatIps: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/CountStatistic'
                }
              },
              topDomains: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/CountStatistic'
                }
              },
              totalUniqueIps: {
                type: 'integer'
              },
              totalUniqueDomains: {
                type: 'integer'
              },
              totalAlerts: {
                type: 'integer'
              },
              ipsWithMultipleAlerts: {
                type: 'integer'
              }
            }
          },
          attackTypeStats: {
            type: 'object',
            description: 'Attack type statistics (only present when type=attackTypes)',
            nullable: true,
            properties: {
              bySeverity: {
                type: 'object',
                properties: {
                  critical: {
                    type: 'integer'
                  },
                  high: {
                    type: 'integer'
                  },
                  medium: {
                    type: 'integer'
                  },
                  low: {
                    type: 'integer'
                  },
                  informational: {
                    type: 'integer'
                  },
                  total: {
                    type: 'integer'
                  }
                }
              },
              byCategory: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/CountStatistic'
                }
              },
              byMitreTechnique: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/CountStatistic'
                }
              },
              byThreatFamily: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/CountStatistic'
                }
              },
              byStatus: {
                type: 'object',
                properties: {
                  new: {
                    type: 'integer'
                  },
                  inProgress: {
                    type: 'integer'
                  },
                  resolved: {
                    type: 'integer'
                  },
                  total: {
                    type: 'integer'
                  }
                }
              }
            }
          },
          processingInfo: {
            type: 'object',
            properties: {
              totalAlertsProcessed: {
                type: 'integer',
                description: 'Total number of alerts processed for this statistics'
              },
              processingTimeMs: {
                type: 'integer',
                description: 'Processing time in milliseconds'
              },
              isInitialRun: {
                type: 'boolean',
                description: 'Whether this was the initial run processing all historical data'
              },
              lastProcessedAlertDate: {
                type: 'string',
                format: 'date-time',
                nullable: true,
                description: 'Date of the last alert processed'
              }
            }
          }
        },
        required: ['id', 'periodStartDate', 'type', 'period', 'generatedAt', 'processingInfo']
      },
      CountStatistic: {
        type: 'object',
        description: 'Count statistic with value, count, and percentage',
        properties: {
          value: {
            type: 'string',
            description: 'The dimension value (e.g., user UPN, IP address, MITRE technique)'
          },
          count: {
            type: 'integer',
            description: 'Number of occurrences',
            minimum: 0
          },
          percentage: {
            type: 'number',
            format: 'float',
            description: 'Percentage of total (0-100)',
            minimum: 0,
            maximum: 100
          }
        },
        required: ['value', 'count', 'percentage']
      },
      DeviceSyncDocument: {
        type: 'object',
        description: 'Cross-synced device document combining Intune and Defender data',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique document ID (partition key)'
          },
          syncKey: {
            type: 'string',
            description: 'Azure AD Device ID used for matching (from Intune or Defender)'
          },
          syncState: {
            type: 'string',
            enum: ['matched', 'only_intune', 'only_defender'],
            description: 'Sync state indicating which sources contain the device'
          },
          syncTimestamp: {
            type: 'string',
            format: 'date-time',
            description: 'Timestamp when this sync document was created/updated'
          },
          intune: {
            allOf: [
              {
                $ref: '#/components/schemas/ManagedDevice'
              }
            ],
            nullable: true,
            description: 'Intune device data (present when syncState is matched or only_intune)'
          },
          defender: {
            allOf: [
              {
                $ref: '#/components/schemas/DefenderDevice'
              }
            ],
            nullable: true,
            description: 'Defender device data (present when syncState is matched or only_defender)'
          }
        },
        required: ['id', 'syncKey', 'syncState', 'syncTimestamp']
      },
      DefenderDevice: {
        type: 'object',
        description: 'Microsoft Defender for Endpoint device',
        properties: {
          id: {
            type: 'string',
            description: 'Device ID'
          },
          computerDnsName: {
            type: 'string',
            nullable: true,
            description: 'Computer DNS name'
          },
          osPlatform: {
            type: 'string',
            nullable: true,
            description: 'Operating system platform'
          },
          osVersion: {
            type: 'string',
            nullable: true,
            description: 'Operating system version'
          },
          lastIpAddress: {
            type: 'string',
            nullable: true,
            description: 'Last known IP address'
          },
          lastExternalIpAddress: {
            type: 'string',
            nullable: true,
            description: 'Last external IP address'
          },
          aadDeviceId: {
            type: 'string',
            nullable: true,
            description: 'Azure AD Device ID for cross-matching'
          },
          healthStatus: {
            type: 'string',
            nullable: true,
            description: 'Device health status'
          },
          riskScore: {
            type: 'string',
            nullable: true,
            description: 'Risk score (None, Informational, Low, Medium, High)'
          },
          exposureLevel: {
            type: 'string',
            nullable: true,
            description: 'Exposure level'
          },
          firstSeen: {
            type: 'string',
            format: 'date-time',
            nullable: true,
            description: 'First seen timestamp'
          },
          lastSeen: {
            type: 'string',
            format: 'date-time',
            nullable: true,
            description: 'Last seen timestamp'
          }
        },
        required: ['id']
      },
      ManagedDevice: {
        type: 'object',
        description: 'Microsoft Intune Managed Device from Graph API',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Device ID (GUID)'
          },
          userId: {
            type: 'string',
            description: 'User ID associated with the device',
            nullable: true
          },
          deviceName: {
            type: 'string',
            description: 'Device name',
            nullable: true
          },
          operatingSystem: {
            type: 'string',
            description: 'Operating system (Windows, iOS, MacOS, Android, Linux)',
            nullable: true
          },
          osVersion: {
            type: 'string',
            description: 'Operating system version',
            nullable: true
          },
          complianceState: {
            type: 'string',
            enum: ['unknown', 'compliant', 'noncompliant', 'conflict', 'error', 'inGracePeriod', 'configManager'],
            description: 'Compliance state',
            nullable: true
          },
          managementState: {
            type: 'string',
            enum: ['managed', 'retirePending', 'retireFailed', 'wipePending', 'wipeFailed', 'unhealthy', 'deletePending', 'retireIssued', 'wipeIssued', 'wipeCanceled', 'retireCanceled', 'discovered'],
            description: 'Management state',
            nullable: true
          },
          enrolledDateTime: {
            type: 'string',
            format: 'date-time',
            description: 'Date and time when the device was enrolled',
            nullable: true
          },
          lastSyncDateTime: {
            type: 'string',
            format: 'date-time',
            description: 'Last sync date and time',
            nullable: true
          },
          manufacturer: {
            type: 'string',
            description: 'Device manufacturer',
            nullable: true
          },
          model: {
            type: 'string',
            description: 'Device model',
            nullable: true
          },
          serialNumber: {
            type: 'string',
            description: 'Serial number',
            nullable: true
          },
          imei: {
            type: 'string',
            description: 'IMEI (International Mobile Equipment Identity)',
            nullable: true
          },
          meid: {
            type: 'string',
            description: 'MEID (Mobile Equipment Identifier)',
            nullable: true
          },
          wiFiMacAddress: {
            type: 'string',
            description: 'Wi-Fi MAC address',
            nullable: true
          },
          ethernetMacAddress: {
            type: 'string',
            description: 'Ethernet MAC address',
            nullable: true
          },
          azureADDeviceId: {
            type: 'string',
            format: 'uuid',
            description: 'Azure AD device ID',
            nullable: true
          },
          deviceEnrollmentType: {
            type: 'string',
            description: 'Device enrollment type',
            nullable: true
          },
          activationLockBypassCode: {
            type: 'string',
            description: 'Activation lock bypass code (iOS)',
            nullable: true
          },
          emailAddress: {
            type: 'string',
            format: 'email',
            description: 'User email address',
            nullable: true
          },
          azureADRegistered: {
            type: 'boolean',
            description: 'Whether the device is Azure AD registered',
            nullable: true
          },
          deviceRegistrationState: {
            type: 'string',
            description: 'Device registration state',
            nullable: true
          },
          deviceCategoryDisplayName: {
            type: 'string',
            description: 'Device category display name',
            nullable: true
          },
          isSupervised: {
            type: 'boolean',
            description: 'Whether the device is supervised (iOS)',
            nullable: true
          },
          exchangeLastSuccessfulSyncDateTime: {
            type: 'string',
            format: 'date-time',
            description: 'Last successful Exchange sync date/time',
            nullable: true
          },
          exchangeAccessState: {
            type: 'string',
            description: 'Exchange access state',
            nullable: true
          },
          exchangeAccessStateReason: {
            type: 'string',
            description: 'Exchange access state reason',
            nullable: true
          },
          remoteAssistanceSessionUrl: {
            type: 'string',
            format: 'uri',
            description: 'Remote assistance session URL',
            nullable: true
          },
          remoteAssistanceSessionErrorDetails: {
            type: 'string',
            description: 'Remote assistance session error details',
            nullable: true
          },
          isEncrypted: {
            type: 'boolean',
            description: 'Whether the device is encrypted',
            nullable: true
          },
          userPrincipalName: {
            type: 'string',
            description: 'User principal name',
            nullable: true
          },
          totalStorageSpaceInBytes: {
            type: 'integer',
            format: 'int64',
            description: 'Total storage space in bytes',
            nullable: true
          },
          freeStorageSpaceInBytes: {
            type: 'integer',
            format: 'int64',
            description: 'Free storage space in bytes',
            nullable: true
          },
          managedDeviceName: {
            type: 'string',
            description: 'Managed device name',
            nullable: true
          },
          partnerReportedThreatState: {
            type: 'string',
            description: 'Partner reported threat state',
            nullable: true
          },
          requireUserEnrollmentApproval: {
            type: 'boolean',
            description: 'Whether user enrollment approval is required',
            nullable: true
          },
          managementCertificateExpirationDate: {
            type: 'string',
            format: 'date-time',
            description: 'Management certificate expiration date',
            nullable: true
          },
          iccid: {
            type: 'string',
            description: 'ICCID (Integrated Circuit Card Identifier)',
            nullable: true
          },
          udid: {
            type: 'string',
            description: 'UDID (Unique Device Identifier) - iOS',
            nullable: true
          },
          notes: {
            type: 'string',
            description: 'Notes about the device',
            nullable: true
          },
          deviceHealthAttestationState: {
            type: 'object',
            description: 'Device health attestation state',
            nullable: true
          },
          configurationManagerClientEnabledFeatures: {
            type: 'object',
            description: 'Configuration Manager client enabled features',
            nullable: true
          }
        },
        required: ['id']
      },
      AteraTicket: {
        type: 'object',
        description: 'Atera IT incident/remediation ticket',
        properties: {
          id: {
            type: 'string',
            description: 'Numeric ticket ID (e.g., "5876")',
            example: '5876'
          },
          doc_type: {
            type: 'string',
            description: 'Document type identifier',
            example: 'atera_ticket'
          },
          Ticket_ID: {
            type: 'string',
            description: 'Ticket ID (same as id)',
            example: '5876'
          },
          Ticket_title: {
            type: 'string',
            description: 'Ticket title/subject',
            nullable: true,
            example: 'Network connectivity issue'
          },
          Ticket_priority: {
            type: 'string',
            description: 'Ticket priority level',
            nullable: true,
            enum: ['Low', 'Medium', 'High', 'Critical'],
            example: 'High'
          },
          Ticket_type: {
            type: 'string',
            description: 'Type of ticket',
            nullable: true,
            example: 'Incident'
          },
          Activity_status: {
            type: 'string',
            description: 'Current status of the ticket',
            nullable: true,
            example: 'In Progress'
          },
          Ticket_source: {
            type: 'string',
            description: 'How the ticket was created',
            nullable: true,
            example: 'Email'
          },
          Product_Family: {
            type: 'string',
            description: 'Product or service family',
            nullable: true,
            example: 'Microsoft 365'
          },
          Site_name: {
            type: 'string',
            description: 'Customer site name',
            nullable: true,
            example: 'Corporate Office'
          },
          Technician_email: {
            type: 'string',
            description: 'Assigned technician email',
            nullable: true,
            format: 'email',
            example: 'tech@example.com'
          },
          End_User_email: {
            type: 'string',
            description: 'End user email address',
            nullable: true,
            format: 'email',
            example: 'user@example.com'
          },
          Ticket_created_Time: {
            type: 'string',
            description: 'When the ticket was created',
            nullable: true,
            example: '2025-10-15 09:30:00'
          },
          Ticket_resolved_Date: {
            type: 'string',
            description: 'Date when ticket was resolved',
            nullable: true
          },
          Ticket_resolved_Time: {
            type: 'string',
            description: 'Time when ticket was resolved',
            nullable: true
          },
          Public_IP_address: {
            type: 'string',
            description: 'Public IP address associated with ticket',
            nullable: true
          },
          Total_Active_Time_In_Hours: {
            type: 'string',
            description: 'Total active time in hours',
            nullable: true
          },
          Total_Active_Time_In_Minutes: {
            type: 'string',
            description: 'Total active time in minutes',
            nullable: true
          },
          comments: {
            type: 'array',
            description: 'Ticket comments/notes',
            nullable: true,
            items: {
              type: 'object',
              properties: {
                Date: { type: 'string' },
                Comment: { type: 'string' },
                Email: { type: 'string' },
                FirstName: { type: 'string' },
                LastName: { type: 'string' },
                IsInternal: { type: 'boolean' }
              }
            }
          },
          Working_Hours: {
            type: 'array',
            description: 'Technician work hours logged',
            nullable: true,
            items: {
              type: 'object',
              properties: {
                TicketID: { type: 'number' },
                StartWorkHour: { type: 'string' },
                EndWorkHour: { type: 'string' },
                TechnicianFullName: { type: 'string' },
                TechnicianEmail: { type: 'string' },
                Billiable: { type: 'boolean' }
              }
            }
          },
          last_updated: {
            type: 'string',
            description: 'Last update timestamp',
            format: 'date-time',
            nullable: true
          },
          _ts: {
            type: 'number',
            description: 'CosmosDB timestamp',
            nullable: true
          },
          _etag: {
            type: 'string',
            description: 'CosmosDB entity tag',
            nullable: true
          }
        },
        required: ['id', 'Ticket_ID']
      },
      DetectedAppManagedDevice: {
        type: 'object',
        description: 'Managed Device with detected app from Graph API',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Device ID (GUID)'
          },
          deviceName: {
            type: 'string',
            description: 'Device name',
            nullable: true
          },
          userId: {
            type: 'string',
            description: 'User ID associated with the device',
            nullable: true
          },
          operatingSystem: {
            type: 'string',
            description: 'Operating system (Windows, iOS, MacOS, Android, Linux)',
            nullable: true
          },
          osVersion: {
            type: 'string',
            description: 'Operating system version',
            nullable: true
          },
          complianceState: {
            type: 'string',
            enum: ['unknown', 'compliant', 'noncompliant', 'conflict', 'error', 'inGracePeriod', 'configManager'],
            description: 'Compliance state',
            nullable: true
          },
          managementState: {
            type: 'string',
            description: 'Management state',
            nullable: true
          },
          enrolledDateTime: {
            type: 'string',
            format: 'date-time',
            description: 'Date and time when the device was enrolled',
            nullable: true
          },
          lastSyncDateTime: {
            type: 'string',
            format: 'date-time',
            description: 'Last sync date and time',
            nullable: true
          },
          userPrincipalName: {
            type: 'string',
            description: 'User principal name',
            nullable: true
          }
        },
        required: ['id']
      },
      DeviceCompliancePolicy: {
        type: 'object',
        description: 'Device Compliance Policy from Microsoft Intune',
        properties: {
          '@odata.type': {
            type: 'string',
            description: 'OData type identifier (e.g., #microsoft.graph.androidCompliancePolicy)',
            nullable: true
          },
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Policy ID (GUID)'
          },
          createdDateTime: {
            type: 'string',
            format: 'date-time',
            description: 'Date and time when the policy was created',
            nullable: true
          },
          description: {
            type: 'string',
            description: 'Policy description',
            nullable: true
          },
          lastModifiedDateTime: {
            type: 'string',
            format: 'date-time',
            description: 'Date and time when the policy was last modified',
            nullable: true
          },
          displayName: {
            type: 'string',
            description: 'Display name of the policy',
            nullable: true
          },
          version: {
            type: 'integer',
            description: 'Version of the policy',
            nullable: true
          },
          scheduledActionsForRule: {
            type: 'array',
            description: 'Scheduled actions for compliance rules',
            items: {
              type: 'object',
              properties: {
                ruleName: {
                  type: 'string'
                },
                scheduledActionConfigurations: {
                  type: 'array',
                  items: {
                    type: 'object'
                  }
                }
              }
            },
            nullable: true
          },
          roleScopeTagIds: {
            type: 'array',
            description: 'Role scope tag IDs for RBAC',
            items: {
              type: 'string'
            },
            nullable: true
          }
        },
        required: ['id']
      },
      VulnerabilityDefender: {
        type: 'object',
        description: 'Microsoft Defender vulnerability data',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Document ID (partition key)'
          },
          name: {
            type: 'string',
            description: 'Vulnerability name (e.g., CVE-2024-1234)'
          },
          description: {
            type: 'string',
            description: 'Vulnerability description',
            nullable: true
          },
          severity: {
            type: 'string',
            enum: ['Low', 'Medium', 'High', 'Critical'],
            description: 'Severity level'
          },
          cvssV3: {
            type: 'number',
            format: 'float',
            minimum: 0,
            maximum: 10,
            description: 'CVSS v3 score',
            nullable: true
          },
          exploitabilityLevel: {
            type: 'string',
            description: 'Exploitability level',
            nullable: true
          },
          exploitTypes: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'Types of exploits',
            nullable: true
          },
          exploitUris: {
            type: 'array',
            items: {
              type: 'string',
              format: 'uri'
            },
            description: 'URIs to exploit information',
            nullable: true
          },
          exploitVerified: {
            type: 'boolean',
            description: 'Whether exploit is verified',
            nullable: true
          },
          publicExploit: {
            type: 'boolean',
            description: 'Whether public exploit exists',
            nullable: true
          },
          exploitInKit: {
            type: 'boolean',
            description: 'Whether exploit is in a kit',
            nullable: true
          },
          hasExploit: {
            type: 'boolean',
            description: 'Whether any exploit exists',
            nullable: true
          },
          publishedOn: {
            type: 'string',
            format: 'date-time',
            description: 'Date vulnerability was published',
            nullable: true
          },
          updatedOn: {
            type: 'string',
            format: 'date-time',
            description: 'Date vulnerability was last updated'
          },
          weaknesses: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'CWE weaknesses',
            nullable: true
          },
          references: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'Reference URLs and identifiers',
            nullable: true
          },
          relatedComponent: {
            type: 'string',
            description: 'Related software component',
            nullable: true
          },
          cvssV3Vector: {
            type: 'string',
            description: 'CVSS v3 vector string',
            nullable: true
          },
          cvssV3Base: {
            type: 'number',
            format: 'float',
            description: 'CVSS v3 base score',
            nullable: true
          },
          cvssV3Temporal: {
            type: 'number',
            format: 'float',
            description: 'CVSS v3 temporal score',
            nullable: true
          },
          cvssV3Environmental: {
            type: 'number',
            format: 'float',
            description: 'CVSS v3 environmental score',
            nullable: true
          },
          _rid: {
            type: 'string',
            description: 'CosmosDB resource ID',
            nullable: true
          },
          _etag: {
            type: 'string',
            description: 'CosmosDB entity tag',
            nullable: true
          },
          _ts: {
            type: 'integer',
            description: 'CosmosDB timestamp',
            nullable: true
          }
        },
        required: ['id', 'name', 'severity', 'updatedOn']
      },
      CreateVulnerabilityRequest: {
        type: 'object',
        description: 'Request body for creating a vulnerability',
        properties: {
          name: {
            type: 'string',
            description: 'Vulnerability name (e.g., CVE-2024-1234)'
          },
          description: {
            type: 'string',
            description: 'Vulnerability description',
            nullable: true
          },
          severity: {
            type: 'string',
            enum: ['Low', 'Medium', 'High', 'Critical'],
            description: 'Severity level'
          },
          cvssV3: {
            type: 'number',
            format: 'float',
            minimum: 0,
            maximum: 10,
            description: 'CVSS v3 score',
            nullable: true
          },
          exploitabilityLevel: {
            type: 'string',
            nullable: true
          },
          exploitTypes: {
            type: 'array',
            items: {
              type: 'string'
            },
            nullable: true
          },
          exploitUris: {
            type: 'array',
            items: {
              type: 'string',
              format: 'uri'
            },
            nullable: true
          },
          exploitVerified: {
            type: 'boolean',
            nullable: true
          },
          publicExploit: {
            type: 'boolean',
            nullable: true
          },
          exploitInKit: {
            type: 'boolean',
            nullable: true
          },
          hasExploit: {
            type: 'boolean',
            nullable: true
          },
          publishedOn: {
            type: 'string',
            format: 'date-time',
            nullable: true
          },
          updatedOn: {
            type: 'string',
            format: 'date-time',
            description: 'Date vulnerability was last updated'
          },
          weaknesses: {
            type: 'array',
            items: {
              type: 'string'
            },
            nullable: true
          },
          references: {
            type: 'array',
            items: {
              type: 'string'
            },
            nullable: true
          },
          relatedComponent: {
            type: 'string',
            nullable: true
          },
          cvssV3Vector: {
            type: 'string',
            nullable: true
          },
          cvssV3Base: {
            type: 'number',
            format: 'float',
            nullable: true
          },
          cvssV3Temporal: {
            type: 'number',
            format: 'float',
            nullable: true
          },
          cvssV3Environmental: {
            type: 'number',
            format: 'float',
            nullable: true
          }
        },
        required: ['name', 'severity', 'updatedOn']
      },
      UpdateVulnerabilityRequest: {
        type: 'object',
        description: 'Request body for updating a vulnerability (all fields optional)',
        properties: {
          name: {
            type: 'string',
            nullable: true
          },
          description: {
            type: 'string',
            nullable: true
          },
          severity: {
            type: 'string',
            enum: ['Low', 'Medium', 'High', 'Critical'],
            nullable: true
          },
          cvssV3: {
            type: 'number',
            format: 'float',
            minimum: 0,
            maximum: 10,
            nullable: true
          },
          exploitabilityLevel: {
            type: 'string',
            nullable: true
          },
          exploitTypes: {
            type: 'array',
            items: {
              type: 'string'
            },
            nullable: true
          },
          exploitUris: {
            type: 'array',
            items: {
              type: 'string',
              format: 'uri'
            },
            nullable: true
          },
          exploitVerified: {
            type: 'boolean',
            nullable: true
          },
          publicExploit: {
            type: 'boolean',
            nullable: true
          },
          exploitInKit: {
            type: 'boolean',
            nullable: true
          },
          hasExploit: {
            type: 'boolean',
            nullable: true
          },
          publishedOn: {
            type: 'string',
            format: 'date-time',
            nullable: true
          },
          updatedOn: {
            type: 'string',
            format: 'date-time',
            nullable: true
          },
          weaknesses: {
            type: 'array',
            items: {
              type: 'string'
            },
            nullable: true
          },
          references: {
            type: 'array',
            items: {
              type: 'string'
            },
            nullable: true
          },
          relatedComponent: {
            type: 'string',
            nullable: true
          },
          cvssV3Vector: {
            type: 'string',
            nullable: true
          },
          cvssV3Base: {
            type: 'number',
            format: 'float',
            nullable: true
          },
          cvssV3Temporal: {
            type: 'number',
            format: 'float',
            nullable: true
          },
          cvssV3Environmental: {
            type: 'number',
            format: 'float',
            nullable: true
          }
        }
      }
    }
  }
};
