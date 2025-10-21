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
      }
    }
  }
};
