/**
 * Alert Event service layer
 * Contains business logic for Alert Event read operations
 */

import { AlertEvent } from '../models/AlertEvent';
import { alertEventRepository, PaginatedResponse } from '../repositories/AlertEventRepository';
import { logger } from '../utils/logger';

export class AlertEventService {
  /**
   * Get alert event by ID
   */
  async getAlertEventById(id: string): Promise<AlertEvent> {
    logger.info('Service: Fetching alert event by ID', { id });

    const alertEvent = await alertEventRepository.getById(id);

    logger.info('Service: Alert event fetched successfully', { id });

    return alertEvent;
  }

  /**
   * Get all alert events with optional filtering and pagination
   */
  async getAllAlertEvents(
    filter?: {
      severity?: string;
      status?: string;
      category?: string;
      startDate?: string;
      endDate?: string;
    },
    options?: {
      pageSize?: number;
      continuationToken?: string;
    }
  ): Promise<PaginatedResponse<AlertEvent>> {
    logger.info('Service: Fetching all alert events', { filter, options });

    const result = await alertEventRepository.getAll(filter, options);

    logger.info('Service: Alert events fetched successfully', {
      count: result.count,
      hasMore: result.hasMore
    });

    return result;
  }

  /**
   * Get alert events by severity with pagination
   */
  async getAlertEventsBySeverity(
    severity: string,
    options?: { pageSize?: number; continuationToken?: string }
  ): Promise<PaginatedResponse<AlertEvent>> {
    logger.info('Service: Fetching alert events by severity', { severity, options });

    const result = await alertEventRepository.getBySeverity(severity, options);

    logger.info('Service: Alert events by severity fetched successfully', {
      severity,
      count: result.count,
      hasMore: result.hasMore
    });

    return result;
  }

  /**
   * Get alert events by status with pagination
   */
  async getAlertEventsByStatus(
    status: string,
    options?: { pageSize?: number; continuationToken?: string }
  ): Promise<PaginatedResponse<AlertEvent>> {
    logger.info('Service: Fetching alert events by status', { status, options });

    const result = await alertEventRepository.getByStatus(status, options);

    logger.info('Service: Alert events by status fetched successfully', {
      status,
      count: result.count,
      hasMore: result.hasMore
    });

    return result;
  }

  /**
   * Get alert events by category with pagination
   */
  async getAlertEventsByCategory(
    category: string,
    options?: { pageSize?: number; continuationToken?: string }
  ): Promise<PaginatedResponse<AlertEvent>> {
    logger.info('Service: Fetching alert events by category', { category, options });

    const result = await alertEventRepository.getByCategory(category, options);

    logger.info('Service: Alert events by category fetched successfully', {
      category,
      count: result.count,
      hasMore: result.hasMore
    });

    return result;
  }

  /**
   * Get alert events within a date range with pagination
   */
  async getAlertEventsByDateRange(
    startDate: string,
    endDate: string,
    options?: { pageSize?: number; continuationToken?: string }
  ): Promise<PaginatedResponse<AlertEvent>> {
    logger.info('Service: Fetching alert events by date range', { startDate, endDate, options });

    const result = await alertEventRepository.getByDateRange(startDate, endDate, options);

    logger.info('Service: Alert events by date range fetched successfully', {
      startDate,
      endDate,
      count: result.count,
      hasMore: result.hasMore
    });

    return result;
  }

  /**
   * Check if alert event exists
   */
  async alertEventExists(id: string): Promise<boolean> {
    logger.info('Service: Checking if alert event exists', { id });

    const exists = await alertEventRepository.exists(id);

    logger.info('Service: Alert event existence checked', { id, exists });

    return exists;
  }
}

// Export singleton instance
export const alertEventService = new AlertEventService();
