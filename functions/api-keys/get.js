// GET /api-keys/get - API 키 조회
export const onRequestGet = async (context) => {
  try {
    const geminiKey = await context.env.API_KEYS.get('gemini');
    const openaiKey = await context.env.API_KEYS.get('openai');

    return new Response(JSON.stringify({
      success: true,
      apiKeys: {
        gemini: geminiKey,
        openai: openaiKey
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
      success: false,
      error: '서버 오류가 발생했습니다.'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  }
};

// OPTIONS - CORS Preflight
export const onRequestOptions = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
};
