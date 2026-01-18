// Cloudflare Pages Function
// Path: /api/crawler

interface Env {
  // 환경 변수가 필요하면 여기 정의
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const { url } = await context.request.json();
    
    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('🕷️ Crawling:', url);

    // URL 가져오기
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HospitalAI/1.0; +https://hospital-ai.com)',
      },
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch URL', status: response.status }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const html = await response.text();
    
    // HTML에서 텍스트 추출 (간단한 방식)
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // script 태그 제거
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // style 태그 제거
      .replace(/<[^>]+>/g, ' ') // HTML 태그 제거
      .replace(/\s+/g, ' ') // 연속된 공백 제거
      .trim()
      .substring(0, 5000); // 첫 5000자만

    console.log('✅ Crawling success:', textContent.substring(0, 100));

    return new Response(
      JSON.stringify({ content: textContent }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ Crawling error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Crawling failed', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

// CORS preflight
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
