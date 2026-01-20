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
 * 구글 커스텀 검색으로 네이버 블로그만 검색
 */
export async function searchGoogleBlogs(
  query: string,
  num: number = 10
): Promise<GoogleSearchResult | null> {
  try {
    // 네이버 블로그만 검색하도록 site: 필터 추가
    const naverBlogQuery = `site:blog.naver.com ${query}`;
    
    // API 서버를 통해 구글 검색 (CORS 우회)
    const API_BASE_URL = import.meta.env.VITE_API_URL || '';
    const response = await fetch(`${API_BASE_URL}/api/web-search/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: naverBlogQuery,
        num,
      }),
    });

    if (!response.ok) {
      throw new Error(`구글 검색 실패: ${response.status}`);
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
  maxResults: number = 10
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
  
  if (manualKeywords && manualKeywords.trim()) {
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
  
  // 2단계: 추출된 키워드로 검색
  console.log('🔍 구글 검색 시작:', keywords);
  const searchResult = await searchGoogleBlogs(keywords, maxResults);
  
  if (!searchResult || !searchResult.items || searchResult.items.length === 0) {
    console.warn('⚠️ 검색 결과 없음');
    return [];
  }

  console.log(`📊 검색 결과 ${searchResult.items.length}개 발견`);

  // 3단계: 각 블로그의 실제 내용 크롤링
  const results = await Promise.all(
    searchResult.items.map(async (item, index) => {
      try {
        console.log(`🕷️ [${index + 1}/${searchResult.items.length}] 크롤링 중:`, item.link);
        
        // 블로그 전체 내용 크롤링
        const fullContent = await fetchBlogContentViaCrawler(item.link);
        
        if (fullContent && fullContent.length > 100) {
          console.log(`✅ [${index + 1}] 크롤링 성공: ${fullContent.length}자`);
          return {
            id: `google_${index}`,
            title: stripHtmlTags(item.title),
            text: fullContent, // 전체 내용 사용
            url: item.link,
            blogger: item.displayLink || '웹사이트',
            date: new Date().toISOString().split('T')[0].replace(/-/g, ''),
          };
        } else {
          console.warn(`⚠️ [${index + 1}] 크롤링 실패, 스니펫 사용`);
          // 크롤링 실패 시 스니펫 사용
          return {
            id: `google_${index}`,
            title: stripHtmlTags(item.title),
            text: stripHtmlTags(item.snippet),
            url: item.link,
            blogger: item.displayLink || '웹사이트',
            date: new Date().toISOString().split('T')[0].replace(/-/g, ''),
          };
        }
      } catch (error) {
        console.error(`❌ [${index + 1}] 크롤링 에러:`, error);
        // 에러 발생 시 스니펫 사용
        return {
          id: `google_${index}`,
          title: stripHtmlTags(item.title),
          text: stripHtmlTags(item.snippet),
          url: item.link,
          blogger: item.displayLink || '웹사이트',
          date: new Date().toISOString().split('T')[0].replace(/-/g, ''),
        };
      }
    })
  );

  const successCount = results.filter(r => r.text.length > 200).length;
  console.log(`✅ 크롤링 완료: ${successCount}/${results.length}개 성공`);

  return results;
}

/**
 * /api/crawler를 통해 블로그 내용 크롤링
 */
async function fetchBlogContentViaCrawler(url: string): Promise<string | null> {
  try {
    const response = await fetch('/api/crawler', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.content || null;
  } catch (error) {
    console.error('크롤링 에러:', error);
    return null;
  }
}
