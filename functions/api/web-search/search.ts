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

    if (!apiKey || !searchEngineId) {
      return new Response(JSON.stringify({ error: '구글 API 키가 설정되지 않았습니다.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Google Custom Search API 호출
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}&num=${num}`;
    
    const response = await fetch(searchUrl);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('구글 API 오류:', response.status, errorText);
      throw new Error(`구글 API 오류: ${response.status}`);
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
