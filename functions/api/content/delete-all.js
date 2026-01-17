// DELETE /content/delete-all - 모든 콘텐츠 삭제
export const onRequestDelete = async (context) => {
  try {
    // 콘텐츠 목록 가져오기
    const listKey = 'content:list';
    const existingList = await context.env.CONTENT_KV.get(listKey);
    const contentIds = existingList ? JSON.parse(existingList) : [];

    // 각 콘텐츠 삭제
    let deletedCount = 0;
    for (const id of contentIds) {
      try {
        await context.env.CONTENT_KV.delete(`content:${id}`);
        deletedCount++;
      } catch (e) {
        console.warn(`콘텐츠 ${id} 삭제 실패:`, e);
      }
    }

    // 목록 초기화
    await context.env.CONTENT_KV.put(listKey, JSON.stringify([]));

    console.log(`🗑️ 모든 콘텐츠 삭제 완료 - 삭제된 개수: ${deletedCount}`);

    return new Response(JSON.stringify({
      success: true,
      deletedCount,
      message: `${deletedCount}개의 콘텐츠가 삭제되었습니다.`
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
