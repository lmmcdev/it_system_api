/**
 * Alert Statistics Service
 * Handles aggregation logic for generating statistics from alert events
 */

import { alertStatisticsRepository } from '../repositories/AlertStatisticsRepository';
import {
  AlertStatisticsDocument,
  StatisticsType,
  StatisticsPeriod,
  DetectionSourceStatistics,
  UserImpactStatistics,
  IpThreatStatistics,
  AttackTypeStatistics,
  CountStatistic
} from '../models/AlertStatistics';
import { AlertEventDocument, AlertEvidence } from '../models/AlertEvent';
import { config } from '../config/environment';
import { logger } from '../utils/logger';
import { ServiceError } from '../utils/errorHandler';

/**
 * Aggregation result with processing metadata
 */
interface AggregationResult {
  statistics: AlertStatisticsDocument;
  totalProcessed: number;
  processingTimeMs: number;
}

export class AlertStatisticsService {
  /**
   * Generate all statistics types for a given period
   */
  async generateStatisticsForPeriod(
    period: StatisticsPeriod,
    isInitialRun: boolean = false
  ): Promise<AggregationResult[]> {
    logger.info('[AlertStatisticsService] Starting statistics generation', {
      period,
      isInitialRun
    });

    const results: AggregationResult[] = [];

    try {
      // Generate each type of statistics
      const types: StatisticsType[] = [
        StatisticsType.DetectionSource,
        StatisticsType.UserImpact,
        StatisticsType.IpThreats,
        StatisticsType.AttackTypes
      ];

      for (const type of types) {
        const result = await this.generateStatisticsByType(type, period, isInitialRun);
        results.push(result);
      }

      logger.info('[AlertStatisticsService] Statistics generation completed', {
        period,
        typesGenerated: results.length,
        totalAlertsProcessed: results[0]?.totalProcessed || 0
      });

      return results;
    } catch (error) {
      logger.error('[AlertStatisticsService] Failed to generate statistics', error as Error, {
        period,
        isInitialRun
      });
      throw new ServiceError('Failed to generate alert statistics');
    }
  }

  /**
   * Generate statistics for a specific type
   */
  async generateStatisticsByType(
    type: StatisticsType,
    period: StatisticsPeriod,
    isInitialRun: boolean = false
  ): Promise<AggregationResult> {
    const startTime = Date.now();

    logger.info('[AlertStatisticsService] Generating statistics', { type, period, isInitialRun });

    try {
      // Fetch all alert events for the period in batches
      const alerts = await this.fetchAlertEventsForPeriod(period);

      logger.info('[AlertStatisticsService] Alert events fetched', {
        type,
        count: alerts.length
      });

      // Warn if no alerts found for the period
      if (alerts.length === 0) {
        logger.warn('[AlertStatisticsService] No alerts found for period - generating empty statistics', {
          type,
          period,
          startDate: period.startDate,
          endDate: period.endDate,
          periodType: period.periodType
        });
      }

      // Generate statistics based on type
      let statsData: Partial<AlertStatisticsDocument> = {};

      switch (type) {
        case StatisticsType.DetectionSource:
          statsData.detectionSourceStats = this.aggregateDetectionSourceStats(alerts);
          break;
        case StatisticsType.UserImpact:
          statsData.userImpactStats = this.aggregateUserImpactStats(alerts);
          break;
        case StatisticsType.IpThreats:
          statsData.ipThreatStats = this.aggregateIpThreatStats(alerts);
          break;
        case StatisticsType.AttackTypes:
          statsData.attackTypeStats = this.aggregateAttackTypeStats(alerts);
          break;
        default:
          throw new ServiceError(`Unknown statistics type: ${type}`);
      }

      const processingTimeMs = Date.now() - startTime;

      // Find last processed alert date (using nested structure)
      const lastProcessedAlertDate = alerts.length > 0
        ? alerts[alerts.length - 1].value?.createdDateTime
        : undefined;

      // Generate timestamp for unique ID (historical tracking)
      const generatedAt = new Date().toISOString();
      const timestamp = generatedAt.replace(/[:.]/g, '-').replace('Z', '');

      // Build the complete statistics document
      // ID format: {type}_{periodStart}_{periodEnd}_{timestamp}
      // Example: detectionSource_2025-10-20_2025-10-20_2025-10-20T17-30-45-123
      const statisticsDoc: AlertStatisticsDocument = {
        id: `${type}_${period.startDate.substring(0, 10)}_${period.endDate.substring(0, 10)}_${timestamp}`,
        periodStartDate: period.startDate.substring(0, 10), // YYYY-MM-DD format for partition key
        type,
        period,
        generatedAt,
        ...statsData,
        processingInfo: {
          totalAlertsProcessed: alerts.length,
          processingTimeMs,
          isInitialRun,
          lastProcessedAlertDate
        }
      };

      logger.info('[AlertStatisticsService] Statistics document prepared', {
        id: statisticsDoc.id,
        type,
        periodStartDate: statisticsDoc.periodStartDate,
        generatedAt,
        alertsProcessed: alerts.length
      });

      // Save to repository
      const saved = await alertStatisticsRepository.saveStatistics(statisticsDoc);

      logger.info('[AlertStatisticsService] Statistics generated and saved', {
        type,
        id: saved.id,
        alertsProcessed: alerts.length,
        processingTimeMs
      });

      return {
        statistics: saved,
        totalProcessed: alerts.length,
        processingTimeMs
      };
    } catch (error) {
      const processingTimeMs = Date.now() - startTime;

      logger.error('[AlertStatisticsService] Failed to generate statistics for type', error as Error, {
        type,
        period,
        processingTimeMs
      });

      throw error instanceof ServiceError
        ? error
        : new ServiceError(`Failed to generate ${type} statistics`);
    }
  }

  /**
   * Fetch all alert events for a given period using batch processing
   */
  private async fetchAlertEventsForPeriod(period: StatisticsPeriod): Promise<AlertEventDocument[]> {
    const alerts: AlertEventDocument[] = [];
    let continuationToken: string | undefined;
    let batchCount = 0;

    logger.info('[AlertStatisticsService] Starting alert fetch for period', {
      startDate: period.startDate,
      endDate: period.endDate,
      periodType: period.periodType,
      batchSize: config.statistics.batchSize
    });

    do {
      const batch = await alertStatisticsRepository.queryAlertEventsForAggregation(
        {
          startDate: period.startDate,
          endDate: period.endDate
        },
        {
          batchSize: config.statistics.batchSize,
          continuationToken
        }
      );

      // Defensive: ensure items is always an array before spreading
      if (batch.items && Array.isArray(batch.items)) {
        alerts.push(...batch.items);

        // Log sample from first batch for debugging
        if (batchCount === 0 && batch.items.length > 0) {
          const sample = batch.items[0];
          logger.info('[AlertStatisticsService] Sample alert from first batch', {
            id: sample.id,
            hasValue: !!sample.value,
            createdDateTime: sample.value?.createdDateTime,
            severity: sample.value?.severity,
            status: sample.value?.status,
            detectionSource: sample.value?.detectionSource,
            category: sample.value?.category
          });
        }
      } else {
        logger.warn('[AlertStatisticsService] Batch returned no items or invalid items', {
          batchNumber: batchCount + 1,
          itemsType: typeof batch.items,
          hasItems: !!batch.items
        });
      }

      continuationToken = batch.continuationToken;
      batchCount++;

      logger.info('[AlertStatisticsService] Fetched alert batch', {
        batchNumber: batchCount,
        batchSize: batch.items?.length ?? 0,
        totalFetched: alerts.length,
        hasMore: batch.hasMore
      });
    } while (continuationToken);

    logger.info('[AlertStatisticsService] Alert fetch completed', {
      totalAlerts: alerts.length,
      batchesProcessed: batchCount,
      periodStart: period.startDate,
      periodEnd: period.endDate
    });

    return alerts;
  }

  /**
   * Aggregate Detection Source Statistics
   */
  private aggregateDetectionSourceStats(alerts: AlertEventDocument[]): DetectionSourceStatistics {
    const stats: DetectionSourceStatistics = {
      microsoftDefenderForEndpoint: 0,
      microsoftDefenderForOffice365: 0,
      microsoftDefenderForCloudApps: 0,
      microsoftDefenderForIdentity: 0,
      azureAdIdentityProtection: 0,
      antivirus: 0,
      custom: 0,
      other: 0,
      total: alerts.length
    };

    logger.info('[AlertStatisticsService] Aggregating detection source stats', {
      totalAlerts: alerts.length
    });

    // Track unique detection sources for debugging
    const uniqueSources = new Set<string>();

    for (const alert of alerts) {
      const source = alert.value?.detectionSource?.toLowerCase() || 'other';
      uniqueSources.add(source);

      switch (source) {
        case 'microsoftdefenderforendpoint':
          stats.microsoftDefenderForEndpoint++;
          break;
        case 'microsoftdefenderforoffice365':
          stats.microsoftDefenderForOffice365++;
          break;
        case 'microsoftdefenderforcloudapps':
          stats.microsoftDefenderForCloudApps++;
          break;
        case 'microsoftdefenderforidentity':
          stats.microsoftDefenderForIdentity++;
          break;
        case 'azureadidentityprotection':
          stats.azureAdIdentityProtection++;
          break;
        case 'antivirus':
          stats.antivirus++;
          break;
        case 'custom':
          stats.custom++;
          break;
        default:
          stats.other++;
          break;
      }
    }

    logger.info('[AlertStatisticsService] Detection source aggregation completed', {
      stats,
      uniqueSourcesFound: Array.from(uniqueSources),
      uniqueSourceCount: uniqueSources.size
    });

    return stats;
  }

  /**
   * Aggregate User Impact Statistics
   */
  private aggregateUserImpactStats(alerts: AlertEventDocument[]): UserImpactStatistics {
    const userCounts = new Map<string, number>();
    const usersWithCriticalAlerts = new Set<string>();
    let totalAlerts = 0;

    for (const alert of alerts) {
      totalAlerts++;

      // Extract user UPNs from evidence (using nested structure)
      const userUpns = this.extractUserUpnsFromEvidence(alert.value?.evidence);

      for (const upn of userUpns) {
        userCounts.set(upn, (userCounts.get(upn) || 0) + 1);

        // Track users with critical alerts (using nested structure)
        if (alert.value?.severity?.toLowerCase() === 'critical') {
          usersWithCriticalAlerts.add(upn);
        }
      }
    }

    // Count users with multiple alerts
    const usersWithMultipleAlerts = Array.from(userCounts.values()).filter(count => count > 1).length;

    // Build top users list
    const topUsers = this.buildTopNList(
      userCounts,
      config.statistics.topNDefault,
      totalAlerts
    );

    return {
      topUsers,
      totalUniqueUsers: userCounts.size,
      totalAlerts,
      usersWithMultipleAlerts,
      usersWithCriticalAlerts: usersWithCriticalAlerts.size
    };
  }

  /**
   * Aggregate IP Threat Statistics
   */
  private aggregateIpThreatStats(alerts: AlertEventDocument[]): IpThreatStatistics {
    const ipCounts = new Map<string, number>();
    const domainCounts = new Map<string, number>();
    let totalAlerts = 0;

    for (const alert of alerts) {
      totalAlerts++;

      // Extract IP addresses
      const ips = this.extractIpAddresses(alert);
      for (const ip of ips) {
        ipCounts.set(ip, (ipCounts.get(ip) || 0) + 1);
      }

      // Extract domains
      const domains = this.extractDomains(alert);
      for (const domain of domains) {
        domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
      }
    }

    // Count IPs with multiple alerts
    const ipsWithMultipleAlerts = Array.from(ipCounts.values()).filter(count => count > 1).length;

    // Build top lists
    const topThreatIps = this.buildTopNList(
      ipCounts,
      config.statistics.topNDefault,
      totalAlerts
    );

    const topDomains = this.buildTopNList(
      domainCounts,
      config.statistics.topNDefault,
      totalAlerts
    );

    return {
      topThreatIps,
      topDomains,
      totalUniqueIps: ipCounts.size,
      totalUniqueDomains: domainCounts.size,
      totalAlerts,
      ipsWithMultipleAlerts
    };
  }

  /**
   * Aggregate Attack Type Statistics
   */
  private aggregateAttackTypeStats(alerts: AlertEventDocument[]): AttackTypeStatistics {
    const categoryCounts = new Map<string, number>();
    const mitreCounts = new Map<string, number>();
    const threatFamilyCounts = new Map<string, number>();

    const bySeverity = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      informational: 0,
      total: alerts.length
    };

    const byStatus = {
      new: 0,
      inProgress: 0,
      resolved: 0,
      total: alerts.length
    };

    for (const alert of alerts) {
      // Aggregate severity (using nested structure)
      const severity = alert.value?.severity?.toLowerCase() || 'informational';
      if (severity in bySeverity) {
        (bySeverity as any)[severity]++;
      }

      // Aggregate status (using nested structure)
      const status = alert.value?.status || 'new';
      if (status in byStatus) {
        (byStatus as any)[status]++;
      }

      // Aggregate category (using nested structure)
      if (alert.value?.category) {
        categoryCounts.set(alert.value.category, (categoryCounts.get(alert.value.category) || 0) + 1);
      }

      // Aggregate MITRE techniques (using nested structure)
      if (alert.value?.mitreTechniques && Array.isArray(alert.value.mitreTechniques)) {
        for (const technique of alert.value.mitreTechniques) {
          mitreCounts.set(technique, (mitreCounts.get(technique) || 0) + 1);
        }
      }

      // Aggregate threat families (using nested structure)
      if (alert.value?.threatFamilyName) {
        threatFamilyCounts.set(
          alert.value.threatFamilyName,
          (threatFamilyCounts.get(alert.value.threatFamilyName) || 0) + 1
        );
      }
    }

    return {
      bySeverity,
      byCategory: this.buildTopNList(categoryCounts, config.statistics.topNDefault, alerts.length),
      byMitreTechnique: this.buildTopNList(mitreCounts, config.statistics.topNDefault, alerts.length),
      byThreatFamily: this.buildTopNList(threatFamilyCounts, config.statistics.topNDefault, alerts.length),
      byStatus
    };
  }

  /**
   * Extract user UPNs from alert evidence
   */
  private extractUserUpnsFromEvidence(evidence?: AlertEvidence[]): string[] {
    if (!evidence || !Array.isArray(evidence)) {
      return [];
    }

    const upns: string[] = [];

    for (const item of evidence) {
      // Check for user evidence type
      if (item['@odata.type']?.includes('userEvidence') || item['@odata.type']?.includes('User')) {
        const userEvidence = item as any;
        if (userEvidence.userAccount?.userPrincipalName) {
          const upn = userEvidence.userAccount.userPrincipalName;
          if (upn && typeof upn === 'string' && upn.trim().length > 0) {
            upns.push(upn.trim());
          }
        }
      }
      // Also check CloudLogonSessionEvidence
      if (item['@odata.type']?.includes('cloudLogonSessionEvidence') || item['@odata.type']?.includes('CloudLogonSession')) {
        const sessionEvidence = item as any;
        if (sessionEvidence.account?.userAccount?.userPrincipalName) {
          const upn = sessionEvidence.account.userAccount.userPrincipalName;
          if (upn && typeof upn === 'string' && upn.trim().length > 0) {
            upns.push(upn.trim());
          }
        }
      }
    }

    return upns;
  }

  /**
   * Extract IP addresses from alert (using nested structure)
   */
  private extractIpAddresses(alert: AlertEventDocument): string[] {
    const ips: string[] = [];

    // Check evidence for IP evidence (using nested structure: alert.value.evidence)
    if (alert.value?.evidence && Array.isArray(alert.value.evidence)) {
      for (const item of alert.value.evidence) {
        // Check for IP evidence
        if (item['@odata.type']?.includes('ipEvidence') || item['@odata.type']?.includes('Ip')) {
          const ipEvidence = item as any;
          if (ipEvidence.ipAddress && this.isValidIp(ipEvidence.ipAddress)) {
            ips.push(ipEvidence.ipAddress.trim());
          }
        }

        // Check for senderIp in email/mailbox evidence
        if (item['@odata.type']?.includes('mailboxEvidence') || item['@odata.type']?.includes('Mailbox')) {
          const mailEvidence = item as any;
          if (mailEvidence.senderIp && this.isValidIp(mailEvidence.senderIp)) {
            ips.push(mailEvidence.senderIp.trim());
          }
        }
      }
    }

    // Check networkConnections for lastExternalIpAddress (using nested structure)
    if (alert.value?.networkConnections && Array.isArray(alert.value.networkConnections)) {
      for (const conn of alert.value.networkConnections) {
        if (conn.lastExternalIpAddress && this.isValidIp(conn.lastExternalIpAddress)) {
          ips.push(conn.lastExternalIpAddress.trim());
        }
      }
    }

    return [...new Set(ips)]; // Remove duplicates
  }

  /**
   * Extract domains from alert (using nested structure)
   */
  private extractDomains(alert: AlertEventDocument): string[] {
    const domains: string[] = [];

    // Check evidence for domain/URL evidence (using nested structure: alert.value.evidence)
    if (alert.value?.evidence && Array.isArray(alert.value.evidence)) {
      for (const item of alert.value.evidence) {
        // URL evidence
        if (item['@odata.type']?.includes('urlEvidence') || item['@odata.type']?.includes('Url')) {
          const urlEvidence = item as any;
          if (urlEvidence.url) {
            const domain = this.extractDomainFromUrl(urlEvidence.url);
            if (domain) {
              domains.push(domain);
            }
          }
        }

        // Domain evidence
        if (item['@odata.type']?.includes('domainEvidence') || item['@odata.type']?.includes('Domain')) {
          const domainEvidence = item as any;
          if (domainEvidence.domain) {
            domains.push(domainEvidence.domain.trim());
          }
        }
      }
    }

    // Check networkConnections for destination domains (using nested structure)
    if (alert.value?.networkConnections && Array.isArray(alert.value.networkConnections)) {
      for (const conn of alert.value.networkConnections) {
        if (conn.destinationDomain) {
          domains.push(conn.destinationDomain.trim());
        }
      }
    }

    return [...new Set(domains)]; // Remove duplicates
  }

  /**
   * Build top N list with counts and percentages
   */
  private buildTopNList(
    counts: Map<string, number>,
    topN: number,
    total: number
  ): CountStatistic[] {
    const sorted = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN);

    return sorted.map(([value, count]) => ({
      value,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0
    }));
  }

  /**
   * Validate IP address format
   */
  private isValidIp(ip: string): boolean {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}$/i;

    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }

  /**
   * Extract domain from URL
   */
  private extractDomainFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      // If URL parsing fails, try to extract domain manually
      const match = url.match(/^(?:https?:\/\/)?(?:www\.)?([^\/\s:]+)/i);
      return match ? match[1] : null;
    }
  }

  /**
   * Query existing statistics
   */
  async queryStatistics(
    filter: {
      type?: StatisticsType;
      startDate?: string;
      endDate?: string;
      periodType?: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';
    },
    options?: {
      pageSize?: number;
      continuationToken?: string;
    }
  ) {
    return await alertStatisticsRepository.queryStatistics(filter, options);
  }

  /**
   * Get statistics by ID
   */
  async getById(id: string, partitionKey: string) {
    return await alertStatisticsRepository.getById(id, partitionKey);
  }

  /**
   * Get the latest statistics for a given type and period date
   */
  async getLatestForPeriod(type: StatisticsType, periodStartDate: string) {
    return await alertStatisticsRepository.getLatestForPeriod(type, periodStartDate);
  }

  /**
   * Get all historical statistics for a given type and period date
   */
  async getAllHistoricalForPeriod(
    type: StatisticsType,
    periodStartDate: string,
    options?: {
      pageSize?: number;
      continuationToken?: string;
    }
  ) {
    return await alertStatisticsRepository.getAllHistoricalForPeriod(type, periodStartDate, options);
  }
}

// Export singleton instance
export const alertStatisticsService = new AlertStatisticsService();
