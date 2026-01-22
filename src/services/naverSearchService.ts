/**
 * 구글 검색 서비스 (Google Custom Search API)
 * - 네이버 블로그, 티스토리, 브런치 등 모든 블로그 검색
 * - 검색 결과와 유사도 비교
 */

interface GoogleSearchItem {
  title: string;
  link: string;
  snippet: string;
  displayLink?: string;
}

interface GoogleSearchResult {
  items: GoogleSearchItem[];
  searchInformation?: {
    totalResults: string;
  };
}

import { extractSearchKeywords } from './geminiService';

/**
 * 네이버 검색 페이지 크롤링으로 블로그 URL 검색 (API 키 불필요)
 */
export async function searchNaverBlogsByCrawling(
  query: string,
  maxResults: number = 100
): Promise<Array<{
  title: string;
  link: string;
  description: string;
  bloggername: string;
}> | null> {
  try {
    const API_BASE_URL = import.meta.env.VITE_API_URL || '';
    
    console.log(`🕷️ 네이버 검색 페이지 크롤링 시작 (최대 ${maxResults}개)`);
    
    const response = await fetch(`${API_BASE_URL}/api/naver/crawl-search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        maxResults,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ 네이버 검색 크롤링 실패:', {
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        error: errorData,
      });
      return null;
    }

    const result = await response.json();
    
    console.log('🔍 네이버 API 응답:', {
      hasItems: !!result.items,
      itemsLength: result.items?.length || 0,
      total: result.total,
      keys: Object.keys(result),
    });
    
    if (!result.items || result.items.length === 0) {
      console.warn('⚠️ 검색 결과 없음:', {
        query,
        result: JSON.stringify(result).substring(0, 200),
      });
      return null;
    }
    
    console.log(`✅ 네이버 크롤링: ${result.items.length}개 블로그 URL 발견`);
    return result.items;
  } catch (error) {
    console.error('네이버 검색 크롤링 오류:', error);
    return null;
  }
}

/**
 * 구글 직접 검색 (site: 연산자 사용)
 * 네이버, 티스토리, 브런치 블로그만 검색
 */
export async function searchBlogsDirectly(
  query: string,
  maxResults: number = 50
): Promise<Array<{
  title: string;
  link: string;
  description: string;
  bloggername: string;
}> | null> {
  try {
    // 블로그 사이트만 검색
    const blogSites = 'site:blog.naver.com OR site:tistory.com OR site:brunch.co.kr';
    const searchQuery = `${query} ${blogSites}`;
    
    const API_BASE_URL = import.meta.env.VITE_API_URL || '';
    
    // 구글 API는 한번에 최대 10개만 가져올 수 있으므로 여러번 요청
    const allResults: any[] = [];
    const batchSize = 10;
    const numBatches = Math.ceil(maxResults / batchSize);
    
    for (let i = 0; i < numBatches; i++) {
      const start = i * batchSize + 1; // 구글 API는 1부터 시작
      
      console.log(`🔍 검색 배치 ${i + 1}/${numBatches} (start: ${start})`);
      
      const response = await fetch(`${API_BASE_URL}/api/google/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: searchQuery,
          num: batchSize,
          start: start,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`❌ 구글 검색 실패 (배치 ${i + 1}):`, {
          status: response.status,
          error: errorData,
        });
        
        // 첫 번째 배치 실패면 에러, 아니면 계속 진행
        if (i === 0) {
          throw new Error(`구글 검색 실패: ${response.status}`);
        }
        break;
      }

      const result = await response.json();
      
      if (result.items && result.items.length > 0) {
        allResults.push(...result.items);
        console.log(`✅ 배치 ${i + 1}: ${result.items.length}개 발견 (총 ${allResults.length}개)`);
      } else {
        console.log(`⚠️ 배치 ${i + 1}: 결과 없음, 중단`);
        break;
      }
      
      // 요청 사이에 약간의 지연 (Rate limit 방지)
      if (i < numBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    if (allResults.length === 0) {
      return null;
    }
    
    // 블로그 URL만 필터링
    const blogResults = allResults
      .filter((item: any) => {
        const url = item.link || '';
        return url.includes('blog.naver.com') || 
               url.includes('tistory.com') || 
               url.includes('brunch.co.kr');
      })
      .map((item: any) => ({
        title: item.title || '',
        link: item.link || '',
        description: item.snippet || '',
        bloggername: item.displayLink || '블로거',
      }));
    
    console.log(`📊 총 ${blogResults.length}개 블로그 URL 발견`);
    return blogResults.length > 0 ? blogResults : null;
  } catch (error) {
    console.error('구글 검색 오류:', error);
    return null;
  }
}

/**
 * 구글 커스텀 검색 (대체 방법)
 */
export async function searchGoogleBlogs(
  query: string,
  num: number = 10
): Promise<GoogleSearchResult | null> {
  try {
    // Google Custom Search API는 쿼리에 site: 넣으면 안됨
    // Search Engine 설정에서 네이버 블로그만 검색하도록 설정해야 함
    
    // API 서버를 통해 구글 검색 (CORS 우회)
    const API_BASE_URL = import.meta.env.VITE_API_URL || '';
    const response = await fetch(`${API_BASE_URL}/api/web-search/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: query, // site: 필터 제거
        num,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ 구글 검색 실패:', {
        status: response.status,
        error: errorData,
      });
      throw new Error(`구글 검색 실패: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const result = await response.json();
    return result as GoogleSearchResult;
  } catch (error) {
    console.error('구글 검색 오류:', error);
    return null;
  }
}

/**
 * HTML 태그 제거
 */
export function stripHtmlTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/<b>/g, '')
    .replace(/<\/b>/g, '')
    .trim();
}

/**
 * 블로그 글 내용 가져오기 (크롤링)
 */
export async function fetchNaverBlogContent(blogUrl: string): Promise<string | null> {
  try {
    const API_BASE_URL = import.meta.env.VITE_API_URL || '';
    const response = await fetch(`${API_BASE_URL}/api/google/fetch-content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: blogUrl,
      }),
    });

    if (!response.ok) {
      throw new Error(`블로그 내용 가져오기 실패: ${response.status}`);
    }

    const result = await response.json();
    return result.content || null;
  } catch (error) {
    console.error('블로그 내용 가져오기 오류:', error);
    return null;
  }
}

/**
 * 사용자 글을 분석하고 키워드로 구글 검색 후 유사도 비교용 데이터 준비
 * 실제 블로그 내용을 크롤링하여 전체 텍스트로 비교
 */
export async function prepareNaverBlogsForComparison(
  userText: string,
  manualKeywords?: string,
  maxResults: number = 100
): Promise<Array<{
  id: string;
  title: string;
  text: string;
  url: string;
  blogger: string;
  date: string;
}>> {
  // 1단계: 사용자 글 분석 및 키워드 추출
  console.log('📝 사용자 글 분석 중... (길이:', userText.length, '자)');
  
  let keywords: string;
  
  // manualKeywords 타입 체크 및 안전한 처리
  if (manualKeywords && typeof manualKeywords === 'string' && manualKeywords.trim()) {
    // 수동 키워드가 있으면 우선 사용
    keywords = manualKeywords.trim();
    console.log('🔑 사용자 지정 키워드 사용:', keywords);
  } else {
    // AI로 키워드 자동 추출
    console.log('🤖 AI 키워드 추출 시작...');
    const extractedKeywords = await extractSearchKeywords(userText);
    
    if (!extractedKeywords) {
      console.error('❌ 키워드 추출 실패');
      throw new Error('키워드를 추출할 수 없습니다. 텍스트를 다시 확인해주세요.');
    }
    
    keywords = extractedKeywords;
    console.log('✅ AI 추출 키워드:', keywords);
  }
  
  // 2단계: 네이버 검색 페이지 크롤링으로 블로그 검색
  console.log('🔍 네이버 블로그 검색 시작:', keywords);
  const blogUrls = await searchNaverBlogsByCrawling(keywords, maxResults);
  
  if (!blogUrls || blogUrls.length === 0) {
    console.warn('⚠️ 검색 결과 없음');
    return [];
  }

  console.log(`📊 검색 결과 ${blogUrls.length}개 발견`);

  // 3단계: 각 블로그의 실제 내용 크롤링 (순차적 처리 + 지연)
  const results = [];
  const CRAWL_DELAY = 800; // 각 요청 사이 800ms 지연 (rate limit 방지 - 300ms → 800ms 증가)
  
  for (let index = 0; index < blogUrls.length; index++) {
    const item = blogUrls[index];
    
    try {
      console.log(`🕷️ [${index + 1}/${blogUrls.length}] 크롤링 중:`, item.link);
      
      // 블로그 전체 내용 크롤링 (재시도 포함)
      const fullContent = await fetchBlogContentViaCrawler(item.link);
      
      if (fullContent && fullContent.length > 100) {
        console.log(`✅ [${index + 1}] 크롤링 성공: ${fullContent.length}자`);
        results.push({
          id: `blog_${index}`,
          title: stripHtmlTags(item.title),
          text: fullContent, // 전체 내용 사용
          url: item.link,
          blogger: item.bloggername || '웹사이트',
          date: new Date().toISOString().split('T')[0].replace(/-/g, ''),
        });
      } else {
        console.warn(`⚠️ [${index + 1}] 크롤링 실패, 제외 (내용 길이: ${fullContent?.length || 0}자, URL: ${item.link})`);
      }
      
      // 다음 요청 전 지연 (마지막 항목 제외)
      if (index < blogUrls.length - 1) {
        await delay(CRAWL_DELAY);
      }
    } catch (error) {
      console.error(`❌ [${index + 1}] 크롤링 에러, 제외 (URL: ${item.link}):`, error);
    }
  }
  
  console.log(`✅ 크롤링 완료: ${results.length}/${blogUrls.length}개 성공`);

  return results;
}

/**
 * 지연 함수 (ms)
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * /api/crawler를 통해 블로그 내용 크롤링 (재시도 + 지연 포함)
 */
async function fetchBlogContentViaCrawler(url: string, retries = 3): Promise<string | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch('/api/crawler', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      // 429 (Too Many Requests) 처리
      if (response.status === 429) {
        if (attempt < retries) {
          const waitTime = Math.min(2000 * Math.pow(2, attempt), 16000); // 지수 백오프 (최대 16초, 2초 시작)
          console.warn(`⏳ [재시도 ${attempt}/${retries}] 429 에러 (Rate Limit), ${waitTime}ms 대기 중...`);
          await delay(waitTime);
          continue;
        }
        console.error(`❌ 429 에러 최대 재시도 초과 (Rate Limit 초과): ${url}`);
        return null;
      }

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.content || null;
    } catch (error) {
      if (attempt < retries) {
        const waitTime = 1000 * attempt;
        console.warn(`⏳ [재시도 ${attempt}/${retries}] 에러 발생, ${waitTime}ms 대기 중...`);
        await delay(waitTime);
        continue;
      }
      console.error('크롤링 에러 (최대 재시도 초과):', error);
      return null;
    }
  }
  return null;
}
