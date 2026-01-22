// 브라우저 콘솔에서 실행: 서버와 로컬 스토리지 모두 업데이트
// F12 → Console 탭에서 실행

const NEW_API_KEY = 'AIzaSyDOVqA7HP5yRZWalhEu12ECrhqP2R3cetg';

console.log('🔧 API 키 업데이트 시작...');
console.log('🔑 새 키:', NEW_API_KEY.substring(0, 10) + '...' + NEW_API_KEY.substring(NEW_API_KEY.length - 8));

// 1. localStorage 업데이트
console.log('\n📦 Step 1: localStorage 업데이트');
localStorage.setItem('GEMINI_API_KEY', NEW_API_KEY);
localStorage.setItem('GLOBAL_GEMINI_API_KEY', NEW_API_KEY);

// 다중 키 배열 업데이트
const keyArray = [{
  id: Date.now().toString(),
  key: NEW_API_KEY,
  name: 'Primary Key',
  isActive: true,
  usageCount: 0,
  lastUsed: null
}];
localStorage.setItem('GEMINI_API_KEYS', JSON.stringify(keyArray));

console.log('✅ localStorage 업데이트 완료');

// 2. 서버에 API 키 저장
console.log('\n🌐 Step 2: 서버에 API 키 저장 시도...');

// API 베이스 URL 확인
const apiBaseUrl = window.location.origin.includes('localhost') 
  ? 'http://localhost:3001' 
  : 'https://story-darugi.com';

console.log('📍 API URL:', apiBaseUrl);

fetch(`${apiBaseUrl}/api-keys/save`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    geminiKey: NEW_API_KEY,
    openaiKey: null
  })
})
.then(response => response.json())
.then(data => {
  if (data.success) {
    console.log('✅ 서버에 API 키 저장 성공!');
    console.log('\n🎉 모든 업데이트 완료!');
    console.log('🔄 3초 후 페이지가 자동으로 새로고침됩니다...');
    
    setTimeout(() => {
      window.location.reload();
    }, 3000);
  } else {
    console.warn('⚠️ 서버 저장 실패:', data.error);
    console.log('✅ 하지만 localStorage는 업데이트되었습니다.');
    console.log('🔄 페이지를 새로고침하세요.');
  }
})
.catch(error => {
  console.warn('⚠️ 서버 연결 실패:', error.message);
  console.log('✅ 하지만 localStorage는 업데이트되었습니다.');
  console.log('🔄 페이지를 새로고침하면 새 키가 적용됩니다.');
  
  setTimeout(() => {
    window.location.reload();
  }, 3000);
});

// 3. 즉시 확인
setTimeout(() => {
  const updated = localStorage.getItem('GEMINI_API_KEY');
  const keysArray = JSON.parse(localStorage.getItem('GEMINI_API_KEYS') || '[]');
  
  console.log('\n✅ 검증:');
  console.log('  - localStorage GEMINI_API_KEY:', updated?.substring(0, 10) + '...');
  console.log('  - GEMINI_API_KEYS 배열:', keysArray.length + '개');
  
  if (keysArray.length > 0) {
    console.log('  - 첫 번째 키:', keysArray[0].key.substring(0, 10) + '...' + keysArray[0].key.substring(keysArray[0].key.length - 8));
  }
}, 500);
