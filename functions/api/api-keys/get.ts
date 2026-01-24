// Cloudflare Pages Function - API Keys Get
// 공유 API 키 조회 (KV Storage 우선, 환경 변수 폴백)

interface Env {
  API_KEYS: KVNamespace;
  GEMINI_API_KEY?: string;
  OPENAI_API_KEY?: string;
}

export async function onRequestGet(context: { env: Env }) {
  const { env } = context;
  
  try {
    // KV에서 먼저 읽기 (동적으로 저장된 키)
    const geminiFromKV = await env.API_KEYS?.get('GEMINI_API_KEY');
    const openaiFromKV = await env.API_KEYS?.get('OPENAI_API_KEY');
    
    // KV 값이 없으면 환경 변수 폴백
    const geminiKey = geminiFromKV || env.GEMINI_API_KEY || null;
    const openaiKey = openaiFromKV || env.OPENAI_API_KEY || null;
    
    return new Response(
      JSON.stringify({
        success: true,
        apiKeys: {
          gemini: geminiKey,
          openai: openaiKey
        }
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      }
    );
  } catch (error) {
    console.error('❌ API 키 조회 오류:', error);
    
    // 에러 발생 시 환경 변수만 반환
    return new Response(
      JSON.stringify({
        success: true,
        apiKeys: {
          gemini: env.GEMINI_API_KEY || null,
          openai: env.OPENAI_API_KEY || null
        }
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
}

// OPTIONS preflight
export async function onRequestOptions() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
