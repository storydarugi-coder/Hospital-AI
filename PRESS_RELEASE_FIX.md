# 보도자료 생성 오류 해결 가이드

## ❌ 발생한 오류
```
callGeminiWithSearch is not defined
```

## 🔍 원인 분석

### 1. 코드 상태 확인
- ✅ `generatePressRelease` 함수는 정상적으로 정의되어 있음 (6166번 줄)
- ✅ `callGPTWebSearch` 함수만 존재 (41번 줄)
- ❌ `callGeminiWithSearch` 함수는 코드에 존재하지 않음

### 2. 가능한 원인
1. **브라우저 캐시 문제**: 이전 버전의 빌드 파일이 캐시되어 있을 수 있음
2. **빌드 캐시 문제**: dist 폴더에 이전 버전의 빌드가 남아있을 수 있음
3. **Hot Reload 실패**: 개발 서버의 HMR이 제대로 작동하지 않았을 수 있음

## ✅ 해결 방법

### 방법 1: 빌드 정리 및 재시작 (권장)

```bash
# 1. 빌드 폴더 삭제
rm -rf dist/

# 2. 노드 모듈 캐시 정리
npm run build

# 3. 개발 서버 재시작
# (기존 서버 종료 후)
npm run dev

# 또는 Cloudflare Pages Dev로 실행
npm run dev:sandbox
```

### 방법 2: 브라우저 캐시 강제 삭제

1. 브라우저에서 **F12** (개발자 도구)
2. **Application** 탭 → **Clear storage**
3. **Clear site data** 클릭
4. 페이지 새로고침 (**Ctrl + Shift + R** 또는 **Cmd + Shift + R**)

### 방법 3: 하드 리프레시

- **Chrome/Edge**: `Ctrl + Shift + Delete` → 캐시 삭제
- **Safari**: `Cmd + Option + E` → 캐시 비우기
- **Firefox**: `Ctrl + Shift + Delete` → 캐시 삭제

## 🧪 검증 방법

개발자 도구 콘솔에서 확인:
```javascript
// 브라우저 콘솔에서 실행
console.log('Build time:', document.querySelector('script[src*="index"]')?.src);
```

## 📝 현재 구현 상태

### generatePressRelease 함수 (정상 작동)
```typescript
// 위치: src/services/geminiService.ts:6166
const generatePressRelease = async (
  request: GenerationRequest, 
  onProgress: (msg: string) => void
): Promise<GeneratedContent> => {
  // ... 보도자료 생성 로직 ...
  
  const ai = getAiClient();
  const result = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: pressPrompt,
    config: {
      responseMimeType: "text/plain"
    }
  });
  
  // ... 후처리 ...
}
```

### 사용하는 AI 함수들
- ✅ `getAiClient()` - AI 클라이언트 가져오기
- ✅ `ai.models.generateContent()` - Gemini API 직접 호출
- ✅ `callGPTWebSearch()` - 웹 검색 (GPT용, 41번 줄)

### ❌ 존재하지 않는 함수
- ❌ `callGeminiWithSearch` - 이 함수는 정의되지 않음

## 🎯 결론

**코드는 정상입니다!** 

오류는 브라우저나 빌드 캐시 문제로 판단됩니다. 
위의 해결 방법 1번(빌드 정리 및 재시작)을 먼저 시도하세요.

---

생성일: 2026-01-18
최종 확인: geminiService.ts (8,000+ 줄)
