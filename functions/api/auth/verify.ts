// Cloudflare Pages Function - Password Verification
// 공유 앱 비밀번호 확인

const APP_PASSWORD = '0000';

interface VerifyRequest {
  password: string;
}

export async function onRequestPost(context: { request: Request }) {
  const { request } = context;

  try {
    const body = await request.json() as VerifyRequest;
    const { password } = body;

    if (!password) {
      return new Response(
        JSON.stringify({
          success: false,
          error: '비밀번호를 입력해주세요.'
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    if (password === APP_PASSWORD) {
      console.log('✅ 비밀번호 인증 성공');
      return new Response(
        JSON.stringify({
          success: true,
          message: '인증 성공'
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    } else {
      console.log('❌ 비밀번호 인증 실패');
      return new Response(
        JSON.stringify({
          success: false,
          error: '비밀번호가 올바르지 않습니다.'
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  } catch (error) {
    console.error('❌ 인증 오류:', error);
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
