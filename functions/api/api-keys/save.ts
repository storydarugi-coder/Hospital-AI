// Cloudflare Pages Function - API Keys Save
// 공유 API 키 저장 (KV Storage 사용)

interface Env {
  API_KEYS: KVNamespace;
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;

  try {
    const body = await request.json() as { geminiKey?: string; openaiKey?: string };
    const { geminiKey, openaiKey } = body;

    // KV에 저장
    if (geminiKey !== undefined) {
      await env.API_KEYS.put('GEMINI_API_KEY', geminiKey);
      console.log('✅ Gemini API 키 저장 완료');
    }

    if (openaiKey !== undefined) {
      await env.API_KEYS.put('OPENAI_API_KEY', openaiKey);
      console.log('✅ OpenAI API 키 저장 완료');
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'API 키가 저장되었습니다.',
        saved: {
          gemini: geminiKey !== undefined,
          openai: openaiKey !== undefined
        }
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      }
    );
  } catch (error) {
    console.error('❌ API 키 저장 오류:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: '서버 오류가 발생했습니다.'
      }),
      {
        status: 500,
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
