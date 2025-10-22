/**
 * Microsoft Graph API Authentication Helper
 * Handles OAuth 2.0 client credentials flow for Microsoft Graph API access
 * Implements token caching with automatic refresh to minimize authentication calls
 */

import { logger } from './logger';
import { ServiceError } from './errorHandler';

/**
 * Token response from Microsoft Identity Platform
 */
interface GraphTokenResponse {
  token_type: string;
  expires_in: number;
  access_token: string;
  ext_expires_in?: number;
}

/**
 * Cached token with expiration tracking
 */
interface CachedToken {
  accessToken: string;
  expiresAt: number; // Unix timestamp in milliseconds
}

/**
 * Microsoft Graph Authentication Helper
 * Singleton class that manages OAuth 2.0 token acquisition and caching
 */
class GraphAuthHelper {
  private cachedToken: CachedToken | null = null;
  private readonly TOKEN_BUFFER_MS = 5 * 60 * 1000; // 5 minutes before expiry
  private readonly REQUEST_TIMEOUT_MS = 30000; // 30 seconds

  /**
   * Get a valid access token for Microsoft Graph API
   * Returns cached token if still valid, otherwise requests a new token
   */
  async getAccessToken(): Promise<string> {
    try {
      // Check if we have a cached token that's still valid
      if (this.cachedToken && this.isTokenValid(this.cachedToken)) {
        logger.debug('[Graph API] Using cached access token', {
          expiresAt: new Date(this.cachedToken.expiresAt).toISOString()
        });
        return this.cachedToken.accessToken;
      }

      // Request new token if cache is empty or expired
      logger.info('[Graph API] Requesting new access token');
      const tokenResponse = await this.requestNewToken();

      // Calculate expiration time with buffer
      const expiresAt = Date.now() + (tokenResponse.expires_in * 1000) - this.TOKEN_BUFFER_MS;

      // Cache the token
      this.cachedToken = {
        accessToken: tokenResponse.access_token,
        expiresAt
      };

      logger.info('[Graph API] Access token acquired successfully', {
        expiresAt: new Date(expiresAt).toISOString(),
        expiresInMinutes: Math.floor(tokenResponse.expires_in / 60)
      });

      return this.cachedToken.accessToken;
    } catch (error) {
      logger.error('[Graph API] Failed to acquire access token', error as Error);
      throw new ServiceError('Failed to authenticate with Microsoft Graph API');
    }
  }

  /**
   * Check if cached token is still valid (with buffer)
   */
  private isTokenValid(token: CachedToken): boolean {
    const now = Date.now();
    const isValid = now < token.expiresAt;

    if (!isValid) {
      logger.debug('[Graph API] Cached token has expired', {
        expiresAt: new Date(token.expiresAt).toISOString(),
        currentTime: new Date(now).toISOString()
      });
    }

    return isValid;
  }

  /**
   * Request a new access token from Microsoft Identity Platform
   * Uses OAuth 2.0 client credentials flow
   */
  private async requestNewToken(): Promise<GraphTokenResponse> {
    const startTime = Date.now();

    // Validate required environment variables
    const clientId = process.env.GRAPH_CLIENT_ID;
    const tenantId = process.env.GRAPH_TENANT_ID;
    const clientSecret = process.env.GRAPH_CLIENT_SECRET;

    if (!clientId || !tenantId || !clientSecret) {
      logger.error('[Graph API] Missing required environment variables', undefined, {
        hasClientId: !!clientId,
        hasTenantId: !!tenantId,
        hasClientSecret: !!clientSecret
      });
      throw new ServiceError('Microsoft Graph API configuration is incomplete');
    }

    const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

    // Build request body (application/x-www-form-urlencoded)
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default'
    });

    logger.debug('[Graph API] Requesting token from Microsoft Identity Platform', {
      endpoint: tokenEndpoint,
      clientId: clientId.substring(0, 8) + '...' // Log partial ID only
    });

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Token request timeout after ${this.REQUEST_TIMEOUT_MS}ms`));
        }, this.REQUEST_TIMEOUT_MS);
      });

      // Make token request with timeout
      const fetchPromise = fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body.toString()
      });

      const response = await Promise.race([fetchPromise, timeoutPromise]);
      const executionTime = Date.now() - startTime;

      // Check for HTTP errors
      if (!response.ok) {
        const errorText = await response.text();
        logger.error('[Graph API] Token request failed', undefined, {
          status: response.status,
          statusText: response.statusText,
          executionTime: `${executionTime}ms`,
          // Don't log full error response as it may contain sensitive info
          hasErrorBody: !!errorText
        });

        if (response.status === 401 || response.status === 403) {
          throw new ServiceError('Invalid Microsoft Graph API credentials');
        }

        throw new ServiceError(`Token request failed with status ${response.status}`);
      }

      const tokenData = await response.json() as GraphTokenResponse;

      logger.info('[Graph API] Token request successful', {
        executionTime: `${executionTime}ms`,
        tokenType: tokenData.token_type,
        expiresIn: `${tokenData.expires_in}s`
      });

      return tokenData;
    } catch (error) {
      const executionTime = Date.now() - startTime;

      if (error instanceof ServiceError) {
        throw error;
      }

      logger.error('[Graph API] Token request error', error as Error, {
        executionTime: `${executionTime}ms`
      });

      throw new ServiceError('Failed to request access token from Microsoft Identity Platform');
    }
  }

  /**
   * Clear cached token (useful for testing or forcing refresh)
   */
  clearCache(): void {
    logger.debug('[Graph API] Clearing token cache');
    this.cachedToken = null;
  }

  /**
   * Check if a token is currently cached
   */
  hasCachedToken(): boolean {
    return this.cachedToken !== null && this.isTokenValid(this.cachedToken);
  }
}

// Export singleton instance
export const graphAuthHelper = new GraphAuthHelper();
