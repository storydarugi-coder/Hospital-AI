// Cloudflare Pages Function
// Path: /api/crawler

interface Env {
  // 환경 변수가 필요하면 여기 정의
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const { url } = await context.request.json();
    
    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('🕷️ Crawling:', url);

    // 네이버 블로그인 경우 PostView URL로 변환
    let fetchUrl = url;
    const naverBlogMatch = url.match(/https:\/\/blog\.naver\.com\/([^\/]+)\/(\d+)/);
    
    if (naverBlogMatch) {
      const [, blogId, logNo] = naverBlogMatch;
      fetchUrl = `https://blog.naver.com/PostView.naver?blogId=${blogId}&logNo=${logNo}`;
      console.log('📝 네이버 블로그 PostView URL:', fetchUrl);
    }

    // URL 가져오기
    const response = await fetch(fetchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://blog.naver.com/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch URL', status: response.status }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const html = await response.text();
    
    // HTML에서 텍스트 추출
    let textContent = '';
    
    if (naverBlogMatch) {
      // 네이버 블로그: se-text-paragraph 클래스에서 본문 추출
      const paragraphPattern = /<[^>]*class="[^"]*se-text-paragraph[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/g;
      const paragraphs: string[] = [];
      let match;
      
      while ((match = paragraphPattern.exec(html)) !== null) {
        let text = match[1];
        // HTML 태그 제거
        text = text
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/\s+/g, ' ')
          .trim();
        
        if (text.length > 10) {
          paragraphs.push(text);
        }
      }
      
      textContent = paragraphs.join('\n\n');
      console.log(`✅ 네이버 블로그 본문 추출: ${paragraphs.length}개 문단, ${textContent.length}자`);
    } else {
      // 일반 웹페이지: 기존 방식
      textContent = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      console.log(`✅ 일반 페이지 텍스트 추출: ${textContent.length}자`);
    }
    
    // 최대 10000자로 제한
    textContent = textContent.substring(0, 10000);

    console.log('✅ Crawling success:', textContent.substring(0, 100));

    return new Response(
      JSON.stringify({ content: textContent }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ Crawling error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Crawling failed', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

// CORS preflight
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
