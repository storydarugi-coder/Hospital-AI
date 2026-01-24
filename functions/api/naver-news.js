/**
 * 네이버 뉴스 검색 API 프록시
 * CORS 문제를 해결하기 위한 서버 사이드 프록시
 */

export async function onRequest(context) {
  const { request } = context;
  
  // CORS 헤더
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  
  // OPTIONS 요청 처리 (preflight)
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get('query');
    const display = url.searchParams.get('display') || '10';
    
    if (!query) {
      return new Response(JSON.stringify({ error: 'query parameter required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // 네이버 API 키 (Cloudflare 환경 변수에서 가져오기)
    const NAVER_CLIENT_ID = context.env.NAVER_CLIENT_ID;
    const NAVER_CLIENT_SECRET = context.env.NAVER_CLIENT_SECRET;
    
    if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
      return new Response(JSON.stringify({ 
        error: 'Naver API credentials not configured',
        message: '서버에 네이버 API 키가 설정되지 않았습니다.' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // 네이버 뉴스 검색 API 호출
    const naverUrl = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(query)}&display=${display}&sort=date`;
    
    const response = await fetch(naverUrl, {
      method: 'GET',
      headers: {
        'X-Naver-Client-Id': NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('네이버 API 오류:', response.status, errorText);
      return new Response(JSON.stringify({ 
        error: `Naver API error: ${response.status}`,
        details: errorText 
      }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const data = await response.json();
    
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('프록시 오류:', error);
    return new Response(JSON.stringify({ 
      error: 'Proxy error', 
      message: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
