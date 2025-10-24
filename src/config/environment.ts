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
    devicesIntuneContainerId: string; // Managed devices from Intune
    devicesDefenderContainerId: string; // Defender devices from Microsoft Defender for Endpoint
    vulnerabilitiesDefenderContainerId: string; // Vulnerabilities from Microsoft Defender for Endpoint
    remediationsContainerId: string;
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
  defender: {
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
  deviceSync: {
    batchSize: number;
    timerSchedule: string;
  };
  defenderDeviceSync: {
    batchSize: number;
    timerSchedule: string;
    containerId: string;
  };
  deviceCrossSync: {
    batchSize: number;
    timerSchedule: string;
    devicesAllContainerId: string;
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
    'COSMOS_CONTAINER_ATERA_TICKETS',
    'COSMOS_CONTAINER_DEVICES_INTUNE',
    'COSMOS_CONTAINER_DEVICES_DEFENDER',
    'COSMOS_CONTAINER_VULNERABILITIES_DEFENDER',
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
      alertStatisticsContainerId: process.env.COSMOS_CONTAINER_ALERT_STATISTICS || 'alerts_statistics',
      devicesIntuneContainerId: process.env.COSMOS_CONTAINER_DEVICES_INTUNE!,
      devicesDefenderContainerId: process.env.COSMOS_CONTAINER_DEVICES_DEFENDER!,
      vulnerabilitiesDefenderContainerId: process.env.COSMOS_CONTAINER_VULNERABILITIES_DEFENDER!,
      remediationsContainerId: process.env.COSMOS_CONTAINER_ATERA_TICKETS!
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
    defender: {
      clientId: process.env.DEFENDER_CLIENT_ID || process.env.GRAPH_CLIENT_ID || '',
      tenantId: process.env.DEFENDER_TENANT_ID || process.env.GRAPH_TENANT_ID || '',
      clientSecret: process.env.DEFENDER_CLIENT_SECRET || process.env.GRAPH_CLIENT_SECRET || '',
      scope: process.env.DEFENDER_SCOPE || 'https://api.securitycenter.microsoft.com/.default'
    },
    statistics: {
      batchSize: parseInt(process.env.STATISTICS_BATCH_SIZE || '100', 10),
      topNDefault: parseInt(process.env.STATISTICS_TOP_N_DEFAULT || '10', 10),
      timerSchedule: process.env.STATISTICS_TIMER_SCHEDULE || '0 0 * * * *'
    },
    deviceSync: {
      batchSize: parseInt(process.env.DEVICE_SYNC_BATCH_SIZE || '100', 10),
      timerSchedule: process.env.DEVICE_SYNC_TIMER_SCHEDULE || '0 0 */6 * * *' // Every 6 hours
    },
    defenderDeviceSync: {
      batchSize: parseInt(process.env.DEFENDER_SYNC_BATCH_SIZE || '100', 10),
      timerSchedule: process.env.DEFENDER_SYNC_TIMER_SCHEDULE || '0 0 */6 * * *', // Every 6 hours
      containerId: process.env.COSMOS_CONTAINER_DEVICES_DEFENDER!
    },
    deviceCrossSync: {
      batchSize: parseInt(process.env.DEVICE_CROSS_SYNC_BATCH_SIZE || '100', 10),
      timerSchedule: process.env.DEVICE_CROSS_SYNC_TIMER_SCHEDULE || '0 0 6,12,18 * * *', // 6 AM, 12 PM, 6 PM
      devicesAllContainerId: process.env.COSMOS_CONTAINER_DEVICES_ALL || 'devices_all'
    },
    app: {
      nodeEnv: process.env.NODE_ENV || 'development',
      logLevel: process.env.LOG_LEVEL || 'info'
    }
  };
}

// Export singleton instance
export const config = getEnvironmentConfig();
