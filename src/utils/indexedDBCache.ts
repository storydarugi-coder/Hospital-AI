/**
 * IndexedDB 기반 영구 캐시 시스템
 * - 대용량 데이터 저장 (이미지, 생성된 콘텐츠 등)
 * - 오프라인 지원
 * - TTL (Time To Live) 지원
 * - 자동 정리 (스토리지 용량 관리)
 */

const DB_NAME = 'HospitalAI_Cache';
const DB_VERSION = 1;

// 스토어 이름
const STORES = {
  CONTENT: 'content',      // 생성된 콘텐츠
  IMAGES: 'images',        // 이미지 데이터
  API_CACHE: 'api_cache',  // API 응답 캐시
  SETTINGS: 'settings',    // 사용자 설정
} as const;

export interface CacheEntry<T = any> {
  key: string;
  data: T;
  createdAt: number;
  expiresAt: number;
  size?: number;        // 대략적인 데이터 크기 (bytes)
  category?: string;    // 카테고리 (검색/필터용)
}

export interface CacheOptions {
  ttl?: number;         // milliseconds (기본 24시간)
  category?: string;    // 카테고리
  maxSize?: number;     // 최대 데이터 크기 제한 (bytes)
}

class IndexedDBCache {
  private db: IDBDatabase | null = null;
  private dbReady: Promise<IDBDatabase>;

  constructor() {
    this.dbReady = this.initDB();
  }

  /**
   * IndexedDB 초기화
   */
  private initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB not supported'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('IndexedDB open error:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ IndexedDB 초기화 완료');
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // content 스토어 생성
        if (!db.objectStoreNames.contains(STORES.CONTENT)) {
          const contentStore = db.createObjectStore(STORES.CONTENT, { keyPath: 'key' });
          contentStore.createIndex('expiresAt', 'expiresAt', { unique: false });
          contentStore.createIndex('category', 'category', { unique: false });
          contentStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // images 스토어 생성
        if (!db.objectStoreNames.contains(STORES.IMAGES)) {
          const imagesStore = db.createObjectStore(STORES.IMAGES, { keyPath: 'key' });
          imagesStore.createIndex('expiresAt', 'expiresAt', { unique: false });
          imagesStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // api_cache 스토어 생성
        if (!db.objectStoreNames.contains(STORES.API_CACHE)) {
          const apiStore = db.createObjectStore(STORES.API_CACHE, { keyPath: 'key' });
          apiStore.createIndex('expiresAt', 'expiresAt', { unique: false });
        }

        // settings 스토어 생성
        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
        }

        console.log('📦 IndexedDB 스토어 생성 완료');
      };
    });
  }

  /**
   * DB 연결 확인
   */
  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    return this.dbReady;
  }

  /**
   * 데이터 크기 추정 (bytes)
   */
  private estimateSize(data: any): number {
    try {
      const json = JSON.stringify(data);
      return new Blob([json]).size;
    } catch {
      return 0;
    }
  }

  /**
   * 데이터 저장
   */
  async set<T>(
    storeName: string,
    key: string,
    data: T,
    options: CacheOptions = {}
  ): Promise<void> {
    const { ttl = 24 * 60 * 60 * 1000, category } = options; // 기본 24시간

    try {
      const db = await this.getDB();
      const now = Date.now();

      const entry: CacheEntry<T> = {
        key,
        data,
        createdAt: now,
        expiresAt: now + ttl,
        size: this.estimateSize(data),
        category,
      };

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(entry);

        request.onsuccess = () => {
          console.log(`✅ IndexedDB 저장: ${storeName}/${key}`);
          resolve();
        };

        request.onerror = () => {
          console.error(`❌ IndexedDB 저장 실패: ${storeName}/${key}`, request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('IndexedDB set error:', error);
      throw error;
    }
  }

  /**
   * 데이터 가져오기
   */
  async get<T>(storeName: string, key: string): Promise<T | null> {
    try {
      const db = await this.getDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);

        request.onsuccess = () => {
          const entry = request.result as CacheEntry<T> | undefined;

          if (!entry) {
            resolve(null);
            return;
          }

          // 만료 확인
          if (Date.now() > entry.expiresAt) {
            console.log(`⏰ IndexedDB 만료: ${storeName}/${key}`);
            this.delete(storeName, key); // 비동기 삭제
            resolve(null);
            return;
          }

          console.log(`✅ IndexedDB 히트: ${storeName}/${key}`);
          resolve(entry.data);
        };

        request.onerror = () => {
          console.error(`❌ IndexedDB 읽기 실패: ${storeName}/${key}`, request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('IndexedDB get error:', error);
      return null;
    }
  }

  /**
   * 데이터 삭제
   */
  async delete(storeName: string, key: string): Promise<void> {
    try {
      const db = await this.getDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('IndexedDB delete error:', error);
    }
  }

  /**
   * 스토어 전체 삭제
   */
  async clearStore(storeName: string): Promise<void> {
    try {
      const db = await this.getDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => {
          console.log(`🗑️ IndexedDB 스토어 삭제: ${storeName}`);
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('IndexedDB clear error:', error);
    }
  }

  /**
   * 만료된 데이터 정리
   */
  async cleanup(storeName: string): Promise<number> {
    try {
      const db = await this.getDB();
      const now = Date.now();
      let deletedCount = 0;

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const index = store.index('expiresAt');

        // 만료된 항목 범위 검색
        const range = IDBKeyRange.upperBound(now);
        const request = index.openCursor(range);

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
          
          if (cursor) {
            cursor.delete();
            deletedCount++;
            cursor.continue();
          } else {
            console.log(`🧹 IndexedDB 정리: ${storeName}에서 ${deletedCount}개 삭제`);
            resolve(deletedCount);
          }
        };

        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('IndexedDB cleanup error:', error);
      return 0;
    }
  }

  /**
   * 모든 스토어 정리
   */
  async cleanupAll(): Promise<void> {
    for (const storeName of Object.values(STORES)) {
      await this.cleanup(storeName);
    }
  }

  /**
   * 스토어 통계
   */
  async getStats(storeName: string): Promise<{
    count: number;
    totalSize: number;
    oldestEntry: number | null;
    newestEntry: number | null;
  }> {
    try {
      const db = await this.getDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const countRequest = store.count();
        const allRequest = store.getAll();

        allRequest.onsuccess = () => {
          const entries = allRequest.result as CacheEntry[];
          
          let totalSize = 0;
          let oldest = Infinity;
          let newest = 0;

          entries.forEach(entry => {
            totalSize += entry.size || 0;
            if (entry.createdAt < oldest) oldest = entry.createdAt;
            if (entry.createdAt > newest) newest = entry.createdAt;
          });

          resolve({
            count: entries.length,
            totalSize,
            oldestEntry: entries.length > 0 ? oldest : null,
            newestEntry: entries.length > 0 ? newest : null,
          });
        };

        allRequest.onerror = () => reject(allRequest.error);
      });
    } catch (error) {
      console.error('IndexedDB stats error:', error);
      return { count: 0, totalSize: 0, oldestEntry: null, newestEntry: null };
    }
  }

  /**
   * 전체 DB 통계
   */
  async getAllStats(): Promise<Record<string, {
    count: number;
    totalSize: number;
  }>> {
    const result: Record<string, { count: number; totalSize: number }> = {};

    for (const storeName of Object.values(STORES)) {
      const stats = await this.getStats(storeName);
      result[storeName] = {
        count: stats.count,
        totalSize: stats.totalSize,
      };
    }

    return result;
  }

  /**
   * 카테고리별 데이터 가져오기
   */
  async getByCategory<T>(storeName: string, category: string): Promise<T[]> {
    try {
      const db = await this.getDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const index = store.index('category');
        const request = index.getAll(category);

        request.onsuccess = () => {
          const entries = request.result as CacheEntry<T>[];
          const now = Date.now();
          
          // 만료되지 않은 항목만 반환
          const validEntries = entries
            .filter(entry => now < entry.expiresAt)
            .map(entry => entry.data);

          resolve(validEntries);
        };

        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('IndexedDB getByCategory error:', error);
      return [];
    }
  }
}

// 싱글톤 인스턴스
export const indexedDBCache = new IndexedDBCache();

// 편의 함수들
export const ContentCache = {
  async save(key: string, content: any, category?: string) {
    return indexedDBCache.set(STORES.CONTENT, key, content, { 
      ttl: 7 * 24 * 60 * 60 * 1000, // 7일
      category 
    });
  },
  async get<T>(key: string) {
    return indexedDBCache.get<T>(STORES.CONTENT, key);
  },
  async getByCategory<T>(category: string) {
    return indexedDBCache.getByCategory<T>(STORES.CONTENT, category);
  },
  async delete(key: string) {
    return indexedDBCache.delete(STORES.CONTENT, key);
  },
  async clear() {
    return indexedDBCache.clearStore(STORES.CONTENT);
  },
};

export const ImageCache = {
  async save(key: string, imageData: string) {
    return indexedDBCache.set(STORES.IMAGES, key, imageData, {
      ttl: 30 * 24 * 60 * 60 * 1000, // 30일
    });
  },
  async get(key: string) {
    return indexedDBCache.get<string>(STORES.IMAGES, key);
  },
  async delete(key: string) {
    return indexedDBCache.delete(STORES.IMAGES, key);
  },
  async clear() {
    return indexedDBCache.clearStore(STORES.IMAGES);
  },
};

export const ApiCache = {
  async save(endpoint: string, response: any, ttl = 60 * 60 * 1000) { // 기본 1시간
    return indexedDBCache.set(STORES.API_CACHE, endpoint, response, { ttl });
  },
  async get<T>(endpoint: string) {
    return indexedDBCache.get<T>(STORES.API_CACHE, endpoint);
  },
  async delete(endpoint: string) {
    return indexedDBCache.delete(STORES.API_CACHE, endpoint);
  },
  async clear() {
    return indexedDBCache.clearStore(STORES.API_CACHE);
  },
};

export const SettingsCache = {
  async save(key: string, value: any) {
    return indexedDBCache.set(STORES.SETTINGS, key, value, {
      ttl: 365 * 24 * 60 * 60 * 1000, // 1년
    });
  },
  async get<T>(key: string) {
    return indexedDBCache.get<T>(STORES.SETTINGS, key);
  },
  async delete(key: string) {
    return indexedDBCache.delete(STORES.SETTINGS, key);
  },
};

// 자동 정리 (24시간마다)
if (typeof window !== 'undefined') {
  // 페이지 로드 시 정리
  setTimeout(() => {
    indexedDBCache.cleanupAll().catch(console.error);
  }, 5000);

  // 24시간마다 정리
  setInterval(() => {
    indexedDBCache.cleanupAll().catch(console.error);
  }, 24 * 60 * 60 * 1000);
}

export default indexedDBCache;
