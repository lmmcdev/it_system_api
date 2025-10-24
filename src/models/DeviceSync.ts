/**
 * Device Synchronization entity model
 * Represents cross-matched devices from Intune and Defender sources
 *
 * This model enables correlation of device data from multiple sources:
 * - Microsoft Intune (device management)
 * - Microsoft Defender for Endpoint (security data)
 *
 * Matching Strategy:
 * - Primary key: azureADDeviceId (defender.aadDeviceId === intune.azureADDeviceId)
 * - Fallback for unmatched Defender devices without aadDeviceId: use defender.id
 */

import { DefenderDevice } from './DefenderDevice';
import { ManagedDevice } from './ManagedDevice';

/**
 * Device synchronization state
 * Indicates which source(s) contain the device
 */
export enum DeviceSyncState {
  /** Device exists in both Intune and Defender */
  Matched = 'matched',

  /** Device exists only in Intune */
  OnlyIntune = 'only_intune',

  /** Device exists only in Defender */
  OnlyDefender = 'only_defender'
}

/**
 * Device synchronization document
 * Main document stored in devices_all container
 */
export interface DeviceSyncDocument {
  // Partition key - UUID for the sync document
  id: string;

  // Sync key used for matching:
  // - For 'matched' and 'only_intune': azureADDeviceId from Intune
  // - For 'only_defender': defender.aadDeviceId if present, otherwise defender.id
  syncKey: string;

  // Current sync state
  syncState: DeviceSyncState;

  // Timestamp of when this sync document was created/updated (ISO 8601)
  syncTimestamp: string;

  // Intune device data (present when syncState is 'matched' or 'only_intune')
  intune?: ManagedDevice;

  // Defender device data (present when syncState is 'matched' or 'only_defender')
  defender?: DefenderDevice;

  // CosmosDB system properties
  _rid?: string;
  _self?: string;
  _etag?: string;
  _attachments?: string;
  _ts?: number;
}

/**
 * Validation helper functions for runtime type checking
 */
export const DeviceSyncValidation = {
  /**
   * Check if a value is a valid DeviceSyncState
   */
  isValidSyncState: (value: string): value is DeviceSyncState => {
    return Object.values(DeviceSyncState).includes(value as DeviceSyncState);
  },

  /**
   * Validate that a sync document has the required data for its state
   */
  isValidSyncDocument: (doc: DeviceSyncDocument): boolean => {
    // All states require basic fields
    if (!doc.id || !doc.syncKey || !doc.syncState || !doc.syncTimestamp) {
      return false;
    }

    // State-specific validations
    switch (doc.syncState) {
      case DeviceSyncState.Matched:
        return !!(doc.intune && doc.defender);

      case DeviceSyncState.OnlyIntune:
        return !!(doc.intune && !doc.defender);

      case DeviceSyncState.OnlyDefender:
        return !!(!doc.intune && doc.defender);

      default:
        return false;
    }
  }
};

/**
 * Helper to create a sync key from a device
 * Determines the appropriate key to use for matching
 */
export function createSyncKey(
  intune?: ManagedDevice,
  defender?: DefenderDevice
): string {
  // Priority: Intune azureADDeviceId > Defender aadDeviceId > Defender id
  if (intune?.azureADDeviceId) {
    return intune.azureADDeviceId;
  }

  if (defender?.aadDeviceId) {
    return defender.aadDeviceId;
  }

  if (defender?.id) {
    return defender.id;
  }

  throw new Error('Cannot create sync key: no valid identifier found');
}

/**
 * Helper to determine sync state based on device presence
 */
export function determineSyncState(
  intune?: ManagedDevice,
  defender?: DefenderDevice
): DeviceSyncState {
  const hasIntune = !!intune;
  const hasDefender = !!defender;

  if (hasIntune && hasDefender) {
    return DeviceSyncState.Matched;
  } else if (hasIntune) {
    return DeviceSyncState.OnlyIntune;
  } else if (hasDefender) {
    return DeviceSyncState.OnlyDefender;
  }

  throw new Error('Cannot determine sync state: no devices provided');
}
