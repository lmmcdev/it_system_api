/**
 * Logging utility
 * Provides structured logging with different log levels
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  error?: Error;
}

class Logger {
  private context: Record<string, unknown> = {};

  /**
   * Set persistent context for all log entries
   */
  setContext(context: Record<string, unknown>): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * Clear persistent context
   */
  clearContext(): void {
    this.context = {};
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log info message
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  /**
   * Internal log method
   */
  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: Error
  ): void {
    const logEntry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: { ...this.context, ...context }
    };

    if (error) {
      logEntry.error = error;
    }

    const logMessage = JSON.stringify(logEntry, this.errorReplacer.bind(this));

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(logMessage);
        break;
      case LogLevel.INFO:
        console.info(logMessage);
        break;
      case LogLevel.WARN:
        console.warn(logMessage);
        break;
      case LogLevel.ERROR:
        console.error(logMessage);
        break;
    }
  }

  /**
   * Sanitize error message to remove sensitive information
   */
  private sanitizeMessage(message: string): string {
    return message
      // Remove Windows file paths
      .replace(/[A-Za-z]:\\[\w\\\-\.]+/g, '[PATH]')
      // Remove Unix file paths (only common sensitive paths)
      .replace(/\/(home|var|usr|opt|root)\/[\w\/\-\.]+/g, '[PATH]')
      // Remove credentials from connection strings
      .replace(/key=[\w\-]+/gi, 'key=[REDACTED]')
      .replace(/password=[\w\-]+/gi, 'password=[REDACTED]')
      .replace(/secret=[\w\-]+/gi, 'secret=[REDACTED]')
      // Remove bearer tokens
      .replace(/Bearer\s+[\w\-\.]+/gi, 'Bearer [REDACTED]');
  }

  /**
   * Custom replacer for JSON.stringify to handle Error objects
   * In production, stack traces are omitted for security
   */
  private errorReplacer(_key: string, value: unknown): unknown {
    if (value instanceof Error) {
      const isDevelopment = process.env.NODE_ENV === 'development';

      return {
        name: value.name,
        message: this.sanitizeMessage(value.message),
        // Only include stack trace in development mode
        ...(isDevelopment && { stack: value.stack })
      };
    }
    return value;
  }
}

// Export singleton instance
export const logger = new Logger();
