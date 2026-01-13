/**
 * Service Worker for Hospital AI
 * - 오프라인 지원
 * - 캐시 전략
 * - PWA 지원
 */

// 캐시 버전 - 배포 시 자동 업데이트를 위해 타임스탬프 사용
const CACHE_VERSION = 'v2-' + '20260113';
const CACHE_NAME = 'hospitalai-' + CACHE_VERSION;
const RUNTIME_CACHE = 'hospitalai-runtime-' + CACHE_VERSION;

// 캐시할 정적 자원 (해시가 바뀌는 JS/CSS는 제외!)
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
];

// 캐시하지 않을 패턴 (해시가 포함된 빌드 파일)
const NO_CACHE_PATTERNS = [
  /\/assets\/.*\.js$/,
  /\/assets\/.*\.css$/,
];

// Service Worker 설치
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.error('[SW] Cache addAll failed:', err);
      });
    })
  );
  
  // 새 서비스 워커를 즉시 활성화
  self.skipWaiting();
});

// Service Worker 활성화
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  // 즉시 제어권 획득
  return self.clients.claim();
});

// Fetch 이벤트 처리 (캐시 전략)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // 같은 origin만 처리
  if (url.origin !== location.origin) {
    return;
  }
  
  // API 요청은 네트워크 우선
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }
  
  // 정적 자원은 캐시 우선
  event.respondWith(cacheFirst(request));
});

/**
 * 캐시 우선 전략 (Cache First)
 * - 정적 자원에 적합
 * - 해시가 포함된 빌드 파일은 캐시하지 않음
 */
async function cacheFirst(request) {
  const url = new URL(request.url);
  
  // 해시가 포함된 빌드 파일은 항상 네트워크에서 가져옴 (캐시 X)
  const shouldSkipCache = NO_CACHE_PATTERNS.some(pattern => pattern.test(url.pathname));
  if (shouldSkipCache) {
    console.log('[SW] Skip cache for hashed asset:', url.pathname);
    try {
      return await fetch(request);
    } catch (error) {
      console.error('[SW] Network fetch failed for asset:', error);
      throw error;
    }
  }
  
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  
  if (cached) {
    console.log('[SW] Cache hit:', request.url);
    return cached;
  }
  
  try {
    console.log('[SW] Cache miss, fetching:', request.url);
    const response = await fetch(request);
    
    // 성공 응답만 캐시
    if (response.ok) {
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.error('[SW] Fetch failed:', error);
    
    // 오프라인 폴백 페이지
    return new Response(
      `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>오프라인 - Hospital AI</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
            }
            .container {
              text-align: center;
              padding: 40px;
            }
            h1 { font-size: 48px; margin: 0 0 20px; }
            p { font-size: 18px; opacity: 0.9; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>📴 오프라인 모드</h1>
            <p>인터넷 연결을 확인해주세요.</p>
            <p>연결되면 자동으로 복구됩니다.</p>
          </div>
        </body>
      </html>
      `,
      {
        headers: { 'Content-Type': 'text/html' },
      }
    );
  }
}

/**
 * 네트워크 우선 전략 (Network First)
 * - API 요청에 적합
 */
async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  
  try {
    const response = await fetch(request);
    
    // 성공 응답만 캐시
    if (response.ok) {
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    const cached = await cache.match(request);
    
    if (cached) {
      return cached;
    }
    
    // 캐시도 없으면 에러 응답
    return new Response(
      JSON.stringify({
        error: 'Offline',
        message: '인터넷 연결을 확인해주세요.',
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

// 백그라운드 동기화 (추후 구현 가능)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    console.log('[SW] Background sync triggered');
    event.waitUntil(syncData());
  }
});

async function syncData() {
  // TODO: 오프라인 중에 저장된 데이터를 서버와 동기화
  console.log('[SW] Syncing data...');
}

// 푸시 알림 (추후 구현 가능)
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  const data = event.data?.json() || {};
  const title = data.title || 'Hospital AI';
  const options = {
    body: data.body || '새로운 알림이 있습니다.',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
  };
  
  event.waitUntil(self.registration.showNotification(title, options));
});
