# Google API 키 설정 가이드

## 새 API 키
```
AIzaSyDOVqA7HP5yRZWalhEu12ECrhqP2R3cetg
```

## 🚀 빠른 방법: 브라우저에서 직접 변경 (추천)

1. 웹 애플리케이션을 브라우저로 엽니다
2. **F12** 또는 **Cmd+Option+I** (Mac) / **Ctrl+Shift+I** (Windows)를 눌러 개발자 도구를 엽니다
3. **Console** 탭으로 이동합니다
4. 프로젝트 루트의 `update-api-key.js` 파일 내용을 복사합니다
5. 콘솔에 붙여넣고 **Enter**를 누릅니다
6. "✅ API 키 업데이트 완료!" 메시지가 표시되면 페이지를 새로고침합니다

**또는 한 줄로:**
```javascript
localStorage.setItem('GEMINI_API_KEY', 'AIzaSyDOVqA7HP5yRZWalhEu12ECrhqP2R3cetg'); localStorage.setItem('GEMINI_API_KEYS', JSON.stringify([{id: Date.now().toString(), key: 'AIzaSyDOVqA7HP5yRZWalhEu12ECrhqP2R3cetg', name: 'Primary Key', isActive: true, usageCount: 0, lastUsed: null}])); location.reload();
```

## 1. 로컬 개발 환경 설정 ✅ (완료)

로컬 개발용 `.env.local` 파일이 생성되었습니다:
```bash
VITE_GEMINI_API_KEY=AIzaSyDOVqA7HP5yRZWalhEu12ECrhqP2R3cetg
```

로컬에서 개발 서버를 실행하면 이 API 키가 자동으로 사용됩니다.

## 2. Cloudflare Pages 프로덕션 환경 설정

### 방법 A: Cloudflare 대시보드 (권장)

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) 접속
2. **Workers & Pages** 메뉴로 이동
3. `hospital-ai` 프로젝트 선택
4. **Settings** → **Environment variables** 탭으로 이동
5. **Add variables** 버튼 클릭
6. 다음 환경 변수 추가:
   - **Variable name**: `VITE_GEMINI_API_KEY`
   - **Value**: `AIzaSyDOVqA7HP5yRZWalhEu12ECrhqP2R3cetg`
   - **Environment**: Production (또는 필요한 환경)
7. **Save** 버튼 클릭
8. 프로젝트 재배포 (자동 또는 수동)

### 방법 B: Wrangler CLI (인증 필요)

```bash
# Cloudflare 로그인
npx wrangler login

# API 키 설정
echo "AIzaSyDOVqA7HP5yRZWalhEu12ECrhqP2R3cetg" | npx wrangler pages secret put VITE_GEMINI_API_KEY --project-name hospital-ai
```

## 3. 브라우저에서 직접 설정 (임시)

웹 애플리케이션에서 **설정 → API 키 설정** 메뉴를 통해 브라우저 localStorage에 직접 저장할 수도 있습니다. 하지만 이 방법은:
- 브라우저마다 다시 설정해야 함
- 쿠키/캐시 삭제 시 사라짐
- 임시 테스트용으로만 권장

## 4. 확인 방법

### 로컬 개발
```bash
npm run dev
# 또는
npx wrangler pages dev
```

브라우저에서 `http://localhost:5173` 접속 후 콘텐츠 생성 테스트

### 프로덕션
배포 후 프로덕션 URL에서 콘텐츠 생성이 정상 작동하는지 확인

## 5. 보안 참고사항

⚠️ **중요**: 
- `.env.local` 파일은 절대 Git에 커밋하지 마세요 (`.gitignore`에 이미 포함됨)
- API 키는 반드시 환경 변수로 관리하세요
- 공개 저장소에 API 키를 노출하지 마세요

## 6. API 키 사용 현황

이 API 키는 다음 용도로 사용됩니다:
- **Gemini AI API**: 콘텐츠 생성, 이미지 생성, 팩트 체크, SEO 최적화 등
- 프로젝트의 핵심 기능이므로 반드시 설정이 필요합니다

## 문제 해결

### "API Key가 설정되지 않았습니다" 오류
1. 로컬: `.env.local` 파일 존재 확인
2. 프로덕션: Cloudflare Pages 환경 변수 설정 확인
3. 브라우저: localStorage의 `GEMINI_API_KEY` 확인

### API 호출 실패
1. API 키가 올바른지 확인
2. Google AI Studio에서 API 키 활성화 상태 확인
3. API 사용량 한도 초과 여부 확인
