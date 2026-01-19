/**
 * 네이버 블로그 검색 API
 * Cloudflare Pages Functions
 */

interface Env {
  NAVER_CLIENT_ID: string;
  NAVER_CLIENT_SECRET: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { query, display = 10 } = await context.request.json() as {
      query: string;
      display?: number;
    };

    if (!query) {
      return new Response(JSON.stringify({ error: '검색어를 입력해주세요.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 네이버 검색 API 키 가져오기
    const clientId = context.env.NAVER_CLIENT_ID;
    const clientSecret = context.env.NAVER_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return new Response(JSON.stringify({ error: '네이버 API 키가 설정되지 않았습니다.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 네이버 블로그 검색 API 호출
    const searchUrl = `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(query)}&display=${display}&sort=sim`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
    });

    if (!response.ok) {
      throw new Error(`네이버 API 오류: ${response.status}`);
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
    console.error('네이버 검색 오류:', error);
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
