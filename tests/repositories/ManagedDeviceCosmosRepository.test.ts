/**
 * Test suite for ManagedDeviceCosmosRepository
 * Tests UPSERT operations, bulk operations, error handling, and sync metadata
 */

import { ManagedDeviceCosmosRepository } from '../../src/repositories/ManagedDeviceCosmosRepository';
import { ManagedDevice } from '../../src/models/ManagedDevice';
import { SyncMetadata, createInitialSyncMetadata } from '../../src/models/SyncMetadata';
import { NotFoundError, ServiceError, ConflictError } from '../../src/utils/errorHandler';

// Mock CosmosDB client
jest.mock('@azure/cosmos', () => {
  const mockItems = {
    upsert: jest.fn(),
    bulk: jest.fn(),
    query: jest.fn()
  };

  const mockItem = jest.fn(() => ({
    read: jest.fn(),
    delete: jest.fn()
  }));

  const mockContainer = {
    items: mockItems,
    item: mockItem
  };

  const mockDatabase = {
    container: jest.fn(() => mockContainer)
  };

  const mockClient = {
    database: jest.fn(() => mockDatabase)
  };

  return {
    CosmosClient: jest.fn(() => mockClient)
  };
});

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    setContext: jest.fn(),
    clearContext: jest.fn()
  }
}));

// Mock config
jest.mock('../../src/config/environment', () => ({
  config: {
    cosmos: {
      endpoint: 'https://test.documents.azure.com:443/',
      key: 'test-key',
      databaseId: 'test-db',
      devicesIntuneContainerId: 'devices_intune'
    },
    deviceSync: {
      batchSize: 100,
      timerSchedule: '0 0 */6 * * *'
    }
  }
}));

describe('ManagedDeviceCosmosRepository', () => {
  let repository: ManagedDeviceCosmosRepository;
  let mockContainer: any;
  let mockItems: any;
  let mockItem: any;

  const mockDevice: ManagedDevice = {
    id: 'device-123',
    deviceName: 'TEST-DEVICE-001',
    userId: 'user-456',
    operatingSystem: 'Windows',
    osVersion: '10.0.19045',
    complianceState: 'compliant' as any,
    lastSyncDateTime: '2025-10-23T10:00:00Z',
    enrolledDateTime: '2025-01-15T08:00:00Z'
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Get mocked container
    const { CosmosClient } = require('@azure/cosmos');
    const client = new CosmosClient();
    const database = client.database();
    mockContainer = database.container();
    mockItems = mockContainer.items;
    mockItem = mockContainer.item;

    repository = new ManagedDeviceCosmosRepository();
  });

  describe('upsertDevice', () => {
    it('should successfully upsert a device', async () => {
      const mockResponse = {
        resource: mockDevice,
        requestCharge: 10.5
      };

      mockItems.upsert.mockResolvedValue(mockResponse);

      const result = await repository.upsertDevice(mockDevice);

      expect(result).toEqual(mockDevice);
      expect(mockItems.upsert).toHaveBeenCalledWith(mockDevice);
      expect(mockItems.upsert).toHaveBeenCalledTimes(1);
    });

    it('should handle 409 conflict errors', async () => {
      const conflictError: any = new Error('Conflict');
      conflictError.code = 409;

      mockItems.upsert.mockRejectedValue(conflictError);

      await expect(repository.upsertDevice(mockDevice)).rejects.toThrow(ConflictError);
    });

    it('should retry on 429 throttling with backoff', async () => {
      const throttleError: any = new Error('Throttled');
      throttleError.code = 429;
      throttleError.retryAfterInMilliseconds = 100;

      const mockResponse = {
        resource: mockDevice,
        requestCharge: 10.5
      };

      // First call fails with 429, second succeeds
      mockItems.upsert
        .mockRejectedValueOnce(throttleError)
        .mockResolvedValueOnce(mockResponse);

      const result = await repository.upsertDevice(mockDevice);

      expect(result).toEqual(mockDevice);
      expect(mockItems.upsert).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries on 429', async () => {
      const throttleError: any = new Error('Throttled');
      throttleError.code = 429;
      throttleError.retryAfterInMilliseconds = 10;

      mockItems.upsert.mockRejectedValue(throttleError);

      await expect(repository.upsertDevice(mockDevice)).rejects.toThrow(ServiceError);
      expect(mockItems.upsert).toHaveBeenCalledTimes(4); // Initial + 3 retries (MAX_RETRY_ATTEMPTS)
    });

    it('should handle timeout errors', async () => {
      // Simulate timeout by delaying response beyond timeout threshold
      mockItems.upsert.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve({ resource: mockDevice, requestCharge: 10 }), 35000);
        });
      });

      await expect(repository.upsertDevice(mockDevice)).rejects.toThrow(ServiceError);
    }, 40000); // Increase test timeout

    it('should handle generic errors', async () => {
      const genericError = new Error('Database error');
      mockItems.upsert.mockRejectedValue(genericError);

      await expect(repository.upsertDevice(mockDevice)).rejects.toThrow(ServiceError);
    });
  });

  describe('bulkUpsertDevices', () => {
    it('should successfully bulk upsert devices', async () => {
      const devices: ManagedDevice[] = [
        { ...mockDevice, id: 'device-1', deviceName: 'DEVICE-001' },
        { ...mockDevice, id: 'device-2', deviceName: 'DEVICE-002' },
        { ...mockDevice, id: 'device-3', deviceName: 'DEVICE-003' }
      ];

      const mockBulkResponse = [
        { statusCode: 201, requestCharge: 5.2 },
        { statusCode: 200, requestCharge: 5.1 },
        { statusCode: 201, requestCharge: 5.3 }
      ];

      mockItems.bulk.mockResolvedValue(mockBulkResponse);

      const result = await repository.bulkUpsertDevices(devices);

      expect(result.successCount).toBe(3);
      expect(result.failureCount).toBe(0);
      expect(result.totalRuConsumed).toBeCloseTo(15.6, 1);
      expect(result.errors).toHaveLength(0);
      expect(mockItems.bulk).toHaveBeenCalledTimes(1);
    });

    it('should handle partial failures in bulk operation', async () => {
      const devices: ManagedDevice[] = [
        { ...mockDevice, id: 'device-1', deviceName: 'DEVICE-001' },
        { ...mockDevice, id: 'device-2', deviceName: 'DEVICE-002' },
        { ...mockDevice, id: 'device-3', deviceName: 'DEVICE-003' }
      ];

      const mockBulkResponse = [
        { statusCode: 201, requestCharge: 5.2 },
        { statusCode: 429, requestCharge: 0 }, // Throttled
        { statusCode: 201, requestCharge: 5.3 }
      ];

      mockItems.bulk.mockResolvedValue(mockBulkResponse);

      const result = await repository.bulkUpsertDevices(devices);

      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].deviceId).toBe('device-2');
      expect(result.errors[0].error).toContain('429');
    });

    it('should handle empty device array', async () => {
      const result = await repository.bulkUpsertDevices([]);

      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(0);
      expect(result.totalRuConsumed).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(mockItems.bulk).not.toHaveBeenCalled();
    });

    it('should handle bulk operation failure', async () => {
      const devices: ManagedDevice[] = [
        { ...mockDevice, id: 'device-1', deviceName: 'DEVICE-001' }
      ];

      const bulkError = new Error('Bulk operation failed');
      mockItems.bulk.mockRejectedValue(bulkError);

      const result = await repository.bulkUpsertDevices(devices);

      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].deviceId).toBe('bulk_operation');
    });
  });

  describe('getSyncMetadata', () => {
    it('should return existing sync metadata', async () => {
      const existingMetadata: SyncMetadata = {
        ...createInitialSyncMetadata(),
        lastSyncStatus: 'success',
        devicesProcessed: 100,
        lastSyncEndTime: '2025-10-23T10:00:00Z'
      };

      const mockReadResponse = {
        resource: existingMetadata,
        requestCharge: 1.0
      };

      mockItem.mockReturnValue({
        read: jest.fn().mockResolvedValue(mockReadResponse)
      });

      const result = await repository.getSyncMetadata();

      expect(result).toEqual(existingMetadata);
      expect(mockItem).toHaveBeenCalledWith('sync_metadata', 'sync_metadata');
    });

    it('should return initial metadata when not found (404)', async () => {
      const notFoundError: any = new Error('Not found');
      notFoundError.code = 404;

      mockItem.mockReturnValue({
        read: jest.fn().mockRejectedValue(notFoundError)
      });

      const result = await repository.getSyncMetadata();

      expect(result.id).toBe('sync_metadata');
      expect(result.devicesProcessed).toBe(0);
      expect(result.lastSyncStatus).toBe('success');
    });

    it('should return initial metadata when resource is null', async () => {
      const mockReadResponse = {
        resource: null,
        requestCharge: 1.0
      };

      mockItem.mockReturnValue({
        read: jest.fn().mockResolvedValue(mockReadResponse)
      });

      const result = await repository.getSyncMetadata();

      expect(result.id).toBe('sync_metadata');
      expect(result.devicesProcessed).toBe(0);
    });
  });

  describe('updateSyncMetadata', () => {
    it('should successfully update sync metadata', async () => {
      const metadata: SyncMetadata = {
        ...createInitialSyncMetadata(),
        lastSyncStatus: 'success',
        devicesProcessed: 150,
        devicesFailed: 5
      };

      const mockResponse = {
        resource: metadata,
        requestCharge: 5.0
      };

      mockItems.upsert.mockResolvedValue(mockResponse);

      const result = await repository.updateSyncMetadata(metadata);

      expect(result).toEqual(metadata);
      expect(result.id).toBe('sync_metadata');
      expect(mockItems.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'sync_metadata',
          devicesProcessed: 150,
          devicesFailed: 5
        })
      );
    });

    it('should ensure ID is always sync_metadata', async () => {
      const metadata: SyncMetadata = {
        ...createInitialSyncMetadata(),
        id: 'wrong_id' // Wrong ID
      };

      const mockResponse = {
        resource: { ...metadata, id: 'sync_metadata' },
        requestCharge: 5.0
      };

      mockItems.upsert.mockResolvedValue(mockResponse);

      const result = await repository.updateSyncMetadata(metadata);

      expect(result.id).toBe('sync_metadata');
    });
  });

  describe('getDeviceById', () => {
    it('should return device when found', async () => {
      const mockReadResponse = {
        resource: mockDevice,
        requestCharge: 1.0
      };

      mockItem.mockReturnValue({
        read: jest.fn().mockResolvedValue(mockReadResponse)
      });

      const result = await repository.getDeviceById('device-123');

      expect(result).toEqual(mockDevice);
      expect(mockItem).toHaveBeenCalledWith('device-123', 'device-123');
    });

    it('should throw NotFoundError when device not found (404)', async () => {
      const notFoundError: any = new Error('Not found');
      notFoundError.code = 404;

      mockItem.mockReturnValue({
        read: jest.fn().mockRejectedValue(notFoundError)
      });

      await expect(repository.getDeviceById('device-999')).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when resource is null', async () => {
      const mockReadResponse = {
        resource: null,
        requestCharge: 1.0
      };

      mockItem.mockReturnValue({
        read: jest.fn().mockResolvedValue(mockReadResponse)
      });

      await expect(repository.getDeviceById('device-999')).rejects.toThrow(NotFoundError);
    });
  });

  describe('deviceExists', () => {
    it('should return true when device exists', async () => {
      const mockReadResponse = {
        resource: mockDevice,
        requestCharge: 1.0
      };

      mockItem.mockReturnValue({
        read: jest.fn().mockResolvedValue(mockReadResponse)
      });

      const exists = await repository.deviceExists('device-123');

      expect(exists).toBe(true);
    });

    it('should return false when device not found', async () => {
      const notFoundError: any = new Error('Not found');
      notFoundError.code = 404;

      mockItem.mockReturnValue({
        read: jest.fn().mockRejectedValue(notFoundError)
      });

      const exists = await repository.deviceExists('device-999');

      expect(exists).toBe(false);
    });

    it('should throw error for non-404 errors', async () => {
      const serviceError = new Error('Service unavailable');

      mockItem.mockReturnValue({
        read: jest.fn().mockRejectedValue(serviceError)
      });

      await expect(repository.deviceExists('device-123')).rejects.toThrow();
    });
  });
});
