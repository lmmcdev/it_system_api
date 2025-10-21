/**
 * Risk Detection Event service layer
 * Contains business logic for Risk Detection Event read operations
 */

import { RiskDetectionEvent } from '../models/RiskDetectionEvent';
import { riskDetectionRepository, PaginatedResponse } from '../repositories/RiskDetectionRepository';
import { logger } from '../utils/logger';

export class RiskDetectionService {
  /**
   * Get risk detection event by ID
   */
  async getRiskDetectionEventById(id: string): Promise<RiskDetectionEvent> {
    logger.info('Service: Fetching risk detection event by ID', { id });

    const riskDetectionEvent = await riskDetectionRepository.getById(id);

    logger.info('Service: Risk detection event fetched successfully', { id });

    return riskDetectionEvent;
  }

  /**
   * Get all risk detection events with optional filtering and pagination
   */
  async getAllRiskDetectionEvents(
    filter?: {
      riskLevel?: string;
      riskState?: string;
      userId?: string;
      startDate?: string;
      endDate?: string;
    },
    options?: {
      pageSize?: number;
      continuationToken?: string;
    }
  ): Promise<PaginatedResponse<RiskDetectionEvent>> {
    logger.info('Service: Fetching all risk detection events', { filter, options });

    const result = await riskDetectionRepository.getAll(filter, options);

    logger.info('Service: Risk detection events fetched successfully', {
      count: result.count,
      hasMore: result.hasMore
    });

    return result;
  }

  /**
   * Get risk detection events by risk level with pagination
   */
  async getRiskDetectionEventsByRiskLevel(
    riskLevel: string,
    options?: { pageSize?: number; continuationToken?: string }
  ): Promise<PaginatedResponse<RiskDetectionEvent>> {
    logger.info('Service: Fetching risk detection events by risk level', { riskLevel, options });

    const result = await riskDetectionRepository.getByRiskLevel(riskLevel, options);

    logger.info('Service: Risk detection events by risk level fetched successfully', {
      riskLevel,
      count: result.count,
      hasMore: result.hasMore
    });

    return result;
  }

  /**
   * Get risk detection events by risk state with pagination
   */
  async getRiskDetectionEventsByRiskState(
    riskState: string,
    options?: { pageSize?: number; continuationToken?: string }
  ): Promise<PaginatedResponse<RiskDetectionEvent>> {
    logger.info('Service: Fetching risk detection events by risk state', { riskState, options });

    const result = await riskDetectionRepository.getByRiskState(riskState, options);

    logger.info('Service: Risk detection events by risk state fetched successfully', {
      riskState,
      count: result.count,
      hasMore: result.hasMore
    });

    return result;
  }

  /**
   * Get risk detection events by user ID with pagination
   */
  async getRiskDetectionEventsByUserId(
    userId: string,
    options?: { pageSize?: number; continuationToken?: string }
  ): Promise<PaginatedResponse<RiskDetectionEvent>> {
    logger.info('Service: Fetching risk detection events by user ID', { userId, options });

    const result = await riskDetectionRepository.getByUserId(userId, options);

    logger.info('Service: Risk detection events by user ID fetched successfully', {
      userId,
      count: result.count,
      hasMore: result.hasMore
    });

    return result;
  }

  /**
   * Get risk detection events within a date range with pagination
   */
  async getRiskDetectionEventsByDateRange(
    startDate: string,
    endDate: string,
    options?: { pageSize?: number; continuationToken?: string }
  ): Promise<PaginatedResponse<RiskDetectionEvent>> {
    logger.info('Service: Fetching risk detection events by date range', { startDate, endDate, options });

    const result = await riskDetectionRepository.getByDateRange(startDate, endDate, options);

    logger.info('Service: Risk detection events by date range fetched successfully', {
      startDate,
      endDate,
      count: result.count,
      hasMore: result.hasMore
    });

    return result;
  }

  /**
   * Check if risk detection event exists
   */
  async riskDetectionEventExists(id: string): Promise<boolean> {
    logger.info('Service: Checking if risk detection event exists', { id });

    const exists = await riskDetectionRepository.exists(id);

    logger.info('Service: Risk detection event existence checked', { id, exists });

    return exists;
  }
}

// Export singleton instance
export const riskDetectionService = new RiskDetectionService();
