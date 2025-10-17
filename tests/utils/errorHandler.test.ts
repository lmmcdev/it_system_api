/**
 * Unit tests for error handler utilities
 */

import { describe, it, expect } from '@jest/globals';
import {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
  ServiceError
} from '../../src/utils/errorHandler';

describe('Error Handler', () => {
  describe('AppError', () => {
    it('should create base error with message', () => {
      const error = new AppError(500, 'APP_ERROR', 'Test error');
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('APP_ERROR');
      expect(error.name).toBe('AppError');
    });

    it('should create error with custom code', () => {
      const error = new AppError(500, 'CUSTOM_CODE', 'Test error');
      expect(error.code).toBe('CUSTOM_CODE');
    });

    it('should create error with details', () => {
      const details = { field: 'value' };
      const error = new AppError(500, 'ERROR', 'Test error', details);
      expect(error.details).toEqual(details);
    });

    it('should be instance of Error', () => {
      const error = new AppError(500, 'APP_ERROR', 'Test error');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
    });
  });

  describe('ValidationError', () => {
    it('should create validation error with 400 status', () => {
      const error = new ValidationError('Invalid input');
      expect(error.message).toBe('Invalid input');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.name).toBe('ValidationError');
    });

    it('should support custom details', () => {
      const details = { field: 'email', reason: 'invalid format' };
      const error = new ValidationError('Validation failed', details);
      expect(error.details).toEqual(details);
    });

    it('should be instance of AppError', () => {
      const error = new ValidationError('Invalid input');
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(ValidationError);
    });
  });

  describe('NotFoundError', () => {
    it('should create not found error with 404 status', () => {
      const error = new NotFoundError('User', '123');
      expect(error.message).toBe("User with ID '123' not found");
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.name).toBe('NotFoundError');
    });

    it('should be instance of AppError', () => {
      const error = new NotFoundError('Resource', '1');
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(NotFoundError);
    });
  });

  describe('ConflictError', () => {
    it('should create conflict error with 409 status', () => {
      const error = new ConflictError('Resource already exists');
      expect(error.message).toBe('Resource already exists');
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT');
      expect(error.name).toBe('ConflictError');
    });

    it('should be instance of AppError', () => {
      const error = new ConflictError('Conflict');
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(ConflictError);
    });
  });

  describe('ServiceError', () => {
    it('should create service error with 500 status', () => {
      const error = new ServiceError('Internal error');
      expect(error.message).toBe('Internal error');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('SERVICE_ERROR');
      expect(error.name).toBe('ServiceError');
    });

    it('should support custom details', () => {
      const details = { service: 'CosmosDB', operation: 'read' };
      const error = new ServiceError('Database error', details);
      expect(error.details).toEqual(details);
    });

    it('should be instance of AppError', () => {
      const error = new ServiceError('Error');
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(ServiceError);
    });
  });

  describe('Error hierarchy', () => {
    it('should maintain proper inheritance chain', () => {
      const validation = new ValidationError('test');
      const notFound = new NotFoundError('Resource', '1');
      const conflict = new ConflictError('test');
      const service = new ServiceError('test');

      // All should be instances of Error
      expect(validation).toBeInstanceOf(Error);
      expect(notFound).toBeInstanceOf(Error);
      expect(conflict).toBeInstanceOf(Error);
      expect(service).toBeInstanceOf(Error);

      // All should be instances of AppError
      expect(validation).toBeInstanceOf(AppError);
      expect(notFound).toBeInstanceOf(AppError);
      expect(conflict).toBeInstanceOf(AppError);
      expect(service).toBeInstanceOf(AppError);

      // Should NOT be instances of each other
      expect(validation).not.toBeInstanceOf(NotFoundError);
      expect(notFound).not.toBeInstanceOf(ValidationError);
    });
  });

  describe('Error properties', () => {
    it('should have message property', () => {
      const error = new ValidationError('Invalid email', { field: 'email' });
      expect(error.message).toBe('Invalid email');
      expect(error.name).toBe('ValidationError');
      expect(error.details).toEqual({ field: 'email' });
    });

    it('should include stack trace', () => {
      const error = new ServiceError('Test error');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('ServiceError');
    });
  });

  describe('Error messages', () => {
    it('should format NotFoundError message correctly', () => {
      const error1 = new NotFoundError('User', '123');
      expect(error1.message).toBe("User with ID '123' not found");

      const error2 = new NotFoundError('AlertEvent', 'abc-def-ghi');
      expect(error2.message).toBe("AlertEvent with ID 'abc-def-ghi' not found");
    });

    it('should preserve custom error messages', () => {
      const customMessage = 'This is a very specific error message';
      const error = new ValidationError(customMessage);
      expect(error.message).toBe(customMessage);
    });
  });
});
