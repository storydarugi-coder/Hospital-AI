/**
 * 네이버 뉴스 검색 결과 페이지를 크롤링해서 뉴스 URL 추출
 * (API 키 불필요, 직접 검색 결과 페이지 크롤링)
 * 
 * ⚠️ 중요: 뉴스는 오늘 당일만 검색! (블로그와 달리 최신성이 중요)
 */

interface Env {}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { query, maxResults = 30 } = await context.request.json() as {
      query: string;
      maxResults?: number;
    };

    if (!query) {
      return new Response(JSON.stringify({ error: 'Query is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 🔥 뉴스는 오늘 당일만! (블로그는 6개월, 뉴스는 당일)
    const today = new Date();

    // 네이버 검색 날짜 포맷: YYYYMMDD (점 없음!)
    const formatNaverDate = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}${month}${day}`; // YYYYMMDD 형식
    };

    const todayDate = formatNaverDate(today); // 예: 20260122

    console.log('📰 네이버 뉴스 검색 크롤링:', query, '(최대', maxResults, '개)');
    console.log('🎯 정렬 방식: 최신순 (최근 뉴스 우선)');
    console.log('📅 날짜 필터:', todayDate, '(오늘 당일만)');

    const newsUrls: Array<{
      title: string;
      link: string;
      description: string;
      source: string;
      pubDate: string;
    }> = [];

    // 네이버 뉴스 검색 결과는 페이지당 약 10개씩
    const pagesNeeded = Math.ceil(maxResults / 10);

    for (let page = 1; page <= Math.min(pagesNeeded, 5); page++) {
      const start = (page - 1) * 10 + 1;
      
      // 최신순 + 오늘 날짜만 + 정확한 문구 검색 (따옴표)
      // so:dd = 최신순 (Date Descending)
      // ds=시작일&de=종료일 (YYYYMMDD 형식) - 오늘 당일로 설정
      const exactQuery = `"${query}"`;
      const searchUrl = `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(
        exactQuery
      )}&start=${start}&sm=tab_opt&nso=so:dd,p:from${todayDate}to${todayDate}`;

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
          console.error('❌ 네이버 뉴스 페이지 요청 실패:', response.status);
          break;
        }

        const html = await response.text();

        // 뉴스 검색 결과 추출
        const pageResults: typeof newsUrls = [];

        // 1. 뉴스 URL 추출 (네이버 뉴스 도메인)
        const urlPattern = /https:\/\/n\.news\.naver\.com\/[^\s"<>]*/g;
        const foundUrls: string[] = [];
        let match;
        
        while ((match = urlPattern.exec(html)) !== null) {
          const url = match[0];
          // 중복 제거 및 최소 길이 체크
          if (!foundUrls.includes(url) && url.length > 30) {
            foundUrls.push(url);
          }
        }
        
        console.log(`🔗 페이지 ${page}에서 ${foundUrls.length}개 뉴스 URL 발견`);

        // 2. 뉴스 제목과 링크 추출
        const titleLinkPatterns = [
          // 패턴 1: news_tit 클래스
          /<a[^>]*class="[^"]*news_tit[^"]*"[^>]*href="(https:\/\/n\.news\.naver\.com\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/g,
          // 패턴 2: 일반 뉴스 링크
          /<a[^>]*href="(https:\/\/n\.news\.naver\.com\/[^"]*)"[^>]*class="[^"]*news[^"]*"[^>]*>([\s\S]*?)<\/a>/g,
        ];

        for (const pattern of titleLinkPatterns) {
          pattern.lastIndex = 0;
          while ((match = pattern.exec(html)) !== null) {
            const link = match[1];
            let title = match[2];
            
            // HTML 태그 제거
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
                source: '',
                pubDate: todayDate,
              });
            }
          }
        }
        
        // 3. URL만 발견되고 제목이 없는 경우, 기본 제목 할당
        for (const url of foundUrls) {
          if (!pageResults.find(r => r.link === url)) {
            pageResults.push({
              title: '네이버 뉴스',
              link: url,
              description: '',
              source: '',
              pubDate: todayDate,
            });
          }
        }

        // 4. 뉴스 설명 추출
        const descPatterns = [
          // 패턴 1: news_dsc 클래스
          /<a[^>]*class="[^"]*news_dsc[^"]*"[^>]*>([\s\S]*?)<\/a>/g,
          // 패턴 2: dsc_txt_wrap 클래스
          /<div[^>]*class="[^"]*dsc_txt_wrap[^"]*"[^>]*>([\s\S]*?)<\/div>/g,
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
            
            if (desc.length > 20) {
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

        // 5. 뉴스 출처 추출
        const sourcePatterns = [
          // 패턴 1: info_group 내 press 클래스
          /<span[^>]*class="[^"]*press[^"]*"[^>]*>(.*?)<\/span>/g,
          // 패턴 2: info 클래스
          /<span[^>]*class="[^"]*info[^"]*"[^>]*>(.*?)<\/span>/g,
        ];
        
        const sources: string[] = [];
        
        for (const pattern of sourcePatterns) {
          pattern.lastIndex = 0;
          while ((match = pattern.exec(html)) !== null) {
            const source = match[1]
              .replace(/<[^>]*>/g, '')
              .trim();
            if (source && source.length > 0) {
              sources.push(source);
            }
          }
        }

        // 출처 할당
        for (let i = 0; i < pageResults.length && i < sources.length; i++) {
          if (!pageResults[i].source) {
            pageResults[i].source = sources[i];
          }
        }
        
        // 기본값 설정
        for (const result of pageResults) {
          if (!result.source) result.source = '언론사';
          if (!result.description) result.description = result.title;
        }

        console.log(`✅ 페이지 ${page}: ${pageResults.length}개 발견`);
        newsUrls.push(...pageResults);

        if (newsUrls.length >= maxResults || pageResults.length === 0) {
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

    console.log(`📊 총 ${newsUrls.length}개 뉴스 URL 추출 (오늘 당일)`);

    return new Response(
      JSON.stringify({
        items: newsUrls.slice(0, maxResults),
        total: newsUrls.length,
        date: todayDate,
        dateRange: 'today', // 오늘만 검색했음을 명시
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('네이버 뉴스 검색 크롤링 에러:', error);
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
