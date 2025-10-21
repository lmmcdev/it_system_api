/**
 * Unit tests for RiskDetectionService
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { RiskDetectionService } from '../../src/services/RiskDetectionService';
import { RiskDetectionEvent } from '../../src/models/RiskDetectionEvent';
import { PaginatedResponse } from '../../src/repositories/RiskDetectionRepository';

// Mock repository functions
const mockGetById = jest.fn();
const mockGetAll = jest.fn();
const mockGetByRiskLevel = jest.fn();
const mockGetByRiskState = jest.fn();
const mockGetByUserId = jest.fn();
const mockGetByDateRange = jest.fn();
const mockExists = jest.fn();

jest.mock('../../src/repositories/RiskDetectionRepository', () => ({
  riskDetectionRepository: {
    getById: (...args: any[]) => mockGetById(...args),
    getAll: (...args: any[]) => mockGetAll(...args),
    getByRiskLevel: (...args: any[]) => mockGetByRiskLevel(...args),
    getByRiskState: (...args: any[]) => mockGetByRiskState(...args),
    getByUserId: (...args: any[]) => mockGetByUserId(...args),
    getByDateRange: (...args: any[]) => mockGetByDateRange(...args),
    exists: (...args: any[]) => mockExists(...args)
  }
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

describe('RiskDetectionService', () => {
  let service: RiskDetectionService;

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

  const mockPaginatedResponse: PaginatedResponse<RiskDetectionEvent> = {
    items: [mockRiskDetectionEvent],
    count: 1,
    hasMore: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RiskDetectionService();
  });

  describe('getRiskDetectionEventById', () => {
    it('should fetch risk detection event by ID', async () => {
      (mockGetById as any).mockResolvedValue(mockRiskDetectionEvent);

      const result = await service.getRiskDetectionEventById(mockRiskDetectionEvent.id);

      expect(result).toEqual(mockRiskDetectionEvent);
      expect(mockGetById).toHaveBeenCalledWith(mockRiskDetectionEvent.id);
    });

    it('should propagate repository errors', async () => {
      const error = new Error('Repository error');
      (mockGetById as any).mockRejectedValue(error);

      await expect(service.getRiskDetectionEventById(mockRiskDetectionEvent.id)).rejects.toThrow(error);
    });
  });

  describe('getAllRiskDetectionEvents', () => {
    it('should fetch all risk detection events without filters', async () => {
      (mockGetAll as any).mockResolvedValue(mockPaginatedResponse);

      const result = await service.getAllRiskDetectionEvents();

      expect(result).toEqual(mockPaginatedResponse);
      expect(mockGetAll).toHaveBeenCalledWith(undefined, undefined);
    });

    it('should fetch risk detection events with filters', async () => {
      const filters = {
        riskLevel: 'high',
        riskState: 'atRisk',
        userId: 'user@example.com'
      };

      (mockGetAll as any).mockResolvedValue(mockPaginatedResponse);

      const result = await service.getAllRiskDetectionEvents(filters);

      expect(result).toEqual(mockPaginatedResponse);
      expect(mockGetAll).toHaveBeenCalledWith(filters, undefined);
    });

    it('should fetch risk detection events with pagination options', async () => {
      const options = {
        pageSize: 25,
        continuationToken: 'test-token'
      };

      (mockGetAll as any).mockResolvedValue(mockPaginatedResponse);

      const result = await service.getAllRiskDetectionEvents(undefined, options);

      expect(result).toEqual(mockPaginatedResponse);
      expect(mockGetAll).toHaveBeenCalledWith(undefined, options);
    });

    it('should fetch risk detection events with both filters and pagination', async () => {
      const filters = { riskLevel: 'high' };
      const options = { pageSize: 50 };

      (mockGetAll as any).mockResolvedValue(mockPaginatedResponse);

      const result = await service.getAllRiskDetectionEvents(filters, options);

      expect(result).toEqual(mockPaginatedResponse);
      expect(mockGetAll).toHaveBeenCalledWith(filters, options);
    });

    it('should propagate repository errors', async () => {
      const error = new Error('Query error');
      (mockGetAll as any).mockRejectedValue(error);

      await expect(service.getAllRiskDetectionEvents()).rejects.toThrow(error);
    });
  });

  describe('getRiskDetectionEventsByRiskLevel', () => {
    it('should fetch risk detection events by risk level', async () => {
      (mockGetByRiskLevel as any).mockResolvedValue(mockPaginatedResponse);

      const result = await service.getRiskDetectionEventsByRiskLevel('high');

      expect(result).toEqual(mockPaginatedResponse);
      expect(mockGetByRiskLevel).toHaveBeenCalledWith('high', undefined);
    });

    it('should fetch risk detection events by risk level with pagination', async () => {
      const options = { pageSize: 25 };
      (mockGetByRiskLevel as any).mockResolvedValue(mockPaginatedResponse);

      const result = await service.getRiskDetectionEventsByRiskLevel('high', options);

      expect(result).toEqual(mockPaginatedResponse);
      expect(mockGetByRiskLevel).toHaveBeenCalledWith('high', options);
    });

    it('should propagate repository errors', async () => {
      const error = new Error('Query error');
      (mockGetByRiskLevel as any).mockRejectedValue(error);

      await expect(service.getRiskDetectionEventsByRiskLevel('high')).rejects.toThrow(error);
    });
  });

  describe('getRiskDetectionEventsByRiskState', () => {
    it('should fetch risk detection events by risk state', async () => {
      (mockGetByRiskState as any).mockResolvedValue(mockPaginatedResponse);

      const result = await service.getRiskDetectionEventsByRiskState('atRisk');

      expect(result).toEqual(mockPaginatedResponse);
      expect(mockGetByRiskState).toHaveBeenCalledWith('atRisk', undefined);
    });

    it('should fetch risk detection events by risk state with pagination', async () => {
      const options = { pageSize: 50, continuationToken: 'token' };
      (mockGetByRiskState as any).mockResolvedValue(mockPaginatedResponse);

      const result = await service.getRiskDetectionEventsByRiskState('atRisk', options);

      expect(result).toEqual(mockPaginatedResponse);
      expect(mockGetByRiskState).toHaveBeenCalledWith('atRisk', options);
    });

    it('should propagate repository errors', async () => {
      const error = new Error('Query error');
      (mockGetByRiskState as any).mockRejectedValue(error);

      await expect(service.getRiskDetectionEventsByRiskState('atRisk')).rejects.toThrow(error);
    });
  });

  describe('getRiskDetectionEventsByUserId', () => {
    it('should fetch risk detection events by user ID', async () => {
      (mockGetByUserId as any).mockResolvedValue(mockPaginatedResponse);

      const result = await service.getRiskDetectionEventsByUserId('user@example.com');

      expect(result).toEqual(mockPaginatedResponse);
      expect(mockGetByUserId).toHaveBeenCalledWith('user@example.com', undefined);
    });

    it('should fetch risk detection events by user ID with pagination', async () => {
      const options = { pageSize: 100 };
      (mockGetByUserId as any).mockResolvedValue(mockPaginatedResponse);

      const result = await service.getRiskDetectionEventsByUserId('user@example.com', options);

      expect(result).toEqual(mockPaginatedResponse);
      expect(mockGetByUserId).toHaveBeenCalledWith('user@example.com', options);
    });

    it('should propagate repository errors', async () => {
      const error = new Error('Query error');
      (mockGetByUserId as any).mockRejectedValue(error);

      await expect(service.getRiskDetectionEventsByUserId('user@example.com')).rejects.toThrow(error);
    });
  });

  describe('getRiskDetectionEventsByDateRange', () => {
    it('should fetch risk detection events by date range', async () => {
      const startDate = '2025-10-01T00:00:00Z';
      const endDate = '2025-10-31T23:59:59Z';

      (mockGetByDateRange as any).mockResolvedValue(mockPaginatedResponse);

      const result = await service.getRiskDetectionEventsByDateRange(startDate, endDate);

      expect(result).toEqual(mockPaginatedResponse);
      expect(mockGetByDateRange).toHaveBeenCalledWith(startDate, endDate, undefined);
    });

    it('should fetch risk detection events by date range with pagination', async () => {
      const startDate = '2025-10-01T00:00:00Z';
      const endDate = '2025-10-31T23:59:59Z';
      const options = { pageSize: 75, continuationToken: 'next-page' };

      (mockGetByDateRange as any).mockResolvedValue(mockPaginatedResponse);

      const result = await service.getRiskDetectionEventsByDateRange(startDate, endDate, options);

      expect(result).toEqual(mockPaginatedResponse);
      expect(mockGetByDateRange).toHaveBeenCalledWith(startDate, endDate, options);
    });

    it('should propagate repository errors', async () => {
      const error = new Error('Query error');
      (mockGetByDateRange as any).mockRejectedValue(error);

      await expect(
        service.getRiskDetectionEventsByDateRange('2025-10-01T00:00:00Z', '2025-10-31T23:59:59Z')
      ).rejects.toThrow(error);
    });
  });

  describe('riskDetectionEventExists', () => {
    it('should return true when risk detection event exists', async () => {
      (mockExists as any).mockResolvedValue(true);

      const result = await service.riskDetectionEventExists(mockRiskDetectionEvent.id);

      expect(result).toBe(true);
      expect(mockExists).toHaveBeenCalledWith(mockRiskDetectionEvent.id);
    });

    it('should return false when risk detection event does not exist', async () => {
      (mockExists as any).mockResolvedValue(false);

      const result = await service.riskDetectionEventExists('non-existent-id');

      expect(result).toBe(false);
      expect(mockExists).toHaveBeenCalledWith('non-existent-id');
    });

    it('should propagate repository errors', async () => {
      const error = new Error('Database error');
      (mockExists as any).mockRejectedValue(error);

      await expect(service.riskDetectionEventExists(mockRiskDetectionEvent.id)).rejects.toThrow(error);
    });
  });
});
