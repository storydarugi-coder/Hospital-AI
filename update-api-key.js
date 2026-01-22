// 브라우저 개발자 도구 콘솔에서 실행할 스크립트
// 새 Gemini API 키로 업데이트

const NEW_API_KEY = 'AIzaSyDOVqA7HP5yRZWalhEu12ECrhqP2R3cetg';

console.log('🔧 API 키 업데이트 시작...');

// 1. 기존 키 백업
const oldKey = localStorage.getItem('GEMINI_API_KEY');
const oldKeys = localStorage.getItem('GEMINI_API_KEYS');
console.log('📦 기존 단일 키:', oldKey ? oldKey.substring(0, 10) + '...' : '없음');
console.log('📦 기존 다중 키:', oldKeys ? JSON.parse(oldKeys).length + '개' : '없음');

// 2. 새 키로 업데이트
localStorage.setItem('GEMINI_API_KEY', NEW_API_KEY);

// 3. 다중 키 배열도 업데이트
const keyArray = [{
  id: Date.now().toString(),
  key: NEW_API_KEY,
  name: 'Primary Key',
  isActive: true,
  usageCount: 0,
  lastUsed: null
}];
localStorage.setItem('GEMINI_API_KEYS', JSON.stringify(keyArray));

// 4. 전역 키도 업데이트 (혹시 있다면)
localStorage.setItem('GLOBAL_GEMINI_API_KEY', NEW_API_KEY);

console.log('✅ API 키 업데이트 완료!');
console.log('🔑 새 키:', NEW_API_KEY.substring(0, 10) + '...' + NEW_API_KEY.substring(NEW_API_KEY.length - 5));
console.log('🔄 페이지를 새로고침하세요.');

// 5. 확인
setTimeout(() => {
  const updated = localStorage.getItem('GEMINI_API_KEY');
  if (updated === NEW_API_KEY) {
    console.log('✅ 검증 성공: API 키가 올바르게 저장되었습니다.');
    console.log('🔄 이제 페이지를 새로고침하면 새 키가 적용됩니다.');
  } else {
    console.error('❌ 검증 실패: API 키가 올바르게 저장되지 않았습니다.');
  }
}, 100);
