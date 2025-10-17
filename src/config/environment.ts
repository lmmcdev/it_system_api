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
  };
  search: {
    endpoint: string;
    apiKey: string;
    indexName: string;
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
      alertContainerId: process.env.COSMOS_CONTAINER_ALERT!
    },
    search: {
      endpoint: process.env.SEARCH_ENDPOINT!,
      apiKey: process.env.SEARCH_API_KEY!,
      indexName: process.env.SEARCH_INDEX_NAME!
    },
    app: {
      nodeEnv: process.env.NODE_ENV || 'development',
      logLevel: process.env.LOG_LEVEL || 'info'
    }
  };
}

// Export singleton instance
export const config = getEnvironmentConfig();
