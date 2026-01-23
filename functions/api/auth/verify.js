// POST /auth/verify - 비밀번호 인증
export const onRequestPost = async (context) => {
  try {
    const { password } = await context.request.json();

    if (!password) {
      return new Response(JSON.stringify({
        success: false,
        error: '비밀번호를 입력해주세요.'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }

    const APP_PASSWORD = context.env.APP_PASSWORD || '0000';

    if (password === APP_PASSWORD) {
      return new Response(JSON.stringify({
        success: true,
        message: '인증 성공'
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
        error: '비밀번호가 올바르지 않습니다.'
      }), {
        status: 401,
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
};
