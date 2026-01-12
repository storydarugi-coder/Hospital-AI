# Hospital AI API Server

의료 콘텐츠 생성 시스템의 백엔드 API 서버입니다.

## 기능

- ✅ 콘텐츠 저장 및 조회
- ✅ In-memory 저장소 (추후 DB 연동 가능)
- ✅ RESTful API 엔드포인트
- ✅ CORS 지원
- ✅ 에러 처리

## 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행 (nodemon)
npm run dev

# 프로덕션 서버 실행
npm start
```

## API 엔드포인트

### Health Check
```
GET /health
```

응답:
```json
{
  "status": "ok",
  "message": "Hospital AI API Server is running",
  "timestamp": "2026-01-12T10:10:21.000Z"
}
```

### 콘텐츠 저장
```
POST /content/save
```

요청:
```json
{
  "title": "제목",
  "content": "<h1>HTML 콘텐츠</h1>",
  "category": "내과",
  "postType": "blog",
  "metadata": {
    "keywords": "키워드1, 키워드2",
    "seoScore": 85,
    "aiSmellScore": 5
  }
}
```

응답:
```json
{
  "success": true,
  "id": 1,
  "message": "콘텐츠가 성공적으로 저장되었습니다."
}
```

### 콘텐츠 목록 조회
```
GET /content/list
```

쿼리 파라미터:
- `category` (optional): 카테고리 필터
- `postType` (optional): 게시물 유형 필터
- `limit` (optional): 페이지당 아이템 수 (기본: 50)
- `offset` (optional): 시작 위치 (기본: 0)

응답:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "제목",
      "content": "내용",
      "category": "내과",
      "postType": "blog",
      "metadata": {...},
      "createdAt": "2026-01-12T10:10:21.000Z",
      "updatedAt": "2026-01-12T10:10:21.000Z"
    }
  ],
  "pagination": {
    "total": 100,
    "limit": 50,
    "offset": 0
  }
}
```

### 특정 콘텐츠 조회
```
GET /content/:id
```

응답:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "제목",
    "content": "내용",
    ...
  }
}
```

### 콘텐츠 삭제
```
DELETE /content/:id
```

응답:
```json
{
  "success": true,
  "message": "콘텐츠가 삭제되었습니다."
}
```

### 통계 조회
```
GET /stats
```

응답:
```json
{
  "success": true,
  "data": {
    "totalContents": 100,
    "byPostType": {
      "blog": 50,
      "card_news": 30,
      "press_release": 20
    },
    "byCategory": {
      "내과": 30,
      "외과": 25,
      ...
    }
  }
}
```

## 환경 변수

`.env` 파일을 생성하여 환경 변수를 설정할 수 있습니다:

```env
PORT=3001
NODE_ENV=development
```

## 데이터베이스 연동

현재는 In-memory 저장소를 사용하고 있습니다. 프로덕션 환경에서는 다음 중 하나로 변경할 수 있습니다:

- MongoDB
- PostgreSQL
- MySQL
- Supabase

## 공개 URL

개발 중인 API 서버:
```
https://3001-i7sb1xuomdisn8dq0jtnt-c07dda5e.sandbox.novita.ai
```

Health Check:
```
https://3001-i7sb1xuomdisn8dq0jtnt-c07dda5e.sandbox.novita.ai/health
```

## 라이센스

MIT
