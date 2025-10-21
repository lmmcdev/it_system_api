/**
 * Timer-triggered Azure Function for generating alert statistics
 * Runs hourly to aggregate and store alert event statistics
 *
 * Initial run: Processes ALL historical alert events
 * Subsequent runs: Processes only current day's alert events
 */

import { app, InvocationContext, Timer } from '@azure/functions';
import { logger } from '../utils/logger';
import { executeStatisticsGeneration } from '../utils/statisticsGenerationHelper';

/**
 * Timer trigger function that generates alert statistics
 * Schedule: Configured via environment variable (default: every hour)
 *
 * Note: Schedule is read from environment variable at module load time.
 * Default: "0 0 * * * *" (every hour at :00)
 */
app.timer('generateAlertStatisticsTimer', {
  schedule: process.env.STATISTICS_TIMER_SCHEDULE || '0 0 * * * *',
  handler: async (timer: Timer, context: InvocationContext) => {
    const functionName = 'generateAlertStatisticsTimer';
    const invocationId = context.invocationId;

    logger.setContext({ functionName, invocationId });

    try {
      logger.info('[Timer] Alert statistics generation started', {
        schedule: process.env.STATISTICS_TIMER_SCHEDULE || '0 0 * * * *',
        isPastDue: timer.isPastDue,
        scheduleStatus: timer.scheduleStatus
      });

      // Execute statistics generation
      const result = await executeStatisticsGeneration();

      if (result.success) {
        logger.info('[Timer] Alert statistics generation completed successfully', {
          isInitialRun: result.isInitialRun,
          period: result.period,
          typesGenerated: result.typesGenerated,
          totalAlertsProcessed: result.totalAlertsProcessed,
          totalProcessingTimeMs: result.totalProcessingTimeMs,
          results: result.results
        });
      } else {
        logger.error('[Timer] Alert statistics generation failed', new Error(result.error), {
          isPastDue: timer.isPastDue
        });
      }

    } catch (error) {
      logger.error('[Timer] Alert statistics generation failed', error as Error, {
        isPastDue: timer.isPastDue
      });

      // Don't throw - let the function complete but log the error
      // Azure Functions will retry based on retry policy
    } finally {
      logger.clearContext();
    }
  }
});

