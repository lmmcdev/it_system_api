/**
 * Tests for Device Compliance Policy Service
 */

import { deviceCompliancePolicyService } from '../../src/services/DeviceCompliancePolicyService';
import { deviceCompliancePolicyRepository } from '../../src/repositories/DeviceCompliancePolicyRepository';
import { DeviceCompliancePolicy, Windows10CompliancePolicy, CompliancePolicyType } from '../../src/models/DeviceCompliancePolicy';

// Mock repository
jest.mock('../../src/repositories/DeviceCompliancePolicyRepository', () => ({
  deviceCompliancePolicyRepository: {
    getById: jest.fn(),
    exists: jest.fn()
  }
}));

const mockGetById = deviceCompliancePolicyRepository.getById as jest.MockedFunction<typeof deviceCompliancePolicyRepository.getById>;
const mockExists = deviceCompliancePolicyRepository.exists as jest.MockedFunction<typeof deviceCompliancePolicyRepository.exists>;

// Sample data
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
  bitLockerEnabled: true,
  secureBootEnabled: true
};

const sampleBasePolicy: DeviceCompliancePolicy = {
  id: 'policy-456',
  displayName: 'Base Policy',
  description: 'Base compliance policy',
  createdDateTime: '2025-01-01T00:00:00Z',
  version: 1
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('DeviceCompliancePolicyService', () => {
  describe('getCompliancePolicyById', () => {
    it('should fetch compliance policy by ID', async () => {
      mockGetById.mockResolvedValue(sampleWindows10Policy);

      const result = await deviceCompliancePolicyService.getCompliancePolicyById('policy-123');

      expect(result).toEqual(sampleWindows10Policy);
      expect(mockGetById).toHaveBeenCalledWith('policy-123');
    });

    it('should handle different policy types', async () => {
      const iosPolicy: DeviceCompliancePolicy = {
        '@odata.type': CompliancePolicyType.iOS,
        id: 'policy-ios',
        displayName: 'iOS Security Policy',
        createdDateTime: '2025-01-01T00:00:00Z',
        version: 1
      };

      mockGetById.mockResolvedValue(iosPolicy);

      const result = await deviceCompliancePolicyService.getCompliancePolicyById('policy-ios');

      expect(result['@odata.type']).toBe(CompliancePolicyType.iOS);
      expect(result.displayName).toBe('iOS Security Policy');
    });

    it('should propagate errors from repository', async () => {
      const error = new Error('Policy not found');
      mockGetById.mockRejectedValue(error);

      await expect(deviceCompliancePolicyService.getCompliancePolicyById('nonexistent')).rejects.toThrow(error);
    });

    it('should return policy with all metadata', async () => {
      mockGetById.mockResolvedValue(sampleWindows10Policy);

      const result = await deviceCompliancePolicyService.getCompliancePolicyById('policy-123');

      expect(result.id).toBeDefined();
      expect(result.displayName).toBeDefined();
      expect(result.createdDateTime).toBeDefined();
      expect(result.lastModifiedDateTime).toBeDefined();
      expect(result.version).toBeDefined();
      expect(result['@odata.type']).toBe(CompliancePolicyType.Windows10);
    });

    it('should handle policy with null description', async () => {
      const policyWithNullDesc: DeviceCompliancePolicy = {
        ...sampleBasePolicy,
        description: null
      };

      mockGetById.mockResolvedValue(policyWithNullDesc);

      const result = await deviceCompliancePolicyService.getCompliancePolicyById('policy-123');

      expect(result.description).toBeNull();
    });
  });

  describe('compliancePolicyExists', () => {
    it('should return true if policy exists', async () => {
      mockExists.mockResolvedValue(true);

      const result = await deviceCompliancePolicyService.compliancePolicyExists('policy-123');

      expect(result).toBe(true);
      expect(mockExists).toHaveBeenCalledWith('policy-123');
    });

    it('should return false if policy does not exist', async () => {
      mockExists.mockResolvedValue(false);

      const result = await deviceCompliancePolicyService.compliancePolicyExists('nonexistent');

      expect(result).toBe(false);
      expect(mockExists).toHaveBeenCalledWith('nonexistent');
    });

    it('should propagate errors from repository', async () => {
      const error = new Error('Repository error');
      mockExists.mockRejectedValue(error);

      await expect(deviceCompliancePolicyService.compliancePolicyExists('policy-123')).rejects.toThrow(error);
    });
  });
});
