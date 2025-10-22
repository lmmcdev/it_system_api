/**
 * Tests for Detected App Repository
 */

import { detectedAppRepository } from '../../src/repositories/DetectedAppRepository';
import { graphAuthHelper } from '../../src/utils/graphAuthHelper';
import { NotFoundError, ServiceError } from '../../src/utils/errorHandler';
import { DetectedAppManagedDevice } from '../../src/models/DetectedApp';

// Mock graphAuthHelper
jest.mock('../../src/utils/graphAuthHelper', () => ({
  graphAuthHelper: {
    getAccessToken: jest.fn()
  }
}));

const mockGetAccessToken = graphAuthHelper.getAccessToken as jest.MockedFunction<typeof graphAuthHelper.getAccessToken>;

// Sample detected app managed device data
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
  userPrincipalName: 'test@example.com',
  manufacturer: 'Microsoft',
  model: 'Surface Pro',
  isEncrypted: true,
  isSupervised: false,
  enrolledDateTime: '2025-01-01T00:00:00Z',
  lastSyncDateTime: '2025-10-22T10:00:00Z'
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAccessToken.mockResolvedValue('test-access-token');
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('DetectedAppRepository', () => {
  describe('getAppManagedDevices', () => {
    it('should fetch managed devices for detected app successfully', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({
            '@odata.context': 'https://graph.microsoft.com/v1.0/$metadata#deviceManagement/detectedApps/managedDevices',
            value: [sampleDevice]
          })
        })
      ) as jest.Mock;

      const result = await detectedAppRepository.getAppManagedDevices('app-123');

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual(sampleDevice);
      expect(result.hasMore).toBe(false);
      expect(result.count).toBe(1);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/deviceManagement/detectedApps/app-123/managedDevices'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-access-token'
          })
        })
      );
    });

    it('should handle pagination with nextLink', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({
            '@odata.context': 'https://graph.microsoft.com/v1.0/$metadata#deviceManagement/detectedApps/managedDevices',
            '@odata.nextLink': 'https://graph.microsoft.com/v1.0/deviceManagement/detectedApps/app-123/managedDevices?$skip=100',
            value: [sampleDevice]
          })
        })
      ) as jest.Mock;

      const result = await detectedAppRepository.getAppManagedDevices('app-123');

      expect(result.items).toHaveLength(1);
      expect(result.hasMore).toBe(true);
      expect(result.nextLink).toContain('$skip=100');
    });

    it('should respect page size parameter', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({
            value: [sampleDevice]
          })
        })
      ) as jest.Mock;

      await detectedAppRepository.getAppManagedDevices('app-123', { pageSize: 50 });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('$top=50'),
        expect.anything()
      );
    });

    it('should use nextLink when provided', async () => {
      const nextLink = 'https://graph.microsoft.com/v1.0/deviceManagement/detectedApps/app-123/managedDevices?$skip=100';

      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({
            value: [sampleDevice]
          })
        })
      ) as jest.Mock;

      await detectedAppRepository.getAppManagedDevices('app-123', { nextLink });

      expect(global.fetch).toHaveBeenCalledWith(
        nextLink,
        expect.anything()
      );
    });

    it('should throw NotFoundError when app not found', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          text: async () => 'Detected app not found'
        })
      ) as jest.Mock;

      await expect(detectedAppRepository.getAppManagedDevices('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('should throw ServiceError on authentication failure', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          text: async () => 'Authentication failed'
        })
      ) as jest.Mock;

      await expect(detectedAppRepository.getAppManagedDevices('app-123')).rejects.toThrow(ServiceError);
      await expect(detectedAppRepository.getAppManagedDevices('app-123')).rejects.toThrow(/authentication failed/i);
    });

    it('should throw ServiceError on 403 forbidden', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 403,
          statusText: 'Forbidden',
          text: async () => 'Insufficient permissions'
        })
      ) as jest.Mock;

      await expect(detectedAppRepository.getAppManagedDevices('app-123')).rejects.toThrow(ServiceError);
      await expect(detectedAppRepository.getAppManagedDevices('app-123')).rejects.toThrow(/authentication failed/i);
    });

    it('should throw ServiceError on 429 rate limit', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          headers: {
            get: (name: string) => (name === 'Retry-After' ? '60' : null)
          },
          text: async () => 'Rate limit exceeded'
        })
      ) as jest.Mock;

      await expect(detectedAppRepository.getAppManagedDevices('app-123')).rejects.toThrow(ServiceError);
      await expect(detectedAppRepository.getAppManagedDevices('app-123')).rejects.toThrow(/rate limit/i);
    });

    it('should throw ServiceError on network error', async () => {
      global.fetch = jest.fn(() =>
        Promise.reject(new TypeError('fetch failed'))
      ) as jest.Mock;

      await expect(detectedAppRepository.getAppManagedDevices('app-123')).rejects.toThrow(ServiceError);
      await expect(detectedAppRepository.getAppManagedDevices('app-123')).rejects.toThrow(/network error/i);
    });

    it('should throw ServiceError on timeout', async () => {
      global.fetch = jest.fn(() =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: async () => ({ value: [] })
            });
          }, 35000); // Longer than timeout
        })
      ) as jest.Mock;

      await expect(detectedAppRepository.getAppManagedDevices('app-123')).rejects.toThrow(ServiceError);
      await expect(detectedAppRepository.getAppManagedDevices('app-123')).rejects.toThrow(/timeout/i);
    }, 35000);

    it('should handle empty results', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({
            value: []
          })
        })
      ) as jest.Mock;

      const result = await detectedAppRepository.getAppManagedDevices('app-123');

      expect(result.items).toHaveLength(0);
      expect(result.hasMore).toBe(false);
      expect(result.count).toBe(0);
    });

    it('should limit page size to maximum (999)', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({
            value: []
          })
        })
      ) as jest.Mock;

      await detectedAppRepository.getAppManagedDevices('app-123', { pageSize: 2000 });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('$top=999'),
        expect.anything()
      );
    });
  });
});
