/**
 * Environment configuration management
 * Centralizes all environment variables and configuration
 */

export interface EnvironmentConfig {
  cosmos: {
    endpoint: string;
    key: string;
    databaseId: string;
    containerId: string;
    alertContainerId: string;
    riskDetectionContainerId: string;
    alertStatisticsContainerId: string;
  };
  search: {
    endpoint: string;
    apiKey: string;
    indexName: string;
  };
  graph: {
    clientId: string;
    tenantId: string;
    clientSecret: string;
    scope: string;
  };
  statistics: {
    batchSize: number;
    topNDefault: number;
    timerSchedule: string;
  };
  app: {
    nodeEnv: string;
    logLevel: string;
  };
}

/**
 * Validates and returns environment configuration
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  const requiredVars = [
    'COSMOS_ENDPOINT',
    'COSMOS_KEY',
    'COSMOS_DATABASE_ID',
    'COSMOS_CONTAINER_ALERT',
    'COSMOS_CONTAINER_RISK_DETECTION',
    'SEARCH_ENDPOINT',
    'SEARCH_API_KEY',
    'SEARCH_INDEX_NAME'
  ];

  // Validate required environment variables
  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  return {
    cosmos: {
      endpoint: process.env.COSMOS_ENDPOINT!,
      key: process.env.COSMOS_KEY!,
      databaseId: process.env.COSMOS_DATABASE_ID!,
      containerId: process.env.COSMOS_CONTAINER_ID!,
      alertContainerId: process.env.COSMOS_CONTAINER_ALERT!,
      riskDetectionContainerId: process.env.COSMOS_CONTAINER_RISK_DETECTION!,
      alertStatisticsContainerId: process.env.COSMOS_CONTAINER_ALERT_STATISTICS || 'alerts_statistics'
    },
    search: {
      endpoint: process.env.SEARCH_ENDPOINT!,
      apiKey: process.env.SEARCH_API_KEY!,
      indexName: process.env.SEARCH_INDEX_NAME!
    },
    graph: {
      clientId: process.env.GRAPH_CLIENT_ID || '',
      tenantId: process.env.GRAPH_TENANT_ID || '',
      clientSecret: process.env.GRAPH_CLIENT_SECRET || '',
      scope: process.env.GRAPH_SCOPE || 'https://graph.microsoft.com/.default'
    },
    statistics: {
      batchSize: parseInt(process.env.STATISTICS_BATCH_SIZE || '100', 10),
      topNDefault: parseInt(process.env.STATISTICS_TOP_N_DEFAULT || '10', 10),
      timerSchedule: process.env.STATISTICS_TIMER_SCHEDULE || '0 0 * * * *'
    },
    app: {
      nodeEnv: process.env.NODE_ENV || 'development',
      logLevel: process.env.LOG_LEVEL || 'info'
    }
  };
}

// Export singleton instance
export const config = getEnvironmentConfig();
