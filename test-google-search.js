// 구글 검색 API 테스트
const API_KEY = 'AIzaSyBNe5c6440236ff949ce8pX1hT-TQhEfvU';

async function testGoogleSearch() {
  try {
    // 1. Search Engine ID가 필요함
    const SEARCH_ENGINE_ID = 'YOUR_SEARCH_ENGINE_ID'; // 이게 필요!
    
    const url = `https://www.googleapis.com/customsearch/v1?key=${API_KEY}&cx=${SEARCH_ENGINE_ID}&q=당뇨병 예방법&num=3`;
    
    console.log('🔍 구글 검색 테스트 중...');
    console.log('URL:', url);
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.error) {
      console.error('❌ 에러:', data.error.message);
      console.log('\n💡 해결 방법:');
      console.log('1. Google Cloud Console에서 Custom Search API 활성화');
      console.log('2. Programmable Search Engine에서 Search Engine ID 발급');
    } else {
      console.log('✅ 검색 성공!');
      console.log('결과:', data.items?.[0]?.title);
    }
  } catch (err) {
    console.error('❌ 오류:', err.message);
  }
}

testGoogleSearch();
