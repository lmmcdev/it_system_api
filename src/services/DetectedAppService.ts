/**
 * Detected App service layer
 * Contains business logic for Detected App operations
 */

import { DetectedAppManagedDevice } from '../models/DetectedApp';
import { detectedAppRepository, PaginatedResponse } from '../repositories/DetectedAppRepository';
import { logger } from '../utils/logger';

export class DetectedAppService {
  /**
   * Get managed devices that have a specific detected app installed
   */
  async getAppManagedDevices(
    appId: string,
    options?: {
      pageSize?: number;
      nextLink?: string;
    }
  ): Promise<PaginatedResponse<DetectedAppManagedDevice>> {
    logger.info('Service: Fetching managed devices for detected app', { appId, options });

    const result = await detectedAppRepository.getAppManagedDevices(appId, options);

    logger.info('Service: Managed devices for detected app fetched successfully', {
      appId,
      count: result.count,
      hasMore: result.hasMore
    });

    return result;
  }
}

// Export singleton instance
export const detectedAppService = new DetectedAppService();
