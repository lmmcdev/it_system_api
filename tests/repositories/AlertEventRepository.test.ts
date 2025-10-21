/**
 * Unit tests for AlertEventRepository
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { AlertEventRepository } from '../../src/repositories/AlertEventRepository';
import { AlertEvent } from '../../src/models/AlertEvent';
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
      alertContainerId: 'alert_events'
    }
  }
}));

describe('AlertEventRepository', () => {
  let repository: AlertEventRepository;

  // API response structure (flattened, includes metadata from CosmosDB)
  const mockAlertEvent: AlertEvent = {
    id: '4ca57b0e-1851-4966-a375-fa9c69e9d273',
    alertId: 'alert-789',
    severity: 'high',
    status: 'new',
    category: 'InitialAccess',
    title: 'Suspicious login from unusual location',
    description: 'User logged in from a location they have never accessed before',
    createdDateTime: '2025-10-15T10:00:00Z',
    lastActivityDateTime: '2025-10-15T10:30:00Z',
    firstActivityDateTime: '2025-10-15T10:00:00Z',
    lastUpdateDateTime: '2025-10-15T11:00:00Z',
    resolvedDateTime: '2025-10-16T15:30:00Z',
    classification: 'truePositive',
    detectionSource: 'microsoftDefenderForIdentity',
    serviceSource: 'microsoftDefenderForIdentity',
    tenantId: 'tenant-123',
    incidentId: 12345,
    assignedTo: 'admin@example.com',
    _rid: 'test-rid',
    _etag: '"test-etag"',
    _ts: 1729425600
  };

  // CosmosDB document structure (nested under "value")
  const mockCosmosDocument = {
    id: '4ca57b0e-1851-4966-a375-fa9c69e9d273',
    value: {
      alertId: 'alert-789',
      severity: 'high',
      status: 'new',
      category: 'InitialAccess',
      title: 'Suspicious login from unusual location',
      description: 'User logged in from a location they have never accessed before',
      createdDateTime: '2025-10-15T10:00:00Z',
      lastActivityDateTime: '2025-10-15T10:30:00Z',
      firstActivityDateTime: '2025-10-15T10:00:00Z',
      lastUpdateDateTime: '2025-10-15T11:00:00Z',
      resolvedDateTime: '2025-10-16T15:30:00Z',
      classification: 'truePositive',
      detectionSource: 'microsoftDefenderForIdentity',
      serviceSource: 'microsoftDefenderForIdentity',
      tenantId: 'tenant-123',
      incidentId: 12345,
      assignedTo: 'admin@example.com'
    },
    _rid: 'test-rid',
    _etag: '"test-etag"',
    _ts: 1729425600
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new AlertEventRepository();
  });

  describe('getById', () => {
    it('should fetch alert event by ID successfully', async () => {
      (mockRead as any).mockResolvedValue({
        resource: mockCosmosDocument,
        requestCharge: 1.0
      });

      const result = await repository.getById(mockAlertEvent.id);

      expect(result).toEqual(mockAlertEvent);
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

      await expect(repository.getById(mockAlertEvent.id)).rejects.toThrow(NotFoundError);
    });

    it('should throw ConflictError on 409 error', async () => {
      (mockRead as any).mockRejectedValue({ code: 409 });

      await expect(repository.getById(mockAlertEvent.id)).rejects.toThrow(ConflictError);
    });

    it('should throw ServiceError on 429 throttling error', async () => {
      (mockRead as any).mockRejectedValue({ code: 429, retryAfterInMilliseconds: 1000 });

      await expect(repository.getById(mockAlertEvent.id)).rejects.toThrow(ServiceError);
    });

    it('should throw ServiceError on timeout', async () => {
      (mockRead as any).mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 35000)));

      await expect(repository.getById(mockAlertEvent.id)).rejects.toThrow(ServiceError);
    }, 35000);

    it('should throw ServiceError on generic error', async () => {
      (mockRead as any).mockRejectedValue(new Error('Generic error'));

      await expect(repository.getById(mockAlertEvent.id)).rejects.toThrow(ServiceError);
    });
  });

  describe('getAll', () => {
    const mockPaginatedResponse = {
      resources: [mockCosmosDocument],
      hasMoreResults: false,
      continuationToken: undefined,
      requestCharge: 2.5
    };

    beforeEach(() => {
      (mockQuery as any).mockReturnValue({
        fetchNext: mockFetchNext
      });
    });

    it('should fetch all alert events without filters', async () => {
      (mockFetchNext as any).mockResolvedValue(mockPaginatedResponse);

      const result = await repository.getAll();

      expect(result.items).toEqual([mockAlertEvent]);
      expect(result.count).toBe(1);
      expect(result.hasMore).toBe(false);
      expect(mockQuery).toHaveBeenCalled();
    });

    it('should use nested field path in query with severity filter', async () => {
      (mockFetchNext as any).mockResolvedValue(mockPaginatedResponse);

      const result = await repository.getAll({ severity: 'high' });

      expect(result.items).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.stringContaining('c["value"]["severity"] = @severity'),
          parameters: expect.arrayContaining([{ name: '@severity', value: 'high' }])
        }),
        expect.any(Object)
      );
    });

    it('should use nested field path in query with status filter', async () => {
      (mockFetchNext as any).mockResolvedValue(mockPaginatedResponse);

      const result = await repository.getAll({ status: 'new' });

      expect(result.items).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.stringContaining('c["value"]["status"] = @status'),
          parameters: expect.arrayContaining([{ name: '@status', value: 'new' }])
        }),
        expect.any(Object)
      );
    });

    it('should use nested field path in query with category filter', async () => {
      (mockFetchNext as any).mockResolvedValue(mockPaginatedResponse);

      const result = await repository.getAll({ category: 'InitialAccess' });

      expect(result.items).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.stringContaining('c["value"]["category"] = @category'),
          parameters: expect.arrayContaining([{ name: '@category', value: 'InitialAccess' }])
        }),
        expect.any(Object)
      );
    });

    it('should use nested field path in query with date range filter', async () => {
      (mockFetchNext as any).mockResolvedValue(mockPaginatedResponse);

      const result = await repository.getAll({
        startDate: '2025-10-15',
        endDate: '2025-10-21'
      });

      expect(result.items).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.stringContaining('c["value"]["createdDateTime"] >= @startDate'),
          parameters: expect.arrayContaining([
            { name: '@startDate', value: '2025-10-15' },
            { name: '@endDate', value: '2025-10-21' }
          ])
        }),
        expect.any(Object)
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.stringContaining('c["value"]["createdDateTime"] <= @endDate')
        }),
        expect.any(Object)
      );
    });

    it('should build correct query with multiple filters using nested paths', async () => {
      (mockFetchNext as any).mockResolvedValue(mockPaginatedResponse);

      const result = await repository.getAll({
        severity: 'high',
        status: 'new',
        category: 'InitialAccess',
        startDate: '2025-10-15',
        endDate: '2025-10-21'
      });

      expect(result.items).toHaveLength(1);

      const queryCall = (mockQuery as any).mock.calls[0][0];
      expect(queryCall.query).toContain('c["value"]["severity"] = @severity');
      expect(queryCall.query).toContain('c["value"]["status"] = @status');
      expect(queryCall.query).toContain('c["value"]["category"] = @category');
      expect(queryCall.query).toContain('c["value"]["createdDateTime"] >= @startDate');
      expect(queryCall.query).toContain('c["value"]["createdDateTime"] <= @endDate');

      expect(queryCall.parameters).toHaveLength(5);
    });

    it('should handle pagination correctly', async () => {
      const continuationToken = 'next-page-token';
      (mockFetchNext as any).mockResolvedValue({
        ...mockPaginatedResponse,
        hasMoreResults: true,
        continuationToken
      });

      const result = await repository.getAll({}, { pageSize: 10 });

      expect(result.hasMore).toBe(true);
      expect(result.continuationToken).toBe(continuationToken);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          maxItemCount: 10
        })
      );
    });

    it('should enforce maximum page size of 100', async () => {
      (mockFetchNext as any).mockResolvedValue(mockPaginatedResponse);

      await repository.getAll({}, { pageSize: 500 });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          maxItemCount: 100
        })
      );
    });

    it('should throw ValidationError for invalid severity', async () => {
      await expect(
        repository.getAll({ severity: 'invalid-severity' })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid status', async () => {
      await expect(
        repository.getAll({ status: 'invalid-status' })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid category', async () => {
      await expect(
        repository.getAll({ category: 'invalid-category' })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid date format', async () => {
      await expect(
        repository.getAll({ startDate: 'not-a-date' })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ConflictError on 409 error', async () => {
      const mockFetchNextError = jest.fn();
      (mockFetchNextError as any).mockRejectedValue({ code: 409 });
      (mockQuery as any).mockReturnValue({
        fetchNext: mockFetchNextError
      });

      await expect(repository.getAll()).rejects.toThrow(ConflictError);
    });

    it('should throw ServiceError on 429 throttling error', async () => {
      const mockFetchNextError = jest.fn();
      (mockFetchNextError as any).mockRejectedValue({ code: 429, retryAfterInMilliseconds: 1000 });
      (mockQuery as any).mockReturnValue({
        fetchNext: mockFetchNextError
      });

      await expect(repository.getAll()).rejects.toThrow(ServiceError);
    });

    it('should throw ServiceError on timeout', async () => {
      const mockFetchNextError = jest.fn();
      (mockFetchNextError as any).mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 35000)));
      (mockQuery as any).mockReturnValue({
        fetchNext: mockFetchNextError
      });

      await expect(repository.getAll()).rejects.toThrow(ServiceError);
    }, 35000);

    it('should throw ServiceError on generic error', async () => {
      const mockFetchNextError = jest.fn();
      (mockFetchNextError as any).mockRejectedValue(new Error('Generic error'));
      (mockQuery as any).mockReturnValue({
        fetchNext: mockFetchNextError
      });

      await expect(repository.getAll()).rejects.toThrow(ServiceError);
    });
  });

  describe('getBySeverity', () => {
    beforeEach(() => {
      (mockQuery as any).mockReturnValue({
        fetchNext: mockFetchNext
      });
      (mockFetchNext as any).mockResolvedValue({
        resources: [mockCosmosDocument],
        hasMoreResults: false,
        requestCharge: 1.5
      });
    });

    it('should fetch alert events by severity', async () => {
      const result = await repository.getBySeverity('high');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].severity).toBe('high');
    });
  });

  describe('getByStatus', () => {
    beforeEach(() => {
      (mockQuery as any).mockReturnValue({
        fetchNext: mockFetchNext
      });
      (mockFetchNext as any).mockResolvedValue({
        resources: [mockCosmosDocument],
        hasMoreResults: false,
        requestCharge: 1.5
      });
    });

    it('should fetch alert events by status', async () => {
      const result = await repository.getByStatus('new');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].status).toBe('new');
    });
  });

  describe('getByCategory', () => {
    beforeEach(() => {
      (mockQuery as any).mockReturnValue({
        fetchNext: mockFetchNext
      });
      (mockFetchNext as any).mockResolvedValue({
        resources: [mockCosmosDocument],
        hasMoreResults: false,
        requestCharge: 1.5
      });
    });

    it('should fetch alert events by category', async () => {
      const result = await repository.getByCategory('InitialAccess');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].category).toBe('InitialAccess');
    });
  });

  describe('getByDateRange', () => {
    beforeEach(() => {
      (mockQuery as any).mockReturnValue({
        fetchNext: mockFetchNext
      });
      (mockFetchNext as any).mockResolvedValue({
        resources: [mockCosmosDocument],
        hasMoreResults: false,
        requestCharge: 1.5
      });
    });

    it('should fetch alert events by date range', async () => {
      const result = await repository.getByDateRange('2025-10-15', '2025-10-21');

      expect(result.items).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          parameters: expect.arrayContaining([
            { name: '@startDate', value: '2025-10-15' },
            { name: '@endDate', value: '2025-10-21' }
          ])
        }),
        expect.any(Object)
      );
    });
  });

  describe('exists', () => {
    it('should return true when alert event exists', async () => {
      (mockRead as any).mockResolvedValue({
        resource: mockCosmosDocument,
        requestCharge: 1.0
      });

      const result = await repository.exists(mockAlertEvent.id);

      expect(result).toBe(true);
    });

    it('should return false when alert event does not exist', async () => {
      (mockRead as any).mockResolvedValue({
        resource: null,
        requestCharge: 1.0
      });

      const result = await repository.exists('non-existent-id');

      expect(result).toBe(false);
    });

    it('should propagate errors other than NotFoundError', async () => {
      (mockRead as any).mockRejectedValue({ code: 500 });

      await expect(repository.exists(mockAlertEvent.id)).rejects.toThrow(ServiceError);
    });
  });

  describe('mapToAlertEvent', () => {
    it('should correctly map nested document to flat alert event', async () => {
      (mockRead as any).mockResolvedValue({
        resource: mockCosmosDocument,
        requestCharge: 1.0
      });

      const result = await repository.getById(mockAlertEvent.id);

      // Verify all nested fields are flattened
      expect(result.id).toBe(mockCosmosDocument.id);
      expect(result.severity).toBe(mockCosmosDocument.value.severity);
      expect(result.status).toBe(mockCosmosDocument.value.status);
      expect(result.category).toBe(mockCosmosDocument.value.category);
      expect(result.createdDateTime).toBe(mockCosmosDocument.value.createdDateTime);

      // Verify metadata is preserved
      expect(result._rid).toBe(mockCosmosDocument._rid);
      expect(result._etag).toBe(mockCosmosDocument._etag);
      expect(result._ts).toBe(mockCosmosDocument._ts);
    });

    it('should handle documents with missing value property', async () => {
      const docWithoutValue = {
        id: 'test-id',
        _rid: 'test-rid',
        _etag: '"test-etag"',
        _ts: 1729425600
      };

      (mockRead as any).mockResolvedValue({
        resource: docWithoutValue,
        requestCharge: 1.0
      });

      const result = await repository.getById('test-id');

      expect(result.id).toBe('test-id');
      expect(result._rid).toBe('test-rid');
    });

    it('should not add undefined metadata fields', async () => {
      const docWithoutMetadata = {
        id: 'test-id',
        value: {
          severity: 'high',
          status: 'new',
          title: 'Test Alert',
          createdDateTime: '2025-10-15T10:00:00Z'
        }
      };

      (mockRead as any).mockResolvedValue({
        resource: docWithoutMetadata,
        requestCharge: 1.0
      });

      const result = await repository.getById('test-id');

      expect(result.id).toBe('test-id');
      expect(result.severity).toBe('high');
      expect(result._rid).toBeUndefined();
      expect(result._etag).toBeUndefined();
      expect(result._ts).toBeUndefined();
    });
  });
});
