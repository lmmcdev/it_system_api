/**
 * Unit tests for rate limiting middleware
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { HttpRequest } from '@azure/functions';
import {
  checkRateLimit,
  clearRateLimitStore,
  getRateLimitStats,
  RATE_LIMITS
} from '../../src/middleware/rateLimit';

// Mock HttpRequest helper
function createMockRequest(headers: Record<string, string> = {}): HttpRequest {
  return {
    method: 'GET',
    url: 'http://localhost:7071/api/test',
    headers: {
      get: (key: string) => headers[key.toLowerCase()] || null
    },
    query: {
      get: () => null
    },
    params: {},
    user: null,
    body: null,
    bodyUsed: false
  } as unknown as HttpRequest;
}

describe('Rate Limiting Middleware', () => {
  beforeEach(() => {
    // Clear rate limit store before each test
    clearRateLimitStore();
  });

  describe('checkRateLimit', () => {
    it('should allow requests within rate limit', () => {
      const request = createMockRequest({ 'x-forwarded-for': '192.168.1.1' });
      const config = { windowMs: 60000, maxRequests: 10 };

      const result = checkRateLimit(request, 'test', config);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    it('should block requests exceeding rate limit', () => {
      const request = createMockRequest({ 'x-forwarded-for': '192.168.1.1' });
      const config = { windowMs: 60000, maxRequests: 3 };

      // Make 3 requests (should all succeed)
      for (let i = 0; i < 3; i++) {
        const result = checkRateLimit(request, 'test', config);
        expect(result.allowed).toBe(true);
      }

      // 4th request should be blocked
      const blockedResult = checkRateLimit(request, 'test', config);
      expect(blockedResult.allowed).toBe(false);
      expect(blockedResult.remaining).toBe(0);
      expect(blockedResult.retryAfter).toBeDefined();
    });

    it('should track different clients separately', () => {
      const client1 = createMockRequest({ 'x-forwarded-for': '192.168.1.1' });
      const client2 = createMockRequest({ 'x-forwarded-for': '192.168.1.2' });
      const config = { windowMs: 60000, maxRequests: 5 };

      // Client 1 makes requests
      for (let i = 0; i < 3; i++) {
        checkRateLimit(client1, 'test', config);
      }

      // Client 2 should have independent limit
      const result = checkRateLimit(client2, 'test', config);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it('should use x-client-id header if available', () => {
      const request = createMockRequest({ 'x-client-id': 'client-abc-123' });
      const config = { windowMs: 60000, maxRequests: 5 };

      const result = checkRateLimit(request, 'test', config);
      expect(result.allowed).toBe(true);
    });

    it('should track different endpoints separately', () => {
      const request = createMockRequest({ 'x-forwarded-for': '192.168.1.1' });
      const config = { windowMs: 60000, maxRequests: 3 };

      // Make requests to endpoint1
      for (let i = 0; i < 3; i++) {
        checkRateLimit(request, 'endpoint1', config);
      }

      // endpoint2 should have independent limit
      const result = checkRateLimit(request, 'endpoint2', config);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });

    it('should reset limit after time window', (done) => {
      const request = createMockRequest({ 'x-forwarded-for': '192.168.1.1' });
      const config = { windowMs: 100, maxRequests: 2 }; // 100ms window for testing

      // Exhaust the limit
      checkRateLimit(request, 'test', config);
      checkRateLimit(request, 'test', config);

      const blocked = checkRateLimit(request, 'test', config);
      expect(blocked.allowed).toBe(false);

      // Wait for window to expire
      setTimeout(() => {
        const result = checkRateLimit(request, 'test', config);
        expect(result.allowed).toBe(true);
        done();
      }, 150);
    }, 10000);

    it('should handle unknown client gracefully', () => {
      const request = createMockRequest(); // No IP headers
      const config = { windowMs: 60000, maxRequests: 10 };

      const result = checkRateLimit(request, 'test', config);
      expect(result.allowed).toBe(true);
    });
  });

  describe('Rate limit configurations', () => {
    it('should have correct limits for search endpoint', () => {
      expect(RATE_LIMITS.search.windowMs).toBe(60000);
      expect(RATE_LIMITS.search.maxRequests).toBe(100);
    });

    it('should have correct limits for suggestions endpoint', () => {
      expect(RATE_LIMITS.suggestions.windowMs).toBe(60000);
      expect(RATE_LIMITS.suggestions.maxRequests).toBe(200);
    });

    it('should have correct limits for getById endpoint', () => {
      expect(RATE_LIMITS.getById.windowMs).toBe(60000);
      expect(RATE_LIMITS.getById.maxRequests).toBe(500);
    });

    it('should have correct limits for getAll endpoint', () => {
      expect(RATE_LIMITS.getAll.windowMs).toBe(60000);
      expect(RATE_LIMITS.getAll.maxRequests).toBe(200);
    });

    it('should have correct limits for swagger endpoint', () => {
      expect(RATE_LIMITS.swagger.windowMs).toBe(60000);
      expect(RATE_LIMITS.swagger.maxRequests).toBe(20);
    });
  });

  describe('getRateLimitStats', () => {
    it('should return empty stats initially', () => {
      const stats = getRateLimitStats();
      expect(stats.totalClients).toBe(0);
      expect(stats.totalRequests).toBe(0);
    });

    it('should track statistics correctly', () => {
      const request = createMockRequest({ 'x-forwarded-for': '192.168.1.1' });
      const config = { windowMs: 60000, maxRequests: 10 };

      // Make some requests
      checkRateLimit(request, 'test', config);
      checkRateLimit(request, 'test', config);
      checkRateLimit(request, 'test', config);

      const stats = getRateLimitStats();
      expect(stats.totalClients).toBe(1);
      expect(stats.totalRequests).toBe(3);
    });

    it('should track multiple clients', () => {
      const client1 = createMockRequest({ 'x-forwarded-for': '192.168.1.1' });
      const client2 = createMockRequest({ 'x-forwarded-for': '192.168.1.2' });
      const config = { windowMs: 60000, maxRequests: 10 };

      checkRateLimit(client1, 'test', config);
      checkRateLimit(client2, 'test', config);

      const stats = getRateLimitStats();
      expect(stats.totalClients).toBe(2);
      expect(stats.totalRequests).toBe(2);
    });
  });

  describe('clearRateLimitStore', () => {
    it('should clear all rate limit data', () => {
      const request = createMockRequest({ 'x-forwarded-for': '192.168.1.1' });
      const config = { windowMs: 60000, maxRequests: 10 };

      // Make some requests
      checkRateLimit(request, 'test', config);
      checkRateLimit(request, 'test', config);

      let stats = getRateLimitStats();
      expect(stats.totalClients).toBe(1);

      // Clear the store
      clearRateLimitStore();

      stats = getRateLimitStats();
      expect(stats.totalClients).toBe(0);
      expect(stats.totalRequests).toBe(0);
    });
  });

  describe('Sliding window implementation', () => {
    it('should implement sliding window correctly', (done) => {
      const request = createMockRequest({ 'x-forwarded-for': '192.168.1.1' });
      const config = { windowMs: 200, maxRequests: 3 };

      // Make 3 requests at t=0
      checkRateLimit(request, 'test', config);
      checkRateLimit(request, 'test', config);
      checkRateLimit(request, 'test', config);

      // 4th request should be blocked
      expect(checkRateLimit(request, 'test', config).allowed).toBe(false);

      // Wait 100ms, first request still in window
      setTimeout(() => {
        expect(checkRateLimit(request, 'test', config).allowed).toBe(false);

        // Wait another 110ms, first request out of window
        setTimeout(() => {
          expect(checkRateLimit(request, 'test', config).allowed).toBe(true);
          done();
        }, 110);
      }, 100);
    }, 10000);
  });
});
