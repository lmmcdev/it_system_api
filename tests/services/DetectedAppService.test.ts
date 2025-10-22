/**
 * Tests for Detected App Service
 */

import { detectedAppService } from '../../src/services/DetectedAppService';
import { detectedAppRepository } from '../../src/repositories/DetectedAppRepository';
import { DetectedAppManagedDevice } from '../../src/models/DetectedApp';

// Mock repository
jest.mock('../../src/repositories/DetectedAppRepository', () => ({
  detectedAppRepository: {
    getAppManagedDevices: jest.fn()
  }
}));

const mockGetAppManagedDevices = detectedAppRepository.getAppManagedDevices as jest.MockedFunction<typeof detectedAppRepository.getAppManagedDevices>;

// Sample data
const sampleDevice: DetectedAppManagedDevice = {
  id: 'device-123',
  deviceName: 'Test Device',
  userId: 'user-123',
  operatingSystem: 'Windows',
  osVersion: '10.0.19044',
  deviceType: 'Desktop',
  complianceState: 'compliant',
  managementState: 'managed',
  userDisplayName: 'Test User',
  userPrincipalName: 'test@example.com'
};

const samplePaginatedResponse = {
  items: [sampleDevice],
  nextLink: undefined,
  hasMore: false,
  count: 1
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('DetectedAppService', () => {
  describe('getAppManagedDevices', () => {
    it('should fetch managed devices for detected app', async () => {
      mockGetAppManagedDevices.mockResolvedValue(samplePaginatedResponse);

      const result = await detectedAppService.getAppManagedDevices('app-123');

      expect(result).toEqual(samplePaginatedResponse);
      expect(mockGetAppManagedDevices).toHaveBeenCalledWith('app-123', undefined);
    });

    it('should pass pagination options', async () => {
      mockGetAppManagedDevices.mockResolvedValue(samplePaginatedResponse);

      const options = { pageSize: 50, nextLink: 'next-page' };

      await detectedAppService.getAppManagedDevices('app-123', options);

      expect(mockGetAppManagedDevices).toHaveBeenCalledWith('app-123', options);
    });

    it('should handle empty results', async () => {
      const emptyResponse = {
        items: [],
        nextLink: undefined,
        hasMore: false,
        count: 0
      };

      mockGetAppManagedDevices.mockResolvedValue(emptyResponse);

      const result = await detectedAppService.getAppManagedDevices('app-123');

      expect(result.items).toHaveLength(0);
      expect(result.count).toBe(0);
    });

    it('should handle pagination with nextLink', async () => {
      const paginatedResponse = {
        items: [sampleDevice],
        nextLink: 'https://graph.microsoft.com/v1.0/detectedApps/app-123/managedDevices?$skip=100',
        hasMore: true,
        count: 1
      };

      mockGetAppManagedDevices.mockResolvedValue(paginatedResponse);

      const result = await detectedAppService.getAppManagedDevices('app-123');

      expect(result.hasMore).toBe(true);
      expect(result.nextLink).toBeDefined();
    });

    it('should propagate errors from repository', async () => {
      const error = new Error('App not found');
      mockGetAppManagedDevices.mockRejectedValue(error);

      await expect(detectedAppService.getAppManagedDevices('nonexistent')).rejects.toThrow(error);
    });

    it('should handle multiple devices', async () => {
      const device2: DetectedAppManagedDevice = {
        ...sampleDevice,
        id: 'device-456',
        deviceName: 'Another Device'
      };

      const multipleDevicesResponse = {
        items: [sampleDevice, device2],
        nextLink: undefined,
        hasMore: false,
        count: 2
      };

      mockGetAppManagedDevices.mockResolvedValue(multipleDevicesResponse);

      const result = await detectedAppService.getAppManagedDevices('app-123');

      expect(result.items).toHaveLength(2);
      expect(result.count).toBe(2);
    });
  });
});
