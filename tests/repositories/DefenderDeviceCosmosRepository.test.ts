/**
 * Unit tests for DefenderDeviceCosmosRepository
 * Tests CosmosDB operations, bulk upserts, throttle retry logic, sync metadata
 */

import { DefenderDeviceCosmosRepository } from '../../src/repositories/DefenderDeviceCosmosRepository';
import { DefenderDevice } from '../../src/models/DefenderDevice';
import { SyncMetadata } from '../../src/models/SyncMetadata';
import { NotFoundError, ServiceError } from '../../src/utils/errorHandler';

// Mock CosmosClient
jest.mock('@azure/cosmos', () => {
  const mockContainer = {
    items: {
      upsert: jest.fn(),
      bulk: jest.fn()
    },
    item: jest.fn()
  };

  const mockDatabase = {
    container: jest.fn(() => mockContainer)
  };

  const MockCosmosClient = jest.fn(() => ({
    database: jest.fn(() => mockDatabase)
  }));

  return {
    CosmosClient: MockCosmosClient,
    Container: jest.fn()
  };
});

// Mock config
jest.mock('../../src/config/environment', () => ({
  config: {
    cosmos: {
      endpoint: 'https://test.documents.azure.com:443/',
      key: 'test-key',
      databaseId: 'test-db'
    },
    defenderDeviceSync: {
      containerId: 'devices_defender',
      batchSize: 100,
      timerSchedule: '0 0 */6 * * *'
    }
  }
}));

describe('DefenderDeviceCosmosRepository', () => {
  let repository: DefenderDeviceCosmosRepository;
  let mockContainer: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    repository = new DefenderDeviceCosmosRepository();

    // Get mock container for assertions
    const CosmosClient = require('@azure/cosmos').CosmosClient;
    const client = new CosmosClient();
    const database = client.database();
    mockContainer = database.container();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('upsertDevice', () => {
    const mockDevice: DefenderDevice = {
      id: 'device123',
      computerDnsName: 'TEST-MACHINE',
      osPlatform: 'Windows11',
      healthStatus: 'Active' as any,
      riskScore: 'Low' as any
    };

    it('should upsert a device successfully', async () => {
      mockContainer.items.upsert.mockResolvedValueOnce({
        resource: mockDevice,
        requestCharge: 10.5
      });

      const result = await repository.upsertDevice(mockDevice);

      expect(result).toEqual(mockDevice);
      expect(mockContainer.items.upsert).toHaveBeenCalledWith(mockDevice);
    });

    it('should handle 409 conflict errors', async () => {
      const conflictError = new Error('Conflict') as any;
      conflictError.code = 409;

      mockContainer.items.upsert.mockRejectedValueOnce(conflictError);

      await expect(repository.upsertDevice(mockDevice)).rejects.toThrow('Conflict occurred while upserting device');
    });

    it('should retry on 429 throttling with exponential backoff', async () => {
      const throttleError = new Error('Too many requests') as any;
      throttleError.code = 429;
      throttleError.retryAfterInMilliseconds = 100;

      // Fail first attempt, succeed on second
      mockContainer.items.upsert
        .mockRejectedValueOnce(throttleError)
        .mockResolvedValueOnce({
          resource: mockDevice,
          requestCharge: 10.5
        });

      const result = await repository.upsertDevice(mockDevice);

      expect(result).toEqual(mockDevice);
      expect(mockContainer.items.upsert).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries on persistent 429', async () => {
      const throttleError = new Error('Too many requests') as any;
      throttleError.code = 429;
      throttleError.retryAfterInMilliseconds = 100;

      mockContainer.items.upsert
        .mockRejectedValueOnce(throttleError)
        .mockRejectedValueOnce(throttleError)
        .mockRejectedValueOnce(throttleError)
        .mockRejectedValueOnce(throttleError); // 4 attempts total

      await expect(repository.upsertDevice(mockDevice)).rejects.toThrow('Service temporarily unavailable after retries');
      expect(mockContainer.items.upsert).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });

    it('should handle general CosmosDB errors', async () => {
      mockContainer.items.upsert.mockRejectedValueOnce(new Error('CosmosDB error'));

      await expect(repository.upsertDevice(mockDevice)).rejects.toThrow(ServiceError);
    });
  });

  describe('bulkUpsertDevices', () => {
    const mockDevices: DefenderDevice[] = [
      { id: 'device1', computerDnsName: 'MACHINE-1', osPlatform: 'Windows11', healthStatus: 'Active' as any },
      { id: 'device2', computerDnsName: 'MACHINE-2', osPlatform: 'Windows10', healthStatus: 'Active' as any },
      { id: 'device3', computerDnsName: 'MACHINE-3', osPlatform: 'Windows11', healthStatus: 'Inactive' as any }
    ];

    it('should bulk upsert devices successfully', async () => {
      const mockBulkResponse = mockDevices.map(() => ({
        statusCode: 200,
        requestCharge: 5.0,
        resourceBody: {}
      }));

      mockContainer.items.bulk.mockResolvedValueOnce(mockBulkResponse);

      const result = await repository.bulkUpsertDevices(mockDevices);

      expect(result.successCount).toBe(3);
      expect(result.failureCount).toBe(0);
      expect(result.totalRuConsumed).toBe(15.0);
      expect(result.errors).toHaveLength(0);
      expect(mockContainer.items.bulk).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            operationType: 'Upsert',
            resourceBody: mockDevices[0]
          })
        ])
      );
    });

    it('should handle partial success in bulk operations', async () => {
      const mockBulkResponse = [
        { statusCode: 200, requestCharge: 5.0, resourceBody: {} },
        { statusCode: 429, requestCharge: 0, resourceBody: {} }, // Throttled
        { statusCode: 200, requestCharge: 5.0, resourceBody: {} }
      ];

      // Mock bulk operation and subsequent individual retries
      mockContainer.items.bulk.mockResolvedValueOnce(mockBulkResponse);

      // Mock retry for throttled device
      mockContainer.items.upsert.mockResolvedValueOnce({
        resource: mockDevices[1],
        requestCharge: 10.0
      });

      const result = await repository.bulkUpsertDevices(mockDevices);

      expect(result.successCount).toBe(3); // All should succeed after retry
      expect(result.failureCount).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle throttled devices with retry logic', async () => {
      const mockBulkResponse = [
        { statusCode: 429, requestCharge: 0, resourceBody: {} },
        { statusCode: 429, requestCharge: 0, resourceBody: {} },
        { statusCode: 200, requestCharge: 5.0, resourceBody: {} }
      ];

      mockContainer.items.bulk.mockResolvedValueOnce(mockBulkResponse);

      // Mock individual upsert retries
      mockContainer.items.upsert
        .mockResolvedValueOnce({ resource: mockDevices[0], requestCharge: 10.0 })
        .mockResolvedValueOnce({ resource: mockDevices[1], requestCharge: 10.0 });

      const result = await repository.bulkUpsertDevices(mockDevices);

      expect(result.successCount).toBe(3);
      expect(result.failureCount).toBe(0);
      expect(mockContainer.items.upsert).toHaveBeenCalledTimes(2); // Retry 2 throttled devices
    });

    it('should handle empty array gracefully', async () => {
      const result = await repository.bulkUpsertDevices([]);

      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(0);
      expect(result.totalRuConsumed).toBe(0);
      expect(mockContainer.items.bulk).not.toHaveBeenCalled();
    });

    it('should return failure result on bulk operation error', async () => {
      mockContainer.items.bulk.mockRejectedValueOnce(new Error('Bulk operation failed'));

      const result = await repository.bulkUpsertDevices(mockDevices);

      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(3);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].deviceId).toBe('bulk_operation');
    });
  });

  describe('getSyncMetadata', () => {
    it('should fetch sync metadata successfully', async () => {
      const mockMetadata: SyncMetadata = {
        id: 'sync_metadata_defender',
        lastSyncStartTime: '2025-10-23T10:00:00Z',
        lastSyncEndTime: '2025-10-23T10:05:00Z',
        lastSyncStatus: 'success',
        devicesProcessed: 100,
        devicesFailed: 0,
        totalDevicesFetched: 100,
        executionTimeMs: 300000,
        errors: [],
        graphApiCalls: 5,
        graphApiPages: 1,
        totalRequestTimeMs: 5000,
        cosmosDbWrites: 100,
        totalRuConsumed: 500,
        syncVersion: '1.0.0',
        updatedAt: '2025-10-23T10:05:00Z'
      };

      const mockItem = {
        read: jest.fn().mockResolvedValueOnce({
          resource: mockMetadata,
          requestCharge: 1.0
        })
      };

      mockContainer.item.mockReturnValueOnce(mockItem);

      const result = await repository.getSyncMetadata();

      expect(result).toEqual(mockMetadata);
      expect(mockContainer.item).toHaveBeenCalledWith('sync_metadata_defender', 'sync_metadata_defender');
    });

    it('should return initial metadata if not found (404)', async () => {
      const notFoundError = new Error('Not found') as any;
      notFoundError.code = 404;

      const mockItem = {
        read: jest.fn().mockRejectedValueOnce(notFoundError)
      };

      mockContainer.item.mockReturnValueOnce(mockItem);

      const result = await repository.getSyncMetadata();

      expect(result.id).toBe('sync_metadata');
      expect(result.lastSyncStatus).toBe('success');
      expect(result.devicesProcessed).toBe(0);
    });

    it('should return initial metadata on other errors', async () => {
      const mockItem = {
        read: jest.fn().mockRejectedValueOnce(new Error('Database error'))
      };

      mockContainer.item.mockReturnValueOnce(mockItem);

      const result = await repository.getSyncMetadata();

      expect(result.id).toBe('sync_metadata');
      expect(result.devicesProcessed).toBe(0);
    });
  });

  describe('updateSyncMetadata', () => {
    const mockMetadata: SyncMetadata = {
      id: 'sync_metadata',
      lastSyncStartTime: '2025-10-23T10:00:00Z',
      lastSyncEndTime: '2025-10-23T10:05:00Z',
      lastSyncStatus: 'success',
      devicesProcessed: 100,
      devicesFailed: 0,
      totalDevicesFetched: 100,
      executionTimeMs: 300000,
      errors: [],
      graphApiCalls: 5,
      graphApiPages: 1,
      totalRequestTimeMs: 5000,
      cosmosDbWrites: 100,
      totalRuConsumed: 500,
      syncVersion: '1.0.0',
      updatedAt: '2025-10-23T10:05:00Z'
    };

    it('should update sync metadata successfully', async () => {
      mockContainer.items.upsert.mockResolvedValueOnce({
        resource: { ...mockMetadata, id: 'sync_metadata_defender' },
        requestCharge: 5.5
      });

      const result = await repository.updateSyncMetadata(mockMetadata);

      expect(result.id).toBe('sync_metadata_defender');
      expect(mockContainer.items.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'sync_metadata_defender',
          lastSyncStatus: 'success',
          devicesProcessed: 100
        })
      );
    });

    it('should handle errors when updating metadata', async () => {
      mockContainer.items.upsert.mockRejectedValueOnce(new Error('Update failed'));

      await expect(repository.updateSyncMetadata(mockMetadata)).rejects.toThrow(ServiceError);
    });
  });

  describe('getDeviceById', () => {
    const mockDevice: DefenderDevice = {
      id: 'device123',
      computerDnsName: 'TEST-MACHINE',
      osPlatform: 'Windows11'
    };

    it('should fetch device by ID successfully', async () => {
      const mockItem = {
        read: jest.fn().mockResolvedValueOnce({
          resource: mockDevice,
          requestCharge: 1.0
        })
      };

      mockContainer.item.mockReturnValueOnce(mockItem);

      const result = await repository.getDeviceById('device123');

      expect(result).toEqual(mockDevice);
      expect(mockContainer.item).toHaveBeenCalledWith('device123', 'device123');
    });

    it('should throw NotFoundError if device does not exist', async () => {
      const mockItem = {
        read: jest.fn().mockResolvedValueOnce({
          resource: null,
          requestCharge: 1.0
        })
      };

      mockContainer.item.mockReturnValueOnce(mockItem);

      await expect(repository.getDeviceById('device123')).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError on 404 error', async () => {
      const notFoundError = new Error('Not found') as any;
      notFoundError.code = 404;

      const mockItem = {
        read: jest.fn().mockRejectedValueOnce(notFoundError)
      };

      mockContainer.item.mockReturnValueOnce(mockItem);

      await expect(repository.getDeviceById('device123')).rejects.toThrow(NotFoundError);
    });
  });

  describe('deviceExists', () => {
    it('should return true if device exists', async () => {
      const mockDevice: DefenderDevice = {
        id: 'device123',
        computerDnsName: 'TEST-MACHINE'
      };

      const mockItem = {
        read: jest.fn().mockResolvedValueOnce({
          resource: mockDevice,
          requestCharge: 1.0
        })
      };

      mockContainer.item.mockReturnValueOnce(mockItem);

      const result = await repository.deviceExists('device123');

      expect(result).toBe(true);
    });

    it('should return false if device does not exist', async () => {
      const notFoundError = new Error('Not found') as any;
      notFoundError.code = 404;

      const mockItem = {
        read: jest.fn().mockRejectedValueOnce(notFoundError)
      };

      mockContainer.item.mockReturnValueOnce(mockItem);

      const result = await repository.deviceExists('nonexistent');

      expect(result).toBe(false);
    });
  });
});
