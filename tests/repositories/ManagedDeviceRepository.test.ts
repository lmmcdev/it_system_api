/**
 * Tests for Managed Device Repository
 */

import { managedDeviceRepository } from '../../src/repositories/ManagedDeviceRepository';
import { graphAuthHelper } from '../../src/utils/graphAuthHelper';
import { NotFoundError, ServiceError } from '../../src/utils/errorHandler';
import { ManagedDevice, ComplianceState, ManagementState } from '../../src/models/ManagedDevice';

// Mock graphAuthHelper
jest.mock('../../src/utils/graphAuthHelper', () => ({
  graphAuthHelper: {
    getAccessToken: jest.fn()
  }
}));

const mockGetAccessToken = graphAuthHelper.getAccessToken as jest.MockedFunction<typeof graphAuthHelper.getAccessToken>;

// Sample managed device data
const sampleDevice: ManagedDevice = {
  id: 'device-123',
  deviceName: 'Test Device',
  userId: 'user-123',
  complianceState: ComplianceState.Compliant,
  operatingSystem: 'Windows',
  osVersion: '10.0.19044',
  deviceType: 'Desktop',
  managementState: ManagementState.Managed,
  userDisplayName: 'Test User',
  userPrincipalName: 'test@example.com'
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAccessToken.mockResolvedValue('test-access-token');
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('ManagedDeviceRepository', () => {
  describe('getById', () => {
    it('should fetch device by ID successfully', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => sampleDevice
        })
      ) as jest.Mock;

      const device = await managedDeviceRepository.getById('device-123');

      expect(device).toEqual(sampleDevice);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/deviceManagement/managedDevices/device-123'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-access-token'
          })
        })
      );
    });

    it('should throw NotFoundError when device not found', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          text: async () => 'Device not found'
        })
      ) as jest.Mock;

      await expect(managedDeviceRepository.getById('nonexistent')).rejects.toThrow(NotFoundError);
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

      await expect(managedDeviceRepository.getById('device-123')).rejects.toThrow(ServiceError);
      await expect(managedDeviceRepository.getById('device-123')).rejects.toThrow(/authentication failed/i);
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

      await expect(managedDeviceRepository.getById('device-123')).rejects.toThrow(ServiceError);
      await expect(managedDeviceRepository.getById('device-123')).rejects.toThrow(/rate limit/i);
    });
  });

  describe('getAll', () => {
    it('should fetch all devices successfully', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({
            '@odata.context': 'https://graph.microsoft.com/v1.0/$metadata#deviceManagement/managedDevices',
            value: [sampleDevice]
          })
        })
      ) as jest.Mock;

      const result = await managedDeviceRepository.getAll();

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual(sampleDevice);
      expect(result.hasMore).toBe(false);
      expect(result.count).toBe(1);
    });

    it('should handle pagination with nextLink', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({
            '@odata.context': 'https://graph.microsoft.com/v1.0/$metadata#deviceManagement/managedDevices',
            '@odata.nextLink': 'https://graph.microsoft.com/v1.0/deviceManagement/managedDevices?$skip=100',
            value: [sampleDevice]
          })
        })
      ) as jest.Mock;

      const result = await managedDeviceRepository.getAll();

      expect(result.items).toHaveLength(1);
      expect(result.hasMore).toBe(true);
      expect(result.nextLink).toContain('$skip=100');
    });

    it('should build OData filter for complianceState', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({
            value: [sampleDevice]
          })
        })
      ) as jest.Mock;

      await managedDeviceRepository.getAll({ complianceState: 'noncompliant' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("$filter=complianceState%20eq%20'noncompliant'"),
        expect.anything()
      );
    });

    it('should build OData filter for multiple values', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({
            value: []
          })
        })
      ) as jest.Mock;

      await managedDeviceRepository.getAll({
        complianceState: ['compliant', 'noncompliant'],
        operatingSystem: 'Windows'
      });

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(fetchCall).toContain('$filter');
      expect(fetchCall).toContain('complianceState');
      expect(fetchCall).toContain('operatingSystem');
    });

    it('should respect page size parameter', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({
            value: []
          })
        })
      ) as jest.Mock;

      await managedDeviceRepository.getAll(undefined, { pageSize: 50 });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('$top=50'),
        expect.anything()
      );
    });
  });

  describe('getByUserId', () => {
    it('should fetch devices by user ID', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({
            value: [sampleDevice]
          })
        })
      ) as jest.Mock;

      const result = await managedDeviceRepository.getByUserId('user-123');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].userId).toBe('user-123');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("userId%20eq%20'user-123'"),
        expect.anything()
      );
    });
  });

  describe('getByComplianceState', () => {
    it('should fetch devices by compliance state', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({
            value: [sampleDevice]
          })
        })
      ) as jest.Mock;

      const result = await managedDeviceRepository.getByComplianceState('compliant');

      expect(result.items).toHaveLength(1);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("complianceState%20eq%20'compliant'"),
        expect.anything()
      );
    });
  });

  describe('getNonCompliantDevices', () => {
    it('should fetch non-compliant devices', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({
            value: [{ ...sampleDevice, complianceState: 'noncompliant' }]
          })
        })
      ) as jest.Mock;

      const result = await managedDeviceRepository.getNonCompliantDevices();

      expect(result.items).toHaveLength(1);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("complianceState%20eq%20'noncompliant'"),
        expect.anything()
      );
    });
  });

  describe('exists', () => {
    it('should return true if device exists', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => sampleDevice
        })
      ) as jest.Mock;

      const exists = await managedDeviceRepository.exists('device-123');

      expect(exists).toBe(true);
    });

    it('should return false if device not found', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          text: async () => 'Device not found'
        })
      ) as jest.Mock;

      const exists = await managedDeviceRepository.exists('nonexistent');

      expect(exists).toBe(false);
    });

    it('should throw error on other failures', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          text: async () => 'Server error'
        })
      ) as jest.Mock;

      await expect(managedDeviceRepository.exists('device-123')).rejects.toThrow(ServiceError);
    });
  });
});
