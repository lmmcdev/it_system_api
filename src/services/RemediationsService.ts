/**
 * Remediations Service
 * Business logic for remediations endpoint
 *
 * Responsibilities:
 * - TODO: Add responsibilities
 */

import { remediationsRepository, TicketSearchFilters } from '../repositories/RemediationsRepository';
import { logger } from '../utils/logger';
import { ServiceError, NotFoundError } from '../utils/errorHandler';

/**
 * Remediations Service Class
 */
export class RemediationsService {
  /**
   * Get all tickets with pagination
   */
  async getAllTickets(
    pageSize: number = 50,
    continuationToken?: string
  ): Promise<{
    tickets: unknown[];
    pagination: {
      count: number;
      hasMore: boolean;
      continuationToken?: string;
    };
  }> {
    try {
      logger.info('[RemediationsService] Getting all tickets', {
        pageSize,
        hasContinuationToken: !!continuationToken
      });

      // Call repository layer
      const result = await remediationsRepository.getAll(pageSize, continuationToken);

      logger.info('[RemediationsService] Tickets retrieved successfully', {
        count: result.count,
        hasMore: result.hasMore
      });

      return {
        tickets: result.tickets,
        pagination: {
          count: result.count,
          hasMore: result.hasMore,
          continuationToken: result.continuationToken
        }
      };
    } catch (error) {
      logger.error('[RemediationsService] Failed to get tickets', error as Error);
      throw new ServiceError('Failed to get tickets');
    }
  }

  /**
   * Get ticket by ID
   */
  async getTicketById(id: string): Promise<unknown> {
    try {
      logger.info('[RemediationsService] Getting ticket by ID', { id });

      const ticket = await remediationsRepository.getById(id);

      if (!ticket) {
        logger.info('[RemediationsService] Ticket not found', { id });
        throw new NotFoundError('Ticket not found', 'TICKET_NOT_FOUND');
      }

      logger.info('[RemediationsService] Ticket found', {
        id,
        ticketId: ticket.Ticket_ID
      });

      return ticket;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('[RemediationsService] Failed to get ticket by ID', error as Error, { id });
      throw new ServiceError('Failed to get ticket by ID');
    }
  }

  /**
   * Search ticket by Ticket_ID
   */
  async searchTicketByTicketId(ticketId: string): Promise<unknown | null> {
    try {
      logger.info('[RemediationsService] Searching ticket by Ticket_ID', { ticketId });

      const ticket = await remediationsRepository.searchByTicketId(ticketId);

      if (ticket) {
        logger.info('[RemediationsService] Ticket found by Ticket_ID', {
          ticketId,
          documentId: ticket.id
        });
      } else {
        logger.info('[RemediationsService] Ticket not found by Ticket_ID', { ticketId });
      }

      return ticket;
    } catch (error) {
      logger.error('[RemediationsService] Failed to search ticket by Ticket_ID', error as Error, { ticketId });
      throw new ServiceError('Failed to search ticket by Ticket_ID');
    }
  }

  /**
   * Search tickets with flexible filters
   */
  async searchTickets(
    filters: TicketSearchFilters,
    pageSize: number = 50,
    continuationToken?: string
  ): Promise<{
    tickets: unknown[];
    pagination: {
      count: number;
      hasMore: boolean;
      continuationToken?: string;
    };
  }> {
    try {
      logger.info('[RemediationsService] Searching tickets with filters', {
        filters,
        pageSize,
        hasContinuationToken: !!continuationToken
      });

      // Call repository layer
      const result = await remediationsRepository.searchTickets(filters, pageSize, continuationToken);

      logger.info('[RemediationsService] Tickets search completed successfully', {
        count: result.count,
        hasMore: result.hasMore
      });

      return {
        tickets: result.tickets,
        pagination: {
          count: result.count,
          hasMore: result.hasMore,
          continuationToken: result.continuationToken
        }
      };
    } catch (error) {
      logger.error('[RemediationsService] Failed to search tickets', error as Error);
      throw new ServiceError('Failed to search tickets');
    }
  }
}

// Export singleton instance
export const remediationsService = new RemediationsService();
