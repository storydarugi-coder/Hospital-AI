/**
 * Google Custom Search API
 * Cloudflare Pages Functions
 */

interface Env {
  GOOGLE_API_KEY: string;
  GOOGLE_SEARCH_ENGINE_ID: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { query, num = 10 } = await context.request.json() as {
      query: string;
      num?: number;
    };

    if (!query) {
      return new Response(JSON.stringify({ error: '검색어를 입력해주세요.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 구글 API 키 가져오기
    const apiKey = context.env.GOOGLE_API_KEY;
    const searchEngineId = context.env.GOOGLE_SEARCH_ENGINE_ID;

    console.log('🔍 검색 요청:', {
      query,
      num,
      hasApiKey: !!apiKey,
      hasSearchEngineId: !!searchEngineId,
    });

    if (!apiKey || !searchEngineId) {
      console.error('❌ 환경 변수 누락:', {
        apiKey: apiKey ? '설정됨' : '없음',
        searchEngineId: searchEngineId ? '설정됨' : '없음',
      });
      
      return new Response(JSON.stringify({ 
        error: '구글 API 키가 설정되지 않았습니다.',
        details: {
          GOOGLE_API_KEY: apiKey ? '설정됨' : '없음',
          GOOGLE_SEARCH_ENGINE_ID: searchEngineId ? '설정됨' : '없음'
        }
      }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
      });
    }

    // Google Custom Search API 호출
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}&num=${num}`;
    
    const response = await fetch(searchUrl);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('구글 API 오류:', response.status, errorText);
      
      // 더 자세한 에러 메시지 반환
      return new Response(JSON.stringify({ 
        error: `구글 API 오류: ${response.status}`,
        details: errorText,
        query,
        searchEngineId: searchEngineId ? '설정됨' : '미설정'
      }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
      });
    }

    const result = await response.json();

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: any) {
    console.error('구글 검색 오류:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// OPTIONS 요청 처리 (CORS)
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
};
