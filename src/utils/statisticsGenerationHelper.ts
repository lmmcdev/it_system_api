/**
 * Shared utility functions for alert statistics generation
 * Used by both timer trigger and manual HTTP trigger
 */

import { alertStatisticsRepository } from '../repositories/AlertStatisticsRepository';
import { alertStatisticsService } from '../services/AlertStatisticsService';
import { StatisticsPeriod } from '../models/AlertStatistics';
import { logger } from './logger';

/**
 * Result of statistics generation process
 */
export interface StatisticsGenerationResult {
  success: boolean;
  isInitialRun: boolean;
  period: StatisticsPeriod;
  typesGenerated: number;
  totalAlertsProcessed: number;
  totalProcessingTimeMs: number;
  results: Array<{
    type: string;
    alertsProcessed: number;
    processingTimeMs: number;
    id: string;
  }>;
  error?: string;
}

/**
 * Execute the complete statistics generation workflow
 * Determines run type, period, and generates all statistics
 */
export async function executeStatisticsGeneration(): Promise<StatisticsGenerationResult> {
  const startTime = Date.now();

  try {
    // Determine if this is an initial run or incremental run
    const isInitialRun = await checkIfInitialRun();

    const period = isInitialRun
      ? await determineInitialRunPeriod()
      : await determineDailyPeriod();

    logger.info('[Statistics Generation] Processing period determined', {
      isInitialRun,
      period,
      periodType: period.periodType
    });

    // Generate statistics for all types
    const results = await alertStatisticsService.generateStatisticsForPeriod(period, isInitialRun);

    const totalTime = Date.now() - startTime;

    const resultSummary = {
      success: true,
      isInitialRun,
      period,
      typesGenerated: results.length,
      totalAlertsProcessed: results[0]?.totalProcessed || 0,
      totalProcessingTimeMs: totalTime,
      results: results.map(r => ({
        type: r.statistics.type,
        alertsProcessed: r.totalProcessed,
        processingTimeMs: r.processingTimeMs,
        id: r.statistics.id
      }))
    };

    logger.info('[Statistics Generation] Completed successfully', resultSummary);

    return resultSummary;
  } catch (error) {
    const totalTime = Date.now() - startTime;

    logger.error('[Statistics Generation] Failed', error as Error, {
      totalProcessingTimeMs: totalTime
    });

    return {
      success: false,
      isInitialRun: false,
      period: { startDate: '', endDate: '', periodType: 'custom' },
      typesGenerated: 0,
      totalAlertsProcessed: 0,
      totalProcessingTimeMs: totalTime,
      results: [],
      error: (error as Error).message
    };
  }
}

/**
 * Check if this is the initial run (no previous statistics exist)
 * Returns true if no statistics exist for any type
 */
async function checkIfInitialRun(): Promise<boolean> {
  try {
    // Check if any statistics exist by querying for the most recent entry
    const result = await alertStatisticsRepository.queryStatistics(
      {},
      { pageSize: 1 }
    );

    const hasExistingStats = result.items.length > 0;

    logger.info('[Statistics Generation] Initial run check completed', {
      hasExistingStats,
      isInitialRun: !hasExistingStats
    });

    return !hasExistingStats;
  } catch (error) {
    logger.warn('[Statistics Generation] Failed to check for existing statistics, assuming initial run', {
      error: (error as Error).message
    });
    // If we can't determine, assume it's an initial run to be safe
    return true;
  }
}

/**
 * Determine the period for initial run (all historical data)
 * Uses a very early start date to capture all data
 */
async function determineInitialRunPeriod(): Promise<StatisticsPeriod> {
  const now = new Date();
  const endDate = now.toISOString();

  // Start from a very early date to capture all historical data
  // Using 2020-01-01 as Microsoft Defender alerts typically don't go back further
  const startDate = new Date('2020-01-01T00:00:00Z').toISOString();

  logger.info('[Statistics Generation] Initial run period determined', {
    startDate,
    endDate,
    periodType: 'custom'
  });

  return {
    startDate,
    endDate,
    periodType: 'custom'
  };
}

/**
 * Determine the period for daily incremental run
 * Processes alerts from the current day (00:00:00 to now)
 */
async function determineDailyPeriod(): Promise<StatisticsPeriod> {
  const now = new Date();

  // Start of current day (00:00:00 UTC)
  const startOfDay = new Date(now);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const startDate = startOfDay.toISOString();

  // Current time
  const endDate = now.toISOString();

  logger.info('[Statistics Generation] Daily period determined', {
    startDate,
    endDate,
    periodType: 'daily'
  });

  return {
    startDate,
    endDate,
    periodType: 'daily'
  };
}
