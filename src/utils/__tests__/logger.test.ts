import { describe, it, expect, beforeEach } from 'vitest';
import { logger } from '../logger';

describe('Logger - Integration Tests', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  describe('Basic Logging', () => {
    it('should log info messages without throwing', () => {
      expect(() => {
        logger.info('Test info message');
      }).not.toThrow();
    });

    it('should log warning messages without throwing', () => {
      expect(() => {
        logger.warn('Test warning message');
      }).not.toThrow();
    });

    it('should log error messages without throwing', () => {
      expect(() => {
        logger.error('Test error message');
      }).not.toThrow();
    });

    it('should log debug messages without throwing', () => {
      expect(() => {
        logger.debug('Test debug message');
      }).not.toThrow();
    });
  });

  describe('Context Data', () => {
    it('should accept context data', () => {
      expect(() => {
        logger.info('Test with context', { userId: 123, action: 'test' });
      }).not.toThrow();
    });

    it('should handle complex objects', () => {
      expect(() => {
        logger.info('Complex data', {
          nested: {
            deep: {
              value: 'test',
            },
          },
          array: [1, 2, 3],
        });
      }).not.toThrow();
    });

    it('should handle null and undefined', () => {
      expect(() => {
        logger.info('Null data', null);
        logger.info('Undefined data', undefined);
      }).not.toThrow();
    });
  });

  describe('Event Tracking', () => {
    it('should track events without throwing', () => {
      expect(() => {
        logger.trackEvent('UI', 'button_click', 'submit_button');
      }).not.toThrow();
    });

    it('should track events with numeric values', () => {
      expect(() => {
        logger.trackEvent('Performance', 'load_time', 'page_load', 1500);
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully', () => {
      expect(() => {
        try {
          throw new Error('Test error');
        } catch (error) {
          logger.error('Caught error', error);
        }
      }).not.toThrow();
    });

    it('should log error stack traces', () => {
      expect(() => {
        const error = new Error('Stack trace test');
        logger.error('Error with stack', { error });
      }).not.toThrow();
    });
  });
});
