/**
 * Alert Statistics entity model
 * Represents aggregated statistics from alert events stored in CosmosDB
 */

/**
 * Statistics type enum - identifies the type of aggregation
 */
export enum StatisticsType {
  DetectionSource = 'detectionSource',
  UserImpact = 'userImpact',
  IpThreats = 'ipThreats',
  AttackTypes = 'attackTypes'
}

/**
 * Time period for statistics aggregation
 */
export interface StatisticsPeriod {
  startDate: string; // ISO 8601 format
  endDate: string; // ISO 8601 format
  periodType: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';
}

/**
 * Base interface for count statistics
 */
export interface CountStatistic {
  value: string; // The dimension value (e.g., "high", "user@domain.com", "192.168.1.1")
  count: number; // Number of occurrences
  percentage: number; // Percentage of total (0-100)
}

/**
 * Detection Source Statistics
 * Aggregates alerts by their detection source
 */
export interface DetectionSourceStatistics {
  microsoftDefenderForEndpoint: number;
  microsoftDefenderForOffice365: number;
  microsoftDefenderForCloudApps: number;
  microsoftDefenderForIdentity: number;
  azureAdIdentityProtection: number;
  antivirus: number;
  custom: number;
  other: number; // For unknown sources
  total: number;
}

/**
 * User Impact Statistics
 * Aggregates alerts by affected users
 */
export interface UserImpactStatistics {
  topUsers: CountStatistic[]; // Top N users by alert count
  totalUniqueUsers: number;
  totalAlerts: number;
  usersWithMultipleAlerts: number;
  usersWithCriticalAlerts: number;
}

/**
 * IP Threat Statistics
 * Aggregates threats by source IP addresses
 */
export interface IpThreatStatistics {
  topThreatIps: CountStatistic[]; // Top N IPs by alert count
  topDomains: CountStatistic[]; // Top N domains by alert count
  totalUniqueIps: number;
  totalUniqueDomains: number;
  totalAlerts: number;
  ipsWithMultipleAlerts: number;
}

/**
 * Attack Type Statistics
 * Aggregates alerts by attack characteristics
 */
export interface AttackTypeStatistics {
  bySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    informational: number;
    total: number;
  };
  byCategory: CountStatistic[]; // MITRE ATT&CK categories
  byMitreTechnique: CountStatistic[]; // Top MITRE techniques
  byThreatFamily: CountStatistic[]; // Top threat families
  byStatus: {
    new: number;
    inProgress: number;
    resolved: number;
    total: number;
  };
}

/**
 * Main Alert Statistics Document (CosmosDB)
 * Partition key: periodStartDate (formatted as YYYY-MM-DD)
 */
export interface AlertStatisticsDocument {
  // CosmosDB document ID
  // Format: "{type}_{periodStartDate}_{periodEndDate}_{timestamp}"
  // Example: "detectionSource_2025-10-20_2025-10-20_2025-10-20T17-30-45-123"
  // Timestamp ensures unique IDs for historical tracking
  id: string;

  // Partition key for efficient querying
  periodStartDate: string; // ISO 8601 date (YYYY-MM-DD format)

  // Statistics metadata
  type: StatisticsType;
  period: StatisticsPeriod;
  generatedAt: string; // ISO 8601 timestamp

  // Statistics data (only one will be populated based on type)
  detectionSourceStats?: DetectionSourceStatistics;
  userImpactStats?: UserImpactStatistics;
  ipThreatStats?: IpThreatStatistics;
  attackTypeStats?: AttackTypeStatistics;

  // Processing metadata
  processingInfo: {
    totalAlertsProcessed: number;
    processingTimeMs: number;
    isInitialRun: boolean; // True if processing all historical data
    lastProcessedAlertDate?: string; // ISO 8601 timestamp
  };

  // CosmosDB metadata
  _rid?: string;
  _self?: string;
  _etag?: string;
  _attachments?: string;
  _ts?: number;
}

/**
 * Query filter for statistics retrieval
 */
export interface StatisticsQueryFilter {
  type?: StatisticsType;
  startDate?: string; // ISO 8601
  endDate?: string; // ISO 8601
  periodType?: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';
}

/**
 * Statistics aggregation request
 */
export interface StatisticsAggregationRequest {
  type: StatisticsType;
  period: StatisticsPeriod;
  options?: {
    topN?: number; // Number of top items to return (default 10)
    includePercentages?: boolean; // Calculate percentages (default true)
  };
}

/**
 * Validation helper for statistics types
 */
export const StatisticsValidation = {
  isValidType: (value: string): value is StatisticsType => {
    return Object.values(StatisticsType).includes(value as StatisticsType);
  },

  isValidPeriodType: (value: string): value is 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom' => {
    return ['hourly', 'daily', 'weekly', 'monthly', 'custom'].includes(value);
  },

  validateDateRange: (startDate: string, endDate: string): { valid: boolean; error?: string } => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime())) {
      return { valid: false, error: 'Invalid startDate format' };
    }

    if (isNaN(end.getTime())) {
      return { valid: false, error: 'Invalid endDate format' };
    }

    if (start > end) {
      return { valid: false, error: 'startDate cannot be after endDate' };
    }

    return { valid: true };
  }
};
