/**
 * 콘텐츠 캐싱 시스템 (토큰 절약)
 * 같은 주제/카테고리는 구조를 캐싱하여 재사용
 */

import { CacheManager } from './cache';
import type { ContentCategory } from '../types';

interface ContentStructure {
  outline: string[];
  subheadings: string[];
  keywords: string[];
  generatedAt: number;
}

interface TemplateCache {
  category: ContentCategory;
  structure: ContentStructure;
  usageCount: number;
  lastUsed: number;
}

/**
 * 콘텐츠 구조 캐시 매니저
 */
export class ContentCacheManager extends CacheManager {
  constructor() {
    super('content_cache');
  }

  /**
   * 카테고리별 구조 캐싱
   */
  cacheStructure(
    category: ContentCategory,
    structure: ContentStructure
  ): void {
    const key = `structure_${category}`;
    const existing = this.get<TemplateCache>(key);

    const cached: TemplateCache = {
      category,
      structure,
      usageCount: existing ? existing.usageCount + 1 : 1,
      lastUsed: Date.now()
    };

    // 7일 캐싱
    this.set(key, cached, { ttl: 7 * 24 * 60 * 60 * 1000, storage: 'localStorage' });
  }

  /**
   * 캐시된 구조 가져오기
   */
  getStructure(category: ContentCategory): ContentStructure | null {
    const key = `structure_${category}`;
    const cached = this.get<TemplateCache>(key, { storage: 'localStorage' });

    if (!cached) return null;

    // 사용 횟수 증가
    cached.usageCount++;
    cached.lastUsed = Date.now();
    this.set(key, cached, { ttl: 7 * 24 * 60 * 60 * 1000, storage: 'localStorage' });

    return cached.structure;
  }

  /**
   * 자주 사용되는 구조 확인
   */
  getPopularStructures(limit: number = 5): TemplateCache[] {
    const allKeys = this.getStats().memoryKeys
      .concat(Object.keys(localStorage).filter(k => k.startsWith('content_cache_structure')));

    const structures: TemplateCache[] = [];

    for (const key of allKeys) {
      const cached = this.get<TemplateCache>(key.replace('content_cache_', ''), { storage: 'localStorage' });
      if (cached) {
        structures.push(cached);
      }
    }

    // 사용 횟수로 정렬
    return structures
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit);
  }
}

/**
 * 키워드 기반 유사 콘텐츠 캐시
 */
export class SimilarContentCache {
  private cache: CacheManager;

  constructor() {
    this.cache = new CacheManager('similar_content');
  }

  /**
   * 키워드 정규화
   */
  private normalizeKeywords(keywords: string[]): string {
    return keywords
      .map(k => k.trim().toLowerCase())
      .sort()
      .join('_');
  }

  /**
   * 유사 콘텐츠 검색
   */
  findSimilar(keywords: string[], category: ContentCategory): string | null {
    const key = `${category}_${this.normalizeKeywords(keywords)}`;
    return this.cache.get<string>(key, { storage: 'localStorage' });
  }

  /**
   * 콘텐츠 캐싱
   */
  cacheSimilar(
    keywords: string[],
    category: ContentCategory,
    content: string
  ): void {
    const key = `${category}_${this.normalizeKeywords(keywords)}`;
    // 24시간 캐싱
    this.cache.set(key, content, { ttl: 24 * 60 * 60 * 1000, storage: 'localStorage' });
  }
}

/**
 * 프롬프트 결과 캐싱 (동일 프롬프트 재사용)
 */
export class PromptResultCache {
  private cache: CacheManager;

  constructor() {
    this.cache = new CacheManager('prompt_result');
  }

  /**
   * 프롬프트 해시 생성
   */
  private hashPrompt(prompt: string): string {
    // 간단한 해시 (실제로는 더 복잡한 해시 사용 권장)
    let hash = 0;
    for (let i = 0; i < prompt.length; i++) {
      const char = prompt.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 캐시된 결과 가져오기
   */
  get(prompt: string): string | null {
    const key = this.hashPrompt(prompt);
    return this.cache.get<string>(key, { storage: 'localStorage' });
  }

  /**
   * 결과 캐싱
   */
  set(prompt: string, result: string, ttlHours: number = 12): void {
    const key = this.hashPrompt(prompt);
    this.cache.set(key, result, {
      ttl: ttlHours * 60 * 60 * 1000,
      storage: 'localStorage'
    });
  }
}

/**
 * 글로벌 캐시 인스턴스
 */
export const contentCache = new ContentCacheManager();
export const similarContentCache = new SimilarContentCache();
export const promptResultCache = new PromptResultCache();

/**
 * 캐시 활용 통계
 */
export function getCacheStatistics(): {
  structureCache: number;
  similarCache: number;
  promptCache: number;
  totalSaved: number; // 예상 절약 토큰
} {
  const stats = contentCache.getStats();

  // 캐시 히트당 평균 1000 토큰 절약 가정
  const estimatedTokensSaved = stats.memorySize * 1000;

  return {
    structureCache: stats.memorySize,
    similarCache: stats.localStorageSize,
    promptCache: stats.localStorageSize,
    totalSaved: estimatedTokensSaved
  };
}
