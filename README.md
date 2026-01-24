# Hospital Toolchain - 병원 블로그 마케팅 전용

> 🚀 최신 업데이트: GPT-5.2 5단계 프롬프트 시스템 적용!

## 프로젝트 개요
- **이름**: Hospital Toolchain
- **목적**: 의료광고법을 준수하는 블로그 콘텐츠를 AI로 자동 생성
- **기술 스택**: Hono + React + Cloudflare Pages + Google Gemini API + OpenAI GPT-5.2

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
- **프로덕션**: https://story-darugi.com
- **API Health Check**: https://story-darugi.com/api/health
- **Cloudflare Pages**: https://ai-hospital.pages.dev

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
- **API 서버**: Cloudflare Pages Functions (/api/*)
- **데이터베이스**: Cloudflare KV Storage (CONTENT_STORAGE)
- **AI API**: Google Gemini API (텍스트 생성 + 이미지 생성) + OpenAI GPT-5.2
- **상태 관리**: React useState/useEffect + Context API

### Cloudflare Pages Functions API

프로젝트는 Cloudflare Pages Functions를 사용하여 서버리스 API를 제공합니다:

#### 📡 **API Endpoints**
- `GET /api/health` - 헬스 체크
- `GET /api/api-keys/get` - API 키 조회
- `POST /api/api-keys/save` - API 키 저장
- `DELETE /api/api-keys/delete` - API 키 삭제
- `GET /api/content/list` - 콘텐츠 목록
- `POST /api/content/save` - 콘텐츠 저장
- `GET /api/stats` - 통계 조회

#### 🗄️ **KV Storage**
- **Namespace ID**: `5bb13721765b4a74b0ab855c92b2e9a9`
- **Binding**: `CONTENT_STORAGE`
- **용도**: 생성된 콘텐츠 영구 저장 및 팀 공유

## 배포
- **플랫폼**: Cloudflare Pages
- **프로덕션**: https://story-darugi.com
- **기술 스택**: React 19 + TypeScript + TailwindCSS + Cloudflare Pages Functions

### 🚀 Cloudflare Pages 배포 가이드

#### **환경 변수 설정 (필수)**

Cloudflare Dashboard에서 설정:
1. **Workers & Pages** → **ai-hospital** → **Settings** → **Environment variables**
2. 추가할 환경 변수:
   - `GEMINI_API_KEY`: Google Gemini API 키
   - `OPENAI_API_KEY`: OpenAI API 키 (선택)

#### **자동 배포 (GitHub Actions)**

`.github/workflows/deploy.yml` 파일을 생성하여 자동 배포 설정:

```yaml
name: Deploy to Cloudflare Pages

on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: write
      pull-requests: write
    name: Deploy to Cloudflare Pages
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: ai-hospital
          directory: dist
          gitHubToken: ${{ secrets.GITHUB_TOKEN }}
          wranglerVersion: '3'
```

#### **GitHub Secrets 설정**

Repository Settings에서 추가:
- `CLOUDFLARE_API_TOKEN`: Cloudflare API 토큰 (Edit Cloudflare Workers 권한)
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare 계정 ID

#### **수동 배포**

```bash
# Wrangler CLI 사용
npx wrangler pages deploy dist --project-name=ai-hospital
```

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
├── functions/                   # 🆕 Cloudflare Pages Functions
│   └── api/
│       ├── health.ts           # Health check API
│       ├── stats.ts            # 통계 API
│       ├── api-keys/
│       │   ├── get.ts          # API 키 조회
│       │   ├── save.ts         # API 키 저장
│       │   └── delete.ts       # API 키 삭제
│       └── content/
│           ├── list.ts         # 콘텐츠 목록
│           └── save.ts         # 콘텐츠 저장
├── src/
│   ├── client.tsx              # React 클라이언트 엔트리
│   ├── App.tsx                 # 메인 앱 컴포넌트
│   ├── types.ts                # TypeScript 타입 정의
│   ├── constants.ts            # 상수 (진료과, 페르소나 등)
│   ├── components/
│   │   ├── InputForm.tsx       # 입력 폼 컴포넌트
│   │   ├── ResultPreview.tsx   # 결과 미리보기 컴포넌트
│   │   ├── AdminPage.tsx       # 관리자 페이지
│   │   └── ApiKeySettings.tsx  # API 키 설정
│   ├── lib/
│   │   └── gpt52-prompts-staged.ts # GPT-5.2 단계별 프롬프트
│   ├── services/
│   │   ├── geminiService.ts    # Gemini API 서비스 (단계별 처리)
│   │   └── apiService.ts       # 🆕 Backend API 서비스
│   └── utils/
│       └── cssThemes.ts        # CSS 테마 유틸리티
├── public/
│   └── _routes.json            # 🆕 Cloudflare Pages 라우팅 설정
├── wrangler.jsonc              # 🆕 Wrangler 설정 (KV binding)
├── vite.config.ts              # Vite 설정
├── tsconfig.json               # TypeScript 설정
└── package.json                # 의존성 관리
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
마지막 업데이트: 2026-01-08
