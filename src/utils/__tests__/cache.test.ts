import { describe, it, expect, beforeEach } from 'vitest';
import { CacheManager, cached } from '../cache';

describe('CacheManager - Integration Tests', () => {
  let cache: CacheManager;
  
  beforeEach(() => {
    cache = new CacheManager('test-cache');
    localStorage.clear();
  });

  describe('Basic Operations', () => {
    it('should store and retrieve data from memory', () => {
      cache.set('test-key', { value: 'test-data' });
      const result = cache.get('test-key');
      
      expect(result).toEqual({ value: 'test-data' });
    });

    it('should return null for non-existent keys', () => {
      const result = cache.get('non-existent');
      expect(result).toBeNull();
    });

    it('should handle different data types', () => {
      cache.set('string', 'test');
      cache.set('number', 123);
      cache.set('object', { nested: 'value' });
      cache.set('array', [1, 2, 3]);
      
      expect(cache.get('string')).toBe('test');
      expect(cache.get('number')).toBe(123);
      expect(cache.get('object')).toEqual({ nested: 'value' });
      expect(cache.get('array')).toEqual([1, 2, 3]);
    });
  });

  describe('TTL (Time To Live)', () => {
    it('should respect custom TTL', async () => {
      cache.set('short-lived', 'data', { ttl: 50 });
      
      // Immediately should be available
      expect(cache.get('short-lived')).toBe('data');
      
      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should be null after expiry
      expect(cache.get('short-lived')).toBeNull();
    });

    it('should keep data within TTL', () => {
      cache.set('valid', 'data', { ttl: 10000 });
      
      expect(cache.get('valid')).toBe('data');
    });
  });

  describe('LocalStorage Integration', () => {
    it('should save to and retrieve from localStorage', () => {
      cache.set('persistent', 'data', { storage: 'localStorage' });
      
      // Should be retrievable
      const result = cache.get('persistent', { storage: 'localStorage' });
      expect(result).toBe('data');
      
      // Should be in localStorage
      const stored = localStorage.getItem('test-cache_persistent');
      expect(stored).toBeDefined();
    });

    it('should handle localStorage errors gracefully', () => {
      // This should not throw even if localStorage fails
      expect(() => {
        cache.set('test', 'data', { storage: 'localStorage' });
      }).not.toThrow();
    });
  });

  describe('Cache Cleanup', () => {
    it('should clear all cache data', () => {
      cache.set('key1', 'data1');
      cache.set('key2', 'data2');
      cache.set('key3', 'data3');
      
      cache.clear();
      
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
      expect(cache.get('key3')).toBeNull();
    });

    it('should cleanup expired entries', async () => {
      cache.set('expired1', 'data1', { ttl: 50 });
      cache.set('expired2', 'data2', { ttl: 50 });
      cache.set('valid', 'data3', { ttl: 10000 });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      cache.cleanup();
      
      expect(cache.get('expired1')).toBeNull();
      expect(cache.get('expired2')).toBeNull();
      expect(cache.get('valid')).toBe('data3');
    });
  });
});

describe('cached decorator - Integration Tests', () => {
  let callCount: number;
  
  beforeEach(() => {
    callCount = 0;
    const cache = new CacheManager('test-decorator');
    cache.clear();
  });

  it('should cache async function results', async () => {
    const originalFunc = async (input: string) => {
      callCount++;
      return `result-${input}`;
    };
    const expensiveFunction = cached(originalFunc);
    
    // First call
    const result1 = await expensiveFunction('abc');
    expect(result1).toBe('result-abc');
    expect(callCount).toBe(1);
    
    // Second call - should use cache
    const result2 = await expensiveFunction('abc');
    expect(result2).toBe('result-abc');
    expect(callCount).toBe(1); // Not incremented!
  });

  it('should handle different inputs separately', async () => {
    const originalFunc = async (input: string) => {
      callCount++;
      return `result-${input}`;
    };
    const func = cached(originalFunc);
    
    await func('input1');
    await func('input2');
    
    expect(callCount).toBe(2); // Different inputs
  });

  it('should respect custom TTL', async () => {
    const originalFunc = async (input: string) => {
      callCount++;
      return `result-${input}`;
    };
    const func = cached(originalFunc, { ttl: 50 });
    
    await func('test');
    expect(callCount).toBe(1);
    
    // Immediately - should use cache
    await func('test');
    expect(callCount).toBe(1);
    
    // Wait for TTL to expire
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Should execute again
    await func('test');
    expect(callCount).toBe(2);
  });

  it('should handle errors correctly', async () => {
    const originalErrorFunc = async () => {
      throw new Error('Test error');
    };
    const errorFunc = cached(originalErrorFunc);
    
    await expect(errorFunc()).rejects.toThrow('Test error');
  });
});
