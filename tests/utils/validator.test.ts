/**
 * Unit tests for validator utility functions
 */

import { describe, it, expect } from '@jest/globals';
import {
  validateId,
  validateISODate,
  validateDateString,
  validateSearchText,
  validateFilterArray,
  validatePaginationParams,
  validateRiskFilters,
  validateStatisticsFilters
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

  describe('validateDateString', () => {
    it('should accept valid date in YYYY-MM-DD format', () => {
      const result = validateDateString('2025-10-15');
      expect(result.valid).toBe(true);
      expect(result.date).toBeDefined();
      expect(result.date?.toISOString()).toContain('2025-10-15');
    });

    it('should accept today\'s date', () => {
      const today = new Date();
      const dateString = today.toISOString().split('T')[0];
      const result = validateDateString(dateString);
      expect(result.valid).toBe(true);
    });

    it('should accept past dates', () => {
      const result = validateDateString('2020-01-01');
      expect(result.valid).toBe(true);
    });

    it('should reject future dates by default', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateString = tomorrow.toISOString().split('T')[0];
      const result = validateDateString(dateString);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('future');
    });

    it('should allow future dates when allowFuture is true', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateString = tomorrow.toISOString().split('T')[0];
      const result = validateDateString(dateString, { allowFuture: true });
      expect(result.valid).toBe(true);
    });

    it('should reject invalid date format', () => {
      const result = validateDateString('2025/10/15');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('YYYY-MM-DD');
    });

    it('should reject invalid date format with dashes only', () => {
      const result = validateDateString('15-10-2025');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('YYYY-MM-DD');
    });

    it('should reject ISO 8601 format (with time)', () => {
      const result = validateDateString('2025-10-15T12:00:00Z');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('YYYY-MM-DD');
    });

    it('should reject invalid month', () => {
      const result = validateDateString('2025-13-15');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Month');
    });

    it('should reject invalid day', () => {
      const result = validateDateString('2025-10-32');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Day');
    });

    it('should reject invalid date like February 30', () => {
      const result = validateDateString('2025-02-30');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid date');
    });

    it('should reject invalid date like February 29 in non-leap year', () => {
      const result = validateDateString('2025-02-29');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid date');
    });

    it('should accept February 29 in leap year', () => {
      const result = validateDateString('2024-02-29');
      expect(result.valid).toBe(true);
    });

    it('should reject dates before 1900', () => {
      const result = validateDateString('1899-12-31');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Year');
    });

    it('should reject dates after 2100', () => {
      const result = validateDateString('2101-01-01');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Year');
    });

    it('should reject empty string', () => {
      const result = validateDateString('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should reject null', () => {
      const result = validateDateString(null);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should reject undefined', () => {
      const result = validateDateString(undefined);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should enforce maxDaysBack limit', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 91);
      const dateString = oldDate.toISOString().split('T')[0];
      const result = validateDateString(dateString, { maxDaysBack: 90 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('90 days');
    });

    it('should allow dates within maxDaysBack limit', () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 30);
      const dateString = recentDate.toISOString().split('T')[0];
      const result = validateDateString(dateString, { maxDaysBack: 90 });
      expect(result.valid).toBe(true);
    });

    it('should handle edge case: exactly maxDaysBack ago', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 90);
      const dateString = oldDate.toISOString().split('T')[0];
      const result = validateDateString(dateString, { maxDaysBack: 90 });
      expect(result.valid).toBe(true);
    });

    it('should return Date object in UTC', () => {
      const result = validateDateString('2025-10-15');
      expect(result.valid).toBe(true);
      expect(result.date?.getUTCFullYear()).toBe(2025);
      expect(result.date?.getUTCMonth()).toBe(9); // October is month 9 (0-indexed)
      expect(result.date?.getUTCDate()).toBe(15);
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

    it('should reject continuation token with XSS characters', () => {
      const result = validatePaginationParams('50', 'token<script>');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('invalid characters');
    });

    it('should accept continuation token with quotes (legitimate JSON format)', () => {
      const tokenWithQuotes = '{"token":"value","page":2}';
      const result = validatePaginationParams('50', tokenWithQuotes);
      expect(result.valid).toBe(true);
      expect(result.continuationToken).toBe(tokenWithQuotes);
    });

    it('should accept continuation token with single quotes', () => {
      const tokenWithSingleQuotes = "{'token':'value'}";
      const result = validatePaginationParams('50', tokenWithSingleQuotes);
      expect(result.valid).toBe(true);
      expect(result.continuationToken).toBe(tokenWithSingleQuotes);
    });

    it('should reject continuation token with control characters', () => {
      const tokenWithControl = 'token\x00value';
      const result = validatePaginationParams('50', tokenWithControl);
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
      expect(result.sanitized?.riskState).toBe('atrisk'); // Normalized to lowercase
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

      const expectedLowercase = [
        'none',
        'confirmedsafe',
        'remediated',
        'dismissed',
        'atrisk',
        'confirmedcompromised',
        'unknownfuturevalue'
      ];

      for (let i = 0; i < validStates.length; i++) {
        const result = validateRiskFilters({ riskState: validStates[i] });
        expect(result.valid).toBe(true);
        expect(result.sanitized?.riskState).toBe(expectedLowercase[i]); // Normalized to lowercase
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

    it('should accept valid startDate filter in ISO 8601 format', () => {
      const result = validateRiskFilters({ startDate: '2025-10-20T10:00:00Z' });
      expect(result.valid).toBe(true);
      expect(result.sanitized?.startDate).toBe('2025-10-20T10:00:00Z');
    });

    it('should accept valid startDate filter in YYYY-MM-DD format', () => {
      const result = validateRiskFilters({ startDate: '2025-10-20' });
      expect(result.valid).toBe(true);
      expect(result.sanitized?.startDate).toBe('2025-10-20');
    });

    it('should reject invalid startDate format', () => {
      const result = validateRiskFilters({ startDate: '2025/10/20' });
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0]).toContain('startDate');
    });

    it('should accept valid endDate filter in ISO 8601 format', () => {
      const result = validateRiskFilters({ endDate: '2025-10-31T23:59:59Z' });
      expect(result.valid).toBe(true);
      expect(result.sanitized?.endDate).toBe('2025-10-31T23:59:59Z');
    });

    it('should accept valid endDate filter in YYYY-MM-DD format', () => {
      const result = validateRiskFilters({ endDate: '2025-10-31' });
      expect(result.valid).toBe(true);
      expect(result.sanitized?.endDate).toBe('2025-10-31');
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
      expect(result.sanitized?.riskState).toBe('atrisk'); // Normalized to lowercase
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

    describe('Bug Fix Verification - YYYY-MM-DD Support', () => {
      it('should fix the bug: accept startDate in YYYY-MM-DD format', () => {
        const result = validateRiskFilters({
          startDate: '2025-10-14',
          endDate: '2025-10-16'
        });
        expect(result.valid).toBe(true);
        expect(result.errors).toBeUndefined();
        expect(result.sanitized?.startDate).toBe('2025-10-14');
        expect(result.sanitized?.endDate).toBe('2025-10-16');
      });

      it('should accept mixed formats (YYYY-MM-DD and ISO 8601)', () => {
        const result = validateRiskFilters({
          startDate: '2025-10-14',
          endDate: '2025-10-16T23:59:59Z'
        });
        expect(result.valid).toBe(true);
        expect(result.sanitized?.startDate).toBe('2025-10-14');
        expect(result.sanitized?.endDate).toBe('2025-10-16T23:59:59Z');
      });

      it('should validate date range with YYYY-MM-DD format', () => {
        const result = validateRiskFilters({
          startDate: '2025-10-16',
          endDate: '2025-10-14'
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toBeDefined();
        expect(result.errors?.[0]).toContain('startDate must be before');
      });

      it('should allow same day in YYYY-MM-DD format', () => {
        const result = validateRiskFilters({
          startDate: '2025-10-14',
          endDate: '2025-10-14'
        });
        expect(result.valid).toBe(true);
        expect(result.sanitized?.startDate).toBe('2025-10-14');
        expect(result.sanitized?.endDate).toBe('2025-10-14');
      });
    });
  });

  describe('validateStatisticsFilters', () => {
    describe('Date Format Handling', () => {
      it('should accept YYYY-MM-DD format for startDate', () => {
        const result = validateStatisticsFilters({ startDate: '2025-10-21' });
        expect(result.valid).toBe(true);
        expect(result.sanitized?.startDate).toBe('2025-10-21');
      });

      it('should accept YYYY-MM-DD format for endDate', () => {
        const result = validateStatisticsFilters({ endDate: '2025-10-22' });
        expect(result.valid).toBe(true);
        expect(result.sanitized?.endDate).toBe('2025-10-22');
      });

      it('should accept ISO 8601 format for startDate and normalize to YYYY-MM-DD', () => {
        const result = validateStatisticsFilters({ startDate: '2025-10-21T00:00:00Z' });
        expect(result.valid).toBe(true);
        expect(result.sanitized?.startDate).toBe('2025-10-21');
      });

      it('should accept ISO 8601 format for endDate and normalize to YYYY-MM-DD', () => {
        const result = validateStatisticsFilters({ endDate: '2025-10-22T23:59:59.999Z' });
        expect(result.valid).toBe(true);
        expect(result.sanitized?.endDate).toBe('2025-10-22');
      });

      it('should accept date range in YYYY-MM-DD format', () => {
        const result = validateStatisticsFilters({
          startDate: '2025-10-21',
          endDate: '2025-10-22'
        });
        expect(result.valid).toBe(true);
        expect(result.sanitized?.startDate).toBe('2025-10-21');
        expect(result.sanitized?.endDate).toBe('2025-10-22');
      });

      it('should accept mixed formats and normalize both', () => {
        const result = validateStatisticsFilters({
          startDate: '2025-10-21',
          endDate: '2025-10-22T23:59:59Z'
        });
        expect(result.valid).toBe(true);
        expect(result.sanitized?.startDate).toBe('2025-10-21');
        expect(result.sanitized?.endDate).toBe('2025-10-22');
      });

      it('should reject invalid date format', () => {
        const result = validateStatisticsFilters({ startDate: '2025/10/21' });
        expect(result.valid).toBe(false);
        expect(result.errors).toBeDefined();
        expect(result.errors?.[0]).toContain('startDate');
      });

      it('should reject invalid date value', () => {
        const result = validateStatisticsFilters({ startDate: '2025-02-30' });
        expect(result.valid).toBe(false);
        expect(result.errors).toBeDefined();
      });
    });

    describe('Date Range Validation', () => {
      it('should validate startDate is before endDate', () => {
        const result = validateStatisticsFilters({
          startDate: '2025-10-22',
          endDate: '2025-10-21'
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toBeDefined();
        expect(result.errors?.[0]).toContain('startDate must be before');
      });

      it('should allow startDate equal to endDate (same day)', () => {
        const result = validateStatisticsFilters({
          startDate: '2025-10-21',
          endDate: '2025-10-21'
        });
        expect(result.valid).toBe(true);
      });

      it('should allow valid date range', () => {
        const result = validateStatisticsFilters({
          startDate: '2025-10-20',
          endDate: '2025-10-22'
        });
        expect(result.valid).toBe(true);
      });
    });

    describe('Statistics Type Validation', () => {
      it('should accept valid statistics type', () => {
        const result = validateStatisticsFilters({ type: 'detectionSource' });
        expect(result.valid).toBe(true);
        expect(result.sanitized?.type).toBe('detectionSource');
      });

      it('should accept all valid statistics types', () => {
        const validTypes = ['detectionSource', 'userImpact', 'ipThreats', 'attackTypes'];
        for (const type of validTypes) {
          const result = validateStatisticsFilters({ type });
          expect(result.valid).toBe(true);
          expect(result.sanitized?.type).toBe(type);
        }
      });

      it('should reject invalid statistics type', () => {
        const result = validateStatisticsFilters({ type: 'invalidType' });
        expect(result.valid).toBe(false);
        expect(result.errors).toBeDefined();
        expect(result.errors?.[0]).toContain('type');
      });
    });

    describe('TopN Validation', () => {
      it('should accept valid topN parameter', () => {
        const result = validateStatisticsFilters({ topN: '10' });
        expect(result.valid).toBe(true);
        expect(result.sanitized?.topN).toBe(10);
      });

      it('should reject topN exceeding maximum', () => {
        const result = validateStatisticsFilters({ topN: '101' });
        expect(result.valid).toBe(false);
        expect(result.errors).toBeDefined();
        expect(result.errors?.[0]).toContain('topN');
      });

      it('should reject topN below minimum', () => {
        const result = validateStatisticsFilters({ topN: '0' });
        expect(result.valid).toBe(false);
        expect(result.errors).toBeDefined();
      });

      it('should reject non-numeric topN', () => {
        const result = validateStatisticsFilters({ topN: 'abc' });
        expect(result.valid).toBe(false);
        expect(result.errors).toBeDefined();
      });
    });

    describe('Complete Filter Validation', () => {
      it('should accept all valid filters together', () => {
        const result = validateStatisticsFilters({
          type: 'userImpact',
          startDate: '2025-10-20',
          endDate: '2025-10-22',
          topN: '15'
        });
        expect(result.valid).toBe(true);
        expect(result.sanitized?.type).toBe('userImpact');
        expect(result.sanitized?.startDate).toBe('2025-10-20');
        expect(result.sanitized?.endDate).toBe('2025-10-22');
        expect(result.sanitized?.topN).toBe(15);
      });

      it('should collect multiple validation errors', () => {
        const result = validateStatisticsFilters({
          type: 'invalid',
          startDate: 'bad-date',
          topN: '999'
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toBeDefined();
        expect(result.errors?.length).toBeGreaterThanOrEqual(2);
      });

      it('should return valid true with no filters', () => {
        const result = validateStatisticsFilters({});
        expect(result.valid).toBe(true);
        expect(result.sanitized).toBeUndefined();
      });

      it('should handle null values', () => {
        const result = validateStatisticsFilters({
          type: null,
          startDate: null,
          endDate: null,
          topN: null
        });
        expect(result.valid).toBe(true);
        expect(result.sanitized).toBeUndefined();
      });
    });

    describe('Bug Fix Verification - YYYY-MM-DD Support', () => {
      it('should fix the bug: accept periodStartDate in YYYY-MM-DD format', () => {
        const result = validateStatisticsFilters({
          startDate: '2025-10-21',
          endDate: '2025-10-22'
        });
        expect(result.valid).toBe(true);
        expect(result.errors).toBeUndefined();
      });

      it('should normalize dates to YYYY-MM-DD for database queries', () => {
        const result = validateStatisticsFilters({
          startDate: '2025-10-21T00:00:00.000Z',
          endDate: '2025-10-22T23:59:59.999Z'
        });
        expect(result.valid).toBe(true);
        expect(result.sanitized?.startDate).toBe('2025-10-21');
        expect(result.sanitized?.endDate).toBe('2025-10-22');
      });

      it('should match the periodStartDate field format in CosmosDB', () => {
        // periodStartDate in DB is "2025-10-21" (YYYY-MM-DD)
        const result = validateStatisticsFilters({
          startDate: '2025-10-21',
          endDate: '2025-10-21'
        });
        expect(result.valid).toBe(true);
        expect(result.sanitized?.startDate).toBe('2025-10-21');
        expect(result.sanitized?.endDate).toBe('2025-10-21');
      });
    });
  });
});
