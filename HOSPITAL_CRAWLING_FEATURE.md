# 보도자료 병원 웹사이트 크롤링 기능 추가

생성일: 2026-01-18  
작업: 병원 사이트 크롤링으로 병원 강점 자동 분석 및 보도자료 반영

---

## ✅ 요청사항
> "언론보도에 병원 사이트 알려주면 크롤링해서 병원의 장점도 찾아서 쓸 수 있도록 해즈너"

**완료**: 병원 웹사이트 URL을 입력하면 자동으로 크롤링해서 병원의 강점, 특화 서비스, 차별화 요소를 분석하여 보도자료에 반영합니다.

---

## 🆕 추가된 기능

### 1. 병원 웹사이트 입력 필드
**위치**: 보도자료 입력 폼

```tsx
<label>병원 웹사이트 (선택)</label>
<input 
  type="url"
  placeholder="예: https://www.hospital.com"
  // 병원 정보를 자동으로 분석합니다
/>
```

### 2. 크롤링 API 엔드포인트
**위치**: `src/index.tsx`

```typescript
app.post('/api/crawler', async (c) => {
  const { url } = await c.req.json();
  
  // 1. URL 가져오기
  const response = await fetch(url);
  const html = await response.text();
  
  // 2. HTML에서 텍스트 추출
  const textContent = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 5000);
  
  return c.json({ content: textContent });
});
```

### 3. AI 분석 기능
**위치**: `src/services/geminiService.ts` → `generatePressRelease` 함수

```typescript
// 병원 웹사이트 크롤링
if (request.hospitalWebsite) {
  // 1. 크롤링 API 호출
  const crawlResponse = await fetch('/api/crawler', {
    method: 'POST',
    body: JSON.stringify({ url: request.hospitalWebsite })
  });
  
  // 2. Gemini로 병원 강점 분석
  const analysisResult = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `
      다음은 ${hospitalName}의 웹사이트 내용입니다.
      
      [분석 요청]
      1. 병원의 핵심 강점 (3~5개)
      2. 특화 진료과목이나 특별한 의료 서비스
      3. 병원의 차별화된 특징 (장비, 시스템, 의료진 등)
      4. 병원의 비전이나 철학
      5. 수상 경력이나 인증 사항
      
      출력 형식:
      [병원 강점]
      - 강점 1
      - 강점 2
      
      [특화 서비스]
      - 서비스 1
      ...
    `
  });
  
  // 3. 분석 결과를 프롬프트에 추가
  hospitalInfo = `[🏥 ${hospitalName} 병원 정보]\n${analysisResult.text}`;
}
```

---

## 🚀 작동 방식

```
사용자가 병원 웹사이트 URL 입력
         ↓
🏥 "병원 웹사이트 분석 중..." 진행 표시
         ↓
/api/crawler 호출 (서버 크롤링)
         ↓
HTML → 텍스트 변환 (5000자)
         ↓
Gemini AI로 강점 분석
  - 핵심 강점 추출
  - 특화 서비스 파악
  - 차별화 요소 발견
  - 비전/철학 정리
  - 수상/인증 확인
         ↓
분석 결과를 프롬프트에 삽입
         ↓
AI가 병원 강점을 반영한 보도자료 작성
         ↓
✅ 병원 특성이 반영된 보도자료 생성
```

---

## 📊 분석 결과 예시

### 입력
```
병원 웹사이트: https://www.example-hospital.com
```

### 크롤링 결과
```
서울OO병원은 1995년 개원하여...
최첨단 로봇수술 시스템...
대한민국 의료기관 인증...
암센터 특화 진료...
```

### AI 분석 결과
```
[🏥 서울OO병원 병원 정보]

[병원 강점]
- 25년 전통의 종합병원으로 지역 신뢰도 1위
- 최첨단 로봇수술 시스템 5대 보유 (국내 최다)
- 대한민국 의료기관 인증 획득 (2024년)
- 암센터 특화로 연 5000건 수술 실적

[특화 서비스]
- 로봇 수술 특화 센터 운영
- 24시간 응급의료센터
- 맞춤형 암 치료 프로그램
- 외국인 환자 전담 코디네이터

[차별화 요소]
- 다빈치 Xi 로봇 수술 시스템
- 통합 암 치료 시스템 구축
- 의료진 평균 경력 15년 이상
- 환자 만족도 95% 이상 유지
```

---

## 🎯 보도자료 활용 예시

### 기존 (웹사이트 없음)
```
서울OO병원 홍길동 원장은 "환자 중심 진료를 실천하고 있다"고 밝혔다.
```

### 개선 (웹사이트 분석 후)
```
25년 전통의 서울OO병원은 최첨단 로봇수술 시스템 5대를 보유한 
국내 최다 규모의 로봇수술 센터를 운영하고 있다. 

홍길동 원장은 "2024년 대한민국 의료기관 인증을 획득하며 
안전성과 신뢰도를 인정받았다"며 "암센터 특화 진료로 
연 5000건의 수술 실적을 달성하고 있다"고 강조했다.

특히 이 병원은 다빈치 Xi 로봇 수술 시스템과 통합 암 치료 
시스템을 구축하여 환자 만족도 95% 이상을 유지하고 있으며...
```

**차이점**: 구체적인 수치, 인증, 실적이 포함되어 신뢰도와 임팩트가 높아짐!

---

## ⚙️ 변경 파일

### 1. src/types.ts
```typescript
export interface GenerationRequest {
  // ...
  hospitalName?: string;
  hospitalWebsite?: string; // ← 추가
  doctorName?: string;
  // ...
}
```

### 2. src/components/InputForm.tsx
```typescript
// State 추가
const [hospitalWebsite, setHospitalWebsite] = useState<string>('');

// UI 추가
<input 
  type="url"
  value={hospitalWebsite}
  onChange={(e) => setHospitalWebsite(e.target.value)}
  placeholder="예: https://www.hospital.com"
/>

// requestData 추가
hospitalWebsite: postType === 'press_release' ? hospitalWebsite : undefined,
```

### 3. src/index.tsx
```typescript
// 크롤링 API 엔드포인트 추가
app.post('/api/crawler', async (c) => { ... });
app.options('/api/crawler', (c) => { ... });
```

### 4. src/services/geminiService.ts
```typescript
// generatePressRelease 함수에 추가
let hospitalInfo = '';
if (request.hospitalWebsite) {
  // 크롤링 + AI 분석
  const crawlData = await fetch('/api/crawler', ...);
  const analysisResult = await ai.models.generateContent(...);
  hospitalInfo = `[🏥 병원 정보]\n${analysisResult.text}`;
}

// 프롬프트에 반영
const pressPrompt = `
  [기본 정보]
  ...
  ${searchResults}
  ${hospitalInfo}  // ← 추가
`;
```

---

## 🛡️ 에러 처리

### 1. URL 없을 때
```typescript
if (!request.hospitalWebsite || !request.hospitalWebsite.trim()) {
  // 크롤링 건너뛰기, 기본 모드로 작성
}
```

### 2. 크롤링 실패
```typescript
try {
  const crawlResponse = await fetch('/api/crawler', ...);
  if (!crawlResponse.ok) {
    console.warn('⚠️ 크롤링 API 실패');
  }
} catch (error) {
  console.warn('⚠️ 병원 웹사이트 분석 실패:', error);
  // 기본 정보로 보도자료 작성 (폴백)
}
```

### 3. AI 분석 실패
```typescript
try {
  const analysisResult = await ai.models.generateContent(...);
} catch (error) {
  console.warn('⚠️ 병원 강점 분석 실패');
  // 크롤링 데이터 없이 작성
}
```

**중요**: 모든 에러 상황에서도 보도자료는 정상 생성됩니다!

---

## 📝 사용 방법

### 1. 보도자료 입력 폼
```
1. 콘텐츠 타입: "보도자료" 선택
2. 병원명 입력 (필수)
3. 병원 웹사이트 입력 (선택) ← 새로 추가!
   - 예: https://www.hospital.com
   - 또는: https://hospital.co.kr
4. 의료진, 주제, 키워드 입력
5. 생성 버튼 클릭
```

### 2. 자동 진행
```
진행 표시:
🔍 최신 의료 정보 검색 중...
🏥 병원 웹사이트 분석 중...  ← 새로 추가!
🗞️ 보도자료 작성 중...
✅ 보도자료 작성 완료!
```

### 3. 결과 확인
병원 웹사이트를 입력한 경우:
- ✅ 병원 강점 자동 반영
- ✅ 특화 서비스 언급
- ✅ 차별화 요소 강조
- ✅ 수상/인증 포함
- ✅ 구체적 수치와 실적

---

## 🆚 이전 vs 현재

| 항목 | 이전 | 현재 |
|------|------|------|
| **병원 정보** | ⚠️ 사용자 입력만 | ✅ **자동 크롤링** |
| **강점 분석** | ❌ 없음 | ✅ **AI 자동 분석** |
| **차별화 요소** | ⚠️ 일반적 표현 | ✅ **병원 특성 반영** |
| **신뢰도** | 보통 | ✅ **높음** (구체적) |
| **작업 시간** | 수동 조사 필요 | ✅ **자동 분석** |

---

## ✨ 결론

**✅ 병원 웹사이트 크롤링 및 강점 분석 기능이 추가되었습니다!**

### 주요 개선 사항
1. ✅ 병원 웹사이트 URL 입력 필드 추가
2. ✅ 자동 크롤링 API 구현
3. ✅ AI 기반 병원 강점 분석
4. ✅ 보도자료에 병원 특성 자동 반영
5. ✅ 신뢰도와 임팩트 대폭 향상

### 활용 효과
- 📊 구체적 수치와 실적 자동 포함
- 🏆 병원 강점과 차별화 요소 강조
- 🎖️ 수상/인증 자동 발견
- 💼 전문성과 신뢰도 향상
- ⏱️ 수동 조사 시간 절약

**이제 병원 웹사이트만 입력하면 자동으로 병원의 강점을 분석해서 보도자료에 반영합니다!** 🎉
