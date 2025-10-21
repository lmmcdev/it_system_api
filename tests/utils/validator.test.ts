/**
 * Unit tests for validator utility functions
 */

import { describe, it, expect } from '@jest/globals';
import {
  validateId,
  validateISODate,
  validateSearchText,
  validateFilterArray,
  validatePaginationParams,
  validateRiskFilters
} from '../../src/utils/validator';

describe('Validator Utilities', () => {
  describe('validateId', () => {
    it('should accept valid UUID v4', () => {
      const validUuid = '550e8400-e29b-41d4-a716-446655440000';
      const result = validateId(validUuid);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid UUID format', () => {
      const invalidUuid = 'not-a-uuid';
      const result = validateId(invalidUuid);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject empty string', () => {
      const result = validateId('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should reject undefined', () => {
      const result = validateId(undefined);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('required');
    });
  });

  describe('validateISODate', () => {
    it('should accept valid ISO 8601 date', () => {
      const validDate = '2025-10-17T12:00:00Z';
      const result = validateISODate(validDate);
      expect(result.valid).toBe(true);
    });

    it('should accept ISO date with milliseconds', () => {
      const validDate = '2025-10-17T12:00:00.123Z';
      const result = validateISODate(validDate);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid date format', () => {
      const invalidDate = '2025/10/17';
      const result = validateISODate(invalidDate);
      expect(result.valid).toBe(false);
    });

    it('should reject invalid date value', () => {
      const invalidDate = '2025-13-45T99:99:99Z';
      const result = validateISODate(invalidDate);
      expect(result.valid).toBe(false);
    });
  });

  describe('validateSearchText', () => {
    it('should accept valid search text', () => {
      const text = 'security alert';
      const result = validateSearchText(text);
      expect(result).toBe('security alert');
    });

    it('should normalize Unicode characters', () => {
      const text = 'café'; // Contains Unicode
      const result = validateSearchText(text);
      expect(result).toBe('café');
    });

    it('should reject text below minimum length', () => {
      expect(() => validateSearchText('a')).toThrow('at least 2 characters');
    });

    it('should reject text exceeding maximum length', () => {
      const longText = 'a'.repeat(101);
      expect(() => validateSearchText(longText)).toThrow('cannot exceed 100 characters');
    });

    it('should reject text with too many special characters', () => {
      const specialText = '!@#$%^&*()';
      expect(() => validateSearchText(specialText)).toThrow('30% alphanumeric');
    });

    it('should reject text with control characters', () => {
      const textWithControl = 'test\x00text';
      expect(() => validateSearchText(textWithControl)).toThrow('control characters');
    });

    it('should allow text with spaces', () => {
      const text = 'multiple word search query';
      const result = validateSearchText(text);
      expect(result).toBe(text);
    });
  });

  describe('validateFilterArray', () => {
    it('should accept valid array within limits', () => {
      const result = validateFilterArray('high,medium,low', 'severity', ['high', 'medium', 'low']);
      expect(result).toEqual(['high', 'medium', 'low']);
    });

    it('should trim whitespace from values', () => {
      const result = validateFilterArray('high , medium , low', 'severity', ['high', 'medium', 'low']);
      expect(result).toEqual(['high', 'medium', 'low']);
    });

    it('should reject array exceeding max items', () => {
      const values = Array(11).fill('value').join(',');
      expect(() => validateFilterArray(values, 'test', undefined, 10)).toThrow('at most 10 values');
    });

    it('should reject values exceeding max length', () => {
      const longValue = 'a'.repeat(51);
      expect(() => validateFilterArray(longValue, 'test')).toThrow('exceeds maximum length');
    });

    it('should reject values with control characters', () => {
      expect(() => validateFilterArray('test\x00value', 'test')).toThrow('control characters');
    });

    it('should reject values not in whitelist', () => {
      expect(() => validateFilterArray('invalid', 'severity', ['high', 'low'])).toThrow('Invalid value');
    });

    it('should reject values with XSS characters', () => {
      expect(() => validateFilterArray('test<script>', 'test')).toThrow('invalid characters');
    });

    it('should return undefined for empty/null input', () => {
      expect(validateFilterArray(null, 'test')).toBeUndefined();
      expect(validateFilterArray(undefined, 'test')).toBeUndefined();
      expect(validateFilterArray('', 'test')).toBeUndefined();
    });
  });

  describe('validatePaginationParams', () => {
    it('should use default page size when not provided', () => {
      const result = validatePaginationParams(null, null);
      expect(result.valid).toBe(true);
      expect(result.pageSize).toBe(50);
    });

    it('should accept valid page size', () => {
      const result = validatePaginationParams('25', null);
      expect(result.valid).toBe(true);
      expect(result.pageSize).toBe(25);
    });

    it('should reject page size exceeding maximum', () => {
      const result = validatePaginationParams('101', null);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('cannot exceed 100');
    });

    it('should reject negative page size', () => {
      const result = validatePaginationParams('0', null);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least 1');
    });

    it('should reject non-numeric page size', () => {
      const result = validatePaginationParams('abc', null);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('valid number');
    });

    it('should accept valid continuation token', () => {
      const token = 'validToken123';
      const result = validatePaginationParams('50', token);
      expect(result.valid).toBe(true);
      expect(result.continuationToken).toBe(token);
    });

    it('should reject excessively long continuation token', () => {
      const longToken = 'a'.repeat(10001);
      const result = validatePaginationParams('50', longToken);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too long');
    });

    it('should reject continuation token with invalid characters', () => {
      const result = validatePaginationParams('50', 'token<script>');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('invalid characters');
    });
  });

  describe('validateRiskFilters', () => {
    it('should accept valid riskLevel filter', () => {
      const result = validateRiskFilters({ riskLevel: 'high' });
      expect(result.valid).toBe(true);
      expect(result.sanitized?.riskLevel).toBe('high');
    });

    it('should accept all valid riskLevel values', () => {
      const validLevels = ['low', 'medium', 'high', 'hidden', 'none', 'unknownFutureValue'];

      for (const level of validLevels) {
        const result = validateRiskFilters({ riskLevel: level });
        expect(result.valid).toBe(true);
        // Validator normalizes to lowercase
        expect(result.sanitized?.riskLevel).toBe(level.toLowerCase());
      }
    });

    it('should reject invalid riskLevel', () => {
      const result = validateRiskFilters({ riskLevel: 'invalid' });
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0]).toContain('riskLevel');
    });

    it('should accept valid riskState filter', () => {
      const result = validateRiskFilters({ riskState: 'atRisk' });
      expect(result.valid).toBe(true);
      expect(result.sanitized?.riskState).toBe('atRisk');
    });

    it('should accept all valid riskState values', () => {
      const validStates = [
        'none',
        'confirmedSafe',
        'remediated',
        'dismissed',
        'atRisk',
        'confirmedCompromised',
        'unknownFutureValue'
      ];

      for (const state of validStates) {
        const result = validateRiskFilters({ riskState: state });
        expect(result.valid).toBe(true);
        expect(result.sanitized?.riskState).toBe(state);
      }
    });

    it('should reject invalid riskState', () => {
      const result = validateRiskFilters({ riskState: 'invalid' });
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0]).toContain('riskState');
    });

    it('should accept valid userId filter', () => {
      const result = validateRiskFilters({ userId: 'user@example.com' });
      expect(result.valid).toBe(true);
      expect(result.sanitized?.userId).toBe('user@example.com');
    });

    it('should accept userId with various valid characters', () => {
      const validUserIds = [
        'user@example.com',
        'user.name@example.com',
        'user_name@example.com',
        'user-name@example.com',
        'User123@Example.Com'
      ];

      for (const userId of validUserIds) {
        const result = validateRiskFilters({ userId });
        expect(result.valid).toBe(true);
        expect(result.sanitized?.userId).toBeDefined();
      }
    });

    it('should reject userId with invalid characters', () => {
      const result = validateRiskFilters({ userId: 'user<script>@example.com' });
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should accept valid startDate filter', () => {
      const result = validateRiskFilters({ startDate: '2025-10-20T10:00:00Z' });
      expect(result.valid).toBe(true);
      expect(result.sanitized?.startDate).toBe('2025-10-20T10:00:00Z');
    });

    it('should reject invalid startDate format', () => {
      const result = validateRiskFilters({ startDate: '2025/10/20' });
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0]).toContain('startDate');
    });

    it('should accept valid endDate filter', () => {
      const result = validateRiskFilters({ endDate: '2025-10-31T23:59:59Z' });
      expect(result.valid).toBe(true);
      expect(result.sanitized?.endDate).toBe('2025-10-31T23:59:59Z');
    });

    it('should reject invalid endDate format', () => {
      const result = validateRiskFilters({ endDate: 'not-a-date' });
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0]).toContain('endDate');
    });

    it('should validate date range logic', () => {
      const result = validateRiskFilters({
        startDate: '2025-10-31T00:00:00Z',
        endDate: '2025-10-01T00:00:00Z'
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0]).toContain('startDate must be before');
    });

    it('should accept multiple valid filters', () => {
      const result = validateRiskFilters({
        riskLevel: 'high',
        riskState: 'atRisk',
        userId: 'user@example.com',
        startDate: '2025-10-01T00:00:00Z',
        endDate: '2025-10-31T23:59:59Z'
      });
      expect(result.valid).toBe(true);
      expect(result.sanitized?.riskLevel).toBe('high');
      expect(result.sanitized?.riskState).toBe('atRisk');
      expect(result.sanitized?.userId).toBe('user@example.com');
      expect(result.sanitized?.startDate).toBe('2025-10-01T00:00:00Z');
      expect(result.sanitized?.endDate).toBe('2025-10-31T23:59:59Z');
    });

    it('should collect multiple validation errors', () => {
      const result = validateRiskFilters({
        riskLevel: 'invalid',
        riskState: 'also-invalid',
        startDate: 'bad-date'
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThanOrEqual(3);
    });

    it('should return valid true with no filters', () => {
      const result = validateRiskFilters({});
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBeUndefined();
    });

    it('should handle null values', () => {
      const result = validateRiskFilters({
        riskLevel: null,
        riskState: null,
        userId: null
      });
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBeUndefined();
    });

    it('should normalize riskLevel to lowercase', () => {
      const result = validateRiskFilters({ riskLevel: 'HIGH' });
      expect(result.valid).toBe(true);
      expect(result.sanitized?.riskLevel).toBe('high');
    });

    it('should reject userId exceeding maximum length', () => {
      const longUserId = 'a'.repeat(201) + '@example.com';
      const result = validateRiskFilters({ userId: longUserId });
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });
});
