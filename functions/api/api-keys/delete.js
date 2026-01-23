// DELETE /api-keys/delete - API 키 삭제
export const onRequestDelete = async (context) => {
  try {
    const url = new URL(context.request.url);
    const type = url.searchParams.get('type'); // 'gemini' or 'openai'

    if (type === 'gemini') {
      await context.env.API_KEYS.delete('gemini');
      console.log('🗑️ Gemini API 키 삭제 완료');
      return new Response(JSON.stringify({
        success: true,
        message: 'Gemini API 키가 삭제되었습니다.'
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    } else if (type === 'openai') {
      await context.env.API_KEYS.delete('openai');
      console.log('🗑️ OpenAI API 키 삭제 완료');
      return new Response(JSON.stringify({
        success: true,
        message: 'OpenAI API 키가 삭제되었습니다.'
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    } else if (!type) {
      // 모든 키 삭제
      await context.env.API_KEYS.delete('gemini');
      await context.env.API_KEYS.delete('openai');
      console.log('🗑️ 모든 API 키 삭제 완료');
      return new Response(JSON.stringify({
        success: true,
        message: '모든 API 키가 삭제되었습니다.'
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: '올바른 키 타입을 지정해주세요. (gemini, openai)'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }
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
      'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
};
