/**
 * Unit tests for RiskDetectionRepository
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { RiskDetectionRepository } from '../../src/repositories/RiskDetectionRepository';
import { RiskDetectionEvent } from '../../src/models/RiskDetectionEvent';
import { NotFoundError, ServiceError, ValidationError, ConflictError } from '../../src/utils/errorHandler';

// Mock CosmosDB client
const mockRead = jest.fn();
const mockFetchNext = jest.fn();
const mockQuery = jest.fn();

jest.mock('@azure/cosmos', () => ({
  CosmosClient: jest.fn().mockImplementation(() => ({
    database: jest.fn().mockReturnValue({
      container: jest.fn().mockReturnValue({
        item: jest.fn().mockReturnValue({
          read: (...args: any[]) => mockRead(...args)
        }),
        items: {
          query: (...args: any[]) => mockQuery(...args)
        }
      })
    })
  }))
}));

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock config
jest.mock('../../src/config/environment', () => ({
  config: {
    cosmos: {
      endpoint: 'https://test.documents.azure.com:443/',
      key: 'test-key',
      databaseId: 'test-db',
      riskDetectionContainerId: 'risk_detection_events'
    }
  }
}));

describe('RiskDetectionRepository', () => {
  let repository: RiskDetectionRepository;

  const mockRiskDetectionEvent: RiskDetectionEvent = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    userId: 'user@example.com',
    userDisplayName: 'Test User',
    userPrincipalName: 'user@example.com',
    riskType: 'unlikelyTravel',
    riskLevel: 'high',
    riskState: 'atRisk',
    riskDetail: 'User login from unusual location',
    detectedDateTime: '2025-10-20T10:00:00Z',
    lastUpdatedDateTime: '2025-10-20T12:00:00Z',
    activity: 'signin',
    location: {
      city: 'New York',
      state: 'NY',
      countryOrRegion: 'US',
      geoCoordinates: {
        latitude: 40.7128,
        longitude: -74.0060
      }
    },
    ipAddress: '192.168.1.1',
    source: 'AzureADIdentityProtection',
    requestId: 'req-123',
    correlationId: 'corr-456'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new RiskDetectionRepository();
  });

  describe('getById', () => {
    it('should fetch risk detection event by ID successfully', async () => {
      (mockRead as any).mockResolvedValue({
        resource: mockRiskDetectionEvent,
        requestCharge: 1.0
      });

      const result = await repository.getById(mockRiskDetectionEvent.id);

      expect(result).toEqual(mockRiskDetectionEvent);
      expect(mockRead).toHaveBeenCalled();
    });

    it('should throw NotFoundError when resource not found', async () => {
      (mockRead as any).mockResolvedValue({
        resource: null,
        requestCharge: 1.0
      });

      await expect(repository.getById('non-existent-id')).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError on 404 error', async () => {
      (mockRead as any).mockRejectedValue({ code: 404 });

      await expect(repository.getById(mockRiskDetectionEvent.id)).rejects.toThrow(NotFoundError);
    });

    it('should throw ConflictError on 409 error', async () => {
      (mockRead as any).mockRejectedValue({ code: 409 });

      await expect(repository.getById(mockRiskDetectionEvent.id)).rejects.toThrow(ConflictError);
    });

    it('should throw ServiceError on 429 throttling error', async () => {
      (mockRead as any).mockRejectedValue({ code: 429, retryAfterInMilliseconds: 1000 });

      await expect(repository.getById(mockRiskDetectionEvent.id)).rejects.toThrow(ServiceError);
    });

    it('should throw ServiceError on timeout', async () => {
      (mockRead as any).mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 35000)));

      await expect(repository.getById(mockRiskDetectionEvent.id)).rejects.toThrow(ServiceError);
    }, 35000);

    it('should throw ServiceError on generic error', async () => {
      (mockRead as any).mockRejectedValue(new Error('Generic error'));

      await expect(repository.getById(mockRiskDetectionEvent.id)).rejects.toThrow(ServiceError);
    });
  });

  describe('getAll', () => {
    const mockPaginatedResponse = {
      resources: [mockRiskDetectionEvent],
      hasMoreResults: false,
      continuationToken: undefined,
      requestCharge: 2.5
    };

    beforeEach(() => {
      (mockQuery as any).mockReturnValue({
        fetchNext: mockFetchNext
      });
    });

    it('should fetch all risk detection events without filters', async () => {
      (mockFetchNext as any).mockResolvedValue(mockPaginatedResponse);

      const result = await repository.getAll();

      expect(result.items).toEqual([mockRiskDetectionEvent]);
      expect(result.count).toBe(1);
      expect(result.hasMore).toBe(false);
      expect(mockQuery).toHaveBeenCalled();
    });

    it('should fetch risk detection events with riskLevel filter', async () => {
      (mockFetchNext as any).mockResolvedValue(mockPaginatedResponse);

      const result = await repository.getAll({ riskLevel: 'high' });

      expect(result.items).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.stringContaining('c.riskLevel = @riskLevel'),
          parameters: expect.arrayContaining([{ name: '@riskLevel', value: 'high' }])
        }),
        expect.any(Object)
      );
    });

    it('should fetch risk detection events with riskState filter', async () => {
      (mockFetchNext as any).mockResolvedValue(mockPaginatedResponse);

      const result = await repository.getAll({ riskState: 'atRisk' });

      expect(result.items).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          parameters: expect.arrayContaining([{ name: '@riskState', value: 'atRisk' }])
        }),
        expect.any(Object)
      );
    });

    it('should fetch risk detection events with userId filter', async () => {
      (mockFetchNext as any).mockResolvedValue(mockPaginatedResponse);

      const result = await repository.getAll({ userId: 'user@example.com' });

      expect(result.items).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          parameters: expect.arrayContaining([{ name: '@userId', value: 'user@example.com' }])
        }),
        expect.any(Object)
      );
    });

    it('should fetch risk detection events with date range filter', async () => {
      (mockFetchNext as any).mockResolvedValue(mockPaginatedResponse);

      const result = await repository.getAll({
        startDate: '2025-10-01T00:00:00Z',
        endDate: '2025-10-31T23:59:59Z'
      });

      expect(result.items).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          parameters: expect.arrayContaining([
            { name: '@startDate', value: '2025-10-01T00:00:00Z' },
            { name: '@endDate', value: '2025-10-31T23:59:59Z' }
          ])
        }),
        expect.any(Object)
      );
    });

    it('should apply pagination correctly', async () => {
      (mockFetchNext as any).mockResolvedValue({
        ...mockPaginatedResponse,
        hasMoreResults: true,
        continuationToken: 'next-token'
      });

      const result = await repository.getAll({}, { pageSize: 25, continuationToken: 'token' });

      expect(result.hasMore).toBe(true);
      expect(result.continuationToken).toBe('next-token');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          maxItemCount: 25,
          continuationToken: 'token'
        })
      );
    });

    it('should enforce maximum page size of 100', async () => {
      (mockFetchNext as any).mockResolvedValue(mockPaginatedResponse);

      await repository.getAll({}, { pageSize: 150 });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          maxItemCount: 100
        })
      );
    });

    it('should throw ValidationError for invalid riskLevel', async () => {
      await expect(repository.getAll({ riskLevel: 'invalid' })).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid riskState', async () => {
      await expect(repository.getAll({ riskState: 'invalid' })).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid startDate', async () => {
      await expect(repository.getAll({ startDate: 'not-a-date' })).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid endDate', async () => {
      await expect(repository.getAll({ endDate: '2025/10/31' })).rejects.toThrow(ValidationError);
    });

    it('should throw ConflictError on 409 error', async () => {
      (mockFetchNext as any).mockRejectedValue({ code: 409 });

      await expect(repository.getAll()).rejects.toThrow(ConflictError);
    });

    it('should throw ServiceError on 429 throttling error', async () => {
      (mockFetchNext as any).mockRejectedValue({ code: 429, retryAfterInMilliseconds: 1000 });

      await expect(repository.getAll()).rejects.toThrow(ServiceError);
    });

    it('should throw ServiceError on generic error', async () => {
      (mockFetchNext as any).mockRejectedValue(new Error('Query failed'));

      await expect(repository.getAll()).rejects.toThrow(ServiceError);
    });
  });

  describe('getByRiskLevel', () => {
    it('should call getAll with riskLevel filter', async () => {
      (mockQuery as any).mockReturnValue({ fetchNext: mockFetchNext });
      (mockFetchNext as any).mockResolvedValue({
        resources: [mockRiskDetectionEvent],
        hasMoreResults: false,
        requestCharge: 2.0
      });

      const result = await repository.getByRiskLevel('high');

      expect(result.items).toEqual([mockRiskDetectionEvent]);
    });
  });

  describe('getByRiskState', () => {
    it('should call getAll with riskState filter', async () => {
      (mockQuery as any).mockReturnValue({ fetchNext: mockFetchNext });
      (mockFetchNext as any).mockResolvedValue({
        resources: [mockRiskDetectionEvent],
        hasMoreResults: false,
        requestCharge: 2.0
      });

      const result = await repository.getByRiskState('atRisk');

      expect(result.items).toEqual([mockRiskDetectionEvent]);
    });
  });

  describe('getByUserId', () => {
    it('should call getAll with userId filter', async () => {
      (mockQuery as any).mockReturnValue({ fetchNext: mockFetchNext });
      (mockFetchNext as any).mockResolvedValue({
        resources: [mockRiskDetectionEvent],
        hasMoreResults: false,
        requestCharge: 2.0
      });

      const result = await repository.getByUserId('user@example.com');

      expect(result.items).toEqual([mockRiskDetectionEvent]);
    });
  });

  describe('getByDateRange', () => {
    it('should call getAll with date range filter', async () => {
      (mockQuery as any).mockReturnValue({ fetchNext: mockFetchNext });
      (mockFetchNext as any).mockResolvedValue({
        resources: [mockRiskDetectionEvent],
        hasMoreResults: false,
        requestCharge: 2.0
      });

      const result = await repository.getByDateRange(
        '2025-10-01T00:00:00Z',
        '2025-10-31T23:59:59Z'
      );

      expect(result.items).toEqual([mockRiskDetectionEvent]);
    });
  });

  describe('exists', () => {
    it('should return true when risk detection event exists', async () => {
      (mockRead as any).mockResolvedValue({
        resource: mockRiskDetectionEvent,
        requestCharge: 1.0
      });

      const result = await repository.exists(mockRiskDetectionEvent.id);

      expect(result).toBe(true);
    });

    it('should return false when risk detection event does not exist', async () => {
      (mockRead as any).mockRejectedValue({ code: 404 });

      const result = await repository.exists('non-existent-id');

      expect(result).toBe(false);
    });

    it('should throw error for non-NotFoundError exceptions', async () => {
      (mockRead as any).mockRejectedValue(new Error('Database error'));

      await expect(repository.exists(mockRiskDetectionEvent.id)).rejects.toThrow(ServiceError);
    });
  });
});
