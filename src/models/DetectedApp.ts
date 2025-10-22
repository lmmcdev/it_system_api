/**
 * Detected App entity model
 * Represents an application detected on managed devices through Microsoft Intune
 *
 * Based on Microsoft Graph API schema:
 * https://learn.microsoft.com/en-us/graph/api/resources/intune-devices-detectedapp
 */

/**
 * Detected application properties
 */
export interface DetectedApp {
  // Identity
  id: string;
  displayName?: string;
  version?: string;

  // Size and metadata
  sizeInByte?: number;
  deviceCount?: number;
  platform?: string;

  // Publisher information
  publisher?: string;
}

/**
 * Managed device properties (subset from DetectedApp/managedDevices relationship)
 * These are devices that have the detected app installed
 */
export interface DetectedAppManagedDevice {
  // Identity
  id: string;
  deviceName?: string;
  userId?: string;

  // Device Information
  operatingSystem?: string;
  osVersion?: string;
  deviceType?: string;
  manufacturer?: string;
  model?: string;

  // Compliance
  complianceState?: string;

  // Management
  managementState?: string;
  managedDeviceOwnerType?: string;

  // User Information
  userDisplayName?: string;
  userPrincipalName?: string;
  emailAddress?: string;

  // Status
  isEncrypted?: boolean;
  isSupervised?: boolean;

  // Timestamps
  enrolledDateTime?: string;
  lastSyncDateTime?: string;

  // Azure AD
  azureADRegistered?: boolean;
  azureADDeviceId?: string;
}

/**
 * Microsoft Graph API response for detected app managed devices
 */
export interface DetectedAppManagedDeviceListResponse {
  '@odata.context'?: string;
  '@odata.count'?: number;
  '@odata.nextLink'?: string;
  value: DetectedAppManagedDevice[];
}

/**
 * Validation helper functions for runtime type checking
 */
export const DetectedAppValidation = {
  isValidAppId: (id: string): boolean => {
    // Validate GUID format
    const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return guidRegex.test(id);
  }
};
