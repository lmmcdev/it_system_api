/**
 * Managed Device service layer
 * Contains business logic for Managed Device operations
 */

import { ManagedDevice } from '../models/ManagedDevice';
import { managedDeviceRepository, PaginatedResponse } from '../repositories/ManagedDeviceRepository';
import { logger } from '../utils/logger';

export class ManagedDeviceService {
  /**
   * Get managed device by ID
   */
  async getManagedDeviceById(id: string): Promise<ManagedDevice> {
    logger.info('Service: Fetching managed device by ID', { id });

    const device = await managedDeviceRepository.getById(id);

    logger.info('Service: Managed device fetched successfully', {
      id,
      deviceName: device.deviceName,
      complianceState: device.complianceState
    });

    return device;
  }

  /**
   * Get all managed devices with optional filtering and pagination
   */
  async getAllManagedDevices(
    filter?: {
      complianceState?: string | string[];
      operatingSystem?: string | string[];
      deviceType?: string | string[];
      managementState?: string | string[];
      userId?: string;
    },
    options?: {
      pageSize?: number;
      nextLink?: string;
      select?: string[];
    }
  ): Promise<PaginatedResponse<ManagedDevice>> {
    logger.info('Service: Fetching all managed devices', { filter, options });

    const result = await managedDeviceRepository.getAll(filter, options);

    logger.info('Service: Managed devices fetched successfully', {
      count: result.count,
      hasMore: result.hasMore
    });

    return result;
  }

  /**
   * Get managed devices by user ID
   */
  async getManagedDevicesByUserId(
    userId: string,
    options?: { pageSize?: number; nextLink?: string }
  ): Promise<PaginatedResponse<ManagedDevice>> {
    logger.info('Service: Fetching managed devices by user ID', { userId, options });

    const result = await managedDeviceRepository.getByUserId(userId, options);

    logger.info('Service: Managed devices by user ID fetched successfully', {
      userId,
      count: result.count,
      hasMore: result.hasMore
    });

    return result;
  }

  /**
   * Get managed devices by compliance state
   */
  async getManagedDevicesByComplianceState(
    complianceState: string | string[],
    options?: { pageSize?: number; nextLink?: string }
  ): Promise<PaginatedResponse<ManagedDevice>> {
    logger.info('Service: Fetching managed devices by compliance state', { complianceState, options });

    const result = await managedDeviceRepository.getByComplianceState(complianceState, options);

    logger.info('Service: Managed devices by compliance state fetched successfully', {
      complianceState,
      count: result.count,
      hasMore: result.hasMore
    });

    return result;
  }

  /**
   * Get non-compliant devices
   */
  async getNonCompliantDevices(
    options?: { pageSize?: number; nextLink?: string }
  ): Promise<PaginatedResponse<ManagedDevice>> {
    logger.info('Service: Fetching non-compliant devices', { options });

    const result = await managedDeviceRepository.getNonCompliantDevices(options);

    logger.info('Service: Non-compliant devices fetched successfully', {
      count: result.count,
      hasMore: result.hasMore
    });

    return result;
  }

  /**
   * Get managed devices by operating system
   */
  async getManagedDevicesByOperatingSystem(
    operatingSystem: string | string[],
    options?: { pageSize?: number; nextLink?: string }
  ): Promise<PaginatedResponse<ManagedDevice>> {
    logger.info('Service: Fetching managed devices by operating system', { operatingSystem, options });

    const result = await managedDeviceRepository.getByOperatingSystem(operatingSystem, options);

    logger.info('Service: Managed devices by operating system fetched successfully', {
      operatingSystem,
      count: result.count,
      hasMore: result.hasMore
    });

    return result;
  }

  /**
   * Get managed devices by device type
   */
  async getManagedDevicesByDeviceType(
    deviceType: string | string[],
    options?: { pageSize?: number; nextLink?: string }
  ): Promise<PaginatedResponse<ManagedDevice>> {
    logger.info('Service: Fetching managed devices by device type', { deviceType, options });

    const result = await managedDeviceRepository.getByDeviceType(deviceType, options);

    logger.info('Service: Managed devices by device type fetched successfully', {
      deviceType,
      count: result.count,
      hasMore: result.hasMore
    });

    return result;
  }

  /**
   * Check if managed device exists
   */
  async managedDeviceExists(id: string): Promise<boolean> {
    logger.info('Service: Checking if managed device exists', { id });

    const exists = await managedDeviceRepository.exists(id);

    logger.info('Service: Managed device existence checked', { id, exists });

    return exists;
  }
}

// Export singleton instance
export const managedDeviceService = new ManagedDeviceService();
