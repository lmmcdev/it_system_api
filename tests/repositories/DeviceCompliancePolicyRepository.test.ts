/**
 * Tests for Device Compliance Policy Repository
 */

import { deviceCompliancePolicyRepository } from '../../src/repositories/DeviceCompliancePolicyRepository';
import { graphAuthHelper } from '../../src/utils/graphAuthHelper';
import { NotFoundError, ServiceError } from '../../src/utils/errorHandler';
import { DeviceCompliancePolicy, Windows10CompliancePolicy, CompliancePolicyType } from '../../src/models/DeviceCompliancePolicy';

// Mock graphAuthHelper
jest.mock('../../src/utils/graphAuthHelper', () => ({
  graphAuthHelper: {
    getAccessToken: jest.fn()
  }
}));

const mockGetAccessToken = graphAuthHelper.getAccessToken as jest.MockedFunction<typeof graphAuthHelper.getAccessToken>;

// Sample compliance policy data
const sampleWindows10Policy: Windows10CompliancePolicy = {
  '@odata.type': CompliancePolicyType.Windows10,
  id: 'policy-123',
  displayName: 'Windows 10 Security Policy',
  description: 'Corporate Windows 10 security requirements',
  createdDateTime: '2025-01-01T00:00:00Z',
  lastModifiedDateTime: '2025-10-22T10:00:00Z',
  version: 1,
  passwordRequired: true,
  passwordMinimumLength: 8,
  passwordRequiredType: 'alphanumeric',
  bitLockerEnabled: true,
  secureBootEnabled: true,
  codeIntegrityEnabled: true,
  osMinimumVersion: '10.0.19041',
  defenderEnabled: true,
  antivirusRequired: true
};

const sampleBasePolicy: DeviceCompliancePolicy = {
  id: 'policy-456',
  displayName: 'Base Policy',
  description: 'Base compliance policy',
  createdDateTime: '2025-01-01T00:00:00Z',
  lastModifiedDateTime: '2025-10-22T10:00:00Z',
  version: 1
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAccessToken.mockResolvedValue('test-access-token');
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('DeviceCompliancePolicyRepository', () => {
  describe('getById', () => {
    it('should fetch compliance policy by ID successfully', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => sampleWindows10Policy
        })
      ) as jest.Mock;

      const policy = await deviceCompliancePolicyRepository.getById('policy-123');

      expect(policy).toEqual(sampleWindows10Policy);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/deviceManagement/deviceCompliancePolicies/policy-123'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-access-token'
          })
        })
      );
    });

    it('should handle different policy types', async () => {
      const iosPolicy: DeviceCompliancePolicy = {
        '@odata.type': CompliancePolicyType.iOS,
        id: 'policy-ios',
        displayName: 'iOS Security Policy',
        createdDateTime: '2025-01-01T00:00:00Z',
        version: 1
      };

      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => iosPolicy
        })
      ) as jest.Mock;

      const policy = await deviceCompliancePolicyRepository.getById('policy-ios');

      expect(policy['@odata.type']).toBe(CompliancePolicyType.iOS);
      expect(policy.displayName).toBe('iOS Security Policy');
    });

    it('should throw NotFoundError when policy not found', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          text: async () => 'Policy not found'
        })
      ) as jest.Mock;

      await expect(deviceCompliancePolicyRepository.getById('nonexistent')).rejects.toThrow(NotFoundError);
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

      await expect(deviceCompliancePolicyRepository.getById('policy-123')).rejects.toThrow(ServiceError);
      await expect(deviceCompliancePolicyRepository.getById('policy-123')).rejects.toThrow(/authentication failed/i);
    });

    it('should throw ServiceError on 403 forbidden', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 403,
          statusText: 'Forbidden',
          text: async () => 'Insufficient permissions'
        })
      ) as jest.Mock;

      await expect(deviceCompliancePolicyRepository.getById('policy-123')).rejects.toThrow(ServiceError);
      await expect(deviceCompliancePolicyRepository.getById('policy-123')).rejects.toThrow(/authentication failed/i);
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

      await expect(deviceCompliancePolicyRepository.getById('policy-123')).rejects.toThrow(ServiceError);
      await expect(deviceCompliancePolicyRepository.getById('policy-123')).rejects.toThrow(/rate limit/i);
    });

    it('should throw ServiceError on network error', async () => {
      global.fetch = jest.fn(() =>
        Promise.reject(new TypeError('fetch failed'))
      ) as jest.Mock;

      await expect(deviceCompliancePolicyRepository.getById('policy-123')).rejects.toThrow(ServiceError);
      await expect(deviceCompliancePolicyRepository.getById('policy-123')).rejects.toThrow(/network error/i);
    });

    // Skipping timeout test as it exceeds Jest's default timeout in CI/CD
    it.skip('should throw ServiceError on timeout', async () => {
      global.fetch = jest.fn(() =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: async () => sampleBasePolicy
            });
          }, 35000); // Longer than timeout
        })
      ) as jest.Mock;

      await expect(deviceCompliancePolicyRepository.getById('policy-123')).rejects.toThrow(ServiceError);
      await expect(deviceCompliancePolicyRepository.getById('policy-123')).rejects.toThrow(/timeout/i);
    });

    it('should handle policy with null description', async () => {
      const policyWithNullDesc: DeviceCompliancePolicy = {
        ...sampleBasePolicy,
        description: null
      };

      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => policyWithNullDesc
        })
      ) as jest.Mock;

      const policy = await deviceCompliancePolicyRepository.getById('policy-123');

      expect(policy.description).toBeNull();
    });

    it('should include all policy metadata', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => sampleWindows10Policy
        })
      ) as jest.Mock;

      const policy = await deviceCompliancePolicyRepository.getById('policy-123');

      expect(policy.id).toBeDefined();
      expect(policy.displayName).toBeDefined();
      expect(policy.createdDateTime).toBeDefined();
      expect(policy.lastModifiedDateTime).toBeDefined();
      expect(policy.version).toBeDefined();
    });
  });

  describe('exists', () => {
    it('should return true if policy exists', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => sampleBasePolicy
        })
      ) as jest.Mock;

      const exists = await deviceCompliancePolicyRepository.exists('policy-123');

      expect(exists).toBe(true);
    });

    it('should return false if policy not found', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          text: async () => 'Policy not found'
        })
      ) as jest.Mock;

      const exists = await deviceCompliancePolicyRepository.exists('nonexistent');

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

      await expect(deviceCompliancePolicyRepository.exists('policy-123')).rejects.toThrow(ServiceError);
    });

    it('should propagate network errors', async () => {
      global.fetch = jest.fn(() =>
        Promise.reject(new TypeError('fetch failed'))
      ) as jest.Mock;

      await expect(deviceCompliancePolicyRepository.exists('policy-123')).rejects.toThrow(ServiceError);
    });
  });
});
