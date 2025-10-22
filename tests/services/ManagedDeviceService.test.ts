/**
 * Tests for Managed Device Service
 */

import { managedDeviceService } from '../../src/services/ManagedDeviceService';
import { managedDeviceRepository } from '../../src/repositories/ManagedDeviceRepository';
import { ManagedDevice, ComplianceState, ManagementState } from '../../src/models/ManagedDevice';

// Mock repository
jest.mock('../../src/repositories/ManagedDeviceRepository', () => ({
  managedDeviceRepository: {
    getById: jest.fn(),
    getAll: jest.fn(),
    getByUserId: jest.fn(),
    getByComplianceState: jest.fn(),
    getNonCompliantDevices: jest.fn(),
    getByOperatingSystem: jest.fn(),
    getByDeviceType: jest.fn(),
    exists: jest.fn()
  }
}));

const mockGetById = managedDeviceRepository.getById as jest.MockedFunction<typeof managedDeviceRepository.getById>;
const mockGetAll = managedDeviceRepository.getAll as jest.MockedFunction<typeof managedDeviceRepository.getAll>;
const mockGetByUserId = managedDeviceRepository.getByUserId as jest.MockedFunction<typeof managedDeviceRepository.getByUserId>;
const mockGetByComplianceState = managedDeviceRepository.getByComplianceState as jest.MockedFunction<typeof managedDeviceRepository.getByComplianceState>;
const mockGetNonCompliantDevices = managedDeviceRepository.getNonCompliantDevices as jest.MockedFunction<typeof managedDeviceRepository.getNonCompliantDevices>;
const mockExists = managedDeviceRepository.exists as jest.MockedFunction<typeof managedDeviceRepository.exists>;

// Sample data
const sampleDevice: ManagedDevice = {
  id: 'device-123',
  deviceName: 'Test Device',
  userId: 'user-123',
  complianceState: ComplianceState.Compliant,
  operatingSystem: 'Windows',
  osVersion: '10.0.19044',
  managementState: ManagementState.Managed
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

describe('ManagedDeviceService', () => {
  describe('getManagedDeviceById', () => {
    it('should fetch device by ID', async () => {
      mockGetById.mockResolvedValue(sampleDevice);

      const result = await managedDeviceService.getManagedDeviceById('device-123');

      expect(result).toEqual(sampleDevice);
      expect(mockGetById).toHaveBeenCalledWith('device-123');
    });

    it('should propagate errors from repository', async () => {
      const error = new Error('Device not found');
      mockGetById.mockRejectedValue(error);

      await expect(managedDeviceService.getManagedDeviceById('nonexistent')).rejects.toThrow(error);
    });
  });

  describe('getAllManagedDevices', () => {
    it('should fetch all devices without filters', async () => {
      mockGetAll.mockResolvedValue(samplePaginatedResponse);

      const result = await managedDeviceService.getAllManagedDevices();

      expect(result).toEqual(samplePaginatedResponse);
      expect(mockGetAll).toHaveBeenCalledWith(undefined, undefined);
    });

    it('should fetch devices with filters', async () => {
      mockGetAll.mockResolvedValue(samplePaginatedResponse);

      const filters = {
        complianceState: 'compliant',
        operatingSystem: 'Windows'
      };

      const result = await managedDeviceService.getAllManagedDevices(filters);

      expect(result).toEqual(samplePaginatedResponse);
      expect(mockGetAll).toHaveBeenCalledWith(filters, undefined);
    });

    it('should pass pagination options', async () => {
      mockGetAll.mockResolvedValue(samplePaginatedResponse);

      const options = { pageSize: 50, nextLink: 'next-page' };

      await managedDeviceService.getAllManagedDevices(undefined, options);

      expect(mockGetAll).toHaveBeenCalledWith(undefined, options);
    });
  });

  describe('getManagedDevicesByUserId', () => {
    it('should fetch devices by user ID', async () => {
      mockGetByUserId.mockResolvedValue(samplePaginatedResponse);

      const result = await managedDeviceService.getManagedDevicesByUserId('user-123');

      expect(result).toEqual(samplePaginatedResponse);
      expect(mockGetByUserId).toHaveBeenCalledWith('user-123', undefined);
    });
  });

  describe('getManagedDevicesByComplianceState', () => {
    it('should fetch devices by compliance state', async () => {
      mockGetByComplianceState.mockResolvedValue(samplePaginatedResponse);

      const result = await managedDeviceService.getManagedDevicesByComplianceState('compliant');

      expect(result).toEqual(samplePaginatedResponse);
      expect(mockGetByComplianceState).toHaveBeenCalledWith('compliant', undefined);
    });

    it('should handle array of compliance states', async () => {
      mockGetByComplianceState.mockResolvedValue(samplePaginatedResponse);

      const states = ['compliant', 'noncompliant'];
      await managedDeviceService.getManagedDevicesByComplianceState(states);

      expect(mockGetByComplianceState).toHaveBeenCalledWith(states, undefined);
    });
  });

  describe('getNonCompliantDevices', () => {
    it('should fetch non-compliant devices', async () => {
      const nonCompliantDevice: ManagedDevice = {
        ...sampleDevice,
        complianceState: ComplianceState.Noncompliant
      };

      mockGetNonCompliantDevices.mockResolvedValue({
        items: [nonCompliantDevice],
        nextLink: undefined,
        hasMore: false,
        count: 1
      });

      const result = await managedDeviceService.getNonCompliantDevices();

      expect(result.items[0].complianceState).toBe(ComplianceState.Noncompliant);
      expect(mockGetNonCompliantDevices).toHaveBeenCalled();
    });
  });

  describe('managedDeviceExists', () => {
    it('should return true if device exists', async () => {
      mockExists.mockResolvedValue(true);

      const result = await managedDeviceService.managedDeviceExists('device-123');

      expect(result).toBe(true);
      expect(mockExists).toHaveBeenCalledWith('device-123');
    });

    it('should return false if device does not exist', async () => {
      mockExists.mockResolvedValue(false);

      const result = await managedDeviceService.managedDeviceExists('nonexistent');

      expect(result).toBe(false);
    });
  });
});
