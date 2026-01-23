const API_KEY = 'AIzaSyBNe5c6440236ff949ce8pX1hT-TQhEfvU';
const SEARCH_ENGINE_ID = 'e5c6440236ff949ce';

async function testGoogleSearch() {
  try {
    const query = '당뇨병 예방법';
    const url = `https://www.googleapis.com/customsearch/v1?key=${API_KEY}&cx=${SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}&num=3`;
    
    console.log('🔍 구글 검색 테스트 중...');
    console.log('검색어:', query);
    console.log('');
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.error) {
      console.error('❌ 에러:', data.error.message);
      console.log('상세:', JSON.stringify(data.error, null, 2));
    } else if (data.items) {
      console.log('✅ 검색 성공!');
      console.log(`📊 총 ${data.items.length}개 결과\n`);
      
      data.items.forEach((item, i) => {
        console.log(`${i + 1}. ${item.title}`);
        console.log(`   🔗 ${item.link}`);
        console.log(`   📝 ${item.snippet.substring(0, 80)}...`);
        console.log('');
      });
    } else {
      console.log('⚠️ 검색 결과 없음');
      console.log('응답:', JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error('❌ 오류:', err.message);
  }
}

testGoogleSearch();
