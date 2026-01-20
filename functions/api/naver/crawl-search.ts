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

    // 현재 날짜와 1년 전 날짜 계산
    const now = new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(now.getFullYear() - 1);

    // 네이버 검색 날짜 포맷: YYYY.MM.DD
    const formatDate = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}.${month}.${day}`;
    };

    const startDate = formatDate(oneYearAgo);
    const endDate = formatDate(now);

    console.log('🔍 네이버 검색 크롤링:', query, '(최대', maxResults, '개)');
    console.log('📅 날짜 필터:', startDate, '~', endDate, '(최근 1년)');

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
      
      // 날짜 필터 추가: &nso=so:r,p:1y (최근 1년) 또는 &ds=startDate&de=endDate
      const searchUrl = `https://search.naver.com/search.naver?where=blog&query=${encodeURIComponent(
        query
      )}&start=${start}&nso=so:r,p:1y`;

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

        // 블로그 검색 결과 추출 (2026년 최신 네이버 구조에 맞게)
        const pageResults: typeof blogUrls = [];

        // 1. 블로그 URL과 제목을 함께 추출
        // <a ... href="https://blog.naver.com/..." ... data-heatmap-target=".link">
        //   <span class="... headline1 ...">제목</span>
        // </a>
        const titleLinkPattern =
          /<a[^>]*href="(https:\/\/(?:blog\.naver\.com|.*?\.tistory\.com|brunch\.co\.kr)\/[^"]*)"[^>]*data-heatmap-target="\.link"[^>]*>[\s\S]*?<span[^>]*headline1[^>]*>([\s\S]*?)<\/span>/g;

        let match;
        while ((match = titleLinkPattern.exec(html)) !== null) {
          const link = match[1];
          let title = match[2];
          
          // HTML 태그 제거 (<mark>, <b> 등)
          title = title
            .replace(/<mark>/g, '')
            .replace(/<\/mark>/g, '')
            .replace(/<b>/g, '')
            .replace(/<\/b>/g, '')
            .replace(/<[^>]*>/g, '')
            .trim();

          if (title && link) {
            pageResults.push({
              title: title,
              link: link,
              description: '',
              bloggername: '',
            });
          }
        }

        // 2. 설명 추출
        // <span class="... body1 ...">설명 텍스트</span>
        const descPattern =
          /<span[^>]*class="[^"]*sds-comps-text[^"]*body1[^"]*"[^>]*>([\s\S]*?)<\/span>/g;
        const descriptions: string[] = [];
        
        while ((match = descPattern.exec(html)) !== null) {
          let desc = match[1];
          // HTML 태그 제거
          desc = desc
            .replace(/<mark>/g, '')
            .replace(/<\/mark>/g, '')
            .replace(/<[^>]*>/g, '')
            .trim();
          
          if (desc.length > 20) { // 최소 길이 체크
            descriptions.push(desc);
          }
        }

        // 설명 할당
        for (let i = 0; i < pageResults.length && i < descriptions.length; i++) {
          pageResults[i].description = descriptions[i];
        }

        // 3. 블로거 이름 추출
        // <span class="... profile-info-title-text ..."><a ...><span ...>블로거명</span></a></span>
        const bloggerPattern =
          /<span[^>]*profile-info-title-text[^>]*>[\s\S]*?<span[^>]*>(.*?)<\/span>[\s\S]*?<\/span>/g;
        const bloggers: string[] = [];
        
        while ((match = bloggerPattern.exec(html)) !== null) {
          const blogger = match[1].trim();
          if (blogger) {
            bloggers.push(blogger);
          }
        }

        // 블로거 이름 할당
        for (let i = 0; i < pageResults.length && i < bloggers.length; i++) {
          pageResults[i].bloggername = bloggers[i];
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
