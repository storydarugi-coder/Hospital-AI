/**
 * 프롬프트 캐싱 시스템
 * - 반복되는 프롬프트 결과 캐싱
 * - 메모리 기반 (세션 유지)
 * - TTL (Time To Live) 지원
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // milliseconds
  hits: number;
}

class PromptCache {
  private cache: Map<string, CacheEntry<any>>;
  private readonly MAX_SIZE = 100;
  private readonly DEFAULT_TTL = 3600000; // 1 hour

  constructor() {
    this.cache = new Map();
  }

  /**
   * 캐시 키 생성
   */
  private generateKey(prefix: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        acc[key] = params[key];
        return acc;
      }, {} as Record<string, any>);

    return `${prefix}:${JSON.stringify(sortedParams)}`;
  }

  /**
   * 캐시 조회
   */
  get<T>(prefix: string, params: Record<string, any>): T | null {
    const key = this.generateKey(prefix, params);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // TTL 체크
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      console.log(`🗑️ [Cache] Expired: ${key}`);
      return null;
    }

    // 히트 카운트 증가
    entry.hits++;
    console.log(`✅ [Cache] Hit (${entry.hits}회): ${key.substring(0, 80)}...`);

    return entry.data as T;
  }

  /**
   * 캐시 저장
   */
  set<T>(prefix: string, params: Record<string, any>, data: T, ttl?: number): void {
    const key = this.generateKey(prefix, params);

    // 캐시 크기 제한
    if (this.cache.size >= this.MAX_SIZE) {
      // LRU: 가장 오래된 항목 제거
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
        console.log(`🗑️ [Cache] Evicted oldest: ${firstKey}`);
      }
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.DEFAULT_TTL,
      hits: 0
    };

    this.cache.set(key, entry);
    console.log(`💾 [Cache] Set: ${key.substring(0, 80)}... (TTL: ${(entry.ttl / 1000 / 60).toFixed(0)}분)`);
  }

  /**
   * 캐시 무효화
   */
  invalidate(prefix: string, params?: Record<string, any>): void {
    if (params) {
      const key = this.generateKey(prefix, params);
      this.cache.delete(key);
      console.log(`🗑️ [Cache] Invalidated: ${key}`);
    } else {
      // prefix로 시작하는 모든 키 삭제
      const keysToDelete: string[] = [];
      this.cache.forEach((_, key) => {
        if (key.startsWith(`${prefix}:`)) {
          keysToDelete.push(key);
        }
      });

      keysToDelete.forEach(key => this.cache.delete(key));
      console.log(`🗑️ [Cache] Invalidated ${keysToDelete.length} entries with prefix: ${prefix}`);
    }
  }

  /**
   * 전체 캐시 삭제
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`🗑️ [Cache] Cleared all ${size} entries`);
  }

  /**
   * 캐시 통계
   */
  getStats(): {
    size: number;
    entries: Array<{ key: string; hits: number; age: number }>;
    totalHits: number;
    hitRate: number;
  } {
    const entries: Array<{ key: string; hits: number; age: number }> = [];
    let totalHits = 0;
    let totalRequests = 0;

    const now = Date.now();
    this.cache.forEach((entry, key) => {
      const age = now - entry.timestamp;
      entries.push({
        key: key.substring(0, 50),
        hits: entry.hits,
        age: Math.round(age / 1000 / 60) // minutes
      });
      totalHits += entry.hits;
      totalRequests += entry.hits + 1; // +1 for initial set
    });

    return {
      size: this.cache.size,
      entries: entries.sort((a, b) => b.hits - a.hits),
      totalHits,
      hitRate: totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0
    };
  }

  /**
   * 만료된 항목 정리
   */
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.cache.delete(key));

    if (keysToDelete.length > 0) {
      console.log(`🗑️ [Cache] Cleaned up ${keysToDelete.length} expired entries`);
    }
  }
}

// 싱글톤 인스턴스
export const promptCache = new PromptCache();

// 주기적 정리 (5분마다)
setInterval(() => {
  promptCache.cleanup();
}, 5 * 60 * 1000);

/**
 * 캐시 가능한 함수 래퍼
 */
export async function withCache<T>(
  prefix: string,
  params: Record<string, any>,
  fn: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // 캐시 조회
  const cached = promptCache.get<T>(prefix, params);
  if (cached !== null) {
    return cached;
  }

  // 캐시 미스 - 함수 실행
  console.log(`❌ [Cache] Miss: ${prefix}`);
  const result = await fn();

  // 결과 캐싱
  promptCache.set(prefix, params, result, ttl);

  return result;
}

/**
 * 특정 카테고리/주제 조합용 짧은 TTL 캐시
 */
export function cacheWithTopic<T>(
  operation: string,
  category: string,
  topic: string,
  fn: () => Promise<T>
): Promise<T> {
  return withCache(
    `${operation}:${category}`,
    { topic },
    fn,
    600000 // 10분
  );
}

/**
 * SEO 타이틀 추천용 캐시 (재사용 높음)
 */
export function cacheSeoTitles(
  topic: string,
  keywords: string,
  fn: () => Promise<any>
): Promise<any> {
  return withCache(
    'seo_titles',
    { topic, keywords },
    fn,
    1800000 // 30분
  );
}

/**
 * 트렌드 검색용 캐시 (변동성 있음)
 */
export function cacheTrendSearch(
  category: string,
  fn: () => Promise<any>
): Promise<any> {
  return withCache(
    'trend_search',
    { category },
    fn,
    300000 // 5분 (짧은 TTL)
  );
}
