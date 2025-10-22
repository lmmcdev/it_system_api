/**
 * Device Compliance Policy service layer
 * Contains business logic for Device Compliance Policy operations
 */

import { DeviceCompliancePolicy } from '../models/DeviceCompliancePolicy';
import { deviceCompliancePolicyRepository } from '../repositories/DeviceCompliancePolicyRepository';
import { logger } from '../utils/logger';

export class DeviceCompliancePolicyService {
  /**
   * Get device compliance policy by ID
   */
  async getCompliancePolicyById(policyId: string): Promise<DeviceCompliancePolicy> {
    logger.info('Service: Fetching device compliance policy by ID', { policyId });

    const policy = await deviceCompliancePolicyRepository.getById(policyId);

    logger.info('Service: Device compliance policy fetched successfully', {
      policyId,
      displayName: policy.displayName,
      policyType: policy['@odata.type']
    });

    return policy;
  }

  /**
   * Check if device compliance policy exists
   */
  async compliancePolicyExists(policyId: string): Promise<boolean> {
    logger.info('Service: Checking if device compliance policy exists', { policyId });

    const exists = await deviceCompliancePolicyRepository.exists(policyId);

    logger.info('Service: Device compliance policy existence checked', { policyId, exists });

    return exists;
  }
}

// Export singleton instance
export const deviceCompliancePolicyService = new DeviceCompliancePolicyService();
