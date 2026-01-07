# Hospital Toolchain - 병원 블로그 마케팅 전용

> 🚀 최신 업데이트: GPT-5.2 Pro 메인 엔진 적용 + Gemini 검색 폴백

## 프로젝트 개요
- **이름**: Hospital Toolchain
- **목적**: 의료광고법을 준수하는 블로그 콘텐츠를 AI로 자동 생성
- **기술 스택**: Hono + React + Cloudflare Pages + Google Gemini API

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
│   ├── services/
│   │   └── geminiService.ts # Gemini API 서비스
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

---
마지막 업데이트: 2026-01-07
