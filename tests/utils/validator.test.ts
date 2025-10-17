/**
 * Unit tests for validator utility functions
 */

import { describe, it, expect } from '@jest/globals';
import {
  validateId,
  validateISODate,
  validateSearchText,
  validateFilterArray,
  validatePaginationParams
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
});
