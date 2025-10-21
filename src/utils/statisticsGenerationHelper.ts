/**
 * Shared utility functions for alert statistics generation
 * Used by both timer trigger and manual HTTP trigger
 */

import { alertStatisticsRepository } from '../repositories/AlertStatisticsRepository';
import { alertStatisticsService } from '../services/AlertStatisticsService';
import { StatisticsPeriod } from '../models/AlertStatistics';
import { logger } from './logger';
import { ServiceError } from './errorHandler';
import { validateISODate } from './validator';

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
      ? determineInitialRunPeriod()
      : determineDailyPeriod();

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
 * Determine the period for initial run
 * With daily UPSERT pattern, initial run processes the current day just like daily runs
 * This ensures consistent ID format and UPSERT behavior
 *
 * Note: To backfill historical data, run the timer function for each historical day
 * or use a separate backfill script that processes each day individually
 *
 * SECURITY: Robust date handling with validation to prevent edge cases
 */
function determineInitialRunPeriod(): StatisticsPeriod {
  // Initial run now processes current day (same as daily run)
  // This ensures UPSERT pattern works correctly with ID format: {type}_{YYYY-MM-DD}
  const now = new Date();

  // SECURITY: Validate current time is valid
  if (isNaN(now.getTime())) {
    throw new ServiceError('System time is invalid - cannot determine period');
  }

  // Start of current day (00:00:00.000 UTC)
  // Using Date.UTC for precision and avoiding DST/timezone issues
  const startOfDay = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    0, 0, 0, 0
  ));

  // End of current day (23:59:59.999 UTC)
  // Use 86400000ms (24 hours) - 1ms for precision
  const endOfDay = new Date(startOfDay.getTime() + 86400000 - 1);

  // SECURITY: Validate both dates are valid after calculation
  if (isNaN(startOfDay.getTime()) || isNaN(endOfDay.getTime())) {
    throw new ServiceError('Failed to calculate period dates - date calculation error');
  }

  const startDate = startOfDay.toISOString();
  const endDate = endOfDay.toISOString();

  // SECURITY: Validate ISO format succeeded
  const startCheck = validateISODate(startDate);
  const endCheck = validateISODate(endDate);

  if (!startCheck.valid || !endCheck.valid) {
    throw new ServiceError('Generated period dates are invalid - ISO format validation failed');
  }

  logger.info('[Statistics Generation] Initial run period determined (current day only)', {
    startDate,
    endDate,
    periodType: 'daily',
    note: 'Initial run processes current day to enable UPSERT pattern. For historical backfill, process each day separately.'
  });

  return {
    startDate,
    endDate,
    periodType: 'daily'
  };
}

/**
 * Determine the period for daily incremental run
 * Processes alerts from the FULL current day (00:00:00 to 23:59:59.999 UTC)
 * This ensures statistics always cover the complete day, enabling proper UPSERT
 *
 * SECURITY: Robust date handling with validation to prevent edge cases
 */
function determineDailyPeriod(): StatisticsPeriod {
  const now = new Date();

  // SECURITY: Validate current time is valid
  if (isNaN(now.getTime())) {
    throw new ServiceError('System time is invalid - cannot determine period');
  }

  // Start of current day (00:00:00.000 UTC)
  // Using Date.UTC for precision and avoiding DST/timezone issues
  const startOfDay = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    0, 0, 0, 0
  ));

  // End of current day (23:59:59.999 UTC)
  // Use 86400000ms (24 hours) - 1ms for precision
  // This is more reliable than setUTCHours and handles edge cases
  const endOfDay = new Date(startOfDay.getTime() + 86400000 - 1);

  // SECURITY: Validate both dates are valid after calculation
  if (isNaN(startOfDay.getTime()) || isNaN(endOfDay.getTime())) {
    throw new ServiceError('Failed to calculate period dates - date calculation error');
  }

  const startDate = startOfDay.toISOString();
  const endDate = endOfDay.toISOString();

  // SECURITY: Validate ISO format succeeded
  const startCheck = validateISODate(startDate);
  const endCheck = validateISODate(endDate);

  if (!startCheck.valid || !endCheck.valid) {
    throw new ServiceError('Generated period dates are invalid - ISO format validation failed');
  }

  logger.info('[Statistics Generation] Daily period determined (full day)', {
    startDate,
    endDate,
    periodType: 'daily',
    note: 'Full day coverage enables UPSERT pattern (same ID per day)'
  });

  return {
    startDate,
    endDate,
    periodType: 'daily'
  };
}
