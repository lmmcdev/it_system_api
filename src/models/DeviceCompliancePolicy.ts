/**
 * Device Compliance Policy entity model
 * Represents a device compliance policy in Microsoft Intune
 *
 * Based on Microsoft Graph API schema:
 * https://learn.microsoft.com/en-us/graph/api/resources/intune-deviceconfig-devicecompliancepolicy
 */

/**
 * Device compliance policy types (discriminator for OData type)
 */
export enum CompliancePolicyType {
  Android = '#microsoft.graph.androidCompliancePolicy',
  AndroidWork = '#microsoft.graph.androidWorkProfileCompliancePolicy',
  iOS = '#microsoft.graph.iosCompliancePolicy',
  MacOS = '#microsoft.graph.macOSCompliancePolicy',
  Windows10 = '#microsoft.graph.windows10CompliancePolicy',
  Windows81 = '#microsoft.graph.windows81CompliancePolicy',
  AndroidForWork = '#microsoft.graph.androidForWorkCompliancePolicy'
}

/**
 * Base device compliance policy properties
 * All specific policy types inherit from this base interface
 */
export interface DeviceCompliancePolicy {
  // OData type discriminator
  '@odata.type'?: string;

  // Identity
  id: string;
  displayName?: string;
  description?: string | null;

  // Metadata
  createdDateTime?: string;
  lastModifiedDateTime?: string;
  version?: number;

  // Assignment
  roleScopeTagIds?: string[];

  // Scheduled actions for rule
  scheduledActionsForRule?: DeviceComplianceScheduledActionForRule[];
}

/**
 * Android compliance policy
 */
export interface AndroidCompliancePolicy extends DeviceCompliancePolicy {
  '@odata.type': '#microsoft.graph.androidCompliancePolicy';

  // Password requirements
  passwordRequired?: boolean;
  passwordMinimumLength?: number;
  passwordRequiredType?: string;
  passwordMinutesOfInactivityBeforeLock?: number;
  passwordExpirationDays?: number;
  passwordPreviousPasswordBlockCount?: number;

  // Security requirements
  securityPreventInstallAppsFromUnknownSources?: boolean;
  securityDisableUsbDebugging?: boolean;
  securityRequireVerifyApps?: boolean;
  deviceThreatProtectionEnabled?: boolean;
  deviceThreatProtectionRequiredSecurityLevel?: string;
  advancedThreatProtectionRequiredSecurityLevel?: string;

  // Device requirements
  securityBlockJailbrokenDevices?: boolean;
  osMinimumVersion?: string;
  osMaximumVersion?: string;

  // Storage requirements
  storageRequireEncryption?: boolean;
}

/**
 * iOS compliance policy
 */
export interface IosCompliancePolicy extends DeviceCompliancePolicy {
  '@odata.type': '#microsoft.graph.iosCompliancePolicy';

  // Passcode requirements
  passcodeRequired?: boolean;
  passcodeBlockSimple?: boolean;
  passcodeExpirationDays?: number;
  passcodeMinimumLength?: number;
  passcodeMinutesOfInactivityBeforeLock?: number;
  passcodeMinutesOfInactivityBeforeScreenTimeout?: number;
  passcodePreviousPasscodeBlockCount?: number;
  passcodeMinimumCharacterSetCount?: number;
  passcodeRequiredType?: string;

  // Security requirements
  securityBlockJailbrokenDevices?: boolean;
  deviceThreatProtectionEnabled?: boolean;
  deviceThreatProtectionRequiredSecurityLevel?: string;
  advancedThreatProtectionRequiredSecurityLevel?: string;

  // Device requirements
  osMinimumVersion?: string;
  osMaximumVersion?: string;
  osMinimumBuildVersion?: string;
  osMaximumBuildVersion?: string;

  // Managed email profile
  managedEmailProfileRequired?: boolean;
}

/**
 * Windows 10 compliance policy
 */
export interface Windows10CompliancePolicy extends DeviceCompliancePolicy {
  '@odata.type': '#microsoft.graph.windows10CompliancePolicy';

  // Password requirements
  passwordRequired?: boolean;
  passwordBlockSimple?: boolean;
  passwordRequiredToUnlockFromIdle?: boolean;
  passwordMinutesOfInactivityBeforeLock?: number;
  passwordExpirationDays?: number;
  passwordMinimumLength?: number;
  passwordMinimumCharacterSetCount?: number;
  passwordRequiredType?: string;
  passwordPreviousPasswordBlockCount?: number;

  // Security requirements
  requireHealthyDeviceReport?: boolean;
  bitLockerEnabled?: boolean;
  secureBootEnabled?: boolean;
  codeIntegrityEnabled?: boolean;
  storageRequireEncryption?: boolean;

  // Device requirements
  osMinimumVersion?: string;
  osMaximumVersion?: string;
  mobileOsMinimumVersion?: string;
  mobileOsMaximumVersion?: string;

  // TPM requirements
  tpmRequired?: boolean;

  // Defender
  antiSpywareRequired?: boolean;
  defenderEnabled?: boolean;
  defenderVersion?: string;
  signatureOutOfDate?: boolean;
  rtpEnabled?: boolean;
  antivirusRequired?: boolean;

  // Threat detection
  deviceThreatProtectionEnabled?: boolean;
  deviceThreatProtectionRequiredSecurityLevel?: string;
  advancedThreatProtectionRequiredSecurityLevel?: string;

  // Configuration Manager Compliance
  configurationManagerComplianceRequired?: boolean;

  // Early launch anti-malware driver
  earlyLaunchAntiMalwareDriverEnabled?: boolean;

  // Active firewall
  activeFirewallRequired?: boolean;
}

/**
 * macOS compliance policy
 */
export interface MacOSCompliancePolicy extends DeviceCompliancePolicy {
  '@odata.type': '#microsoft.graph.macOSCompliancePolicy';

  // Password requirements
  passwordRequired?: boolean;
  passwordBlockSimple?: boolean;
  passwordExpirationDays?: number;
  passwordMinimumLength?: number;
  passwordMinutesOfInactivityBeforeLock?: number;
  passwordPreviousPasswordBlockCount?: number;
  passwordMinimumCharacterSetCount?: number;
  passwordRequiredType?: string;

  // Security requirements
  systemIntegrityProtectionEnabled?: boolean;
  deviceThreatProtectionEnabled?: boolean;
  deviceThreatProtectionRequiredSecurityLevel?: string;
  advancedThreatProtectionRequiredSecurityLevel?: string;

  // Device requirements
  osMinimumVersion?: string;
  osMaximumVersion?: string;
  osMinimumBuildVersion?: string;
  osMaximumBuildVersion?: string;

  // Storage requirements
  storageRequireEncryption?: boolean;

  // Firewall requirements
  firewallEnabled?: boolean;
  firewallBlockAllIncoming?: boolean;
  firewallEnableStealthMode?: boolean;
}

/**
 * Scheduled action for compliance rule
 */
export interface DeviceComplianceScheduledActionForRule {
  id?: string;
  ruleName?: string;
  scheduledActionConfigurations?: DeviceComplianceActionItem[];
}

/**
 * Scheduled action item configuration
 */
export interface DeviceComplianceActionItem {
  id?: string;
  gracePeriodHours?: number;
  actionType?: string;
  notificationTemplateId?: string;
  notificationMessageCCList?: string[];
}

/**
 * Validation helper functions for runtime type checking
 */
export const DeviceCompliancePolicyValidation = {
  isValidPolicyId: (id: string): boolean => {
    // Validate GUID format
    const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return guidRegex.test(id);
  },

  isPolicyType: (type: string): boolean => {
    return Object.values(CompliancePolicyType).includes(type as CompliancePolicyType);
  },

  getPolicyTypeName: (odataType: string): string => {
    switch (odataType) {
      case CompliancePolicyType.Android:
        return 'Android';
      case CompliancePolicyType.AndroidWork:
        return 'Android Work Profile';
      case CompliancePolicyType.iOS:
        return 'iOS';
      case CompliancePolicyType.MacOS:
        return 'macOS';
      case CompliancePolicyType.Windows10:
        return 'Windows 10';
      case CompliancePolicyType.Windows81:
        return 'Windows 8.1';
      case CompliancePolicyType.AndroidForWork:
        return 'Android For Work';
      default:
        return 'Unknown';
    }
  }
};
