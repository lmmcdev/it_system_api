/**
 * Unit tests for DefenderDeviceRepository
 * Tests Defender API calls, pagination, error handling
 */

import { DefenderDeviceRepository } from '../../src/repositories/DefenderDeviceRepository';
import { defenderAuthHelper } from '../../src/utils/defenderAuthHelper';
import { DefenderDevice, DefenderDeviceListResponse } from '../../src/models/DefenderDevice';
import { NotFoundError, ServiceError } from '../../src/utils/errorHandler';

// Mock the auth helper
jest.mock('../../src/utils/defenderAuthHelper');
const mockedAuthHelper = defenderAuthHelper as jest.Mocked<typeof defenderAuthHelper>;

// Mock fetch globally
global.fetch = jest.fn();
const mockedFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe('DefenderDeviceRepository', () => {
  let repository: DefenderDeviceRepository;

  beforeEach(() => {
    repository = new DefenderDeviceRepository();
    jest.clearAllMocks();

    // Default: auth helper returns valid token
    mockedAuthHelper.getAccessToken.mockResolvedValue('mock-access-token');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getById', () => {
    const mockDevice: DefenderDevice = {
      id: 'device123',
      computerDnsName: 'TEST-MACHINE',
      osPlatform: 'Windows11',
      healthStatus: 'Active' as any,
      riskScore: 'Low' as any
    };

    it('should fetch a device by ID successfully', async () => {
      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDevice,
        status: 200,
        statusText: 'OK'
      } as Response);

      const result = await repository.getById('device123');

      expect(result).toEqual(mockDevice);
      expect(mockedFetch).toHaveBeenCalledWith(
        'https://api.security.microsoft.com/api/machines/device123',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-access-token',
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should throw NotFoundError for 404 responses', async () => {
      mockedFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'Device not found'
      } as Response);

      await expect(repository.getById('device123')).rejects.toThrow(NotFoundError);
    });

    it('should throw ServiceError for 429 throttling', async () => {
      mockedFetch.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: async () => 'Rate limit exceeded',
        headers: new Headers({ 'Retry-After': '60' })
      } as Response);

      await expect(repository.getById('device123')).rejects.toThrow(ServiceError);
      await expect(repository.getById('device123')).rejects.toThrow(/rate limit/i);
    });

    it('should throw ServiceError for authentication failures', async () => {
      mockedFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid token'
      } as Response);

      await expect(repository.getById('device123')).rejects.toThrow(ServiceError);
      await expect(repository.getById('device123')).rejects.toThrow(/authentication failed/i);
    });

    it('should handle network errors', async () => {
      mockedFetch.mockRejectedValue(new TypeError('fetch failed'));

      await expect(repository.getById('device123')).rejects.toThrow(ServiceError);
      await expect(repository.getById('device123')).rejects.toThrow(/network error/i);
    });
  });

  describe('getAll', () => {
    const mockDevices: DefenderDevice[] = [
      { id: 'device1', computerDnsName: 'MACHINE-1', osPlatform: 'Windows11', healthStatus: 'Active' as any },
      { id: 'device2', computerDnsName: 'MACHINE-2', osPlatform: 'Windows10', healthStatus: 'Active' as any }
    ];

    const mockResponse: DefenderDeviceListResponse = {
      '@odata.context': 'https://api.security.microsoft.com/api/$metadata#Machines',
      '@odata.count': 2,
      value: mockDevices
    };

    it('should fetch all devices without filters', async () => {
      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        status: 200
      } as Response);

      const result = await repository.getAll();

      expect(result.items).toEqual(mockDevices);
      expect(result.count).toBe(2);
      expect(result.hasMore).toBe(false);
      expect(result.nextLink).toBeUndefined();
    });

    it('should apply health status filter', async () => {
      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        status: 200
      } as Response);

      await repository.getAll({ healthStatus: 'Active' });

      const callUrl = (mockedFetch.mock.calls[0][0] as string);
      expect(callUrl).toContain('$filter');
      expect(decodeURIComponent(callUrl)).toContain("healthStatus eq 'Active'");
    });

    it('should apply multiple filters with AND logic', async () => {
      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        status: 200
      } as Response);

      await repository.getAll({
        healthStatus: 'Active',
        riskScore: 'High'
      });

      const callUrl = (mockedFetch.mock.calls[0][0] as string);
      expect(decodeURIComponent(callUrl)).toContain("healthStatus eq 'Active'");
      expect(decodeURIComponent(callUrl)).toContain("riskScore eq 'High'");
      expect(decodeURIComponent(callUrl)).toContain(' and ');
    });

    it('should handle pagination with nextLink', async () => {
      const responseWithNextLink: DefenderDeviceListResponse = {
        ...mockResponse,
        '@odata.nextLink': 'https://api.security.microsoft.com/api/machines?$skip=10000'
      };

      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => responseWithNextLink,
        status: 200
      } as Response);

      const result = await repository.getAll();

      expect(result.hasMore).toBe(true);
      expect(result.nextLink).toBe('https://api.security.microsoft.com/api/machines?$skip=10000');
    });

    it('should use nextLink for subsequent pages', async () => {
      const nextLinkUrl = 'https://api.security.microsoft.com/api/machines?$skip=10000';

      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        status: 200
      } as Response);

      await repository.getAll(undefined, { nextLink: nextLinkUrl });

      expect(mockedFetch).toHaveBeenCalledWith(
        nextLinkUrl,
        expect.any(Object)
      );
    });

    it('should respect page size parameter', async () => {
      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        status: 200
      } as Response);

      await repository.getAll(undefined, { pageSize: 50 });

      const callUrl = (mockedFetch.mock.calls[0][0] as string);
      expect(callUrl).toContain('$top=50');
    });

    it('should limit page size to MAX_PAGE_SIZE', async () => {
      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        status: 200
      } as Response);

      await repository.getAll(undefined, { pageSize: 999999 });

      const callUrl = (mockedFetch.mock.calls[0][0] as string);
      expect(callUrl).toContain('$top=10000'); // MAX_PAGE_SIZE
    });
  });

  describe('getAllDevicesPaginated', () => {
    it('should fetch all devices with automatic pagination', async () => {
      const page1Devices: DefenderDevice[] = [
        { id: 'device1', computerDnsName: 'MACHINE-1', osPlatform: 'Windows11', healthStatus: 'Active' as any }
      ];
      const page2Devices: DefenderDevice[] = [
        { id: 'device2', computerDnsName: 'MACHINE-2', osPlatform: 'Windows10', healthStatus: 'Active' as any }
      ];

      const page1Response: DefenderDeviceListResponse = {
        value: page1Devices,
        '@odata.nextLink': 'https://api.security.microsoft.com/api/machines?$skip=10000'
      };

      const page2Response: DefenderDeviceListResponse = {
        value: page2Devices
      };

      mockedFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => page1Response,
          status: 200
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => page2Response,
          status: 200
        } as Response);

      const result = await repository.getAllDevicesPaginated();

      expect(result).toHaveLength(2);
      expect(result).toEqual([...page1Devices, ...page2Devices]);
      expect(mockedFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle empty results', async () => {
      const emptyResponse: DefenderDeviceListResponse = {
        value: []
      };

      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => emptyResponse,
        status: 200
      } as Response);

      const result = await repository.getAllDevicesPaginated();

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should propagate errors from paginated fetch', async () => {
      mockedFetch.mockRejectedValueOnce(new Error('Network failure'));

      await expect(repository.getAllDevicesPaginated()).rejects.toThrow(ServiceError);
    });
  });

  describe('Helper methods', () => {
    it('getByHealthStatus should call getAll with correct filter', async () => {
      const mockResponse: DefenderDeviceListResponse = { value: [] };
      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        status: 200
      } as Response);

      await repository.getByHealthStatus('Active');

      const callUrl = (mockedFetch.mock.calls[0][0] as string);
      expect(decodeURIComponent(callUrl)).toContain("healthStatus eq 'Active'");
    });

    it('getByRiskScore should call getAll with correct filter', async () => {
      const mockResponse: DefenderDeviceListResponse = { value: [] };
      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        status: 200
      } as Response);

      await repository.getByRiskScore('High');

      const callUrl = (mockedFetch.mock.calls[0][0] as string);
      expect(decodeURIComponent(callUrl)).toContain("riskScore eq 'High'");
    });

    it('getHighRiskDevices should filter for High risk score', async () => {
      const mockResponse: DefenderDeviceListResponse = { value: [] };
      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        status: 200
      } as Response);

      await repository.getHighRiskDevices();

      const callUrl = (mockedFetch.mock.calls[0][0] as string);
      expect(decodeURIComponent(callUrl)).toContain("riskScore eq 'High'");
    });
  });

  describe('exists', () => {
    it('should return true if device exists', async () => {
      const mockDevice: DefenderDevice = {
        id: 'device123',
        computerDnsName: 'TEST-MACHINE',
        osPlatform: 'Windows11'
      };

      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDevice,
        status: 200
      } as Response);

      const result = await repository.exists('device123');

      expect(result).toBe(true);
    });

    it('should return false if device does not exist', async () => {
      mockedFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'Not found'
      } as Response);

      const result = await repository.exists('nonexistent');

      expect(result).toBe(false);
    });

    it('should rethrow non-NotFoundError errors', async () => {
      mockedFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Server error'
      } as Response);

      await expect(repository.exists('device123')).rejects.toThrow(ServiceError);
    });
  });
});
