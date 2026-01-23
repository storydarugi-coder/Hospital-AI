# Hospital Toolchain - 병원 블로그 마케팅 전용

> 🚀 최신 업데이트 (2026-01-20): 네이버 블로그 검색 및 크롤링 시스템 대폭 개선!

## 프로젝트 개요
- **이름**: Hospital Toolchain
- **목적**: 의료광고법을 준수하는 블로그 콘텐츠를 AI로 자동 생성
- **기술 스택**: Hono + React + Cloudflare Pages + Google Gemini API + OpenAI GPT-5.2

## 🆕 최신 업데이트 (2026-01-20)

### 네이버 블로그 검색 및 크롤링 시스템 개선

#### 1. 네이버 검색 파싱 로직 업데이트
- **문제**: 네이버가 HTML 구조를 변경하여 검색 결과를 찾을 수 없었음
- **해결**: 최신 HTML 구조에 맞게 파싱 로직 개선
  - `headline1` 클래스를 사용한 제목 추출
  - `body1` 클래스를 사용한 설명 추출
  - `profile-info-title-text`를 사용한 블로거 이름 추출
  - HTML 태그 제거 로직 개선

#### 2. 네이버 블로그 크롤러 개선
- **문제**: 블로그 내용이 15~50자만 추출되어 유사도 검사 실패
- **원인**: 네이버 블로그는 iframe을 사용하며, 실제 내용은 PostView URL에 존재
- **해결**: PostView URL로 자동 변환하여 본문 추출
  - `https://blog.naver.com/blogId/logNo` → `https://blog.naver.com/PostView.naver?blogId=...&logNo=...`
  - `se-text-paragraph` 클래스를 사용한 정확한 본문 추출
  - HTML 엔티티 올바르게 디코딩
  - 최대 문자 제한 10,000자로 증가
- **결과**: 35개 문단, 2,757자 성공적으로 추출 (테스트 완료)

#### 3. 최근 1년 날짜 필터 추가
- **문제**: 오래된 블로그(2020년 등) 포함으로 인한 품질 저하
- **해결**: 동적으로 최근 1년 콘텐츠만 검색
  - 현재 날짜 기준 자동 계산 (예: 2025.01.20 ~ 2026.01.20)
  - URL 파라미터 `&nso=so:r,p:1y` 추가
  - 최신 의료 정보 및 트렌드 반영
- **결과**: 유사도 검사 품질 향상, 관련성 높은 콘텐츠만 분석

#### 4. 유사도 검사 기능 정상화
- 네이버 블로그 검색 → 본문 크롤링 → 유사도 분석 전체 파이프라인 정상 작동
- 크롤링 성공률 대폭 향상
- 최신 콘텐츠만 분석하여 정확도 개선

## ⭐ 새로운 기능: 단계별 프롬프트 시스템

GPT-5.2의 토큰 제한과 프롬프트 복잡도 문제를 해결하기 위해 **5단계 프로세스**를 도입했습니다:

### 📋 5단계 프로세스

1. **1단계: 글 생성 (기본 규칙)**
   - 의료법 핵심 규칙만 적용
   - 기본 글쓰기 스타일로 초안 작성
   - 주제에 맞는 풍부한 콘텐츠 생성

2. **2단계: AI 냄새 제거**
   - 반복 표현 제거 ("~수 있습니다" 연속 사용 등)
   - 교과서식 구조 탈피
   - 자연스러운 문장으로 수정

3. **3단계: SEO 최적화**
   - 키워드 밀도 조정 (1.5~2.5%)
   - 소제목 최적화
   - 검색 의도 반영
   - 목표: 90점 이상

4. **4단계: 의료법 검증**
   - 금지 표현 체크 및 수정
   - 안전 표현 적용
   - CTA 완곡화

5. **5단계: 최종 다듬기**
   - 전체 흐름 검토
   - 마지막 품질 체크
   - 통합 점수 확인 (모든 카테고리 85점 이상)

### 📊 장점

- ✅ **토큰 효율성**: 각 단계별로 짧은 프롬프트 사용
- ✅ **품질 향상**: 각 단계마다 집중적인 개선
- ✅ **디버깅 용이**: 어느 단계에서 문제가 생겼는지 명확히 파악
- ✅ **안정성**: 이전 단계 결과 유지로 오류 방지

## 주요 기능
- ✅ 실시간 트렌드 키워드 분석
- ✅ SEO 최적화 제목 자동 생성
- ✅ 의료광고법 준수 안전 점수 확인
- ✅ AI 이미지 생성 (실사/3D 일러스트)
- ✅ 블로그 포스팅 & 카드뉴스 제작
- ✅ 5가지 CSS 테마 (모던/프리미엄/미니멀/따뜻한/의료전문)
- ✅ 벤치마킹 URL 분석 및 스타일 모방
- ✅ AI 정밀보정 기능
- ✅ 이미지 재생성 (프롬프트 수정)
- ✅ 블로그 복사 기능 (HTML 포맷)

## URLs
- **개발 서버**: https://3000-iiqpthosrwwxpxufn4au8-2b54fc91.sandbox.novita.ai
- **API Health Check**: /api/health

## 사용 방법
1. API Key 설정
   - Google AI Studio에서 Gemini API 키 발급
   - 앱 설정(⚙️)에서 API 키 입력
   
2. 콘텐츠 생성
   - 진료과 선택 (내과, 정형외과, 피부과 등 18개)
   - 트렌드 키워드 분석 또는 직접 주제 입력
   - 이미지 스타일 선택 (실사/일러스트)
   - CSS 테마 선택
   - "병원 블로그 원고 생성" 클릭

3. 결과 활용
   - 미리보기에서 직접 편집 가능
   - AI 정밀보정으로 수정
   - 이미지 클릭하여 재생성
   - "티스토리 블로그로 복사" 클릭

## 데이터 아키텍처
- **API 연동**: Google Gemini API (텍스트 생성 + 이미지 생성)
- **저장소**: LocalStorage (API 키 저장)
- **상태 관리**: React useState/useEffect

## 배포
- **플랫폼**: Cloudflare Pages
- **상태**: 개발 서버 가동 중
- **기술 스택**: Hono 4.x + React 19 + TypeScript + TailwindCSS

### 🔧 Cloudflare 환경변수 설정 (필수)

유사도 검사 기능을 사용하려면 다음 환경변수를 **Cloudflare Dashboard**에서 설정해야 합니다:

#### 1. Google Custom Search API 설정

1. **Google Cloud Console**에서 API 키 발급:
   - https://console.cloud.google.com/
   - "API 및 서비스" > "사용자 인증 정보"
   - "사용자 인증 정보 만들기" > "API 키"
   - API 키 생성 후 복사

2. **Programmable Search Engine** 생성:
   - https://programmablesearchengine.google.com/
   - "새 검색 엔진 만들기"
   - 검색할 사이트: `blog.naver.com`, `-namu.wiki`
   - 검색 엔진 ID 복사

3. **Cloudflare Dashboard에서 환경변수 설정**:
   - Cloudflare Dashboard > Workers & Pages > 프로젝트 선택
   - Settings > Environment variables
   - 다음 변수 추가:
     - `GOOGLE_API_KEY`: Google API 키
     - `GOOGLE_SEARCH_ENGINE_ID`: Programmable Search Engine ID

#### ⚠️ 주의사항

- Google Custom Search API는 **무료 할당량 100쿼리/일** 제공
- 유사도 검사 시 쿼리 수가 많으면 할당량 초과 가능
- 상용 서비스의 경우 유료 플랜 고려 필요

## 개발 명령어
```bash
# 개발 서버 시작
npm run dev

# 빌드
npm run build

# 샌드박스 배포 테스트
npm run dev:sandbox

# Cloudflare Pages 배포
npm run deploy
```

## 파일 구조
```
webapp/
├── src/
│   ├── index.tsx           # Hono 서버 엔트리
│   ├── client.tsx          # React 클라이언트 엔트리
│   ├── App.tsx             # 메인 앱 컴포넌트
│   ├── types.ts            # TypeScript 타입 정의
│   ├── constants.ts        # 상수 (진료과, 페르소나 등)
│   ├── components/
│   │   ├── InputForm.tsx   # 입력 폼 컴포넌트
│   │   └── ResultPreview.tsx # 결과 미리보기 컴포넌트
│   ├── lib/
│   │   └── gpt52-prompts-staged.ts # 🆕 GPT-5.2 단계별 프롬프트
│   ├── services/
│   │   └── geminiService.ts # Gemini API 서비스 (단계별 처리 포함)
│   └── utils/
│       └── cssThemes.ts    # CSS 테마 유틸리티
├── public/
│   └── _routes.json        # Cloudflare Pages 라우팅
├── wrangler.jsonc          # Wrangler 설정
├── vite.config.ts          # Vite 설정
├── tsconfig.json           # TypeScript 설정
└── ecosystem.config.cjs    # PM2 설정
```

## 라이선스
Private - 비공개 프로젝트

## 기술 문서

### 단계별 프롬프트 시스템 상세

각 단계는 독립적인 프롬프트를 사용하여 GPT-5.2를 호출합니다:

- **`getStage1_ContentGeneration()`**: 의료법 핵심 규칙 + 기본 글쓰기
- **`getStage2_RemoveAiSmell()`**: AI 냄새 패턴 제거
- **`getStage3_SeoOptimization()`**: SEO 키워드 최적화
- **`getStage4_MedicalLawCheck()`**: 의료법 검증
- **`getStage5_FinalPolish()`**: 최종 품질 체크

각 단계는 이전 단계의 결과를 입력으로 받아 개선하며, 오류 발생 시 이전 단계 결과를 유지합니다.

### GPT-5.2 vs Gemini 선택 로직

1. **LocalStorage에서 AI Provider 설정 읽기**
   - `AI_PROVIDER_SETTINGS` 키 확인
   - 없으면 OpenAI 키 존재 여부로 판단

2. **GPT-5.2 선택 시:**
   - Gemini 듀얼 검색으로 정보 수집
   - 5단계 프롬프트 시스템으로 글 작성
   - 각 단계마다 진행 상황 표시

3. **Gemini 선택 시:**
   - Gemini 검색 + 생성을 한 번에 처리
   - 단일 프롬프트 사용

---
마지막 업데이트: 2026-01-20

## 변경 이력

### 2026-01-20
- 네이버 블로그 검색 파싱 로직 업데이트 (최신 HTML 구조 대응)
- 네이버 블로그 크롤러 개선 (PostView URL 사용, 본문 추출 정확도 향상)
- 최근 1년 날짜 필터 추가 (동적 날짜 계산, 최신 콘텐츠만 검색)
- 유사도 검사 기능 정상화

### 2026-01-08
- GPT-5.2 5단계 프롬프트 시스템 도입
- 토큰 효율성 및 품질 향상
