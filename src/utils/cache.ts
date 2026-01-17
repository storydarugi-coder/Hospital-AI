/**
 * 캐싱 전략 유틸리티
 * - 메모리 캐시
 * - LocalStorage 캐시
 * - TTL (Time To Live) 지원
 */

export interface CacheItem<T> {
  data: T;
  expiry: number;
  createdAt: number;
}

export interface CacheOptions {
  ttl?: number; // milliseconds
  storage?: 'memory' | 'localStorage';
  prefix?: string;
}

/**
 * 메모리 + LocalStorage 캐시 매니저
 */
export class CacheManager {
  private memoryCache = new Map<string, CacheItem<any>>();
  private prefix: string;

  constructor(prefix = 'hospitalai_cache') {
    this.prefix = prefix;
  }

  /**
   * 캐시에 데이터 저장
   */
  set<T>(
    key: string,
    data: T,
    options: CacheOptions = {}
  ): void {
    const { ttl = 3600000, storage = 'memory' } = options; // 기본 1시간
    const now = Date.now();

    const item: CacheItem<T> = {
      data,
      expiry: now + ttl,
      createdAt: now,
    };

    // 메모리 캐시에 저장
    this.memoryCache.set(key, item);

    // LocalStorage에도 저장
    if (storage === 'localStorage') {
      try {
        const storageKey = `${this.prefix}_${key}`;
        localStorage.setItem(storageKey, JSON.stringify(item));
      } catch (error) {
        console.warn('LocalStorage 저장 실패:', error);
      }
    }
  }

  /**
   * 캐시에서 데이터 가져오기
   */
  get<T>(key: string, options: CacheOptions = {}): T | null {
    const { storage = 'memory' } = options;
    const now = Date.now();

    // 1. 메모리 캐시 확인
    const memoryItem = this.memoryCache.get(key);
    if (memoryItem && now < memoryItem.expiry) {
      return memoryItem.data as T;
    }

    // 메모리 캐시 만료 시 삭제
    if (memoryItem) {
      this.memoryCache.delete(key);
    }

    // 2. LocalStorage 확인
    if (storage === 'localStorage') {
      try {
        const storageKey = `${this.prefix}_${key}`;
        const stored = localStorage.getItem(storageKey);
        
        if (stored) {
          const item: CacheItem<T> = JSON.parse(stored);
          
          if (now < item.expiry) {
            // 메모리 캐시에도 복원
            this.memoryCache.set(key, item);
            return item.data;
          }
          
          // 만료된 항목 삭제
          localStorage.removeItem(storageKey);
        }
      } catch (error) {
        console.warn('LocalStorage 읽기 실패:', error);
      }
    }

    return null;
  }

  /**
   * 캐시가 있는지 확인 (만료 여부 체크)
   */
  has(key: string, options: CacheOptions = {}): boolean {
    return this.get(key, options) !== null;
  }

  /**
   * 캐시 삭제
   */
  delete(key: string): void {
    this.memoryCache.delete(key);
    
    try {
      const storageKey = `${this.prefix}_${key}`;
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.warn('LocalStorage 삭제 실패:', error);
    }
  }

  /**
   * 모든 캐시 삭제
   */
  clear(): void {
    this.memoryCache.clear();
    
    try {
      // Prefix가 일치하는 모든 항목 삭제
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.prefix)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn('LocalStorage 전체 삭제 실패:', error);
    }
  }

  /**
   * 만료된 캐시 정리
   * 🚀 성능 개선: requestIdleCallback으로 백그라운드 실행
   */
  cleanup(): void {
    const now = Date.now();

    // 메모리 캐시 정리 (빠르므로 즉시 실행)
    for (const [key, item] of this.memoryCache.entries()) {
      if (now >= item.expiry) {
        this.memoryCache.delete(key);
      }
    }

    // 🚀 LocalStorage 정리는 백그라운드에서 (UI 블로킹 방지)
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => {
        this.cleanupLocalStorage(now);
      });
    } else {
      // requestIdleCallback 미지원 환경 (fallback)
      setTimeout(() => this.cleanupLocalStorage(now), 0);
    }
  }

  /**
   * LocalStorage 정리 (내부 메서드)
   */
  private cleanupLocalStorage(now: number): void {
    try {
      // 🚀 성능 개선: 배치 처리 - 삭제할 키들을 먼저 수집
      const keysToRemove: string[] = [];
      const keys = Object.keys(localStorage);

      keys.forEach(key => {
        if (key.startsWith(this.prefix)) {
          const stored = localStorage.getItem(key);
          if (stored) {
            try {
              const item: CacheItem<any> = JSON.parse(stored);
              if (now >= item.expiry) {
                keysToRemove.push(key);
              }
            } catch {
              // 파싱 실패한 항목은 삭제
              keysToRemove.push(key);
            }
          }
        }
      });

      // 수집된 키들을 일괄 삭제
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.warn('LocalStorage 정리 실패:', error);
    }
  }

  /**
   * 캐시 통계
   */
  getStats(): {
    memorySize: number;
    localStorageSize: number;
    memoryKeys: string[];
  } {
    const memoryKeys = Array.from(this.memoryCache.keys());
    
    let localStorageKeys: string[] = [];
    try {
      const keys = Object.keys(localStorage);
      localStorageKeys = keys.filter(key => key.startsWith(this.prefix));
    } catch (error) {
      console.warn('LocalStorage 통계 확인 실패:', error);
    }

    return {
      memorySize: this.memoryCache.size,
      localStorageSize: localStorageKeys.length,
      memoryKeys,
    };
  }
}

/**
 * 기본 캐시 매니저 인스턴스
 */
export const defaultCache = new CacheManager();

/**
 * 함수 결과 캐싱 데코레이터 (HOF)
 */
export function cached<T extends (...args: any[]) => any>(
  fn: T,
  options: CacheOptions & { keyGenerator?: (...args: Parameters<T>) => string } = {}
): T {
  const { keyGenerator, ...cacheOptions } = options;
  const cache = new CacheManager(`${fn.name}_cache`);

  return ((...args: Parameters<T>) => {
    const key = keyGenerator 
      ? keyGenerator(...args)
      : JSON.stringify(args);

    const cached = cache.get(key, cacheOptions);
    if (cached !== null) {
      console.log(`✅ Cache hit for ${fn.name}:`, key);
      return cached;
    }

    console.log(`🔄 Cache miss for ${fn.name}:`, key);
    const result = fn(...args);

    // Promise인 경우 비동기 처리
    if (result instanceof Promise) {
      return result.then((data) => {
        cache.set(key, data, cacheOptions);
        return data;
      });
    }

    cache.set(key, result, cacheOptions);
    return result;
  }) as T;
}
