/**
 * 자동 백업 시스템
 * - IndexedDB 저장
 * - 자동 복구
 */

interface BackupData {
  data: any;
  timestamp: number;
  version: string;
  sessionId: string;
}

export class AutoBackup {
  private dbName = 'HospitalAI';
  private storeName = 'backups';
  private interval: number = 30000; // 30초
  private timerId: NodeJS.Timeout | null = null;
  private db: IDBDatabase | null = null;

  async init() {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'timestamp' });
        }
      };
    });
  }

  start(getData: () => any) {
    this.stop();
    
    this.timerId = setInterval(async () => {
      try {
        const data = getData();
        await this.save(data);
        console.log('[AutoBackup] Saved');
      } catch (error) {
        console.error('[AutoBackup] Failed:', error);
      }
    }, this.interval);
  }

  stop() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  async save(data: any) {
    if (!this.db) await this.init();
    
    const backup: BackupData = {
      data,
      timestamp: Date.now(),
      version: '1.0',
      sessionId: this.getSessionId(),
    };

    return new Promise<void>((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(backup);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async restore(): Promise<any | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.openCursor(null, 'prev'); // 최신 것부터

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const backup = cursor.value as BackupData;
          resolve(backup.data);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  private getSessionId(): string {
    let sessionId = sessionStorage.getItem('hospitalai_session_id');
    if (!sessionId) {
      sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('hospitalai_session_id', sessionId);
    }
    return sessionId;
  }

  async clear() {
    if (!this.db) await this.init();

    return new Promise<void>((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const autoBackup = new AutoBackup();
