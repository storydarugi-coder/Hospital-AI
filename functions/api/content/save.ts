// Cloudflare Pages Function - Content Save
export async function onRequestPost(context: any) {
  const { env, request } = context;
  
  try {
    const body = await request.json();
    const { title, content, category, postType, metadata } = body;
    
    // 유효성 검사
    if (!title || !content || !category || !postType) {
      return new Response(
        JSON.stringify({
          success: false,
          error: '필수 필드가 누락되었습니다. (title, content, category, postType)'
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
    
    const CONTENT_KV = env.CONTENT_STORAGE;
    if (!CONTENT_KV) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'KV storage not configured'
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
    
    // 현재 콘텐츠 목록 가져오기
    const contentListJson = await CONTENT_KV.get('content_list');
    const contents = contentListJson ? JSON.parse(contentListJson) : [];
    
    // 새 ID 생성
    const nextIdJson = await CONTENT_KV.get('next_id');
    const nextId = nextIdJson ? parseInt(nextIdJson) : 1;
    
    // 새 콘텐츠 생성
    const newContent = {
      id: nextId,
      title,
      content,
      category,
      postType,
      metadata: metadata || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // 콘텐츠 추가
    contents.push(newContent);
    
    // KV에 저장
    await CONTENT_KV.put('content_list', JSON.stringify(contents));
    await CONTENT_KV.put('next_id', (nextId + 1).toString());
    await CONTENT_KV.put(`content_${nextId}`, JSON.stringify(newContent));
    
    return new Response(
      JSON.stringify({
        success: true,
        id: newContent.id,
        message: '콘텐츠가 성공적으로 저장되었습니다.'
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      }
    );
  } catch (error) {
    console.error('❌ 콘텐츠 저장 오류:', error);
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
