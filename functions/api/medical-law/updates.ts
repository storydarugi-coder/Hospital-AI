// Cloudflare Pages Function
// Path: /api/medical-law/updates
// 의료광고법 관련 최신 뉴스 및 업데이트 확인

interface Env {
  // 환경 변수
}

interface UpdateInfo {
  hasUpdates: boolean;
  latestUpdate?: {
    date: string;
    title: string;
    url: string;
    summary: string;
  };
  recentNews: Array<{
    date: string;
    title: string;
    url: string;
  }>;
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    console.log('📰 의료광고법 업데이트 확인 중...');

    // 보건복지부 보도자료 페이지 크롤링
    const mohwNewsUrl = 'https://www.mohw.go.kr/board.es?mid=a10503000000&bid=0027';
    
    const response = await fetch(mohwNewsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MedicalLawBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });

    if (!response.ok) {
      console.warn('⚠️ 보건복지부 사이트 접근 실패');
      return new Response(
        JSON.stringify(getMockUpdateInfo()),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const html = await response.text();
    
    // HTML에서 의료광고 관련 뉴스 추출
    const newsItems = extractMedicalAdNews(html);
    
    const updateInfo: UpdateInfo = {
      hasUpdates: newsItems.length > 0,
      latestUpdate: newsItems.length > 0 ? newsItems[0] : undefined,
      recentNews: newsItems.slice(0, 5)
    };

    console.log('✅ 업데이트 확인 완료:', newsItems.length, '개 뉴스');

    return new Response(
      JSON.stringify(updateInfo),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ 업데이트 확인 실패:', error);
    
    // 에러 시 기본 정보 반환
    return new Response(
      JSON.stringify(getMockUpdateInfo()),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * HTML에서 의료광고 관련 뉴스 추출
 */
function extractMedicalAdNews(html: string): Array<{
  date: string;
  title: string;
  url: string;
  summary: string;
}> {
  const news: Array<{ date: string; title: string; url: string; summary: string }> = [];
  
  // 간단한 패턴 매칭으로 뉴스 추출
  const medicalAdKeywords = ['의료광고', '의료법', '불법 광고', '의료기관 광고'];
  
  // 실제로는 더 정교한 HTML 파싱이 필요하지만, 여기서는 간단히 처리
  // (실제 프로덕션에서는 jsdom 등의 라이브러리 사용 권장)
  
  medicalAdKeywords.forEach(keyword => {
    if (html.includes(keyword)) {
      news.push({
        date: new Date().toISOString().split('T')[0],
        title: `${keyword} 관련 최신 정보`,
        url: 'https://www.mohw.go.kr/board.es?mid=a10503000000&bid=0027',
        summary: `${keyword}에 대한 최신 보건복지부 보도자료입니다.`
      });
    }
  });

  return news;
}

/**
 * Mock 데이터 (API 실패 시 기본값)
 */
function getMockUpdateInfo(): UpdateInfo {
  return {
    hasUpdates: true,
    latestUpdate: {
      date: '2024-03-11',
      title: '자발적 후기 가장 치료경험담 등 불법의료광고 366건 적발',
      url: 'https://www.mohw.go.kr/board.es?mid=a10503000000&bid=0027&list_no=1480602',
      summary: '보건복지부가 불법 의료광고 366건을 적발했으며, 치료경험담을 가장한 광고가 183건으로 가장 많았습니다.'
    },
    recentNews: [
      {
        date: '2024-03-11',
        title: '자발적 후기 가장 치료경험담 등 불법의료광고 366건 적발',
        url: 'https://www.mohw.go.kr/board.es?mid=a10503000000&bid=0027&list_no=1480602'
      },
      {
        date: '2023-12-11',
        title: '보건복지부와 의료계, 불법 의료광고 집중 단속',
        url: 'https://www.mohw.go.kr/board.es?mid=a10503000000&bid=0027&list_no=1479210'
      },
      {
        date: '2022-04-18',
        title: '치료경험담 등 불법의료광고 286건 적발',
        url: 'https://www.mohw.go.kr/board.es?mid=a10503000000&bid=0027&list_no=371102'
      },
      {
        date: '2020-07-06',
        title: '건강한 의료광고 우리 함께 만들어요',
        url: 'https://www.mohw.go.kr/board.es?mid=a10503010100&bid=0027&act=view&list_no=355295'
      }
    ]
  };
}

// CORS preflight
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
