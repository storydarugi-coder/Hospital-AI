// Cloudflare Pages Function - Stats
export async function onRequestGet(context: any) {
  const { env } = context;
  
  try {
    const CONTENT_KV = env.CONTENT_STORAGE;
    if (!CONTENT_KV) {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            totalContents: 0,
            byPostType: {
              blog: 0,
              card_news: 0,
              press_release: 0
            },
            byCategory: {}
          }
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
    
    // 통계 계산
    const stats: any = {
      totalContents: contents.length,
      byPostType: {
        blog: contents.filter((c: any) => c.postType === 'blog').length,
        card_news: contents.filter((c: any) => c.postType === 'card_news').length,
        press_release: contents.filter((c: any) => c.postType === 'press_release').length
      },
      byCategory: {}
    };
    
    // 카테고리별 통계
    contents.forEach((c: any) => {
      stats.byCategory[c.category] = (stats.byCategory[c.category] || 0) + 1;
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        data: stats
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
