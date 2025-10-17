/**
 * Alert Event entity model
 * Represents a security alert event from Microsoft Graph Security API stored in CosmosDB
 */

/**
 * User account information
 */
export interface UserAccount {
  accountName: string;
  azureAdUserId: string;
  displayName: string;
  resourceAccessEvents: unknown[];
  userPrincipalName?: string;
  userSid: string;
}

/**
 * Location information
 */
export interface Location {
  city: string;
  latitude: number;
  longitude: number;
  state: string;
}

/**
 * Base evidence properties
 */
export interface BaseEvidence {
  '@odata.type': string;
  account?: Record<string, unknown>;
  createdDateTime: string;
  detailedRoles: unknown[];
  imageFile?: Record<string, unknown>;
  location?: Location;
  parentProcessImageFile?: Record<string, unknown>;
  remediationStatus: string;
  roles: unknown[];
  tags: unknown[];
  verdict: string;
}

/**
 * User evidence
 */
export interface UserEvidence extends BaseEvidence {
  userAccount: UserAccount;
}

/**
 * Cloud logon session evidence
 */
export interface CloudLogonSessionEvidence extends BaseEvidence {
  account: {
    detailedRoles: unknown[];
    remediationStatus: string;
    roles: unknown[];
    tags: unknown[];
    userAccount: UserAccount;
    verdict: string;
  };
  sessionId: string;
  startUtcDateTime: string;
  userAgent: string;
}

/**
 * IP evidence
 */
export interface IpEvidence extends BaseEvidence {
  countryLetterCode: string;
  ipAddress: string;
  location: Location;
}

/**
 * Cloud logon request evidence
 */
export interface CloudLogonRequestEvidence extends BaseEvidence {
  requestId: string;
}

/**
 * Alert evidence union type
 */
export type AlertEvidence = UserEvidence | CloudLogonSessionEvidence | IpEvidence | CloudLogonRequestEvidence;

/**
 * Main Alert Event entity (matches CosmosDB document structure)
 * Properties are at root level, not nested under "value"
 */
export interface AlertEvent {
  // CosmosDB document ID (partition key)
  id: string;

  // Microsoft Graph Alert properties
  alertId?: string;
  alertWebUrl?: string;
  assignedTo?: string;
  category?: string;
  classification?: string;
  comments?: unknown[];
  createdDateTime: string;
  description?: string;
  detectionSource?: string;
  detectorId?: string;
  evidence?: AlertEvidence[];
  firstActivityDateTime?: string;
  incidentId?: number;
  incidentWebUrl?: string;
  lastActivityDateTime?: string;
  lastUpdateDateTime?: string;
  mitreTechniques?: string[];
  productName?: string;
  providerAlertId?: string;
  recommendedActions?: string;
  resolvedDateTime?: string;
  serviceSource?: string;
  severity: string;
  status: string;
  systemTags?: unknown[];
  tenantId?: string;
  title: string;

  // CosmosDB metadata
  _rid?: string;
  _self?: string;
  _etag?: string;
  _attachments?: string;
  _ts?: number;
}

/**
 * CosmosDB document type alias (same as AlertEvent)
 */
export type AlertEventDocument = AlertEvent;

/**
 * Alert severity levels (Microsoft Graph Security API standard values)
 */
export enum AlertSeverity {
  Informational = 'informational',
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Critical = 'critical'
}

/**
 * Alert status (Microsoft Graph Security API standard values)
 */
export enum AlertStatus {
  New = 'new',
  InProgress = 'inProgress',
  Resolved = 'resolved'
}

/**
 * Alert classification (Microsoft Graph Security API standard values)
 */
export enum AlertClassification {
  Unknown = 'unknown',
  FalsePositive = 'falsePositive',
  TruePositive = 'truePositive',
  BenignPositive = 'benignPositive',
  UnknownFutureValue = 'unknownFutureValue'
}

/**
 * Alert category types (MITRE ATT&CK categories from Microsoft Graph Security API)
 */
export enum AlertCategory {
  InitialAccess = 'InitialAccess',
  Execution = 'Execution',
  Persistence = 'Persistence',
  PrivilegeEscalation = 'PrivilegeEscalation',
  DefenseEvasion = 'DefenseEvasion',
  CredentialAccess = 'CredentialAccess',
  Discovery = 'Discovery',
  LateralMovement = 'LateralMovement',
  Collection = 'Collection',
  Exfiltration = 'Exfiltration',
  CommandAndControl = 'CommandAndControl',
  Impact = 'Impact'
}

/**
 * Detection source types
 */
export enum DetectionSource {
  AzureAdIdentityProtection = 'azureAdIdentityProtection',
  MicrosoftDefenderForEndpoint = 'microsoftDefenderForEndpoint',
  MicrosoftDefenderForOffice365 = 'microsoftDefenderForOffice365',
  MicrosoftDefenderForCloudApps = 'microsoftDefenderForCloudApps',
  MicrosoftDefenderForIdentity = 'microsoftDefenderForIdentity',
  Custom = 'custom'
}

/**
 * Service source types
 */
export enum ServiceSource {
  AzureAdIdentityProtection = 'azureAdIdentityProtection',
  MicrosoftDefenderForEndpoint = 'microsoftDefenderForEndpoint',
  MicrosoftDefenderForOffice365 = 'microsoftDefenderForOffice365',
  MicrosoftDefenderForCloudApps = 'microsoftDefenderForCloudApps',
  MicrosoftDefenderForIdentity = 'microsoftDefenderForIdentity'
}

/**
 * Validation helper functions for runtime type checking
 */
export const AlertValidation = {
  isValidSeverity: (value: string): value is AlertSeverity => {
    return Object.values(AlertSeverity).includes(value as AlertSeverity);
  },
  isValidStatus: (value: string): value is AlertStatus => {
    return Object.values(AlertStatus).includes(value as AlertStatus);
  },
  isValidClassification: (value: string): value is AlertClassification => {
    return Object.values(AlertClassification).includes(value as AlertClassification);
  },
  isValidCategory: (value: string): value is AlertCategory => {
    return Object.values(AlertCategory).includes(value as AlertCategory);
  },
  isValidDetectionSource: (value: string): value is DetectionSource => {
    return Object.values(DetectionSource).includes(value as DetectionSource);
  },
  isValidServiceSource: (value: string): value is ServiceSource => {
    return Object.values(ServiceSource).includes(value as ServiceSource);
  }
};
