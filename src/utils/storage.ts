/**
 * localStorage 캐싱 래퍼
 * - 메모리 캐시로 localStorage 접근 횟수 감소
 * - 에러 처리 통일
 * - 타입 안정성 강화
 */

class StorageManager {
  private cache = new Map<string, any>();
  
  /**
   * localStorage에서 값 가져오기 (캐시 우선)
   */
  get<T>(key: string): T | null {
    // 캐시에 있으면 캐시에서 반환
    if (this.cache.has(key)) {
      return this.cache.get(key) as T;
    }
    
    try {
      const value = localStorage.getItem(key);
      if (value === null) return null;
      
      const parsed = JSON.parse(value) as T;
      this.cache.set(key, parsed);
      return parsed;
    } catch (error) {
      console.error(`[Storage] Failed to get item "${key}":`, error);
      return null;
    }
  }
  
  /**
   * localStorage에 값 저장 (캐시도 업데이트)
   */
  set<T>(key: string, value: T): boolean {
    try {
      this.cache.set(key, value);
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`[Storage] Failed to set item "${key}":`, error);
      return false;
    }
  }
  
  /**
   * localStorage와 캐시에서 값 제거
   */
  remove(key: string): boolean {
    try {
      this.cache.delete(key);
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`[Storage] Failed to remove item "${key}":`, error);
      return false;
    }
  }
  
  /**
   * localStorage와 캐시 전체 초기화
   */
  clear(): boolean {
    try {
      this.cache.clear();
      localStorage.clear();
      return true;
    } catch (error) {
      console.error('[Storage] Failed to clear storage:', error);
      return false;
    }
  }
  
  /**
   * 캐시만 초기화 (localStorage는 유지)
   */
  clearCache(): void {
    this.cache.clear();
  }
  
  /**
   * 특정 키가 존재하는지 확인
   */
  has(key: string): boolean {
    return this.cache.has(key) || localStorage.getItem(key) !== null;
  }
}

// 싱글톤 인스턴스
export const storage = new StorageManager();
