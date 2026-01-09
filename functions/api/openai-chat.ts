/**
 * Cloudflare Pages Function: OpenAI Chat API Proxy
 * 
 * CORS 문제 해결을 위한 프록시 엔드포인트
 * 브라우저 → 이 함수 → OpenAI API
 */

interface Env {
  OPENAI_API_KEY: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  // CORS 헤더 설정
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };

  // Preflight 요청 처리
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders,
    });
  }

  try {
    // 요청 본문 파싱
    const body = await request.json();
    
    // API 키 가져오기 (환경변수 우선, 없으면 요청 헤더에서)
    const apiKey = env.OPENAI_API_KEY || request.headers.get('X-OpenAI-Key');
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key is required' }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    console.log('🔵 Proxying request to OpenAI API...');
    console.log('📦 Request body:', JSON.stringify(body, null, 2));

    // OpenAI API 호출
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const responseData = await openaiResponse.json();

    if (!openaiResponse.ok) {
      console.error('❌ OpenAI API Error:', responseData);
      return new Response(
        JSON.stringify(responseData),
        {
          status: openaiResponse.status,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    console.log('✅ OpenAI API Success');
    
    // 성공 응답 반환
    return new Response(
      JSON.stringify(responseData),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('❌ Proxy Error:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
};
