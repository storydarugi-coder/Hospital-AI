# API 키를 새로 설정했는데 왜 이전 키가 보이나요?

## 문제 상황
콘솔에 다음과 같이 표시됩니다:
```
API 키 매니저 초기화 완료 (총 1개 키)
🔐 다중 API 키 시스템 활성화 (총 1개)
📊 API 키 상태:
  키 1: ...Hd0SLSiI - ✅ 사용 가능
```

하지만 새 API 키는 `AIzaSyDOVqA7HP5yRZWalhEu12ECrhqP2R3cetg`입니다.

## 원인
Hospital AI는 API 키를 여러 곳에 저장합니다:
1. **브라우저 localStorage** (클라이언트 측) ← **현재 사용 중**
2. `.env.local` 파일 (로컬 개발 시)
3. Cloudflare Pages 환경 변수 (프로덕션)

현재 브라우저의 localStorage에 이전 API 키(`...Hd0SLSiI`)가 저장되어 있어서, 새로 설정한 `.env.local` 파일의 키보다 우선 사용되고 있습니다.

## 해결 방법

### 방법 1: 브라우저에서 직접 변경 (가장 빠름) 🚀

1. 웹 애플리케이션을 브라우저로 엽니다
2. **F12**를 눌러 개발자 도구를 엽니다
3. **Console** 탭으로 이동합니다
4. 다음 코드를 복사해서 붙여넣고 **Enter**를 누릅니다:

```javascript
localStorage.setItem('GEMINI_API_KEY', 'AIzaSyDOVqA7HP5yRZWalhEu12ECrhqP2R3cetg'); 
localStorage.setItem('GEMINI_API_KEYS', JSON.stringify([{id: Date.now().toString(), key: 'AIzaSyDOVqA7HP5yRZWalhEu12ECrhqP2R3cetg', name: 'Primary Key', isActive: true, usageCount: 0, lastUsed: null}])); 
location.reload();
```

페이지가 자동으로 새로고침되고 새 API 키가 적용됩니다!

### 방법 2: 애플리케이션 내 설정 메뉴

1. 웹 애플리케이션 상단의 **⚙️ 설정** 버튼 클릭
2. **API 키 설정** 메뉴 선택
3. Gemini API Key 필드에 새 키 입력:
   ```
   AIzaSyDOVqA7HP5yRZWalhEu12ECrhqP2R3cetg
   ```
4. **저장하기** 버튼 클릭

### 방법 3: localStorage 초기화 후 재시작

```javascript
// 개발자 도구 콘솔에서 실행
localStorage.removeItem('GEMINI_API_KEY');
localStorage.removeItem('GEMINI_API_KEYS');
localStorage.removeItem('GLOBAL_GEMINI_API_KEY');
location.reload();
```

그 후 `.env.local`의 키가 자동으로 적용됩니다.

## 확인 방법

개발자 도구 콘솔에서 다음을 실행:
```javascript
console.log('현재 키:', localStorage.getItem('GEMINI_API_KEY'));
```

출력:
```
현재 키: AIzaSyDOVqA7HP5yRZWalhEu12ECrhqP2R3cetg
```

이제 콘솔 로그가 다음과 같이 변경됩니다:
```
📊 API 키 상태:
  키 1: ...2R3cetg - ✅ 사용 가능
```

## 추가 정보

### API 키 우선순위
1. **localStorage** (브라우저) - 가장 높음
2. 서버 API (`/api-keys/get`)
3. `.env.local` (로컬 개발)
4. Cloudflare Pages 환경 변수 (프로덕션)

### 보안 참고
- 개발 중에는 localStorage 사용이 편리합니다
- 프로덕션에서는 반드시 Cloudflare Pages 환경 변수를 사용하세요
- API 키를 Git에 커밋하지 마세요

## 관련 파일
- `update-api-key.js` - 브라우저 콘솔에서 실행할 스크립트
- `.env.local` - 로컬 개발용 환경 변수 (이미 설정됨)
- `GOOGLE_API_KEY_SETUP.md` - 전체 설정 가이드
