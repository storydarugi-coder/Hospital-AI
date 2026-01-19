// API 키 정보 확인
const API_KEY = 'AIzaSyBNe5c6440236ff949ce8pX1hT-TQhEfvU';
const SEARCH_ENGINE_ID = 'e5c6440236ff949ce';

console.log('📋 현재 설정:');
console.log('API Key:', API_KEY);
console.log('Search Engine ID:', SEARCH_ENGINE_ID);
console.log('');
console.log('💡 확인 사항:');
console.log('1. 이 API 키가 Custom Search API에서 사용 가능한지 확인');
console.log('2. API 키 제한이 "제한 없음" 또는 "Custom Search API 포함"인지 확인');
console.log('3. Google Cloud Console에서 새 API 키를 생성해보세요:');
console.log('   https://console.cloud.google.com/apis/credentials');
console.log('');
console.log('🔗 직접 테스트:');
const testUrl = `https://www.googleapis.com/customsearch/v1?key=${API_KEY}&cx=${SEARCH_ENGINE_ID}&q=test`;
console.log(testUrl);
