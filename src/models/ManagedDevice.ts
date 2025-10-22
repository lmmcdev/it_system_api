/**
 * Managed Device entity model
 * Represents a device managed through Microsoft Intune (Device Management API)
 *
 * Based on Microsoft Graph API schema:
 * https://learn.microsoft.com/en-us/graph/api/resources/intune-devices-manageddevice
 */

/**
 * Device compliance state
 */
export enum ComplianceState {
  Unknown = 'unknown',
  Compliant = 'compliant',
  Noncompliant = 'noncompliant',
  Conflict = 'conflict',
  Error = 'error',
  InGracePeriod = 'inGracePeriod',
  ConfigManager = 'configManager'
}

/**
 * Device management state
 */
export enum ManagementState {
  Managed = 'managed',
  RetirePending = 'retirePending',
  RetireFailed = 'retireFailed',
  WipePending = 'wipePending',
  WipeFailed = 'wipeFailed',
  Unhealthy = 'unhealthy',
  DeletePending = 'deletePending',
  RetireIssued = 'retireIssued',
  WipeIssued = 'wipeIssued',
  WipeCanceled = 'wipeCanceled',
  RetireCanceled = 'retireCanceled',
  Discovered = 'discovered'
}

/**
 * Device ownership type
 */
export enum DeviceOwnership {
  Unknown = 'unknown',
  Company = 'company',
  Personal = 'personal'
}

/**
 * Device enrollment type
 */
export enum DeviceEnrollmentType {
  Unknown = 'unknown',
  UserEnrollment = 'userEnrollment',
  DeviceEnrollmentManager = 'deviceEnrollmentManager',
  AppleBulkWithUser = 'appleBulkWithUser',
  AppleBulkWithoutUser = 'appleBulkWithoutUser',
  WindowsAzureADJoin = 'windowsAzureADJoin',
  WindowsBulkUserless = 'windowsBulkUserless',
  WindowsAutoEnrollment = 'windowsAutoEnrollment',
  WindowsBulkAzureDomainJoin = 'windowsBulkAzureDomainJoin',
  WindowsCoManagement = 'windowsCoManagement',
  WindowsAzureADJoinUsingDeviceAuth = 'windowsAzureADJoinUsingDeviceAuth',
  AppleUserEnrollment = 'appleUserEnrollment',
  AppleUserEnrollmentWithServiceAccount = 'appleUserEnrollmentWithServiceAccount',
  AzureAdJoinUsingAzureVmExtension = 'azureAdJoinUsingAzureVmExtension',
  AndroidEnterpriseDedicatedDevice = 'androidEnterpriseDedicatedDevice',
  AndroidEnterpriseFullyManaged = 'androidEnterpriseFullyManaged',
  AndroidEnterpriseCorporateWorkProfile = 'androidEnterpriseCorporateWorkProfile'
}

/**
 * Device registration state
 */
export enum DeviceRegistrationState {
  NotRegistered = 'notRegistered',
  Registered = 'registered',
  Revoked = 'revoked',
  KeyConflict = 'keyConflict',
  ApprovalPending = 'approvalPending',
  CertificateReset = 'certificateReset',
  NotRegisteredPendingEnrollment = 'notRegisteredPendingEnrollment',
  Unknown = 'unknown'
}

/**
 * Managed device properties
 */
export interface ManagedDevice {
  // Identity
  id: string;
  userId?: string;
  deviceName?: string;
  hardwareInformation?: HardwareInformation;

  // Ownership and Enrollment
  ownerType?: DeviceOwnership;
  managedDeviceOwnerType?: string;
  deviceEnrollmentType?: DeviceEnrollmentType;
  enrolledDateTime?: string;
  lastSyncDateTime?: string;

  // Compliance
  complianceState?: ComplianceState;
  complianceGracePeriodExpirationDateTime?: string;

  // Management
  managementState?: ManagementState;
  managementCertificateExpirationDate?: string;
  managementAgent?: string;

  // Device Information
  operatingSystem?: string;
  osVersion?: string;
  deviceType?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  imei?: string;
  meid?: string;
  phoneNumber?: string;
  wiFiMacAddress?: string;

  // Azure AD
  azureADRegistered?: boolean;
  azureADDeviceId?: string;
  deviceRegistrationState?: DeviceRegistrationState;

  // User Information
  userDisplayName?: string;
  userPrincipalName?: string;
  emailAddress?: string;

  // Status
  isEncrypted?: boolean;
  isSupervised?: boolean;
  jailBroken?: string;
  activationLockBypassCode?: string;

  // Storage
  totalStorageSpaceInBytes?: number;
  freeStorageSpaceInBytes?: number;

  // Remote actions
  remoteAssistanceSessionUrl?: string;
  remoteAssistanceSessionErrorDetails?: string;

  // Additional metadata
  deviceActionResults?: DeviceActionResult[];
  configurationManagerClientEnabledFeatures?: ConfigurationManagerClientEnabledFeatures;

  // Timestamps
  enrolledByUserPrincipalName?: string;
  easActivationDateTime?: string;
  easDeviceId?: string;

  // Compliance details
  deviceHealthAttestationState?: DeviceHealthAttestationState;

  // Lost mode (iOS)
  lostModeState?: string;

  // Partner reported threat state
  partnerReportedThreatState?: string;
}

/**
 * Hardware information
 */
export interface HardwareInformation {
  serialNumber?: string;
  totalStorageSpace?: number;
  freeStorageSpace?: number;
  imei?: string;
  meid?: string;
  manufacturer?: string;
  model?: string;
  phoneNumber?: string;
  subscriberCarrier?: string;
  cellularTechnology?: string;
  wifiMac?: string;
  operatingSystemLanguage?: string;
  isSupervised?: boolean;
  isEncrypted?: boolean;
  batterySerialNumber?: string;
  batteryHealthPercentage?: number;
  batteryChargeCycles?: number;
  isSharedDevice?: boolean;
  sharedDeviceCachedUsers?: SharedDeviceCachedUser[];
  tpmSpecificationVersion?: string;
  operatingSystemEdition?: string;
  deviceFullQualifiedDomainName?: string;
  deviceGuardVirtualizationBasedSecurityHardwareRequirementState?: string;
  deviceGuardVirtualizationBasedSecurityState?: string;
  deviceGuardLocalSystemAuthorityCredentialGuardState?: string;
  osBuildNumber?: string;
  operatingSystemProductType?: number;
  ipAddressV4?: string;
  subnetAddress?: string;
}

/**
 * Shared device cached user
 */
export interface SharedDeviceCachedUser {
  userId?: string;
  userName?: string;
}

/**
 * Device action result
 */
export interface DeviceActionResult {
  actionName?: string;
  actionState?: string;
  startDateTime?: string;
  lastUpdatedDateTime?: string;
}

/**
 * Configuration Manager client enabled features
 */
export interface ConfigurationManagerClientEnabledFeatures {
  inventory?: boolean;
  modernApps?: boolean;
  resourceAccess?: boolean;
  deviceConfiguration?: boolean;
  compliancePolicy?: boolean;
  windowsUpdateForBusiness?: boolean;
  endpointProtection?: boolean;
  officeApps?: boolean;
}

/**
 * Device health attestation state
 */
export interface DeviceHealthAttestationState {
  lastUpdateDateTime?: string;
  contentNamespaceUrl?: string;
  deviceHealthAttestationStatus?: string;
  contentVersion?: string;
  issuedDateTime?: string;
  attestationIdentityKey?: string;
  resetCount?: number;
  restartCount?: number;
  dataExcutionPolicy?: string;
  bitLockerStatus?: string;
  bootManagerVersion?: string;
  codeIntegrityCheckVersion?: string;
  secureBoot?: string;
  bootDebugging?: string;
  operatingSystemKernelDebugging?: string;
  codeIntegrity?: string;
  testSigning?: string;
  safeMode?: string;
  windowsPE?: string;
  earlyLaunchAntiMalwareDriverProtection?: string;
  virtualSecureMode?: string;
  pcrHashAlgorithm?: string;
  bootAppSecurityVersion?: string;
  bootManagerSecurityVersion?: string;
  tpmVersion?: string;
  pcr0?: string;
  secureBootConfigurationPolicyFingerPrint?: string;
  codeIntegrityPolicy?: string;
  bootRevisionListInfo?: string;
  operatingSystemRevListInfo?: string;
}

/**
 * Microsoft Graph API response for managed devices
 */
export interface ManagedDeviceListResponse {
  '@odata.context'?: string;
  '@odata.count'?: number;
  '@odata.nextLink'?: string;
  value: ManagedDevice[];
}

/**
 * Validation helper functions for runtime type checking
 */
export const ManagedDeviceValidation = {
  isValidComplianceState: (value: string): value is ComplianceState => {
    return Object.values(ComplianceState).includes(value as ComplianceState);
  },
  isValidManagementState: (value: string): value is ManagementState => {
    return Object.values(ManagementState).includes(value as ManagementState);
  },
  isValidDeviceOwnership: (value: string): value is DeviceOwnership => {
    return Object.values(DeviceOwnership).includes(value as DeviceOwnership);
  },
  isValidEnrollmentType: (value: string): value is DeviceEnrollmentType => {
    return Object.values(DeviceEnrollmentType).includes(value as DeviceEnrollmentType);
  },
  isValidRegistrationState: (value: string): value is DeviceRegistrationState => {
    return Object.values(DeviceRegistrationState).includes(value as DeviceRegistrationState);
  }
};
