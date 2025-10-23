/**
 * Test suite for ManagedDeviceSyncService
 * Tests full sync flow, pagination handling, batch processing, and error recovery
 */

import { ManagedDeviceSyncService } from '../../src/services/ManagedDeviceSyncService';
import { managedDeviceRepository } from '../../src/repositories/ManagedDeviceRepository';
import { managedDeviceCosmosRepository } from '../../src/repositories/ManagedDeviceCosmosRepository';
import { ManagedDevice } from '../../src/models/ManagedDevice';
import { createInitialSyncMetadata } from '../../src/models/SyncMetadata';

// Mock repositories
jest.mock('../../src/repositories/ManagedDeviceRepository');
jest.mock('../../src/repositories/ManagedDeviceCosmosRepository');

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
      containers: {
        alertEvents: 'alert_events',
        riskDetections: 'risk_detection_events',
        alertStatistics: 'alerts_statistics',
        devicesIntune: 'devices_intune'
      }
    },
    deviceSync: {
      batchSize: 100,
      timerSchedule: '0 0 */6 * * *'
    }
  }
}));

describe('ManagedDeviceSyncService', () => {
  let service: ManagedDeviceSyncService;
  let mockGetAllDevicesPaginated: jest.Mock;
  let mockBulkUpsertDevices: jest.Mock;
  let mockGetSyncMetadata: jest.Mock;
  let mockUpdateSyncMetadata: jest.Mock;

  const createMockDevice = (id: string, deviceName: string): ManagedDevice => ({
    id,
    deviceName,
    userId: 'user-123',
    operatingSystem: 'Windows',
    osVersion: '10.0.19045',
    complianceState: 'compliant' as any,
    lastSyncDateTime: '2025-10-23T10:00:00Z',
    enrolledDateTime: '2025-01-15T08:00:00Z'
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mocks
    mockGetAllDevicesPaginated = jest.fn();
    mockBulkUpsertDevices = jest.fn();
    mockGetSyncMetadata = jest.fn();
    mockUpdateSyncMetadata = jest.fn();

    (managedDeviceRepository.getAllDevicesPaginated as jest.Mock) = mockGetAllDevicesPaginated;
    (managedDeviceCosmosRepository.bulkUpsertDevices as jest.Mock) = mockBulkUpsertDevices;
    (managedDeviceCosmosRepository.getSyncMetadata as jest.Mock) = mockGetSyncMetadata;
    (managedDeviceCosmosRepository.updateSyncMetadata as jest.Mock) = mockUpdateSyncMetadata;

    // Default mock return values
    mockGetSyncMetadata.mockResolvedValue(createInitialSyncMetadata());
    mockUpdateSyncMetadata.mockResolvedValue(createInitialSyncMetadata());

    service = new ManagedDeviceSyncService();
  });

  describe('syncDevices - successful sync', () => {
    it('should successfully sync devices with single batch', async () => {
      const mockDevices: ManagedDevice[] = [
        createMockDevice('device-1', 'DEVICE-001'),
        createMockDevice('device-2', 'DEVICE-002'),
        createMockDevice('device-3', 'DEVICE-003')
      ];

      mockGetAllDevicesPaginated.mockResolvedValue(mockDevices);
      mockBulkUpsertDevices.mockResolvedValue({
        successCount: 3,
        failureCount: 0,
        totalRuConsumed: 15.0,
        executionTimeMs: 100,
        errors: []
      });

      const result = await service.syncDevices();

      expect(result.success).toBe(true);
      expect(result.status).toBe('success');
      expect(result.devicesProcessed).toBe(3);
      expect(result.devicesFailed).toBe(0);
      expect(result.totalDevicesFetched).toBe(3);
      expect(result.errors).toHaveLength(0);
      expect(mockGetAllDevicesPaginated).toHaveBeenCalledTimes(1);
      expect(mockBulkUpsertDevices).toHaveBeenCalledTimes(1);
      expect(mockUpdateSyncMetadata).toHaveBeenCalled();
    });

    it('should handle multiple batches correctly', async () => {
      // Create 250 devices (3 batches: 100, 100, 50)
      const mockDevices: ManagedDevice[] = Array.from({ length: 250 }, (_, i) =>
        createMockDevice(`device-${i}`, `DEVICE-${String(i).padStart(3, '0')}`)
      );

      mockGetAllDevicesPaginated.mockResolvedValue(mockDevices);

      // Mock bulkUpsertDevices to return success count based on actual batch size
      mockBulkUpsertDevices.mockImplementation((devices: ManagedDevice[]) => ({
        successCount: devices.length, // Return actual batch size
        failureCount: 0,
        totalRuConsumed: devices.length * 0.5,
        executionTimeMs: 100,
        errors: []
      }));

      const result = await service.syncDevices();

      expect(result.success).toBe(true);
      expect(result.status).toBe('success');
      expect(result.devicesProcessed).toBe(250); // 3 batches: 100 + 100 + 50
      expect(result.devicesFailed).toBe(0);
      expect(mockBulkUpsertDevices).toHaveBeenCalledTimes(3); // 3 batches
    });

    it('should call progress callback with correct updates', async () => {
      const mockDevices: ManagedDevice[] = Array.from({ length: 150 }, (_, i) =>
        createMockDevice(`device-${i}`, `DEVICE-${String(i).padStart(3, '0')}`)
      );

      mockGetAllDevicesPaginated.mockResolvedValue(mockDevices);
      mockBulkUpsertDevices.mockResolvedValue({
        successCount: 100,
        failureCount: 0,
        totalRuConsumed: 50.0,
        executionTimeMs: 100,
        errors: []
      });

      const progressCallback = jest.fn();
      await service.syncDevices(progressCallback);

      // Should be called for fetch phase + 2 batches
      expect(progressCallback).toHaveBeenCalled();
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: 'Fetching devices from Graph API'
        })
      );
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: 'Upserting devices to CosmosDB',
          totalBatches: 2
        })
      );
    });
  });

  describe('syncDevices - partial success', () => {
    it('should handle partial batch failures', async () => {
      const mockDevices: ManagedDevice[] = [
        createMockDevice('device-1', 'DEVICE-001'),
        createMockDevice('device-2', 'DEVICE-002'),
        createMockDevice('device-3', 'DEVICE-003')
      ];

      mockGetAllDevicesPaginated.mockResolvedValue(mockDevices);
      mockBulkUpsertDevices.mockResolvedValue({
        successCount: 2,
        failureCount: 1,
        totalRuConsumed: 10.0,
        executionTimeMs: 100,
        errors: [{
          deviceId: 'device-3',
          deviceName: 'DEVICE-003',
          error: 'HTTP 429: Throttled'
        }]
      });

      const result = await service.syncDevices();

      expect(result.success).toBe(true);
      expect(result.status).toBe('partial');
      expect(result.devicesProcessed).toBe(2);
      expect(result.devicesFailed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].deviceId).toBe('device-3');
    });

    it('should continue processing after batch failure', async () => {
      const mockDevices: ManagedDevice[] = Array.from({ length: 200 }, (_, i) =>
        createMockDevice(`device-${i}`, `DEVICE-${String(i).padStart(3, '0')}`)
      );

      mockGetAllDevicesPaginated.mockResolvedValue(mockDevices);

      // First batch succeeds, second batch fails
      mockBulkUpsertDevices
        .mockResolvedValueOnce({
          successCount: 100,
          failureCount: 0,
          totalRuConsumed: 50.0,
          executionTimeMs: 100,
          errors: []
        })
        .mockRejectedValueOnce(new Error('Batch processing failed'));

      const result = await service.syncDevices();

      expect(result.status).toBe('partial');
      expect(result.devicesProcessed).toBe(100); // Only first batch
      expect(result.devicesFailed).toBe(100); // Second batch failed
      expect(mockBulkUpsertDevices).toHaveBeenCalledTimes(2);
    });
  });

  describe('syncDevices - complete failure', () => {
    it('should handle Graph API fetch failure', async () => {
      mockGetAllDevicesPaginated.mockRejectedValue(new Error('Graph API unavailable'));

      const result = await service.syncDevices();

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.devicesProcessed).toBe(0);
      expect(result.totalDevicesFetched).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].deviceId).toBe('graph_api_fetch');
      expect(mockBulkUpsertDevices).not.toHaveBeenCalled();
      expect(mockUpdateSyncMetadata).toHaveBeenCalled();
    });

    it('should handle all batches failing', async () => {
      const mockDevices: ManagedDevice[] = [
        createMockDevice('device-1', 'DEVICE-001'),
        createMockDevice('device-2', 'DEVICE-002')
      ];

      mockGetAllDevicesPaginated.mockResolvedValue(mockDevices);
      mockBulkUpsertDevices.mockResolvedValue({
        successCount: 0,
        failureCount: 2,
        totalRuConsumed: 0,
        executionTimeMs: 100,
        errors: [
          { deviceId: 'device-1', error: 'Failed' },
          { deviceId: 'device-2', error: 'Failed' }
        ]
      });

      const result = await service.syncDevices();

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.devicesProcessed).toBe(0);
      expect(result.devicesFailed).toBe(2);
    });
  });

  describe('syncDevices - edge cases', () => {
    it('should handle empty device list', async () => {
      mockGetAllDevicesPaginated.mockResolvedValue([]);

      const result = await service.syncDevices();

      expect(result.success).toBe(true);
      expect(result.status).toBe('success');
      expect(result.devicesProcessed).toBe(0);
      expect(result.totalDevicesFetched).toBe(0);
      expect(mockBulkUpsertDevices).not.toHaveBeenCalled();
    });

    it('should track previous sync metadata', async () => {
      const previousMetadata = {
        ...createInitialSyncMetadata(),
        lastSyncEndTime: '2025-10-23T09:00:00Z',
        devicesProcessed: 100
      };

      mockGetSyncMetadata.mockResolvedValue(previousMetadata);
      mockGetAllDevicesPaginated.mockResolvedValue([
        createMockDevice('device-1', 'DEVICE-001')
      ]);
      mockBulkUpsertDevices.mockResolvedValue({
        successCount: 1,
        failureCount: 0,
        totalRuConsumed: 5.0,
        executionTimeMs: 50,
        errors: []
      });

      const result = await service.syncDevices();

      expect(result.success).toBe(true);
      expect(mockUpdateSyncMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          previousSyncTime: '2025-10-23T09:00:00Z',
          previousDeviceCount: 100
        })
      );
    });

    it('should limit errors tracked to MAX_ERRORS_TO_TRACK', async () => {
      const mockDevices: ManagedDevice[] = Array.from({ length: 150 }, (_, i) =>
        createMockDevice(`device-${i}`, `DEVICE-${String(i).padStart(3, '0')}`)
      );

      const manyErrors = Array.from({ length: 150 }, (_, i) => ({
        deviceId: `device-${i}`,
        deviceName: `DEVICE-${String(i).padStart(3, '0')}`,
        error: 'Failed'
      }));

      mockGetAllDevicesPaginated.mockResolvedValue(mockDevices);
      mockBulkUpsertDevices.mockResolvedValue({
        successCount: 0,
        failureCount: 150,
        totalRuConsumed: 0,
        executionTimeMs: 100,
        errors: manyErrors
      });

      const result = await service.syncDevices();

      // Errors should be limited to 100 (MAX_ERRORS_TO_TRACK)
      expect(result.errors.length).toBeLessThanOrEqual(100);
    });

    it('should handle metadata update failure gracefully', async () => {
      mockGetAllDevicesPaginated.mockResolvedValue([
        createMockDevice('device-1', 'DEVICE-001')
      ]);
      mockBulkUpsertDevices.mockResolvedValue({
        successCount: 1,
        failureCount: 0,
        totalRuConsumed: 5.0,
        executionTimeMs: 50,
        errors: []
      });
      mockUpdateSyncMetadata.mockRejectedValue(new Error('Metadata update failed'));

      // Should not throw even if metadata update fails
      const result = await service.syncDevices();

      expect(result.success).toBe(true);
      expect(result.devicesProcessed).toBe(1);
    });
  });

  describe('getSyncMetadata', () => {
    it('should retrieve current sync metadata', async () => {
      const mockMetadata = {
        ...createInitialSyncMetadata(),
        lastSyncStatus: 'success' as const,
        devicesProcessed: 200
      };

      mockGetSyncMetadata.mockResolvedValue(mockMetadata);

      const result = await service.getSyncMetadata();

      expect(result).toEqual(mockMetadata);
      expect(mockGetSyncMetadata).toHaveBeenCalledTimes(1);
    });
  });
});
