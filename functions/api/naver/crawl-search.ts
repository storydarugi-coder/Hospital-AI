/**
 * 네이버 검색 결과 페이지를 크롤링해서 블로그 URL 추출
 * (API 키 불필요, 직접 검색 결과 페이지 크롤링)
 */

interface Env {}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { query, maxResults = 100 } = await context.request.json() as {
      query: string;
      maxResults?: number;
    };

    if (!query) {
      return new Response(JSON.stringify({ error: 'Query is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 동적 날짜 계산: 6개월 전 ~ 오늘
    const today = new Date();
    const sixMonthsAgo = new Date(today);
    sixMonthsAgo.setMonth(today.getMonth() - 6);

    // 네이버 검색 날짜 포맷: YYYYMMDD (점 없음!)
    const formatNaverDate = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}${month}${day}`; // YYYYMMDD 형식
    };

    const startDate = formatNaverDate(sixMonthsAgo); // 예: 20250722
    const endDate = formatNaverDate(today);          // 예: 20260122

    console.log('🔍 네이버 검색 크롤링:', query, '(최대', maxResults, '개)');
    console.log('🎯 정렬 방식: 정확도순 (관련성 높은 순서)');
    console.log('📅 날짜 필터:', startDate, '~', endDate, '(최근 6개월)');

    const blogUrls: Array<{
      title: string;
      link: string;
      description: string;
      bloggername: string;
    }> = [];

    // 네이버 검색 결과는 페이지당 약 10개씩
    const pagesNeeded = Math.ceil(maxResults / 10);

    for (let page = 1; page <= Math.min(pagesNeeded, 10); page++) {
      const start = (page - 1) * 10 + 1;
      
      // 정확도순 + 날짜 필터 + 정확한 문구 검색 (따옴표)
      // so:sim = 정확도순 (Similarity)
      // ds=시작일&de=종료일 (YYYYMMDD 형식)
      // 따옴표로 감싸서 정확히 일치하는 문장만 검색
      const exactQuery = `"${query}"`;
      const searchUrl = `https://search.naver.com/search.naver?where=blog&query=${encodeURIComponent(
        exactQuery
      )}&start=${start}&sm=tab_opt&nso=so:sim,p:from${startDate}to${endDate}`;

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

        // 1. 먼저 모든 블로그 URL 추출 (더 관대한 패턴)
        const urlPattern = /https:\/\/(?:blog\.naver\.com|[a-zA-Z0-9-]+\.tistory\.com|brunch\.co\.kr)\/[^\s"<>]*/g;
        const foundUrls: string[] = [];
        let match;
        
        while ((match = urlPattern.exec(html)) !== null) {
          const url = match[0];
          if (!foundUrls.includes(url) && url.length > 30) { // 중복 제거 및 최소 길이 체크
            foundUrls.push(url);
          }
        }
        
        console.log(`🔗 페이지 ${page}에서 ${foundUrls.length}개 URL 발견`);

        // 2. 블로그 URL과 제목을 함께 추출 (여러 패턴 시도)
        const titleLinkPatterns = [
          // 패턴 1: data-heatmap-target
          /<a[^>]*href="(https:\/\/(?:blog\.naver\.com|.*?\.tistory\.com|brunch\.co\.kr)\/[^"]*)"[^>]*data-heatmap-target="\.link"[^>]*>[\s\S]*?<span[^>]*headline1[^>]*>([\s\S]*?)<\/span>/g,
          // 패턴 2: title_link 클래스
          /<a[^>]*class="[^"]*title_link[^"]*"[^>]*href="(https:\/\/(?:blog\.naver\.com|.*?\.tistory\.com|brunch\.co\.kr)\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/g,
          // 패턴 3: 단순 URL과 제목
          /<a[^>]*href="(https:\/\/(?:blog\.naver\.com|.*?\.tistory\.com|brunch\.co\.kr)\/[^"]*)"[^>]*>([^<]+)</g,
        ];

        for (const pattern of titleLinkPatterns) {
          pattern.lastIndex = 0; // 정규식 초기화
          while ((match = pattern.exec(html)) !== null) {
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

            if (title && link && !pageResults.find(r => r.link === link)) {
              pageResults.push({
                title: title,
                link: link,
                description: '',
                bloggername: '',
              });
            }
          }
        }
        
        // 3. URL만 발견되고 제목이 없는 경우, 기본 제목 할당
        for (const url of foundUrls) {
          if (!pageResults.find(r => r.link === url)) {
            pageResults.push({
              title: '네이버 블로그', // 기본 제목
              link: url,
              description: '',
              bloggername: '',
            });
          }
        }

        // 4. 설명 추출 (더 관대한 패턴)
        const descPatterns = [
          // 패턴 1: body1 클래스
          /<span[^>]*class="[^"]*sds-comps-text[^"]*body1[^"]*"[^>]*>([\s\S]*?)<\/span>/g,
          // 패턴 2: dsc_link 클래스
          /<a[^>]*class="[^"]*dsc_link[^"]*"[^>]*>([\s\S]*?)<\/a>/g,
          // 패턴 3: 단순 설명
          /<div[^>]*class="[^"]*api_txt_lines[^"]*"[^>]*>([\s\S]*?)<\/div>/g,
        ];
        
        const descriptions: string[] = [];
        
        for (const pattern of descPatterns) {
          pattern.lastIndex = 0;
          while ((match = pattern.exec(html)) !== null) {
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
        }

        // 설명 할당
        for (let i = 0; i < pageResults.length && i < descriptions.length; i++) {
          if (!pageResults[i].description) {
            pageResults[i].description = descriptions[i];
          }
        }

        // 5. 블로거 이름 추출 (더 관대한 패턴)
        const bloggerPatterns = [
          // 패턴 1: profile-info-title-text
          /<span[^>]*profile-info-title-text[^>]*>[\s\S]*?<span[^>]*>(.*?)<\/span>[\s\S]*?<\/span>/g,
          // 패턴 2: name 클래스
          /<span[^>]*class="[^"]*name[^"]*"[^>]*>(.*?)<\/span>/g,
          // 패턴 3: sub_txt 클래스
          /<span[^>]*class="[^"]*sub_txt[^"]*"[^>]*>(.*?)<\/span>/g,
        ];
        
        const bloggers: string[] = [];
        
        for (const pattern of bloggerPatterns) {
          pattern.lastIndex = 0;
          while ((match = pattern.exec(html)) !== null) {
            const blogger = match[1]
              .replace(/<[^>]*>/g, '')
              .trim();
            if (blogger && blogger.length > 0) {
              bloggers.push(blogger);
            }
          }
        }

        // 블로거 이름 할당
        for (let i = 0; i < pageResults.length && i < bloggers.length; i++) {
          if (!pageResults[i].bloggername) {
            pageResults[i].bloggername = bloggers[i];
          }
        }
        
        // 기본값 설정
        for (const result of pageResults) {
          if (!result.bloggername) result.bloggername = '블로거';
          if (!result.description) result.description = result.title;
        }

        console.log(`✅ 페이지 ${page}: ${pageResults.length}개 발견 (제목: ${pageResults.filter(r => r.title && r.title !== '네이버 블로그').length}개, URL만: ${pageResults.filter(r => r.title === '네이버 블로그').length}개)`);
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
