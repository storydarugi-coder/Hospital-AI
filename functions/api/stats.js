// GET /stats - 통계 정보
export const onRequestGet = async (context) => {
  try {
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

    // 통계 계산
    const totalContents = allContents.length;
    const byCategory = allContents.reduce((acc, c) => {
      acc[c.category] = (acc[c.category] || 0) + 1;
      return acc;
    }, {});
    const byPostType = allContents.reduce((acc, c) => {
      acc[c.postType] = (acc[c.postType] || 0) + 1;
      return acc;
    }, {});

    return new Response(JSON.stringify({
      success: true,
      stats: {
        totalContents,
        byCategory,
        byPostType,
        lastUpdated: new Date().toISOString()
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  } catch (error) {
    console.error('❌ 통계 조회 오류:', error);
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
