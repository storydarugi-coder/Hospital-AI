# Cloudflare Pages 배포 가이드

## 🚀 배포 설정

### 1. Cloudflare Pages 프로젝트 설정

#### Build Configuration
```
Build command: npm run build
Build output directory: dist
Root directory: /
```

#### Environment Variables (Production & Preview)
```
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

---

## 📁 Functions API 구조

### API 엔드포인트

모든 API는 `/api/*` 경로로 자동 라우팅됩니다.

```
functions/
├── api/
│   ├── medical-law/
│   │   ├── fetch.ts          → POST /api/medical-law/fetch
│   │   └── updates.ts         → GET  /api/medical-law/updates
│   ├── crawler.ts             → POST /api/crawler
│   ├── google/
│   │   └── search.ts          → POST /api/google/search
│   └── ...
```

---

## ⚠️ 현재 이슈: 404 Not Found

### 문제
```
POST https://story-darugi.com/api/medical-law/fetch 404 (Not Found)
```

### 원인
Cloudflare Pages Functions가 배포되지 않았을 가능성

### 해결 방법

#### ✅ 확인 사항

1. **functions 폴더가 Git에 커밋되어 있는가?**
   ```bash
   git ls-files functions/
   ```
   → ✅ 확인 완료! 모든 파일 커밋됨

2. **wrangler.toml 설정이 올바른가?**
   ```toml
   name = "hospital-ai"
   pages_build_output_dir = "dist"
   ```
   → ✅ 확인 완료!

3. **Cloudflare Pages 빌드 설정이 올바른가?**
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: `/` (또는 비워두기)
   
   → ⚠️ **여기서 확인 필요!**

---

## 🔧 Cloudflare Pages Dashboard 설정

### 1. Cloudflare Dashboard 접속
https://dash.cloudflare.com/

### 2. Pages 프로젝트 선택
`hospital-ai` (또는 프로젝트 이름)

### 3. Settings → Build & deployments

#### Framework preset
- **선택**: `None` 또는 `Vite`

#### Build configuration
```
Build command:       npm run build
Build output directory: dist
Root directory:      (비워두거나 /)
```

#### Node.js version
- **권장**: `18` 또는 `20`

### 4. Functions 설정 확인

Cloudflare Pages는 `functions/` 폴더를 자동으로 인식합니다.

- ✅ `functions/api/medical-law/fetch.ts` → `/api/medical-law/fetch`
- ✅ TypeScript 지원 (자동 컴파일)
- ✅ CORS 헤더 설정됨

---

## 🧪 로컬 테스트

### 1. 로컬 개발 서버 (Functions 포함)
```bash
npm run dev:sandbox
```

이 명령어는 Wrangler를 사용하여 Cloudflare Functions를 로컬에서 실행합니다.

### 2. Functions API 테스트
```bash
curl -X POST http://localhost:3000/api/medical-law/fetch \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=230993"}'
```

---

## 🚨 배포 후 확인사항

### 1. Functions 배포 확인
Cloudflare Dashboard → Pages → `hospital-ai` → Functions

여기서 배포된 Functions 목록을 확인할 수 있습니다.

### 2. API 엔드포인트 테스트
```bash
# Production
curl https://story-darugi.com/api/medical-law/fetch \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=230993"}'
```

### 3. 브라우저 Console 확인
- 404 에러가 사라졌는지 확인
- API 호출이 성공하는지 확인

---

## 🔍 문제 해결

### Case 1: Functions가 배포되지 않음

**원인**: Cloudflare Pages가 `functions/` 폴더를 인식하지 못함

**해결**:
1. Cloudflare Dashboard → Settings → Build & deployments
2. "Retry deployment" 클릭
3. 배포 로그에서 "Functions" 섹션 확인

### Case 2: TypeScript Functions가 작동하지 않음

**원인**: Cloudflare Pages가 `.ts` 파일을 컴파일하지 못함

**해결**:
```bash
# functions/tsconfig.json 확인
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020"],
    "skipLibCheck": true
  }
}
```

### Case 3: CORS 에러

**원인**: CORS 헤더 누락

**해결**: `fetch.ts`에 이미 CORS 헤더가 설정되어 있음
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
```

---

## 📝 배포 체크리스트

- [ ] functions 폴더가 Git에 커밋되어 있음
- [ ] wrangler.toml 설정이 올바름
- [ ] Cloudflare Pages Build 설정이 올바름
- [ ] 환경 변수가 설정되어 있음
- [ ] 배포 후 Functions 탭에서 확인
- [ ] API 엔드포인트 테스트 성공

---

## 🆘 추가 도움말

### Cloudflare Pages Functions 문서
https://developers.cloudflare.com/pages/functions/

### Wrangler CLI 문서
https://developers.cloudflare.com/workers/wrangler/

### TypeScript in Functions
https://developers.cloudflare.com/pages/functions/typescript/
