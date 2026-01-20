/**
 * 네이버 검색 결과 페이지를 크롤링해서 블로그 URL 추출
 * (API 키 불필요, 직접 검색 결과 페이지 크롤링)
 */

interface Env {}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { query, maxResults = 50 } = await context.request.json() as {
      query: string;
      maxResults?: number;
    };

    if (!query) {
      return new Response(JSON.stringify({ error: 'Query is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log('🔍 네이버 검색 크롤링:', query, '(최대', maxResults, '개)');

    const blogUrls: Array<{
      title: string;
      link: string;
      description: string;
      bloggername: string;
    }> = [];

    // 네이버 검색 결과는 페이지당 약 10개씩
    const pagesNeeded = Math.ceil(maxResults / 10);

    for (let page = 1; page <= Math.min(pagesNeeded, 5); page++) {
      const start = (page - 1) * 10 + 1;
      const searchUrl = `https://search.naver.com/search.naver?where=blog&query=${encodeURIComponent(
        query
      )}&start=${start}`;

      console.log(`📄 페이지 ${page}/${pagesNeeded} 크롤링 중...`);

      try {
        const response = await fetch(searchUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
          },
        });

        if (!response.ok) {
          console.error('❌ 네이버 검색 페이지 요청 실패:', response.status);
          break;
        }

        const html = await response.text();

        // 블로그 검색 결과 추출 (정규식 사용)
        // 네이버 검색 결과 HTML 구조에서 블로그 링크 추출
        const blogLinkPattern =
          /<a[^>]*class="[^"]*api_txt_lines[^"]*"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g;
        const descPattern = /<a[^>]*class="[^"]*dsc_link[^"]*"[^>]*>([^<]*)<\/a>/g;
        const namePattern = /<a[^>]*class="[^"]*name[^"]*"[^>]*>([^<]*)<\/a>/g;

        let match;
        const pageResults: typeof blogUrls = [];

        // 제목과 링크 추출
        while ((match = blogLinkPattern.exec(html)) !== null) {
          const [, link, title] = match;
          if (
            link &&
            (link.includes('blog.naver.com') ||
              link.includes('tistory.com') ||
              link.includes('brunch.co.kr'))
          ) {
            pageResults.push({
              title: title.trim(),
              link: link,
              description: '',
              bloggername: '',
            });
          }
        }

        // 설명 추가
        let descIndex = 0;
        while ((match = descPattern.exec(html)) !== null && descIndex < pageResults.length) {
          pageResults[descIndex].description = match[1].trim();
          descIndex++;
        }

        // 블로거 이름 추가
        let nameIndex = 0;
        while ((match = namePattern.exec(html)) !== null && nameIndex < pageResults.length) {
          pageResults[nameIndex].bloggername = match[1].trim();
          nameIndex++;
        }

        console.log(`✅ 페이지 ${page}: ${pageResults.length}개 발견`);
        blogUrls.push(...pageResults);

        if (blogUrls.length >= maxResults || pageResults.length === 0) {
          break;
        }

        // 다음 페이지 요청 전 딜레이
        if (page < pagesNeeded) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`❌ 페이지 ${page} 크롤링 에러:`, error);
        break;
      }
    }

    console.log(`📊 총 ${blogUrls.length}개 블로그 URL 추출`);

    return new Response(
      JSON.stringify({
        items: blogUrls.slice(0, maxResults),
        total: blogUrls.length,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('네이버 검색 크롤링 에러:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error.message,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
