import { Hono } from 'hono'

type Bindings = {
  GEMINI_API_KEY?: string;
  NAVER_CLIENT_ID?: string;
  NAVER_CLIENT_SECRET?: string;
  PORTONE_STORE_ID?: string;
  PORTONE_CHANNEL_KEY?: string;
}

const app = new Hono<{ Bindings: Bindings }>()

// API routes
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// 환경변수에서 API 키 가져오기 (서버 → 클라이언트)
app.get('/api/config', (c) => {
  const config = {
    geminiKey: c.env.GEMINI_API_KEY || '',
    naverClientId: c.env.NAVER_CLIENT_ID || '',
    naverClientSecret: c.env.NAVER_CLIENT_SECRET || '',
  }
  return c.json(config)
})

// 네이버 검색 API - 실시간 뉴스 트렌드
app.get('/api/naver/news', async (c) => {
  const query = c.req.query('query') || '건강';
  const display = c.req.query('display') || '20';
  const sort = c.req.query('sort') || 'date'; // date: 최신순, sim: 정확도순
  
  const clientId = c.env.NAVER_CLIENT_ID;
  const clientSecret = c.env.NAVER_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    return c.json({ error: '네이버 API 인증 정보가 설정되지 않았습니다.' }, 401);
  }
  
  try {
    const response = await fetch(
      `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(query)}&display=${display}&sort=${sort}`,
      {
        headers: {
          'X-Naver-Client-Id': clientId,
          'X-Naver-Client-Secret': clientSecret,
        },
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      return c.json({ error: `네이버 API 오류: ${response.status}`, details: errorText }, response.status);
    }
    
    const data = await response.json();
    return c.json(data);
  } catch (error) {
    return c.json({ error: '네이버 API 호출 실패', details: String(error) }, 500);
  }
})

// 네이버 검색 API - 블로그 검색 (경쟁도 분석용)
app.get('/api/naver/blog', async (c) => {
  const query = c.req.query('query') || '건강';
  const display = c.req.query('display') || '10';
  
  const clientId = c.env.NAVER_CLIENT_ID;
  const clientSecret = c.env.NAVER_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    return c.json({ error: '네이버 API 인증 정보가 설정되지 않았습니다.' }, 401);
  }
  
  try {
    const response = await fetch(
      `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(query)}&display=${display}`,
      {
        headers: {
          'X-Naver-Client-Id': clientId,
          'X-Naver-Client-Secret': clientSecret,
        },
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      return c.json({ error: `네이버 API 오류: ${response.status}`, details: errorText }, response.status);
    }
    
    const data = await response.json();
    return c.json(data);
  } catch (error) {
    return c.json({ error: '네이버 API 호출 실패', details: String(error) }, 500);
  }
})

// Main HTML page
app.get('*', (c) => {
  // 환경변수를 HTML에 직접 주입
  const geminiKey = c.env.GEMINI_API_KEY || '';
  const naverClientId = c.env.NAVER_CLIENT_ID || '';
  const naverClientSecret = c.env.NAVER_CLIENT_SECRET || '';
  const portoneStoreId = c.env.PORTONE_STORE_ID || '';
  const portoneChannelKey = c.env.PORTONE_CHANNEL_KEY || '';
  
  return c.html(`
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hospital Toolchain - 네이버 블로그 마케팅 전용</title>
    <meta name="description" content="의료광고법을 준수하는 네이버 블로그 콘텐츠 생성 도구">
    <script src="https://cdn.tailwindcss.com"></script>
    <!-- PortOne V2 SDK -->
    <script src="https://cdn.portone.io/v2/browser-sdk.js"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap" rel="stylesheet">
    <style>
        * {
            font-family: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        .custom-scrollbar::-webkit-scrollbar {
            width: 8px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 100px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .animate-fadeIn {
            animation: fadeIn 0.3s ease-out;
        }
    </style>
</head>
<body class="bg-slate-50">
    <div id="root"></div>
    <script>
      // 서버에서 주입된 API 키를 localStorage에 저장
      (function() {
        const gk = "${geminiKey}";
        const nci = "${naverClientId}";
        const ncs = "${naverClientSecret}";
        const psi = "${portoneStoreId}";
        const pck = "${portoneChannelKey}";
        if (gk) { localStorage.setItem('GEMINI_API_KEY', gk); localStorage.setItem('GLOBAL_GEMINI_API_KEY', gk); }
        if (nci) { localStorage.setItem('NAVER_CLIENT_ID', nci); localStorage.setItem('GLOBAL_NAVER_CLIENT_ID', nci); }
        if (ncs) { localStorage.setItem('NAVER_CLIENT_SECRET', ncs); localStorage.setItem('GLOBAL_NAVER_CLIENT_SECRET', ncs); }
        if (psi) { localStorage.setItem('PORTONE_STORE_ID', psi); }
        if (pck) { localStorage.setItem('PORTONE_CHANNEL_KEY', pck); }
      })();
    </script>
    <script type="module" src="/static/client.js"></script>
</body>
</html>
  `)
})

export default app
