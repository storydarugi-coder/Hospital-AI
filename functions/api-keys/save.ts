// POST /api-keys/save - API 키 저장
export const onRequestPost: PagesFunction<{ API_KEYS: KVNamespace }> = async (context) => {
  try {
    const { geminiKey, openaiKey } = await context.request.json();

    const saved: Record<string, boolean> = {};

    if (geminiKey) {
      await context.env.API_KEYS.put('gemini', geminiKey);
      saved.gemini = true;
      console.log('✅ Gemini API 키 저장 완료');
    }

    if (openaiKey) {
      await context.env.API_KEYS.put('openai', openaiKey);
      saved.openai = true;
      console.log('✅ OpenAI API 키 저장 완료');
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'API 키가 저장되었습니다.',
      saved
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
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
};
