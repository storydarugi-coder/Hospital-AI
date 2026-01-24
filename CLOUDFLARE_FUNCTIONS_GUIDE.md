# Cloudflare Pages Functions API 배포 가이드

## 🎯 개요

Express 백엔드를 **Cloudflare Pages Functions**로 마이그레이션했어요!
이제 프론트엔드와 백엔드가 **같은 도메인**에서 작동해요.

```
Before: https://story-darugi.com (프론트엔드)
        https://sandbox-url:3001 (백엔드 - CORS 에러!)

After:  https://story-darugi.com (프론트엔드)
        https://story-darugi.com/api/* (백엔드 - 같은 도메인!)
```

---

## 📋 배포 전 준비사항

### 1. Cloudflare KV Namespace 생성

Cloudflare Dashboard에서 KV를 생성해야 해요:

```bash
# Wrangler CLI로 생성
npx wrangler kv:namespace create CONTENT_STORAGE

# 출력 예시:
# ⛅️ wrangler 3.x.x
# 🌀 Creating namespace with title "hospital-ai-CONTENT_STORAGE"
# ✨ Success!
# Add the following to your configuration file in your kv_namespaces array:
# { binding = "CONTENT_STORAGE", id = "abc123def456..." }
```

### 2. `wrangler.jsonc` 업데이트

생성된 KV Namespace ID를 `wrangler.jsonc`에 추가하세요:

```jsonc
{
  "kv_namespaces": [
    {
      "binding": "CONTENT_STORAGE",
      "id": "여기에_생성된_KV_ID_입력"  // ← 이 부분 수정!
    }
  ]
}
```

### 3. Cloudflare Pages 환경 변수 설정

Cloudflare Dashboard → Pages → hospital-ai → Settings → Environment variables

추가할 환경 변수:
- `GEMINI_API_KEY`: Gemini API 키 (선택)
- `OPENAI_API_KEY`: OpenAI API 키 (선택)

---

## 🚀 API 엔드포인트

### ✅ 사용 가능한 API

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/api/health` | GET | 서버 상태 확인 |
| `/api/api-keys/get` | GET | API 키 조회 (환경변수) |
| `/api/content/list` | GET | 콘텐츠 목록 조회 |
| `/api/content/save` | POST | 콘텐츠 저장 |
| `/api/stats` | GET | 통계 조회 |

### 📝 API 예시

#### 1. Health Check
```bash
curl https://story-darugi.com/api/health

# 응답:
{
  "status": "ok",
  "message": "Hospital AI API Server is running",
  "timestamp": "2026-01-24T01:30:00.000Z",
  "apiKeys": {
    "gemini": false,
    "openai": true
  }
}
```

#### 2. API 키 조회
```bash
curl https://story-darugi.com/api/api-keys/get

# 응답:
{
  "success": true,
  "apiKeys": {
    "gemini": null,
    "openai": "sk-..."
  }
}
```

#### 3. 콘텐츠 목록
```bash
curl "https://story-darugi.com/api/content/list?limit=10"

# 응답:
{
  "success": true,
  "data": [ /* 콘텐츠 배열 */ ],
  "pagination": {
    "total": 5,
    "limit": 10,
    "offset": 0
  }
}
```

#### 4. 콘텐츠 저장
```bash
curl -X POST https://story-darugi.com/api/content/save \
  -H "Content-Type: application/json" \
  -d '{
    "title": "테스트 블로그",
    "content": "내용...",
    "category": "병원소개",
    "postType": "blog"
  }'

# 응답:
{
  "success": true,
  "id": 1,
  "message": "콘텐츠가 성공적으로 저장되었습니다."
}
```

---

## 🔧 로컬 개발 환경 설정

### 1. 백엔드 API 서버 실행 (Express)

개발 중에는 **Express 서버**를 계속 사용하세요:

```bash
# 백엔드 시작
pm2 start server/index.js --name hospital-api

# 프론트엔드 시작
npm run dev
```

`.env` 파일에서 로컬 백엔드 URL 설정:
```env
VITE_API_URL=http://localhost:3001
```

### 2. Functions 로컬 테스트 (선택)

Cloudflare Pages Functions를 로컬에서 테스트하려면:

```bash
# KV 로컬 바인딩 생성
npx wrangler kv:namespace create CONTENT_STORAGE --preview

# 개발 서버 실행
npx wrangler pages dev dist --kv=CONTENT_STORAGE

# 또는
npm run preview
```

---

## 📦 Cloudflare KV 데이터 구조

### KV Keys:

| 키 | 타입 | 설명 |
|----|------|------|
| `content_list` | JSON Array | 전체 콘텐츠 목록 |
| `next_id` | String | 다음 콘텐츠 ID |
| `content_1` | JSON Object | 개별 콘텐츠 (ID별) |
| `content_2` | JSON Object | 개별 콘텐츠 (ID별) |
| ... | ... | ... |

### 예시:

**content_list** (전체 목록):
```json
[
  {
    "id": 1,
    "title": "블로그 제목",
    "category": "병원소개",
    "postType": "blog",
    "createdAt": "2026-01-24T01:00:00.000Z"
  },
  ...
]
```

**content_1** (개별 콘텐츠):
```json
{
  "id": 1,
  "title": "블로그 제목",
  "content": "전체 내용...",
  "category": "병원소개",
  "postType": "blog",
  "metadata": {},
  "createdAt": "2026-01-24T01:00:00.000Z",
  "updatedAt": "2026-01-24T01:00:00.000Z"
}
```

---

## 🎨 CORS 설정

모든 엔드포인트에 CORS 헤더가 자동으로 추가돼요:

```typescript
headers: {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
}
```

OPTIONS preflight 요청도 자동으로 처리돼요!

---

## 📊 배포 후 확인사항

### 1. KV Namespace 확인
Cloudflare Dashboard → Workers & Pages → KV → CONTENT_STORAGE

### 2. API 테스트
```bash
# Health check
curl https://story-darugi.com/api/health

# 200 OK 응답 확인
```

### 3. Admin 페이지 테스트
1. https://story-darugi.com/#admin 접속
2. 비밀번호 `0000` 입력
3. API 설정 탭에서 Gemini 키 입력
4. 콘텐츠 관리 탭에서 목록 확인

---

## 🐛 문제 해결

### CORS 에러가 여전히 발생하면?

1. **Cloudflare 캐시 삭제**
   - Dashboard → Caching → Purge Everything

2. **브라우저 캐시 삭제**
   - Ctrl+Shift+Delete → 캐시 삭제

3. **Functions 로그 확인**
   - Dashboard → Workers & Pages → hospital-ai → Functions → Logs

### KV 데이터가 안 보이면?

```bash
# KV 목록 확인
npx wrangler kv:key list --namespace-id=<YOUR_KV_ID>

# 특정 키 조회
npx wrangler kv:key get "content_list" --namespace-id=<YOUR_KV_ID>
```

---

## 🎉 완료!

이제 **프론트엔드와 백엔드가 같은 도메인**에서 작동해요!

```
✅ https://story-darugi.com (프론트엔드)
✅ https://story-darugi.com/api/* (백엔드 API)
✅ CORS 에러 없음!
✅ 모든 팀원이 함께 사용 가능!
```

배포 성공하면 Admin 페이지에서 테스트해 보세요! 🚀
