// POST /content/save - 콘텐츠 저장
export const onRequestPost: PagesFunction<{ CONTENT_KV: KVNamespace }> = async (context) => {
  try {
    const { title, content, category, postType, metadata } = await context.request.json();

    // 유효성 검사
    if (!title || !content || !category || !postType) {
      return new Response(JSON.stringify({
        success: false,
        error: '필수 필드가 누락되었습니다. (title, content, category, postType)'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }

    // ID 생성 (타임스탬프 기반)
    const id = Date.now().toString();

    // 콘텐츠 객체 생성
    const newContent = {
      id,
      title,
      content,
      category,
      postType,
      metadata: metadata || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // KV에 콘텐츠 저장
    await context.env.CONTENT_KV.put(`content:${id}`, JSON.stringify(newContent));

    // 콘텐츠 ID 목록에 추가
    const listKey = 'content:list';
    const existingList = await context.env.CONTENT_KV.get(listKey);
    const contentIds = existingList ? JSON.parse(existingList) : [];
    contentIds.unshift(id); // 최신 항목을 앞에 추가
    await context.env.CONTENT_KV.put(listKey, JSON.stringify(contentIds));

    console.log(`✅ 콘텐츠 저장 완료 - ID: ${id}, 제목: ${title}`);

    return new Response(JSON.stringify({
      success: true,
      id,
      message: '콘텐츠가 성공적으로 저장되었습니다.'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  } catch (error) {
    console.error('❌ 콘텐츠 저장 오류:', error);
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
