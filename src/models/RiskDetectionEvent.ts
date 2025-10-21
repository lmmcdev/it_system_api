/**
 * Risk Detection Event entity model
 * Represents a risk detection event from Microsoft Graph Security API stored in CosmosDB
 */

/**
 * Geographic location information
 */
export interface RiskLocation {
  city?: string;
  state?: string;
  countryOrRegion?: string;
  geoCoordinates?: {
    latitude?: number;
    longitude?: number;
  };
}

/**
 * Main Risk Detection Event entity (matches CosmosDB document structure)
 * Properties are at root level, not nested under "value"
 */
export interface RiskDetectionEvent {
  // CosmosDB document ID (partition key)
  id: string;

  // User information
  userId: string;
  userDisplayName?: string;
  userPrincipalName?: string;

  // Risk information
  riskType:
    | 'unlikelyTravel'
    | 'anonymizedIPAddress'
    | 'maliciousIPAddress'
    | 'unfamiliarFeatures'
    | 'malwareInfectedIPAddress'
    | 'suspiciousIPAddress'
    | 'leakedCredentials'
    | 'investigationsThreatIntelligence'
    | 'generic'
    | 'adminConfirmedUserCompromised'
    | 'mcasImpossibleTravel'
    | 'mcasSuspiciousInboxManipulationRules'
    | 'investigationsThreatIntelligenceSigninLinked'
    | 'maliciousIPAddressValidCredentialsBlockedIP'
    | 'unknownFutureValue';

  riskLevel: 'low' | 'medium' | 'high' | 'hidden' | 'none' | 'unknownFutureValue';
  riskState:
    | 'none'
    | 'confirmedSafe'
    | 'remediated'
    | 'dismissed'
    | 'atRisk'
    | 'confirmedCompromised'
    | 'unknownFutureValue';

  riskDetail: string;

  // Timestamps
  detectedDateTime: string; // ISO 8601
  lastUpdatedDateTime?: string; // ISO 8601

  // Activity information
  activity: 'signin' | 'user' | 'unknownFutureValue';

  // Location information
  location?: RiskLocation;
  ipAddress?: string;

  // Additional context
  source?: string;
  requestId?: string;
  correlationId?: string;

  // CosmosDB metadata
  _rid?: string;
  _self?: string;
  _etag?: string;
  _attachments?: string;
  _ts?: number;
}

/**
 * CosmosDB document type alias (same as RiskDetectionEvent)
 */
export type RiskDetectionEventDocument = RiskDetectionEvent;

/**
 * Risk type enum (Microsoft Graph Security API standard values)
 */
export enum RiskType {
  UnlikelyTravel = 'unlikelyTravel',
  AnonymizedIPAddress = 'anonymizedIPAddress',
  MaliciousIPAddress = 'maliciousIPAddress',
  UnfamiliarFeatures = 'unfamiliarFeatures',
  MalwareInfectedIPAddress = 'malwareInfectedIPAddress',
  SuspiciousIPAddress = 'suspiciousIPAddress',
  LeakedCredentials = 'leakedCredentials',
  InvestigationsThreatIntelligence = 'investigationsThreatIntelligence',
  Generic = 'generic',
  AdminConfirmedUserCompromised = 'adminConfirmedUserCompromised',
  McasImpossibleTravel = 'mcasImpossibleTravel',
  McasSuspiciousInboxManipulationRules = 'mcasSuspiciousInboxManipulationRules',
  InvestigationsThreatIntelligenceSigninLinked = 'investigationsThreatIntelligenceSigninLinked',
  MaliciousIPAddressValidCredentialsBlockedIP = 'maliciousIPAddressValidCredentialsBlockedIP',
  UnknownFutureValue = 'unknownFutureValue'
}

/**
 * Risk level enum (Microsoft Graph Security API standard values)
 */
export enum RiskLevel {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Hidden = 'hidden',
  None = 'none',
  UnknownFutureValue = 'unknownFutureValue'
}

/**
 * Risk state enum (Microsoft Graph Security API standard values)
 */
export enum RiskState {
  None = 'none',
  ConfirmedSafe = 'confirmedSafe',
  Remediated = 'remediated',
  Dismissed = 'dismissed',
  AtRisk = 'atRisk',
  ConfirmedCompromised = 'confirmedCompromised',
  UnknownFutureValue = 'unknownFutureValue'
}

/**
 * Activity type enum (Microsoft Graph Security API standard values)
 */
export enum ActivityType {
  Signin = 'signin',
  User = 'user',
  UnknownFutureValue = 'unknownFutureValue'
}

/**
 * Allowed values for runtime validation
 * Using const arrays instead of Object.values() for enum reliability
 */
const VALID_RISK_TYPES = [
  'unlikelyTravel',
  'anonymizedIPAddress',
  'maliciousIPAddress',
  'unfamiliarFeatures',
  'malwareInfectedIPAddress',
  'suspiciousIPAddress',
  'leakedCredentials',
  'investigationsThreatIntelligence',
  'generic',
  'adminConfirmedUserCompromised',
  'mcasImpossibleTravel',
  'mcasSuspiciousInboxManipulationRules',
  'investigationsThreatIntelligenceSigninLinked',
  'maliciousIPAddressValidCredentialsBlockedIP',
  'unknownFutureValue'
] as const;

const VALID_RISK_LEVELS = [
  'low',
  'medium',
  'high',
  'hidden',
  'none',
  'unknownFutureValue'
] as const;

const VALID_RISK_STATES = [
  'none',
  'confirmedSafe',
  'remediated',
  'dismissed',
  'atRisk',
  'confirmedCompromised',
  'unknownFutureValue'
] as const;

const VALID_ACTIVITY_TYPES = [
  'signin',
  'user',
  'unknownFutureValue'
] as const;

/**
 * Validation helper functions for runtime type checking
 */
export const RiskDetectionValidation = {
  isValidRiskType: (value: string): value is RiskType => {
    return VALID_RISK_TYPES.includes(value as any);
  },
  isValidRiskLevel: (value: string): value is RiskLevel => {
    return VALID_RISK_LEVELS.includes(value as any);
  },
  isValidRiskState: (value: string): value is RiskState => {
    return VALID_RISK_STATES.includes(value as any);
  },
  isValidActivityType: (value: string): value is ActivityType => {
    return VALID_ACTIVITY_TYPES.includes(value as any);
  }
};
