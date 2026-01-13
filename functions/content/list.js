// GET /content/list - 콘텐츠 목록 조회
export const onRequestGet = async (context) => {
  try {
    const url = new URL(context.request.url);
    const category = url.searchParams.get('category');
    const postType = url.searchParams.get('postType');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // 콘텐츠 ID 목록 가져오기
    const listKey = 'content:list';
    const existingList = await context.env.CONTENT_KV.get(listKey);
    const contentIds = existingList ? JSON.parse(existingList) : [];

    // 모든 콘텐츠 가져오기
    const allContents = [];
    for (const id of contentIds) {
      const contentStr = await context.env.CONTENT_KV.get(`content:${id}`);
      if (contentStr) {
        allContents.push(JSON.parse(contentStr));
      }
    }

    // 필터링
    let filteredContents = allContents;
    if (category) {
      filteredContents = filteredContents.filter(c => c.category === category);
    }
    if (postType) {
      filteredContents = filteredContents.filter(c => c.postType === postType);
    }

    // 페이지네이션
    const total = filteredContents.length;
    const paginatedContents = filteredContents.slice(offset, offset + limit);

    return new Response(JSON.stringify({
      success: true,
      contents: paginatedContents,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  } catch (error) {
    console.error('❌ 콘텐츠 목록 조회 오류:', error);
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
