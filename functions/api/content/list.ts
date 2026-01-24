// Cloudflare Pages Function - Content List
export async function onRequestGet(context: any) {
  const { env, request } = context;
  
  try {
    // KV에서 콘텐츠 목록 가져오기
    const CONTENT_KV = env.CONTENT_STORAGE;
    if (!CONTENT_KV) {
      return new Response(
        JSON.stringify({
          success: true,
          data: [],
          pagination: { total: 0, limit: 50, offset: 0 }
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
    
    // 콘텐츠 목록 조회
    const contentListJson = await CONTENT_KV.get('content_list');
    const contents = contentListJson ? JSON.parse(contentListJson) : [];
    
    // 쿼리 파라미터
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const postType = url.searchParams.get('postType');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    
    // 필터링
    let filteredContents = [...contents];
    if (category) {
      filteredContents = filteredContents.filter((c: any) => c.category === category);
    }
    if (postType) {
      filteredContents = filteredContents.filter((c: any) => c.postType === postType);
    }
    
    // 최신순 정렬
    filteredContents.sort((a: any, b: any) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    // 페이지네이션
    const total = filteredContents.length;
    const paginatedContents = filteredContents.slice(offset, offset + limit);
    
    return new Response(
      JSON.stringify({
        success: true,
        data: paginatedContents,
        pagination: { total, limit, offset }
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      }
    );
  } catch (error) {
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
