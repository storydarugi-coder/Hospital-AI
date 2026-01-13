// GET /content/:id - 콘텐츠 상세 조회
// DELETE /content/:id - 콘텐츠 삭제

export const onRequestGet: PagesFunction<{ CONTENT_KV: KVNamespace }> = async (context) => {
  try {
    const id = context.params.id as string;

    if (!id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'ID가 필요합니다.'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }

    const contentStr = await context.env.CONTENT_KV.get(`content:${id}`);

    if (!contentStr) {
      return new Response(JSON.stringify({
        success: false,
        error: '콘텐츠를 찾을 수 없습니다.'
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }

    const content = JSON.parse(contentStr);

    return new Response(JSON.stringify({
      success: true,
      content
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  } catch (error) {
    console.error('❌ 콘텐츠 조회 오류:', error);
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

export const onRequestDelete: PagesFunction<{ CONTENT_KV: KVNamespace }> = async (context) => {
  try {
    const id = context.params.id as string;

    if (!id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'ID가 필요합니다.'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }

    // 콘텐츠 존재 확인
    const contentStr = await context.env.CONTENT_KV.get(`content:${id}`);
    if (!contentStr) {
      return new Response(JSON.stringify({
        success: false,
        error: '콘텐츠를 찾을 수 없습니다.'
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }

    // 콘텐츠 삭제
    await context.env.CONTENT_KV.delete(`content:${id}`);

    // 목록에서도 제거
    const listKey = 'content:list';
    const existingList = await context.env.CONTENT_KV.get(listKey);
    if (existingList) {
      const contentIds = JSON.parse(existingList);
      const updatedIds = contentIds.filter((cid: string) => cid !== id);
      await context.env.CONTENT_KV.put(listKey, JSON.stringify(updatedIds));
    }

    console.log(`🗑️ 콘텐츠 삭제 완료 - ID: ${id}`);

    return new Response(JSON.stringify({
      success: true,
      message: '콘텐츠가 삭제되었습니다.'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  } catch (error) {
    console.error('❌ 콘텐츠 삭제 오류:', error);
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
      'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
};
