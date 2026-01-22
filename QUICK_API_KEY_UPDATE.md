# API 키 즉시 변경 가이드

## 🚀 가장 빠른 방법 (복사 & 붙여넣기)

웹 애플리케이션에서 **F12** → **Console** 탭 → 아래 코드 붙여넣기 → **Enter**

### 옵션 1: 한 줄 명령어 (권장)
```javascript
(function(){const k='AIzaSyDOVqA7HP5yRZWalhEu12ECrhqP2R3cetg';localStorage.setItem('GEMINI_API_KEY',k);localStorage.setItem('GLOBAL_GEMINI_API_KEY',k);localStorage.setItem('GEMINI_API_KEYS',JSON.stringify([{id:Date.now().toString(),key:k,name:'Primary Key',isActive:true,usageCount:0,lastUsed:null}]));fetch((window.location.origin.includes('localhost')?'http://localhost:3001':'https://story-darugi.com')+'/api-keys/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({geminiKey:k})}).then(r=>r.json()).then(d=>{console.log(d.success?'✅ 완료!':'⚠️ 서버 저장 실패');setTimeout(()=>location.reload(),2000)}).catch(e=>{console.log('⚠️ 서버 연결 실패, localStorage만 업데이트됨');setTimeout(()=>location.reload(),2000)})})();
```

### 옵션 2: 더 안전한 방법 (서버 API 호출 포함)
`update-api-key-complete.js` 파일의 전체 내용을 복사하여 콘솔에 붙여넣기

## ✅ 확인 방법

업데이트 후 콘솔에서 확인:
```javascript
console.log('현재 키:', localStorage.getItem('GEMINI_API_KEY'));
```

출력:
```
현재 키: AIzaSyDOVqA7HP5yRZWalhEu12ECrhqP2R3cetg
```

콘솔 로그 확인:
```
📊 API 키 상태:
  키 1: ...2R3cetg - ✅ 사용 가능
```

## 🔧 문제 해결

### 여전히 이전 키가 보이는 경우

1. **캐시 완전 초기화**
```javascript
// 모든 API 키 관련 항목 삭제
Object.keys(localStorage).forEach(key => {
  if (key.includes('API') || key.includes('GEMINI')) {
    localStorage.removeItem(key);
  }
});
location.reload();
```

2. **브라우저 캐시 삭제**
- **Ctrl + Shift + Delete** (Windows) 또는 **Cmd + Shift + Delete** (Mac)
- "쿠키 및 기타 사이트 데이터" 체크
- "삭제" 클릭
- 페이지 새로고침

3. **시크릿 모드에서 테스트**
- **Ctrl + Shift + N** (Chrome) 또는 **Cmd + Shift + N** (Mac)
- 시크릿 창에서 사이트 접속
- 위의 한 줄 명령어 실행

## 📝 참고

- `localStorage`는 브라우저별로 독립적입니다
- 각 브라우저(Chrome, Firefox, Safari 등)마다 별도로 설정해야 합니다
- 쿠키 삭제 시 API 키도 함께 삭제될 수 있습니다
- 서버가 실행 중이 아니면 localStorage만 업데이트됩니다

## 🔐 보안

- API 키는 개인용이므로 절대 공유하지 마세요
- 공개 저장소에 업로드하지 마세요
- `.env` 파일은 Git에 커밋되지 않습니다
