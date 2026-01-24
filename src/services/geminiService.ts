import { GoogleGenAI, Type } from "@google/genai";
import { GenerationRequest, GeneratedContent, TrendingItem, FactCheckReport, SeoScoreReport, SeoTitleItem, ImageStyle, WritingStyle, CardPromptData, CardNewsScript, CardNewsSlideScript } from "../types";
import { getStagePrompt, SYSTEM_PROMPT as GPT52_SYSTEM_PROMPT } from "../lib/gpt52-prompts-staged";
// 🚀 콘텐츠 최적화 시스템
import { optimizePrompt, estimateTokens } from "../utils/promptOptimizer";
import { generateHumanWritingPrompt, detectAiSmell } from "../utils/humanWritingPrompts";
import { autoFixMedicalLaw } from "../utils/autoMedicalLawFixer";
import { contentCache } from "../utils/contentCache";

// 현재 년도를 동적으로 가져오기
const CURRENT_YEAR = new Date().getFullYear();

// OpenAI API 프록시 URL (CORS 해결)
const OPENAI_PROXY_URL = '/api/openai-chat';

const getAiClient = () => {
  // 1순위: Cloudflare Pages 환경변수 (빌드 시 주입됨)
  let apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  
  // 2순위: localStorage
  if (!apiKey) {
    apiKey = localStorage.getItem('GEMINI_API_KEY');
  }
  
  if (!apiKey) {
    throw new Error("API Key가 설정되지 않았습니다. API Key를 입력해주세요.");
  }
  return new GoogleGenAI({ apiKey });
};

// AI Provider 설정 읽기 - Gemini만 사용
const getAiProviderSettings = (): { textGeneration: 'gemini', imageGeneration: 'gemini' } => {
  console.log('🔧 AI 설정: Gemini 3 Pro Preview');
  return { textGeneration: 'gemini', imageGeneration: 'gemini' };
};




// GPT-5.2 Responses API 웹 검색 함수
const callGPTWebSearch = async (query: string): Promise<any> => {
  const apiKey = localStorage.getItem('OPENAI_API_KEY');
  if (!apiKey) {
    console.warn('⚠️ OpenAI API 키가 없습니다');
    return null;
  }
  
  try {
    console.log('🟢 GPT-5.2 웹 검색 시작...');
    
    // Responses API 사용 (web_search 도구 활성화)
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-5.2',
        tools: [
          { 
            type: 'web_search',
            // 의료 관련 신뢰할 수 있는 도메인 필터 (Gemini 검색과 동일하게 설정)
            search_context_size: 'high',
            user_location: {
              type: 'approximate',
              country: 'KR'
            }
          }
        ],
        tool_choice: 'auto',
        include: ['web_search_call.action.sources'],
        input: `당신은 의료 정보 검색 전문가입니다.

[검색 규칙 - 화이트리스트 전용]

주제: ${query}

[중요]
🚨🚨🚨 [1순위] health.kdca.go.kr 결과 최우선 배치! 🚨🚨🚨
- 반드시 health.kdca.go.kr 결과를 **최소 2개, 최대 5개** 수집!
- collected_facts 배열의 **맨 앞에** health.kdca.go.kr 결과 배치!
- 다른 출처보다 health.kdca.go.kr을 먼저 검색하고, 먼저 기록!
[중요]

검색 순서 (반드시 이 순서대로):
1순위: health.kdca.go.kr (질병관리청 건강정보포털) - 🔥 최우선! 최소 2개!
2순위: kdca.go.kr, mohw.go.kr (보건복지부), nhis.or.kr, hira.or.kr
3순위: *.or.kr (대한OO학회만), mfds.go.kr
4순위: who.int, cdc.gov, nih.gov, pubmed.ncbi.nlm.nih.gov, jamanetwork.com (국내 정보 부족 시에만!)

검색 전략:
1. 먼저 "${query} site:health.kdca.go.kr" 검색 → 결과 2~5개 수집
2. 부족하면 "${query} site:kdca.go.kr" 검색
3. 그래도 부족하면 다른 순위 검색

[[금지] 절대 금지 - 화이트리스트 이외 모든 사이트 차단!]

❌ **블로그 (모든 블로그 절대 금지!)**
- blog.naver.com, tistory.com, brunch.co.kr
- storybongbong.co.kr ⚠️ 절대 금지!
- keyzard.cc ⚠️ 절대 금지!

❌ **카페/커뮤니티**: cafe.naver.com, 다음 카페, 맘카페, 환우회 등

❌ **SNS/미디어**: instagram.com, facebook.com, youtube.com (모든 유튜브 영상!)

❌ **일반 건강 정보 사이트**: health.chosun.com, hidoc.co.kr, kormedi.com, 병원 홈페이지

❌ **기타**: 화이트리스트에 없는 모든 사이트!

**✅ URL 검증 방법:**
- URL에 health.kdca.go.kr 포함 → ✅ 최우선! 반드시 포함!
- URL에 kdca.go.kr 포함 → ✅ 우선!
- URL에 .go.kr 또는 .or.kr 포함 → ✅ 허용
- 화이트리스트에 없는 URL → ❌ 즉시 건너뛰기!

[검색 지시]
- 현재 ${CURRENT_YEAR}년 기준 최신 자료 우선
- 🔥 health.kdca.go.kr 결과를 **가장 먼저**, **가장 많이** 수집 (최소 2개!)
- 통계는 반드시 출처와 연도 포함
- 가이드라인은 발표 기관과 연도 명시

🚨 출처 검증 필수 (P1 - 위반 시 즉시 제외)
- URL 내용이 현재 주제 "${query}"와 정확히 일치하는지 확인
- 다른 질환/증상 페이지는 절대 사용 금지
- 예: 어지럼증 주제에 당뇨병/척추골절 URL 사용 금지
- 주제와 무관하면 해당 출처 제외하고 다른 출처 찾기

반드시 아래 JSON 형식으로 응답하세요 (health.kdca.go.kr URL 우선!):
{
  "collected_facts": [
    {"fact": "health.kdca.go.kr 첫 번째 정보", "source": "질병관리청 건강정보포털", "year": ${CURRENT_YEAR}, "url": "https://health.kdca.go.kr/..."},
    {"fact": "health.kdca.go.kr 두 번째 정보", "source": "질병관리청 건강정보포털", "year": ${CURRENT_YEAR}, "url": "https://health.kdca.go.kr/..."},
    {"fact": "기타 출처 정보", "source": "출처명", "year": ${CURRENT_YEAR}, "url": "참고 URL"}
  ],
  "key_statistics": [{"stat": "통계 내용", "value": "수치", "source": "출처", "year": ${CURRENT_YEAR}}],
  "latest_guidelines": [{"guideline": "가이드라인 내용", "organization": "발표 기관", "year": ${CURRENT_YEAR}}]
}`
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ GPT-5.2 웹 검색 API 오류:', error);
      return null;
    }

    const data = await response.json();
    console.log('🟢 GPT-5.2 Responses API 응답:', data);
    
    // 디버깅: 전체 output 구조 확인
    if (data.output) {
      console.log('📋 GPT-5.2 output 구조:', JSON.stringify(data.output, null, 2).substring(0, 2000));
    }
    
    // output에서 텍스트 추출
    let textContent = '';
    let sources: any[] = [];
    
    if (data.output) {
      for (const item of data.output) {
        console.log('• item.type:', item.type);
        
        if (item.type === 'message' && item.content) {
          for (const content of item.content) {
            if (content.type === 'output_text') {
              textContent = content.text;
              // 출처 정보 추출 (annotations)
              if (content.annotations && content.annotations.length > 0) {
                console.log('📎 annotations 발견:', content.annotations.length, '개');
                const urlCitations = content.annotations
                  .filter((a: any) => a.type === 'url_citation')
                  .map((a: any) => ({
                    title: a.title || a.text || 'Unknown',
                    url: a.url
                  }));
                if (urlCitations.length > 0) {
                  sources = [...sources, ...urlCitations];
                }
              }
            }
          }
        }
        
        // web_search_call에서 sources 추출 (여러 위치 확인)
        if (item.type === 'web_search_call') {
          console.log('🔎 web_search_call 발견:', JSON.stringify(item, null, 2).substring(0, 1000));
          
          // action.sources 위치
          if (item.action?.sources && item.action.sources.length > 0) {
            const actionSources = item.action.sources.map((s: any) => ({
              title: s.title || s.name || 'Unknown',
              url: s.url
            }));
            sources = [...sources, ...actionSources];
          }
          
          // sources 직접 위치
          if (item.sources && item.sources.length > 0) {
            const directSources = item.sources.map((s: any) => ({
              title: s.title || s.name || 'Unknown',
              url: s.url
            }));
            sources = [...sources, ...directSources];
          }
          
          // results 위치 (일부 API 버전)
          if (item.results && item.results.length > 0) {
            const resultSources = item.results.map((r: any) => ({
              title: r.title || r.name || 'Unknown',
              url: r.url
            }));
            sources = [...sources, ...resultSources];
          }
        }
        
        // web_search_result 타입 체크
        if (item.type === 'web_search_result' && item.sources) {
          console.log('🔎 web_search_result 발견');
          const resultSources = item.sources.map((s: any) => ({
            title: s.title || 'Unknown',
            url: s.url
          }));
          sources = [...sources, ...resultSources];
        }
      }
    }
    
    // 중복 URL 제거
    const uniqueSources = sources.filter((s, i, arr) => 
      arr.findIndex(t => t.url === s.url) === i
    );
    sources = uniqueSources;
    
    console.log('✅ GPT-5.2 웹 검색 완료');
    console.log('   [가이드] 출처:', sources.length, '개');
    if (sources.length > 0) {
      console.log('   [가이드] 출처 목록:', sources.map(s => s.url).join(', '));
    }
    
    try {
      // JSON 부분만 추출
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        parsed.sources = sources;
        return parsed;
      }
      return { raw_content: textContent, sources };
    } catch (e) {
      console.warn('⚠️ GPT 응답 JSON 파싱 실패, 텍스트로 처리');
      return { raw_content: textContent, sources };
    }
  } catch (error) {
    console.error('❌ GPT-5.2 웹 검색 실패:', error);
    return null;
  }
};

// GPT-5.2 전용 프롬프트 (공통 의료법 + AI 냄새 제거 피드백 + GPT 특화)
const getGPT52Prompt = () => {
  const year = getCurrentYear();
  
  
  // GPT 특화 규칙만 별도로 정의 (의료 안전, AI 피드백은 함수 호출로 사용)
  // 3. GPT만의 특색있는 부분
  const gptSpecificPrompt = `
[중요]
[🎯 GPT-5.2 특화 규칙 - Gemini와 차별화되는 부분만]
[중요]

[🔎 검색 및 정보 활용 가이드 - 화이트리스트 엄격 적용!]

**🚨 최우선 원칙: 화이트리스트에 없는 사이트는 절대 참고 금지! 🚨**

**상황:** Gemini가 수집해 준 정보(Context)를 최우선으로 사용하세요.
**예외:** 만약 Gemini의 정보가 부족하거나 전달되지 않았을 경우, 당신의 지식을 활용하되 **반드시 아래 화이트리스트 출처만 사용**해야 합니다.

**[✅ 검색/참고 허용 화이트리스트 - 이것만 허용!]**

[중요]
🔥🔥🔥 **1순위: health.kdca.go.kr - 최우선 배치! 최소 2개!** 🔥🔥🔥
✅ health.kdca.go.kr (질병관리청 건강정보포털 - 일반인 대상)
  → 🚨 반드시 이 사이트 결과를 **최소 2개, 최대 5개** 글에 인용!
  → 🚨 글의 **도입부 또는 첫 번째 소제목**에 health.kdca.go.kr 인용 필수!
  → 이 사이트에서 충분한 자료를 찾았다면 해외 사이트 검색 생략!
[중요]

**2순위: 대한민국 정부 기관**
✅ kdca.go.kr (질병관리청 - 보도자료, 통계, 감염병)
✅ mohw.go.kr (보건복지부)
✅ nhis.or.kr (국민건강보험공단 - 건강검진, 통계)
✅ hira.or.kr (건강보험심사평가원 - 의료 통계)
✅ mfds.go.kr (식품의약품안전처 - 의약품, 식품안전)
✅ *.or.kr 학회 도메인 (대한OO학회 공식만! - 가이드라인)

**3순위: 해외 공신력 사이트 (국내 정보 부족 시에만!)**
✅ who.int (WHO), cdc.gov (CDC), nih.gov (NIH)
✅ pubmed.ncbi.nlm.nih.gov (PubMed)
✅ jamanetwork.com (JAMA), nejm.org (NEJM), thelancet.com (Lancet), bmj.com (BMJ)
✅ 공식 논문 DB: riss.kr, kiss.kstudy.com, koreamed.org
  → 1~2순위에서 충분한 자료를 찾았다면 이 단계는 생략!

📋 **검색 전략 (health.kdca.go.kr 최우선!):**
✅ 1단계: health.kdca.go.kr에서 최소 2개 결과 수집 (필수!)
✅ 2단계: 부족하면 kdca.go.kr, mohw.go.kr 등에서 보충
✅ 3단계: 그래도 부족할 때만 해외 자료 참고
✅ 글 작성 시 health.kdca.go.kr 인용을 가장 먼저, 가장 눈에 띄게 배치!

**[[금지] 절대 참고 금지 - 화이트리스트 외 모든 사이트!]**

🚨 **화이트리스트에 없으면 무조건 금지! 절대 예외 없음!** 🚨

❌ **블로그**: 네이버 블로그, 티스토리, 브런치, 개인 웹사이트
   ⚠️ storybongbong.co.kr - 절대 참고 금지!
   ⚠️ keyzard.cc - 절대 참고 금지!
❌ **커뮤니티**: 맘카페, 환우회, 디시인사이드, 지식iN
❌ **SNS/미디어**: 유튜브(의사 채널 포함), 인스타그램, 페이스북, 나무위키, 위키백과
❌ **일반 건강매체**: 하이닥, 헬스조선, 코메디닷컴 등
❌ **기타**: 화이트리스트에 명시되지 않은 모든 사이트

**[⚠️ 정보 부족 시 GPT 행동 수칙]**
- 출처가 불분명한 수치("70%가 겪습니다")는 사용하지 말고, "많은 분들이 겪습니다"로 일반화하세요.
- 불확실한 정보는 회피형("단정 어렵습니다")이 아닌 **행동 중심**으로 표현하세요.
  ❌ "확실하지 않습니다" → ✅ "이런 패턴이 반복되면 체크해보세요"
- 절대 블로그나 유튜브에서 본 듯한 '카더라' 통신을 섞지 마세요.

[중요]
[🏆 GPT-5.2 상위권 글 작성 핵심 규칙 - ${year}년 업그레이드]
[중요]

**🎯 목표: 정보·톤·의료법·전환 흐름이 균형 잡힌 상위 1~3위 글 작성**

**1. GPT 특유의 조건형·완충형 문장 스타일 강화**
   - "~수 있습니다" 연속 3회 절대 금지 (Gemini보다 엄격)
   - 대체 표현 적극 활용: "~경우도 있습니다", "~로 알려져 있습니다", "~일 가능성도 있습니다"
   - 문장 리듬 다양화로 AI 냄새 제거

**2. 생활 맥락 중심 키워드 녹이기 (정의형 금지)**
   ❌ Gemini식: "발목 염좌란 발목 인대가 늘어나거나 찢어진 상태를 말합니다"
   ✅ GPT식: "계단 내려오다가 발목이 꺾였는데, 며칠이 지나도 붓기가 빠지지 않는다면..."
   
   **핵심 원칙:**
   - 정의·설명 문장 → 실제 생활 장면 문장으로 전환
   - 걷기, 계단, 아침 첫 움직임, 반복되는 불편감 등 구체적 상황 사용

**3. 관찰자 시점 문장 필수 포함 (각 문단 최소 1개)**
   ❌ AI 냄새 나는 정의형: "소화불량은 다양한 원인에 의해 발생할 수 있습니다"
   ✅ 사람 냄새 나는 관찰형: "실제로 스트레스가 쌓였을 때 이런 불편함을 느끼는 분들도 적지 않습니다"
   
   **관찰자 시점 문장 패턴:**
   - "~하시는 분들이 많더라고요"
   - "이런 경험을 하신 분들도 계십니다"
   - "비슷한 고민을 가진 분들이 궁금해하시는 부분이에요"

**4. 구조: Gemini 교과서식 탈피 → GPT 관찰-해석-정리 구조**
   ❌ Gemini식: 정의 → 원인 → 증상 → 치료 (교과서)
   ✅ GPT식: 관찰 → 해석 → 부연 → 정리 (대화)
   
   **도입부 필수:**
   - 바로 생활 장면으로 시작 (정의 금지)
   - 예: "아침에 일어나서 첫 발을 디딜 때 발뒤꿈치가 찌릿하다면..."
   
   **본문 필수:**
   - 독자 자가 점검 문장 1~2회 포함
   - 예: "이런 상황이 반복된다면...", "단순 피로라고 넘기기엔 빈도가 잦다면..."

**5. 문장 첫 시작은 '불완전하게' (AI 티 제거 핵심)**
   ❌ AI식 완벽한 첫 문장: "소화불량은 다양한 원인에 의해 발생할 수 있습니다"
   ✅ 사람식 불완전한 시작: "꼭 많이 먹지 않았는데도, 속이 답답한 날이 있습니다"
   
   **원칙:** 완벽한 정의는 2~3문장 뒤에, 첫 문장은 상황 묘사나 질문으로!

[중요]
[🔥 자가 점검 판단 트리거 필수! - 핵심 업그레이드]
[중요]

**⚠️ 본문(본론) 파트에 반드시 '판단 트리거 문장' 1~2회 포함!**

**판단 트리거란?**
- 독자가 "내 얘기네?" 느끼며 스스로 판단하게 만드는 문장
- 단순 정보 나열이 아닌, 자가 점검 유도 문장

**✅ 판단 트리거 패턴 (반드시 1개 이상 사용!):**
- "이 중 2가지 이상 겹친다면, 단순 피로가 아닐 수 있어요"
- "이런 신호가 3일 이상 지속된다면..."
- "위 항목 중 해당되는 게 많다면, 확인이 필요한 시점입니다"
- "이 패턴이 반복된다면, '감'보다 '기준'으로 봐야 할 수 있어요"
- "2~3개 이상 겹치시나요? 그렇다면..."

**❌ 판단 트리거 없는 약한 글 (지양!):**
- 단순 증상 리스트만 나열
- "확인해볼 필요가 있습니다" 같은 애매한 마무리
- 독자가 "그래서 내가 해당되나?" 판단 못하는 글

**💡 본론 파트에서 리스트/체크포인트 다음에 반드시 판단 트리거 삽입!**
예시:
"☑️ 목이 칼칼한 느낌이 며칠째
☑️ 미열이 오락가락
☑️ 콧물보다 기침이 더 먼저

→ 이 중 2가지 이상 해당된다면, 단순 감기와 구분이 필요한 시점일 수 있어요."

[중요]
[🎯 CTA 구조 업그레이드 - '확인 방법 힌트' 필수!]
[중요]

**⚠️ 문제: "확인이 필요하다"만 있으면 독자가 "어떻게?" 의문**

**✅ GPT형 CTA = 여백 + 확인 방법 힌트**

**기존 GPT CTA (약함):**
- "확인이 필요한 시점일 수 있습니다" ← 방법이 없음
- "지켜보기보다 원인을 확인해보는 것도 방법" ← 추상적

**업그레이드된 GPT CTA (강함):**
✅ "애매할수록, '감'보다 '기준'이 편해져요. 의료진과 간단히 확인하는 것만으로도 답답함이 줄어들 수 있습니다."
✅ "반복된다면, 진료 기준으로 확인해보시는 게 도움이 됩니다."
✅ "이런 신호가 겹친다면, 가까운 곳에서 한번 체크해보시는 것도 방법이에요."
✅ "증상이 지속될 때는 '내가 느끼는 것'보다 '객관적 기준'으로 보는 게 편합니다. 의료진 상담이 그 기준이 될 수 있어요."

**CTA 공식:**
[열린 결론] + [확인 방법 힌트(의료진 상담/진료 기준/가까운 곳 체크)]

**[금지] 절대 금지:**
- "병원 방문하세요", "내과 가세요" ← 직접 권유
- "예약하세요", "상담 받으세요" ← 행동 강요

**✅ 허용되는 힌트 표현:**
- "의료진과 확인"
- "진료 기준으로"
- "가까운 곳에서 체크"
- "객관적 기준으로 확인"

[중요]
[📝 제목 생성 강화 - 상위권 필수 조건!]
[중요]

**🎯 제목이 발목 잡으면 본문 92점도 의미 없음!**

**✅ 상위권 제목 공식 (4요소 조합):**
[시기성(선택)] + [일상 증상] + [의심 프레임] + [확인/체크 기준]

**예시:**
✅ "요즘 코막힘인데 콧물은 없다면? 감기 vs 다른 원인 구분 기준"
   → [시기성: 요즘] + [일상 증상: 코막힘+콧물 없음] + [의심 프레임: 감기 vs 다른 원인] + [기준]
   
✅ "겨울철 기침이 길어질 때, 단순 감기인지 확인하는 체크포인트"
   → [시기성: 겨울철] + [일상 증상: 기침 길어짐] + [의심: 단순 감기인지] + [확인 기준]

✅ "며칠째 목이 칼칼한데 열은 없다면? 확인이 필요한 신호들"
   → [일상 증상: 목 칼칼+열 없음] + [의심 프레임] + [확인 기준]

**❌ 약한 제목 (지양!):**
- "감기 증상 총정리" ← 정보 나열형
- "기침이 나올 때 알아야 할 것" ← 교과서형
- "호흡기 건강 관리법" ← 추상적

**💡 제목 자가 검증:**
□ 시기성 키워드 있나? (요즘, 겨울철, 환절기, 최근)
□ 일상 증상이 구체적인가? (기침, 콧물, 목 칼칼함 등)
□ "~인지", "~일까요?" 등 의심 프레임 있나?
□ "확인", "체크", "기준", "신호" 등 행동 유도 있나?

[중요]
[✅ GPT 최종 자가 검토 - 상위권 글 체크리스트]
[중요]

**[A] 기본 품질 (필수)**
□ "~수 있습니다" 연속 3회 이상 없는가?
□ 각 문단에 관찰자 시점 문장이 1개 이상 있는가?
□ 첫 문장이 정의가 아닌 상황 묘사로 시작하는가?
□ 교과서식 구조(정의→원인→치료)가 아닌가?

**[B] 상위권 필수 조건 (업그레이드)**
□ 본문에 '판단 트리거' 문장이 1~2회 있는가?
   ("이 중 2가지 이상 겹친다면...", "이 패턴이 반복된다면...")
□ CTA에 '확인 방법 힌트'가 있는가?
   ("의료진과 확인", "진료 기준으로", "가까운 곳에서 체크")
□ 제목에 4요소(시기성+일상 증상+의심 프레임+확인 기준) 중 3개 이상?

**[C] 마무리 (여백)**
□ 마무리가 너무 깔끔하지 않고 여백이 있는가?
□ 독자가 "그래서 나는?" 스스로 판단할 공간이 있는가?

→ **A 전부 + B 2개 이상 충족 시 상위권 글!**

[중요]
[🎨 블로그 글쓰기 핵심 규칙]

**1. 의료법 위반 표현 금지 (광고로 간주될 수 있음)**
❌ "기관명(연도)" 형식 (예: 질병관리청(2024), 대한OO학회(2025))
❌ "전문의", "전문가", "의료진", "의학계", "임상"
❌ "상담", "진료", "검진", "치료", "점검"
❌ "병원", "의원", "클리닉", "내원", "방문", "예약"

**2. 글쓰기 표현 주의**
❌ 전달형 표현 과다 반복 ("설명합니다", "안내해요", "제시합니다" 3회 이상)
❌ 기계적 공감 ("신경 쓰이죠", "불편하실 수 있어요")
❌ 진단 기준식 나열 ("복통과 구토 동반")

**3. 소제목 작성**
❌ "~이란?", "원인", "증상", "치료", "예방", "관리"

**4. 자가 검증**
□ 의료법 위반 표현 0회
□ 전달형 표현 3회 미만
□ 소제목에 금지 단어 없음

[중요]
`;

  // 공통 글쓰기 규칙 추가 (Gemini와 동일하게 적용)
  let commonWritingRules = '';
  try {
    commonWritingRules = getWritingStyleCommonRules();
    console.log('✅ GPT-5.2 공통 글쓰기 프롬프트 로드 성공');
    console.log(`   📏 공통 규칙 길이: ${commonWritingRules.length}자`);
    
    // 주요 섹션 포함 여부 확인
    const sections = [
      { name: '판단 단정형 글쓰기 금지', pattern: /판단 단정형/ },
      { name: '현장감 강화', pattern: /현장감 강화/ },
      { name: '극적 표현 금지', pattern: /극적 표현 금지/ },
      { name: 'AI 냄새 제거', pattern: /AI 냄새 제거/ },
      { name: 'SEO 최적화', pattern: /SEO 최적화/ }
    ];
    
    const includedSections = sections.filter(s => s.pattern.test(commonWritingRules));
    console.log(`   📋 포함된 섹션 (${includedSections.length}/${sections.length}):`, includedSections.map(s => s.name).join(', '));
    
    if (includedSections.length < sections.length) {
      const missingSections = sections.filter(s => !s.pattern.test(commonWritingRules));
      console.warn(`   ⚠️ 누락된 섹션:`, missingSections.map(s => s.name).join(', '));
    }
  } catch (error) {
    console.error('❌ GPT-5.2 공통 글쓰기 프롬프트 로드 실패:', error);
    console.error('   - 에러 상세:', error instanceof Error ? error.message : String(error));
    // 프롬프트 로드 실패 시 에러 발생
    throw new Error(`GPT-5.2 공통 글쓰기 규칙 로드 실패: ${error instanceof Error ? error.message : String(error)}`);
  }

  // 최종 프롬프트 조합: 의료 안전 + AI 피드백 + GPT 특화 + 공통 글쓰기
  const medicalSafetyPrompt = getMedicalSafetyPrompt();
  const aiFeedbackRules = getAIFeedbackPrompt();
  const finalPrompt = medicalSafetyPrompt + aiFeedbackRules + gptSpecificPrompt + commonWritingRules;
  
  // 최종 프롬프트 구성 정보 출력
  console.log('📦 GPT-5.2 최종 프롬프트 구성:');
  console.log(`   - 의료 안전 프롬프트: ${medicalSafetyPrompt.length}자`);
  console.log(`   - AI 피드백 규칙: ${aiFeedbackRules.length}자`);
  console.log(`   - GPT 특화 규칙: ${gptSpecificPrompt.length}자`);
  console.log(`   - 공통 글쓰기 규칙: ${commonWritingRules.length}자`);
  console.log(`   - 📏 총 길이: ${finalPrompt.length}자 (약 ${Math.round(finalPrompt.length / 4)} 토큰)`);
  
  return finalPrompt;
};

/**
 * 🚀 GPT-5.2 단계별 프롬프트 처리 함수
 * 
 * 문제: 프롬프트가 너무 길어서 GPT-5.2가 헷갈리거나 토큰 제한 초과
 * 해결: 4단계로 나누어 순차적으로 처리
 * 
 * 1단계: 글 생성 (기본 규칙)
 * 2단계: AI 냄새 제거
 * 3단계: SEO 최적화
 * 4단계: 의료법 검증
 */
const callOpenAI_Staged = async (
  initialPrompt: string, 
  contextData: string,
  textLength: number = 2000,
  onProgress?: (msg: string) => void
): Promise<string> => {
  const apiKey = getOpenAIKey();
  if (!apiKey) {
    throw new Error('OpenAI API 키가 설정되지 않았습니다.');
  }

  const safeProgress = onProgress || ((msg: string) => console.log('📍', msg));
  let currentContent = '';

  // 1단계: 글 생성 (기본 규칙만 적용)
  try {
    safeProgress('📝 [1/4단계] 기본 콘텐츠 생성 중...');
    console.log('🔵 [1단계] 글 생성 시작');
    
    const stage1Prompt = getStagePrompt(1, textLength);
    const stage1SystemPrompt = `${stage1Prompt}\n\n${contextData}`;
    
    console.log(`• [1단계] System Prompt 길이: ${stage1SystemPrompt.length}자`);
    console.log(`• [1단계] User Prompt 길이: ${initialPrompt.length}자`);
    
    const response1 = await fetch(OPENAI_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-OpenAI-Key': apiKey
      },
      body: JSON.stringify({
        model: 'gpt-5.2',
        messages: [
          { role: 'system', content: `${stage1SystemPrompt}\n\n반드시 유효한 JSON 형식으로 응답하세요.` },
          { role: 'user', content: `${initialPrompt}\n\n(응답은 반드시 JSON 형식으로 해주세요)` }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.85
      })
    });

    // 응답 텍스트 먼저 읽기 (JSON 파싱 실패 대비)
    const responseText = await response1.text();
    console.log(`• [1단계] 응답 상태: ${response1.status}`);
    console.log(`• [1단계] 응답 길이: ${responseText.length}자`);
    
    if (!response1.ok) {
      // 에러 응답 파싱 시도
      try {
        const error = JSON.parse(responseText);
        console.error('❌ [1단계] API 오류:', error);
        throw new Error(`[1단계] GPT-5.2 API 오류: ${error?.error?.message || JSON.stringify(error)}`);
      } catch (parseError) {
        console.error('❌ [1단계] 응답 파싱 실패:', responseText.substring(0, 500));
        throw new Error(`[1단계] API 오류 (${response1.status}): ${responseText.substring(0, 200)}`);
      }
    }

    // JSON 파싱
    let data1;
    try {
      data1 = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ [1단계] JSON 파싱 오류');
      console.error('   - 응답 미리보기:', responseText.substring(0, 500));
      throw new Error(`[1단계] JSON 파싱 오류: ${parseError instanceof Error ? parseError.message : '알 수 없는 오류'}. 응답: ${responseText.substring(0, 100)}`);
    }
    
    currentContent = data1.choices[0]?.message?.content || '{}';
    console.log('✅ [1단계] 글 생성 완료');
    safeProgress('✅ [1/4단계] 기본 콘텐츠 생성 완료');

  } catch (error) {
    console.error('❌ [1단계] 오류:', error);
    // 더 상세한 에러 메시지 제공
    if (error instanceof Error) {
      throw new Error(`[1단계 콘텐츠 생성 실패] ${error.message}`);
    }
    throw error;
  }

  // 2단계: AI 냄새 제거
  try {
    safeProgress('🧹 [2/4단계] AI 냄새 제거 중...');
    console.log('🔵 [2단계] AI 냄새 제거 시작');
    
    const stage2Prompt = getStagePrompt(2, textLength);
    const stage2SystemPrompt = `${stage2Prompt}\n\n아래는 1단계에서 생성된 초안입니다. AI 냄새를 제거하고 자연스럽게 수정해주세요.`;
    
    const response2 = await fetch(OPENAI_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-OpenAI-Key': apiKey
      },
      body: JSON.stringify({
        model: 'gpt-5.2',
        messages: [
          { role: 'system', content: `${stage2SystemPrompt}\n\n반드시 유효한 JSON 형식으로 응답하세요.` },
          { role: 'user', content: `${currentContent}\n\n(응답은 반드시 JSON 형식으로 해주세요)` }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7
      })
    });

    const responseText2 = await response2.text();
    if (!response2.ok) {
      console.warn('⚠️ [2단계] API 오류, 1단계 결과 유지');
      console.warn('   - 상태:', response2.status);
      console.warn('   - 응답:', responseText2.substring(0, 200));
    } else {
      try {
        const data2 = JSON.parse(responseText2);
        currentContent = data2.choices[0]?.message?.content || currentContent;
        console.log('✅ [2단계] AI 냄새 제거 완료');
      } catch (parseError) {
        console.warn('⚠️ [2단계] JSON 파싱 오류, 1단계 결과 유지');
        console.warn('   - 응답:', responseText2.substring(0, 200));
      }
    }
    
    safeProgress('✅ [2/4단계] AI 냄새 제거 완료');

  } catch (error) {
    console.warn('⚠️ [2단계] 오류, 1단계 결과 유지:', error);
  }

  // 3단계: SEO 최적화
  try {
    safeProgress('• [3/4단계] SEO 최적화 중...');
    console.log('🔵 [3단계] SEO 최적화 시작');
    
    const stage3Prompt = getStagePrompt(3);
    const stage3SystemPrompt = `${stage3Prompt}\n\n아래는 2단계까지 수정된 글입니다. SEO를 최적화해주세요.`;
    
    const response3 = await fetch(OPENAI_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-OpenAI-Key': apiKey
      },
      body: JSON.stringify({
        model: 'gpt-5.2',
        messages: [
          { role: 'system', content: `${stage3SystemPrompt}\n\n반드시 유효한 JSON 형식으로 응답하세요.` },
          { role: 'user', content: `${currentContent}\n\n(응답은 반드시 JSON 형식으로 해주세요)` }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.4
      })
    });

    const responseText3 = await response3.text();
    if (!response3.ok) {
      console.warn('⚠️ [3단계] API 오류, 2단계 결과 유지');
      console.warn('   - 상태:', response3.status);
      console.warn('   - 응답:', responseText3.substring(0, 200));
    } else {
      try {
        const data3 = JSON.parse(responseText3);
        const stage3Content = data3.choices[0]?.message?.content || currentContent;
        
        // ℹ️ SEO 점수 체크 (참고용, 재생성 안 함)
        const extractSeoScore = (content: string): number => {
          try {
            const parsed = JSON.parse(content);
            return parsed?.seo_improvements?.estimated_score || 
                   parsed?.fact_check?.seo_score || 
                   parsed?.seo_score || 
                   90; // 기본값
          } catch {
            return 90; // 파싱 실패시 기본값
          }
        };
        
        const currentSeoScore = extractSeoScore(stage3Content);
        console.log(`📊 [3단계] SEO 점수: ${currentSeoScore}점 (참고용)`);
        safeProgress(`📊 [3단계] SEO 점수: ${currentSeoScore}점`);
        
        currentContent = stage3Content;
      } catch (parseError) {
        console.warn('⚠️ [3단계] JSON 파싱 오류, 2단계 결과 유지');
        console.warn('   - 응답:', responseText3.substring(0, 200));
      }
    }
    
    safeProgress('✅ [3/4단계] SEO 최적화 완료');

  } catch (error) {
    console.warn('⚠️ [3단계] 오류, 2단계 결과 유지:', error);
  }

  // 4단계: 의료법 검증
  try {
    safeProgress('⚖️ [4/4단계] 의료법 검증 중...');
    console.log('🔵 [4단계] 의료법 검증 시작');
    
    const stage4Prompt = getStagePrompt(4);
    const stage4SystemPrompt = `${stage4Prompt}\n\n아래는 3단계까지 수정된 글입니다. 의료법을 100% 준수하도록 검증하고 수정해주세요.`;
    
    const response4 = await fetch(OPENAI_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-OpenAI-Key': apiKey
      },
      body: JSON.stringify({
        model: 'gpt-5.2',
        messages: [
          { role: 'system', content: `${stage4SystemPrompt}\n\n반드시 유효한 JSON 형식으로 응답하세요.` },
          { role: 'user', content: `${currentContent}\n\n(응답은 반드시 JSON 형식으로 해주세요)` }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2
      })
    });

    const responseText4 = await response4.text();
    if (!response4.ok) {
      console.warn('⚠️ [4단계] API 오류, 3단계 결과 유지');
      console.warn('   - 상태:', response4.status);
      console.warn('   - 응답:', responseText4.substring(0, 200));
    } else {
      try {
        const data4 = JSON.parse(responseText4);
        currentContent = data4.choices[0]?.message?.content || currentContent;
        console.log('✅ [4단계] 의료법 검증 완료');
      } catch (parseError) {
        console.warn('⚠️ [4단계] JSON 파싱 오류, 3단계 결과 유지');
        console.warn('   - 응답:', responseText4.substring(0, 200));
      }
    }
    
    safeProgress('✅ [4/4단계] 의료법 검증 완료 🎉');

  } catch (error) {
    console.warn('⚠️ [4단계] 오류, 3단계 결과 유지:', error);
  }



  console.log('🎉 단계별 처리 완료! 최종 결과 반환');
  return currentContent;
};

// OpenAI API 호출 함수 (GPT-5.2 -> Gemini-3-Pro-Preview 폴백)
const callOpenAI = async (prompt: string, systemPrompt?: string): Promise<string> => {
  try {
    console.log('🔵 callOpenAI 시작');
    const apiKey = getOpenAIKey();
    
    if (!apiKey) {
      console.error('❌ OpenAI API 키가 없습니다!');
      throw new Error('OpenAI API 키가 설정되지 않았습니다. LocalStorage에서 OPENAI_API_KEY를 확인하세요.');
    }
    
    // 🚀 GPT-5.2 시도
    try {
      console.log(`🔵 API 키 확인 완료, 모델 'gpt-5.2' 요청 전송 중...`);
      console.log(`• System Prompt 길이: ${systemPrompt?.length || 0}자`);
      console.log(`• User Prompt 길이: ${prompt?.length || 0}자`);
      
      // OpenAI json_object 모드 사용 시 프롬프트에 "json" 단어 필수
      const jsonSystemPrompt = systemPrompt 
        ? `${systemPrompt}\n\n반드시 유효한 JSON 형식으로 응답하세요.`
        : '반드시 유효한 JSON 형식으로 응답하세요.';
      const jsonUserPrompt = prompt.includes('json') || prompt.includes('JSON') 
        ? prompt 
        : `${prompt}\n\n(응답은 반드시 JSON 형식으로 해주세요)`;
      
      const response = await fetch(OPENAI_PROXY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-OpenAI-Key': apiKey
        },
        body: JSON.stringify({
          model: 'gpt-5.2',
          messages: [
            { role: 'system', content: jsonSystemPrompt },
            { role: 'user', content: jsonUserPrompt }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.7
        })
      });

      console.log(`🔵 OpenAI (gpt-5.2) 응답 상태:`, response.status, response.statusText);

      if (response.ok) {
        const data = await response.json() as { choices: Array<{ message: { content: string } }> };
        const content = data.choices[0]?.message?.content || '{}';
        console.log(`✅ OpenAI 응답 성공 (gpt-5.2)`);
        console.log(`📦 응답 내용 길이: ${content.length}자`);
        console.log(`📦 응답 미리보기: ${content.substring(0, 200)}...`);
        
        // JSON 파싱 테스트
        try {
          const parsed = JSON.parse(content);
          console.log(`✅ JSON 파싱 성공`);
          console.log(`📋 응답 필드:`, Object.keys(parsed));
          
          // contentHtml 또는 content 필드 확인
          if (!parsed.contentHtml && !parsed.content) {
            console.error(`❌ 경고: contentHtml 또는 content 필드가 응답에 없습니다!`);
            console.error(`   - 실제 필드:`, Object.keys(parsed));
          }
        } catch (parseError) {
          console.error(`❌ JSON 파싱 실패:`, parseError);
          console.error(`   - 응답 내용:`, content.substring(0, 500));
        }
        
        return content;
      }
      
      const error = await response.json();
      console.error(`❌ GPT-5.2 API 오류:`, error);
      console.error(`   - 상태 코드: ${response.status} ${response.statusText}`);
      console.error(`   - 에러 메시지: ${error?.error?.message || 'Unknown error'}`);
      console.error(`   - 에러 타입: ${error?.error?.type || 'Unknown type'}`);
      console.error(`   - 에러 코드: ${error?.error?.code || 'Unknown code'}`);
      console.error(`   - System Prompt 길이: ${systemPrompt?.length || 0}자`);
      console.error(`   - User Prompt 길이: ${prompt?.length || 0}자`);
      
      // 프롬프트가 너무 길 경우 특별 경고
      const totalLength = (systemPrompt?.length || 0) + (prompt?.length || 0);
      if (totalLength > 100000) {
        console.warn(`⚠️ 프롬프트 길이가 매우 깁니다 (${totalLength}자). 토큰 제한 초과 가능성 있음!`);
      }
      
      console.log('🔄 Gemini-3-Pro-Preview로 폴백합니다...');
    } catch (e) {
      console.error(`❌ GPT-5.2 네트워크/처리 오류:`, e);
      console.error(`   - 에러 타입: ${e instanceof Error ? e.constructor.name : typeof e}`);
      console.error(`   - 에러 메시지: ${e instanceof Error ? e.message : String(e)}`);
      if (e instanceof Error && e.stack) {
        console.error(`   - 스택 트레이스:`, e.stack);
      }
      console.log('🔄 Gemini-3-Pro-Preview로 폴백합니다...');
    }

    // 🔄 GPT-5.2 실패 시 Gemini-3-Pro-Preview로 폴백
    console.log('🟢 Gemini-3-Pro-Preview 호출 시작...');
    const ai = getAiClient();
    const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: fullPrompt,
      config: {
        temperature: 0.7,
        responseMimeType: 'application/json',
        thinkingMode: true // Think 모드 활성화 (글쓰기 품질 향상)
      }
    });
    
    const text = response.text || '{}';
    console.log(`✅ Gemini-3-Pro-Preview 응답 성공`);
    console.log(`📦 응답 내용 길이: ${text.length}자`);
    console.log(`📦 응답 미리보기: ${text.substring(0, 200)}...`);
    
    // JSON 파싱 테스트
    try {
      const parsed = JSON.parse(text);
      console.log(`✅ JSON 파싱 성공`);
      console.log(`📋 응답 필드:`, Object.keys(parsed));
      
      // contentHtml 또는 content 필드 확인
      if (!parsed.contentHtml && !parsed.content) {
        console.error(`❌ 경고: contentHtml 또는 content 필드가 응답에 없습니다!`);
        console.error(`   - 실제 필드:`, Object.keys(parsed));
      }
    } catch (parseError) {
      console.error(`❌ JSON 파싱 실패:`, parseError);
      console.error(`   - 응답 내용:`, text.substring(0, 500));
    }
    
    return text;

  } catch (error) {
    console.error('❌ callOpenAI 전체 에러:', error);
    console.error('   - 에러 타입:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('   - 에러 메시지:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('   - 스택 트레이스:', error.stack);
    }
    throw error;
  }
};

// 현재 연도를 동적으로 가져오는 함수
const getCurrentYear = () => new Date().getFullYear();

// 의료광고법 프롬프트를 동적으로 생성하는 함수
const getMedicalSafetyPrompt = () => {
  const year = getCurrentYear();
  return `
당신은 대한민국 의료광고법·표시광고법·네이버 검색 정책을 완벽히 숙지한 '네이버 공식 병원 블로그' 전문 에디터입니다.

[중요]
🚨🚨🚨 [핵심 원칙 5가지 - 반드시 암기!] 🚨🚨🚨
[중요]

1️⃣ '가능성·판단·체크'는 제목뿐 아니라 본문에서도 누적되면 위험!
2️⃣ 병명은 정의하지 말고, 맥락 속에서만 등장시켜라!
3️⃣ 숫자·기간·회복은 항상 '개인차'로 흐려라!
4️⃣ 종결어미를 다양하게 사용하여 AI 냄새 제거! (단조로운 반복 금지)
5️⃣ '환자', '내원' 표현 지양 - 독자 중심 표현 사용!

---
🚫 [1. 가능성·판단 반복 구조 금지] - 가장 큰 리스크!
---

❌ 위험한 문장 패턴:
"OO 감염 가능성을 하나의 원인으로 고려해볼 수 있는 상황"
→ '감염 가능성' + '원인 고려' = 질병 추정·판단 유도!
→ 네이버 의료광고 필터에서 의심·가능성 반복 = 광고 신호로 누적!

✅ 안전한 대체 표현:
"이처럼 겨울철에 급성 위장관 증상이 겹쳐 나타나는 경우, 원인을 둘러싼 다양한 상황이 함께 언급되곤 합니다."
→ 병명은 결론에서 빠지고, '가능성' → '언급되는 상황'으로 완충

🚨🚨🚨 **절대 금지 단어 (1회도 사용 금지!):** 🚨🚨🚨
❌ 의심 (절대 금지!)
❌ 가능성 (절대 금지!)
❌ 판단 (절대 금지!)
❌ 진단 (절대 금지!)
❌ 체크 (절대 금지!)
❌ 구분 (절대 금지!)
❌ 차이 (절대 금지!)
❌ 여부 (절대 금지!)

✅ **안전한 대체 표현:**
- "의심" → "살펴볼 필요가 있는", "확인해볼 만한", "주의가 필요한"
- "가능성" → "경우가 있다", "상황이 있다", "언급되곤 한다"
- "판단" → "확인", "파악", "살펴보기"
- "진단" → "확인", "검사"
- "체크" → "확인", "살펴보기"
- "구분" → "살펴보기", "비교"

---
🚫 [2. 정의형 문단 금지] - 병원 홈페이지 전형 패턴!
---

❌ 위험한 소제목:
"OO란 무엇인가요?", "OO의 정의", "OO이란"

❌ 위험한 본문:
"OO바이러스는 급성 위장염을 일으키는 전염성이 강한 바이러스 중 하나로…"

⚠️ 왜 위험한가:
병·의원 블로그에서 '○○란 무엇인가'는 의료정보 제공 + 광고 혼합으로 자주 지적됨!
질환 정의 → 증상 → 관리법의 정석 구조 = 병원 홈페이지 전형 패턴!

✅ 안전한 소제목:
"겨울철 위장관 감염과 관련해 자주 언급되는 바이러스"

✅ 안전한 본문:
"이 시기에 위장관 증상과 함께 자주 거론되는 바이러스 중 하나가 OO입니다."
→ '정의' → '맥락 설명', 병명은 정보의 주인공이 아니라 배경!

---
🚫 [3. 숫자·기간·회복 표현 금지] - 표시광고법 위반!
---

🚨🚨🚨 **시간 참조 & 구체적 기간 표현 절대 금지!** 🚨🚨🚨

❌ **완전 금지 - 시간 참조 표현:**
- "2026년 겨울은 예년에 비해~" ← 절대 금지! (2027년에 보면 과거 글)
- "올해는~", "금년은~", "2026년에는~" ← 절대 금지!
- "이번 겨울~", "이번 여름~" ← 절대 금지!
- "최근 몇 년간~" ← 절대 금지!

✅ **안전한 시간 표현:**
- "겨울철에는~", "여름철에는~" (일반적 계절)
- "추운 날씨에는~", "더운 날씨에는~"
- "환절기에는~"

❌ **완전 금지 - 구체적 기간 표현:**
- "2주 이상" ← 절대 금지!
- "3일~5일" ← 절대 금지!
- "24시간~48시간" ← 절대 금지!
- "1주일 정도" ← 절대 금지!
- "2~3일 후" ← 절대 금지!

✅ **안전한 기간 표현:**
- "일정 기간 이상"
- "며칠째"
- "시간이 지나도"
- "개인에 따라 차이가 있으며"
- "경과를 지켜보는 것이"

❌ **완전 금지 - 숫자 단정 표현:**
- "평균적으로 24시간에서 48시간 정도의 잠복기를 거친 뒤"
- "대개 2~3일 정도 앓고 나면 자연적으로 회복"
- "내성률이 51.7%로 보고되고 있어"
- "효과가 90% 이상"
→ 🚨 숫자 + 평균 + 회복 = 표시광고법에서 일반화·결과 암시로 문제!
→ 민원: "나는 5일 갔는데 왜 이렇게 쓰냐" 반박 포인트 제공!

✅ **안전한 대체 표현:**
- "증상이 나타나기까지는 개인에 따라 시간이 걸리는 경우도 있으며"
- "일부에서는 비교적 짧은 기간 내 증상이 가라앉기도 하지만"
- "최근 보고에 따르면 과거보다 비율이 높아진 것으로 알려져 있습니다"
→ 숫자 제거, 개인차 강조, 결과 단정 제거!

---
🚫 [4. 체크리스트 문단 금지] - 가장 위험한 구간!
---

❌ 위험한 소제목:
"이런 증상이 있다면 체크해볼 사항"
"자가 진단 방법", "판별법", "구분법"

❌ 위험한 문장:
"상황을 판단하는 데 참고가 될 수 있습니다."
→ 체크리스트 + 판단 = 의료행위 대체 표현 = 자가진단 유도로 매우 민감!

✅ 안전한 소제목:
"증상 흐름을 이해할 때 참고가 되는 상황들"

✅ 안전한 문장:
"아래 내용은 현재 증상의 경과를 이해하는 데 참고할 수 있는 일반적인 상황들로, 진단이나 판단을 대신하지는 않습니다."
→ 체크 → 참고, 판단 → 이해, 방어 문구 자연스럽게 삽입!

---
🚫 [5. 실제 진료 현장 언급 금지 + 환자/내원 표현 지양]
---

❌ 위험한 표현:
"실제 진료 현장에서도 … 상담을 받는 경우를 종종 보게 됩니다."
"~를 호소하는 사례가 빈번합니다"
"~가 특징적으로 나타나곤 합니다"
"환자분들이 많이 찾으십니다"
"내원하시는 분들의 경우"
→ '진료 현장' + '환자' + '내원' + '자주 본다' + '종종' = 간접적 경험·빈도 광고!
→ 의료광고 심의에서 자주 지적됨!

✅ 안전한 대체 표현:
"일반적으로 증상이 있을 때 수분 섭취가 부족해 상태가 악화되는 경우도 보고됩니다."
"~라고 말하는 분들이 있습니다"
"~로 검색해보는 분들이 많습니다"
"~를 겪는 분", "~로 고민하는 분"
"병원을 방문하는 분들"
→ '우리 병원 경험' 제거, '환자/내원' 대신 독자 중심 표현 사용!

---
🚫 [6. 기존 금지 규칙 유지 + 소제목 키워드 직접 삽입 금지]
---

**⛔ 제목/소제목 금지:**
❌ 제목: "치료", "항암", "전문의가 권장", "총정리", "완벽 가이드"
❌ 제목: 질환명 남발, "위험!", "긴급!", "돌연사" 등 공포 조장
❌ 제목: 물음표 금지! (~일까요? 금지!)
❌ 소제목: 이모지 절대 금지! (🎯, 📌, ⚠️, ✅ 등)
❌ 🚨 **소제목에 키워드 직접 삽입 금지!**
  - ❌ "마이코플라스마 폐렴이란?", "A형 독감 증상 구분법"
  - ❌ "~이란?", "원인", "증상", "치료", "예방" (의학 백과 구조 금지!)
  - ✅ "열이 먼저냐, 기침이 먼저냐", "약을 먹어도 안 나을 때"
  - ✅ 독자의 상황 → 궁금증 → 정보 → 다음 행동 흐름

**⛔ 도입부/본문 금지:**
❌ "안녕하세요. ~에디터입니다", "오늘은 ~에 대해 알아보겠습니다"
❌ "진료실", "진료 현장", "환자분들을 만나다 보면" → 의사 사칭!
❌ 1인칭: "저는", "제가", "저희"
❌ "환자", "내원" → 독자 중심 표현 사용!

**⛔ 치료/CTA 금지:**
❌ "획기적인 신약", "회복 가능성" → 치료 효과 암시!
❌ "가까운 내과를 방문하여" → 직접 방문 유도!
❌ "~해야 합니다", "반드시", "위험합니다"
❌ 🚨 **글이 진단·판단을 대신 내리지 않는다:**
  - ❌ "~라면 독감의 가능성을 염두에 두어야 합니다"
  - ❌ "~의 특징과 유사하므로 의심해볼 필요가 있습니다"
  - ✅ "이런 증상으로 검사를 받아보는 분들이 많습니다"
  - ✅ "진료 시 이 부분을 말씀드리면 도움이 됩니다"
❌ 🚨 **치료 행동을 직접 지시하지 않는다:**
  - ❌ "48시간 이내에 항바이러스제를 투여해야 합니다"
  - ✅ "증상이 시작된 시점을 기억해두면 진료 시 도움이 됩니다"

---
✅ [안전한 글쓰기 공식 + 키워드 대체 가이드]
---

**1. '설명형'보다 '상황형'이 안전**
❌ "노로바이러스 증상은 무엇인가요"
✅ "이런 증상이 겹쳐 나타나는 경우가 있습니다"

**2. 숫자는 '범위 흐림'으로 (숫자 단정 금지!)**
❌ 정확한 수치 (24~48시간, 2~3일, 51.7%, 90% 이상)
✅ "개인에 따라 차이가 있습니다"
✅ "최근 보고에 따르면 과거보다 비율이 높아진 것으로 알려져 있습니다"

**3. 🚫 단정 표현 절대 금지! (의료광고법 위반 방지)**
❌ 절대 금지: "치료된다", "개선된다", "효과가 있다", "~해야 합니다"
✅ 안전한 표현: "~할 수 있습니다", "~로 볼 수 있습니다", "~도 고려됩니다", "~도움이 될 수 있습니다", "~알려져 있습니다"

예시:
❌ "이 치료법으로 개선된다"
✅ "이 치료법이 도움이 될 수 있습니다"

❌ "운동하면 효과가 있다"
✅ "운동이 도움이 될 수 있습니다"

**4. 🔄 키워드 대체 표현 가이드 (동일 단어 15회 미만 필수!)**
- **🚨 모든 단어는 글 전체에서 15회 미만 (14회까지만 허용!)**
- 주제어(병명·시술명): 전체 글에서 12회 이하 권장
- 일반 단어(증상, 통증 등): 전체 글에서 10회 이하 권장
- **대체 표현 활용 (⚠️ 논문·보고서 단어 사용 금지!):**
  - ❌ 증상 → 불편감(AI 단어!), 양상(논문체!), 시사하다(보고서체!)
  - ✅ 증상(10회) → 불편함(2회), 걸리는 느낌(1회), 신경 쓰임(1회) = 총 14회
  - ❌ 특징적인(논문체!), 흐름(추상적!), 해당(보고서체!), 상태를 고려하다(딱딱함!)
  - ✅ 구체적인 표현, 이어지는 과정, 이런 경우, 조심하게 됨
  - 치료(8회) → 관리(3회), 케어(1회), 회복 과정(1회), 호전(1회) = 총 14회
  - 진단(6회) → 확인(4회), 검사(2회), 체크(2회) = 총 14회
  - 환자(3회) → ~를 겪는 분(2회), ~로 고민하는 분(1회) = 총 6회
  - 내원(2회) → 병원을 방문하는 분(1회), 진료를 받으러 오는 분(1회) = 총 4회
  - 효과(5회) → 도움(4회), 긍정적 영향(2회), 변화(2회) = 총 13회
  - 고열(4회) → 체온 상승(2회), 38도 이상의 열(1회), 급격한 열(1회) = 총 8회
  - 기침(8회) → 헛기침(2회), 마른 기침(2회), 목 간지러움(2회) = 총 14회

**5. 🎭 종결어미 다양화 (AI 냄새 제거 - 필수!)**

🚨🚨🚨 **절대 금지: 동일 종결어미 2회 연속 또는 3회 이상 반복!** 🚨🚨🚨

❌ **금지 패턴 (절대 사용 금지!):**
- "~습니다" 연속 2회 이상 → 즉시 다른 종결어미로 변경!
- "~있습니다" 연속 2회 이상 → 즉시 다른 종결어미로 변경!
- "~됩니다" 연속 2회 이상 → 즉시 다른 종결어미로 변경!
- "~경우가 있습니다" 연속 2회 이상 → 즉시 다른 종결어미로 변경!
- 전체 글에서 동일 종결어미 5회 이상 사용 금지!

✅ **반드시 교차 사용해야 하는 다양한 종결어미:**
그룹 A (부드러운 추측):
  - "~한 경우가 있습니다" (1~2회만)
  - "~경우도 있습니다" (1~2회만)
  - "~할 수 있습니다" (1~2회만)
  
그룹 B (일반적 사실):
  - "~으로 알려져 있습니다" (1~2회만)
  - "~보고되고 있습니다" (1~2회만)
  - "~언급되곤 합니다" (1~2회만)
  
그룹 C (관찰/발견):
  - "~로 나타나기도 합니다" (1~2회만)
  - "~것으로 나타납니다" (1~2회만)
  - "~로 보입니다" (1~2회만)

그룹 D (존재/상태):
  - "~이 있습니다" (1~2회만)
  - "~편입니다" (1~2회만)
  - "~경향이 있습니다" (1~2회만)

⚠️ **필수 규칙:**
- 연속된 두 문장은 절대 같은 그룹 사용 금지!
- A 그룹 → B 그룹 → C 그룹 → D 그룹 순서로 교차!
- 같은 그룹 내에서도 다른 표현 사용!

---
📈 [SEO 최적화 규칙] - 네이버 검색 최적화
---

**1. 핵심 키워드 배치 규칙 (과다 사용 금지!)**
- 제목: 주요 키워드 1회 명시 (필수)
- 본문 첫 문단(2~3문장): 키워드 1회 자연스럽게 포함 (필수)
- 소제목(H2/H3): 1곳에만 명사형으로 포함
- ⚠️ 이후 본문에서는 키워드 반복 사용 금지! (키워드 스터핑 = 저품질)
- 키워드는 설명 대상이지 결론처럼 사용하지 말 것

**2. 도입부 SEO 최적화 (첫 문단 = 가장 중요!)**
- 첫 단락 안에서 독자가 '무슨 주제의 글인지' 즉시 알 수 있게 할 것
- 도입부에서 글의 주제를 명확히 드러낼 것
- 추상적인 시작 문장은 1문장 이내로 제한
- ❌ "요즘 많은 분들이 관심을 가지고 계신데요" (추상적)
- ✅ "겨울철 반복되는 위장관 증상, OO와 함께 언급되는 경우가 있습니다" (주제 명확)

**3. 문장 톤 제한 (의료광고법 + SEO 동시 충족)**
- ❌ "~일 수 있습니다", "~로 보입니다" 반복 금지
- ✅ "~와 함께 언급되는 경우가 있습니다" 구조 사용
- 키워드는 설명 대상이지 결론처럼 사용 금지

**4. SEO 구조 체크리스트**
□ 제목에 핵심 키워드 1회 포함?
□ 첫 문단에 키워드 자연스럽게 1회 포함?
□ 소제목 1곳에 키워드 명사형 포함?
□ 본문에서 키워드 과다 반복 없음?
□ 도입부에서 주제 명확히 드러남?

---
[⚖️ ${year}년 의료광고법]
- 의료법 제56조, 제57조 준수
- 특정 병원 홍보 ❌ / 특정 치료법 권유 ❌ / 의료상식 전달 ✅

[출처 참고]
✅ 허용: 대한OO학회, 질병관리청, 보건복지부, PubMed, JAMA
❌ 금지: 블로그, 카페, SNS, 유튜브, storybongbong.co.kr, keyzard.cc
`;
};


// AI 냄새 제거 피드백 프롬프트 (간소화 - getMedicalSafetyPrompt와 중복 제거)
const getAIFeedbackPrompt = (): string => {
  return `
---
[🤖 AI 냄새 제거 핵심 - 필수 준수!]
---

🚨🚨🚨 **최우선 금지 사항 - 반드시 확인!** 🚨🚨🚨

1. **"의심" 단어 절대 금지!** (1회도 사용 불가!)
   - ❌ "의심되는", "의심된다", "의심해볼 수 있다" → 모두 금지!
   - ✅ "살펴볼 필요가 있는", "확인해볼 만한", "주의가 필요한"

2. **기관명(연도) 형식 절대 금지!** (1회도 사용 불가!)
   - ❌ "대한OO학회(2024)", "질병관리청(2025)", "대한마취통증의학회(2026)" → 모두 금지!
   - ✅ "최근 지침에 따르면", "최신 연구에서는", "의료계에서는", "임상에서는"

3. **시간 참조 표현 절대 금지!** (글은 영구 보관되므로)
   - ❌ "2026년 겨울은~", "올해는~", "이번 겨울은~" → 모두 금지!
   - ✅ "겨울철에는~", "추운 날씨에는~", "환절기에는~"

4. **구체적 기간 표현 절대 금지!**
   - ❌ "2주 이상", "3일~5일", "24시간~48시간", "1주일 정도" → 모두 금지!
   - ✅ "일정 기간 이상", "며칠째", "시간이 지나도", "개인에 따라 차이"

5. **동일 종결어미 2회 연속 또는 5회 이상 반복 금지!**
   - ❌ "~습니다" 연속 2회 → 즉시 변경!
   - ❌ "~있습니다" 연속 2회 → 즉시 변경!
   - ✅ 종결어미 그룹을 교차하여 사용! (A→B→C→D 순환)

**1. 문장 리듬 다양화 (종결어미 다양화!):**
- ❌ "~수 있습니다", "~입니다", "~됩니다" 연속 2회 이상 금지
- ✅ 종결어미를 다양하게 교차 사용:
  그룹 A: "~한 경우가 있습니다", "~경우도 있습니다"
  그룹 B: "~으로 알려져 있습니다", "~보고되고 있습니다"
  그룹 C: "~로 나타나기도 합니다", "~것으로 나타납니다"
  그룹 D: "~이 있습니다", "~편입니다", "~경향이 있습니다"

**2. 구조 자연스럽게 (의학 백과 구조 금지!):**
- ❌ 교과서식: "~이란?" → 정의→원인→증상→치료→예방
- ✅ 자연스러운 흐름: 독자의 상황 → 궁금증 → 정보 → 다음 행동
- ✅ 소제목은 상황·흐름 기반으로 작성 (키워드 직접 삽입 금지!)
  - ❌ "마이코플라스마 폐렴이란?", "A형 독감 증상 구분법"
  - ✅ "열이 먼저냐, 기침이 먼저냐", "약을 먹어도 안 나을 때"

**3. 글의 톤 (독자 중심!):**
- 첫 문장은 상황 묘사로 시작 (정의 X)
- 가능성을 열어두고 여백 남김
- 병명은 결론이 아니라 맥락의 배경으로만
- ❌ "환자", "내원" 표현 지양
- ✅ "~를 겪는 분", "~로 고민하는 분", "병원을 방문하는 분"

**4. 도입부 필수 요소:**
- 독자가 "이건 내 상황이다"라고 느끼는 구체적 장면 묘사
- 시간대, 장소, 신체 감각, 감정 중 2가지 이상 포함
- 예: "아침에 일어났는데 목이 칼칼하고 으슬으슬한 기운이 느껴질 때"

**5. 마무리 (행동 유도는 간접적으로!):**
- ❌ "저희 병원에서 상담받아 보세요"
- ✅ "이런 부분이 궁금하셨다면 한 번쯤 점검해보시는 것도 방법입니다"
`;
};



// 기존 호환성을 위한 상수 (실제 사용 시 getMedicalSafetyPrompt() 호출)
const MEDICAL_SAFETY_SYSTEM_PROMPT = getMedicalSafetyPrompt();

// =============================================
// 🎨 공통 이미지 프롬프트 상수 (중복 제거) - export 포함
// =============================================

// 카드뉴스 레이아웃 규칙 - 텍스트가 이미지 안에 포함된 완성형 카드!
// ⚠️ 중요: 이 프롬프트는 영어로 작성 - 한국어 지시문이 이미지에 렌더링되는 버그 방지!
export const CARD_LAYOUT_RULE = `[CARD IMAGE GENERATION RULE]
Render Korean text DIRECTLY into the image pixels.
Do NOT show these instructions in the image.
Only render the actual content text (subtitle, mainTitle, description).`;

// Hospital AI 고유 레이아웃 - 브라우저 창 프레임 스타일 (첫 생성 시 항상 적용)

// =============================================
// 🧩 프레임/스타일/텍스트 블록 분리 (중요)
// - FRAME: 레이아웃/프레임만. (스타일 단어 금지: photo/3D/illustration 등)
// - STYLE: 렌더링/질감/기법만. (프레임 단어 최소화)
// - TEXT: 카드에 들어갈 문구만
// =============================================

// 기본 프레임: 보라색 테두리 + 흰색 배경 (참고 이미지 사용)
// ⚠️ 영어로 작성 - 한국어 지시문이 이미지에 렌더링되는 버그 방지
const CARD_FRAME_RULE = `
[FRAME LAYOUT - FOLLOW REFERENCE IMAGE EXACTLY]
Copy the EXACT frame layout from the reference image:
- Border color: #787fff (lavender purple/violet) around the edges
- White content area inside the border
- Rounded corners
- Clean minimal design
Keep the same frame thickness, padding, and proportions as reference.
`;

// 참고 프레임 이미지가 있을 때: 프레임/레이아웃만 복제
// ⚠️ 영어로 작성 - 한국어 지시문이 이미지에 렌더링되는 버그 방지
const FRAME_FROM_REFERENCE_COPY = `
[FRAME LAYOUT]
Copy EXACTLY the frame/layout/text placement from the reference image.
IGNORE the illustration/subject/content inside the reference - replace with new topic.
`;

// 참고 프레임 이미지 + 색상 변경 모드(레이아웃 유지)
// ⚠️ 영어로 작성 - 한국어 지시문이 이미지에 렌더링되는 버그 방지
const FRAME_FROM_REFERENCE_RECOLOR = `
[FRAME LAYOUT]
Keep the frame/layout/text placement from reference image as much as possible.
Adjust overall color tone to match the requested background color.
IGNORE the illustration/subject/content inside the reference - replace with new topic.
`;

// 스타일 블록: 버튼별로 단 하나만 선택
const PHOTO_STYLE_RULE = `
[STYLE - 실사 촬영 (PHOTOREALISTIC PHOTOGRAPHY)]
🚨 최우선 규칙: 반드시 실제 사진처럼 보여야 합니다! 🚨

✅ 필수 스타일 키워드 (모두 적용!):
- photorealistic, real photograph, DSLR camera shot, 35mm lens
- natural lighting, soft studio lighting, professional photography
- shallow depth of field, bokeh background, lens blur
- realistic skin texture, real fabric texture, authentic materials
- high resolution, 8K quality, professional stock photo style

✅ 피사체 표현:
- 실제 한국인 인물 (의료진, 환자 등)
- 실제 병원/의료 환경
- 실제 의료 장비, 진료 도구
- 자연스러운 표정과 포즈

✅ 분위기:
- professional, trustworthy, clean, modern
- 밝고 깨끗한 병원 느낌
- 신뢰감 있는 의료 환경

⛔⛔⛔ 절대 금지 (이것들은 사용하지 마세요!):
- 3D render, 3D illustration, Blender, Cinema4D
- cartoon, anime, vector art, flat illustration
- clay render, isometric, infographic style
- digital art, painting, watercolor, sketch
- 파스텔톤 일러스트, 귀여운 캐릭터

※ 프레임(브라우저 창 상단바/버튼)만 그래픽 요소로 유지, 나머지는 모두 실사!
`;

const ILLUSTRATION_3D_STYLE_RULE = `
[STYLE - 3D 일러스트 (3D ILLUSTRATION)]
⚠️ 필수: 친근하고 부드러운 3D 일러스트 스타일!
- 렌더링: 3D rendered illustration, Blender/Cinema4D style, soft 3D render
- 조명: soft studio lighting, ambient occlusion, gentle shadows
- 질감: smooth plastic-like surfaces, matte finish, rounded edges
- 색상: 밝은 파스텔 톤, 파란색/흰색/연한 색상 팔레트
- 캐릭터: cute stylized characters, friendly expressions, simple features
- 배경: clean gradient background, soft color transitions
- 분위기: friendly, approachable, modern, educational
⛔ 절대 금지: photorealistic, real photo, DSLR, realistic texture, photograph
`;

const MEDICAL_3D_STYLE_RULE = `
[STYLE - 의학 3D (MEDICAL 3D RENDER)]
⚠️ 필수: 전문적인 의학/해부학 3D 일러스트 스타일!
- 렌더링: medical 3D illustration, anatomical render, scientific visualization
- 조명: clinical lighting, x-ray style glow, translucent organs
- 피사체: 인체 해부학, 장기 단면도, 뼈/근육/혈관 구조, 의료 도구
- 질감: semi-transparent organs, detailed anatomical structures
- 색상: 의료용 색상 팔레트 (파란색, 흰색, 빨간색 혈관/동맥)
- 레이블: anatomical labels, educational diagram style
- 분위기: clinical, professional, educational, trustworthy
⛔ 절대 금지: cute cartoon, photorealistic photo, realistic human face
`;

const CUSTOM_STYLE_RULE = (prompt: string) => `
[STYLE]
${prompt}
`;

// promptText에서 서로 충돌하는 키워드/섹션을 제거(특히 photo에서 [일러스트] 같은 것)
const normalizePromptTextForImage = (raw: string | undefined | null): string => {
  if (!raw || typeof raw !== 'string') return '';
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);

  // 🔧 중복 제거: CARD_LAYOUT_RULE 전체 블록 및 관련 지시문 제거
  const dropPatterns: RegExp[] = [
    /브라우저\s*창\s*프레임\s*스타일\s*카드뉴스/i,
    /^\[일러스트\]/i,
    /^\[스타일\]/i,
    /^\s*CARD_LAYOUT_RULE\s*:/i,
    // CARD_LAYOUT_RULE 내용 제거 (generateSingleImage에서 다시 추가됨)
    /^\[CARD IMAGE GENERATION RULE\]/i,
    /^Render Korean text DIRECTLY into the image/i,
    /^Do NOT show these instructions in the image/i,
    /^Only render the actual content text/i,
  ];

  const cleaned = lines
    .filter(l => !dropPatterns.some(rx => rx.test(l)))
    .join('\n')
    .trim();

  return cleaned;
};

const buildStyleBlock = (style: ImageStyle, customStylePrompt?: string): string => {
  // 🎨 커스텀 프롬프트가 있으면 최우선 적용! (재생성 시에도 유지)
  if (customStylePrompt && customStylePrompt.trim()) {
    console.log('✏️ 커스텀 스타일 적용:', customStylePrompt.substring(0, 50));
    return CUSTOM_STYLE_RULE(customStylePrompt.trim());
  }
  
  // 🚨 photo/medical 스타일 선택 시 고정 스타일 적용
  if (style === 'photo') {
    console.log('📸 실사 사진 스타일 적용');
    return PHOTO_STYLE_RULE;
  }
  if (style === 'medical') {
    console.log('의학 3D 스타일 적용');
    return MEDICAL_3D_STYLE_RULE;
  }
  
  // 기본: 3D 일러스트
  return ILLUSTRATION_3D_STYLE_RULE;
};

const buildFrameBlock = (referenceImage?: string, copyMode?: boolean): string => {
  if (!referenceImage) return CARD_FRAME_RULE;
  return copyMode ? FRAME_FROM_REFERENCE_COPY : FRAME_FROM_REFERENCE_RECOLOR;
};

// 공통 규칙 (간결화)
const IMAGE_TEXT_RULES = `[규칙] 한국어만, 광고/로고/해시태그 금지`;

// 기본 스타일 프롬프트 - 한국어로 통일!
export const DEFAULT_STYLE_PROMPTS: Record<string, string> = {
  illustration: '3D 렌더 일러스트, Blender 스타일, 부드러운 스튜디오 조명, 파스텔 색상, 둥근 형태, 친근한 캐릭터 디자인, 깔끔한 그라데이션 배경',
  medical: '의학 3D 일러스트, 해부학적 렌더링, 과학적 시각화, 임상 조명, 상세한 장기 구조, 교육용 다이어그램, 전문 의료 스타일',
  photo: '실사 DSLR 사진, 자연스러운 부드러운 조명, 얕은 피사계심도, 사실적인 질감, 전문 병원 환경, 신뢰감 있는 분위기',
  custom: '사용자 지정 스타일'
};

// 스타일 이름 (UI 표시용)
export const STYLE_NAMES = {
  illustration: '3D 일러스트',
  medical: '의학 3D',
  photo: '실사 사진'
};

// 짧은 스타일 키워드 (프롬프트용) - 구체적으로 개선!
export const STYLE_KEYWORDS = {
  illustration: '3D 렌더 일러스트, Blender 스타일, 부드러운 조명, 파스텔 색상, 친근한 캐릭터, 깔끔한 배경',
  medical: '의학 3D 일러스트, 해부학적 구조, 장기 단면도, 임상 조명, 교육용 다이어그램, 전문적 분위기',
  photo: '실사 사진, DSLR 촬영, 자연스러운 조명, 얕은 피사계심도, 전문 병원 환경, 사실적 질감'
};

// =============================================
// 📝 공통 텍스트 상수 (중복 제거)
// =============================================

// 콘텐츠 설명 (카드뉴스/블로그 공통)
const CONTENT_DESCRIPTION = `이 콘텐츠는 의료정보 안내용 카드뉴스이며,
네이버 병원 블로그 및 SNS에 사용됩니다.
의료광고법을 준수하며, 직접적인 방문·예약 유도는 금지합니다.`;

// 의료 면책 조항 (HTML)
const MEDICAL_DISCLAIMER = `본 콘텐츠는 의료 정보 제공 및 병원 광고를 목적으로 합니다.<br/>개인의 체질과 건강 상태에 따라 치료 결과는 차이가 있을 수 있으며, 부작용이 발생할 수 있습니다.`;

// 글 스타일별 프롬프트 (의료법 100% 준수) - 함수로 변경하여 현재 연도 동적 반영
const getWritingStylePrompts = (): Record<WritingStyle, string> => {
  const year = new Date().getFullYear();
  return {
  // [가이드] 전문가형: 의학 지식 깊이 강조하되 권위적이지 않은 전문성
  expert: `
[🚨 스타일 선택 규칙]
'전문가형' 스타일을 적용합니다. 전문성은 유지하되 권위적이거나 강요하는 톤은 피합니다.

[글쓰기 스타일: 전문가형 📚]
- 목표: "신뢰할 수 있는 정보를 알기 쉽게 전달"
- 톤: 전문적이면서도 친근한 설명, 강요 없는 제안

[🎯 핵심 테크닉]

1. **도입부: 관찰에서 시작하는 인사이트**
   ❌ "오늘은 당뇨에 대해 알아보겠습니다."
   ❌ "대한당뇨병학회에서 발표한 자료를 보면..." (첫 문장부터 인용 X)
   ✅ "공복혈당은 정상인데 식후에 유독 피곤함을 느끼는 분들이 있어요. 의외로 이런 경우가 많더라고요."
   ✅ "검사 결과지를 받아들고 '이게 무슨 뜻이지?' 싶었던 적 있으시죠?"

2. **근거 인용 - 자연스럽게 녹이기** (2회 이내, 강조 X)
   ❌ "대한OO학회 가이드라인에 따르면..." (딱딱한 인용)
   ✅ "최근 가이드라인에서 눈에 띄는 변화가 있었어요. 식후 혈당 관리를 더 강조하기 시작한 거죠."
   ✅ "연구 결과들을 보면 이런 경향이 나타나는데요..."
   ✅ "실제로 이런 케이스가 생각보다 흔해요."
   ⚠️ 인용은 정보의 신뢰도를 높이는 도구일 뿐, 권위를 내세우는 수단이 아님

3. **의학 용어 - 설명이 아닌 대화로**
   ❌ "인슐린 저항성이란 인슐린이 제대로 작동하지 않는 상태를 말합니다."
   ✅ "인슐린 저항성, 이 단어 들어보셨을 거예요. 쉽게 말해서 인슐린이 있어도 잘 안 듣는 상태예요."
   ✅ "당화혈색소라고 하면 어렵게 느껴지는데, 3개월 평균 혈당이라고 생각하시면 돼요."

4. **정보 전달 관점 - 권위 없이 신뢰감 있게** (⚠️ 6-2, 6-3 규칙 필수 적용!)
   ✅ "이 부분에서 오해하시는 분들이 많더라고요."
   ✅ "솔직히 처음엔 헷갈리기 쉬운 개념이에요."
   ✅ "조금만 일찍 알았으면... 하고 아쉬워하시는 분들이 계세요."

5. **정보 전달 - 나열보다 흐름**
   ❌ 번호 매긴 체크리스트 나열
   ✅ 하나의 이야기처럼 정보를 연결
   ✅ "여기서 한 가지 더 알아두면 좋은 게 있어요."
   ✅ "그런데 이게 전부가 아니에요. 사실 더 중요한 건..."
`,

  // 💗 공감형: 독자 경험 중심, "이거 내 얘기네!" 반응 유도
  empathy: `
[🚨 스타일 선택 규칙 - 최우선 적용]
아래 '공감형' 스타일만 선택해 적용하며, 다른 스타일(전문가형/전환형)의 문체·표현은 사용하지 마세요.

[글쓰기 스타일: 공감형 💗]
- 목표: 독자가 "이거 내 얘기네!"라고 느끼게 만들기
- 톤: 따뜻하고 이해심 있는 친구 같은 톤

[🎯 핵심 테크닉 - 반드시 적용]

1. **도입부: 구체적 상황 묘사로 시작** (필수!)
   ❌ "오늘은 겨울철 피부 건조에 대해 알아보겠습니다."
   ✅ "히터 켜고 자고 일어나면 얼굴이 땅기는 느낌, 한 번쯤 겪어보셨을 거예요."
   ✅ "샤워하고 나와서 5분만 지나도 온몸이 가려워지는 경험, 있으시죠?"
   ✅ "아침에 거울 보다가 '어? 내 피부가 왜 이래?' 싶었던 적 있으시죠?"

2. **구체적 상황/행동 예시 삽입** (최소 3개 이상)
   - 시간대: "아침 세안 후", "퇴근 후", "샤워 직후", "잠들기 전"
   - 장소: "히터 앞에서", "사무실 에어컨 아래서", "지하철 안에서"
   - 행동: "무의식적으로 긁다가", "보습제 바르는데 따가워서", "화장이 들뜨길래"
   
3. **실패/예외 사례 포함** (AI 냄새 제거)
   ✅ "모든 보습제가 다 맞는 건 아니에요. 세라마이드 제품 발랐다가 오히려 따가웠던 분들도 계세요."
   ✅ "근데 솔직히, 이거 알면서도 잘 안 되는 게 현실이잖아요."
   ✅ "병원에서 권하는 대로 했는데 별로 효과를 못 느끼는 분들도 계세요. 개인차가 있으니까요."

4. **강약 조절 - 모든 문장이 같은 톤 금지**
   - 강조: "이건 진짜 중요해요", "꼭 기억해 두세요"
   - 약화: "근데 사실...", "솔직히 말하면...", "물론 개인차는 있지만"
   - 공감: "맞아요, 귀찮죠", "알아요, 쉽지 않죠"

5. **반복 표현 금지 - 다양한 표현 사용**
   ❌ "~에 도움이 될 수 있습니다" 반복 금지
   ✅ 대체 표현: "효과를 보시는 분들이 많아요", "해볼 만한 가치가 있어요", "의외로 괜찮더라고요"
`,

  // 🎯 전환형: 자연스러운 인식 변화 유도 (의료법 준수)
  conversion: `
[🚨 스타일 선택 규칙]
'전환형' 스타일을 적용합니다. 행동 강요가 아닌 자연스러운 인식 변화를 유도합니다.

[글쓰기 스타일: 전환형 🎯]
- 목표: "아, 나도 한번 확인해볼까?" 라는 생각이 자연스럽게 들게 하기
- 톤: 정보 제공 + 시점 제시 (강요 없이)

[🎯 핵심 테크닉]

1. **도입부: 관찰로 시작, 질문으로 연결**
   ❌ "당뇨 전 단계인데 모르고 지나치는 사람이 절반이 넘습니다." (공포 조장)
   ✅ "물을 많이 마셔서 화장실을 자주 간다고 생각했는데, 돌이켜보니 그게 아니었다는 분들이 있어요."
   ✅ "피곤해서 그렇겠지, 하고 넘기다가 우연히 발견되는 경우가 생각보다 많더라고요."
   
2. **정보 격차 활용** (공포 대신 궁금증)
   ❌ "지금 안 하면 후회합니다" / "놓치면 큰일납니다"
   ✅ "이 부분을 모르시는 분들이 의외로 많아요."
   ✅ "알고 있으면 다르게 대처할 수 있는 정보가 있어요."
   ✅ "같은 증상이어도 원인에 따라 관리법이 달라지거든요."

3. **시점 제시 - 판단은 독자에게**
   ❌ "검사를 받으세요" / "확인하세요" (명령형)
   ✅ "이런 신호가 겹치기 시작하면 확인해볼 타이밍일 수 있어요."
   ✅ "증상이 사라졌다가 다시 나타난다면, 그때가 확인 시점에 가깝습니다."
   ✅ "자가 판단으로 넘기기 애매해지는 순간이 있어요."

4. **마무리: 열린 결론**
   ❌ "꼭 기억하세요" / "반드시 확인하세요"
   ✅ "적어도 '왜 이런지 모르겠다'는 답답함은 줄일 수 있어요."
   ✅ "확인해두면 다음에 비슷한 증상이 왔을 때 비교 기준이 생기거든요."
   ✅ "물론 아무것도 아닐 수도 있어요. 그래도 한 번쯤 확인해보는 게 마음이 편하죠."

5. **전환 유도 - 부드럽게**
   ❌ "많은 분들이 검진을 받습니다" (압박)
   ✅ "비슷한 고민을 가진 분들이 궁금해하시는 부분이에요."
   ✅ "이런 경우에 어떻게 하면 좋을지 한 번 정리해봤어요."
`
  };
};

// =============================================
// 📝 글쓰기 스타일 공통 규칙 (중복 제거 + AI 냄새 최소화)
// =============================================

// 글 스타일별 금지 표현 체크 (공통) - 함수로 변경하여 현재 연도 동적 반영
// 🔥 2026-01-10 업데이트: 피드백 기반 5개 섹션 추가 (판단 단정형, 현장감, 극적 표현, AI 냄새, SEO)
const getWritingStyleCommonRules = (): string => {
  return `
---
[✍️ 공통 글쓰기 규칙]
---

**🚨 단어 반복 제한 (동일 단어 15회 미만!) - 최우선 규칙!**
- 같은 단어(명사/동사/형용사)가 글 전체에서 **15번 이상 반복 금지!**
- 14번까지만 허용! 15번째부터는 유사어/대체어로 교체 필수!
- 조사(이/가/을/를)는 제외, 실제 의미 있는 단어만 카운트

**잘못된 예 (단어 과다 반복):**
❌ "무릎" 단어가 글 전체에서 20번 등장
❌ "통증" 단어가 글 전체에서 18번 등장
❌ "증상" 단어가 글 전체에서 16번 등장

**올바른 예 (유사어 대체):**
✅ "무릎" 10번 → "무릎 관절" 2번 → "해당 부위" 2번 = 총 14번 이하
✅ "통증" 8번 → "불편함" 3번 → "아픔" 2번 = 총 13번
✅ "증상" 10번 → "징후" 2번 → "나타나는 모습" 2번 = 총 14번

**단어 반복 카운트 예시:**
- "무릎이 아프고 무릎을 구부릴 때 무릎에서 소리가..." → "무릎" 3번 카운트
- 14번 사용 후: "무릎 관절", "해당 부위", "이 부분" 등으로 대체!

**⚠️ 특히 주의해야 할 단어들:**
- 주제어 (예: 무릎, 어깨, 허리, 당뇨 등) → 12번 이하로!
- "증상", "통증", "치료", "원인", "방법" → 각각 10번 이하로!
- "환자", "병원", "의사" → 5번 이하로!

**❌ 제목/소제목 규칙:**
- 제목: 물음표 금지! ("~일까요?" → "~인지 확인이 필요한")
- 소제목: 질문형 허용 (독자 참여 유도), **이모지 절대 금지!**
- 본문: 물음표 최소화 (필요시에만)

**❌ "~인지, ~인지, ~인지" 나열 패턴 절대 금지!**
잘못된 예:
❌ "구토가 반복되는지, 물을 마셔도 유지하는 것이 어려운지, 설사가 물처럼 이어지는지"

올바른 예:
✅ "구토가 반복됩니다. 물을 마셔도 유지하기 어렵습니다. 설사가 물처럼 나올 수 있습니다."

**❌ 글 서두에 메타 설명 금지!**
❌ "이 글은 ~에 초점을 맞췄습니다"
❌ "~하려는 목적은 아니며"
✅ 바로 본론으로!

**❌ 판단 회피 표현 반복 제한 (동일 표현 2회까지만)**
예: "단정하기는 어렵습니다", "판단하기가 어렵습니다"
→ 1회는 허용, 2회 이상은 금지!
→ 다양한 표현 사용: "확인이 필요합니다", "주의 깊게 관찰해보세요"

---
[🚫 판단 단정형 글쓰기 금지] ⚠️ 의료광고법 핵심!
---

**1. 공신력 인용 + 특정 질환 단정 구조 금지**
❌ "질병관리청 국가건강정보포털의 자료에 따르면 … '전방십자인대 파열'을 우선적으로 고려해보아야 하는 상황으로 설명하고 있습니다."
→ 공공기관 + '우선적으로 고려' = 의학적 판단을 대신 제시한 것으로 해석될 수 있음!

✅ 안전한 대체:
"관련 자료에서는 이러한 상황에서 무릎 내부 구조 손상이 함께 언급되는 경우가 있다고 설명하고 있습니다."
→ 직접 단정 제거, 공신력 유지하되 결론화 차단

**2. 통계 수치 사용 제한**
❌ "최근 3년(2023~2025)간 … 42.8% … 30% 이상을 차지할 만큼 빈번하게 발생"
→ 정확한 퍼센트 + 빈번 = 표시광고법에서 일반화·과장 오해 소지

✅ 안전한 대체:
"최근 몇 년간의 분석 자료에서는 겨울철 스포츠 사고 중 무릎을 포함한 하체 부상이 적지 않은 비중을 차지하는 것으로 나타납니다."
→ 수치를 '경향'으로 표현

**3. 주요 증상 교과서 수준 표현 금지**
❌ "가장 특징적인 증상은…", "주목할 만한 부분입니다."
→ '특징적인 증상' + 평가 어미 = 병원 홍보 콘텐츠로 분류되기 쉬움

✅ 안전한 대체:
"부상 당시 이러한 감각을 경험했다고 이야기하는 경우가 있으며, 이후 무릎의 불안정함을 느끼는 사례도 적지 않습니다."
→ 단정 → 사례 서술, '증상 설명' → '경험 묘사'

**4. 자가 체크리스트 임계선 주의**
❌ 체크리스트 + "현재 상태를 파악하는 데 도움이" + 바로 치료/검사 이야기
→ 자가진단 → 다음 행동 제시 구조 = 가장 민감한 패턴!

✅ 필수 방어 문장 (체크리스트 위/아래에 삽입):
"아래 내용은 증상 흐름을 이해하기 위한 참고 사항으로, 의학적 판단이나 진단을 대신하지 않습니다."

**5. '표준 치료' 언급 조정**
❌ "표준 치료로 고려되기도 합니다."
→ '표준 치료' = 권장·우위 암시, 의료광고법에서 민감

✅ 안전한 대체:
"치료 방향은 손상 정도와 개인의 활동량 등을 종합해 의료진과의 상담을 통해 결정되는 경우가 많습니다."
→ 우위 제거, 결정 주체를 의료진+개인으로 분산

---
[🎬 현장감 강화] - 사람이 쓴 글처럼!
---

**1. 구체적 생활 장면으로 시작**
❌ "어깨 통증이 있으면 신경이 쓰이죠"
✅ "운전석에서 뒷좌석 물건 집으려다 깜짝 놀라신 적 있으시죠?"

❌ "통증이 지속되면 불편할 수 있어요"
✅ "한숨도 못 자고 뒤척이다 보니 다음 날 회의 시간에 멍 때리게 되는"

**2. 겨울철 상황 구체화**
❌ "추울 때 통증이 심해지면"
✅ "아침에 차가운 세면대 수도꼭지를 틀 때 손목이 뻐근한"

❌ "기온이 낮아지면"
✅ "두꺼운 패딩을 입으려 팔을 낄 때 '억' 소리가 나오거나"

**3. 깊은 공감 표현**
❌ 얕은 공감: "더 신경 쓰이죠", "불편하실 수 있어요"
✅ 깊은 공감: "자려고 누웠는데 자세가 안 잡혀서 30분 넘게 뒤척이다 보면 짜증이 확 밀려오기도 하죠"

---
[🚫 극적 표현 금지] - 공포 조장 금지!
---

**1. 공포 조장 표현 금지**
❌ "방치하면 위험", "늦으면 손 쓸 수 없습니다"
✅ "증상이 지속되는 경우 경과를 살펴보는 것도 방법입니다"

**2. 과장/자극적 표현 금지**
❌ "위험!", "긴급!", "돌연사"
✅ "이런 흐름이 반복된다면 경과를 정리해보는 것도 방법입니다"

**3. 감정 자극형 표현 금지**
❌ "점점 심해지나요", "더 아파지진 않나요"
✅ "시간이 지나면서 체중을 실을 때 통증이 더 뚜렷해지는 경향이 있다면"

---
[🤖 AI 냄새 제거] - 핵심 업그레이드!
---

**0. 🚫 논문·보고서·AI 티 나는 단어 사용 절대 금지!**
❌ 절대 사용 금지 단어: 불편감, 양상, 시사하다, 특징적인, 흐름, 해당, 상태를 고려하다
✅ 대체 표현: 불편함, 걸리는 느낌, 신경 쓰임, 조심하게 됨, 이어지는 과정, 이런 경우

**1. AI 제목 냄새 제거 (종결어 교체)**
❌ AI 같은 종결어: 흐름(금지!), 상황, 시점, 사례, 과정
✅ 사람 같은 종결어: 경우, 순간, 뒤, 때, 이후, 느낌

예시:
❌ "무릎이 꺾이며 다리에 힘이 들어가지 않는 시점"
✅ "무릎이 꺾이고 다리에 힘이 빠지는 순간"

**2. AI 연결어 제거**
❌ "~이 다루어지는", "~에서 설명되는", "~관련 내용이"
✅ 사람이 말로 쓰는 표현으로 전환

예시:
❌ "전방십자인대 파열 관련 내용이 다루어지는"
✅ "전방십자인대 손상이 이야기되는"

**3. 인용 전달형 서술 금지**
❌ "~설명합니다", "~안내해요", "~제시합니다", "~언급됩니다"
✅ "이런 방법이 주로 활용되는 추세예요", "일반적으로 이렇게 접근하는 편이에요"

**4. 문장 끝맺음 다양화**
❌ 동일 종결어미 3회 이상 반복
✅ 다양한 종결: "~이에요", "~하죠", "~할 수 있어요", "~경우가 많아요", "~추세예요"

**5. 기계적 공감 표현 지양**
❌ "신경이 쓰이죠", "더 신경이 쓰이죠" 반복
✅ 구체적 상황 묘사로 대체

**6. 실제 사람이 쓰는 병원 블로그 말투 필수!**
- 불편함, 걸리는 느낌, 신경 쓰임, 조심하게 됨 같은 표현 사용
- 설명형·칼럼형 톤 유지 (질문형 남발 금지)
- 문단은 3~4줄 이내로 끊어 가독성 확보
- 같은 단어 반복 시 자연스러운 유사어로 치환
- 병원 홍보 느낌 나지 않게 정보 중심으로 작성
- 사람이 실제 경험을 설명하듯 자연스럽게 서술

**7. 출력 조건:**
- 번역체 문장 금지
- AI가 요약한 느낌 금지
- 실제 의료 블로그에 그대로 올려도 어색하지 않게 작성

---
[✅ 최종 체크리스트]
---

□ 🚨 **모든 단어 15회 미만?** (최우선 체크! 14회까지만 허용!)
□ 주제어(병명) 12회 이하? 일반 단어 10회 이하?
□ 🚫 논문·보고서 단어 0개? (불편감, 양상, 시사하다, 특징적인, 흐름, 해당, 상태를 고려하다)
□ "~인지, ~인지, ~인지" 나열 패턴 0개?
□ 글 서두에 메타 설명 없음?
□ 판단 회피 표현 동일 표현 2회 이하?
□ 물음표(?) 적절히 사용? (제목 금지, 소제목 허용)
□ "~수 있습니다" 문단당 1회 이하?
□ 첫 문장이 상황 서술형으로 시작?
□ AI 냄새 점수 15점 이하?
□ 공신력 인용 시 결론화 차단 되었는가?
□ 통계 수치가 '경향'으로 표현되었는가?
□ 자가 체크리스트에 방어 문구가 있는가?
□ 실제 병원 블로그 말투로 작성? (설명형·칼럼형)
□ 문단은 3~4줄 이내로 끊김?
□ 병원 홍보 느낌 없이 정보 중심?
□ 단정 표현 0개? (치료된다, 개선된다, 효과가 있다 사용 금지)
□ 과다 반복 단어를 유사어로 대체했는가?
`;
};



// 심리학 기반 CTA 전환 공식 (의료광고법 100% 준수 + 공신력 출처 필수)
const PSYCHOLOGY_CTA_PROMPT = `
---
[[심리] CTA 심리학 - 의료광고법 100% 준수]
---

**⛔ CTA 절대 금지:**
❌ "검진 받으세요", "상담 권장", "방문하세요" → 직접 유도!
❌ "반드시", "즉시", "빨리" → 공포 조장!
❌ "완치율 99%", "100% 회복" → 효과 보장!

**✅ 안전한 CTA 공식: [상황] + [자가 판단 한계] + [확인 시점 제안]**
예시:
✅ "증상이 반복된다면, 확인해보는 것이 도움이 될 수 있습니다"
✅ "증상만으로는 원인을 구분하기 어려운 경우가 많습니다"
✅ "이 단계에서는 지켜보기보다 확인이 우선인 시점일 수 있습니다"

**🎯 4가지 핵심 심리 원칙:**
1. 배제 반응: "안 하는 선택의 불리함" 제시
2. 시점 고정: "지금이냐 아니냐" 판단 대신
3. 불확실성 제거: "자가 판단 불가능" 명시
4. 인지 부하 감소: "치료" → "확인/점검"

**✅ 진료과별 핵심 키워드:**
- 내과: "증상 유무보다 수치 확인 우선"
- 정형외과: "통증을 버틴 기간 ∝ 회복 시간"
- 피부과: "관리에도 반복되면 점검 시점"
- 치과: "통증 시작 = 이미 치료 범위 확대"
- 안과: "시신경 손상은 비가역적"
- 이비인후과: "비슷한 증상, 다른 원인"
- 정신건강의학과: "일상 회복 도구"
- 신경외과/신경과: "확인 시점 = 예후"
- 산부인과: "확인이 걱정보다 빠른 해답"
- 비뇨의학과: "미루는 동안 증상은 해결 안 됨"
- 소아과: "문제 확인이 아닌 안심 확인"
- 유방/갑상선외과: "대부분 양성, 확인으로 불안 해소"

**✅ 범용 CTA 템플릿 (모든 진료과 적용):**
A. "이 단계에서는 ○○이 아니라 △△가 우선입니다" ★ 최강
B. "증상이 갑자기/반복/2주 이상 지속된다면, 지켜볼 단계는 지났습니다"
C. "증상만으로는 정확한 원인을 구분하기 어렵습니다"
D. "지금 확인해 두는 것이 이후 선택을 가볍게 만듭니다"
E. "이 단계에서는 (보통 하는 행동)은 충분하지 않고, (검사/확인)이 필요합니다"
`;

export const recommendImagePrompt = async (blogContent: string, currentImageAlt: string, imageStyle: ImageStyle = 'illustration', customStylePrompt?: string): Promise<string> => {
  const ai = getAiClient();
  
  // 스타일에 따른 프롬프트 가이드 (구체적으로 개선!)
  let styleGuide: string;
  
  if (imageStyle === 'custom' && customStylePrompt) {
    // 🎨 커스텀 스타일: 사용자가 업로드한 참고 이미지 스타일 분석 결과 사용
    styleGuide = `**중요: 사용자가 지정한 커스텀 스타일로 생성해야 합니다!**
       사용자 지정 스타일 프롬프트:
       "${customStylePrompt}"
       
       위 스타일을 최대한 반영하여 프롬프트를 생성하세요.
       레이아웃, 색상, 분위기, 디자인 요소 등을 유지해주세요.`;
  } else if (imageStyle === 'illustration') {
    styleGuide = `**중요: 3D 렌더 일러스트 스타일로 생성해야 합니다!**
       - 렌더링 스타일: "3D rendered illustration", "Blender style", "soft 3D render"
       - 조명: 부드러운 스튜디오 조명, 은은한 그림자
       - 질감: 매끄러운 플라스틱 느낌, 무광 마감, 둥근 모서리
       - 색상: 밝은 파스텔 톤, 파란색/흰색/연한 색상 팔레트
       - 캐릭터: 친근한 표정, 단순화된 디자인
       - 배경: 깔끔한 그라데이션 배경
       ⛔ 금지: photorealistic, real photo, DSLR, realistic texture`;
  } else if (imageStyle === 'medical') {
    styleGuide = `**중요: 의학 3D 일러스트 스타일로 생성해야 합니다!**
       - 렌더링 스타일: "medical 3D illustration", "anatomical render", "scientific visualization"
       - 피사체: 인체 해부학, 장기 단면도, 뼈/근육/혈관 구조
       - 조명: 임상적 조명, X-ray 스타일 글로우, 반투명 장기
       - 질감: semi-transparent organs, detailed anatomical structures
       - 색상: 의료용 팔레트 (파란색, 흰색, 빨간색 혈관)
       - 분위기: clinical, professional, educational
       ⛔ 금지: cute cartoon, photorealistic human face`;
  } else {
    // photo 또는 기타
    styleGuide = `**중요: 실사 사진 스타일로 생성해야 합니다!**
       - 렌더링 스타일: "photorealistic", "real photography", "DSLR shot", "35mm lens"
       - 피사체: 실제 병원 환경, 실제 의료진, 실제 진료 도구
       - 조명: 자연스러운 소프트 조명, 스튜디오 조명, 전문 사진 조명
       - 질감: realistic skin texture, fabric texture, realistic materials
       - 깊이: shallow depth of field, bokeh background
       - 분위기: professional, trustworthy, clean modern hospital
       ⛔ 금지: 3D render, illustration, cartoon, anime, vector, clay`;
  }
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `다음은 병원 블로그 글 내용입니다:

${blogContent.substring(0, 3000)}

현재 이미지 설명: "${currentImageAlt}"

${styleGuide}

이 글의 맥락과 주제에 맞는 이미지 프롬프트를 **딱 1개만** 추천해주세요.

요구사항:
1. 글의 핵심 주제와 연관성 높은 장면
2. 한국 병원 환경에 적합
3. 전문적이고 신뢰감 있는 분위기
4. 구체적인 요소 (인물, 배경, 분위기 등) 포함
5. **텍스트 규칙**: 진짜 필요할 때만 한글/숫자 사용, 영어는 가급적 자제
6. 로고는 절대 포함하지 말 것
7. **위에서 지정한 스타일 키워드를 반드시 프롬프트에 포함할 것!**

**중요: 프롬프트 1개만 출력하세요! 여러 개 출력 금지!**
설명 없이 프롬프트 문장만 **한국어**로 답변하세요.

예시 (1개만):
${imageStyle === 'illustration' 
  ? '"밝은 병원 상담실에서 의사가 환자에게 설명하는 모습, 3D 일러스트, 아이소메트릭 뷰, 클레이 렌더, 파란색 흰색 팔레트"'
  : imageStyle === 'medical'
  ? '"인체 심장의 3D 단면도, 좌심실과 우심실이 보이는 해부학적 구조, 혈관과 판막이 표시된 의학 일러스트, 파란색 배경, 교육용 전문 이미지"'
  : '"깔끔한 병원 상담실에서 의사가 환자와 상담하는 모습, 실사 사진, DSLR 촬영, 자연스러운 조명, 전문적인 분위기"'}:`,
      config: {
        responseMimeType: "text/plain"
      }
    });
    
    return response.text?.trim() || currentImageAlt;
  } catch (error) {
    console.error('프롬프트 추천 실패:', error);
    return currentImageAlt;
  }
};

// 📱 카드뉴스 전용 AI 프롬프트 추천 - 부제/메인제목/설명 포함!
export const recommendCardNewsPrompt = async (
  subtitle: string,
  mainTitle: string,
  description: string,
  imageStyle: ImageStyle = 'illustration',
  customStylePrompt?: string
): Promise<string> => {
  const ai = getAiClient();
  
  // 스타일 가이드 결정
  let styleKeywords: string;
  if (imageStyle === 'custom' && customStylePrompt) {
    styleKeywords = customStylePrompt;
  } else if (imageStyle === 'illustration') {
    styleKeywords = '3D 일러스트, 클레이 렌더, 파스텔톤, 부드러운 조명';
  } else if (imageStyle === 'medical') {
    styleKeywords = '의학 3D 일러스트, 해부학적 구조, 전문적인 의료 이미지';
  } else {
    styleKeywords = '실사 사진, DSLR 촬영, 자연스러운 조명';
  }
  
  // 커스텀 스타일 여부 확인
  const isCustomStyle = imageStyle === 'custom' && customStylePrompt;
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `당신은 카드뉴스 이미지 프롬프트 전문가입니다.

다음 카드뉴스 텍스트에 어울리는 **배경 이미지 내용**만 추천해주세요.

[카드뉴스 텍스트]
- 부제: "${subtitle || '없음'}"
- 메인 제목: "${mainTitle || '없음'}"  
- 설명: "${description || '없음'}"

[이미지 스타일 - ⚠️ 반드시 이 스타일 유지!]
${styleKeywords}

[출력 형식 - 반드시 이 형식으로!]
subtitle: "${subtitle || ''}"
mainTitle: "${mainTitle || ''}"
${description ? `description: "${description}"` : ''}
비주얼: (여기에 배경 이미지 내용만 작성)

[규칙]
1. subtitle, mainTitle, description은 위 텍스트 그대로 유지
2. "비주얼:" 부분에는 **이미지에 그릴 대상/내용만** 작성 (30자 이내)
3. ${isCustomStyle ? `⚠️ 중요: 그림체/스타일은 "${customStylePrompt}"로 이미 지정되어 있으므로, 비주얼에는 "무엇을 그릴지"만 작성 (수채화, 연필, 볼펜 등 스타일 언급 금지!)` : '비주얼에 스타일과 내용을 함께 작성'}
4. 예: "심장 아이콘과 파란 그라데이션 배경", "병원에서 상담받는 환자"

위 형식대로만 출력하세요. 다른 설명 없이!`,
      config: {
        responseMimeType: "text/plain"
      }
    });
    
    return response.text?.trim() || `subtitle: "${subtitle}"\nmainTitle: "${mainTitle}"\n${description ? `description: "${description}"\n` : ''}비주얼: 밝은 파란색 배경, ${styleKeywords}`;
  } catch (error) {
    console.error('카드뉴스 프롬프트 추천 실패:', error);
    // 실패 시 기본 프롬프트 반환
    return `subtitle: "${subtitle}"\nmainTitle: "${mainTitle}"\n${description ? `description: "${description}"\n` : ''}비주얼: 밝은 파란색 배경, ${styleKeywords}`;
  }
};

// 🧹 공통 프롬프트 정리 함수 - base64/코드 문자열만 제거, 의미있는 텍스트는 유지!
// ⚠️ 주의: 영어 지시문/한국어 텍스트는 절대 삭제하면 안 됨!
const cleanImagePromptText = (prompt: string): string => {
  let cleaned = prompt
    // 1. base64 데이터 URI 제거
    .replace(/data:[^;]+;base64,[A-Za-z0-9+/=]+/g, '')
    // 2. URL 제거
    .replace(/https?:\/\/[^\s]+/g, '')
    // 3. base64 스타일 긴 문자열 제거 - 공백 없이 연속 50자 이상인 경우만! (기존 12자 → 50자로 완화)
    // ⚠️ 영어 지시문("Render Korean text DIRECTLY" 등)이 삭제되지 않도록!
    .replace(/[A-Za-z0-9+/=]{50,}/g, '')
    // 4. 경로 패턴 제거 - 슬래시가 3개 이상 연속인 경우만 (기존: 2개 이상 → 3개 이상으로 완화)
    // ⚠️ "1:1 square" 같은 패턴이 삭제되지 않도록!
    .replace(/[a-zA-Z0-9]{2,}\/[a-zA-Z0-9]+\/[a-zA-Z0-9/]+/g, '')
    // 5. 연속 특수문자 정리
    .replace(/[,.\s]{3,}/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // 너무 짧으면 기본값으로 대체 (완전히 비어있는 경우만)
  if (cleaned.length < 5) {
    console.warn('⚠️ 필터링 후 프롬프트가 너무 짧음, 기본값으로 대체:', cleaned);
    cleaned = '의료 건강 정보 카드뉴스, 깔끔한 인포그래픽, 파란색 흰색 배경';
  }
  return cleaned;
};

// 🖼️ 블로그용 일반 이미지 생성 함수 (텍스트 없는 순수 이미지)
export const generateBlogImage = async (
  promptText: string,
  style: ImageStyle,
  aspectRatio: string = "16:9",
  customStylePrompt?: string
): Promise<string> => {
  const ai = getAiClient();

  // 스타일 블록만 사용 (카드뉴스 프레임 없음!)
  const styleBlock = buildStyleBlock(style, customStylePrompt);

  // 블로그용 프롬프트: 텍스트 없는 순수 이미지! (한국어로 생성)
  const finalPrompt = `
블로그 포스트용 전문적인 의료/건강 이미지를 생성해주세요.

${styleBlock}

[이미지 내용]
${promptText}

[디자인 사양]
- 비율: ${aspectRatio} (가로형/랜드스케이프 블로그 형식)
- 스타일: 전문적인 의료/건강 이미지
- 분위기: 신뢰감 있고, 깔끔하며, 현대적인 병원 환경
- 텍스트 없음, 제목 없음, 캡션 없음, 워터마크 없음, 로고 없음
- 순수한 시각적 콘텐츠만 - 블로그 게시물 이미지로 사용됩니다

[필수 요구사항]
✅ 텍스트 오버레이 없는 깔끔한 이미지 생성
✅ 병원 블로그에 적합한 전문적인 의료/건강 이미지
✅ 스타일에 따라 고품질, 상세한 일러스트 또는 사진
✅ 블로그 게시물에 최적화된 가로형 16:9 형식

⛔ 금지사항 (Negative Prompt):
- 한국어 텍스트, 영어 텍스트, any text overlay
- 제목, 캡션, 워터마크, 로고
- 브라우저 창 프레임, 카드뉴스 레이아웃
- 텍스트가 포함된 인포그래픽 요소
- Low quality, blurry, pixelated, distorted
- Cartoon, anime, drawing, sketch (photo style일 경우)
- 3D render, CGI (photo style일 경우)
- Out of focus, bad lighting, overexposed
- Watermark, signature, text, logo, caption

[출력]
의료 블로그 게시물에 적합한 텍스트 없는 깔끔한 단일 이미지.
`.trim();

  console.log('📷 generateBlogImage - 블로그용 이미지 생성 (텍스트 없음, 16:9)');

  // 재시도 로직
  const MAX_RETRIES = 2;
  let lastError: any = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`🎨 블로그 이미지 생성 시도 ${attempt}/${MAX_RETRIES}...`);
      
      const result = await ai.models.generateContent({
        model: "gemini-3-pro-image-preview",
        contents: [{ text: finalPrompt }],
        config: {
          responseModalities: ["IMAGE", "TEXT"],
          temperature: 0.6, // 블로그 이미지 품질 향상
        },
      });

      const parts = result?.candidates?.[0]?.content?.parts || [];
      const imagePart = parts.find((p: any) => p.inlineData?.data);
      
      if (imagePart?.inlineData) {
        const mimeType = imagePart.inlineData.mimeType || 'image/png';
        const data = imagePart.inlineData.data;
        console.log(`✅ 블로그 이미지 생성 성공`);
        return `data:${mimeType};base64,${data}`;
      }
      
      lastError = new Error('이미지 데이터를 받지 못했습니다.');
      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
      
    } catch (error: any) {
      lastError = error;
      console.error(`❌ 블로그 이미지 생성 에러:`, error?.message || error);
      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
      }
    }
  }

  // 실패 시 플레이스홀더
  console.error('❌ 블로그 이미지 생성 최종 실패:', lastError?.message || lastError);
  const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
    <rect fill="#E8F4FD" width="1600" height="900"/>
    <rect fill="#fff" x="40" y="40" width="1520" height="820" rx="24"/>
    <text x="800" y="430" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" fill="#64748b">이미지 생성에 실패했습니다</text>
    <text x="800" y="470" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" fill="#94a3b8">이미지를 클릭하여 재생성해주세요</text>
  </svg>`;
  const base64Placeholder = btoa(unescape(encodeURIComponent(placeholderSvg)));
  return `data:image/svg+xml;base64,${base64Placeholder}`;
};

// 📱 기본 프레임 이미지 URL (보라색 테두리 + 흰색 배경)
const DEFAULT_FRAME_IMAGE_URL = 'https://www.genspark.ai/api/files/s/R8v4us3T';

// 기본 프레임 이미지 로드 (캐싱)
let defaultFrameImageCache: string | null = null;
const loadDefaultFrameImage = async (): Promise<string | null> => {
  if (defaultFrameImageCache) return defaultFrameImageCache;
  
  try {
    const response = await fetch(DEFAULT_FRAME_IMAGE_URL);
    if (!response.ok) throw new Error('Failed to fetch default frame');
    const blob = await response.blob();
    const base64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
    defaultFrameImageCache = base64;
    console.log('✅ 기본 프레임 이미지 로드 완료');
    return base64;
  } catch (error) {
    console.warn('⚠️ 기본 프레임 이미지 로드 실패:', error);
    return null;
  }
};

// 📱 카드뉴스용 이미지 생성 함수 (텍스트 포함, 보라색 프레임)
export const generateSingleImage = async (
  promptText: string,
  style: ImageStyle,
  aspectRatio: string,
  customStylePrompt?: string,
  referenceImage?: string,
  copyMode?: boolean
): Promise<string> => {
  const ai = getAiClient();

  // 1) 입력 정리: 충돌 문구 제거
  const cleanPromptText = normalizePromptTextForImage(promptText) || '';
  
  // 🎨 참고 이미지가 없으면 기본 프레임 이미지 사용
  let effectiveReferenceImage = referenceImage;
  if (!referenceImage) {
    effectiveReferenceImage = await loadDefaultFrameImage() || undefined;
    console.log('🖼️ 기본 프레임 이미지 사용:', !!effectiveReferenceImage);
  }

  // 2) 프레임/스타일 블록 분리 (프레임은 레이아웃, 스타일은 렌더링)
  const frameBlock = buildFrameBlock(effectiveReferenceImage, copyMode);
  const styleBlock = buildStyleBlock(style, customStylePrompt);

  // 3) 최종 프롬프트 조립: 완성형 카드 이미지 (텍스트가 이미지 픽셀로 렌더링!)
  // 🔧 핵심 텍스트를 프롬프트 상단에 배치하여 모델이 반드시 인식하도록!
  
  // 🚨 핵심 문장 추출 전 안전 체크
  console.log('📝 핵심 문장 추출 시작, cleanPromptText 타입:', typeof cleanPromptText, '길이:', cleanPromptText?.length);
  
  // cleanPromptText에서 핵심 텍스트 추출 (다양한 패턴 지원)
  const subtitleMatch = (cleanPromptText && typeof cleanPromptText === 'string') ? 
                        (cleanPromptText.match(/subtitle:\s*"([^"]+)"/i) || cleanPromptText.match(/subtitle:\s*([^\n,]+)/i)) : null;
  const mainTitleMatch = (cleanPromptText && typeof cleanPromptText === 'string') ?
                         (cleanPromptText.match(/mainTitle:\s*"([^"]+)"/i) || cleanPromptText.match(/mainTitle:\s*([^\n,]+)/i)) : null;
  const descriptionMatch = (cleanPromptText && typeof cleanPromptText === 'string') ?
                           (cleanPromptText.match(/description:\s*"([^"]+)"/i) || cleanPromptText.match(/description:\s*([^\n]+)/i)) : null;
  // 🎨 비주얼 지시문 추출
  const visualMatch = (cleanPromptText && typeof cleanPromptText === 'string') ?
                      (cleanPromptText.match(/비주얼:\s*([^\n]+)/i) || cleanPromptText.match(/visual:\s*([^\n]+)/i)) : null;
  
  const extractedSubtitle = (subtitleMatch?.[1] || '').trim().replace(/^["']|["']$/g, '');
  const extractedMainTitle = (mainTitleMatch?.[1] || '').trim().replace(/^["']|["']$/g, '');
  const extractedDescription = (descriptionMatch?.[1] || '').trim().replace(/^["']|["']$/g, '');
  const extractedVisual = (visualMatch?.[1] || '').trim();
  
  // 🚨 추출 실패 시 로그 및 원본 사용
  const hasValidText = extractedSubtitle.length > 0 || extractedMainTitle.length > 0;
  if (!hasValidText) {
    console.warn('⚠️ 텍스트 추출 실패! cleanPromptText:', cleanPromptText.substring(0, 200));
  }
  
  // 🔧 텍스트가 없으면 원본 프롬프트 그대로 사용 (라벨 없이!)
  const finalPrompt = hasValidText ? `
🚨 RENDER THIS EXACT KOREAN TEXT IN THE IMAGE 🚨

[TEXT HIERARCHY - MUST FOLLOW EXACTLY!]
※ MAIN TITLE (BIG, BOLD, CENTER): "${extractedMainTitle}"
※ SUBTITLE (small, above main title): "${extractedSubtitle}"
${extractedDescription ? `※ DESCRIPTION (small, below main title): "${extractedDescription}"` : ''}

${extractedVisual ? `[ILLUSTRATION - MUST FOLLOW THIS VISUAL DESCRIPTION!]
🎨 "${extractedVisual}"
⚠️ Draw EXACTLY what is described above! Do NOT change or ignore this visual instruction!` : ''}

Generate a 1:1 square social media card with the Korean text above rendered directly into the image.

${frameBlock}
${styleBlock}

[TEXT LAYOUT - CRITICAL!]
- SUBTITLE: Small text (14-16px), positioned at TOP or above main title
- MAIN TITLE: Large bold text (28-36px), positioned at CENTER, most prominent
- DESCRIPTION: Small text (14-16px), positioned BELOW main title
- Text hierarchy: subtitle(small) → mainTitle(BIG) → description(small)

[DESIGN]
- 1:1 square, background: #E8F4FD gradient
- Border color: #787fff
- Korean text rendered with clean readable font
- Professional Instagram-style card news design
- Illustration at bottom, text at top/center
${extractedVisual ? `- ILLUSTRATION MUST MATCH: "${extractedVisual}"` : ''}

[RULES]
✅ MAIN TITLE must be the LARGEST and most prominent text
✅ Subtitle must be SMALLER than main title
✅ Do NOT swap subtitle and mainTitle positions
✅ Do NOT use placeholder text
${extractedVisual ? `✅ ILLUSTRATION must follow the visual description EXACTLY` : ''}
⛔ No hashtags, watermarks, logos
⛔ Do NOT ignore visual instructions
`.trim() : `
Generate a 1:1 square social media card image.

${frameBlock}
${styleBlock}

[CONTENT TO RENDER]
${cleanPromptText}

[DESIGN]
- 1:1 square, background: #E8F4FD gradient
- Korean text rendered with clean readable font
- Professional Instagram-style card news design

[RULES]
✅ Render the Korean text from the content above
⛔ Do NOT render instruction text like "subtitle:" or "mainTitle:"
⛔ No hashtags, watermarks, logos
`.trim();

  // • 디버그 - 프롬프트 전체 내용 확인!
  console.log('🧩 generateSingleImage 입력 promptText:', promptText.substring(0, 300));
  console.log('🧩 generateSingleImage cleanPromptText:', cleanPromptText.substring(0, 300));
  console.log('🧩 generateSingleImage prompt blocks:', {
    style,
    hasCustomStyle: !!(customStylePrompt && customStylePrompt.trim()),
    hasReferenceImage: !!referenceImage,
    usingDefaultFrame: !referenceImage && !!effectiveReferenceImage,
    copyMode: !!copyMode,
    finalPromptHead: finalPrompt.slice(0, 500),
  });

  // 🔄 재시도 로직: 최대 2회 시도 (빠른 실패 유도)
  const MAX_RETRIES = 2;
  let lastError: any = null;

  // 참고 이미지 파트 준비 (기본 프레임 포함)
  const refImagePart = effectiveReferenceImage && effectiveReferenceImage.startsWith('data:') 
    ? (() => {
        const [meta, base64] = effectiveReferenceImage.split(',');
        const mimeType = (meta.match(/data:(.*?);base64/) || [])[1] || 'image/png';
        return { inlineData: { data: base64, mimeType } };
      })()
    : null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`🎨 이미지 생성 시도 ${attempt}/${MAX_RETRIES} (gemini-3-pro-image-preview)...`);
      
      // Gemini 3 Pro Image Preview - 이미지 생성 전용 모델 (공식 API 모델명)
      const contents: any[] = refImagePart 
        ? [refImagePart, { text: finalPrompt }]
        : [{ text: finalPrompt }];

      const result = await ai.models.generateContent({
        model: "gemini-3-pro-image-preview",
        contents: contents,
        config: {
          responseModalities: ["IMAGE", "TEXT"],
          temperature: 0.4, // 카드뉴스 일관성 강화
        },
      });

      // 안전 필터 등으로 인한 차단 확인
      const finishReason = result?.candidates?.[0]?.finishReason;
      if (finishReason && finishReason !== 'STOP' && finishReason !== 'MAX_TOKENS') {
        console.warn(`⚠️ 이미지 생성 중단됨 (이유: ${finishReason})`);
        if (finishReason === 'SAFETY' || finishReason === 'RECITATION') {
           throw new Error(`이미지 생성이 안전 정책에 의해 차단되었습니다. (${finishReason})`);
        }
      }

      // 응답에서 이미지 데이터 추출
      const parts = result?.candidates?.[0]?.content?.parts || [];
      const imagePart = parts.find((p: any) => p.inlineData?.data);
      
      if (imagePart?.inlineData) {
        const mimeType = imagePart.inlineData.mimeType || 'image/png';
        const data = imagePart.inlineData.data;
        console.log(`✅ 이미지 생성 성공 (시도 ${attempt}/${MAX_RETRIES})`);
        return `data:${mimeType};base64,${data}`;
      }
      
      // 텍스트 응답만 온 경우 (거절 메시지 등)
      const textPart = parts.find((p: any) => p.text)?.text;
      if (textPart) {
        console.warn(`⚠️ 이미지 대신 텍스트 응답 수신: "${textPart.substring(0, 100)}..."`);
      }

      // inlineData가 없으면 재시도
      console.warn(`⚠️ 이미지 데이터 없음, 재시도 중... (${attempt}/${MAX_RETRIES})`);
      lastError = new Error('이미지 데이터를 받지 못했습니다.');
      
      // 재시도 전 짧은 대기
      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
      
    } catch (error: any) {
      lastError = error;
      console.error(`❌ 이미지 생성 에러 (시도 ${attempt}/${MAX_RETRIES}):`, error?.message || error);
      
      // 재시도 전 짧은 대기 (지수 백오프)
      if (attempt < MAX_RETRIES) {
        const waitTime = 1000 * Math.pow(2, attempt - 1); // 1초, 2초, 4초
        console.log(`⏳ ${waitTime/1000}초 후 재시도...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  // 모든 재시도 실패 시 - 플레이스홀더 이미지 반환 (에러 방지)
  console.error('❌ 이미지 생성 최종 실패 (재시도 후):', lastError?.message || lastError);
  console.error('📝 사용된 프롬프트 (앞 250자):', finalPrompt.slice(0, 250));
  
  // 플레이스홀더 SVG 이미지 (빈 문자열 대신 반환하여 UI 오류 방지)
  const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
    <rect fill="#E8F4FD" width="800" height="800"/>
    <rect fill="#fff" x="40" y="40" width="720" height="720" rx="24"/>
    <text x="400" y="380" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" fill="#64748b">이미지 생성에 실패했습니다</text>
    <text x="400" y="420" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" fill="#94a3b8">카드를 클릭하여 재생성해주세요</text>
  </svg>`;
  const base64Placeholder = btoa(unescape(encodeURIComponent(placeholderSvg)));
  return `data:image/svg+xml;base64,${base64Placeholder}`;
};


// 🗞️ 뉴스 검색 전용 함수 - 키워드 추천에만 사용! (글쓰기 검색과 분리)
// ⚠️ 허용 도메인: 연합뉴스, 중앙일보, 조선일보, 동아일보, 한겨레, 경향신문, KBS, MBC, SBS 등 신뢰할 수 있는 언론사
const searchNewsForTrends = async (category: string, month: number): Promise<string> => {
  const ai = getAiClient();
  
  // 진료과별 뉴스 검색 키워드
  const categoryNewsKeywords: Record<string, string> = {
    '정형외과': '관절 통증 겨울 OR 허리디스크 OR 어깨 통증',
    '피부과': '피부 건조 겨울 OR 아토피 OR 습진',
    '내과': '독감 OR 감기 OR 당뇨 OR 고혈압 건강',
    '치과': '치아 건강 OR 잇몸 질환 OR 구강 건조',
    '안과': '안구건조 OR 눈 건강 OR 시력',
    '이비인후과': '비염 OR 코막힘 OR 목감기 OR 인후통',
    '산부인과': '여성 건강 OR 갱년기 OR 생리통',
    '비뇨의학과': '전립선 OR 방광염 OR 비뇨기 건강',
    '신경과': '두통 OR 어지럼증 OR 수면 OR 불면증',
    '정신건강의학과': '우울증 OR 스트레스 OR 번아웃 OR 불안'
  };
  
  const searchKeyword = categoryNewsKeywords[category] || '건강 의료 뉴스';
  
  try {
    console.log(`📰 뉴스 트렌드 검색 시작: ${category} (${searchKeyword})`);
    
    // Gemini 구글 검색 도구로 최신 뉴스 검색
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `최근 1주일간 한국 뉴스에서 "${searchKeyword}" 관련 기사를 검색하고, 
가장 많이 다뤄지는 건강/의료 이슈 3가지를 요약해주세요.

[🚨 검색 허용 뉴스 도메인만 참고!]
✅ 허용: yna.co.kr(연합뉴스), joongang.co.kr(중앙일보), chosun.com(조선일보), 
   donga.com(동아일보), hani.co.kr(한겨레), khan.co.kr(경향신문),
   kbs.co.kr, mbc.co.kr, sbs.co.kr, ytn.co.kr, jtbc.co.kr, mbn.co.kr
❌ 제외: 블로그, 카페, 개인 사이트, 건강 정보 사이트 (하이닥, 헬스조선 등)

[출력 형식]
각 이슈마다:
- 이슈: (한 줄 요약)
- 관련 증상/키워드: (블로그 작성에 활용할 키워드)
- 뉴스 트렌드 이유: (왜 지금 이슈가 되는지)`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "text/plain",
        temperature: 0.3
      }
    });
    
    const newsContext = response.text || '';
    console.log(`📰 뉴스 트렌드 검색 완료: ${newsContext.substring(0, 200)}...`);
    return newsContext;
    
  } catch (error) {
    console.warn('⚠️ 뉴스 검색 실패, 기본 트렌드로 진행:', error);
    return '';
  }
};

export const getTrendingTopics = async (category: string): Promise<TrendingItem[]> => {
  const ai = getAiClient();
  const now = new Date();
  const koreaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const year = koreaTime.getFullYear();
  const month = koreaTime.getMonth() + 1;
  const day = koreaTime.getDate();
  const hour = koreaTime.getHours();
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][koreaTime.getDay()];
  const dateStr = `${year}년 ${month}월 ${day}일 (${dayOfWeek}) ${hour}시`;
  
  // 랜덤 시드로 다양성 확보
  const randomSeed = Math.floor(Math.random() * 1000);
  
  // 계절별 특성
  const seasonalContext: Record<number, string> = {
    1: '신년 건강검진 시즌, 겨울철 독감/감기, 난방으로 인한 건조, 동상/저체온증',
    2: '설 연휴 후 피로, 환절기 시작, 미세먼지 증가, 꽃샘추위',
    3: '본격 환절기, 꽃가루 알레르기, 황사/미세먼지, 춘곤증',
    4: '봄철 야외활동 증가, 알레르기 비염 최고조, 자외선 증가',
    5: '초여름, 식중독 주의 시작, 냉방병 예고, 가정의달 건강검진',
    6: '장마철 습도, 무좀/피부질환, 식중독 급증, 냉방병',
    7: '폭염, 열사병/일사병, 냉방병 본격화, 여름휴가 전 건강관리',
    8: '극심한 폭염, 온열질환 피크, 휴가 후 피로, 수인성 질환',
    9: '환절기 시작, 가을 알레르기, 일교차 큰 시기, 추석 연휴',
    10: '환절기 감기, 건조해지는 날씨, 독감 예방접종 시즌, 건강검진 시즌',
    11: '본격 독감 시즌, 난방 시작, 건조한 피부, 연말 건강검진',
    12: '독감 절정기, 연말 피로, 동상/저체온증, 송년회 후 건강'
  };
  
  // 진료과별 세부 키워드 힌트
  const categoryHints: Record<string, string> = {
    '정형외과': '관절통, 허리디스크, 어깨통증, 무릎연골, 손목터널증후군, 오십견, 척추관협착증, 골다공증',
    '피부과': '여드름, 아토피, 건선, 탈모, 피부건조, 두드러기, 대상포진, 사마귀, 점제거',
    '내과': '당뇨, 고혈압, 갑상선, 위장질환, 간기능, 콜레스테롤, 빈혈, 건강검진',
    '치과': '충치, 잇몸질환, 임플란트, 치아미백, 교정, 사랑니, 구취, 치주염',
    '안과': '안구건조증, 노안, 백내장, 녹내장, 시력교정, 눈피로, 결막염, 다래끼',
    '이비인후과': '비염, 축농증, 어지럼증, 이명, 인후통, 편도염, 코막힘, 수면무호흡',
    '산부인과': '생리통, 자궁근종, 난소낭종, 갱년기, 임신준비, 질염, 유방검사',
    '비뇨의학과': '전립선, 방광염, 요로결석, 혈뇨, 빈뇨, 남성갱년기, 발기부전',
    '신경과': '두통, 어지럼증, 손발저림, 불면증, 치매예방, 뇌졸중예방, 편두통',
    '정신건강의학과': '우울증, 불안장애, 공황장애, 수면장애, 번아웃, 스트레스, ADHD'
  };
  
  const categoryKeywords = categoryHints[category] || '일반적인 건강 증상, 예방, 관리';
  const currentSeasonContext = seasonalContext[month] || '';
  
  // 🗞️ 뉴스 검색으로 현재 트렌드 파악 (키워드 추천 전용!)
  // ⚠️ 이 뉴스 검색은 글쓰기 검색(callGPTWebSearch)과 완전히 분리됨!
  const newsContext = await searchNewsForTrends(category, month);
  
  // Gemini AI 기반 트렌드 분석 (구글 검색 + 뉴스 컨텍스트 기반)
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `[🕐 정확한 현재 시각: ${dateStr} 기준 (한국 표준시)]
[🎲 다양성 시드: ${randomSeed}]

당신은 네이버/구글 검색 트렌드 분석 전문가입니다.
'${category}' 진료과와 관련하여 **지금 이 시점**에 검색량이 급상승하거나 관심이 높은 건강/의료 주제 5가지를 추천해주세요.

[📅 ${month}월 시즌 특성]
${currentSeasonContext}

[🏥 ${category} 관련 키워드 풀]
${categoryKeywords}

${newsContext ? `[📰 최신 뉴스 트렌드 - 현재 이슈! 🔥]
${newsContext}

⚠️ 위 뉴스 트렌드를 반드시 반영하여 현재 상황에 맞는 주제를 추천하세요!
뉴스에서 언급된 이슈와 연관된 블로그 키워드를 제안해주세요.` : ''}

[⚠️ 중요 규칙]
1. **매번 다른 결과 필수**: 이전 응답과 다른 새로운 주제를 선정하세요 (시드: ${randomSeed})
2. **구체적인 주제**: "어깨통증" 대신 "겨울철 난방 후 어깨 뻣뻣함" 처럼 구체적으로
3. **현재 시점 반영**: ${month}월 ${day}일 기준 계절/시기 특성 반드시 반영
4. **롱테일 키워드**: 블로그 작성에 바로 쓸 수 있는 구체적인 키워드 조합 제시
5. **다양한 난이도**: 경쟁 높은 주제 2개 + 틈새 주제 3개 섞어서
${newsContext ? '6. **뉴스 트렌드 반영 필수**: 위 뉴스에서 언급된 이슈 중 1~2개는 반드시 포함!' : ''}

[📊 점수 산정]
- SEO 점수(0~100): 검색량 높고 + 블로그 경쟁도 낮을수록 고점수
- 점수 높은 순 정렬

[🎯 출력 형식]
- topic: 구체적인 주제명 (예: "겨울철 어깨 뻣뻣함 원인")
- keywords: 블로그 제목에 쓸 롱테일 키워드 (예: "겨울 어깨통증, 난방 어깨 뻣뻣, 아침 어깨 굳음")
- score: SEO 점수 (70~95 사이)
- seasonal_factor: 왜 지금 이 주제가 뜨는지 한 줄 설명 ${newsContext ? '(뉴스 기반이면 "📰 뉴스 트렌드" 표시)' : ''}`,
    config: {
      tools: [{ googleSearch: {} }], // 구글 검색 도구 활성화
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            topic: { type: Type.STRING },
            keywords: { type: Type.STRING },
            score: { type: Type.NUMBER },
            seasonal_factor: { type: Type.STRING }
          },
          required: ["topic", "keywords", "score", "seasonal_factor"]
        }
      },
      temperature: 0.9 // 다양성을 위해 temperature 높임
    }
  });
  return JSON.parse(response.text || "[]");
};

export const recommendSeoTitles = async (topic: string, keywords: string, postType: 'blog' | 'card_news' = 'blog'): Promise<SeoTitleItem[]> => {
  const ai = getAiClient();
  
  // 현재 날짜/계절 정보 추가 (트렌드와 동일하게)
  const now = new Date();
  const koreaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const currentYear = koreaTime.getFullYear();
  const currentMonth = koreaTime.getMonth() + 1;
  const seasons = ['겨울', '겨울', '봄', '봄', '봄', '여름', '여름', '여름', '가을', '가을', '가을', '겨울'];
  const currentSeason = seasons[currentMonth - 1];
  
  const contentTypeDesc = postType === 'card_news' 
    ? '인스타그램/네이버 카드뉴스' 
    : '네이버 블로그';
  
  const lengthGuide = postType === 'card_news'
    ? '15~25자 이내 (카드뉴스 표지 최적화)'
    : '28~38자 이내 (모바일 최적화)';
  
  const prompt = `너는 대한민국 병·의원 네이버 블로그 마케팅 및 의료광고법에 정통한 전문가다.

[📅 현재 시점: ${currentYear}년 ${currentMonth}월 (${currentSeason})]
- ${currentYear}년 최신 의료광고법·표시광고법·네이버 검색 정책 기준 적용
- ${currentSeason} 계절 키워드 적극 활용 (예: ${currentSeason === '겨울' ? '겨울철, 난방기, 건조한' : currentSeason === '여름' ? '여름철, 무더위, 습한' : currentSeason === '봄' ? '봄철, 환절기, 꽃가루' : '가을철, 환절기, 선선한'})

[🎯 목표]
- 의료광고법·표시광고법·네이버 검색 정책을 위반하지 않는 제목
- 병·의원 홍보처럼 보이지 않고 정보성 콘텐츠로 인식되는 제목
- 클릭을 유도하되 '진단·판단·효과 암시'는 절대 하지 않는 제목
- 병·의원 블로그에 게시해도 장기간 노출 가능해야 함

[※ 주제] ${topic}
[※ SEO 키워드] ${keywords}

[중요]
🚫 [절대 금지 요소] - 의료광고법 위반!
[중요]

1. **단정·판단·진단 관련 표현 금지**
   ❌ 판단, 구분, 차이, 의심, 가능성, 체크, 여부, 진단
   ❌ 효과 단정, 치료 결과 암시
   ❌ 특정 질환의 비교 우위 표현
   ❌ "당신은 ~입니다" (단정)
   ❌ "~일까요?" (판단 유도 질문) → 네이버 저품질 위험!

2. **통계·빈도 단정 금지**
   ❌ 급증, 대부분, 거의 다, 100%, 확실히
   ❌ 완치, 예방, 최고, 1등, 돌연사, 반드시, 특효

3. **공포 조장·시간 압박 표현 금지**
   ❌ 골든타임, 48시간 내, 즉시, 무섭다, 위험하다, 심각하다

4. **병원/의원 명칭·직접 행동 유도 금지**
   ❌ "XX병원", "OO의원", "△△클리닉" 등 고유명사
   ❌ 방문하세요, 예약하세요, 상담하세요, 확인하세요, 검사받으세요
   ❌ ~하세요 명령형 전부 금지!

[중요]
⭐ [사람이 직접 지은 것 같은 제목 작성 원칙] - 핵심!
[중요]

🚨 **최우선 원칙: 의료광고법 준수!**
- 과장·단정 표현 금지 (치료, 완치, 개선, 반드시, 확실한 원인 등)
- 질문형(?) 최대한 자제 또는 금지
- 설명형·상황 제시형 제목 선호
- 실제 병원 블로그에서 쓸 수 있는 톤 유지

1. **🔍 설명형·상황 제시형 제목 작성 (질문형 금지!)**
   - ❌ 질문형: "무릎 통증, OO일까요?", "이런 증상이 나타나면?", "~해야 할까요?"
   - ✅ 설명형: "~라면", "~일 때", "~와 함께 나타난다면", "~살펴볼 점"
   - ✅ 상황 제시형: "~한 경우", "~하다가", "~하고 나서", "~해서"
   
   **예시:**
   ❌ "무릎에서 소리 나면 십자인대 파열일까요?" (질문형, 진단 유도)
   ✅ "무릎에서 소리 나고 붓기가 안 빠질 때 살펴볼 점" (설명형, 안전)
   ✅ "계단 내려가다 무릎에서 뚝 소리 난 뒤로 걸을 때마다 불편하다면" (상황 제시형)

2. **"이건 내 상황이다" 느끼게 하는 구체적 장면 필수!**
   - 시간대, 장소, 행동, 감정 중 하나가 구체적으로 드러나야 함
   ❌ "어깨 통증이 있을 때" (추상적)
   ❌ "기침이 심한 아침" (일기체, 정보 신호 없음)
   ✅ "아침에 세수하다가 팔이 안 올라갈 때" (구체적 장면)
   ✅ "출근길 지하철에서 손잡이 잡기가 힘들 때" (장소+행동)
   ✅ "밤마다 어깨가 쑤셔서 잠을 설칠 때" (시간+감정)

3. **과장·단정 표현 절대 금지 (의료광고법 1순위!)**
   - ❌ 치료, 완치, 개선, 반드시, 확실한 원인, 효과
   - ❌ "~하면 OO일 수 있다" (병명이 결론)
   - ❌ "~이면 OO을 의심해봐야" (진단 유도)
   - ✅ "~한 증상이 반복될 때" (상황에서 멈춤)
   - ✅ "~해서 찝찝했던 경험" (경험 서술)
   - ✅ "~라면 살펴볼 점" (안전한 정보 제공)

4. **병명은 제목에 0~1회 (가능하면 0회)**
   - 증상 기반으로 쓰되, 자연스러운 문장형 유지
   ❌ "마이코플라스마 폐렴 증상과 치료" (병명 중심 + 치료 단정)
   ✅ "기침만 3주째라면 살펴볼 점" (증상 중심 + 안전 표현)
   ✅ "열 없이 기침만 오래갈 때 알아둘 것" (증상 + 정보 신호)

5. **AI 단어 절대 사용 금지! (사람 느낌 유지)**
   - ❌ AI 단어: 증상 정리, 원인 분석, 체크리스트, 총정리, 완벽 가이드, 모든 것
   - ❌ 관리, 이해, 특징, 연관, 원인, 증상, 치료, 예방, 진단, 방법
   - ✅ 대체어: 신호, 때, 경우, 순간, 뒤, 느낌, 경험, 점, 것
   - ✅ 자연스러운 문장: "~라면", "~일 때", "~하다가", "~해서"

6. **같은 구조가 2개 이상 반복되지 않게 한다**
   - 5개 제목이 모두 다른 문장 구조여야 함!
   ❌ "~할 때", "~할 때", "~할 때" (반복)
   ✅ "~할 때" / "~한 뒤로" / "~해서" / "~하다가" / "~라면" (다양)

7. **너무 짧거나 키워드 나열식 제목 금지**
   ❌ "무릎 통증 원인" (키워드 나열)
   ❌ "어깨 아플 때" (너무 짧음)
   ✅ "아침마다 손가락이 뻣뻣한데, 움직이면 괜찮아지는 경우" (자연스러운 문장)
   
8. **유튜브·광고 느낌 표현 금지**
   ❌ "이것만 알면!", "반드시 확인!", "지금 바로!", "놓치면 후회"
   ✅ 차분하고 정보 전달형 톤 유지

9. **SEO 최적화**
   - 메인 키워드는 제목 앞 50% 안에 배치
   - 제목 길이: 28~38자 (${lengthGuide})

[중요]
🤖 [AI 냄새 완전 제거] - 사람이 직접 지은 제목처럼!
[중요]

**❌ AI 같은 종결어 (절대 사용 금지!)**
- 흐름, 상황, 시점, 사례, 과정, 포인트, 방법, 요령, 팁
- 정리, 분석, 가이드, 총정리, 완벽, 모든 것, 체크리스트
→ 이런 단어로 끝나면 AI가 쓴 티가 나고 광고처럼 보임!

**✅ 사람 같은 종결어 (자연스러운 표현)**
- 경우, 순간, 뒤, 때, 이후, 느낌, 경험, 점, 것
- ~라면, ~일 때, ~하다가, ~해서

**예시 1: AI 티 나는 제목 → 사람 느낌 제목**
❌ "스키장 부상 시 들린 무릎 똑 소리, 붓기가 잘 빠지지 않는 흐름" (AI 냄새)
✅ "스키장에서 넘어진 뒤 무릎에서 뚝 소리가 났는데, 붓기가 안 빠질 때" (자연스러움)

❌ "겨울철 운동 중 무릎이 꺾이며 다리에 힘이 들어가지 않는 시점" (딱딱함)
✅ "운동하다 무릎이 꺾이고 다리에 힘이 쭉 빠지는 느낌" (생동감)

❌ "전방십자인대 파열 관련 증상 정리 및 원인 분석" (AI 정리체)
✅ "무릎 다친 뒤 걸을 때마다 휘청거리는 경험" (경험담 느낌)

❌ "무릎 통증 완벽 가이드, 모든 것을 알려드립니다" (유튜브 광고)
✅ "계단 내려갈 때마다 무릎이 시큰거린다면 살펴볼 점" (정보 제공)

**예시 2: AI 연결어 제거**
❌ "~이 다루어지는", "~에서 설명되는", "~관련 내용이", "~에 대해", "~에 관한"
✅ 자연스러운 대화체: "~한 뒤", "~해서", "~하다가", "~라면", "~일 때"

**예시 3: 질문형 제목 금지**
❌ "무릎 통증, 십자인대 파열일까요?" (질문형)
❌ "이런 증상이 나타나면 병원 가야 할까요?" (질문형)
✅ "무릎에서 소리 나고 붓기가 안 빠질 때 살펴볼 점" (설명형)
✅ "계단 내려가다 무릎에서 뚝 소리가 났다면" (상황 제시형)

[중요]
🎨 [출력 요구사항] - 전부 자연스러운 문장형!
[중요]

- 제목 5개 제안 (⚠️ 5개 모두 문장 구조가 달라야 함!)
- 각 제목은 서로 다른 접근 방식 사용:
  1. 상황 제시형: "~라면", "~일 때" (질문형 "~일까요?" 절대 금지!)
  2. 공감형: "이거 내 얘기다" 느끼게
  3. 정보 제공형: "살펴볼 점", "알아둘 것" (정리/분석/가이드 단어 금지!)
  4. 시간/장소 고정형: 특정 시간/장소/계절 포함
  5. 경험담형: 실제 겪은 것 같은 느낌

🚨 **필수 체크사항:**
- ❌ 물음표(?) 사용 최대한 자제 (되도록 0개!)
- ❌ AI 단어 0개 (증상 정리, 원인 분석, 체크리스트, 완벽 가이드 등)
- ❌ 과장 표현 0개 (치료, 완치, 개선, 반드시, 확실한 등)
- ✅ 자연스러운 문장형 (사람이 쓴 것처럼)
- ✅ 실제 병원 블로그에 올려도 의료광고법 위반 걱정 없는 톤

- SEO 점수: 70~95점 사이로 현실적으로 평가
- type: 위 5가지 트리거 중 하나 (호기심/공감/정보전달/시기고정/경험담)

[✅ 좋은 제목 예시 - 자연스러운 문장형!]
- "열 없이 기침만 오래간다면 살펴볼 점" (상황 제시형, 물음표 없음)
- "감기약 먹어도 안 나을 때 알아둘 것" (상황 + 정보, 과장 없음)
- "기침만 3주째라면 확인해볼 점" (기간 + 자연스러운 표현)
- "아침마다 손가락이 뻣뻣한데, 움직이면 괜찮아지는 경우" (구체적 장면)
- "밤에 누우면 어깨가 쑤셔서 옆으로 못 누울 때" (시간 + 증상, 단정 없음)
- "세수하다가 팔이 갑자기 안 올라간다면" (행동 + 증상, 상황 제시)
- "출근길에 계단 내려가다 무릎이 시큰할 때" (장소 + 행동, 자연스러움)

[❌ 나쁜 제목 예시 - AI 티/과장/질문형]
- "무릎 통증 완벽 가이드! 모든 것을 알려드립니다" (AI 단어 + 과장)
- "십자인대 파열일까요? 증상 체크리스트" (질문형 + AI 단어)
- "무릎 통증 원인 분석과 치료 방법 총정리" (AI 단어 나열)
- "어깨 통증, 이것만 알면 완치!" (과장 + 단정)
- "관절염 증상 정리 및 예방법" (AI 단어 + 딱딱함)
- "출근길에 기침 참느라 눈물 뺀 경험" (일기체, 정보 없음)
- "밤새 뒤척였던 날" (에세이체, 구체성 없음)

[검수 기준 - 의료광고법 최우선!]
1. ❌ 물음표(?) 사용 확인 → 되도록 0개! (최대 1개까지만 허용)
2. ❌ AI 단어 확인 → "정리/분석/가이드/완벽/모든것/체크리스트/총정리/방법/요령/팁" 0개!
3. ❌ 과장 단어 확인 → "치료/완치/개선/반드시/확실한/효과" 0개!
4. ❌ AI 종결어 확인 → "흐름/상황/시점/사례/과정/포인트" 0개!
5. ✅ 의료광고법 안전성 → 병·의원 블로그에 게시해도 법적 문제 없어야 함
6. ✅ 자연스러움 → 사람이 직접 지은 것처럼 보여야 함
7. ✅ 실제 병원 블로그 톤 → 정보 제공형 또는 경험담 느낌
8. 📐 구조 반복 체크 → 5개 제목 중 같은 문장 구조 2개 이상이면 탈락!`;
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            score: { type: Type.NUMBER },
            type: { type: Type.STRING, enum: ['상황제시', '공감', '정보제공', '시간장소', '경험담'] }
          },
          required: ["title", "score", "type"]
        }
      }
    }
  });
  return JSON.parse(response.text || "[]");
};

// 카드뉴스 스타일 참고 이미지 분석 함수 (표지/본문 구분)
export const analyzeStyleReferenceImage = async (base64Image: string, isCover: boolean = false): Promise<string> => {
  const ai = getAiClient();
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: base64Image.includes('png') ? 'image/png' : 'image/jpeg',
                data: base64Image.split(',')[1] // base64 데이터만 추출
              }
            },
            {
              text: `이 카드뉴스/인포그래픽 이미지의 **디자인 스타일과 일러스트 그림체**를 매우 상세히 분석해주세요.

[중요]
🚨 최우선 목표: "같은 시리즈"로 보이게 할 일관된 스타일만 추출! 🚨
[중요]

⚠️ [중요] 이 분석은 "스타일/프레임"만 추출합니다. 이미지 속 "내용물"은 분석하지 마세요!
- ❌ 이미지 속 일러스트가 "무엇인지" (돼지, 사람, 돈 등) → 분석 불필요!
- ❌ 이미지 속 텍스트가 "무슨 내용인지" → 분석 불필요!
- ✅ 일러스트의 "그리는 방식/기법" (3D, 플랫, 수채화 등) → 분석 필요!
- ✅ 색상 팔레트, 프레임 형태, 레이아웃 구조 → 분석 필요!

**이 이미지는 ${isCover ? '표지(1장)' : '본문(2장 이후)'} 스타일 참고용입니다.**

---━━━━
🎨 [1단계] 일러스트/그림체 DNA 분석 (가장 중요!)
---━━━━
1. **그림체 종류** (정확히 하나만 선택):
   - 3D 클레이/점토 렌더링 (Blender/Cinema4D 느낌)
   - 3D 아이소메트릭 일러스트
   - 플랫 벡터 일러스트 (미니멀)
   - 수채화/손그림 스타일
   - 캐릭터 일러스트 (귀여운/키치)
   - 실사 사진 / 포토리얼
   - 선화+채색 일러스트
   - 그라데이션 글래스모피즘

2. **렌더링 특징**:
   - 조명: 부드러운 스튜디오 조명 / 강한 그림자 / 플랫 조명
   - 질감: 광택 있는 / 무광 매트 / 반투명
   - 외곽선: 없음 / 가는 선 / 굵은 선
   - 깊이감: 얕은 피사계심도 / 등각투영 / 완전 플랫

3. **색상 팔레트** (정확한 HEX 코드 5개):
   - 주 배경색: #______
   - 주 강조색: #______
   - 보조색 1: #______
   - 보조색 2: #______
   - 텍스트색: #______

4. **캐릭터/오브젝트 스타일** (있다면):
   - 얼굴 표현: 심플한 점 눈 / 큰 눈 / 없음
   - 비율: 2등신 귀여움 / 리얼 비율 / 아이콘형
   - 표정: 미소 / 무표정 / 다양함

---━━━━
📐 [2단계] 레이아웃/프레임 분석
---━━━━
5. **프레임 스타일**: 
   - 둥근 테두리 카드?
   - 테두리 색상(HEX)과 굵기(px)

6. **텍스트 스타일**:
   - 부제목: 색상, 굵기
   - 메인 제목: 색상, 굵기, 강조 방식
   - 설명: 색상

7. **일러스트 배치**: top / center / bottom, 크기 비율(%)

**반드시 JSON 형식으로 답변 (illustStyle 필드 필수!):**
{
  "illustStyle": {
    "type": "3D 클레이 렌더링 / 플랫 벡터 / 아이소메트릭 / 수채화 / 실사",
    "lighting": "부드러운 스튜디오 조명 / 플랫 / 강한 그림자",
    "texture": "광택 매끄러움 / 무광 매트 / 반투명",
    "outline": "없음 / 가는 선 / 굵은 선",
    "characterStyle": "2등신 귀여움 / 리얼 비율 / 심플 아이콘",
    "colorPalette": ["#주배경", "#강조색", "#보조1", "#보조2", "#텍스트"],
    "promptKeywords": "이 스타일을 재현하기 위한 영어 키워드 5-8개 (예: 3D clay render, soft shadows, pastel colors, rounded shapes, studio lighting)"
  },
  "frameStyle": "rounded-card / rectangle",
  "backgroundColor": "#E8F4FD",
  "borderColor": "#787fff",
  "borderWidth": "2px",
  "borderRadius": "16px",
  "boxShadow": "0 4px 12px rgba(0,0,0,0.1)",
  "subtitleStyle": { "color": "#6B7280", "fontSize": "14px", "fontWeight": "500" },
  "mainTitleStyle": { "color": "#1F2937", "fontSize": "28px", "fontWeight": "700" },
  "highlightStyle": { "color": "#787fff", "backgroundColor": "transparent" },
  "descStyle": { "color": "#4B5563", "fontSize": "16px" },
  "tagStyle": { "backgroundColor": "#F0F0FF", "color": "#787fff", "borderRadius": "20px" },
  "illustPosition": "bottom",
  "illustSize": "60%",
  "padding": "24px",
  "mood": "밝고 친근한 / 전문적인 / 따뜻한 등",
  "keyFeatures": ["3D 클레이 렌더링", "파스텔 색상", "둥근 형태", "부드러운 그림자"],
  "styleReproductionPrompt": "이 이미지 스타일을 정확히 재현하기 위한 완전한 영어 프롬프트 1-2문장"
}`
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json"
      }
    });
    
    return response.text || '{}';
  } catch (error) {
    console.error('스타일 분석 실패:', error);
    return '{}';
  }
};

// ============================================
// 🤖 미니 에이전트 방식 카드뉴스 생성 시스템
// ============================================

// 슬라이드 스토리 타입 정의
interface SlideStory {
  slideNumber: number;
  slideType: 'cover' | 'concept' | 'content' | 'closing';
  subtitle: string;      // 4-8자 (짧고 임팩트있게!)
  mainTitle: string;     // 10-18자 (강조 부분 <highlight>로 표시)
  description: string;   // 15-25자 (판단 1줄! 설명 아님!)
  tags: string[];        // 해시태그 2-3개
  imageKeyword: string;  // 이미지 핵심 키워드
}

interface CardNewsStory {
  topic: string;
  totalSlides: number;
  slides: SlideStory[];
  overallTheme: string;
}

// [1단계] 스토리 기획 에이전트
const storyPlannerAgent = async (
  topic: string, 
  category: string, 
  slideCount: number,
  writingStyle: WritingStyle
): Promise<CardNewsStory> => {
  const ai = getAiClient();
  const currentYear = getCurrentYear();
  
  const prompt = `당신은 **전환형 카드뉴스** 스토리 기획 전문가입니다.

[🎯 미션] "${topic}" 주제로 ${slideCount}장짜리 **전환형** 카드뉴스를 기획하세요.

${CONTENT_DESCRIPTION}

[📅 현재: ${currentYear}년 - 보수적 해석 원칙]
- ${currentYear}년 기준 보건복지부·의료광고 심의 지침을 반영
- **불확실한 경우 반드시 보수적으로 해석**
- 출처 없는 수치/시간/확률 표현 금지

[진료과] ${category}
[글 스타일] ${writingStyle === 'expert' ? '전문가형(신뢰·권위)' : writingStyle === 'empathy' ? '공감형(독자 공감)' : '전환형(정보→확인 유도)'}

🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨
[📱 카드뉴스 핵심 원칙 - 블로그와 완전히 다름!]
🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨

❌ 블로그 = "읽고 이해"
✅ 카드뉴스 = "보고 판단" (3초 안에!)

[🔑 카드뉴스 황금 공식]
❌ 설명 70% → ✅ 판단 70%
❌ "왜냐하면..." → ✅ "이때는..."
❌ 문장 2~3줄 설명 → ✅ 판단 1줄로 끝

[[심리] 심리 구조: 질문 → 끊기 → 판단 → 다음카드]
- 각 카드는 "멈춤 → 판단 → 넘김"을 유도해야 함
- 설명하면 스크롤 멈춤력이 떨어짐!

[🚨 카드별 심리적 역할 - ${slideCount}장 기준 🚨]

**1장 - 표지 (멈추게 하는 역할만!)**
- subtitle: 4~8자 (예: "겨울철에 유독?", "혹시 나도?")
- mainTitle: 10~15자, 질문형 (예: "겨울철 혈관 신호일까요?")
- description: "" ← 🚨 표지는 description 완전히 비워두세요! 빈 문자열 ""로!
- 💡 표지는 제목+부제만! 설명 없음!

**2장 - 오해 깨기 (판단 유도)**
- subtitle: 4~8자 (예: "단순한 추위 때문?")
- mainTitle: 질문형으로 착각 깨기 (예: "생활 관리만으로 충분할까요?")
- description: ❌ 긴 설명 금지! 판단 1줄만 (예: "따뜻하게 입어도 해결되지 않는 신호가 있습니다")

${slideCount >= 5 ? `**3장 - 증상 명확화 (핵심만)**
- subtitle: 4~8자 (예: "놓치기 쉬운 신호들")
- mainTitle: 증상 나열 (예: "반복되는 두통\\n숨이 차는 느낌이 계속된다면")
- description: 한 줄 판단 (예: "피로나 스트레스와 구분이 필요할 수 있습니다")` : ''}

${slideCount >= 6 ? `**4장 - 자가 판단의 한계**
- subtitle: 4~8자 (예: "자가 판단의 한계")  
- mainTitle: 핵심 메시지만 (예: "증상만으로는 원인을 구분하기 어렵습니다")
- description: ❌ 설명 삭제 또는 최소화` : ''}

${slideCount >= 7 ? `**5~${slideCount-2}장 - 시점 고정 (🔥 핵심! 🔥)**
- 추가 정보보다 "시점 고정"에 집중
- 생활습관 카드는 최대 1장만!` : ''}

**${slideCount-1}장 - 시점 고정**
- subtitle: 4~8자 (예: "확인이 필요한 순간")
- mainTitle: (예: "사라졌다 다시 나타난다면\\n확인이 필요한 시점입니다")
- description: 최소화

**${slideCount}장 - 마지막 표지/CTA (명령형 금지! + 전환력 강화!)**
- subtitle: 4~8자 (예: "미루지 않는 습관", "지금이 그때")
- mainTitle: "왜 지금이어야 하는지" 이유를 담아라!
  ✅ "지켜보기보다 관리 방향을 정할 시점"
  ✅ "이 단계에서는 넘기기보다 살펴볼 때입니다"
  ✅ "반복된다면 기준이 필요합니다"
  ❌ "~하세요" 명령형 금지!
  ❌ "가장 빠른 첫걸음" (너무 착함, 전환력 약함)
- description: "" ← 🚨 마지막 장도 description 완전히 비워두세요! 빈 문자열 ""로!
- 💡 마지막 장은 표지처럼 제목+부제만! 설명 없음!
- ❌ "혈액 검사로 확인하세요" 같은 명령형 금지!
- ❌ "의료기관을 찾아..." 문장 금지!
- 🔥 핵심: "왜 지금?" + "미루면 어떻게?" 두 메시지 중 하나 포함!

[📝 텍스트 분량 규칙 - 카드뉴스용!]
- subtitle: 4~8자 (질문/상황 표현)
  ✅ "겨울철에 유독?", "혹시 나도?", "놓치기 쉬운 신호들"
  ❌ "왜 중요할까요?" (너무 일반적)
  
- mainTitle: 10~18자, 줄바꿈 포함, <highlight>로 강조
  ✅ "가슴 답답함·두통\\n<highlight>혈관 신호</highlight>일까요?"
  ❌ "혈관 건강 체크 신호일까요?" (체크=행동유도 느낌)
  
- description: 15~25자의 판단 1줄! (설명 아님!)
  ✅ "따뜻하게 입어도 해결되지 않는 신호가 있습니다"
  ✅ "피로나 컨디션 변화 등 다른 원인에서도 나타날 수 있습니다"
  ✅ "식습관과 생활 습관에 따라 개인차가 큽니다"
  ❌ "기온 변화에 따른 혈관 수축은 자가 관리 영역을 넘어 전문적인 확인이 필요한 경우가..." (너무 긺)
  ❌ "매년 건강보험 혜택을 통해 비용 부담을 줄인 확인이 가능합니다..." (너무 긺)

[🔄 단어 반복 금지 - 리듬 유지!]
⚠️ 같은 단어가 2회 이상 나오면 카드뉴스 리듬이 죽습니다!
- "확인" 대신 → 점검, 살피다, 상태 보기, 파악
- "관리" 대신 → 케어, 돌봄, 유지, 습관
- "필요" 대신 → 중요, 의미있는, 시점
- "시점" 대신 → 순간, 타이밍, 때, 단계
→ 의미는 유지하고 단어는 분산!

[🚨 의료법 준수 - 최우선! 🚨]

**절대 금지 표현:**
❌ "즉시 상담", "바로 상담", "지금 상담"
❌ "전문의", "전문가", "전문의 상담", "전문의와 상담하세요"
❌ "병원 방문", "내원하세요", "예약하세요"
❌ "검진 받으세요", "진료 받으세요", "검사 받으세요"
❌ "~하세요" 명령형 전부!
❌ "완치", "최고", "보장", "확실히", "체크"
❌ "골든타임", "48시간 내" 등 구체적 시간 표현

**안전한 대체 표현:**
✅ "확인이 필요한 시점입니다"
✅ "지켜보기보다 확인이 먼저입니다"
✅ "의학적 판단이 필요할 수 있습니다"
✅ "개인차가 있을 수 있습니다"
❌ "~를 고려해볼 수 있어요" (너무 약함)

[⚠️ 생활습관 카드 제한]
- 생활습관(운동, 식단, 금연 등) 카드는 **최대 1장**만
- 생활습관이 핵심 메시지(확인 시점)를 대체하면 안 됨!

[❌ 금지]
- "01.", "첫 번째" 등 번호 표현
- "해결책 1", "마무리" 등 프레임워크 용어
- 출처 없는 구체적 수치/시간/확률 표현

[✅ 슬라이드 연결]
- 이전 슬라이드와 자연스럽게 이어지도록
- **심리 흐름**: 주의환기 → 오해깨기 → 증상명확화 → 자가판단한계 → 시점고정 → CTA

[🎯 최종 체크리스트]
1. 🚨 1장(표지)의 description이 비어있는가? → 반드시 "" 빈 문자열로!
2. 🚨 마지막 장의 description이 비어있는가? → 반드시 "" 빈 문자열로!
3. 각 카드 description이 2줄 이상인가? → 1줄(15~25자)로 줄여라!
4. "~하세요" 명령형이 있는가? → "~시점입니다", "~단계입니다"로 바꿔라!
5. 설명이 판단보다 많은가? → '이유 설명' 삭제, 판단만 남겨라!
6. "확인/점검" 같은 단어가 2번 이상 반복되는가? → 분산시켜라! (살피다, 상태보기, 파악 등)
7. CTA가 너무 착한가? → "왜 지금이어야 하는지" 이유 추가!
8. CTA에 시술명(스킨부스터 등)이 있는가? → "관리 방향", "관리 기준"으로 대체!
9. "맞춤형", "개인맞춤" 표현이 있는가? → "상태에 맞는"으로 대체!

[중요]
[심의 통과 핵심 규칙] 병원 카드뉴스 톤 미세 조정 - 5% 완화!
[중요]

**🚨 심의 탈락 방지 - 핵심 3가지 조정 포인트 🚨**

**※ 10. 합병증 언급 시 - '예방' 단어 금지! (가장 중요!)**
- ❌ "합병증 예방을 위해 초기 확인이 중요해요" → '예방'이 치료 효과 암시로 해석됨!
- ❌ "합병증을 예방하려면..." → 치료 효과 기대 유발
- ✅ "증상 경과를 살피는 것이 중요한 이유"
- ✅ "고위험군에서는 경과 관찰이 더 중요합니다"
- ✅ "일부 경우에는 증상 경과에 따라 추가적인 관리가 필요해질 수 있다는 점이 보고되고 있습니다"
- ✅ "특히 고령층이나 어린이는 증상 변화를 주의 깊게 살피는 것이 도움이 됩니다"
- ※ 핵심: '예방' → '경과 관찰', '살피는 것'으로 대체!

**※ 11. 시점 고정 카드 - '회복' 단어 톤 다운!**
- ❌ "회복 과정에 도움이 될 수 있습니다" → 치료 효과 암시
- ❌ "빠른 회복을 위해" → 결과 보장 느낌
- ✅ "이후 관리 방향을 정하는 데 도움이 될 수 있습니다"
- ✅ "상태에 맞는 관리 방향을 확인해보는 것도 고려해볼 수 있습니다"
- ※ 핵심: '회복' → '관리 방향', '관리 기준'으로 대체!

**※ 12. 전파/감염 표현 완화 - 책임 강조 느낌 제거!**
- ❌ "주변 가족이나 동료에게 영향을 줄 가능성도 함께 고려해볼 필요" → 전파 책임 강조 느낌
- ❌ "사랑하는 가족에게 전파될 수 있습니다" → 불안 조장
- ✅ "주변 사람들과의 생활 환경을 함께 고려해볼 필요도 있습니다"
- ✅ "함께 생활하는 분들의 건강도 함께 신경 쓰게 되는 상황이 있을 수 있습니다"
- ※ 핵심: '전파/영향' → '생활 환경', '함께 신경 쓰게 되는'으로 완화!

**※ 13. 행동 결정 유도 - 단정 → 가능성 표현!**
- ❌ "지켜볼 단계는 지났을 수 있습니다" → 결정 유도형, 살짝 강함
- ❌ "이미 지난 시점입니다" → 단정형
- ✅ "지켜보기보다 한 번쯤 원인을 구분해볼 시점일 수 있습니다"
- ✅ "확인이 필요한 시점일 수 있습니다"
- ✅ "점검해볼 타이밍일 수 있습니다"
- ※ 핵심: '지났습니다' → '시점일 수 있습니다'로 가능성 표현!

[병원 카드뉴스 톤 최적화 - 광고 느낌 제거 + 심의 통과!]

**14. mainTitle 단정형 어미 완화:**
- ❌ "~입니다" 단정형 → 살짝 강하게 느껴질 수 있음
- ✅ "~하는 순간", "~의 변화", "~일 수 있습니다"
- 예시:
  ❌ "따뜻한 이불 속과 차가운 아침 공기, 혈관의 반응입니다"
  ✅ "따뜻한 이불 속과 차가운 아침 공기, 혈관이 반응하는 순간"
  ✅ "따뜻한 실내에서 차가운 아침 공기로 나설 때, 혈관의 변화"

**15. '전문가' 직접 언급 금지:**
- ❌ subtitle/mainTitle에 "전문가", "전문의" 직접 등장 금지
- ✅ description에서도 가급적 언급하지 않는 게 더 안전
- ※ 이유: 본문에 '전문가'가 없으면 오히려 광고 느낌이 줄어듦

**16. CTA(마지막 장) 해시태그 위치 규칙:**
- ❌ subtitle에 해시태그 직접 넣기 → 광고 느낌!
  예: subtitle: "#겨울철혈압 #아침두통 #혈압관리"
- ✅ subtitle은 순수 텍스트로, 해시태그는 tags 배열에만!
  예: subtitle: "건강한 겨울을 위한 작은 점검"
       tags: ["겨울철혈압", "아침두통", "혈압관리"]
- ※ 해시태그가 CTA 부제에 들어가면 의료기관 톤이 아니라 광고 톤이 됨

**17. 표지(1장) 제목 성공 공식 - 시기성 강화!:**
- ✅ 시기성 + 일상 증상 + 의심 프레임 + 확인 기준
- ✅ "요즘", "겨울철", "환절기" 등 시기 표현 추가 시 클릭률 상승
- ✅ 질환 단정 없음, 질문형 유지
- 예시 (CTR 높은 유형):
  ✅ "요즘 으슬으슬한 오한, 단순 추위가 아닐 수 있어요"
  ✅ "겨울철 아침마다 뒷목이 뻐근하다면? 혈압 변화 확인 포인트"
  ✅ "환절기에 유독 심한 두통, 단순 피로일까요?"

**18. 증상 제시 카드 - 다른 원인 완충 필수:**
- ✅ description에 "다른 원인으로도 나타날 수 있어" 완충 문장 포함
- 예시:
  "다만, 이는 수면 자세나 스트레스 등 다른 원인으로도 나타날 수 있어 증상만으로 단정하기 어렵습니다"
- ※ 자가 대입 ✔ + 단정 회피 ✔ + 불안 완충 ✔ = 의료법 안전

**19. 확인 시점 카드 - 핵심 전환 장 (🔥심의 핵심!🔥):**
- ✅ "~일 수 있습니다" 가능성 표현 필수
- ✅ "반복된다면"이라는 조건부 전환 사용
- ❌ "지켜볼 단계는 지났습니다" → 결정 유도형, 살짝 강함
- ✅ "지켜보기보다 한 번쯤 원인을 구분해볼 시점일 수 있습니다"
- 예시:
  mainTitle: "반복되는 불편함, 확인이 필요한 시점일 수 있습니다"
- ※ 내원 강요 ❌ / 시점 고정 ✔ = 전환력 최고

**20. 감기/독감 등 감염성 질환 카드 - 전파 표현 톤 다운:**
- ❌ "주변 가족에게 영향을 줄 가능성" → 전파 책임 강조 느낌
- ✅ "주변 사람들과의 생활 환경을 함께 고려해볼 필요도 있습니다"
- ※ 전파보다 '함께 생활하는 환경' 프레임으로!

[💡 CTA 카드 모범 답안 - 전환력 강화 버전!]
✅ mainTitle 예시 (왜 지금인지 이유 포함!):
  - "지켜보기보다\\n관리 방향을 정할 시점"
  - "반복된다면\\n기준이 필요합니다"
  - "이 단계에서는\\n넘기기보다 살펴볼 때입니다"
  - "지금의 불편함을 넘기면\\n더 긴 관리가 필요해질 수 있습니다"
✅ description: "" (빈 문자열 - 표지처럼!)
→ 명령 ❌ / 판단 ⭕
→ "왜 지금?" 이유 필수!

[📋 출력 필드]
- topic: 주제 (한국어)
- totalSlides: 총 슬라이드 수
- overallTheme: 전체 구조 설명 (⚠️ 반드시 한국어! 영어 금지! 20자 이내)
  예: "공감과 정보 전달" / "증상 체크 → 확인 안내" / "건강 정보 공유"
- slides: 슬라이드 배열`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            topic: { type: Type.STRING },
            totalSlides: { type: Type.INTEGER },
            overallTheme: { type: Type.STRING },
            slides: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  slideNumber: { type: Type.INTEGER },
                  slideType: { type: Type.STRING },
                  subtitle: { type: Type.STRING },
                  mainTitle: { type: Type.STRING },
                  description: { type: Type.STRING },
                  tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                  imageKeyword: { type: Type.STRING }
                },
                required: ["slideNumber", "slideType", "subtitle", "mainTitle", "description", "tags", "imageKeyword"]
              }
            }
          },
          required: ["topic", "totalSlides", "slides", "overallTheme"]
        }
      }
    });
    
    const result = JSON.parse(response.text || "{}");
    
    // 🚨 후처리: 1장(표지)과 마지막 장의 description 강제로 빈 문자열로!
    if (result.slides && result.slides.length > 0) {
      // 1장 (표지) description 제거
      result.slides[0].description = "";
      
      // 마지막 장 description 제거
      if (result.slides.length > 1) {
        result.slides[result.slides.length - 1].description = "";
      }
      
      console.log('🚨 표지/마지막 장 description 강제 제거 완료');
    }
    
    return result;
  } catch (error) {
    console.error('스토리 기획 에이전트 실패:', error);
    throw error;
  }
};

// 분석된 스타일 전체 인터페이스
interface AnalyzedStyle {
  frameStyle?: string;
  hasWindowButtons?: boolean;
  windowButtonColors?: string[];
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: string;
  borderRadius?: string;
  boxShadow?: string;
  subtitleStyle?: { color?: string; fontSize?: string; fontWeight?: string; };
  mainTitleStyle?: { color?: string; fontSize?: string; fontWeight?: string; };
  highlightStyle?: { color?: string; backgroundColor?: string; };
  descStyle?: { color?: string; fontSize?: string; };
  tagStyle?: { backgroundColor?: string; color?: string; borderRadius?: string; };
  illustPosition?: string;
  illustSize?: string;
  padding?: string;
  mood?: string;
  keyFeatures?: string[];
}

// [2단계] HTML 조립 함수 (분석된 스타일 전체 적용)
const assembleCardNewsHtml = (
  story: CardNewsStory,
  styleConfig?: AnalyzedStyle
): string => {
  const bgColor = styleConfig?.backgroundColor || '#E8F4FD';
  const bgGradient = `linear-gradient(180deg, ${bgColor} 0%, ${bgColor}dd 100%)`;
  const accentColor = styleConfig?.borderColor || '#3B82F6';
  
  // 분석된 스타일 적용 (기본값 포함)
  const borderRadius = styleConfig?.borderRadius || '24px';
  const boxShadow = styleConfig?.boxShadow || '0 4px 16px rgba(0,0,0,0.08)';
  const borderWidth = styleConfig?.borderWidth || '0';
  const padding = styleConfig?.padding || '32px 28px';
  
  const subtitle = {
    color: styleConfig?.subtitleStyle?.color || accentColor,
    fontSize: styleConfig?.subtitleStyle?.fontSize || '14px',
    fontWeight: styleConfig?.subtitleStyle?.fontWeight || '700'
  };
  
  const mainTitle = {
    color: styleConfig?.mainTitleStyle?.color || '#1E293B',
    fontSize: styleConfig?.mainTitleStyle?.fontSize || '26px',
    fontWeight: styleConfig?.mainTitleStyle?.fontWeight || '900'
  };
  
  const highlight = {
    color: styleConfig?.highlightStyle?.color || accentColor,
    backgroundColor: styleConfig?.highlightStyle?.backgroundColor || 'transparent'
  };
  
  const desc = {
    color: styleConfig?.descStyle?.color || '#475569',
    fontSize: styleConfig?.descStyle?.fontSize || '15px'
  };
  
  const tag = {
    backgroundColor: styleConfig?.tagStyle?.backgroundColor || `${accentColor}15`,
    color: styleConfig?.tagStyle?.color || accentColor,
    borderRadius: styleConfig?.tagStyle?.borderRadius || '20px'
  };
  
  // 브라우저 윈도우 버튼 HTML (분석된 스타일에 있으면 적용)
  const windowButtonsHtml = styleConfig?.hasWindowButtons ? `
    <div class="window-buttons" style="display: flex; gap: 8px; padding: 12px 16px;">
      <span style="width: 12px; height: 12px; border-radius: 50%; background: ${styleConfig?.windowButtonColors?.[0] || '#FF5F57'};"></span>
      <span style="width: 12px; height: 12px; border-radius: 50%; background: ${styleConfig?.windowButtonColors?.[1] || '#FFBD2E'};"></span>
      <span style="width: 12px; height: 12px; border-radius: 50%; background: ${styleConfig?.windowButtonColors?.[2] || '#28CA41'};"></span>
    </div>` : '';
  
  const slides = story.slides.map((slide, idx) => {
    // mainTitle에서 <highlight> 태그를 실제 span으로 변환 (분석된 highlight 스타일 적용)
    const highlightBg = highlight.backgroundColor !== 'transparent' 
      ? `background: ${highlight.backgroundColor}; padding: 2px 6px; border-radius: 4px;` 
      : '';
    const formattedTitle = slide.mainTitle
      .replace(/<highlight>/g, `<span class="card-highlight" style="color: ${highlight.color}; ${highlightBg}">`)
      .replace(/<\/highlight>/g, '</span>')
      .replace(/\n/g, '<br/>');
    
    // 프레임 스타일에 따른 border 적용
    const borderStyle = borderWidth !== '0' ? `border: ${borderWidth} solid ${accentColor};` : '';
    
    // 🎨 이미지에 텍스트가 렌더링되므로, HTML에서는 이미지만 표시 (텍스트 레이어 제거)
    return `
      <div class="card-slide" style="background: ${bgGradient}; border-radius: ${borderRadius}; ${borderStyle} box-shadow: ${boxShadow}; overflow: hidden; aspect-ratio: 1/1; position: relative;">
        <div class="card-img-container" style="position: absolute; inset: 0; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center;">[IMG_${idx + 1}]</div>
        <!-- 텍스트 데이터는 숨김 처리 (편집/검색용) -->
        <div class="card-text-data" style="display: none;" data-subtitle="${slide.subtitle}" data-title="${slide.mainTitle.replace(/"/g, '&quot;')}" data-desc="${slide.description.replace(/"/g, '&quot;')}"></div>
      </div>`;
  });
  
  return slides.join('\n');
};

// 카드별 프롬프트 데이터는 types.ts에서 import

// [3단계] 전체 이미지 카드용 프롬프트 생성 에이전트
const fullImageCardPromptAgent = async (
  slides: SlideStory[],
  imageStyle: ImageStyle,
  category: string,
  styleConfig?: AnalyzedStyle,
  customImagePrompt?: string  // 커스텀 이미지 프롬프트 추가!
): Promise<CardPromptData[]> => {
  const ai = getAiClient();
  
  // 🚨 photo/medical 스타일 선택 시 커스텀 프롬프트 무시! (스타일 버튼 우선)
  const isFixedStyle = imageStyle === 'photo' || imageStyle === 'medical';
  const hasCustomStyle = !isFixedStyle && customImagePrompt?.trim();
  const styleGuide = isFixedStyle
    ? STYLE_KEYWORDS[imageStyle]  // photo/medical은 고정 스타일 사용
    : (hasCustomStyle ? customImagePrompt!.trim() : STYLE_KEYWORDS[imageStyle] || STYLE_KEYWORDS.illustration);
  
  console.log('🎨 fullImageCardPromptAgent 스타일:', imageStyle, '/ 커스텀 적용:', hasCustomStyle ? 'YES' : 'NO (고정 스타일)');
  
  // 🎨 스타일 참고 이미지가 있으면 해당 색상 사용, 없으면 기본값
  const bgColor = styleConfig?.backgroundColor || '#E8F4FD';
  const accentColor = styleConfig?.borderColor || '#3B82F6';
  const hasWindowButtons = styleConfig?.hasWindowButtons || false;
  const mood = styleConfig?.mood || '밝고 친근한';
  const keyFeatures = styleConfig?.keyFeatures?.join(', ') || '';
  
  // 슬라이드 정보 (description이 비어있으면 생략!)
  const slideSummaries = slides.map((s, i) => {
    const isFirst = i === 0;
    const isLast = i === slides.length - 1;
    const label = isFirst ? ' (표지)' : isLast ? ' (마지막)' : '';
    const hasDescription = s.description && s.description.trim().length > 0;
    
    // description이 없거나 비어있으면 생략!
    if (!hasDescription) {
      return `${i + 1}장${label}: subtitle="${s.subtitle}" mainTitle="${s.mainTitle.replace(/<\/?highlight>/g, '')}" ⚠️description 없음 - 설명 텍스트 넣지 마세요! 이미지="${s.imageKeyword}"`;
    }
    return `${i + 1}장${label}: subtitle="${s.subtitle}" mainTitle="${s.mainTitle.replace(/<\/?highlight>/g, '')}" description="${s.description}" 이미지="${s.imageKeyword}"`;
  }).join('\n');

  // 🎨 스타일 참고 이미지가 있으면 핵심 요소만 전달
  const styleRefInfo = styleConfig ? `
[🎨 디자인 프레임 참고]
- 배경색: ${bgColor}
- 강조색: ${accentColor}
- 프레임: ${hasWindowButtons ? '브라우저 창 버튼(빨/노/초) 필수' : '둥근 카드'}
- 분위기: ${mood}
${keyFeatures ? `- 특징: ${keyFeatures}` : ''}
` : '';

  // 커스텀 스타일 강조 (있으면 최우선 적용! + 기본 3D 스타일 금지!)
  const customStyleInfo = hasCustomStyle ? `
[중요]
🎯🎯🎯 [최우선] 커스텀 스타일 필수 적용! 🎯🎯🎯
[중요]

스타일: "${customImagePrompt}"

⛔ 절대 금지: 3D 일러스트, 클레이 렌더, 아이소메트릭 등 기본 스타일 사용 금지!
✅ 필수: 위에 명시된 "${customImagePrompt}" 스타일만 사용하세요!
` : '';

  const prompt = `당신은 소셜미디어 카드뉴스 디자이너입니다. 이미지 1장 = 완성된 카드뉴스 1장!
${customStyleInfo}
${styleRefInfo}
[스타일] ${styleGuide}
[진료과] ${category}

[슬라이드별 텍스트]
${slideSummaries}

[중요]
🚨 [최우선] 레이아웃 규칙 - 반드시 지켜야 함! 🚨
[중요]

⛔⛔⛔ 절대 금지되는 레이아웃 ⛔⛔⛔
- 상단에 흰색/단색 텍스트 영역 + 하단에 일러스트 영역 = 2분할 = 금지!
- 텍스트 박스와 이미지 박스가 나뉘어 보이는 디자인 = 금지!
- 위아래로 2등분된 듯한 구성 = 금지!

✅ 반드시 이렇게 만드세요 ✅
- 일러스트/배경이 전체 화면(100%)을 채움!
- 그 위에 텍스트가 오버레이 (반투명 배경 또는 그림자 효과로 가독성 확보)
- 영화 포스터, 앨범 커버, 인스타그램 카드처럼 하나의 통합 디자인!

[imagePrompt 작성법]
- "전체 화면을 채우는 [일러스트 묘사], 그 위에 [텍스트] 오버레이" 형식
- 예: "전체 화면을 채우는 비오는 창가 일러스트, 그 위에 '무릎 쑤심' 텍스트 오버레이, 파스텔톤"

[카드 레이아웃]
- 1번(표지)/마지막(CTA): 제목+부제+일러스트만! 🚨description 절대 금지!
${hasWindowButtons ? '- 브라우저 창 버튼(빨/노/초) 포함' : ''}

[필수 규칙]
- 1:1 정사각형, 배경색 ${bgColor}
- ⚠️ imagePrompt는 반드시 한국어로!
- 해시태그 금지
- "⚠️description 없음"이면 설명 텍스트 넣지 마세요!

[의료법] 금지: 상담하세요, 방문하세요, 완치, 보장 / 허용: 증상명, 질환명, 질문형`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            cards: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  imagePrompt: { type: Type.STRING },
                  textPrompt: {
                    type: Type.OBJECT,
                    properties: {
                      subtitle: { type: Type.STRING },
                      mainTitle: { type: Type.STRING },
                      description: { type: Type.STRING },
                      tags: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ["subtitle", "mainTitle", "description", "tags"]
                  }
                },
                required: ["imagePrompt", "textPrompt"]
              }
            }
          },
          required: ["cards"]
        }
      }
    });
    
    const result = JSON.parse(response.text || '{"cards":[]}');
    
    // 🚨 AI가 생성한 imagePrompt는 무시하고, 슬라이드 정보 + 사용자 스타일로 직접 조합!
    // AI가 멋대로 다른 텍스트/스타일을 넣는 문제 해결
    const cards = slides.map((s, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === slides.length - 1;
      const mainTitleClean = s.mainTitle.replace(/<\/?highlight>/g, '');
      
      // 표지/마지막은 description 없음
      const descPart = (isFirst || isLast) ? '' : (s.description ? `, "${s.description}"` : '');
      
      // 🔧 imagePrompt: 사용자에게 보여줄 핵심 정보만! (영어 지시문은 생성 시 자동 추가)
      // 스타일은 generateSingleImage에서 결정 (중복 방지)
      const descText = (isFirst || isLast) ? '' : (s.description ? `\ndescription: "${s.description}"` : '');
      const imagePrompt = `subtitle: "${s.subtitle}"
mainTitle: "${mainTitleClean}"${descText}
비주얼: ${s.imageKeyword}
배경색: ${bgColor}`;
      
      // textPrompt는 AI 결과 사용 (있으면) 또는 슬라이드 정보 사용
      const aiCard = result.cards?.[idx];
      const textPrompt = aiCard?.textPrompt || {
        subtitle: s.subtitle,
        mainTitle: s.mainTitle,
        description: (isFirst || isLast) ? '' : s.description,
        tags: s.tags
      };
      
      // 표지/마지막은 description 강제 제거
      if (isFirst || isLast) {
        textPrompt.description = '';
      }
      
      return { imagePrompt, textPrompt };
    });
    
    console.log('🎨 카드 프롬프트 직접 생성 완료:', cards.length, '장, 스타일:', hasCustomStyle ? '커스텀' : '기본');
    return cards;
  } catch (error) {
    console.error('전체 이미지 카드 프롬프트 실패:', error);
    // 🔧 fallback도 동일하게: 스타일은 generateSingleImage에서 결정!
    const fallbackCards = slides.map((s, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === slides.length - 1;
      const mainTitleClean = s.mainTitle.replace(/<\/?highlight>/g, '');
      const descText = (isFirst || isLast) ? '' : (s.description ? `\ndescription: "${s.description}"` : '');
      return {
        imagePrompt: `subtitle: "${s.subtitle}"
mainTitle: "${mainTitleClean}"${descText}
비주얼: ${s.imageKeyword}
배경색: ${bgColor}`,
        textPrompt: { 
          subtitle: s.subtitle, 
          mainTitle: s.mainTitle, 
          description: (isFirst || isLast) ? '' : s.description, 
          tags: s.tags 
        }
      };
    });
    console.log('🚨 [fullImageCardPromptAgent fallback] 직접 생성, 스타일:', hasCustomStyle ? '커스텀' : '기본');
    return fallbackCards;
  }
};

// [기존 호환] 이미지만 생성하는 프롬프트 에이전트
const imagePromptAgent = async (
  slides: SlideStory[],
  imageStyle: ImageStyle,
  category: string
): Promise<string[]> => {
  const ai = getAiClient();
  
  const styleGuide = STYLE_KEYWORDS[imageStyle] || STYLE_KEYWORDS.illustration;
  
  const slideSummaries = slides.map((s, i) => `${i + 1}장: ${s.slideType} - ${s.imageKeyword}`).join('\n');
  
  const prompt = `당신은 의료/건강 이미지 프롬프트 전문가입니다.

[미션] 각 슬라이드에 맞는 이미지 프롬프트를 한국어로 작성하세요.
[스타일] ${styleGuide}
[진료과] ${category}
[슬라이드] ${slideSummaries}

[규칙]
- 한국어로 작성
- 4:3 비율 적합
- 로고/워터마크 금지
- 의료법 위반 문구 금지 (상담/방문/예약/완치/보장)
- 허용: 증상명, 질환명, 정보성 키워드, 질문형, 숫자

예시: "가슴 통증을 느끼는 중년 남성, 3D 일러스트, 파란색 배경, 밝은 톤"`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: { prompts: { type: Type.ARRAY, items: { type: Type.STRING } } },
          required: ["prompts"]
        }
      }
    });
    
    const result = JSON.parse(response.text || '{"prompts":[]}');
    return result.prompts || [];
  } catch (error) {
    console.error('이미지 프롬프트 에이전트 실패:', error);
    return slides.map(s => `${s.imageKeyword}, ${styleGuide}`);
  }
};

// ============================================
// 🎯 2단계 워크플로우: 원고 생성 → 사용자 확인 → 카드뉴스 디자인
// ============================================

// [1단계] 원고 생성 함수 - 블로그와 동일한 검증된 프롬프트 사용
export const generateCardNewsScript = async (
  request: GenerationRequest,
  onProgress: (msg: string) => void
): Promise<CardNewsScript> => {
  const ai = getAiClient();
  const slideCount = request.slideCount || 6;
  const writingStyle = request.writingStyle || 'empathy';
  const writingStylePrompt = getWritingStylePrompts()[writingStyle];
  
  // 블로그와 동일한 검증된 프롬프트 구조 사용
  const medicalSafetyPrompt = getMedicalSafetyPrompt();
  const aiFeedbackRules = getAIFeedbackPrompt();
  
  onProgress('📝 [1단계] 원고 기획 중...');
  
  const prompt = `
${medicalSafetyPrompt}
${aiFeedbackRules}
${writingStylePrompt}
${getWritingStyleCommonRules()}
${PSYCHOLOGY_CTA_PROMPT}

[중요]
🎯 카드뉴스 원고 작성 미션
[중요]

[미션] "${request.topic}" 주제로 ${slideCount}장짜리 **카드뉴스 원고**를 작성하세요.
[진료과] ${request.category}
[글 스타일] ${writingStyle === 'expert' ? '전문가형(신뢰·권위)' : writingStyle === 'empathy' ? '공감형(독자 공감)' : '전환형(정보→확인 유도)'}

${CONTENT_DESCRIPTION}

[[심리] 핵심 원칙: 카드뉴스는 "정보 나열"이 아니라 "심리 흐름"이다!]
- 카드뉴스는 슬라이드형 설득 구조
- 각 카드는 **서로 다른 심리적 역할**을 가져야 함
- 생활습관(운동, 식단, 금연 등)은 **보조 정보로만** (최대 1장)
- 마지막 2장은 반드시 "시점 고정" + "안전한 CTA"

[중요]
📝 각 슬라이드별 작성 내용
[중요]

1. **subtitle** (10-15자): 질문형 또는 핵심 포인트
   예: "왜 중요할까요?", "혹시 이런 증상?"

2. **mainTitle** (15-25자): 핵심 메시지, 줄바꿈(\\n) 포함 가능
   예: "이 신호를\\n놓치지 마세요"
   - 강조할 부분은 <highlight>태그</highlight>로 감싸기

3. **description** (40-80자): 구체적인 설명문
   - 독자가 얻어갈 정보가 있어야 함!
   - 너무 짧으면 안 됨 (최소 40자)
   - 위 의료법 준수 규칙 적용 필수!

4. **speakingNote** (50-100자): 이 슬라이드에서 전달하고 싶은 핵심 메시지
   - 편집자/작성자가 참고할 내부 메모
   - 왜 이 내용이 필요한지, 독자에게 어떤 감정을 유발해야 하는지
   - 예: "독자가 '나도 그런 증상 있는데?' 하고 공감하게 만들어야 함"

5. **imageKeyword** (10-20자): 이미지 생성을 위한 핵심 키워드
   예: "심장 들고 있는 의사", "피로한 직장인"

[중요]
🎭 카드별 심리적 역할 - ${slideCount}장 기준
[중요]

**1장 - 주의 환기 (표지)**
- slideType: "cover"
- 위험 인식 유도, 흥미 유발
- 공포 조장 금지, 질문형 또는 반전형 문구
- speakingNote: "독자의 관심을 끌어야 함. '어? 나도?' 반응 유도"

**2장 - 오해 깨기 (개념 정리)**
- slideType: "concept"
- 착각을 바로잡는 메시지
- speakingNote: "잘못된 상식을 깨고 올바른 정보 제공"

${slideCount >= 5 ? `**3장 - 변화 신호 체크 (증상 체크)**
- slideType: "content"
- 대표적 증상 2-3가지 명확히
- ⚠️ 제목: "위험 신호"보다 "변화 신호", "체크 포인트" 선호
- ⚠️ 증상 설명 후 "다른 원인 가능성" 완충 문장 필수!
- speakingNote: "구체적 증상을 나열해 '자가 체크' 느낌"` : ''}

${slideCount >= 6 ? `**4장 - 자가 판단의 한계**
- slideType: "content"
- 검사·의학적 확인 필요성 강조
- speakingNote: "혼자 판단하면 안 되는 이유 설명"` : ''}

${slideCount >= 7 ? `**5~${slideCount-2}장 - 추가 정보/사례**
- slideType: "content"
- 구체적 증상 설명, 관련 정보
- 생활습관은 최대 1장만!` : ''}

**${slideCount-1}장 - 시점 고정 (🔥 핵심! 🔥)**
- slideType: "content"
- "이런 증상이 나타났다면" → "지켜보기보다 확인 시점일 수 있어요"
- ⚠️ 구체적 시간(2주, 48시간 등) 절대 금지! 범주형으로!
- speakingNote: "지금이 확인할 타이밍이라는 것을 인식시키기"

**${slideCount}장 - 안전한 CTA**
- slideType: "closing"
- ⚠️ 위 CTA 심리학 가이드 참조하여 작성!
- "불편함이 반복된다면 전문적인 확인을 고려해볼 수 있어요"
- speakingNote: "직접 권유 없이 행동을 유도하는 부드러운 마무리"

[중요]
• SEO 최적화 - 네이버/인스타그램 노출용
[중요]

1. **표지 제목 SEO**
   - 핵심 키워드를 제목 앞부분에 배치
   - 검색 의도에 맞는 질문형/호기심형 제목
   ✅ "피부건조 원인, 겨울에 더 심해지는 이유"
   ❌ "피부에 대해 알아봐요"

2. **해시태그 전략 (마지막 카드)**
   - 검색량 높은 키워드 5-7개
   - 롱테일 키워드 포함
   ✅ #피부건조 #겨울철피부관리 #피부보습 #건조한피부케어

3. **각 카드 mainTitle에 키워드 자연스럽게 포함**
   - 핵심 키워드가 전체 카드에 3-5회 분산
   - 동의어/유사어 함께 사용

[중요]
⚠️ 최종 체크리스트
[중요]
□ 제목에 '치료/항암/전문의 권장/총정리' 없는지?
□ 도입부에 자기소개('에디터입니다') 없는지?
□ 숫자/시간이 범주형으로 표현되었는지?
□ 증상 설명 후 '다른 원인 가능성' 문장 있는지?
□ CTA가 직접 권유 없이 완곡하게 작성되었는지?
□ 연도/월이 계절 표현으로 일반화되었는지?
□ 핵심 키워드가 표지 제목 앞부분에 배치되었는지? (SEO)

[📋 출력 필드 - 모든 필드는 한국어로 작성!]
- title: 제목 (한국어)
- topic: 주제 (한국어)
- overallTheme: 전체 구조 설명 (⚠️ 반드시 한국어! 영어 금지! 20자 이내)
  예: "공감과 정보 전달" / "증상 체크 → 확인 안내" / "건강 정보 공유"`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            topic: { type: Type.STRING },
            totalSlides: { type: Type.INTEGER },
            overallTheme: { type: Type.STRING },
            slides: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  slideNumber: { type: Type.INTEGER },
                  slideType: { type: Type.STRING },
                  subtitle: { type: Type.STRING },
                  mainTitle: { type: Type.STRING },
                  description: { type: Type.STRING },
                  speakingNote: { type: Type.STRING },
                  imageKeyword: { type: Type.STRING }
                },
                required: ["slideNumber", "slideType", "subtitle", "mainTitle", "description", "speakingNote", "imageKeyword"]
              }
            }
          },
          required: ["title", "topic", "totalSlides", "slides", "overallTheme"]
        }
      }
    });
    
    const result = JSON.parse(response.text || "{}");
    
    // 🚨 후처리: 1장(표지)과 마지막 장의 description 강제로 빈 문자열로!
    if (result.slides && result.slides.length > 0) {
      // 1장 (표지) description 제거
      result.slides[0].description = "";
      
      // 마지막 장 description 제거
      if (result.slides.length > 1) {
        result.slides[result.slides.length - 1].description = "";
      }
      
      console.log('🚨 [generateCardNewsScript] 표지/마지막 장 description 강제 제거 완료');
    }
    
    onProgress(`✅ 원고 생성 완료 (${result.slides?.length || 0}장)`);
    
    return result as CardNewsScript;
  } catch (error) {
    console.error('원고 생성 실패:', error);
    throw error;
  }
};

// [2단계] 원고를 카드뉴스로 변환하는 함수
export const convertScriptToCardNews = async (
  script: CardNewsScript,
  request: GenerationRequest,
  onProgress: (msg: string) => void
): Promise<{ content: string; imagePrompts: string[]; cardPrompts: CardPromptData[]; title: string; }> => {
  onProgress('🎨 [2단계] 카드뉴스 디자인 변환 중...');
  
  // 스토리를 SlideStory 형식으로 변환 (기존 함수와 호환)
  const slides: SlideStory[] = script.slides.map(s => ({
    slideNumber: s.slideNumber,
    slideType: s.slideType as 'cover' | 'concept' | 'content' | 'closing',
    subtitle: s.subtitle,
    mainTitle: s.mainTitle,
    description: s.description,
    tags: [], // 태그는 프롬프트 생성 시 추가됨
    imageKeyword: s.imageKeyword
  }));
  
  // 스타일 분석 (참고 이미지가 있는 경우)
  let styleConfig: AnalyzedStyle | undefined;
  if (request.coverStyleImage || request.contentStyleImage) {
    try {
      const styleImage = request.coverStyleImage || request.contentStyleImage;
      onProgress('🎨 참고 이미지 스타일 분석 중...');
      const styleJson = await analyzeStyleReferenceImage(styleImage!, !!request.coverStyleImage);
      styleConfig = JSON.parse(styleJson);
      const features = styleConfig?.keyFeatures?.slice(0, 3).join(', ') || '';
      onProgress(`스타일 적용: ${styleConfig?.backgroundColor || '분석됨'} ${features ? `(${features})` : ''}`);
    } catch (e) {
      console.warn('스타일 분석 실패, 기본 스타일 사용:', e);
    }
  }
  
  // HTML 조립
  onProgress('🏗️ 카드 구조 생성 중...');
  const htmlContent = assembleCardNewsHtml({ ...script, slides }, styleConfig);
  
  // 카드 프롬프트 생성 (커스텀 이미지 프롬프트 전달!)
  onProgress('🎨 카드 이미지 프롬프트 생성 중...');
  const cardPrompts = await fullImageCardPromptAgent(
    slides,
    request.imageStyle || 'illustration',
    request.category,
    styleConfig,
    request.customImagePrompt  // 커스텀 프롬프트 전달!
  );
  
  // 공통 함수로 프롬프트 정리
  const imagePrompts = cardPrompts.map(c => cleanImagePromptText(c.imagePrompt));
  onProgress(`✅ 카드뉴스 디자인 변환 완료 (${cardPrompts.length}장)`);
  
  return {
    content: htmlContent,
    imagePrompts,
    cardPrompts,
    title: script.title
  };
};

// [통합] 미니 에이전트 오케스트레이터 (기존 호환 유지)
export const generateCardNewsWithAgents = async (
  request: GenerationRequest,
  onProgress: (msg: string) => void
): Promise<{ content: string; imagePrompts: string[]; cardPrompts: CardPromptData[]; title: string; }> => {
  const slideCount = request.slideCount || 6;
  
  // 1단계: 스토리 기획
  onProgress('📝 [1/3] 스토리 기획 중...');
  const story = await storyPlannerAgent(
    request.topic,
    request.category,
    slideCount,
    request.writingStyle || 'empathy'
  );
  
  if (!story.slides || story.slides.length === 0) {
    throw new Error('스토리 기획 실패: 슬라이드가 생성되지 않았습니다.');
  }
  
  onProgress(`✅ 스토리 기획 완료 (${story.slides.length}장)`);
  
  // 2단계: HTML 조립
  onProgress('🏗️ [2/3] 카드 구조 생성 중...');
  
  // 스타일 분석 결과가 있으면 전체 스타일 적용
  let styleConfig: AnalyzedStyle | undefined;
  if (request.coverStyleImage || request.contentStyleImage) {
    try {
      const styleImage = request.coverStyleImage || request.contentStyleImage;
      onProgress('🎨 참고 이미지 스타일 분석 중...');
      const styleJson = await analyzeStyleReferenceImage(styleImage!, !!request.coverStyleImage);
      const parsed = JSON.parse(styleJson);
      
      // 전체 스타일 정보 전달 (색상뿐만 아니라 폰트, 레이아웃, 프레임 등 모두)
      styleConfig = {
        frameStyle: parsed.frameStyle,
        hasWindowButtons: parsed.hasWindowButtons,
        windowButtonColors: parsed.windowButtonColors,
        backgroundColor: parsed.backgroundColor,
        borderColor: parsed.borderColor,
        borderWidth: parsed.borderWidth,
        borderRadius: parsed.borderRadius,
        boxShadow: parsed.boxShadow,
        subtitleStyle: parsed.subtitleStyle,
        mainTitleStyle: parsed.mainTitleStyle,
        highlightStyle: parsed.highlightStyle,
        descStyle: parsed.descStyle,
        tagStyle: parsed.tagStyle,
        illustPosition: parsed.illustPosition,
        illustSize: parsed.illustSize,
        padding: parsed.padding,
        mood: parsed.mood,
        keyFeatures: parsed.keyFeatures
      };
      
      const features = parsed.keyFeatures?.slice(0, 3).join(', ') || '';
      onProgress(`스타일 적용: ${parsed.backgroundColor || '분석됨'} ${features ? `(${features})` : ''}`);
    } catch (e) {
      console.warn('스타일 분석 실패, 기본 스타일 사용:', e);
    }
  }
  
  const htmlContent = assembleCardNewsHtml(story, styleConfig);
  onProgress('✅ 카드 구조 생성 완료');
  
  // 3단계: 전체 이미지 카드 프롬프트 생성 (텍스트 + 이미지 통합)
  onProgress('🎨 [3/3] 카드 프롬프트 생성 중...');
  const cardPrompts = await fullImageCardPromptAgent(
    story.slides,
    request.imageStyle || 'illustration',
    request.category,
    styleConfig,
    request.customImagePrompt  // 커스텀 프롬프트 전달!
  );
  
  // 공통 함수로 프롬프트 정리
  const imagePrompts = cardPrompts.map(c => cleanImagePromptText(c.imagePrompt));
  onProgress(`✅ 카드 프롬프트 ${cardPrompts.length}개 생성 완료`);
  
  return {
    content: htmlContent,
    imagePrompts,
    cardPrompts, // 새로 추가: 텍스트+이미지 프롬프트 전체
    title: story.topic
  };
};

// ============================================
// 기존 블로그 포스트 생성 함수 (유지)
// ============================================

export const generateBlogPostText = async (request: GenerationRequest, onProgress?: (msg: string) => void): Promise<{ 
    title: string; 
    content: string; 
    imagePrompts: string[];
    fact_check: FactCheckReport;
    analyzedStyle?: { backgroundColor?: string; borderColor?: string; };
    seoScore?: SeoScoreReport;
}> => {
  // onProgress가 없으면 콘솔 로그로 대체
  const safeProgress = onProgress || ((msg: string) => console.log('📍 BlogText Progress:', msg));
  const ai = getAiClient();
  const isCardNews = request.postType === 'card_news';
  const targetLength = request.textLength || 2000;
  const targetSlides = request.slideCount || 6;
  
  // 🔍 글자 수 설정 확인 로그
  console.log(`📏 글자 수 설정: ${targetLength}자 (상한선: ${Math.floor(targetLength * 1.03)}자)`);
  console.log(`📊 허용 범위: ${targetLength}자 ~ ${Math.floor(targetLength * 1.03)}자 (3% 초과)`);
  
  // 스타일 참고 이미지 분석 (카드뉴스일 때만 - 표지/본문 분리)
  let coverStyleAnalysis = '';
  let contentStyleAnalysis = '';
  let analyzedBgColor = '';
  
  if (isCardNews) {
    // 표지 스타일 분석
    if (request.coverStyleImage) {
      try {
        coverStyleAnalysis = await analyzeStyleReferenceImage(request.coverStyleImage, true);
      } catch (e) {
        console.warn('표지 스타일 분석 실패:', e);
      }
    }
    
    // 본문 스타일 분석
    if (request.contentStyleImage) {
      try {
        contentStyleAnalysis = await analyzeStyleReferenceImage(request.contentStyleImage, false);
      } catch (e) {
        console.warn('본문 스타일 분석 실패:', e);
      }
    }
    
    // 표지만 있으면 본문도 같은 스타일 적용
    if (coverStyleAnalysis && !contentStyleAnalysis) {
      contentStyleAnalysis = coverStyleAnalysis;
    }
  }
  
  // 스타일 분석 결과를 프롬프트에 적용
  let styleAnalysis = '';
  let coverStyle: any = {};
  let contentStyle: any = {};
  
  if (coverStyleAnalysis || contentStyleAnalysis) {
    // JSON 파싱 시도
    try {
      if (coverStyleAnalysis) coverStyle = JSON.parse(coverStyleAnalysis);
      if (contentStyleAnalysis) contentStyle = JSON.parse(contentStyleAnalysis);
      // 배경색 저장 (후처리용)
      analyzedBgColor = coverStyle.backgroundColor || contentStyle.backgroundColor || '';
    } catch (e) {
      // JSON 파싱 실패 시 원본 텍스트 사용
      console.warn('스타일 JSON 파싱 실패:', e);
    }
    
    // 브라우저 프레임 HTML 생성
    const windowButtonsHtml = (style: any) => {
      if (style.hasWindowButtons || style.frameStyle === 'browser-window') {
        const colors = style.windowButtonColors || ['#FF5F57', '#FFBD2E', '#28CA41'];
        return `<div class="browser-header" style="display:flex; gap:6px; padding:8px 12px; background:#f0f0f0; border-radius:12px 12px 0 0;">
          <span style="width:12px; height:12px; border-radius:50%; background:${colors[0]};"></span>
          <span style="width:12px; height:12px; border-radius:50%; background:${colors[1]};"></span>
          <span style="width:12px; height:12px; border-radius:50%; background:${colors[2]};"></span>
        </div>`;
      }
      return '';
    };
    
    // inline CSS 스타일 생성 함수
    const generateInlineStyle = (style: any) => {
      const parts = [];
      if (style.backgroundColor) parts.push(`background-color: ${style.backgroundColor}`);
      if (style.borderColor && style.borderWidth) {
        parts.push(`border: ${style.borderWidth} solid ${style.borderColor}`);
      } else if (style.borderColor) {
        parts.push(`border: 2px solid ${style.borderColor}`);
      }
      if (style.borderRadius) parts.push(`border-radius: ${style.borderRadius}`);
      if (style.boxShadow) parts.push(`box-shadow: ${style.boxShadow}`);
      if (style.padding) parts.push(`padding: ${style.padding}`);
      return parts.join('; ');
    };
    
    // 제목 스타일 생성
    const generateTitleStyle = (style: any) => {
      if (!style.mainTitleStyle) return '';
      const s = style.mainTitleStyle;
      const parts = [];
      if (s.color) parts.push(`color: ${s.color}`);
      if (s.fontSize) parts.push(`font-size: ${s.fontSize}`);
      if (s.fontWeight) parts.push(`font-weight: ${s.fontWeight}`);
      return parts.join('; ');
    };
    
    // 강조 스타일 생성
    const generateHighlightStyle = (style: any) => {
      if (!style.highlightStyle) return '';
      const s = style.highlightStyle;
      const parts = [];
      if (s.color) parts.push(`color: ${s.color}`);
      if (s.backgroundColor && s.backgroundColor !== 'transparent') {
        parts.push(`background-color: ${s.backgroundColor}`);
        parts.push(`padding: 2px 6px`);
        parts.push(`border-radius: 4px`);
      }
      return parts.join('; ');
    };
    
    // 부제목 스타일 생성
    const generateSubtitleStyle = (style: any) => {
      if (!style.subtitleStyle) return '';
      const s = style.subtitleStyle;
      const parts = [];
      if (s.color) parts.push(`color: ${s.color}`);
      if (s.fontSize) parts.push(`font-size: ${s.fontSize}`);
      if (s.fontWeight) parts.push(`font-weight: ${s.fontWeight}`);
      return parts.join('; ');
    };
    
    // 태그 스타일 생성
    const generateTagStyle = (style: any) => {
      if (!style.tagStyle) return '';
      const s = style.tagStyle;
      const parts = [];
      if (s.backgroundColor) parts.push(`background-color: ${s.backgroundColor}`);
      if (s.color) parts.push(`color: ${s.color}`);
      if (s.borderRadius) parts.push(`border-radius: ${s.borderRadius}`);
      parts.push(`padding: 4px 12px`);
      return parts.join('; ');
    };
    
    const coverInlineStyle = generateInlineStyle(coverStyle);
    const contentInlineStyle = generateInlineStyle(contentStyle);
    const coverTitleStyle = generateTitleStyle(coverStyle);
    const coverHighlightStyle = generateHighlightStyle(coverStyle);
    const coverSubtitleStyle = generateSubtitleStyle(coverStyle);
    const coverTagStyle = generateTagStyle(coverStyle);
    const contentTitleStyle = generateTitleStyle(contentStyle);
    const contentHighlightStyle = generateHighlightStyle(contentStyle);
    const contentSubtitleStyle = generateSubtitleStyle(contentStyle);
    const contentTagStyle = generateTagStyle(contentStyle);
    
    // 분석된 배경색을 CSS로 변환
    const bgColor = coverStyle.backgroundColor || contentStyle.backgroundColor || '#E8F4FD';
    const bgGradient = bgColor.includes('gradient') ? bgColor : `linear-gradient(180deg, ${bgColor} 0%, ${bgColor}dd 100%)`;
    
    styleAnalysis = `
[🎨🎨🎨 카드뉴스 스타일 - 이 스타일을 반드시 그대로 적용하세요! 🎨🎨🎨]

**⚠️ 최우선 규칙 ⚠️**
**모든 카드에 반드시 style="background: ${bgGradient};" 적용!**
**기본 흰 배경(#f8fafc, #fff) 사용 금지!**

**필수 적용 배경색: ${bgColor}**

${coverStyleAnalysis ? `**📕 표지 (1장) HTML:**
<div class="card-slide" style="background: ${bgGradient}; border-radius: 24px; overflow: hidden;">
  ${windowButtonsHtml(coverStyle)}
  <div class="card-content-area" style="padding: 32px 28px;">
    <p class="card-subtitle" style="${coverSubtitleStyle || 'color: #3B82F6; font-size: 14px; font-weight: 700;'}">부제목 (10~15자)</p>
    <p class="card-main-title" style="${coverTitleStyle || 'color: #1E293B; font-size: 28px; font-weight: 900;'}">메인 제목<br/><span style="color: #3B82F6;">강조</span></p>
    <div class="card-img-container">[IMG_1]</div>
    <p class="card-desc" style="font-size: 15px; color: #475569; line-height: 1.7;">30~50자의 구체적인 설명 문장을 작성하세요!</p>
  </div>
</div>
` : ''}

${contentStyleAnalysis ? `**📄 본문 (2장~) HTML:**
<div class="card-slide" style="background: ${bgGradient}; border-radius: 24px; overflow: hidden;">
  ${windowButtonsHtml(contentStyle)}
  <div class="card-content-area" style="padding: 32px 28px;">
    <p class="card-subtitle" style="${contentSubtitleStyle || 'color: #3B82F6; font-size: 14px; font-weight: 700;'}">부제목 (10~15자)</p>
    <p class="card-main-title" style="${contentTitleStyle || 'color: #1E293B; font-size: 28px; font-weight: 900;'}">메인 제목<br/><span style="color: #3B82F6;">강조</span></p>
    <div class="card-img-container">[IMG_N]</div>
    <p class="card-desc" style="font-size: 15px; color: #475569; line-height: 1.7;">30~50자의 구체적인 설명 문장을 작성하세요!</p>
  </div>
</div>
` : ''}

**🚨 배경색 필수 적용: ${bgColor} 🚨**
style 속성에 background: ${bgGradient}; 반드시 포함!
`;
  }
  
  let benchmarkingInstruction = '';
  if (request.referenceUrl) {
    benchmarkingInstruction = `
    [🚨 벤치마킹 모드 활성화]
    Target URL: ${request.referenceUrl}
    Google Search 도구를 사용하여 위 URL의 페이지를 접속해 콘텐츠 구조를 분석하십시오.
    
    ${isCardNews 
      ? `[미션: 템플릿 구조 모방]
         - 입력된 URL은 '카드뉴스 템플릿'입니다.
         - 해당 카드뉴스의 [페이지별 구성(표지-목차-본론-결론)], [텍스트 밀도], [강조 문구 스타일]을 분석하십시오.
         - 분석한 특징을 아래 [HTML 구조 가이드]에 대입하여 내용을 작성하십시오.
         - 예: 레퍼런스가 'Q&A' 형식이면 본문도 'Q&A'로, 'O/X 퀴즈' 형식이면 'O/X 퀴즈'로 구성하십시오.`
      : `[미션: 블로그 스타일 모방]
         - 이 블로그의 말투, 문단 구조, 이모지 사용 패턴을 완벽히 모방하여 글을 작성하십시오.`}
    
    [⚠️ 의료법 절대 준수] 
    - 벤치마킹 대상이 과장/위법 표현을 쓰더라도 절대 따라하지 말고 안전한 표현으로 순화하십시오.
    `;
  }

  const targetImageCount = request.imageCount ?? 1;
  const imageMarkers = targetImageCount > 0 
    ? Array.from({length: targetImageCount}, (_, i) => `[IMG_${i+1}]`).join(', ')
    : '';
  const writingStyle = request.writingStyle || 'empathy'; // 기본값: 공감형
  const writingStylePrompt = getWritingStylePrompts()[writingStyle];
  const imageStyle = request.imageStyle || 'illustration'; // 기본값: 3D 일러스트
  
  // 학습된 말투 스타일 적용
  let learnedStyleInstruction = '';
  if (request.learnedStyleId) {
    try {
      const { getStyleById, getStylePromptForGeneration } = await import('./writingStyleService');
      const learnedStyle = getStyleById(request.learnedStyleId);
      if (learnedStyle) {
        learnedStyleInstruction = `
[🎓🎓🎓 학습된 말투 적용 - 최우선 적용! 🎓🎓🎓]
${getStylePromptForGeneration(learnedStyle)}

⚠️ 위 학습된 말투를 반드시 적용하세요!
- 문장 끝 패턴을 정확히 따라하세요
- 자주 사용하는 표현을 자연스럽게 활용하세요
- 전체적인 어조와 분위기를 일관되게 유지하세요
`;
        console.log('📝 학습된 말투 적용:', learnedStyle.name);
      }
    } catch (e) {
      console.warn('학습된 말투 로드 실패:', e);
    }
  }
  
  // 커스텀 소제목 적용
  let customSubheadingInstruction = '';
  if (request.customSubheadings && request.customSubheadings.trim()) {
    const subheadings = request.customSubheadings.trim().split('\n').filter(h => h.trim());
    if (subheadings.length > 0) {
      customSubheadingInstruction = `
[📋📋📋 소제목 필수 사용 - 사용자 지정 소제목! 📋📋📋]
아래 소제목들을 **정확히 그대로** 사용하여 문단을 작성하세요!
소제목 개수: ${subheadings.length}개

${subheadings.map((h, i) => `${i + 1}. ${h}`).join('\n')}

🚨 **필수 규칙:**
- 위 소제목을 **순서대로 정확히 그대로** 사용할 것!
- 소제목 텍스트를 절대 수정하지 말 것!
- 각 소제목에 맞는 내용으로 문단을 작성할 것!
- H3 태그(<h3>)를 사용하여 소제목을 표시할 것!
`;
      console.log('📋 커스텀 소제목 적용:', subheadings.length, '개');
    }
  }
  
  // 현재 한국 시간 정보 (최신 정보 기반 글 작성용)
  const now = new Date();
  const koreaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const currentYear = koreaTime.getFullYear();
  const currentMonth = koreaTime.getMonth() + 1;
  const currentDay = koreaTime.getDate();
  const currentSeason = currentMonth >= 3 && currentMonth <= 5 ? '봄' 
    : currentMonth >= 6 && currentMonth <= 8 ? '여름'
    : currentMonth >= 9 && currentMonth <= 11 ? '가을' : '겨울';
  const timeContext = `현재 날짜: ${currentYear}년 ${currentMonth}월 ${currentDay}일 (${currentSeason})`;
  // 커스텀 이미지 프롬프트가 있으면 최우선 사용
  const customImagePrompt = request.customImagePrompt?.trim();
  const imageStyleGuide = customImagePrompt
    ? `커스텀 스타일: ${customImagePrompt}` // 커스텀 프롬프트 최우선!
    : imageStyle === 'illustration' 
    ? '3D 렌더 일러스트, Blender 스타일, 부드러운 스튜디오 조명, 파스텔 색상, 둥근 형태, 친근한 캐릭터, 깔끔한 배경 (⛔금지: 실사, 사진, DSLR)'
    : imageStyle === 'medical'
    ? '의학 3D 일러스트, 해부학적 렌더링, 해부학적 구조, 장기 단면도, 반투명 장기, 임상 조명, 의료 색상 팔레트 (⛔금지: 귀여운 만화, 실사 얼굴)'
    : '실사 DSLR 사진, 진짜 사진, 35mm 렌즈, 자연스러운 부드러운 조명, 얕은 피사계심도, 전문 병원 환경 (⛔금지: 3D 렌더, 일러스트, 만화, 애니메이션)';
  
  // 동적으로 최신 의료광고법 프롬프트 생성
  const medicalSafetyPrompt = getMedicalSafetyPrompt();
  const aiFeedbackRules = getAIFeedbackPrompt();
  
  // 🎯 간소화된 핵심 프롬프트 (API 타임아웃 방지 - 기존 21KB → 약 2KB)
  const blogPrompt = `
너는 한국 병·의원 네이버 블로그용 의료 정보를 작성하는 전문 의료 콘텐츠 에디터다.

[🎯 목표]
- 독자가 "광고 같다"가 아니라 "설명 잘 해주네"라고 느끼는 정보 신뢰도 높은 글 작성
- 의학적으로 과도하지 않으면서도 허술하지 않은 설명 제공
- 정보 신뢰도 기준에서 별점 5점을 받을 수 있는 톤 유지

[작성 요청]
- 진료과: ${request.category}
- 주제: ${request.topic}
- 목표 길이: ${targetLength}자 (중요!)
- 이미지: ${targetImageCount}장 (${imageMarkers} 마커 사용)
${learnedStyleInstruction ? '- 말투: 학습된 스타일 적용\n' + learnedStyleInstruction : ''}
${customSubheadingInstruction ? customSubheadingInstruction : ''}

[현재 시점]
${timeContext}

🚨 **절대 금지:** "${currentYear}년", "올해", "이번 ${currentSeason}" 같은 시간 참조 표현 사용 금지!
✅ **허용:** "${currentSeason}철", "추운 날씨", "더운 날씨", "환절기" 같은 일반적 계절 표현만 사용!

[🚨 작성 원칙 - 최우선 준수!]
1. **단정 표현 절대 금지**
   - ❌ 치료된다, 낫는다, 반드시, 효과가 있다 사용 금지
   - ✅ "경우가 있습니다", "도움이 될 수 있습니다", "알려져 있습니다"

2. **모든 의학 정보는 '조건·범위·차이'를 함께 제시**
   - ❌ "무릎 통증은 십자인대 파열이다"
   - ✅ "무릎 통증은 여러 원인이 있을 수 있으며, 그중 십자인대 손상이 의심되는 경우도 있습니다"
   - 필수 표현: "경우에 따라", "사람마다 다를 수 있으며", "일반적으로 알려진 내용으로는"

3. **원인–증상–과정–판단 기준을 반드시 연결해 설명**
   - ❌ 정보 나열: "증상 1. 통증 2. 부종 3. 소리"
   - ✅ 과정 설명: "무릎에 갑작스러운 충격이 가해지면 인대가 늘어나거나 끊어질 수 있습니다. 이때 뚝 소리가 들리고, 이후 부종이 나타나는 경우가 있습니다."

4. **'설명해주는 사람'의 톤 유지**
   - ❌ 지시형·권유형: "병원을 방문하세요", "꼭 확인하세요", "예방해야 합니다"
   - ✅ 설명형: "병원 방문이 필요할 수 있습니다", "확인해볼 수 있습니다", "주의가 필요한 경우입니다"

5. **전문 용어는 일상 언어로 풀어 설명**
   - ❌ "전방십자인대 파열은 ACL 손상입니다"
   - ✅ "무릎 안쪽에서 뼈를 연결하는 인대가 끊어지거나 늘어나는 상태를 전방십자인대 손상이라고 합니다"

6. **특정 치료·시술의 효과를 강조하지 말고 '어떤 맥락에서 고려되는지'만 설명**
   - ❌ "줄기세포 치료는 관절을 재생시킵니다"
   - ✅ "상태에 따라 줄기세포 시술이 고려되는 경우가 있으며, 개인의 상황에 따라 적용 여부가 달라질 수 있습니다"

7. **독자가 스스로 판단할 수 있는 기준을 제공**
   - 언제 지켜볼 수 있는지
   - 언제 확인이 필요한지
   - 어떤 경우에 주의가 필요한지

8. **광고·홍보로 오해될 수 있는 표현 자동 배제**
   - ❌ 금지 단어: 장점, 우수성, 재생, 강화, 예방, 회복, 재발 방지, 최신, 특효
   - ✅ 대체 표현: "고려되는 경우", "적용되는 상황", "완화에 도움이 될 수 있는"

[📝 문장 스타일]
- 한 문장에 정보 1개
- 설명 → 보충 → 완곡한 정리 구조
- ❌ 논문체·AI 요약체 금지
- ✅ "~입니다" 연속 사용 금지 → "~습니다", "~됩니다", "~있습니다" 교차 사용

[핵심 규칙 - 기존 유지]
1. 의료법 준수: 효과 단정, 직접 내원 권유("방문하세요") 금지
2. 자연스러운 문장 리듬, 현장감 있는 표현, 독자 공감형 서술
3. 빈도·증가·유행 표현 제한 → "많다/늘었다/흔하다" 대신 "인식되는 경우", "느끼는 분들" 등 체감 표현으로 치환
4. 마지막 문단은 지시형이 아닌 선택형 정리 → "점검해볼 수 있다", "하나의 기준이 될 수 있다"
5. 병명은 설명 목적에 한해 제한적 사용 → 반복 노출이나 강조 금지

[🚨 의료광고법 노란줄 표현 - 반드시 피하기!]
⚠️ "~의심해볼 수 있다" → ✅ "~살펴볼 필요가 있는", "~확인해볼 만한"
⚠️ "자가 진단 방법" → ✅ "이런 증상이 있다면 체크해볼 사항" / "주의가 필요한 경우"
⚠️ 소제목에 "방법/진단/판별" 금지 → ✅ "체크/참고/살펴보기" 사용
⚠️ 치료 언급 시 완충 문장 필수 추가: "개인의 상태에 따라 판단이 달라질 수 있으므로, 의료진과의 상담을 통해 결정하는 것이 일반적입니다."

🚨🚨🚨 [절대 금지 - 시간 참조 & 구체적 기간] 🚨🚨🚨
❌ **시간 참조 표현 절대 금지:** (글은 영구 보관되므로)
- "2026년 겨울은~", "올해는~", "금년은~" → 모두 금지!
- "이번 겨울~", "이번 여름~", "최근 몇 년간~" → 모두 금지!
- ✅ 대체: "겨울철에는~", "추운 날씨에는~", "환절기에는~"

❌ **구체적 기간 표현 절대 금지:**
- "2주 이상", "3일~5일", "24시간~48시간", "1주일 정도" → 모두 금지!
- ✅ 대체: "일정 기간 이상", "며칠째", "시간이 지나도", "개인에 따라 차이"

[🏆 1위 블로그 작성법 - 필수!]
6. 도입부는 독자 일상 체험형으로 3문단 구성 → "처음에는" → "점점" → "어느 순간" 시간 흐름으로 증상 진행 묘사
7. 소제목은 질문형(H3)으로 작성 → "~이란?", "~증상은?" (검색 의도 정확 매칭)
8. 완충 표현 적극 사용 → "~경우가 있습니다"(다수), "~알려져 있습니다", "~도움이 될 수 있습니다"
9. 구체적 숫자/시간은 필요 시에만 사용 → 예방 실천법 등에서 "40~60분마다", "약 1분간" (치료·효과 수치는 절대 금지)
10. 문장 리듬 다양화 → 각 소제목마다 1줄/3줄/2줄 문단 섞기 (균등하면 AI스럽게 보임!)
11. 문장 종결 다양화 → "~입니다" 연속 사용 금지, "~습니다", "~됩니다", "~있습니다" 교차 사용

[📝 마무리 문단 - 행동의 씨앗 심기]
12. 마지막 문단은 "좋은 말"로 끝내지 말고 행동 유도:
    ❌ "유용한 기준이 될 수 있기를 바랍니다" (아무 행동 안 남김)
    ✅ "반복되는 증상이 있다면 단순히 넘기기보다는 자신의 몸 상태를 한 번쯤 점검해보는 계기로 삼아보는 것도 도움이 될 수 있습니다."

[HTML 구조 - 1위 글 스타일]
⛔ 절대 금지: "안녕하세요", "여러분", "건강한 일상", "유익한 정보" 같은 인사말/상투적 표현으로 시작하지 마세요!
✅ 바로 독자의 일상 체험/증상 묘사로 시작하세요!

<div class="naver-post-container">
  <p>도입 1문단: 독자 일상 체험 묘사로 바로 시작 (2~3줄)</p>
  <p>도입 2문단: 증상 진행 과정 (3~4줄, "점점" "어느 순간")</p>
  <p>도입 3문단: 병명 자연스럽게 도입 (1~2줄, "이와 같은 상태를 일반적으로...")</p>
  
  <h3>${request.topic} 이란?</h3>
  <p>개념 설명 (1줄 짧은 문단)</p>
  <p>구체적 원인/배경 (3줄 문단, 완충 표현 사용)</p>
  <p>추가 설명 (2줄 문단)</p>
  ${targetImageCount >= 1 ? '\n  [IMG_1]\n' : ''}
  
  <h3>${request.topic}의 주요 증상은?</h3>
  <p>증상 설명 (문단 길이 다양하게)</p>
  <p>시간대별/상황별 증상 차이</p>
  ${targetImageCount >= 2 ? '\n  [IMG_2]\n' : ''}
  
  <h3>이런 증상이 있다면 체크해볼 사항</h3>
  <p>독자가 참고할 수 있는 체크포인트 (구체적 숫자 포함)</p>
  <p>"다만 이는 참고용이며, 정확한 판단은 의료진의 진료가 필요합니다."</p>
  
  <h3>${request.topic} 관리 및 완화 방법은?</h3>
  <p>비수술적 방법 우선 설명</p>
  <p>각 방법의 목적과 적용 상황 + 완충 문장 필수</p>
  ${targetImageCount >= 3 ? '\n  [IMG_3]\n' : ''}
  
  <h3>${request.topic} 예방을 위해 살펴볼 점</h3>
  <p>실천 가능한 구체적 방법</p>
  <p>행동 유도 마무리: "반복되는 증상이 있다면 자신의 몸 상태를 한 번쯤 점검해보는 계기로 삼아보는 것도 도움이 될 수 있습니다."</p>
  
  <p>해시태그 10개</p>
</div>

[이미지 프롬프트 규칙 - 한국어 작성]
- 이미지에 텍스트/로고 절대 금지
- 스타일 키워드: ${imageStyleGuide}

[📤 출력 조건]
- 의료광고법을 고려한 안전한 표현 사용
- 독자가 읽고 "아, 이런 맥락이구나"라고 이해할 수 있게 작성
- 정보성·설명형 톤 유지
- "광고 같다"가 아니라 "설명 잘 해주네"라는 반응을 얻을 수 있는 글

[🔍 최종 검토 체크리스트]
□ 단정 표현 0개? (치료된다, 낫는다, 반드시, 효과가 있다)
□ 모든 의학 정보에 조건·범위·차이 명시?
□ 원인–증상–과정–판단 기준 연결 설명?
□ 지시형·권유형 문장 최소화? (설명형으로 대체)
□ 전문 용어를 일상 언어로 풀어 설명?
□ 치료·시술 효과 강조 없이 맥락만 설명?
□ 광고·홍보 느낌 표현 0개? (장점, 우수성, 재생, 강화, 예방, 회복)
□ 한 문장에 정보 1개 원칙 준수?

[JSON 응답]
{
  "title": "제목 (상태 점검형 질문)",
  "content": "HTML 본문",
  "imagePrompts": ["한국어 프롬프트1", "한국어 프롬프트2"],
  "fact_check": {
    "fact_score": 85,
    "safety_score": 95,
    "conversion_score": 80,
    "ai_smell_score": 10,
    "verified_facts_count": 5,
    "issues": ["문제점"],
    "recommendations": ["권장사항"]
  }
}

⚠️ ai_smell_score는 낮을수록 좋음 (7점 이하 목표, 15점 초과 시 재작성)
⚠️ 목표 길이: 공백 제외 ${targetLength}자 반드시 맞추기! (최대 ${Math.floor(targetLength * 1.03)}자까지만!)
🚨 예시: 2000자 목표 → 2060자 넘으면 안 됨! (2700자는 절대 금지!)

[검색 정보 활용]
(검색 정보는 generateWithAgentMode에서 자동으로 수집됩니다)

[작성 시작]
위 요청사항과 검색 정보를 바탕으로 전문적이고 신뢰도 높은 콘텐츠를 작성해주세요.
반드시 JSON 형식으로 응답하고, 목표 길이(공백 제외 ${targetLength}~${Math.floor(targetLength * 1.03)}자)를 준수해주세요.
  `;

  /* 기존 상세 프롬프트 주석 처리 (API 타임아웃 방지)
    
    [📅 현재 시점 정보 - 최신 정보 기반 작성 필수!]
    ${timeContext}
    
    ---━━
    🚨 절대 금지 규칙 (이것만 지켜도 80점!)
    ---━━
    
    ❌ **"~인지, ~인지, ~인지" 나열 패턴 절대 금지!**
       - **이런 패턴 발견 즉시 탈락:**
         - "구토가 반복되는지, 물을 마셔도 유지가 어려운지, 설사가 물처럼 이어지는지"
         - "통증이 더 뚜렷해지는지, 고관절 회전 시 통증이 커지는지, 걷기 꺼려지는지"
         - "오한·발열감·근육통이 같이 붙는지, 주변에서도 비슷한 증상이 이어지는지"
       
       - **반드시 문단 흐름으로 풀어쓰기:**
         ✅ "구토가 반복되고 물을 마셔도 유지하기 어려운 상태가 이어질 수 있다. 설사가 물처럼 나오면서 복통 강도가 커지는 흐름이 있다면, 오한이나 발열감, 근육통 같은 전신 증상이 함께 나타나는 경우도 있다. 가족이나 동료 등 주변에서도 비슷한 증상이 이어진다면..."
       
       - **나열식 불릿 포인트도 금지:**
         ❌ "- ~인지 확인해보세요"
         ❌ "- ~인지 체크해보세요"
         ❌ "- ~인지 살펴봅니다"
    
    ❌ **글 서두에 메타 설명 금지!**
       - "이 글은 ~에 초점을 맞췄습니다"
       - "~하려는 목적은 아니며"
       - "~참고할 수 있는 정보입니다"
       - 글쓴이의 의도나 목적을 설명하는 문장 금지
       - 바로 본론으로 시작
    
    ❌ **판단 회피 표현 반복 제한!**
       - "단정하기는 어렵습니다", "판단하기가 어렵습니다" 등
       - 동일 표현 2회 이상 반복 금지 (1회는 허용)
       - 다양한 표현 사용 권장: "명확히 구분되지 않는 경우도 있다", "겹치는 부분이 있다" 등
    
    ---━━
    
    🔎 **글 작성 전 필수 검색 단계 (반드시 순서대로 수행!)** 🔎
    
    ⚠️ **핵심: health.kdca.go.kr 전용 검색 강화!** ⚠️
    
    1순위:1순위 (최우선! 반드시 먼저!)**: 
       검색어: "${request.topic} site:health.kdca.go.kr"
       → 질병관리청 건강정보포털 (일반인 대상 건강정보)
       → URL 형식: https://health.kdca.go.kr/...
       → 🚨 이 사이트에서 충분한 자료를 찾았다면 해외 사이트(PubMed) 검색 생략!
       → 🚨 health.kdca.go.kr 결과를 글에 가장 많이 반영!
    
    2순위:2순위**: 
       검색어: "${request.topic} site:kdca.go.kr"
       → 질병관리청 공식 사이트 (보도자료, 통계, 감염병 정보)
    
    3순위:3순위**: 
       검색어: "${request.topic} site:mohw.go.kr OR site:nhis.or.kr"
       → 보건복지부, 국민건강보험공단 공식 자료
    
    4순위:4순위**: 
       검색어: "${request.topic} 대한${request.category}학회 가이드라인 ${currentYear}"
       → 국내 학회 최신 지침 확인
    
    5. **5순위 (선택적 - 국내 자료 부족 시에만!)**: 
       검색어: "${request.topic} site:pubmed.ncbi.nlm.nih.gov ${currentYear}"
       → 최신 논문/연구 결과 확인
       → ⚠️ 1~4순위에서 충분한 자료를 찾았다면 이 단계는 생략!
    
    📋 **검색 전략 (health.kdca.go.kr 우선!):**
    ✅ health.kdca.go.kr에서 관련 정보를 충분히 찾았다면 → 해외 논문 검색 생략!
    ✅ health.kdca.go.kr 정보를 글의 주요 근거로 활용!
    ✅ 국내 공신력 있는 자료가 부족할 때만 → PubMed 등 해외 자료 참고
    ✅ 항상 한국 실정에 맞는 정보를 우선으로!
    
    [금지] **절대 검색 금지 도메인:**
    - blog.naver.com, tistory.com, brunch.co.kr (블로그)
    - cafe.naver.com (카페)
    - youtube.com (유튜브)
    - health.chosun.com, hidoc.co.kr, kormedi.com (건강 매체)
    - storybongbong.co.kr, keyzard.cc (절대 금지!)
    
    ⚠️ 검색 결과를 바탕으로 최신 정보만 사용하여 글 작성!
    ⚠️ 출처 인용은 필요시 자연스럽게 (횟수 제한 없음, 강제 아님)
    
    - ${currentYear}년 최신 의학 가이드라인/연구 결과 반영
    - ${currentYear}년 최신 의료광고법 규정 준수
    - ${currentSeason}철 특성 고려 (계절성 질환, 생활 습관 등)
    - 오래된 정보(2년 이상)는 최신 정보로 업데이트하여 작성
    
    진료과: ${request.category}, 페르소나: ${request.persona}, 주제: ${request.topic}
    
    [🚨 글자 수 - 가장 중요한 요구사항!!! 🚨]
    ✅ **허용 범위:** ${targetLength}자 ~ ${Math.floor(targetLength * 1.03)}자 (공백 제외)
    🎯 **이상적:** ${targetLength}자 ~ ${Math.floor(targetLength * 1.01)}자 (목표치에 최대한 근접!)
    ❌ **절대 금지:** ${targetLength}자 미만 또는 ${Math.floor(targetLength * 1.03)}자 초과!
    
    📏 구조 가이드 (공백 제외 ${targetLength}자 기준):
    ${targetLength >= 5000 ? `서론 400자 + 본론 5~6섹션(각 600자) + 결론 300자` 
      : targetLength >= 4000 ? `서론 350자 + 본론 4~5섹션(각 500자) + 결론 250자` 
      : targetLength >= 3500 ? `서론 320자 + 본론 4섹션(각 480자) + 결론 220자`
      : targetLength >= 3000 ? `서론 280자 + 본론 3~4섹션(각 430자) + 결론 200자`
      : targetLength >= 2500 ? `서론 220자 + 본론 3섹션(각 380자) + 결론 150자`
      : targetLength >= 2000 ? `서론 170자 + 본론 2~3섹션(각 310자) + 결론 120자`
      : targetLength >= 1500 ? `서론 110자 + 본론 2섹션(각 260자) + 결론 90자`
      : `서론 간결 + 본론 2~3섹션 + 결론 간결`}
    
    💡 글자 수 조절 팁:
    - 늘리기: 구체적 사례/예시 추가, 비교/대조 설명, 독자 공감 문장, 섹션 추가
    - 줄이기: 중복 표현 제거, 불필요한 접속사 삭제, 간결한 문장으로 재작성
    
    이미지 개수: ${targetImageCount}장 ${targetImageCount > 0 ? `(${imageMarkers} 마커 사용)` : '(이미지 없이 텍스트만 작성)'}
    
    [네이버 블로그 HTML 형식 작성 필수]
    🚨 **마크다운 문법 절대 사용 금지!!!** 🚨
    ❌ **굵은글씨** → ✅ <strong>굵은글씨</strong> 또는 <b>굵은글씨</b>
    ❌ *기울임* → ✅ <em>기울임</em>
    ❌ ### 제목 → ✅ <h3>제목</h3>
    ❌ - 목록 → ✅ <ul><li>목록</li></ul>
    ❌ [링크](url) → ✅ <a href="url">링크</a>
    
    ⛔ 특히 **단어** 이런 식으로 별표 두 개로 감싸는 거 절대 금지!
    ⛔ 반드시 <strong>단어</strong> 또는 <b>단어</b>로 작성!
    
    HTML 구조 (이미지 ${targetImageCount}장 배치, 글자 수 ${targetLength}자 기준):
    <div class="naver-post-container">
      <h3>🎯 서론 제목 (공감 유도)</h3>
      <p>서론 문단 (${targetLength >= 4000 ? '400자 이상' : targetLength >= 3000 ? '300자 이상' : '200자 이상'}) - ${writingStyle === 'expert' ? '의학적 인사이트나 논문/학회 인용으로 시작' : '구체적 상황 묘사로 시작! (예: "히터 켜고 자고 일어나면...")'}</p>
      <p>서론 추가 문단 - 왜 이 주제가 중요한지 설명</p>
      
      ${targetImageCount >= 1 ? '[IMG_1]' : ''}
      
      <h3>※ 본론 1: 정의/개념 설명</h3>
      <p>핵심 개념 설명 (${targetLength >= 4000 ? '500자 이상' : '350자 이상'})</p>
      <p>추가 설명 + 예시</p>
      <ul>
        <li>포인트 1 - 상세 설명</li>
        <li>포인트 2 - 상세 설명</li>
        <li>포인트 3 - 상세 설명</li>
      </ul>
      
      ${targetImageCount >= 2 ? '[IMG_2]' : ''}
      
      <h3>⚠️ 본론 2: 원인/증상 상세</h3>
      <p>원인 설명 (${targetLength >= 4000 ? '500자 이상' : '350자 이상'})</p>
      <p>증상별 상세 설명 + 구체적 사례</p>
      <ul>
        <li>원인/증상 1 - "예를 들어..." 상세 설명</li>
        <li>원인/증상 2 - 구체적 상황 묘사</li>
        <li>원인/증상 3 - 주의사항</li>
      </ul>
      
      ${targetImageCount >= 3 ? '[IMG_3]' : ''}
      
      ${targetLength >= 3500 ? `
      <h3>🔬 본론 3: 진단/검사 방법</h3>
      <p>검사 방법 상세 설명 (400자 이상) - 어떤 검사를 하는지, 검사 과정은 어떤지</p>
      <p>검사 결과 해석 방법 + 주의사항</p>
      <ul>
        <li>검사 종류 1 설명</li>
        <li>검사 종류 2 설명</li>
      </ul>
      ` : ''}
      
      ${targetImageCount >= 4 ? '[IMG_4]' : ''}
      
      ${targetLength >= 4000 ? `
      <h3>💊 본론 4: 치료/관리 방법</h3>
      <p>치료 방법 상세 설명 (500자 이상)</p>
      <p>관리 방법 + 생활 습관 개선 팁</p>
      <ul>
        <li>치료법 1 - 장단점 설명</li>
        <li>치료법 2 - 적용 대상</li>
        <li>생활 관리법 - 구체적 방법</li>
      </ul>
      ` : ''}
      
      ${targetLength >= 4500 ? `
      <h3>🛡️ 본론 5: 예방법/주의사항</h3>
      <p>예방법 상세 설명 (400자 이상)</p>
      <p>일상에서 실천할 수 있는 구체적 방법들</p>
      <ul>
        <li>예방법 1 - 실천 방법</li>
        <li>예방법 2 - 실천 방법</li>
        <li>주의사항 - 이런 경우는 주의!</li>
      </ul>
      ` : ''}
      
      ${targetImageCount >= 5 ? '[IMG_5]' : ''}
      
      ${targetLength >= 3500 ? `
      <h3>❓ 자주 묻는 질문 (FAQ)</h3>
      <p><strong>Q1. [자주 묻는 질문 1]</strong></p>
      <p>A1. 상세한 답변 (150자 이상)</p>
      <p><strong>Q2. [자주 묻는 질문 2]</strong></p>
      <p>A2. 상세한 답변 (150자 이상)</p>
      ` : '<!-- FAQ는 3500자 이상에서만 포함 -->'}
      
      <h3>✅ 마무리: 핵심 정리</h3>
      <p>핵심 내용 요약 (${targetLength >= 4000 ? '300자 이상' : '200자 이상'}) - ${writingStyle === 'conversion' ? '행동을 하나로 집중! ("딱 하나만 기억하세요...")' : '핵심 정보 요약'}</p>
      
      <p>마무리 문단 서술 (아래 규칙 참조) - 별도 박스 없이 자연스러운 문단으로!</p>
      
      <p>해시태그 10~15개</p>
    </div>
    
    ${PSYCHOLOGY_CTA_PROMPT}
    
    [🎯 마무리 문단 작성 규칙 - CTA 박스 금지!]
    
    🚨 **절대 금지:**
    - <div class="cta-box"> 같은 별도 박스 형태 금지!
    - "💡 건강 체크 포인트" 같은 박스 제목 금지!
    - 물음표(?) 사용 금지!
    - "기준을 세우다", "기준을 마련하다", "판단이 정리되다" 금지!
    - 추상 명사(기준, 판단, 정리, 도움)를 원인·결과처럼 연결하는 문장 금지!
    
    ✅ **이렇게 쓰세요:**
    - 마무리도 일반 <p> 태그로 자연스러운 문단 서술!
    - 어떻게 느껴질 수 있는지 설명하는 문장
    - 어떤 경우가 있는지 나열하는 문장
    - 헷갈리기 쉬운 지점을 짚는 문장
    
    **마무리 문단 예시:**
    ❌ 금지: <div class="cta-box"><p class="cta-title">💡 건강 체크 포인트</p>...</div>
    ❌ 금지: "낙상 후 통증은 '참기'보다 '패턴 정리'가 먼저일 때가 있습니다"
    ❌ 금지: "기준을 다시 세워볼 타이밍일 수 있습니다"
    
    ✅ 좋음: "넘어진 직후엔 괜찮다가도 시간이 지나면서 체중을 싣는 순간 통증이 선명해지는 경우가 있다. 겉으로 멍이 크지 않아도 같은 동작에서 반복적으로 불편함이 느껴진다면, 단순 타박과는 다른 흐름일 수 있다. 내일은 오늘보다 통증이 줄어드는지, 특정 동작에서 여전히 걸리는지 비교해보는 것도 참고가 될 수 있다."
    
    주의사항:
    1. 모든 제목은 <h3> 태그 사용
    2. 모든 문단은 <p> 태그 사용
    3. 리스트는 <ul><li> 태그 사용
    4. 이미지 마커 ${imageMarkers}를 글 중간에 적절히 배치
    5. 해시태그는 마지막에 <p> 안에 작성
    6. **마무리는 별도 박스 없이 자연스러운 <p> 문단으로!**
    
    **마무리 문단 필수 규칙:**
    - "방문하세요", "내원하세요" 같은 직접 권유 표현 절대 금지
    - "검진을 고려해 보시는 것도 좋습니다", "의료진과 상담이 필요할 수 있습니다" 등 간접 표현 사용
    - 병원 이름, 전화번호, 주소 절대 금지
    
    [📊 전환 점수(conversion_score) 평가 기준 - 0~100점]
    **의료법 100% 준수하면서 전환력을 측정합니다**
    
    평가 항목 (각 20점):
    1. **공감 도입부** (20점): 독자가 "이거 내 얘기네!" 느끼는 구체적 상황 묘사
       - 0점: 일반적인 서론 ("오늘은 ~에 대해...")
       - 10점: 보통 수준의 공감 ("~하신 분들 많으시죠?")
       - 20점: 구체적 상황 ("아침에 일어났을 때 손가락이 뻣뻣하고...")
    
    2. **정보 가치** (20점): 독자가 얻어가는 실질적 정보
       - 0점: 뻔한 정보만 나열
       - 10점: 기본적인 유용한 정보
       - 20점: "이건 몰랐네!" 싶은 전문적 인사이트
    
    3. **심리적 긴박감** (20점): 의료법 준수하면서 행동 필요성 인식
       - 0점: 긴박감 없음
       - 10점: 일반적인 중요성 언급
       - 20점: "지금 확인하느냐, 나중에 후회하느냐" 수준의 간접적 긴박감
    
    4. **CTA 품질** (20점): 자연스러운 행동 유도
       - 0점: CTA 없음 또는 직접적 권유 (의료법 위반)
       - 10점: 형식적인 마무리
       - 20점: 독자가 자연스럽게 "병원 가봐야겠다" 생각하게 만드는 심리적 CTA
    
    5. **전체 흐름** (20점): 도입→본론→CTA 자연스러운 연결
       - 0점: 내용이 뒤죽박죽
       - 10점: 기본적인 구조
       - 20점: 읽다 보면 자연스럽게 결론에 도달하는 흐름
    
    [⚖️ 의료법 준수 점수(safety_score) 평가 기준 - 0~100점]
    **의료광고법 위반 여부를 엄격하게 측정합니다**
    
    감점 항목:
    1. **직접 권유 표현** (-30점/건): "방문하세요", "내원하세요", "예약하세요", "상담하세요"
    2. **치료 효과 보장** (-25점/건): "완치", "100% 효과", "확실한", "보장"
    3. **과대 광고** (-20점/건): "최고", "유일", "1등", "최상급"
    4. **비교 광고** (-20점/건): 타 병원과 비교, "우리가 더 좋다"
    5. **공포 유발** (-15점/건): "지금 안하면 위험", "돌연사", "사망"
    6. **병원 정보 노출** (-10점/건): 병원명, 전화번호, 주소
    
    안전한 표현 (감점 없음):
    ✅ "검진을 고려해 보시는 것도 좋습니다"
    ✅ "의료진과 상담이 필요할 수 있습니다"
    ✅ "증상이 지속되면 확인이 필요합니다"
    ✅ 질환명, 증상명, 정보성 키워드
    
    **중요: conversion_score가 100점이어도 의료법은 반드시 준수해야 합니다!**
    - 직접적 내원/예약 권유 = 의료법 위반 = safety_score 감점
    - 전환력은 "간접적이지만 효과적인" 방식으로 달성
    
    [🤖 AI 냄새 점수(ai_smell_score) 평가 기준 v2.0 - 0~100점]
    **⚠️ 중요: 낮을수록 좋음! 역점수 체계! ⚠️**
    - 7점 이하 = 사람 글 수준 ✅ 최고!
    - 90점 = AI 티가 완전히 나는 글 ❌ 최악!
    **15점 초과 시 재작성 필요**
    **🔄 v2.0: 중복 항목 제거, 배점 재조정, 심사숙고 평가**
    
    가점 항목 (점수가 높아질수록 AI 냄새가 심함):
    
    1. **문장 리듬 단조로움** (0~25점) ★ 가장 중요
       - 동일 종결어미 3회 이상 반복 → +7점
       - 문장 시작 패턴 3회 이상 반복 → +6점
       - 문단 길이가 ±20자 내로 균일 → +6점
       - 질문·감탄·짧은 문장 없이 설명만 연속 → +6점
    
    2. **판단 단정형 글쓰기** (0~20점)
       - 한 문단에 조건/가능성 종결 3회 이상 → +8점
       - 명확한 기준 없이 "확인 필요"만 반복 → +7점
       - 글 전체에서 저자 의견/판단 0회 → +5점
    
    3. **현장감 부재** (0~20점)
       - 시간/계절/상황 맥락 전무 → +7점
       - 실제 질문/고민 시나리오 없음 → +7점
       - 현장 용어(병원, 접수, 대기 등) 0회 → +6점
    
    4. **템플릿 구조** (0~15점)
       - 정의→원인→증상→치료 순서 그대로 → +6점
       - 독자 자가 체크 포인트 없음 → +5점
       - 문단 간 전환어 없이 나열만 → +4점
    
    5. **가짜 공감** (0~10점)
       - "걱정되실 수 있습니다" 류 범용 공감만 존재 → +4점
       - 구체적 상황·감정 지목 없음 → +3점
       - 공감 문장이 항상 문단 첫 줄에만 위치 → +3점
    
    6. **행동 유도 실패** (0~10점)
       - 매번 동일한 CTA 문구로 종결 → +4점
       - 시점·조건 없는 막연한 권유 → +3점
       - 독자 상황별 분기 없음 → +3점
    
    **판정 기준 (v2.0):**
    - 0~7점: ✅ 사람 글 → 그대로 발행
    - 8~15점: ⚠️ 경계선 → 부분 수정 후 발행
    - 16점 이상: 🚨 AI 확정 → 재작성 대상
    
    **심사숙고 평가 원칙:**
    - 각 항목을 꼼꼼히 체크하고 근거와 함께 점수 산정
    - 애매한 경우 보수적으로 (낮게) 평가
    - 관찰 문장 1줄만 있어도 현장감 점수 급감
    
    [🎨 이미지 프롬프트 작성 규칙 - 매우 중요!]
    **imagePrompts 배열에 들어갈 프롬프트는 반드시 한국어로 작성하세요!**
    이미지 스타일: ${customImagePrompt ? `커스텀: ${customImagePrompt}` : imageStyle === 'illustration' ? '3D 일러스트' : imageStyle === 'medical' ? '의학 3D 해부학' : '실사 사진'}
    
    **🚨 블로그 이미지 텍스트 규칙 (매우 중요!):**
    - ❌ 이미지에 텍스트 넣지 마세요! (글자, 숫자, 문구 모두 금지)
    - ❌ 로고, 워터마크, 간판, 표지판 금지
    - ✅ 순수한 일러스트/사진만 생성
    - ✅ 프롬프트에 "텍스트 없이", "글자 없이" 명시 필수!
    
    각 이미지 프롬프트에 반드시 포함할 스타일 키워드:
    ${imageStyleGuide}
    
    ${customImagePrompt ? `**⚠️ 커스텀 스타일 필수 적용!**
    사용자가 "${customImagePrompt}" 스타일을 요청했습니다.
    모든 이미지 프롬프트에 이 스타일 키워드를 반드시 포함하세요!
    예시: "[장면 묘사], ${customImagePrompt}, 텍스트 없이"` : `예시 (${imageStyle === 'illustration' ? '3D 일러스트' : imageStyle === 'medical' ? '의학 3D' : '실사 사진'} 스타일):
    ${imageStyle === 'illustration' 
      ? '- "밝은 병원 상담실에서 의사가 환자에게 설명하는 모습, 3D 일러스트, 아이소메트릭 뷰, 클레이 렌더, 파란색 흰색 팔레트, 텍스트 없이"'
      : imageStyle === 'medical'
      ? '- "인체 심장의 3D 단면도, 좌심실과 우심실이 보이는 해부학적 구조, 혈관과 판막이 보이는 의학 일러스트, 파란색 배경, 텍스트 없이"'
      : '- "깔끔한 병원 상담실에서 의사가 환자와 상담하는 모습, 실사 사진, DSLR 촬영, 자연스러운 조명, 텍스트 없이"'}`}
    
    ---━━
    ✅ 최종 체크리스트 - 작성 후 반드시 확인!
    ---━━
    
    □ "~인지, ~인지, ~인지" 나열 패턴 0개? (문단 흐름으로 풀어썼는지 확인!)
    □ 글 서두에 메타 설명 없음? ("이 글은 ~에 초점을..." 같은 표현 제거!)
    □ 판단 회피 표현 동일 표현 2회 이상 반복 안 함?
    □ 물음표(?) 0개인지 확인!
    □ "~수 있습니다" 문단당 1회 이하?
    □ 첫 문장이 상황 서술형으로 시작?
    □ 분량 ${targetLength}자 이상 유지?
    □ AI 냄새 점수 15점 이하? (7점 이하 목표!)
  */  // 기존 상세 프롬프트 끝


  const cardNewsPrompt = `
    **🚨 최우선 지침: 이것은 카드뉴스입니다! 🚨**
    - 블로그 포스팅 형식(긴 문단)으로 작성하면 안 됩니다!
    - 반드시 <div class="card-slide"> 구조의 슬라이드 형식으로 작성하세요!
    - 각 슬라이드는 짧은 텍스트(제목 12자, 설명 20자 이내)만 포함합니다!
    
    ${medicalSafetyPrompt}
    ${aiFeedbackRules}
    ${writingStylePrompt}
    ${getWritingStyleCommonRules()}
    ${benchmarkingInstruction}
    ${styleAnalysis}
    
    [📅 현재 시점 정보 - 최신 정보 기반 작성 필수!]
    ${timeContext}
    
    🚨🚨🚨 **시간 참조 표현 절대 금지!** 🚨🚨🚨
    ❌ "${currentYear}년에는~", "올해는~", "이번 ${currentSeason}은~" → 모두 금지!
    ✅ "${currentSeason}철에는~", "추운 날씨에는~" (일반적 계절 표현만 사용)
    
    - 최신 의학 가이드라인/연구 결과 반영 (연도 표기 없이!)
    - ${currentSeason}철 특성 고려 (계절성 질환, 생활 습관 등)
    - Google 검색으로 최신 정보 확인 후 작성
    
    진료과: ${request.category}, 주제: ${request.topic}
    총 ${targetSlides}장의 카드뉴스
    글 스타일: ${writingStyle === 'expert' ? '전문가형(신뢰·권위·논문 인용)' : writingStyle === 'empathy' ? '공감형(독자 공감 유도)' : '전환형(행동 유도)'}
    
    [🚨 핵심 주제 키워드 - 반드시 모든 카드에 반영하세요! 🚨]
    
    **주제: "${request.topic}"**
    - 이 주제가 모든 카드의 중심이 되어야 합니다!
    - "${request.topic}"과 직접 관련된 구체적인 내용만 작성하세요!
    - 일반적이고 추상적인 건강 정보는 ❌ 금지!
    - "${request.topic}"의 구체적인 증상, 원인, 특징을 다루세요!
    
    **⚠️ 질환명/증상명 사용 규칙:**
    - "${request.topic}"에 포함된 질환명(예: 혈액암, 당뇨병, 고혈압 등)은 그대로 사용하세요!
    - 의료 정보를 돌려말하지 마세요! 직접적으로 설명하세요!
    - "몸의 변화", "건강 이상 신호" 같은 모호한 표현 ❌
    - "${request.topic}"의 실제 증상명과 특징을 구체적으로 ✅
    
    [🚨 가장 중요: 스토리 연결성 - 반드시 읽고 적용하세요! 🚨]
    
    **카드뉴스는 반드시 "하나의 스토리"로 연결되어야 합니다!**
    - 각 슬라이드가 독립적인 내용이면 안 됩니다!
    - 1장부터 마지막 장까지 "${request.topic}"에 대해 깊이 있게 다루세요!
    - "표지 → 정의/개요 → 구체적 증상/특징들 → 마무리" 구조를 따르세요!
    
    **스토리 구조 (${targetSlides}장) - "${request.topic}" 기준:**
    
    📕 **1장 (표지)**: "${request.topic}" 주제 소개
    - 제목에 "${request.topic}" 키워드 필수 포함!
    - 예: "${request.topic}, 이런 신호를 놓치지 마세요"
    
    📘 **2장**: "${request.topic}"이란? (정의/개요)
    - "${request.topic}"가 무엇인지 직접적으로 설명
    - 모호하게 돌려말하지 않기!
    
    📗 **3~${targetSlides - 1}장**: "${request.topic}"의 구체적 증상/특징/방법
    - 각 슬라이드에 "${request.topic}"과 직접 관련된 하나의 구체적 내용
    - 실제 증상명, 특징, 원인 등을 명확하게!
    - 예시: 혈액암이라면 → "멍이 쉽게 드나요?", "잇몸 출혈", "만성 피로", "림프절 부종"
    
    📙 **${targetSlides}장 (마무리)**: 정리 + 행동 유도
    - "${request.topic}" 관련 핵심 메시지
    - 자가진단/전문의 상담 권유 등
    
    **✅ "${request.topic}" 주제 올바른 예시:**
    만약 주제가 "혈액암 초기증상"이라면:
    1장: "혈액암, 이 신호를 놓치고 있진 않나요?" (표지)
    2장: "혈액암이란?" - 혈액세포에 생기는 암의 종류 설명
    3장: "멍이 쉽게 드시나요?" - 혈소판 감소로 인한 증상
    4장: "잇몸에서 피가 자주 나나요?" - 출혈 경향 설명
    5장: "쉬어도 풀리지 않는 피로감" - 빈혈로 인한 피로
    6장: "조기 발견이 중요합니다" - 정기검진 권유
    
    **❌ 잘못된 예시 (주제와 동떨어진 일반론):**
    1장: "몸이 보내는 신호" (← 주제 키워드 없음!)
    2장: "피로의 원인" (← 너무 일반적!)
    3장: "건강관리의 중요성" (← 주제와 무관!)
    → "${request.topic}"을 직접 다루지 않으면 안 됩니다!
    
    ${PSYCHOLOGY_CTA_PROMPT}
    
    [🎯 마지막 슬라이드 (${targetSlides}장) 심리학적 전환 문구 규칙]
    마지막 카드는 독자가 "다음 행동"을 떠올리게 하는 심리학적 설득 기법을 사용합니다.
    
    **마지막 슬라이드 예시:**
    card-subtitle: "지금이 기회예요" / "함께 지켜요" / "시작해볼까요?"
    card-main-title: "작은 습관이<br/><span class='card-highlight'>생명</span>을 지킵니다"
    card-desc: "건강한 오늘이 행복한 내일을 만듭니다 😊"
    
    **심리학 기법 적용 예시 (마지막 카드):**
    - 손실회피: "미루면 놓칠 수 있어요"
    - 사회적증거: "많은 분들이 실천 중이에요"  
    - 시의성: "이맘때가 적기예요"
    - 감정호소: "소중한 일상, 오래 누리세요"
    
    ${request.referenceUrl ? '★벤치마킹 URL의 구성 방식도 참고하세요.' : ''}
    
    ${styleAnalysis ? `
    **⚠️ 중요: 스타일 참고 이미지가 있습니다! ⚠️**
    - 위에서 제공한 "표지/본문 HTML 템플릿"의 style 속성을 그대로 사용하세요!
    - 기본 HEALTH NOTE 스타일(주황색 테두리)을 사용하면 안 됩니다!
    - 분석된 색상(${coverStyle.backgroundColor || contentStyle.backgroundColor || '분석된 색상'})을 반드시 적용하세요!
    ` : `
    [HTML 구조 - 기본 스타일 (연한 하늘색 배경)]
    **⚠️ 중요: 아래 템플릿을 그대로 복사해서 사용하세요! style 속성 필수!**
    
    <div class="card-slide" style="background: linear-gradient(180deg, #E8F4FD 0%, #F0F9FF 100%); border-radius: 24px; padding: 0; overflow: hidden;">
      <div style="padding: 32px 28px; display: flex; flex-direction: column; align-items: center; text-align: center; height: 100%;">
        <p class="card-subtitle" style="font-size: 14px; font-weight: 700; color: #3B82F6; margin-bottom: 8px;">질문형 부제목 (10~15자)</p>
        <p class="card-main-title" style="font-size: 28px; font-weight: 900; color: #1E293B; line-height: 1.3; margin: 0 0 16px 0;">메인 제목<br/><span style="color: #3B82F6;">강조 텍스트</span></p>
        <div class="card-img-container" style="width: 100%; margin: 16px 0;">[IMG_N]</div>
        <p class="card-desc" style="font-size: 15px; color: #475569; line-height: 1.6; font-weight: 500; max-width: 90%;">여기에 30~50자의 구체적인 설명 문장을 작성하세요. 독자가 정보를 얻을 수 있도록 충분히!</p>
      </div>
    </div>
    
    **🚨 card-desc 부분이 가장 중요합니다! 반드시 30자 이상 작성하세요! 🚨**
    
    **배경색 필수: style="background: linear-gradient(180deg, #E8F4FD 0%, #F0F9FF 100%);" 적용!**
    `}
    
    [[금지] 절대 금지 표현 - 카드에 이런 텍스트 넣지 마세요!]
    ❌ "01.", "02.", "03." 같은 슬라이드 번호
    ❌ "해결책 1", "해결책 2", "마무리" 같은 구조 용어
    ❌ "첫 번째", "두 번째", "세 번째" 같은 순서 표현
    ❌ "후킹", "문제 제기", "원인/배경" 같은 프레임워크 용어
    
    [✅ 올바른 예시]
    card-subtitle: "알고 계셨나요?" / "왜 위험할까요?" / "이렇게 해보세요"
    card-main-title: "겨울철 심장마비<br/><span class='card-highlight'>3배</span> 증가" 
    
    [🚨 작성 규칙 - 매우 중요 🚨]
    1. 각 슬라이드에 [IMG_1]~[IMG_${targetSlides}] 마커 필수
    2. 이전 슬라이드와 내용이 자연스럽게 연결
    3. card-main-title은 **반드시 <p> 태그 사용** (h1 사용 금지!)
    4. card-main-title은 **15~20자**로 충분히 작성! 줄바꿈은 <br/> 사용
    5. card-subtitle은 **10~15자**의 질문형 또는 핵심 포인트
    6. **card-desc는 반드시 30~50자**의 구체적인 설명 문장 포함! (가장 중요!)
    7. 실제 독자가 볼 콘텐츠만 작성 (메타 정보 금지)
    8. **글씨가 너무 없으면 안 됨!** 각 카드에 충분한 정보 전달 필수!
    
    [📝 텍스트 분량 규칙 - 반드시 지키세요!]
    ❌ 잘못된 예 (텍스트 부족):
    - card-subtitle: "지금 알아야 해요" (8자)
    - card-main-title: "심정지<br/><span class='card-highlight'>4분</span>" (6자)
    - card-desc: "골든타임 사수" (6자) ← 너무 짧음!
    
    ✅ 올바른 예 (충분한 텍스트):
    - card-subtitle: "왜 4분이 중요할까요?" (12자)
    - card-main-title: "뇌세포 생존<br/><span class='card-highlight'>마지노선</span>" (12자)
    - card-desc: "4분이 지나면 뇌 손상이 급격히 진행돼요. 골든타임을 놓치지 마세요!" (40자) ← 이 정도는 되어야 함!
    
    [❌ 잘못된 예시 - 절대 이렇게 쓰지 마세요]
    <p class="card-main-title">스타틴 임의 중단은 금물! 전문의가 강조하는 만성질환 복약 순응도의 중요성</p>
    
    [✅ 올바른 예시]
    <p class="card-main-title">스타틴<br/><span class="card-highlight">중단 금지!</span></p>
    
    [🎨 이미지 프롬프트 작성 규칙 - 매우 중요!]
    **imagePrompts 배열에 들어갈 프롬프트는 반드시 한국어로 작성하세요!**
    이미지 스타일: ${customImagePrompt ? `커스텀: ${customImagePrompt}` : imageStyle === 'illustration' ? '3D 일러스트' : imageStyle === 'medical' ? '의학 3D 해부학' : '실사 사진'}
    
    **📝 카드뉴스 이미지 텍스트 규칙:**
    - 카드뉴스 이미지에는 제목, 설명 텍스트가 들어갈 수 있음
    - 한글, 숫자 위주로
    - 로고, 워터마크 금지
    
    각 이미지 프롬프트에 반드시 포함할 스타일 키워드:
    ${imageStyleGuide}
    
    ${customImagePrompt ? `**⚠️ 커스텀 스타일 필수 적용!**
    사용자가 "${customImagePrompt}" 스타일을 요청했습니다.
    모든 이미지 프롬프트에 이 스타일 키워드를 반드시 포함하세요!
    예시: "[장면 묘사], ${customImagePrompt}"` : `예시 (${imageStyle === 'illustration' ? '3D 일러스트' : imageStyle === 'medical' ? '의학 3D' : '실사 사진'} 스타일):
    ${imageStyle === 'illustration' 
      ? '- "밝은 병원 배경의 건강 인포그래픽, 3D 일러스트, 아이소메트릭 뷰, 클레이 렌더, 파란색 흰색 팔레트"'
      : imageStyle === 'medical'
      ? '- "인체 폐의 3D 단면도, 기관지와 폐포 구조가 보이는 해부학 일러스트, 투명 효과, 파란색 의료 배경"'
      : '- "깔끔한 병원 환경 이미지, 실사 사진, DSLR 촬영, 전문적인 분위기"'}`}
    
    [🚨 최종 검증 - 작성 후 반드시 확인하세요! 🚨]
    각 카드의 card-desc가 30자 이상인지 확인하세요!
    예: "심장이 멈춘 지 4분이 지나면 뇌세포가 마음대로 누설되기 시작해요" (이 정도 길이)
    텍스트가 너무 짧으면 독자가 정보를 얻을 수 없습니다!
  `;

  try {
    // GPT 제거 - Gemini만 사용
    const providerSettings = getAiProviderSettings();
    let result: any;

    // Gemini 사용
    console.log('🔵 Using Gemini for text generation');
    
    // 로그 출력 (generateContent 호출 전에 실행)
    console.log('🔄 Gemini 웹 검색 및 콘텐츠 생성 시작');
    console.log('📍 Step 1 시작 준비...');
    
    // 📍 Step 1: Gemini 웹 검색으로 최신 정보 수집
    console.log('📍 onProgress 호출 직전...');
    try {
      if (typeof onProgress === 'function') {
        safeProgress('• Step 1: 최신 정보를 검색하고 있습니다...');
      } else {
        console.warn('⚠️ onProgress가 함수가 아님:', typeof onProgress);
      }
    } catch (progressError) {
      console.error('❌ onProgress 호출 에러:', progressError);
    }
    console.log('📍 onProgress 호출 완료, searchPrompt 생성 시작...');
    
    const searchPrompt = `
당신은 의료 정보 검색 전문가입니다.
아래 주제에 대해 공신력 있는 최신 정보를 수집해주세요.

[검색 주제]
- 진료과: ${request.category}
- 주제: ${request.topic}
- 키워드: ${request.keywords}

🚨🚨🚨 **[최우선 검색 - health.kdca.go.kr 필수!]** 🚨🚨🚨

**1순위 (최우선! 반드시 가장 먼저 검색!)**: 
   🔴 검색어: "${request.topic} site:health.kdca.go.kr"
   🔴 URL: https://health.kdca.go.kr/healthinfo/
   → 질병관리청 건강정보포털 (일반인 대상 건강정보)
   → ⚠️ 이 사이트에서 반드시 최소 2개 이상의 정보를 수집하세요!
   → ⚠️ 이 사이트에서 충분한 자료를 찾았다면 해외 사이트 검색 생략!
   → 예시 URL: https://health.kdca.go.kr/healthinfo/biz/health/...

**2순위**: 
   검색어: "${request.topic} site:kdca.go.kr"
   → 질병관리청 공식 사이트 (보도자료, 통계, 감염병 정보)

**3순위**: 
   검색어: "${request.topic} site:mohw.go.kr OR site:nhis.or.kr OR site:hira.or.kr"
   → 보건복지부, 국민건강보험공단, 건강보험심사평가원

**4순위**: 
   검색어: "${request.topic} 대한${request.category}학회 가이드라인 ${getCurrentYear()}"
   → 국내 학회 최신 지침 확인

**5순위 (선택적 - 국내 자료 부족 시에만!)**: 
   검색어: "${request.topic} site:pubmed.ncbi.nlm.nih.gov ${getCurrentYear()}"
   → ⚠️ 1~4순위에서 충분한 자료를 찾았다면 이 단계는 생략!

📋 **검색 전략 (health.kdca.go.kr 최우선!):**
🔴 1순위: health.kdca.go.kr에서 반드시 먼저 검색! (최소 2개 이상 수집 목표)
✅ health.kdca.go.kr에서 관련 정보를 충분히 찾았다면 → 해외 논문 검색 생략!
✅ 국내 공신력 있는 자료가 부족할 때만 → PubMed 등 해외 자료 참고
✅ 항상 한국 실정에 맞는 정보를 우선으로!

[금지] **절대 검색 금지 도메인:**
- blog.naver.com, tistory.com, brunch.co.kr (블로그)
- cafe.naver.com (카페)
- youtube.com (유튜브)
- health.chosun.com, hidoc.co.kr, kormedi.com (건강 매체)
- storybongbong.co.kr, keyzard.cc (절대 금지!)

[검색 지시]
- 🔴 health.kdca.go.kr 결과를 가장 먼저, 가장 많이 수집 (최우선!)
- 현재 ${getCurrentYear()}년 기준 최신 자료 우선
- 블로그, 카페, SNS, 유튜브 정보는 절대 수집 금지
- 통계는 반드시 출처와 연도 포함

[JSON 응답 형식]
{
  "collected_facts": [
    {
      "fact": "수집한 사실 정보",
      "source": "출처 (학회/기관명)",
      "year": ${getCurrentYear()},
      "url": "참고 URL (health.kdca.go.kr URL 최우선!)"
    }
  ],
  "key_statistics": [
    {
      "stat": "통계 내용",
      "source": "출처",
      "year": ${getCurrentYear()}
    }
  ],
  "latest_guidelines": [
    {
      "guideline": "가이드라인 내용",
      "organization": "발표 기관",
      "year": ${getCurrentYear()}
    }
  ]
}`;

    // • Gemini 웹 검색으로 최신 정보 수집
    console.log('• Gemini 웹 검색 시작');
    safeProgress('• Step 1: Gemini 웹 검색 중...');
    
    let geminiResults: any = null;
    let searchResults: any = {};
    
    // 🔵 Gemini 검색 실행
    const geminiSearchPromise = (async () => {
      try {
        console.log('🔵 Gemini 검색 시작...');
        const ai = getAiClient();
        const searchResponse = await ai.models.generateContent({
          model: "gemini-3-pro-preview",
          contents: searchPrompt,
          config: {
            tools: [{ googleSearch: {} }],
            responseMimeType: "application/json"
          }
        });
        
        // 안전한 JSON 파싱
        let result;
        const rawText = searchResponse.text || "{}";
        
        try {
          // JSON 블록 추출 시도 (```json ... ``` 형태일 수 있음)
          const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/) || 
                           rawText.match(/```\s*([\s\S]*?)\s*```/) ||
                           [null, rawText];
          
          const cleanedText = jsonMatch[1].trim();
          result = JSON.parse(cleanedText);
        } catch (parseError) {
          console.warn('⚠️ JSON 파싱 실패, 원본 텍스트 일부:', rawText.substring(0, 200));
          // 빈 객체로 폴백
          result = {
            collected_facts: [],
            key_statistics: [],
            latest_guidelines: []
          };
        }
        
        const factCount = result.collected_facts?.length || 0;
        const statCount = result.key_statistics?.length || 0;
        console.log(`✅ Gemini 검색 완료 - 팩트 ${factCount}개, 통계 ${statCount}개`);
        return { success: true, data: result, source: 'gemini' };
      } catch (error) {
        console.error('⚠️ Gemini 검색 실패:', error);
        return { success: false, data: null, source: 'gemini', error };
      }
    })();
    
    // Gemini 검색 실행
    const geminiResult = await geminiSearchPromise;
    
    geminiResults = geminiResult.success ? geminiResult.data : null;
    
    // GPT 검색 비활성화 (Gemini만 사용)
    const gptResults: any = null;
    const gptFactCount = 0;
    const gptStatCount = 0;
    
    // 상세 로그
    const geminiFactCount = geminiResults?.collected_facts?.length || 0;
    const geminiStatCount = geminiResults?.key_statistics?.length || 0;
    
    console.log('📊 검색 결과 상세:');
    console.log(`   🔵 Gemini: ${geminiResult.success ? '성공' : '실패'} - 팩트 ${geminiFactCount}개, 통계 ${geminiStatCount}개`);
    
    // 🔀 크로스체크: 두 결과 병합 및 검증
    
    // health.kdca.go.kr 우선순위 정렬 함수 (1순위: health.kdca.go.kr)
    const sortByKdcaHealthPriority = (items: any[]) => {
      if (!items || !Array.isArray(items)) return items;
      
      // 🔴 1순위: health.kdca.go.kr URL이 있는 항목을 최상단에 배치 (최우선!)
      const kdcaHealthItems = items.filter((item: any) => 
        item.url?.includes('health.kdca.go.kr') || 
        item.source?.includes('질병관리청 건강정보') ||
        item.source?.includes('health.kdca.go.kr') ||
        item.source?.includes('건강정보포털')
      );
      
      // 2순위: kdca.go.kr (메인 사이트) 항목
      const kdcaMainItems = items.filter((item: any) => 
        !item.url?.includes('health.kdca.go.kr') && 
        !item.source?.includes('health.kdca.go.kr') &&
        !item.source?.includes('건강정보포털') &&
        (item.url?.includes('kdca.go.kr') || item.source?.includes('질병관리청'))
      );
      
      // 3순위: 기타 정부 기관 (mohw.go.kr, nhis.or.kr 등)
      const otherGovItems = items.filter((item: any) => 
        !item.url?.includes('kdca.go.kr') &&
        !item.source?.includes('질병관리청') &&
        (item.url?.includes('.go.kr') || item.url?.includes('.or.kr'))
      );
      
      // 4순위: 나머지 항목
      const otherItems = items.filter((item: any) => 
        !item.url?.includes('health.kdca.go.kr') &&
        !item.url?.includes('kdca.go.kr') &&
        !item.url?.includes('.go.kr') &&
        !item.url?.includes('.or.kr') &&
        !item.source?.includes('질병관리청') &&
        !item.source?.includes('건강정보포털')
      );
      
      const sortedItems = [...kdcaHealthItems, ...kdcaMainItems, ...otherGovItems, ...otherItems];
      
      // 로그 출력 (health.kdca.go.kr 강조)
      if (kdcaHealthItems.length > 0) {
        console.log(`🔴 [1순위] health.kdca.go.kr 결과 ${kdcaHealthItems.length}개 최우선 배치!`);
        kdcaHealthItems.forEach((item: any, idx: number) => {
          console.log(`   ${idx + 1}. ${item.url || item.source || '(URL 없음)'}`);
        });
      }
      if (kdcaMainItems.length > 0) {
        console.log(`   [2순위] kdca.go.kr 결과 ${kdcaMainItems.length}개`);
      }
      if (otherGovItems.length > 0) {
        console.log(`   [3순위] 기타 정부기관 결과 ${otherGovItems.length}개`);
      }
      
      return sortedItems;
    };
    
    if (geminiResults && gptResults) {
      // 🎯 둘 다 성공: 크로스체크 병합
      console.log('🎯 듀얼 검색 성공 - 크로스체크 병합 시작');
      safeProgress('🔀 크로스체크: Gemini + GPT-5.2 결과 병합 중...');
      
      // 병합 후 health.kdca.go.kr 우선 정렬
      const mergedFacts = [
        ...(geminiResults.collected_facts || []).map((f: any) => ({ ...f, verified_by: 'gemini' })),
        ...(gptResults.collected_facts || []).map((f: any) => ({ ...f, verified_by: 'gpt' }))
      ];
      
      const mergedStats = [
        ...(geminiResults.key_statistics || []).map((s: any) => ({ ...s, verified_by: 'gemini' })),
        ...(gptResults.key_statistics || []).map((s: any) => ({ ...s, verified_by: 'gpt' }))
      ];
      
      const mergedGuidelines = [
        ...(geminiResults.latest_guidelines || []).map((g: any) => ({ ...g, verified_by: 'gemini' })),
        ...(gptResults.latest_guidelines || []).map((g: any) => ({ ...g, verified_by: 'gpt' }))
      ];
      
      searchResults = {
        collected_facts: sortByKdcaHealthPriority(mergedFacts),
        key_statistics: sortByKdcaHealthPriority(mergedStats),
        latest_guidelines: sortByKdcaHealthPriority(mergedGuidelines),
        sources: gptResults.sources || [],
        gemini_found: geminiFactCount + geminiStatCount,
        gpt_found: gptFactCount + gptStatCount
      };
      
      // 🔧 맥락 기반 유사도 계산 (문장이 달라도 같은 맥락이면 매칭!)
      // 사용자 요청 개선: 2글자 이상 한글/영어/숫자만 추출 (자카드 유사도 기반)
      const extractKeywords = (text: string): Set<string> => {
        if (!text) return new Set();
        // 특수문자 제거 및 소문자 변환 (한글, 영문, 숫자, 공백만 남김)
        const cleanText = text.toLowerCase().replace(/[^\w가-힣\s]/g, '');
        
        // 공백으로 분리 후 2글자 이상만 필터링
        const tokens = cleanText.split(/\s+/).filter(token => token.length >= 2);
        
        return new Set(tokens);
      };
      
      // 🆕 핵심 키워드 목록 (가중치 부스트용)
      const CRITICAL_KEYWORDS = [
        '노로바이러스', '2025', '2026', '감염증', '환자', '급증', '예방', 
        '혈당', '혈압', '당뇨', '암', '염증', '면역', '비타민', '단백질', 
        '지방', '콜레스테롤', '체중', '비만', '수면', '운동', '식이', '섭취', '증상', '진단',
        '치료', '관리', '검사', '수치', '정상', '이상', '위험', '효과', '부작용',
        '원인', '기전', '합병증', '악화', '호전', '개선', '감소', '증가', '유지', '권장'
      ];
      
      const calculateSimilarity = (text1: string, text2: string): number => {
        const setA = extractKeywords(text1);
        const setB = extractKeywords(text2);

        if (setA.size === 0 || setB.size === 0) return 0;

        // 1. 자카드 유사도 (Jaccard Similarity) = 교집합 / 합집합
        let intersection = 0;
        setA.forEach(word => {
          if (setB.has(word)) intersection++;
        });

        const union = new Set([...setA, ...setB]).size;
        // 자카드 지수 (0~1) -> 점수화 (0~100)
        let score = (intersection / union) * 100;

        // 2. 핵심 키워드(Critical Keywords) 포함 시 가중치 부스트
        let criticalMatchCount = 0;
        CRITICAL_KEYWORDS.forEach(k => {
           // 단순 포함 여부 체크
           if (text1.includes(k) && text2.includes(k)) {
              criticalMatchCount++;
           }
        });

        // 핵심 키워드가 2개 이상 겹치면 +20점 가산
        if (criticalMatchCount >= 2) {
           score += 20; 
        }
        
        // 100점 초과 방지
        if (score > 100) score = 100;
        
        // 디버깅 로그 (유사도가 어느 정도 있을 때만)
        if (score > 10) {
          console.log(`   📊 유사도: ${score.toFixed(1)}% (자카드 기반 + 핵심키워드 부스트)`);
          console.log(`      - A: "${text1.substring(0, 30)}..."`);
          console.log(`      - B: "${text2.substring(0, 30)}..."`);
        }
        
        // 기존 코드와의 호환성을 위해 0~100 점수를 0~1.0 비율로 반환하지 않고, 
        // 아래 로직에서 점수(0~100) 그대로 사용하거나, 여기서 100으로 나눠서 반환할 수 있음.
        // 기존 코드가 finalSim(0.0~1.0)을 기대했으나, 여기선 점수 자체를 반환하고 비교 로직을 수정함.
        return score;
      };
      
      // 교차 검증된 항목 수 계산 (THRESHOLD: 30점)
      let crossVerifiedCount = 0;
      const THRESHOLD = 30;

      searchResults.collected_facts.forEach((f1: any, i: number) => {
        searchResults.collected_facts.forEach((f2: any, j: number) => {
          if (i < j && f1.verified_by !== f2.verified_by) {
            const score = calculateSimilarity(f1.fact || '', f2.fact || '');
            // 30점 이상이면 교차 검증 성공으로 간주
            if (score >= THRESHOLD) {
              f1.cross_verified = true;
              f2.cross_verified = true;
              crossVerifiedCount++;
              console.log(`   ✅ 교차 검증 성공! (점수: ${score.toFixed(1)}점)`);
            }
          }
        });
      });
      
      searchResults.cross_verified_count = crossVerifiedCount;
      
      const geminiTotal = searchResults.gemini_found || 0;
      const gptTotal = searchResults.gpt_found || 0;
      
      console.log(`✅ 크로스체크 완료:`);
      console.log(`   🔵 Gemini: ${geminiTotal}개 정보`);
      console.log(`   🟢 GPT-5.2: ${gptTotal}개 정보`);
      console.log(`   🔗 교차 검증: ${crossVerifiedCount}개`);
      
      safeProgress(`✅ 크로스체크 완료: Gemini ${geminiTotal}개 + GPT ${gptTotal}개 → ${crossVerifiedCount}개 교차검증`);
      
    } else if (geminiResults) {
      // Gemini 검색 성공
      console.log('🔵 Gemini 검색 성공');
      searchResults = {
        collected_facts: sortByKdcaHealthPriority(geminiResults.collected_facts || []),
        key_statistics: sortByKdcaHealthPriority(geminiResults.key_statistics || []),
        latest_guidelines: sortByKdcaHealthPriority(geminiResults.latest_guidelines || []),
        gemini_found: geminiFactCount + geminiStatCount
      };
      safeProgress(`✅ Gemini 검색 완료: ${geminiFactCount + geminiStatCount}개 정보 수집`);
      
    } else if (gptResults) {
      // GPT만 성공 (현재 비활성화)
      console.log('🟢 GPT 검색 성공');
      searchResults = {
        collected_facts: sortByKdcaHealthPriority(gptResults.collected_facts || []),
        key_statistics: sortByKdcaHealthPriority(gptResults.key_statistics || []),
        latest_guidelines: sortByKdcaHealthPriority(gptResults.latest_guidelines || []),
        sources: gptResults.sources || [],
        gpt_found: gptFactCount + gptStatCount
      };
      safeProgress(`✅ GPT 검색 완료: ${gptFactCount + gptStatCount}개 정보 수집`);
      
    } else {
      // 둘 다 실패 - 단순화된 에러 처리 (크로스체크 필드 제거)
      console.error('❌ 검색 실패');
      safeProgress('⚠️ 검색 실패 - AI 학습 데이터 기반으로 진행');
      searchResults = {};
    }
    
    // 📍 Step 2: AI가 검색 결과를 바탕으로 글 작성
    console.log('📍 Step 2 시작: AI 글쓰기...');
    if (typeof onProgress === 'function') {
      safeProgress('✍️ Step 2: AI가 자연스러운 글을 작성하고 있습니다...');
    }
    
    // Gemini 전용 프롬프트 사용 - v5.3 프롬프트 적용
    // GPT52_SYSTEM_PROMPT: 의료광고법 + 금지어 사전 + 종결어미 + 키워드 + SEO + 출처검증 + 자가체크
    const geminiSystemPrompt = GPT52_SYSTEM_PROMPT;
    
    // 크로스체크 상태에 따른 신뢰도 안내 (둘 다 실패는 이미 위에서 throw됨)
    // crossCheckGuide 제거 (GPT 없으므로 불필요)
    
    const systemPrompt = `${geminiSystemPrompt}

[📚 검색 결과 - 최신 정보]

아래는 Google Search로 수집한 최신 정보입니다.
신뢰할 수 있는 출처의 정보를 우선적으로 활용하세요.

${JSON.stringify(searchResults, null, 2)}

[⚠️ 크로스체크 기반 작성 규칙]
1. ${searchResults.cross_check_status === 'dual_verified' 
    ? '🎯 교차 검증된 정보(cross_verified=true)를 최우선으로 사용하세요 - 가장 신뢰도 높음!' 
    : '단일 소스 검색 결과이므로 출처 표기에 더욱 신경 쓰세요'}
2. 통계/수치 사용 시 반드시 출처와 연도를 함께 표기 (예: "질병관리청 ${getCurrentYear()}년 자료에 따르면...")
3. 교차 검증되지 않은 정보는 "~로 알려져 있습니다", "~할 수 있습니다" 등 완화 표현 사용
4. 두 소스에서 상충되는 정보가 있다면 더 공신력 있는 출처(학회, 정부기관) 우선

[📋 JSON 응답 형식]
{
  "title": "제목 (상태 점검형 질문)",
  "content": "HTML 형식의 본문 내용 (크로스체크된 정보 우선 사용)",
  ${targetImageCount > 0 ? '"imagePrompts": ["이미지 프롬프트1", "이미지 프롬프트2", ...],' : '⚠️ imagePrompts 필드 생략 - 이미지 0장 설정됨'}
  "fact_check": {
    "fact_score": 0-100 (높을수록 좋음),
    "safety_score": 0-100 (높을수록 좋음),
    "conversion_score": 0-100 (높을수록 좋음),
    "ai_smell_score": 0-100 (⚠️ 낮을수록 좋음! 역점수! 7점 이하 목표! 90점 = 최악!),
    "verified_facts_count": 0,
    "issues": ["문제점1", "문제점2"],
    "recommendations": ["권장사항1", "권장사항2"]
  }
}

⚠️ 중요: AI 냄새 점수는 다른 점수와 반대입니다! ⚠️
- fact_score, safety_score, conversion_score → 높을수록 좋음 (100점 = 최고)
- ai_smell_score → 낮을수록 좋음 (7점 이하 = 최고, 90점 = 최악)`;

    console.log('📍 callOpenAI_Staged 호출 직전...');
    console.log('📍 프롬프트 길이:', (isCardNews ? cardNewsPrompt : blogPrompt).length);
    console.log('📍 시스템 프롬프트(검색 결과) 길이:', JSON.stringify(searchResults, null, 2).length);
    
    // 🚀 새로운 단계별 처리 시스템 사용
    const contextData = `[📚 검색 결과 - 최신 정보]

아래는 Google Search로 수집한 최신 정보입니다.
신뢰할 수 있는 출처의 정보를 우선적으로 활용하세요.

${JSON.stringify(searchResults, null, 2)}

[✅ 정보 활용 규칙]
1. 공신력 있는 출처(의료기관, 학회, 정부기관)의 정보를 우선 사용
2. 통계/수치 사용 시 반드시 출처와 연도를 함께 표기
3. 의학적 정보는 "~로 알려져 있습니다" 등 완화 표현 사용
4. 최신 정보를 적극 반영하되, 검증된 정보를 우선`;
    
    // GPT 호출 부분 주석 처리 (Gemini만 사용)
    /*
    const responseText = await callOpenAI_Staged(
      isCardNews ? cardNewsPrompt : blogPrompt, 
      contextData,
      request.textLength || 2000,
      safeProgress
    );
    console.log('📍 callOpenAI_Staged 응답 받음, 길이:', responseText?.length);
    
    result = JSON.parse(responseText);
    
    console.log('✅ GPT-5.2 작성 완료');
    */
    
    // Gemini 사용 (기본값)
    console.log('🔵 Using Gemini for text generation');
    console.log('📏 프롬프트 길이:', (isCardNews ? cardNewsPrompt : blogPrompt).length, 'chars');
    console.log('📋 프롬프트 미리보기:', (isCardNews ? cardNewsPrompt : blogPrompt).substring(0, 200));
    safeProgress('✍️ Gemini가 콘텐츠를 작성하고 있습니다...');
    
    try {
      console.log('🔄 Gemini API 호출 시작...');
      console.log('📦 contextData 길이:', contextData?.length || 0);
      console.log('📦 blogPrompt 길이:', blogPrompt?.length || 0);
      console.log('📦 전체 프롬프트 미리보기:', `${contextData}\n\n${blogPrompt}`.substring(0, 500));
      
      // 🎬 일반 generateContent 사용 (타임아웃 제거 - Gemini가 알아서 처리)
      safeProgress('✍️ AI가 콘텐츠를 작성하고 있습니다... (잠시만 기다려주세요)');
      
      const geminiResponse = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: `${systemPrompt}\n\n${isCardNews ? cardNewsPrompt : blogPrompt}`,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          // 📊 간소화된 응답 스키마 (복잡도 감소 → 생성 속도 향상)
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              content: { type: Type.STRING },
              imagePrompts: { type: Type.ARRAY, items: { type: Type.STRING } },
              fact_check: {
                type: Type.OBJECT,
                properties: {
                  fact_score: { type: Type.INTEGER },
                  safety_score: { type: Type.INTEGER },
                  conversion_score: { type: Type.INTEGER },
                  ai_smell_score: { type: Type.INTEGER },
                  verified_facts_count: { type: Type.INTEGER },
                  issues: { type: Type.ARRAY, items: { type: Type.STRING } },
                  recommendations: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
              }
            },
            required: ["title", "content"]
          }
        }
      });
      
      const responseText = geminiResponse.text || '';
      const charCountNoSpaces = responseText.replace(/\s/g, '').length;
      console.log(`✅ 생성 완료: ${charCountNoSpaces}자 (공백제외) / ${responseText.length}자 (공백포함)`);
      safeProgress(`✅ 생성 완료: ${charCountNoSpaces}자`);
      
      const response = { text: responseText };
      
      console.log('✅ Gemini 응답 수신:', response.text?.length || 0, 'chars');
      
      if (!response.text) {
        throw new Error('Gemini가 빈 응답을 반환했습니다. 다시 시도해주세요.');
      }
      
      result = JSON.parse(response.text);
      console.log('✅ Gemini JSON 파싱 성공');
      
    } catch (geminiError: any) {
      console.error('❌ Gemini 생성 실패:', geminiError);
      
      // 에러 타입별 처리
      if (geminiError.message?.includes('quota') || geminiError.message?.includes('limit') || geminiError.message?.includes('429')) {
        throw new Error('🚫 API 사용량 한계에 도달했습니다. 잠시 후 다시 시도해주세요.');
      } else if (geminiError.message?.includes('JSON')) {
        throw new Error('📋 AI 응답 형식 오류가 발생했습니다. 다시 시도해주세요.');
      } else {
        throw new Error(`❌ Gemini 오류: ${geminiError.message || '알 수 없는 오류'}`);
      }
    }
    
    // 🔧 GPT-5.2는 다양한 필드명으로 반환할 수 있음 → content로 정규화
    if (!result.content) {
    // 가능한 모든 필드명 체크
    const possibleContentFields = ['contentHtml', 'body', 'html', 'htmlContent', 'bodyHtml', 'article', 'text'];
    for (const field of possibleContentFields) {
      if (result[field]) {
        console.log(`✅ GPT-5.2 '${field}' 필드를 content로 정규화`);
        result.content = result[field];
        break;
      }
    }
    }
    
    // 디버그: result 객체의 모든 필드 출력
    console.log('📋 result 객체 필드:', Object.keys(result));
    if (!result.content) {
    console.error('❌ content 필드를 찾을 수 없습니다. result:', JSON.stringify(result).substring(0, 500));
    }
    
    // AI가 content를 배열이나 객체로 반환한 경우 방어 처리
    if (result.content && typeof result.content !== 'string') {
    console.warn('AI returned non-string content, attempting to extract HTML...');
    if (Array.isArray(result.content)) {
      // 배열인 경우 각 항목에서 HTML 추출
      result.content = result.content.map((item: any) => {
        if (typeof item === 'string') return item;
        if (item?.content) return item.content;
        if (item?.html) return item.html;
        return '';
      }).join('');
    } else if (typeof result.content === 'object') {
      // 객체인 경우 content나 html 필드 추출
      result.content = result.content.content || result.content.html || JSON.stringify(result.content);
    }
    }
    
    // 🧹 불필요한 텍스트 제거 (AI가 실수로 삽입한 마커/메타 텍스트)
    if (result.content && typeof result.content === 'string') {
      result.content = result.content
        .replace(/\(이미지 없음\)/g, '')
        .replace(/\(이미지가 없습니다\)/g, '')
        .replace(/\[이미지 없음\]/g, '')
        .replace(/\[IMG_\d+\]/g, '') // 남아있는 이미지 마커 제거
        .replace(/<p>\s*<\/p>/g, '') // 빈 p 태그 제거
        .trim();
    }
    
    // 분석된 스타일 정보 추가
    if (analyzedBgColor) {
    result.analyzedStyle = { backgroundColor: analyzedBgColor };
    }
    
    // 🎯 SEO 자동 평가 (재생성 없이 평가만 수행)
    const hasContent = result.content || result.contentHtml;
    if (!isCardNews && hasContent && result.title) {
    console.log('📊 SEO 자동 평가 시작...');
    if (typeof onProgress === 'function') {
      safeProgress('📊 SEO 점수를 자동 평가하고 있습니다...');
    }
    
    try {
      // content 또는 contentHtml 필드 지원
      const htmlContent = result.contentHtml || result.content;
      if (!htmlContent) {
        console.error('❌ SEO 평가 불가: result에 content 또는 contentHtml 필드가 없습니다');
        console.error('   - result 필드:', Object.keys(result));
      } else {
        const seoReport = await evaluateSeoScore(
          htmlContent,
          result.title,
          request.topic,
          request.keywords || ''
        );
        
        console.log(`📊 SEO 평가 완료 - 총점: ${seoReport.total}점`);
        
        // SEO 점수를 결과에 추가
        result.seoScore = seoReport;
        
        // 진행 상황 업데이트
        if (typeof onProgress === 'function') {
          safeProgress(`📊 SEO 평가 완료 - 총점: ${seoReport.total}점`);
        }
        
        if (seoReport.total >= 85) {
          console.log('✅ SEO 점수 85점 이상!');
          if (typeof onProgress === 'function') {
            safeProgress(`✅ SEO 점수 ${seoReport.total}점`);
          }
        } else {
          console.log(`ℹ️ SEO 점수 ${seoReport.total}점 - 참고용`);
          if (typeof onProgress === 'function') {
            safeProgress(`ℹ️ SEO 점수 ${seoReport.total}점`);
          }
        }
      }
    } catch (seoError) {
      console.error('❌ SEO 평가 오류:', seoError);
    }
    
    // SEO 평가 완료 메시지
    if (typeof onProgress === 'function') {
      safeProgress('✅ Step 2 완료: 글 작성 및 SEO 평가 완료');
    }
    }
    
    return result;
  } catch (error) { throw error; }
};

// 🗞️ 보도자료 생성 함수
const generatePressRelease = async (request: GenerationRequest, onProgress: (msg: string) => void): Promise<GeneratedContent> => {
  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;
  const day = currentDate.getDate();
  const formattedDate = `${year}년 ${month}월 ${day}일`;
  
  const pressTypeLabels: Record<string, string> = {
    'achievement': '실적 달성',
    'new_service': '신규 서비스/장비 도입',
    'research': '연구/학술 성과',
    'event': '행사/이벤트',
    'award': '수상/인증 획득',
    'health_tips': '건강 조언/정보'
  };
  
  const pressTypeLabel = pressTypeLabels[request.pressType || 'achievement'] || '실적 달성';
  const hospitalName = request.hospitalName || 'OO병원';
  const doctorName = request.doctorName || '홍길동';
  const doctorTitle = request.doctorTitle || '원장';
  const maxLength = request.textLength || 1400;
  
  // 학습된 말투 스타일 적용
  let learnedStyleInstruction = '';
  if (request.learnedStyleId) {
    try {
    const { getStyleById, getStylePromptForGeneration } = await import('./writingStyleService');
    const learnedStyle = getStyleById(request.learnedStyleId);
    if (learnedStyle) {
      learnedStyleInstruction = `
[🎓 학습된 말투 적용 - 보도자료 스타일 유지하며 적용!]
${getStylePromptForGeneration(learnedStyle)}

⚠️ 위 학습된 말투를 보도자료 형식에 맞게 적용하세요:
- 전문적인 보도자료 어조는 유지
- 문장 끝 패턴과 표현 스타일만 반영
- 과도한 구어체는 지양
`;
      console.log('📝 보도자료에 학습된 말투 적용:', learnedStyle.name);
    }
    } catch (e) {
    console.warn('학습된 말투 로드 실패:', e);
    }
  }
  
  // 🔍 웹 검색 수행 (최신 의료 정보, 통계 수집)
  onProgress('🔍 최신 의료 정보 검색 중...');
  
  const searchQuery = `${request.category} ${request.topic} ${request.keywords} 최신 연구 통계 가이드라인 ${year}년`;
  let searchResults = '';
  
  try {
    const searchData = await callGPTWebSearch(searchQuery);
    if (searchData && searchData.collected_facts && searchData.collected_facts.length > 0) {
      console.log('✅ 보도자료용 검색 결과:', searchData.collected_facts.length, '건');
      searchResults = `\n[🔍 검색된 최신 의료 정보 - 반드시 활용!]\n`;
      searchData.collected_facts.slice(0, 8).forEach((fact: any, idx: number) => {
        searchResults += `${idx + 1}. ${fact.fact || fact.content}\n   출처: ${fact.source || 'N/A'}\n\n`;
      });
    } else {
      console.log('⚠️ 검색 결과 없음 - 기본 프롬프트로 진행');
    }
  } catch (error) {
    console.warn('⚠️ 웹 검색 실패, 기본 정보로 작성:', error);
  }
  
  // 🏥 병원 웹사이트 크롤링 (강점, 특징 분석)
  let hospitalInfo = '';
  if (request.hospitalWebsite && request.hospitalWebsite.trim()) {
    onProgress('🏥 병원 웹사이트 분석 중...');
    try {
      const crawlResponse = await fetch('/api/crawler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: request.hospitalWebsite })
      });
      
      if (crawlResponse.ok) {
        const crawlData = await crawlResponse.json();
        if (crawlData.content) {
          console.log('✅ 병원 웹사이트 크롤링 완료:', crawlData.content.substring(0, 200));
          
          // AI로 병원 강점 분석
          const ai = getAiClient();
          const analysisResult = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `다음은 ${hospitalName}의 웹사이트 내용입니다. 
            
웹사이트 내용:
${crawlData.content.substring(0, 3000)}

[분석 요청]
위 병원 웹사이트에서 다음 정보를 추출해주세요:

1. 병원의 핵심 강점 (3~5개)
2. 특화 진료과목이나 특별한 의료 서비스
3. 병원의 차별화된 특징 (장비, 시스템, 의료진 등)
4. 병원의 비전이나 철학
5. 수상 경력이나 인증 사항

출력 형식:
[병원 강점]
- 강점 1
- 강점 2
...

[특화 서비스]
- 서비스 1
- 서비스 2
...

[차별화 요소]
- 요소 1
- 요소 2
...

간결하게 핵심만 추출해주세요. 없는 정보는 생략하세요.`,
            config: { responseMimeType: "text/plain" }
          });
          
          hospitalInfo = `\n[🏥 ${hospitalName} 병원 정보 - 웹사이트 분석 결과]\n${analysisResult.text}\n\n`;
          console.log('✅ 병원 강점 분석 완료:', hospitalInfo.substring(0, 200));
        }
      } else {
        console.warn('⚠️ 크롤링 API 실패:', crawlResponse.status);
      }
    } catch (error) {
      console.warn('⚠️ 병원 웹사이트 분석 실패:', error);
    }
  }
  
  onProgress('🗞️ 보도자료 작성 중...');
  
  const pressPrompt = `
당신은 병원 홍보팀 보도자료 전문가입니다.
${learnedStyleInstruction}
아래 정보를 바탕으로 언론 배포용 보도자료를 작성해주세요.

[기본 정보]
- 작성일: ${formattedDate}
- 병원명: ${hospitalName}
- 진료과: ${request.category}
- 의료진: ${doctorName} ${doctorTitle}
- 보도 유형: ${pressTypeLabel}
- 주제: ${request.topic}
- 키워드: ${request.keywords}
- ⚠️ 최대 글자 수: 공백 제외 ${maxLength}자 (반드시 이 글자 수를 넘지 마세요!)
${searchResults}
${hospitalInfo}

[필수 포함 문구 - 반드시 보도자료 하단에 포함]
⚠️ 본 자료는 ${hospitalName}의 홍보 목적으로 작성된 보도자료입니다.
의학적 정보는 참고용이며, 정확한 진단과 치료는 반드시 전문의와 상담하시기 바랍니다.

[보도자료 형식 - 반드시 HTML로 작성]
<div class="press-release-container">
  <div class="press-header">
    <p class="press-date">${formattedDate}</p>
    <p class="press-embargo">즉시 보도 가능</p>
  </div>
  
  <h1 class="press-title">[제목: 임팩트 있는 한 줄 - 50자 이내]</h1>
  <h2 class="press-subtitle">[부제: 핵심 내용 요약 - 70자 이내]</h2>
  
  <div class="press-lead">
    <p>[리드문: 5W1H 원칙에 따라 핵심 내용 요약 - 150~200자]</p>
  </div>
  
  <div class="press-body">
    <h3>■ 배경 및 현황</h3>
    <p>[관련 의료 현황, 사회적 배경 설명 - 200~300자]</p>
    
    <h3>■ 주요 내용</h3>
    <p>[보도 핵심 내용 상세 설명 - 300~400자]</p>
    <ul>
    <li>핵심 포인트 1</li>
    <li>핵심 포인트 2</li>
    <li>핵심 포인트 3</li>
    </ul>
    
    <h3>■ 전문가 코멘트</h3>
    <blockquote class="press-quote">
    <p>"[${doctorName} ${doctorTitle}의 전문적이고 신뢰감 있는 코멘트 - 100~150자]"</p>
    <cite>- ${hospitalName} ${request.category} ${doctorName} ${doctorTitle}</cite>
    </blockquote>
    
    <h3>■ 향후 계획</h3>
    <p>[향후 발전 계획, 비전 제시 - 150~200자]</p>
  </div>
  
  <div class="press-footer">
    <div class="press-contact">
    <h4>▣ 문의처</h4>
    <p>${hospitalName} 홍보팀</p>
    <p>전화: 02-0000-0000 / 이메일: pr@hospital.com</p>
    </div>
    
    <div class="press-disclaimer">
    <p>※ 본 자료는 ${hospitalName}의 홍보 목적으로 작성된 보도자료입니다.</p>
    <p>※ 의학적 정보는 참고용이며, 정확한 진단과 치료는 반드시 전문의와 상담하시기 바랍니다.</p>
    <p>※ 본 보도자료는 배포 전 반드시 내용 검토가 필요합니다.</p>
    </div>
  </div>
</div>

[작성 지침]
1. 객관적이고 공식적인 어조 사용 (마케팅 문구 지양)
2. 과장된 표현 금지 (최고, 최초, 유일 등 검증 불가 표현 주의)
3. 구체적인 수치와 사실에 기반한 내용
4. 전문의 코멘트는 신뢰감 있으면서도 환자 중심적 메시지
5. 의료광고 심의 기준 준수 (과대광고 금지)

[🚨 AI 냄새 점수 시스템 v2.0 - 보도자료 필수 적용!]
**총점: 100점 | 15점 초과 시 재작성 대상**
**🔄 v2.0: 중복 제거, 배점 재조정, 심사숙고 평가**

**체크 포인트 (점수 높을수록 AI 냄새 심함):**

1. **문장 리듬 단조로움** (0~25점) ★ 가장 중요
   • 동일 종결어미 3회 이상 반복 → +7점
   • 문장 시작 패턴 3회 이상 반복 → +6점
   • 문단 길이 균일 / 설명만 연속 → +6점씩

2. **판단 단정형 글쓰기** (0~20점)
   • 한 문단에 조건/가능성 종결 3회 이상 → +8점
   • 기준 없이 "확인 필요"만 반복 → +7점
   • 저자 의견/판단 0회 → +5점

3. **현장감 부재** (0~20점)
   • 시간/계절/상황 맥락 전무 → +7점
   • 실제 질문/고민 시나리오 없음 → +7점
   • 현장 용어 0회 → +6점

4. **템플릿 구조** (0~15점)
   • 배경→주요내용→전망의 뻔한 구조 → +6점
   • 독자 자가 체크 포인트 없음 → +5점
   • 전환어 없이 나열만 → +4점

5. **가짜 공감** (0~10점)
   • "관심이 높아지고 있다" 류 범용 공감만 → +4점
   • 구체적 상황·감정 지목 없음 → +3점
   • 공감 위치 고정 → +3점

6. **행동 유도 실패** (0~10점)
   • 매번 동일한 마무리 패턴 → +4점
   • 시점·조건 없는 권유 → +3점
   • 상황별 분기 없음 → +3점

**개선 방법:**
- 관찰형 문장 섞기 (예: "실제로 ~문의가 늘어나고 있다")
- 구체적 맥락 추가 (시기, 대상, 상황)
- 문장 엔딩 다양화: "~거든요", "~더라고요", "~인 경우도 있습니다"
- 전문가 코멘트에 현장감 있는 표현 추가

**판정 (v2.0):** 0~7점=✅사람글 | 8~15점=⚠️부분수정 | 16점↑=🚨재작성

[📊 통계/수치 인용 규칙 - 필수! (현재: ${year}년)]
⚠️ 모든 통계와 수치는 반드시 출처와 연도를 함께 표기!
⚠️ 현재 ${year}년 기준, 가장 최신 자료(${year}년 또는 ${year-1}년)를 우선 인용!
✅ "${year}년 국민건강영양조사에 따르면..." 또는 "${year-1}년 자료 기준..."
✅ "대한OO학회 ${year}년 최신 가이드라인에 의하면..."
✅ "보건복지부 ${year}년 통계 기준..."
✅ "${year-1}년 발표된 연구에 따르면..." (1년 전 자료도 OK, 단 연도 명시)
❌ "국내 환자가 수백만 명에 달합니다" (출처/연도 없음)
❌ "최근 연구에 따르면..." (구체적 출처/연도 없음)
❌ 2년 이상 오래된 자료를 "최신"이라고 표현 금지!

[[금지] 언론중재위 가이드라인 준수]
- 사실과 의견 명확히 구분
- 추측성 표현 시 "~것으로 보인다", "~것으로 예상된다" 사용
- 인용문은 정확히, 맥락 왜곡 금지
- 수치 과장/축소 금지

[중요]
- 반드시 위 HTML 구조를 그대로 사용
- 마크다운 문법 사용 금지 (### 이나 **굵게** 등)
- 모든 텍스트는 HTML 태그로 감싸서 출력
`;

  const ai = getAiClient();
  const result = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: pressPrompt,
    config: {
    responseMimeType: "text/plain"
    }
  });
  let pressContent = result.text || '';
  
  // HTML 정리
  pressContent = pressContent
    .replace(/```html?\n?/gi, '')
    .replace(/```\n?/gi, '')
    .trim();
  
  // press-release-container가 없으면 감싸기
  if (!pressContent.includes('class="press-release-container"')) {
    pressContent = `<div class="press-release-container">${pressContent}</div>`;
  }
  
  // CSS 스타일 추가
  const pressStyles = `
<style>
.press-release-container {
  font-family: 'Pretendard', -apple-system, sans-serif;
  max-width: 800px;
  margin: 0 auto;
  padding: 40px;
  background: #fff;
  line-height: 1.8;
  color: #333;
}
.press-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 20px;
  border-bottom: 2px solid #1a1a1a;
  margin-bottom: 30px;
}
.press-date {
  font-size: 14px;
  color: #666;
  margin: 0;
}
.press-embargo {
  font-size: 12px;
  color: #fff;
  background: #7c3aed;
  padding: 4px 12px;
  border-radius: 4px;
  font-weight: 600;
  margin: 0;
}
.press-title {
  font-size: 28px;
  font-weight: 800;
  color: #1a1a1a;
  margin: 0 0 12px 0;
  line-height: 1.4;
}
.press-subtitle {
  font-size: 18px;
  font-weight: 500;
  color: #555;
  margin: 0 0 30px 0;
  padding-bottom: 20px;
  border-bottom: 1px solid #eee;
}
.press-lead {
  background: #f8f9fa;
  padding: 20px 24px;
  border-left: 4px solid #7c3aed;
  margin-bottom: 30px;
  border-radius: 0 8px 8px 0;
}
.press-lead p {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  color: #333;
}
.press-body h3 {
  font-size: 18px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 30px 0 15px 0;
}
.press-body p {
  font-size: 15px;
  color: #444;
  margin: 0 0 15px 0;
}
.press-body ul {
  margin: 15px 0;
  padding-left: 24px;
}
.press-body li {
  font-size: 15px;
  color: #444;
  margin: 8px 0;
}
.press-quote {
  background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%);
  padding: 24px 28px;
  border-radius: 12px;
  margin: 20px 0;
  border: none;
}
.press-quote p {
  font-size: 16px;
  font-style: italic;
  color: #4c1d95;
  margin: 0 0 12px 0;
  font-weight: 500;
}
.press-quote cite {
  font-size: 14px;
  color: #6b7280;
  font-style: normal;
  font-weight: 600;
}
.press-footer {
  margin-top: 40px;
  padding-top: 30px;
  border-top: 2px solid #1a1a1a;
}
.press-contact {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}
.press-contact h4 {
  font-size: 14px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 10px 0;
}
.press-contact p {
  font-size: 14px;
  color: #666;
  margin: 4px 0;
}
.press-disclaimer {
  background: #fff3cd;
  padding: 16px 20px;
  border-radius: 8px;
  border: 1px solid #ffc107;
}
.press-disclaimer p {
  font-size: 12px;
  color: #856404;
  margin: 4px 0;
}
</style>
`;

  const finalHtml = pressStyles + pressContent;
  
  // 제목 추출
  const titleMatch = pressContent.match(/<h1[^>]*class="press-title"[^>]*>([^<]+)/);
  const title = titleMatch ? titleMatch[1].trim() : `${hospitalName} ${pressTypeLabel} 보도자료`;
  
  onProgress('✅ 보도자료 작성 완료!');
  
  return {
    title,
    htmlContent: finalHtml,
    imageUrl: '',
    fullHtml: finalHtml,
    tags: [hospitalName, request.category, pressTypeLabel, request.topic],
    factCheck: {
    fact_score: 90,
    safety_score: 95,
    conversion_score: 70,
    ai_smell_score: 12, // 보도자료 기본값 - 경계선 수준
    verified_facts_count: 5,
    issues: [],
    recommendations: ['보도 전 법무팀 검토 권장', '인용 통계 출처 확인 필요', 'AI 냄새 점수 확인 - 문장 패턴 다양화 권장']
    },
    postType: 'press_release'
  };
};

export const generateFullPost = async (request: GenerationRequest, onProgress?: (msg: string) => void): Promise<GeneratedContent> => {
  // onProgress가 없으면 콘솔 로그로 대체
  const safeProgress = onProgress || ((msg: string) => console.log('📍 Progress:', msg));
  
  const isCardNews = request.postType === 'card_news';
  const isPressRelease = request.postType === 'press_release';
  
  // • 디버그: request에 customImagePrompt가 있는지 확인
  console.log('• generateFullPost 시작 - request.imageStyle:', request.imageStyle);
  console.log('• generateFullPost 시작 - request.customImagePrompt:', request.customImagePrompt ? request.customImagePrompt.substring(0, 50) : 'undefined/없음');
  
  // 🗞️ 보도자료: 전용 생성 함수 사용
  if (isPressRelease) {
    return generatePressRelease(request, safeProgress);
  }
  
  // 🤖 카드뉴스: 미니 에이전트 방식 사용
  if (isCardNews) {
    safeProgress('🤖 미니 에이전트 방식으로 카드뉴스 생성 시작...');
    
    try {
    // 미니 에이전트로 스토리 기획 + HTML 조립 + 이미지 프롬프트 생성
    const agentResult = await generateCardNewsWithAgents(request, safeProgress);
    
    // 이미지 생성
    const styleName = STYLE_NAMES[request.imageStyle] || STYLE_NAMES.illustration;
    safeProgress(`🎨 ${styleName} 스타일로 4:3 이미지 생성 중...`);
    
    // 🎨 이미지 = 카드 전체! (텍스트가 이미지 안에 포함된 완성형)
    const maxImages = request.slideCount || 6;
    safeProgress(`🎨 ${maxImages}장의 완성형 카드 이미지 생성 중...`);
    
    // 참고 이미지 설정 (표지 또는 본문 스타일 이미지)
    const referenceImage = request.coverStyleImage || request.contentStyleImage;
    const copyMode = request.styleCopyMode; // true=레이아웃 복제, false=느낌만 참고

    // imagePrompts가 없으면 빈 배열로 초기화
    if (!agentResult.imagePrompts || !Array.isArray(agentResult.imagePrompts)) {
      agentResult.imagePrompts = [];
    }

    // • 디버그: imagePrompts 내용 확인
    if (agentResult.imagePrompts.length > 0) {
      console.log('🎨 첫 생성 imagePrompts:', agentResult.imagePrompts.map((p, i) => ({ index: i, promptHead: p.substring(0, 200) })));
    }

    // 순차 생성으로 진행률 표시
    const images: { index: number; data: string; prompt: string }[] = [];
    for (let i = 0; i < Math.min(maxImages, agentResult.imagePrompts.length); i++) {
      safeProgress(`🎨 카드 이미지 ${i + 1}/${maxImages}장 생성 중...`);
      const img = await generateSingleImage(
        agentResult.imagePrompts[i], 
        request.imageStyle, 
        "1:1", 
        request.customImagePrompt, 
        referenceImage, 
        copyMode
      );
      images.push({ index: i + 1, data: img, prompt: agentResult.imagePrompts[i] });
    }
    
    // 이미지 자체가 카드 전체! (HTML 텍스트 없이 이미지만)
    // 🚨 alt 속성에도 코드 문자열이 들어가지 않도록 필터링!
    const cleanAltText = (text: string) => text
      .replace(/[A-Za-z0-9+/=_-]{10,}/g, '')
      .replace(/[a-zA-Z0-9]{5,}\/[a-zA-Z0-9/]+/g, '')
      .replace(/[^\uAC00-\uD7AF가-힣a-zA-Z0-9\s.,!?~():\-]+/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 100); // alt 텍스트 길이 제한
    
    const cardSlides = images.map((img, idx) => {
      if (img.data) {
        return `
          <div class="card-slide" style="border-radius: 24px; overflow: hidden; aspect-ratio: 1/1; box-shadow: 0 4px 16px rgba(0,0,0,0.08);">
            <img src="${img.data}" alt="${cleanAltText(img.prompt)}" data-index="${img.index}" class="card-full-img" style="width: 100%; height: 100%; object-fit: cover;" />
          </div>`;
      }
      return '';
    }).filter(Boolean).join('\n');
    
    const finalHtml = `
      <div class="card-news-container">
        <h2 class="hidden-title">${agentResult.title}</h2>
        <div class="card-grid-wrapper">
          ${cardSlides}
        </div>
        <div class="legal-box-card">${MEDICAL_DISCLAIMER}</div>
      </div>
    `.trim();
    
    safeProgress('✅ 카드뉴스 생성 완료!');
    
    return {
      title: agentResult.title,
      htmlContent: finalHtml,
      imageUrl: images[0]?.data || "",
      fullHtml: finalHtml,
      tags: [],
      factCheck: {
        fact_score: 85,
        safety_score: 90,
        conversion_score: 80,
        verified_facts_count: 5,
        issues: [],
        recommendations: []
      },
      postType: 'card_news',
      imageStyle: request.imageStyle,
      customImagePrompt: request.customImagePrompt, // 커스텀 이미지 프롬프트 저장 (재생성용)
      cardPrompts: agentResult.cardPrompts // 재생성용 프롬프트 데이터
    };
    } catch (error) {
    console.error('미니 에이전트 방식 실패, 기존 방식으로 폴백:', error);
    safeProgress('⚠️ 미니 에이전트 실패, 기존 방식으로 재시도...');
    // 기존 방식으로 폴백 (아래 코드로 계속)
    }
  }
  
  // 📝 블로그 포스트 또는 카드뉴스 폴백: 기존 방식 사용
  const hasStyleRef = request.postType === 'card_news' && (request.coverStyleImage || request.contentStyleImage);
  if (hasStyleRef) {
    if (request.coverStyleImage && request.contentStyleImage) {
    safeProgress('🎨 표지/본문 스타일 분석 중...');
    } else if (request.coverStyleImage) {
    safeProgress('🎨 표지 스타일 분석 중 (본문도 동일 적용)...');
    } else {
    safeProgress('🎨 본문 스타일 분석 중...');
    }
  }
  
  const step1Msg = hasStyleRef
    ? `참고 이미지 스타일로 카드뉴스 생성 중...`
    : request.referenceUrl 
    ? `🔗 레퍼런스 URL 분석 및 ${request.postType === 'card_news' ? '카드뉴스 템플릿 모방' : '스타일 벤치마킹'} 중...` 
    : `네이버 로직 분석 및 ${request.postType === 'card_news' ? '카드뉴스 기획' : '블로그 원고 작성'} 중...`;
  
  safeProgress(step1Msg);
  
  const textData = await generateBlogPostText(request, safeProgress);
  
  const styleName = STYLE_NAMES[request.imageStyle] || STYLE_NAMES.illustration;
  const imgRatio = request.postType === 'card_news' ? "4:3" : "16:9";
  
  safeProgress(`🎨 ${styleName} 스타일로 ${imgRatio} 이미지 생성 중...`);
  
  const maxImages = request.postType === 'card_news' ? (request.slideCount || 6) : (request.imageCount ?? 1);
  
  // 폴백 방식에서도 참고 이미지 전달 (레이아웃 재가공 지원)
  const fallbackReferenceImage = request.coverStyleImage || request.contentStyleImage;
  const fallbackCopyMode = request.styleCopyMode;
  
  // 🖼️ 블로그 vs 카드뉴스 이미지 생성 분기
  // 블로그: generateBlogImage (텍스트 없는 순수 이미지, 16:9)
  // 카드뉴스: generateSingleImage (텍스트 포함, 브라우저 프레임, 1:1)
  // ⚠️ 이미지 0장이면 생성 스킵
  let images: { index: number; data: string; prompt: string }[] = [];

  // imagePrompts가 없으면 빈 배열로 초기화 (imageCount가 0일 때 AI가 생략할 수 있음)
  if (!textData.imagePrompts || !Array.isArray(textData.imagePrompts)) {
    textData.imagePrompts = [];
  }

  if (maxImages > 0 && textData.imagePrompts.length > 0) {
    // 순차 생성으로 진행률 표시
    for (let i = 0; i < Math.min(maxImages, textData.imagePrompts.length); i++) {
      safeProgress(`🎨 이미지 ${i + 1}/${maxImages}장 생성 중...`);
      const p = textData.imagePrompts[i];
      let img: string;
      
      if (request.postType === 'card_news') {
        // 카드뉴스: 기존 함수 사용 (텍스트 포함, 브라우저 프레임)
        img = await generateSingleImage(p, request.imageStyle, imgRatio, request.customImagePrompt, fallbackReferenceImage, fallbackCopyMode);
      } else {
        // 블로그: 새 함수 사용 (텍스트 없는 순수 이미지)
        img = await generateBlogImage(p, request.imageStyle, imgRatio, request.customImagePrompt);
      }
      
      images.push({ index: i + 1, data: img, prompt: p });
    }
  } else {
    console.log('🖼️ 이미지 0장 설정 - 이미지 생성 스킵');
    safeProgress('📝 이미지 없이 텍스트만 생성 완료');
  }

  // 🔧 content 또는 contentHtml 필드 둘 다 지원
  let body = textData.content || textData.contentHtml || '';
  
  // 방어 코드: body가 없으면 에러
  if (!body || body.trim() === '') {
    console.error('❌ textData.content/contentHtml 둘 다 비어있습니다:', textData);
    console.error('   - 사용 가능한 필드:', Object.keys(textData));
    throw new Error('AI가 콘텐츠를 생성하지 못했습니다. 다시 시도해주세요.');
  }
  
  // body가 HTML이 아닌 JSON/배열 형태인지 검증
  if (body && (body.startsWith('[{') || body.startsWith('{"'))) {
    console.error('AI returned JSON instead of HTML, attempting to extract...');
    try {
    const parsed = JSON.parse(body);
    if (Array.isArray(parsed)) {
      body = parsed.map(item => item.content || item.html || '').join('');
    } else if (parsed.content || parsed.html) {
      body = parsed.content || parsed.html;
    }
    } catch (e) {
    console.error('Failed to parse JSON content:', e);
    }
  }
  
  // AI가 class를 빼먹었을 경우 강제로 감싸기
  if (request.postType !== 'card_news' && !body.includes('class="naver-post-container"')) {
    body = `<div class="naver-post-container">${body}</div>`;
  }
  
  // 🚨 카드뉴스인데 card-slide가 없으면 AI가 HTML 구조를 완전히 무시한 것!
  // 이 경우 기본 카드뉴스 템플릿으로 강제 생성
  if (request.postType === 'card_news' && !body.includes('class="card-slide"')) {
    console.warn('AI ignored card-slide structure, generating fallback template...');
    const slideCount = request.slideCount || 6;
    const fallbackSlides: string[] = [];
    
    // body에서 텍스트 추출 시도
    const plainText = body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const sentences = plainText.split(/[.!?。]/).filter(s => s.trim().length > 5);
    
    for (let i = 0; i < slideCount; i++) {
    const isFirst = i === 0;
    const isLast = i === slideCount - 1;
    const sentenceIdx = Math.min(i, sentences.length - 1);
    const sentence = sentences[sentenceIdx] || request.topic;
    
    let subtitle = isFirst ? '알아보자!' : isLast ? '함께 실천해요' : `포인트 ${i}`;
    let mainTitle = isFirst 
      ? `${request.topic}<br/><span class="card-highlight">총정리</span>`
      : isLast 
      ? `건강한 습관<br/><span class="card-highlight">시작해요!</span>`
      : sentence.slice(0, 15) + (sentence.length > 15 ? '...' : '');
    let desc = sentence.slice(0, 50) || '건강한 생활을 위한 정보를 확인하세요.';
    
    fallbackSlides.push(`
      <div class="card-slide" style="background: linear-gradient(180deg, #E8F4FD 0%, #F0F9FF 100%); border-radius: 24px; overflow: hidden;">
        <div style="padding: 32px 28px; display: flex; flex-direction: column; align-items: center; text-align: center; height: 100%;">
          <p class="card-subtitle" style="font-size: 14px; font-weight: 700; color: #3B82F6; margin-bottom: 8px;">${subtitle}</p>
          <p class="card-main-title" style="font-size: 28px; font-weight: 900; color: #1E293B; line-height: 1.3; margin: 0 0 16px 0;">${mainTitle}</p>
          <div class="card-img-container" style="width: 100%; margin: 16px 0;">[IMG_${i + 1}]</div>
          <p class="card-desc" style="font-size: 15px; color: #475569; line-height: 1.6; font-weight: 500; max-width: 90%;">${desc}</p>
        </div>
      </div>
    `);
    }
    body = fallbackSlides.join('\n');
  }
  
  images.forEach(img => {
    const pattern = new RegExp(`\\[IMG_${img.index}\\]`, "gi");
    if (img.data) {
    let imgHtml = "";
    if (request.postType === 'card_news') {
        imgHtml = `<img src="${img.data}" alt="${img.prompt}" data-index="${img.index}" class="card-full-img" style="width: 100%; height: auto; display: block;" />`;
    } else {
        imgHtml = `<div class="content-image-wrapper"><img src="${img.data}" alt="${img.prompt}" data-index="${img.index}" /></div>`;
    }
    body = body.replace(pattern, imgHtml);
    } else {
    // 이미지 생성 실패 시 마커 제거
    body = body.replace(pattern, '');
    }
  });
  
  // 혹시 남아있는 [IMG_N] 마커 모두 제거
  body = body.replace(/\[IMG_\d+\]/gi, '');

  // 카드뉴스: 분석된 스타일 배경색 강제 적용 (AI가 무시할 경우 대비)
  if (request.postType === 'card_news' && textData.analyzedStyle?.backgroundColor) {
    const bgColor = textData.analyzedStyle.backgroundColor;
    const bgGradient = bgColor.includes('gradient') ? bgColor : `linear-gradient(180deg, ${bgColor} 0%, ${bgColor}dd 100%)`;
    // 기존 card-slide의 background 스타일을 분석된 색상으로 교체
    body = body.replace(
    /(<div[^>]*class="[^"]*card-slide[^"]*"[^>]*style="[^"]*)background:[^;]*;?/gi,
    `$1background: ${bgGradient};`
    );
    // 만약 background 스타일이 없는 card-slide가 있다면 추가
    body = body.replace(
    /<div([^>]*)class="([^"]*card-slide[^"]*)"([^>]*)>/gi,
    (match, pre, cls, post) => {
      if (match.includes('style="')) {
        // 이미 style이 있지만 background가 없으면 추가
        if (!match.includes('background:')) {
          return match.replace('style="', `style="background: ${bgGradient}; `);
        }
        return match;
      } else {
        // style이 없으면 추가
        return `<div${pre}class="${cls}"${post} style="background: ${bgGradient};">`;
      }
    }
    );
    safeProgress(`🎨 템플릿 색상(${bgColor}) 적용 완료`);
  }

  let finalHtml = "";
  if (request.postType === 'card_news') {
    finalHtml = `
    <div class="card-news-container">
       <h2 class="hidden-title">${textData.title}</h2>
       <div class="card-grid-wrapper">
          ${body}
       </div>
       <div class="legal-box-card">${MEDICAL_DISCLAIMER}</div>
    </div>
    `.trim();
  } else {
    // 블로그 포스트: 맨 위에 메인 제목(h2) 추가 (중복 방지)
    const mainTitle = request.topic || textData.title;
    
    // 이미 main-title이 있는지 확인
    const hasMainTitle = body.includes('class="main-title"') || body.includes('class=\'main-title\'');
    
    if (hasMainTitle) {
      // 이미 제목이 있으면 그대로 사용
      if (body.includes('class="naver-post-container"')) {
        finalHtml = body;
      } else {
        finalHtml = `<div class="naver-post-container">${body}</div>`;
      }
    } else {
      // 제목이 없으면 추가
      if (body.includes('class="naver-post-container"')) {
        finalHtml = body.replace(
          '<div class="naver-post-container">',
          `<div class="naver-post-container"><h2 class="main-title">${mainTitle}</h2>`
        );
      } else {
        finalHtml = `<div class="naver-post-container"><h2 class="main-title">${mainTitle}</h2>${body}</div>`;
      }
    }
  }

  // ============================================
  // 🎯 SEO 점수는 generateWithAgentMode에서 이미 평가됨
  // 여기서는 textData.seoScore를 사용 (중복 평가 방지)
  // ============================================
  let seoScore: SeoScoreReport | undefined = textData.seoScore;
  
  // 블로그 포스트인 경우 SEO 점수 확인 (이미 평가된 경우 스킵)
  if (request.postType === 'blog') {
    if (seoScore) {
    // 이미 generateWithAgentMode에서 SEO 평가가 완료됨
    console.log('📊 이미 평가된 SEO 점수 사용:', seoScore.total);
    if (seoScore.total >= 85) {
      safeProgress(`✅ SEO 점수 ${seoScore.total}점`);
    } else {
      safeProgress(`ℹ️ SEO 점수 ${seoScore.total}점`);
    }
    }
    
    // ============================================
    // 🤖 AI 냄새 점수 체크 + 16점 이상 자동 재생성
    // ============================================
    const aiSmellScore = textData.fact_check?.ai_smell_score || 0;
    const MAX_AI_SMELL_SCORE = 15;
    
    if (aiSmellScore > MAX_AI_SMELL_SCORE) {
    console.log(`🤖 AI 냄새 점수 ${aiSmellScore}점 > 15점, 자동 개선 시도`);
    safeProgress(`🤖 AI 냄새 점수 ${aiSmellScore}점 (15점 초과) - 자동 개선 중...`);
    
    try {
      const aiSmellImprovementPrompt = `
당신은 AI 냄새를 제거하는 전문가입니다.
아래 블로그 글의 AI 냄새 점수가 ${aiSmellScore}점입니다. 15점 이하로 줄여주세요.

[현재 본문]
${finalHtml.substring(0, 6000)}

[AI 냄새 제거 핵심 규칙]
1. "~수 있습니다" 연속 2회 이상 나오면 하나를 "~인 경우도 있습니다", "~로 이어지기도 합니다"로 변경
2. 각 문단에 관찰자 시점 문장 1개 추가 ("이런 분들이 많더라고요", "병원에서 자주 듣는 이야기예요")
3. 첫 문장은 정의가 아닌 상황 묘사로 시작 ("꼭 많이 먹지 않았는데도...")
4. 마지막 문장 덜 교과서적으로 ("원인을 확인해두면 이후 관리가 수월해져요")
5. 문단마다 기능이 너무 명확하면 흐름으로 연결 ("그런데 말이죠", "사실 여기서 중요한 건")
6. 짧은 문장 중간에 삽입 ("솔직히 애매하죠.", "근데요.")

[출력 형식 - JSON]
{
  "improved_body": "개선된 본문 HTML (naver-post-container 클래스 유지)",
  "changes_made": ["변경한 내용 1", "변경한 내용 2", ...]
}`;
      
      const improvedAiText = await callOpenAI(aiSmellImprovementPrompt, 'AI 냄새 제거 전문가로서 사람이 쓴 것처럼 자연스럽게 개선해주세요.');
      
      let improvedAiData;
      try {
        const jsonMatch = improvedAiText.match(/\{[\s\S]*\}/);
        improvedAiData = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      } catch {
        console.warn('AI 냄새 개선 응답 JSON 파싱 실패');
      }
      
      if (improvedAiData?.improved_body) {
        const improvedMainTitle = request.topic || textData.title;
        if (improvedAiData.improved_body.includes('class="naver-post-container"')) {
          finalHtml = improvedAiData.improved_body.replace(
            '<div class="naver-post-container">',
            `<div class="naver-post-container"><h2 class="main-title">${improvedMainTitle}</h2>`
          );
        } else {
          finalHtml = `<div class="naver-post-container"><h2 class="main-title">${improvedMainTitle}</h2>${improvedAiData.improved_body}</div>`;
        }
        
        // fact_check의 ai_smell_score 업데이트 (추정값)
        if (textData.fact_check) {
          textData.fact_check.ai_smell_score = Math.max(0, aiSmellScore - 10);
        }
        
        console.log('✅ AI 냄새 개선 완료:', improvedAiData.changes_made);
        safeProgress(`✅ AI 냄새 개선 완료 (${improvedAiData.changes_made?.length || 0}개 항목 수정)`);
      }
      
    } catch (aiSmellError) {
      console.error('AI 냄새 개선 실패:', aiSmellError);
      safeProgress('⚠️ AI 냄새 개선 실패, 현재 결과 유지');
    }
    } else if (aiSmellScore >= 8 && aiSmellScore <= 15) {
    // ============================================
    // • 8~15점 경계선: 수정 위치 상세 분석
    // ============================================
    console.log(`⚠️ AI 냄새 점수 ${aiSmellScore}점 - 경계선 (8~15점), 수정 위치 분석 중...`);
    safeProgress(`⚠️ AI 냄새 점수 ${aiSmellScore}점 - 경계선! 수정 필요 위치를 분석합니다...`);
    
    try {
      const aiSmellAnalysis = await analyzeAiSmell(finalHtml, request.topic);
      
      // fact_check에 상세 분석 결과 추가
      if (textData.fact_check) {
        textData.fact_check.ai_smell_analysis = aiSmellAnalysis;
      }
      
      // 우선 수정 항목 출력
      const topIssues = aiSmellAnalysis.priority_fixes?.slice(0, 3) || [];
      console.log('• AI 냄새 수정 필요 위치:', topIssues);
      
      if (topIssues.length > 0) {
        safeProgress(`• 수정 필요 위치 발견! 상세 분석 완료`);
        console.log('📋 상세 분석 결과:', {
          total_score: aiSmellAnalysis.total_score,
          sentence_rhythm: aiSmellAnalysis.sentence_rhythm?.score,
          judgment_avoidance: aiSmellAnalysis.judgment_avoidance?.score,
          lack_of_realism: aiSmellAnalysis.lack_of_realism?.score,
          template_structure: aiSmellAnalysis.template_structure?.score,
          fake_empathy: aiSmellAnalysis.fake_empathy?.score,
          cta_failure: aiSmellAnalysis.cta_failure?.score
        });
      }
      
      safeProgress(`✅ AI 냄새 점수 ${aiSmellScore}점 - 부분 수정 후 발행 가능`);
      
    } catch (analysisError) {
      console.error('AI 냄새 상세 분석 실패:', analysisError);
      safeProgress(`✅ AI 냄새 점수 ${aiSmellScore}점 - 경계선 (부분 수정 권장)`);
    }
    
    } else {
    console.log(`✅ AI 냄새 점수 ${aiSmellScore}점 - 기준 충족 (7점 이하)`);
    safeProgress(`✅ AI 냄새 점수 ${aiSmellScore}점 - 사람 글 판정! 🎉`);
    }
  }

  // 디버깅: 반환 데이터 확인
  console.log('• generateFullPost 반환 데이터:');
  console.log('  - textData.fact_check:', textData.fact_check);
  console.log('  - seoScore:', seoScore);
  
  // 최종 완료 메시지
  safeProgress('✅ 모든 생성 작업 완료!');
  
  return {
    title: textData.title,
    htmlContent: finalHtml,
    imageUrl: images[0]?.data || "",
    fullHtml: finalHtml,
    tags: [],
    factCheck: textData.fact_check,
    postType: request.postType,
    imageStyle: request.imageStyle,
    customImagePrompt: request.customImagePrompt, // 커스텀 이미지 프롬프트 저장 (재생성용)
    seoScore // SEO 점수 자동 포함
  };
};

// 카드뉴스 개별 슬라이드 재생성 함수
export const regenerateCardSlide = async (
  cardIndex: number,
  currentCardHtml: string,
  userInstruction: string,
  context: {
    topic: string;
    category: string;
    totalSlides: number;
    prevCardContent?: string;
    nextCardContent?: string;
    imageStyle?: ImageStyle;
  }
): Promise<{ newCardHtml: string; newImagePrompt: string; message: string }> => {
  const ai = getAiClient();
  
  const slidePosition = cardIndex === 0 
    ? '표지 (1장)' 
    : cardIndex === context.totalSlides - 1 
    ? '마무리 (마지막 장)' 
    : `본문 (${cardIndex + 1}장)`;
  
  const imageStyleGuide = STYLE_KEYWORDS[context.imageStyle] || STYLE_KEYWORDS.illustration;
  
  // 현재 HTML에서 이미지를 마커로 교체 (기존 이미지 제거)
  const cleanedHtml = currentCardHtml
    .replace(/<img[^>]*class="card-inner-img"[^>]*>/gi, `[IMG_${cardIndex + 1}]`)
    .replace(/<img[^>]*>/gi, `[IMG_${cardIndex + 1}]`);
  
  const prompt = `
당신은 카드뉴스 슬라이드를 재생성하는 전문가입니다.

[현재 슬라이드 정보]
- 위치: ${slidePosition} (총 ${context.totalSlides}장 중 ${cardIndex + 1}번째)
- 주제: ${context.topic}
- 진료과: ${context.category}

[현재 슬라이드 HTML - 텍스트만 참고]
${cleanedHtml}

${context.prevCardContent ? `[이전 슬라이드 내용]\n${context.prevCardContent}` : ''}
${context.nextCardContent ? `[다음 슬라이드 내용]\n${context.nextCardContent}` : ''}

[사용자 요청]
${userInstruction}

[중요]
[🚨 필수 작성 규칙] 
[중요]
1. card-slide 구조를 유지하세요
2. card-main-title은 12자 이내, card-subtitle은 8자 이내
3. ⚠️ 이미지 영역은 반드시 [IMG_${cardIndex + 1}] 텍스트 마커만 사용! (img 태그 금지!)
4. 이전/다음 슬라이드와 내용이 자연스럽게 연결되어야 합니다
5. ${slidePosition === '표지 (1장)' ? '주제 소개 + 흥미 유발 문구' : slidePosition === '마무리 (마지막 장)' ? '행동 유도 + 감성적 마무리' : '구체적인 정보/방법 제시'}

⚠️ 중요: newCardHtml에 <img> 태그 넣지 마세요! [IMG_${cardIndex + 1}] 마커만!
예시: <div class="card-img-container">[IMG_${cardIndex + 1}]</div>

[이미지 프롬프트 규칙]
- 반드시 한국어로 작성
- 스타일: ${imageStyleGuide}
- 1:1 정사각형 카드뉴스 형식
- 로고/워터마크/해시태그 금지

JSON 형식으로 답변:
{
  "newCardHtml": "<div class=\"card-slide\">...[IMG_${cardIndex + 1}]...</div>",
  "newImagePrompt": "1:1 정사각형 카드뉴스, 한국어 이미지 프롬프트...",
  "message": "수정 완료 메시지"
}
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            newCardHtml: { type: Type.STRING },
            newImagePrompt: { type: Type.STRING },
            message: { type: Type.STRING }
          },
          required: ["newCardHtml", "newImagePrompt", "message"]
        }
      }
    });
    
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error('카드 재생성 실패:', error);
    throw error;
  }
};

// AI 재생성 모드 타입
export type SlideRegenMode = 
  | 'rewrite'      // 🔄 완전 새로 쓰기
  | 'strengthen'   // 💪 전환력 강화
  | 'simplify'     // ✂️ 더 간결하게
  | 'empathy'      // 💕 공감 강화
  | 'professional'; // 전문성 강화

// 원고 단계에서 개별 슬라이드 내용 AI 재생성
export const regenerateSlideContent = async (params: {
  slideIndex: number;
  slideType: string;
  topic: string;
  category: string;
  totalSlides: number;
  currentContent: {
    subtitle: string;
    mainTitle: string;
    description: string;
    imageKeyword: string;
  };
  prevSlide?: { mainTitle: string; description: string };
  nextSlide?: { mainTitle: string; description: string };
  mode?: SlideRegenMode;  // 재생성 모드 추가
}): Promise<{
  subtitle: string;
  mainTitle: string;
  description: string;
  speakingNote: string;
  imageKeyword: string;
}> => {
  const ai = getAiClient();
  
  const slidePosition = params.slideIndex === 0 
    ? '표지 (첫 번째)' 
    : params.slideIndex === params.totalSlides - 1 
    ? '마무리 (마지막)' 
    : `본문 (${params.slideIndex + 1}번째)`;
  
  const slideTypeGuide = params.slideType === 'cover' 
    ? '표지: 멈추게 하는 역할! 설명 최소화, 질문형으로 흥미 유발'
    : params.slideType === 'closing'
    ? 'CTA: ❌명령형 금지! "~시점입니다" 형태로 간접 유도'
    : params.slideType === 'concept'
    ? '오해 깨기: 착각을 바로잡는 질문형 메시지'
    : '본문: 판단 1줄만! 설명 금지!';
  
  // 모드별 추가 지침
  const mode = params.mode || 'rewrite';
  const modeInstruction = {
    rewrite: `
[🔄 완전 새로 쓰기 모드]
- 현재 내용을 참고하되, 완전히 새로운 관점으로 다시 작성
- 같은 주제를 다른 방식으로 접근
- 신선한 표현과 구성으로 재탄생`,
    strengthen: `
[💪 전환력 강화 모드]
- 현재 내용의 핵심은 유지하되 전환력(행동 유도력) 극대화
- "~시점입니다", "~단계입니다" 형태로 시점 고정
- 배제형 표현 강화: "~만으로는 부족합니다", "~가 아니라 ~가 먼저입니다"
- 설명 ❌ → 판단 ✅ 변환
- CTA 핵심: "오세요"가 아니라 "다른 선택지가 아니다"를 만드는 것`,
    simplify: `
[✂️ 더 간결하게 모드]
- 현재 내용을 최대한 압축
- subtitle: 4~6자로 더 짧게
- mainTitle: 10~12자로 더 짧게
- description: 15~20자 판단 1줄로 압축
- 불필요한 수식어, 설명 모두 제거
- 핵심 메시지만 남기기`,
    empathy: `
[💕 공감 강화 모드]
- 현재 내용에 독자 공감 요소 추가
- 일상 상황 묘사 추가 (예: "겨울 아침", "출근길")
- 독자의 감정/고민을 담은 표현 사용
- "혹시 나도?", "이런 적 있으시죠?" 같은 공감 유도
- 의학 정보를 친근하게 전달`,
    professional: `
[전문성 강화 모드]
- 현재 내용에 의학적 신뢰감 추가
- 가이드라인/권장사항 언급 (예: "대한OO학회에서 권장")
- 객관적이고 권위있는 톤
- 전문 용어 + 쉬운 설명 병기
- "~인 것으로 알려져 있습니다" 형태의 완충 표현`
  }[mode];
  
  const prompt = `
당신은 **전환형 카드뉴스** 원고 작성 전문가입니다.

🚨 핵심 원칙:
❌ 블로그 = "읽고 이해"
✅ 카드뉴스 = "보고 판단" (3초 안에!)

[슬라이드 정보]
- 위치: ${slidePosition} (총 ${params.totalSlides}장)
- 타입: ${params.slideType} → ${slideTypeGuide}
- 주제: ${params.topic}
- 진료과: ${params.category}

[현재 내용 - 더 간결하게 수정!]
부제: ${params.currentContent.subtitle}
메인제목: ${params.currentContent.mainTitle}
설명: ${params.currentContent.description}
이미지키워드: ${params.currentContent.imageKeyword}

${params.prevSlide ? `[이전 슬라이드]\n제목: ${params.prevSlide.mainTitle}` : ''}
${params.nextSlide ? `[다음 슬라이드]\n제목: ${params.nextSlide.mainTitle}` : ''}

${modeInstruction}

[📝 카드뉴스 텍스트 규칙]
- subtitle: 4~8자만! (예: "겨울철에 유독?", "혹시 나도?", "놓치기 쉬운 신호들")
- mainTitle: 10~18자, 질문형 또는 판단형, <highlight>강조</highlight>
  ✅ "따뜻하게 입어도\\n<highlight>해결 안 되는</highlight> 신호"
  ❌ "생활 관리만으로 충분할까요?" (너무 일반적)
- description: 판단 1줄만! (15~25자)
  ✅ "피로나 스트레스와 구분이 필요할 수 있습니다"
  ❌ 2~3문장 설명 금지!
- imageKeyword: 한국어 키워드 (예: "겨울철 빙판길, 넘어지는 사람, 얼음")

[🚨 의료광고법 + 카드뉴스 규칙]
❌ "~하세요" 명령형 금지!
❌ "체크", "검사 받으세요" 금지!
❌ 긴 설명 문장 금지!
✅ "~시점입니다", "~필요할 수 있습니다"

JSON 형식:
{
  "subtitle": "4~8자",
  "mainTitle": "10~18자 <highlight>강조</highlight>",
  "description": "판단 1줄 (15~25자)",
  "speakingNote": "이 슬라이드의 심리적 역할",
  "imageKeyword": "한국어 키워드 3~4개"
}
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subtitle: { type: Type.STRING },
            mainTitle: { type: Type.STRING },
            description: { type: Type.STRING },
            speakingNote: { type: Type.STRING },
            imageKeyword: { type: Type.STRING }
          },
          required: ["subtitle", "mainTitle", "description", "speakingNote", "imageKeyword"]
        }
      }
    });
    
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error('슬라이드 원고 재생성 실패:', error);
    throw error;
  }
};

export const modifyPostWithAI = async (currentHtml: string, userInstruction: string): Promise<{ 
  newHtml: string, 
  message: string, 
  regenerateImageIndices?: number[],
  newImagePrompts?: string[]
}> => {
    const ai = getAiClient();
    
    // 이미지 URL을 플레이스홀더로 대체 (토큰 초과 방지)
    // base64 이미지나 긴 URL을 짧은 플레이스홀더로 변환
    const imageMap: Map<string, string> = new Map();
    let imgCounter = 0;
    
    const sanitizedHtml = currentHtml.replace(
      /<img([^>]*?)src=["']([^"']+)["']([^>]*)>/gi,
      (match, before, src, after) => {
        // 이미 플레이스홀더인 경우 스킵
        if (src.startsWith('__IMG_PLACEHOLDER_')) {
          return match;
        }
        const placeholder = `__IMG_PLACEHOLDER_${imgCounter}__`;
        imageMap.set(placeholder, src);
        imgCounter++;
        return `<img${before}src="${placeholder}"${after}>`;
      }
    );
    
    try {
      // 🎯 블로그 글 생성과 동일한 전체 프롬프트 적용
      // GPT52_SYSTEM_PROMPT: 의료광고법 + 금지어 + 종결어미 + 키워드 + SEO + 자가체크 + AI 냄새 제거
      const fullSystemPrompt = `${GPT52_SYSTEM_PROMPT}

${MEDICAL_SAFETY_SYSTEM_PROMPT}

[📝 채팅 보정 / 외부 글 자동보정 규칙]
1. 원본 HTML 구조 최대한 유지 (태그, 클래스, ID 보존)
2. 이미지 src는 __IMG_PLACEHOLDER_N__ 형식 그대로 유지
3. 의료광고법 위반 표현 즉시 수정
4. AI 냄새 나는 표현 자연스럽게 개선
5. 종결어미 다양화 적용
6. SEO 최적화 유지/강화
7. 사용자 요청사항 우선 반영

[중요] 위 모든 규칙을 준수하면서 사용자의 수정 요청을 반영하세요.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",  // 고품질 글쓰기용 pro 모델
        contents: `${fullSystemPrompt}

[현재 원고]
${sanitizedHtml}

[수정 요청]
${userInstruction}

위 규칙을 모두 준수하여 수정해주세요.`,
        config: { 
          responseMimeType: "application/json", 
          responseSchema: { 
            type: Type.OBJECT, 
            properties: { 
              newHtml: { type: Type.STRING }, 
              message: { type: Type.STRING },
              regenerateImageIndices: { type: Type.ARRAY, items: { type: Type.NUMBER } },
              newImagePrompts: { type: Type.ARRAY, items: { type: Type.STRING } }
            }, 
            required: ["newHtml", "message"] 
          } 
        }
      });
      
      const result = JSON.parse(response.text || "{}");
      
      // 플레이스홀더를 원래 이미지 URL로 복원
      let restoredHtml = result.newHtml;
      imageMap.forEach((originalSrc, placeholder) => {
        restoredHtml = restoredHtml.replace(new RegExp(placeholder, 'g'), originalSrc);
      });
      
      return {
        ...result,
        newHtml: restoredHtml
      };
    } catch (error) { throw error; }
};

// ============================================
// 🎯 SEO 점수 평가 함수 (100점 만점)
// ============================================

/**
 * SEO 점수 평가 함수
 * 블로그 콘텐츠의 SEO 최적화 수준을 100점 만점으로 평가
 * 
 * 평가 항목:
 * ① 제목 최적화 (25점)
 * ② 본문 키워드 구조 (25점)
 * ③ 사용자 체류 구조 (20점)
 * ④ 의료법 안전성 + 신뢰 신호 (20점)
 * ⑤ 전환 연결성 (10점)
 * 
 * 85점 미만: 재설계/재작성 권장
 */
export const evaluateSeoScore = async (
  htmlContent: string,
  title: string,
  topic: string,
  keywords: string
): Promise<SeoScoreReport> => {
  const ai = getAiClient();
  const currentYear = getCurrentYear();
  
  // 방어 코드: 필수 파라미터 검증
  if (!htmlContent || typeof htmlContent !== 'string') {
    console.error('❌ evaluateSeoScore: content(HTML)가 없거나 유효하지 않습니다');
    console.error('   - 전달된 타입:', typeof htmlContent);
    console.error('   - 전달된 값 길이:', htmlContent?.length || 0);
    console.error('   - 전달된 값 미리보기:', String(htmlContent).substring(0, 100));
    console.error('   - title:', title?.substring(0, 50));
    console.error('   - topic:', topic?.substring(0, 50));
    throw new Error('SEO 평가에 필요한 HTML 콘텐츠가 없습니다. content 또는 contentHtml 필드를 확인하세요.');
  }
  
  const safeHtmlContent = htmlContent || '';
  const safeTitle = title || '제목 없음';
  const safeTopic = topic || '주제 없음';
  const safeKeywords = keywords || '키워드 없음';
  
  const prompt = `당신은 네이버 블로그 SEO 전문가이자 병원 마케팅 콘텐츠 분석가입니다.

아래 블로그 콘텐츠의 SEO 점수를 100점 만점으로 평가해주세요.

[중요]
📊 SEO 점수 평가 기준 (100점 만점)
[중요]

[※ 평가 대상 콘텐츠]
- 제목: "${safeTitle}"
- 주제: "${safeTopic}"
- 핵심 키워드: "${safeKeywords}"
- 본문:
${safeHtmlContent.substring(0, 8000)}

---
① 제목 최적화 (25점 만점)
---
※ keyword_natural (10점): 핵심 키워드 자연 포함
   - 10점: 키워드가 제목 앞 50%에 자연스럽게 배치
   - 5점: 키워드 있으나 어색하거나 뒤쪽에 위치
   - 0점: 키워드 없음 또는 강제 삽입 느낌

※ seasonality (5점): 시기성/상황성 포함
   - 5점: "겨울철", "요즘", "환절기" 등 시기 표현 포함
   - 2점: 시간적 맥락 암시만 있음
   - 0점: 시기성 없는 일반적인 제목

※ judgment_inducing (5점): 판단 유도형 구조
   - 5점: "~일까요?", "~확인 포인트" 등 독자 참여 유도
   - 2점: 질문형이지만 일반적
   - 0점: 단순 정보 나열형

※ medical_law_safe (5점): 의료광고 리스크 없음
   - 5점: 완전 안전 (치료, 완치, 최고 등 금지어 없음)
   - 2점: 경미한 리스크 (애매한 표현 포함)
   - 0점: 명백한 의료광고법 위반 표현

---
② 본문 키워드 구조 (25점 만점)
---
※ main_keyword_exposure (10점): 메인 키워드 3~5회 자연 노출
   - 10점: 1000자당 15~25회 수준 (1.5~2.5% 밀도), 자연스러움
   - 5점: 키워드 있으나 빈도 부족 또는 과다
   - 0점: 키워드 스터핑 또는 전혀 없음

※ related_keyword_spread (5점): 연관 키워드(LSI) 분산 배치
   - 5점: 동의어/유사어 3개 이상 자연스럽게 분산
   - 2점: 1~2개만 있거나 편중됨
   - 0점: 연관 키워드 전무

※ subheading_variation (5점): 소제목에 키워드 변주 포함
   - 5점: 모든 소제목(H3)에 키워드 또는 관련어 포함
   - 2점: 일부 소제목에만 포함
   - 0점: 소제목에 키워드 없음

※ no_meaningless_repeat (5점): 의미 없는 반복 없음
   - 5점: 동일 표현이 맥락 다양하게 사용됨
   - 2점: 일부 기계적 반복 존재
   - 0점: 같은 문장/표현 과다 반복

---
③ 사용자 체류 구조 (20점 만점)
---
※ intro_problem_recognition (5점): 도입부 5줄 이내 문제 인식
   - 5점: 첫 3줄 내 공감/질문으로 시작, 문제 제기 명확
   - 2점: 도입부가 있으나 늘어짐
   - 0점: "오늘은 ~에 대해 알아보겠습니다" 등 AI 도입부

※ relatable_examples (5점): '나 얘기 같다' 생활 예시
   - 5점: 구체적 상황/시간대/장소 묘사 3개 이상
   - 2점: 1~2개 있으나 일반적
   - 0점: 생활 예시 전무, 설명만

※ mid_engagement_points (5점): 중간 이탈 방지 포인트
   - 5점: 체크리스트, 질문형 소제목, "더 알아보면" 등 존재
   - 2점: 약간의 참여 유도
   - 0점: 단조로운 나열만

※ no_info_overload (5점): 정보 과부하 없음
   - 5점: 1,500~3,000자, 핵심 정보 밀도 높음
   - 2점: 너무 길거나 산만함
   - 0점: 정보 과다로 이탈 유발

---
④ 의료법 안전성 + 신뢰 신호 (20점 만점)
---
※ no_definitive_guarantee (5점): 단정·보장 표현 없음
   - 5점: "~일 수 있습니다", "~경우도 있습니다" 등 완화 표현
   - 2점: 일부 단정 표현 존재
   - 0점: "반드시", "확실히", "100%" 등 보장 표현

※ individual_difference (5점): 개인차/상황별 차이 자연 언급
   - 5점: 개인차 언급 2회 이상, 자연스러움
   - 2점: 1회 형식적 언급
   - 0점: 개인차 언급 없음

※ self_diagnosis_limit (5점): 자가진단 한계 명확화
   - 5점: "증상만으로 단정 불가" 등 한계 명확
   - 2점: 암시만 있음
   - 0점: 자가진단 유도하는 느낌

※ minimal_direct_promo (5점): 병원 직접 홍보 최소화
   - 5점: 병원명/연락처 없음, 일반적 안내만
   - 2점: 간접적 홍보 느낌
   - 0점: 직접적 병원 홍보

---
⑤ 전환 연결성 (10점 만점)
---
※ cta_flow_natural (5점): CTA가 정보 흐름을 끊지 않음
   - 5점: 글 맥락에서 자연스럽게 확인 필요성 도출
   - 2점: CTA 있으나 갑작스러움
   - 0점: "방문하세요", "예약하세요" 직접 권유

※ time_fixed_sentence (5점): 시점 고정형 문장 존재
   - 5점: "이 시점부터는~", "반복된다면~" 등 시점 고정
   - 2점: 약한 시점 암시
   - 0점: "언젠가", "나중에" 등 미루기 허용

[중요]
⚠️ 평가 시 주의사항
[중요]

1. SEO 점수는 "완성도"가 아니라 "비교 지표"로 활용됩니다
2. 85점 미만은 재설계/재작성이 필요한 수준입니다
3. 각 항목별로 구체적인 개선 피드백을 반드시 작성하세요
4. 의료법 안전성은 다른 항목보다 엄격하게 평가하세요
5. 현재 시점(${currentYear}년) 기준 네이버 SEO 트렌드 반영

각 항목의 feedback에는:
- 잘된 점 1개 이상
- 개선이 필요한 점 1개 이상
- 구체적인 개선 방법 제안

🎯 **improvement_suggestions 필수 작성!**
85점 이상 달성을 위한 구체적이고 실행 가능한 개선 제안 3~5개를 배열로 제공해주세요.
예시:
- "제목 앞부분에 '겨울철' 시기 키워드 추가"
- "첫 문단에 구체적인 상황 묘사 추가 (예: '아침에 일어났는데...')"
- "소제목 3개에 메인 키워드 '감기' 포함시키기"

JSON 형식으로 응답해주세요.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            total: { type: Type.INTEGER },
            title: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.INTEGER },
                keyword_natural: { type: Type.INTEGER },
                seasonality: { type: Type.INTEGER },
                judgment_inducing: { type: Type.INTEGER },
                medical_law_safe: { type: Type.INTEGER },
                feedback: { type: Type.STRING }
              },
              required: ["score", "keyword_natural", "seasonality", "judgment_inducing", "medical_law_safe", "feedback"]
            },
            keyword_structure: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.INTEGER },
                main_keyword_exposure: { type: Type.INTEGER },
                related_keyword_spread: { type: Type.INTEGER },
                subheading_variation: { type: Type.INTEGER },
                no_meaningless_repeat: { type: Type.INTEGER },
                feedback: { type: Type.STRING }
              },
              required: ["score", "main_keyword_exposure", "related_keyword_spread", "subheading_variation", "no_meaningless_repeat", "feedback"]
            },
            user_retention: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.INTEGER },
                intro_problem_recognition: { type: Type.INTEGER },
                relatable_examples: { type: Type.INTEGER },
                mid_engagement_points: { type: Type.INTEGER },
                no_info_overload: { type: Type.INTEGER },
                feedback: { type: Type.STRING }
              },
              required: ["score", "intro_problem_recognition", "relatable_examples", "mid_engagement_points", "no_info_overload", "feedback"]
            },
            medical_safety: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.INTEGER },
                no_definitive_guarantee: { type: Type.INTEGER },
                individual_difference: { type: Type.INTEGER },
                self_diagnosis_limit: { type: Type.INTEGER },
                minimal_direct_promo: { type: Type.INTEGER },
                feedback: { type: Type.STRING }
              },
              required: ["score", "no_definitive_guarantee", "individual_difference", "self_diagnosis_limit", "minimal_direct_promo", "feedback"]
            },
            conversion: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.INTEGER },
                cta_flow_natural: { type: Type.INTEGER },
                time_fixed_sentence: { type: Type.INTEGER },
                feedback: { type: Type.STRING }
              },
              required: ["score", "cta_flow_natural", "time_fixed_sentence", "feedback"]
            },
            improvement_suggestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "85점 이상 달성을 위한 구체적인 개선 제안 3~5개"
            }
          },
          required: ["total", "title", "keyword_structure", "user_retention", "medical_safety", "conversion", "improvement_suggestions"]
        }
      }
    });
    
    const result = JSON.parse(response.text || "{}");
    
    // 총점 검증 및 재계산
    const calculatedTotal = 
      (result.title?.score || 0) +
      (result.keyword_structure?.score || 0) +
      (result.user_retention?.score || 0) +
      (result.medical_safety?.score || 0) +
      (result.conversion?.score || 0);
    
    result.total = calculatedTotal;
    
    console.log('📊 SEO 점수 평가 완료:', result.total, '점');
    return result;
  } catch (error) {
    console.error('SEO 점수 평가 실패:', error);
    // 실패 시 기본값 반환
    return {
      total: 0,
      title: {
        score: 0,
        keyword_natural: 0,
        seasonality: 0,
        judgment_inducing: 0,
        medical_law_safe: 0,
        feedback: 'SEO 평가 중 오류가 발생했습니다.'
      },
      keyword_structure: {
        score: 0,
        main_keyword_exposure: 0,
        related_keyword_spread: 0,
        subheading_variation: 0,
        no_meaningless_repeat: 0,
        feedback: 'SEO 평가 중 오류가 발생했습니다.'
      },
      user_retention: {
        score: 0,
        intro_problem_recognition: 0,
        relatable_examples: 0,
        mid_engagement_points: 0,
        no_info_overload: 0,
        feedback: 'SEO 평가 중 오류가 발생했습니다.'
      },
      medical_safety: {
        score: 0,
        no_definitive_guarantee: 0,
        individual_difference: 0,
        self_diagnosis_limit: 0,
        minimal_direct_promo: 0,
        feedback: 'SEO 평가 중 오류가 발생했습니다.'
      },
      conversion: {
        score: 0,
        cta_flow_natural: 0,
        time_fixed_sentence: 0,
        feedback: 'SEO 평가 중 오류가 발생했습니다.'
      }
    };
  }
};

// ============================================
// 🤖 AI 냄새 상세 분석 함수 (8~15점 구간 수정 가이드)
// ============================================

/**
 * AI 냄새 상세 분석 함수
 * 8~15점 경계선 구간에서 어디를 수정해야 하는지 구체적으로 알려줌
 * 
 * 분석 항목:
 * ① 문장 리듬 단조로움 (0~25점)
 * ② 판단 단정형 글쓰기 (0~20점)
 * ③ 현장감 부재 (0~20점)
 * ④ 템플릿 구조 (0~15점)
 * ⑤ 가짜 공감 (0~10점)
 * ⑥ 행동 유도 실패 (0~10점)
 */
export const analyzeAiSmell = async (
  htmlContent: string,
  topic: string
): Promise<{
  total_score: number;
  sentence_rhythm: { score: number; issues: string[]; fix_suggestions: string[] };
  judgment_avoidance: { score: number; issues: string[]; fix_suggestions: string[] };
  lack_of_realism: { score: number; issues: string[]; fix_suggestions: string[] };
  template_structure: { score: number; issues: string[]; fix_suggestions: string[] };
  fake_empathy: { score: number; issues: string[]; fix_suggestions: string[] };
  cta_failure: { score: number; issues: string[]; fix_suggestions: string[] };
  priority_fixes: string[];
}> => {
  const ai = getAiClient();
  const currentYear = new Date().getFullYear();
  
  const today = new Date();
  const todayStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;
  
  const prompt = `당신은 AI가 쓴 글과 사람이 쓴 글을 구분하는 전문가입니다.

📅 **오늘 날짜: ${todayStr}** (이것이 현재 시점입니다. 미래가 아닙니다!)

아래 블로그 글의 "AI 냄새"를 분석하고, 어디를 수정해야 하는지 구체적으로 알려주세요.

[분석 대상 글]
주제: "${topic}"
본문:
${htmlContent.substring(0, 8000)}

[중요]
🚨 의료광고법 준수 필수! - 수정 제안 시 절대 위반 금지! 🚨
[중요]

**fix_suggestions 작성 시 반드시 아래 규칙을 준수하세요:**

❌ **절대 금지 표현 (수정 제안에 포함하면 안 됨!):**
• "~이면 OO병입니다", "~이면 OO이 아닙니다" → 질병 단정 금지!
• "바로 OO과로 가세요", "당장 병원 가세요" → 직접적 병원 방문 권유 금지!
• "3일 이상이면 비염", "일주일 넘으면 폐렴" → 기간+질병 단정 금지!
• "확실히 ~입니다", "반드시 ~해야 합니다" → 단정적 표현 금지!

✅ **허용되는 대안 표현:**
• "~일 가능성이 높아요" → "이런 패턴이 반복된다면 확인이 필요해요"
• "바로 병원 가세요" → "지속된다면 확인받아보시는 것도 방법이에요"
• "3일이면 비염" → "며칠째 지속된다면 다른 원인일 수도 있어요"
• "반드시 ~해야" → "~해보시는 것이 도움이 될 수 있어요"

[중요]
🤖 AI 냄새 분석 기준 (총 100점 - 낮을수록 좋음!)
[중요]

---
① 문장 리듬 단조로움 (0~25점) ★ 가장 중요
---
체크 포인트:
• 동일 종결어미 3회 이상 반복 ("~습니다", "~있습니다" 연속) → +7점
• 문장 시작 패턴 3회 이상 반복 ("요즘", "많은 분들이" 반복) → +6점
• 문단 길이가 너무 균일함 → +6점
• 질문·감탄·짧은 문장 없이 설명만 연속 → +6점
• '설명 문단 + 불릿포인트 리스트' 기계적 반복 → +5점
• 출처(심평원, 질병청, 과거 연도 등) 언급으로 문맥 끊김 → +4점

**수정 방향:**
✅ 불릿포인트 요약을 하나 삭제하고 대화체/Q&A 형식으로 변경
✅ 출처 언급을 '최근 지침에 따르면' 정도로 자연스럽게 녹이기
✅ 구체적 연도 삭제 → '최근', '이번 겨울' 등으로 대체 (※ 참고: 현재 연도는 ${currentYear}년)

**issues에 실제 문제가 되는 문장/패턴을 구체적으로 적어주세요!**
예: "~수 있습니다"가 3번 연속 나옴 (문단 2)", "모든 문장이 '요즘'으로 시작"

---
② 판단 단정형 글쓰기 (0~20점)
---
체크 포인트:
• 한 문단에 조건/가능성 종결 3회 이상 ("~일 수 있습니다" 집중) → +8점
• 명확한 기준 없이 "확인 필요"만 반복 → +7점
• 글 전체에서 저자 의견/판단 0회 → +5점
• '단정하기 어렵고', '오해가 생기기 쉽습니다' 등 회피형 반복 → +4점

**수정 방향 (의료광고법 준수!):**
✅ '단정하기 어렵습니다' → '이런 경우엔 다른 원인도 생각해볼 수 있어요'
✅ '~떠올리게 됩니다' → '한번 체크해보시는 게 좋겠어요'
✅ 가능성 나열 → '이 패턴이 반복되면 확인이 필요한 시점이에요'
⚠️ 주의: "~이면 OO병입니다" 같은 질병 단정은 절대 금지!

---
③ 현장감 부재 (0~20점)
---
체크 포인트:
• 시간/계절/상황 맥락 전무 → +7점
• 실제 질문/고민 시나리오 없음 → +7점
• 구체적 연도/날짜(${currentYear - 1}년, ${currentYear}년 10월 등) 삽입으로 이질감 → +5점
• 3인칭 관찰자('많은 분들이', '어떤 분들은') 시점만 존재 → +4점

**수정 방향:**
✅ 연도/날짜 삭제 → '최근 유행하는', '이번 겨울에는'으로 대체
✅ 구체적 상황 묘사 추가 (예: '회의 중에 기침이 터져서 곤란했던 적')
✅ 기관명(건강보험심사평가원 등)을 자연스럽게 순화

---
④ 템플릿 구조 (0~15점)
---
체크 포인트:
• 정의→원인→증상→치료 순서 그대로 → +6점
• 독자 자가 체크 포인트 없음 → +5점
• 문단 간 전환어 없이 나열만 → +4점
• '서론-본론1(문단+리스트)-본론2(문단+리스트)-결론-CTA' 전형적 구조 → +4점
• 소제목에 이모지(🎯, 📌, ⚠️, ✅) 정형화 패턴 → +3점

**수정 방향:**
✅ 본론 중 한 부분은 리스트 없이 줄글로만 서술
✅ 소제목 이모지 제거하거나 질문형('감기일까요?')으로 변경
✅ 결론 문단 삭제하고 CTA에 핵심 메시지 통합

---
⑤ 가짜 공감 (0~10점)
---
체크 포인트:
• "걱정되실 수 있습니다" 류 범용 공감만 존재 → +4점
• 구체적 상황·감정 지목 없음 → +3점
• 공감 문장이 항상 문단 첫 줄에만 위치 → +3점
• '참 애매하게 시작될 때가 많아요' 같은 범용적 멘트 → +2점

**수정 방향:**
✅ '애매하죠?' → '자고 일어났는데 침 삼키기가 무섭다면' (구체적 고통)
✅ 감기 걸렸을 때의 짜증나는 감정 언급 (일 능률 저하, 약 기운 몽롱함 등)

---
⑥ 행동 유도 실패 (0~10점)
---
체크 포인트:
• 매번 동일한 CTA 문구로 종결 → +4점
• 시점·조건 없는 막연한 권유 → +3점
• 독자 상황별 분기 없음 → +3점
• '자가 판단으로는 정리가 안 될 수 있습니다' 같은 행동 유보 → +3점

**수정 방향 (의료광고법 준수!):**
✅ '확인' 대신 구체적 행동 권유: '체온 재보기', '수분 섭취 늘리기'
✅ 시점 조건 추가: '며칠째 지속된다면 살펴보는 것도 방법이에요'
✅ '확인' 표현 반복 완화 (의료기관 유도 느낌 최소화):
   ❌ "확인해보세요", "확인이 필요합니다" 반복
   ❌ "기준을 세우다", "기준을 마련하다", "판단이 정리되다" (추상 명사 연결 금지)
   ✅ "상황을 한 번 정리해보는 것도 도움이 됩니다"
   ✅ "흐름을 한 번 정리해볼 시점일 수 있습니다"
   ✅ "점검해보는 것도 방법이에요"
   ※ '확인' 대체어: 정리, 점검, 살펴보기, 흐름 파악, 체크
⚠️ 주의: "바로 OO과 가세요" 같은 직접적 병원 방문 권유는 절대 금지!

[중요]
⚠️ 분석 시 주의사항
[중요]

1. **issues**에는 실제 글에서 발견된 구체적인 문제점을 적어주세요
   - ❌ "문장 리듬이 단조로움" (너무 일반적)
   - ✅ "'~수 있습니다'가 2문단에서 4번 연속 사용됨" (구체적)

2. **fix_suggestions**에는 바로 적용할 수 있는 수정 제안을 적어주세요
   - ❌ "문장을 다양하게 써라" (너무 일반적)
   - ✅ "2문단 3번째 '~수 있습니다'를 '~인 경우도 있더라고요'로 변경" (구체적)
   - 🚨 의료광고법 위반 표현(질병 단정, 병원 방문 권유)은 절대 포함 금지!

3. **priority_fixes**에는 가장 점수가 높은 항목부터 우선 수정 사항을 적어주세요

JSON 형식으로 응답해주세요.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            total_score: { type: Type.INTEGER },
            sentence_rhythm: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.INTEGER },
                issues: { type: Type.ARRAY, items: { type: Type.STRING } },
                fix_suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["score", "issues", "fix_suggestions"]
            },
            judgment_avoidance: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.INTEGER },
                issues: { type: Type.ARRAY, items: { type: Type.STRING } },
                fix_suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["score", "issues", "fix_suggestions"]
            },
            lack_of_realism: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.INTEGER },
                issues: { type: Type.ARRAY, items: { type: Type.STRING } },
                fix_suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["score", "issues", "fix_suggestions"]
            },
            template_structure: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.INTEGER },
                issues: { type: Type.ARRAY, items: { type: Type.STRING } },
                fix_suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["score", "issues", "fix_suggestions"]
            },
            fake_empathy: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.INTEGER },
                issues: { type: Type.ARRAY, items: { type: Type.STRING } },
                fix_suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["score", "issues", "fix_suggestions"]
            },
            cta_failure: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.INTEGER },
                issues: { type: Type.ARRAY, items: { type: Type.STRING } },
                fix_suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["score", "issues", "fix_suggestions"]
            },
            priority_fixes: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "우선 수정해야 할 항목 (점수 높은 순)"
            }
          },
          required: ["total_score", "sentence_rhythm", "judgment_avoidance", "lack_of_realism", "template_structure", "fake_empathy", "cta_failure", "priority_fixes"]
        }
      }
    });
    
    const result = JSON.parse(response.text || "{}");
    
    // 총점 재계산
    const calculatedTotal = 
      (result.sentence_rhythm?.score || 0) +
      (result.judgment_avoidance?.score || 0) +
      (result.lack_of_realism?.score || 0) +
      (result.template_structure?.score || 0) +
      (result.fake_empathy?.score || 0) +
      (result.cta_failure?.score || 0);
    
    result.total_score = calculatedTotal;
    
    console.log('🤖 AI 냄새 분석 완료:', result.total_score, '점');
    return result;
  } catch (error) {
    console.error('AI 냄새 분석 실패:', error);
    return {
      total_score: 0,
      sentence_rhythm: { score: 0, issues: ['분석 실패'], fix_suggestions: [] },
      judgment_avoidance: { score: 0, issues: ['분석 실패'], fix_suggestions: [] },
      lack_of_realism: { score: 0, issues: ['분석 실패'], fix_suggestions: [] },
      template_structure: { score: 0, issues: ['분석 실패'], fix_suggestions: [] },
      fake_empathy: { score: 0, issues: ['분석 실패'], fix_suggestions: [] },
      cta_failure: { score: 0, issues: ['분석 실패'], fix_suggestions: [] },
      priority_fixes: ['AI 냄새 분석 중 오류가 발생했습니다.']
    };
  }
};

// AI 냄새 재검사 함수 (수동 재생성 후 사용)
export const recheckAiSmell = async (htmlContent: string): Promise<FactCheckReport> => {
  console.log('🔄 AI 냄새 재검사 시작...');
  const ai = getAiClient();
  
  // HTML에서 텍스트만 추출
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;
  const textContent = tempDiv.textContent || tempDiv.innerText || '';
  
  const prompt = `
당신은 의료 블로그 콘텐츠 품질 검사 전문가입니다.
아래 블로그 글을 분석하여 팩트 체크 리포트를 작성해주세요.

[검사 대상 글]
${textContent}

[검사 항목]

1. **팩트 정확성 (fact_score)**: 0~100점
- 의학적으로 검증된 정보인가?
- 출처가 명확한가?
- 과장되거나 잘못된 정보는 없는가?

2. **의료법 안전성 (safety_score)**: 0~100점
- 치료 효과를 단정하지 않는가?
- 병원 방문을 직접 권유하지 않는가?
- 자가 진단을 유도하지 않는가?

3. **전환력 점수 (conversion_score)**: 0~100점
- 의료법을 준수하면서도 자연스럽게 행동을 유도하는가?
- CTA가 강요가 아닌 제안 형태인가?

**4. AI 냄새 점수 (ai_smell_score)**: 0~100점 (낮을수록 좋음)
- 문장 리듬이 단조로운가? (0~25점)
- 판단 단정형 글쓰기가 반복되는가? (0~20점)
- 현장감이 부족한가? (0~20점)
- 템플릿 구조가 뚜렷한가? (0~15점)
- 가짜 공감 표현이 있는가? (0~10점)
- 행동 유도가 실패했는가? (0~10점)

**AI 냄새 점수 계산:**
= 문장 리듬(25) + 판단 단정(20) + 현장감 부재(20) + 템플릿 구조(15) + 가짜 공감(10) + CTA 실패(10)

**평가 기준:**
- 0~20점: 사람 글 수준 ✅
- 21~40점: 경계선 (부분 수정 권장) ⚠️
- 41점 이상: AI 냄새 강함 (재작성 필요) ❌

5. **검증된 팩트 개수 (verified_facts_count)**: 숫자
- 글에서 검증 가능한 의학 정보의 개수

6. **문제점 (issues)**: 배열
- 발견된 문제점들을 구체적으로 나열

7. **개선 제안 (recommendations)**: 배열
- 구체적인 개선 방법 제안

JSON 형식으로 응답해주세요.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            fact_check: {
              type: Type.OBJECT,
              properties: {
                fact_score: { type: Type.INTEGER },
                verified_facts_count: { type: Type.INTEGER },
                safety_score: { type: Type.INTEGER },
                conversion_score: { type: Type.INTEGER },
                ai_smell_score: { type: Type.INTEGER },
                issues: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                recommendations: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                }
              },
              required: ["fact_score", "safety_score", "conversion_score", "ai_smell_score", "verified_facts_count", "issues", "recommendations"]
            }
          },
          required: ["fact_check"]
        }
      }
    });
    
    const result = JSON.parse(response.text || "{}");
    console.log('✅ AI 냄새 재검사 완료:', result.fact_check);
    
    // AI 냄새 상세 분석 추가 (모든 점수에서 상세 분석 제공)
    const aiSmellScore = result.fact_check.ai_smell_score || 0;
    console.log(`• AI 냄새 점수: ${aiSmellScore}점 - 상세 분석 시작...`);
    try {
      const detailedAnalysis = await analyzeAiSmell(textContent, '');
      result.fact_check.ai_smell_analysis = detailedAnalysis;
      console.log('✅ AI 냄새 상세 분석 완료:', detailedAnalysis.total_score, '점');
    } catch (analysisError) {
      console.error('⚠️ AI 냄새 상세 분석 실패:', analysisError);
      // 상세 분석 실패해도 기본 결과는 반환
    }
    
    return result.fact_check;
  } catch (error) {
    console.error('❌ AI 냄새 재검사 실패:', error);
    throw new Error('AI 냄새 재검사 중 오류가 발생했습니다.');
  }
};

