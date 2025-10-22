/**
 * Tests for Microsoft Graph API Authentication Helper
 */

import { graphAuthHelper } from '../../src/utils/graphAuthHelper';
import { ServiceError } from '../../src/utils/errorHandler';

// Mock environment variables
const originalEnv = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = {
    ...originalEnv,
    GRAPH_CLIENT_ID: 'test-client-id',
    GRAPH_TENANT_ID: 'test-tenant-id',
    GRAPH_CLIENT_SECRET: 'test-client-secret'
  };

  // Clear token cache before each test
  graphAuthHelper.clearCache();
});

afterEach(() => {
  process.env = originalEnv;
  jest.restoreAllMocks();
});

describe('GraphAuthHelper', () => {
  describe('getAccessToken', () => {
    it('should fetch and return access token successfully', async () => {
      // Mock successful token response
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({
            token_type: 'Bearer',
            expires_in: 3600,
            access_token: 'test-access-token'
          })
        })
      ) as jest.Mock;

      const token = await graphAuthHelper.getAccessToken();

      expect(token).toBe('test-access-token');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should use cached token on subsequent calls', async () => {
      // Mock successful token response
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({
            token_type: 'Bearer',
            expires_in: 3600,
            access_token: 'test-access-token'
          })
        })
      ) as jest.Mock;

      // First call - should fetch
      const token1 = await graphAuthHelper.getAccessToken();
      expect(token1).toBe('test-access-token');
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const token2 = await graphAuthHelper.getAccessToken();
      expect(token2).toBe('test-access-token');
      expect(global.fetch).toHaveBeenCalledTimes(1); // Still only 1 call
    });

    it('should throw ServiceError when credentials are missing', async () => {
      delete process.env.GRAPH_CLIENT_ID;

      await expect(graphAuthHelper.getAccessToken()).rejects.toThrow(ServiceError);
      await expect(graphAuthHelper.getAccessToken()).rejects.toThrow(
        /Graph API credentials not configured/
      );
    });

    it('should throw ServiceError on 401 authentication failure', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          text: async () => 'Invalid credentials'
        })
      ) as jest.Mock;

      await expect(graphAuthHelper.getAccessToken()).rejects.toThrow(ServiceError);
      await expect(graphAuthHelper.getAccessToken()).rejects.toThrow(
        /authentication failed/i
      );
    });

    it('should throw ServiceError on 429 rate limit', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          headers: {
            get: (name: string) => (name === 'Retry-After' ? '60' : null)
          },
          text: async () => 'Rate limit exceeded'
        })
      ) as jest.Mock;

      await expect(graphAuthHelper.getAccessToken()).rejects.toThrow(ServiceError);
      await expect(graphAuthHelper.getAccessToken()).rejects.toThrow(/rate limited/i);
    });

    it('should throw ServiceError on network error', async () => {
      global.fetch = jest.fn(() =>
        Promise.reject(new TypeError('Failed to fetch'))
      ) as jest.Mock;

      await expect(graphAuthHelper.getAccessToken()).rejects.toThrow(ServiceError);
      await expect(graphAuthHelper.getAccessToken()).rejects.toThrow(/Network error/);
    });

    it('should throw ServiceError on invalid token response', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({
            token_type: 'Bearer',
            expires_in: 3600
            // Missing access_token
          })
        })
      ) as jest.Mock;

      await expect(graphAuthHelper.getAccessToken()).rejects.toThrow(ServiceError);
      await expect(graphAuthHelper.getAccessToken()).rejects.toThrow(/Invalid token response/);
    });
  });

  describe('clearCache', () => {
    it('should clear cached token', async () => {
      // Mock successful token response
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({
            token_type: 'Bearer',
            expires_in: 3600,
            access_token: 'test-access-token'
          })
        })
      ) as jest.Mock;

      // Fetch token
      await graphAuthHelper.getAccessToken();
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Clear cache
      graphAuthHelper.clearCache();

      // Fetch again - should make new request
      await graphAuthHelper.getAccessToken();
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('hasCachedToken', () => {
    it('should return false when no token is cached', () => {
      expect(graphAuthHelper.hasCachedToken()).toBe(false);
    });

    it('should return true after token is fetched', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({
            token_type: 'Bearer',
            expires_in: 3600,
            access_token: 'test-access-token'
          })
        })
      ) as jest.Mock;

      await graphAuthHelper.getAccessToken();
      expect(graphAuthHelper.hasCachedToken()).toBe(true);
    });

    it('should return false after cache is cleared', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({
            token_type: 'Bearer',
            expires_in: 3600,
            access_token: 'test-access-token'
          })
        })
      ) as jest.Mock;

      await graphAuthHelper.getAccessToken();
      expect(graphAuthHelper.hasCachedToken()).toBe(true);

      graphAuthHelper.clearCache();
      expect(graphAuthHelper.hasCachedToken()).toBe(false);
    });
  });
});
