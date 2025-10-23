/**
 * Unit tests for DefenderDeviceSyncService
 * Tests sync orchestration, batch processing, error handling
 */

import { DefenderDeviceSyncService } from '../../src/services/DefenderDeviceSyncService';
import { defenderDeviceRepository } from '../../src/repositories/DefenderDeviceRepository';
import { defenderDeviceCosmosRepository } from '../../src/repositories/DefenderDeviceCosmosRepository';
import { DefenderDevice } from '../../src/models/DefenderDevice';
import { SyncMetadata } from '../../src/models/SyncMetadata';

// Mock repositories
jest.mock('../../src/repositories/DefenderDeviceRepository');
jest.mock('../../src/repositories/DefenderDeviceCosmosRepository');

const mockedDefenderRepository = defenderDeviceRepository as jest.Mocked<typeof defenderDeviceRepository>;
const mockedCosmosRepository = defenderDeviceCosmosRepository as jest.Mocked<typeof defenderDeviceCosmosRepository>;

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
        devicesIntune: 'devices_intune',
        devicesDefender: 'devices_defender'
      }
    },
    defenderDeviceSync: {
      batchSize: 2, // Small batch size for testing
      timerSchedule: '0 0 */6 * * *',
      containerId: 'devices_defender'
    }
  }
}));

describe('DefenderDeviceSyncService', () => {
  let service: DefenderDeviceSyncService;

  const mockMetadata: SyncMetadata = {
    id: 'sync_metadata_defender',
    lastSyncStartTime: '2025-10-23T09:00:00Z',
    lastSyncEndTime: '2025-10-23T09:05:00Z',
    lastSyncStatus: 'success',
    devicesProcessed: 50,
    devicesFailed: 0,
    totalDevicesFetched: 50,
    executionTimeMs: 300000,
    errors: [],
    graphApiCalls: 3,
    graphApiPages: 1,
    totalRequestTimeMs: 3000,
    cosmosDbWrites: 50,
    totalRuConsumed: 250,
    syncVersion: '1.0.0',
    updatedAt: '2025-10-23T09:05:00Z'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DefenderDeviceSyncService();

    // Default mocks
    mockedCosmosRepository.getSyncMetadata.mockResolvedValue(mockMetadata);
    mockedCosmosRepository.updateSyncMetadata.mockResolvedValue(mockMetadata);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('syncDevices - full sync flow', () => {
    const mockDevices: DefenderDevice[] = [
      { id: 'device1', computerDnsName: 'MACHINE-1', osPlatform: 'Windows11', healthStatus: 'Active' as any },
      { id: 'device2', computerDnsName: 'MACHINE-2', osPlatform: 'Windows10', healthStatus: 'Active' as any },
      { id: 'device3', computerDnsName: 'MACHINE-3', osPlatform: 'Windows11', healthStatus: 'Inactive' as any },
      { id: 'device4', computerDnsName: 'MACHINE-4', osPlatform: 'Windows10', healthStatus: 'Active' as any }
    ];

    it('should complete full sync successfully', async () => {
      mockedDefenderRepository.getAllDevicesPaginated.mockResolvedValueOnce(mockDevices);

      // Mock bulk upserts for 2 batches (batch size = 2)
      mockedCosmosRepository.bulkUpsertDevices
        .mockResolvedValueOnce({
          successCount: 2,
          failureCount: 0,
          totalRuConsumed: 20,
          executionTimeMs: 100,
          errors: []
        })
        .mockResolvedValueOnce({
          successCount: 2,
          failureCount: 0,
          totalRuConsumed: 20,
          executionTimeMs: 100,
          errors: []
        });

      const result = await service.syncDevices();

      expect(result.success).toBe(true);
      expect(result.status).toBe('success');
      expect(result.devicesProcessed).toBe(4);
      expect(result.devicesFailed).toBe(0);
      expect(result.totalDevicesFetched).toBe(4);
      expect(mockedDefenderRepository.getAllDevicesPaginated).toHaveBeenCalledTimes(1);
      expect(mockedCosmosRepository.bulkUpsertDevices).toHaveBeenCalledTimes(2);
      expect(mockedCosmosRepository.updateSyncMetadata).toHaveBeenCalled();
    });

    it('should handle partial success (some failures)', async () => {
      mockedDefenderRepository.getAllDevicesPaginated.mockResolvedValueOnce(mockDevices);

      // First batch succeeds, second batch has failures
      mockedCosmosRepository.bulkUpsertDevices
        .mockResolvedValueOnce({
          successCount: 2,
          failureCount: 0,
          totalRuConsumed: 20,
          executionTimeMs: 100,
          errors: []
        })
        .mockResolvedValueOnce({
          successCount: 1,
          failureCount: 1,
          totalRuConsumed: 10,
          executionTimeMs: 100,
          errors: [{
            deviceId: 'device4',
            deviceName: 'MACHINE-4',
            error: 'Upsert failed'
          }]
        });

      const result = await service.syncDevices();

      expect(result.success).toBe(true); // Still success because some devices processed
      expect(result.status).toBe('partial');
      expect(result.devicesProcessed).toBe(3);
      expect(result.devicesFailed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it('should handle complete failure', async () => {
      mockedDefenderRepository.getAllDevicesPaginated.mockResolvedValueOnce(mockDevices);

      // All batches fail
      mockedCosmosRepository.bulkUpsertDevices.mockResolvedValue({
        successCount: 0,
        failureCount: 2,
        totalRuConsumed: 0,
        executionTimeMs: 100,
        errors: [
          { deviceId: 'batch_error', error: 'Bulk operation failed' }
        ]
      });

      const result = await service.syncDevices();

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.devicesProcessed).toBe(0);
      expect(result.devicesFailed).toBe(4);
    });

    it('should handle API fetch failure', async () => {
      mockedDefenderRepository.getAllDevicesPaginated.mockRejectedValueOnce(
        new Error('Defender API connection failed')
      );

      const result = await service.syncDevices();

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.devicesProcessed).toBe(0);
      expect(result.errors[0].deviceId).toBe('defender_api_fetch');
      expect(mockedCosmosRepository.bulkUpsertDevices).not.toHaveBeenCalled();
    });

    it('should handle empty device list', async () => {
      mockedDefenderRepository.getAllDevicesPaginated.mockResolvedValueOnce([]);

      const result = await service.syncDevices();

      expect(result.success).toBe(true);
      expect(result.status).toBe('success');
      expect(result.devicesProcessed).toBe(0);
      expect(result.totalDevicesFetched).toBe(0);
      expect(mockedCosmosRepository.bulkUpsertDevices).not.toHaveBeenCalled();
    });
  });

  describe('syncDevices - progress callback', () => {
    it('should call progress callback during sync', async () => {
      const mockDevices: DefenderDevice[] = [
        { id: 'device1', computerDnsName: 'MACHINE-1', osPlatform: 'Windows11', healthStatus: 'Active' as any },
        { id: 'device2', computerDnsName: 'MACHINE-2', osPlatform: 'Windows10', healthStatus: 'Active' as any }
      ];

      mockedDefenderRepository.getAllDevicesPaginated.mockResolvedValueOnce(mockDevices);
      mockedCosmosRepository.bulkUpsertDevices.mockResolvedValueOnce({
        successCount: 2,
        failureCount: 0,
        totalRuConsumed: 20,
        executionTimeMs: 100,
        errors: []
      });

      const progressCallback = jest.fn();

      await service.syncDevices(progressCallback);

      expect(progressCallback).toHaveBeenCalled();
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: expect.any(String),
          devicesProcessed: expect.any(Number),
          totalDevices: expect.any(Number)
        })
      );
    });
  });

  describe('getSyncMetadata', () => {
    it('should retrieve sync metadata', async () => {
      const result = await service.getSyncMetadata();

      expect(result).toEqual(mockMetadata);
      expect(mockedCosmosRepository.getSyncMetadata).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling and recovery', () => {
    it('should continue processing on batch errors', async () => {
      const mockDevices: DefenderDevice[] = [
        { id: 'device1', computerDnsName: 'MACHINE-1', osPlatform: 'Windows11', healthStatus: 'Active' as any },
        { id: 'device2', computerDnsName: 'MACHINE-2', osPlatform: 'Windows10', healthStatus: 'Active' as any },
        { id: 'device3', computerDnsName: 'MACHINE-3', osPlatform: 'Windows11', healthStatus: 'Inactive' as any },
        { id: 'device4', computerDnsName: 'MACHINE-4', osPlatform: 'Windows10', healthStatus: 'Active' as any }
      ];

      mockedDefenderRepository.getAllDevicesPaginated.mockResolvedValueOnce(mockDevices);

      // First batch throws error, second succeeds
      mockedCosmosRepository.bulkUpsertDevices
        .mockRejectedValueOnce(new Error('Batch 1 failed'))
        .mockResolvedValueOnce({
          successCount: 2,
          failureCount: 0,
          totalRuConsumed: 20,
          executionTimeMs: 100,
          errors: []
        });

      const result = await service.syncDevices();

      expect(result.devicesProcessed).toBe(2); // Only second batch succeeded
      expect(result.devicesFailed).toBe(2); // First batch failed
      expect(mockedCosmosRepository.bulkUpsertDevices).toHaveBeenCalledTimes(2);
    });

    it('should update metadata on unexpected errors', async () => {
      mockedDefenderRepository.getAllDevicesPaginated.mockRejectedValueOnce(
        new Error('Unexpected error')
      );

      await service.syncDevices();

      expect(mockedCosmosRepository.updateSyncMetadata).toHaveBeenCalled();
    });
  });
});
