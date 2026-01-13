// GET /health - 헬스체크
export async function onRequestGet(context) {
  try {
    const geminiKey = await context.env.API_KEYS.get('gemini');
    const openaiKey = await context.env.API_KEYS.get('openai');

    return new Response(JSON.stringify({
      status: 'ok',
      message: 'Hospital AI API Server is running (Cloudflare Workers)',
      timestamp: new Date().toISOString(),
      apiKeys: {
        gemini: !!geminiKey,
        openai: !!openaiKey
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      status: 'error',
      message: 'Server error occurred'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  }
}

// OPTIONS - CORS Preflight
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
}
