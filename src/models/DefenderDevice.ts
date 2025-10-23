/**
 * Defender Device entity model
 * Represents a device from Microsoft Defender for Endpoint API
 *
 * Based on Microsoft Defender for Endpoint API schema:
 * https://learn.microsoft.com/en-us/microsoft-365/security/defender-endpoint/get-machines
 */

/**
 * Device health status from Defender
 */
export enum DefenderHealthStatus {
  Active = 'Active',
  Inactive = 'Inactive',
  ImpairedCommunication = 'ImpairedCommunication',
  NoSensorData = 'NoSensorData',
  NoSensorDataImpairedCommunication = 'NoSensorDataImpairedCommunication',
  Unknown = 'Unknown'
}

/**
 * Device risk score from Defender
 */
export enum DefenderRiskScore {
  None = 'None',
  Informational = 'Informational',
  Low = 'Low',
  Medium = 'Medium',
  High = 'High'
}

/**
 * Device exposure level from Defender
 */
export enum DefenderExposureLevel {
  None = 'None',
  Low = 'Low',
  Medium = 'Medium',
  High = 'High'
}

/**
 * Device onboarding status
 */
export enum DefenderOnboardingStatus {
  Onboarded = 'Onboarded',
  CanBeOnboarded = 'CanBeOnboarded',
  Unsupported = 'Unsupported',
  InsufficientInfo = 'InsufficientInfo'
}

/**
 * IP address object from Defender API
 */
export interface DefenderIpAddress {
  ipAddress?: string;
  macAddress?: string;
  type?: string;
  operationalStatus?: string;
}

/**
 * Defender device properties
 * Matches Microsoft Defender for Endpoint API response
 */
export interface DefenderDevice {
  // Identity
  id: string; // Partition key
  computerDnsName?: string;

  // Operating System
  osPlatform?: string;
  osVersion?: string;
  osProcessor?: string;
  osBuild?: number;

  // Device Information
  version?: string;
  lastIpAddress?: string;
  lastExternalIpAddress?: string;

  // Health and Status
  healthStatus?: DefenderHealthStatus;
  deviceValue?: string;

  // Risk Assessment
  riskScore?: DefenderRiskScore;
  exposureLevel?: DefenderExposureLevel;

  // Timestamps
  firstSeen?: string; // ISO 8601
  lastSeen?: string; // ISO 8601

  // Azure AD Integration
  aadDeviceId?: string | null;

  // Group and Organization
  rbacGroupId?: number;
  rbacGroupName?: string;

  // Machine Tags
  machineTags?: string[];

  // Network Information
  ipAddresses?: DefenderIpAddress[];

  // Onboarding Status
  onboardingStatus?: DefenderOnboardingStatus;

  // Agent Information
  agentVersion?: string;

  // VM Metadata (for cloud VMs)
  vmMetadata?: VmMetadata;

  // Managed By
  managedBy?: string;
  managedByStatus?: string;

  // Device Category
  deviceCategory?: string;

  // Model and Vendor
  model?: string;
  vendor?: string;

  // OS Architecture
  osArchitecture?: string;

  // Deficiency Count
  deficiencyCount?: number;
}

/**
 * VM metadata for cloud-based virtual machines
 */
export interface VmMetadata {
  vmId?: string;
  cloudProvider?: string;
  resourceId?: string;
  subscriptionId?: string;
}

/**
 * Microsoft Defender API response for devices
 */
export interface DefenderDeviceListResponse {
  '@odata.context'?: string;
  '@odata.count'?: number;
  '@odata.nextLink'?: string;
  value: DefenderDevice[];
}

/**
 * Validation helper functions for runtime type checking
 */
export const DefenderDeviceValidation = {
  isValidHealthStatus: (value: string): value is DefenderHealthStatus => {
    return Object.values(DefenderHealthStatus).includes(value as DefenderHealthStatus);
  },
  isValidRiskScore: (value: string): value is DefenderRiskScore => {
    return Object.values(DefenderRiskScore).includes(value as DefenderRiskScore);
  },
  isValidExposureLevel: (value: string): value is DefenderExposureLevel => {
    return Object.values(DefenderExposureLevel).includes(value as DefenderExposureLevel);
  },
  isValidOnboardingStatus: (value: string): value is DefenderOnboardingStatus => {
    return Object.values(DefenderOnboardingStatus).includes(value as DefenderOnboardingStatus);
  }
};
