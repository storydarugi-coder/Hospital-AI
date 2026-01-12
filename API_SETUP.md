# API 키 설정 가이드

## 🔑 API 키 서버 저장 기능

Hospital AI는 API 키를 서버에 저장하여 여러 디바이스에서 공유할 수 있습니다.

## 🚀 사용 방법

### 1. API 키 입력

1. 웹사이트 우측 상단의 **⚙️ 설정** 버튼 클릭
2. API 키 입력창이 나타남
3. Gemini API 키 입력 (필수)
4. OpenAI API 키 입력 (선택사항)
5. **저장하기** 버튼 클릭

### 2. API 키 발급받기

#### Gemini API Key (필수)
- 발급 페이지: https://aistudio.google.com/apikey
- 무료 할당량: 매일 15개 요청
- 형식: `AIzaSy...`

#### OpenAI API Key (선택사항)
- 발급 페이지: https://platform.openai.com/api-keys
- 사용량에 따라 과금
- 형식: `sk-...`

### 3. API 키 관리

#### 저장된 키 확인
- 설정 모달을 다시 열면 마스킹된 키가 표시됨
- 예: `••••••••••••••••`

#### 키 변경
1. 설정 모달 열기
2. 새 API 키 입력
3. 저장하기 클릭

#### 키 삭제
1. 설정 모달 열기
2. 해당 키 옆의 **삭제** 버튼 클릭
3. 확인 창에서 확인

## 📊 API 엔드포인트

### 저장
```bash
POST /api-keys/save
Content-Type: application/json

{
  "geminiKey": "AIzaSy...",
  "openaiKey": "sk-..."
}
```

응답:
```json
{
  "success": true,
  "message": "API 키가 저장되었습니다.",
  "saved": {
    "gemini": true,
    "openai": true
  }
}
```

### 조회
```bash
GET /api-keys/get
```

응답:
```json
{
  "success": true,
  "apiKeys": {
    "gemini": "AIzaSy...",
    "openai": "sk-..."
  }
}
```

### 삭제
```bash
DELETE /api-keys/delete?type=gemini
# 또는
DELETE /api-keys/delete?type=openai
# 또는 (모두 삭제)
DELETE /api-keys/delete
```

응답:
```json
{
  "success": true,
  "message": "API 키가 삭제되었습니다."
}
```

### Health Check
```bash
GET /health
```

응답:
```json
{
  "status": "ok",
  "message": "Hospital AI API Server is running",
  "timestamp": "2026-01-12T10:22:01.738Z",
  "apiKeys": {
    "gemini": true,
    "openai": false
  }
}
```

## 🔐 보안

### 현재 구현
- ✅ API 키는 서버 메모리에 저장
- ✅ 프론트엔드에서 마스킹 표시
- ✅ HTTPS 통신
- ✅ CORS 설정

### 향후 개선 예정
- 🔒 API 키 암호화 저장
- 🗄️ 데이터베이스 연동
- 👤 사용자별 키 관리
- 📊 사용량 추적 및 제한

## 🛠️ 개발자 정보

### 서버 측 구현
- 파일: `/server/index.js`
- 저장소: In-memory (서버 재시작 시 초기화)
- 추후: MongoDB/PostgreSQL 연동 가능

### 클라이언트 측 구현
- 파일: `/src/components/ApiKeySettings.tsx`
- 파일: `/src/services/apiService.ts`
- 자동 로드: 앱 시작 시 서버에서 키 로드
- 캐싱: localStorage에 저장

### 동기화 플로우
```
1. 사용자가 API 키 입력
   ↓
2. 서버에 저장 (POST /api-keys/save)
   ↓
3. localStorage에도 캐싱
   ↓
4. 앱 시작 시 서버에서 로드 (GET /api-keys/get)
   ↓
5. localStorage에 업데이트
   ↓
6. geminiService.ts에서 사용
```

## 🆘 문제 해결

### API 키가 작동하지 않음
1. 설정 모달에서 키가 제대로 저장되었는지 확인
2. Health Check API로 키 상태 확인: `GET /health`
3. 브라우저 콘솔에서 에러 메시지 확인
4. 페이지 새로고침

### 서버 재시작 후 키가 사라짐
- 현재는 In-memory 저장이므로 서버 재시작 시 초기화됨
- 다시 입력하거나 환경 변수로 설정 가능:
  ```bash
  # server/.env
  DEFAULT_GEMINI_KEY=your_key_here
  ```

### API 키를 공유하고 싶지 않음
- localStorage에만 저장하려면:
  1. 브라우저 개발자 도구 열기
  2. Application → Local Storage
  3. 직접 `GEMINI_API_KEY` 입력

## 📞 문의

API 키 관련 문제는 GitHub Issues에 제보해주세요:
https://github.com/storydarugi-coder/Hospital-AI/issues
