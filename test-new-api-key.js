const API_KEY = 'AIzaSyCAqpCfYmcChFyByEPC9o8If-DwAeZmQs4';
const SEARCH_ENGINE_ID = 'e5c6440236ff949ce';

console.log('🔍 새 API 키로 구글 검색 테스트 중...');
console.log('검색어: 당뇨병 예방법\n');

const url = `https://www.googleapis.com/customsearch/v1?key=${API_KEY}&cx=${SEARCH_ENGINE_ID}&q=당뇨병 예방법&num=3`;

fetch(url)
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      console.error('❌ 에러:', data.error.message);
      console.log('상세:', JSON.stringify(data.error, null, 2));
    } else if (data.items) {
      console.log('✅ 성공! 검색 결과:');
      console.log('총 결과 수:', data.searchInformation.totalResults);
      console.log('\n📄 상위 3개 결과:\n');
      data.items.forEach((item, idx) => {
        console.log(`${idx + 1}. ${item.title}`);
        console.log(`   URL: ${item.link}`);
        console.log(`   사이트: ${item.displayLink}`);
        console.log(`   설명: ${item.snippet.substring(0, 100)}...`);
        console.log('');
      });
    } else {
      console.log('⚠️ 결과 없음:', data);
    }
  })
  .catch(err => {
    console.error('❌ 네트워크 에러:', err.message);
  });
