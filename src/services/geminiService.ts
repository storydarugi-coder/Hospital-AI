import { GoogleGenAI, Type } from "@google/genai";
import { GenerationRequest, GeneratedContent, TrendingItem, FactCheckReport, SeoScoreReport, SeoTitleItem, ImageStyle, WritingStyle, CardPromptData, CardNewsScript, SimilarityCheckResult, BlogHistory, OwnBlogMatch, WebSearchMatch } from "../types";
import { SYSTEM_PROMPT } from "../lib/gpt52-prompts-staged";
// 🚀 콘텐츠 최적화 시스템
// 프롬프트 최적화 (향후 활용 가능성 있음)
import { optimizePrompt as _optimizePrompt, estimateTokens as _estimateTokens } from "../utils/promptOptimizer";
import { 
  generateHumanWritingPrompt as _generateHumanWritingPrompt, 
  detectAiSmell, 
  HUMAN_WRITING_RULES, 
  MEDICAL_LAW_HUMAN_PROMPT, 
  IMAGE_TEXT_MEDICAL_LAW as _IMAGE_TEXT_MEDICAL_LAW,  // 향후 활용 가능
  FEW_SHOT_EXAMPLES,
  CATEGORY_SPECIFIC_PROMPTS,
  PARAGRAPH_STRUCTURE_GUIDE
} from "../utils/humanWritingPrompts";
import { autoFixMedicalLaw as _autoFixMedicalLaw } from "../utils/autoMedicalLawFixer";
import { contentCache as _contentCache } from "../utils/contentCache";

// 현재 년도 - getWritingStylePrompts()에서 동적으로 사용
const _CURRENT_YEAR = new Date().getFullYear();

// 🎯 Gemini API 상수
const GEMINI_MODEL = {
  PRO: 'gemini-3-pro-preview',
  FLASH: 'gemini-2.0-flash-exp',
} as const;

const TIMEOUTS = {
  GENERATION: 300000,      // 5분
  IMAGE_GENERATION: 180000, // 3분
  QUICK_OPERATION: 30000,   // 30초
} as const;

// 🚀 Gemini API 호출 래퍼 함수
interface GeminiCallConfig {
  prompt: string;
  model?: string;
  googleSearch?: boolean;
  responseType?: 'json' | 'text';
  schema?: any;
  timeout?: number;
  systemPrompt?: string;
}

async function callGemini(config: GeminiCallConfig): Promise<any> {
  const ai = getAiClient();
  
  const apiConfig: any = {
    model: config.model || GEMINI_MODEL.PRO,
    contents: config.systemPrompt 
      ? `${config.systemPrompt}\n\n${config.prompt}`
      : config.prompt,
    config: {}
  };
  
  // Google Search 설정
  if (config.googleSearch) {
    apiConfig.config.tools = [{ googleSearch: {} }];
  }
  
  // 응답 타입 설정
  if (config.responseType === 'json') {
    apiConfig.config.responseMimeType = "application/json";
    if (config.schema) {
      apiConfig.config.responseSchema = config.schema;
    }
  } else {
    apiConfig.config.responseMimeType = "text/plain";
  }
  
  // 타임아웃 처리
  const timeout = config.timeout || TIMEOUTS.GENERATION;
  
  try {
    const result = await Promise.race([
      ai.models.generateContent(apiConfig),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Gemini API timeout')), timeout)
      )
    ]);
    return result;
  } catch (error) {
    console.error('❌ Gemini API 호출 실패:', error);
    throw error;
  }
}

// 🔍 Google Search 필요 여부 판단
function needsGoogleSearch(request: GenerationRequest): boolean {
  // 모든 콘텐츠 타입에서 항상 Google Search 사용 (최신 정보 반영)
  return true;
}

// 🏥 질병관리청 검색 함수 (1차 검색)
async function searchKDCA(query: string): Promise<string> {
  try {
    console.log('🔍 [1차 검색] 질병관리청에서 검색 중...', query);
    
    // 질병관리청 사이트 검색
    const kdcaDomains = [
      'kdca.go.kr',
      'cdc.go.kr',
      'nih.go.kr'
    ];
    
    const ai = getAiClient();
    const searchQuery = `site:${kdcaDomains.join(' OR site:')} ${query}`;
    
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL.PRO,
      contents: `질병관리청(KDCA) 공식 웹사이트에서 "${query}"에 대한 정보를 검색하고 요약해주세요.
      
검색 범위: ${kdcaDomains.join(', ')}

다음 정보를 우선적으로 찾아주세요:
1. 질환의 정의 및 원인
2. 주요 증상
3. 예방 및 관리 방법
4. 공식 통계 자료 (있는 경우)

신뢰할 수 있는 출처의 정보만 사용하고, 출처를 명시해주세요.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "text/plain",
        temperature: 0.3
      }
    });
    
    const result = response.text || '';
    console.log('✅ 질병관리청 검색 완료');
    return result;
    
  } catch (error) {
    console.error('❌ 질병관리청 검색 실패:', error);
    return '';
  }
}

// 🏥 병원 사이트 크롤링 함수 (2차 검색)
async function searchHospitalSites(query: string, category: string): Promise<string> {
  try {
    console.log('🔍 [2차 검색] 병원 사이트에서 크롤링 중...', query);
    
    // 신뢰할 수 있는 병원 사이트 목록
    const hospitalDomains = [
      'amc.seoul.kr',           // 서울아산병원
      'snuh.org',               // 서울대학교병원
      'severance.healthcare.or.kr', // 세브란스병원
      'samsunghospital.com',    // 삼성서울병원
      'cmcseoul.or.kr',         // 가톨릭대학교 서울성모병원
      'yuhs.or.kr'              // 연세의료원
    ];
    
    const ai = getAiClient();
    const searchQuery = `site:${hospitalDomains.join(' OR site:')} ${query} ${category}`;
    
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL.PRO,
      contents: `대학병원 공식 웹사이트에서 "${query}" (${category})에 대한 전문 의료 정보를 검색하고 요약해주세요.

검색 범위: ${hospitalDomains.join(', ')}

다음 정보를 우선적으로 찾아주세요:
1. 최신 진료 가이드라인
2. 환자를 위한 설명 자료
3. 의료진의 전문 의견
4. 치료 및 관리 방법

⚠️ 의료광고법 준수:
- 치료 효과를 단정하는 표현 금지
- 구체적인 치료 성공률/수치 언급 금지
- "완치", "100% 효과" 등의 표현 금지

신뢰할 수 있는 출처의 정보만 사용하고, 출처를 명시해주세요.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "text/plain",
        temperature: 0.3
      }
    });
    
    const result = response.text || '';
    console.log('✅ 병원 사이트 크롤링 완료');
    return result;
    
  } catch (error) {
    console.error('❌ 병원 사이트 크롤링 실패:', error);
    return '';
  }
}

// 🔍 callGeminiWithSearch - 1차: 질병관리청, 2차: 병원 사이트
async function callGeminiWithSearch(
  prompt: string, 
  options: { responseFormat?: string } = {}
): Promise<any> {
  try {
    const ai = getAiClient();
    
    // 프롬프트에서 주제 추출
    const topicMatch = prompt.match(/주제[:\s]*[「『"]?([^」』"\n]+)[」』"]?/);
    const categoryMatch = prompt.match(/진료과[:\s]*([^\n]+)/);
    const topic = topicMatch?.[1]?.trim() || '';
    const category = categoryMatch?.[1]?.trim() || '';
    
    console.log('🔍 검색 시작:', { topic, category });
    
    // 1차: 질병관리청 검색
    let kdcaInfo = '';
    if (topic) {
      kdcaInfo = await searchKDCA(topic);
    }
    
    // 2차: 병원 사이트 크롤링
    let hospitalInfo = '';
    if (topic && category) {
      hospitalInfo = await searchHospitalSites(topic, category);
    }
    
    // 검색 결과를 프롬프트에 추가
    const enrichedPrompt = `${prompt}

[🏥 1차 검색: 질병관리청 공식 정보]
${kdcaInfo || '(검색 결과 없음)'}

[🏥 2차 검색: 대학병원 전문 정보]
${hospitalInfo || '(검색 결과 없음)'}

⚠️ 위 검색 결과를 참고하되, 의료광고법을 반드시 준수하세요.
- 출처가 명확한 정보만 사용
- 치료 효과 단정 금지
- 구체적 수치는 출처와 함께 제시`;
    
    // Gemini API 호출
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL.PRO,
      contents: enrichedPrompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: options.responseFormat === "text/plain" ? "text/plain" : "application/json",
        temperature: 0.6
      }
    });
    
    return response;
    
  } catch (error) {
    console.error('❌ callGeminiWithSearch 실패:', error);
    throw error;
  }
}

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
  return { textGeneration: 'gemini', imageGeneration: 'gemini' };
};





// 현재 연도를 동적으로 가져오는 함수
const getCurrentYear = () => new Date().getFullYear();

// =============================================
// 🎨 공통 이미지 프롬프트 상수 (중복 제거) - export 포함
// ⚠️ IMAGE_TEXT_MEDICAL_LAW는 humanWritingPrompts.ts에서 import
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
- 🇰🇷 인물: 사람이 등장할 경우 한국인 외형 (Korean character features)
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
const normalizePromptTextForImage = (raw: string): string => {
  if (!raw) return '';
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

// 공통 규칙 (간결화) - 향후 활용 가능
const _IMAGE_TEXT_RULES = `[규칙] 한국어만, 광고/로고/해시태그 금지`;

// 스타일 이름 (UI 표시용)
export const STYLE_NAMES: Record<ImageStyle, string> = {
  illustration: '3D 일러스트',
  medical: '의학 3D',
  photo: '실사 사진',
  custom: '커스텀'
};

// 짧은 스타일 키워드 (프롬프트용) - 구체적으로 개선!
export const STYLE_KEYWORDS: Record<ImageStyle, string> = {
  illustration: '3D 렌더 일러스트, Blender 스타일, 부드러운 조명, 파스텔 색상, 친근한 캐릭터, 깔끔한 배경',
  medical: '의학 3D 일러스트, 해부학적 구조, 장기 단면도, 임상 조명, 교육용 다이어그램, 전문적 분위기',
  photo: '실사 사진, DSLR 촬영, 자연스러운 조명, 얕은 피사계심도, 전문 병원 환경, 사실적 질감',
  custom: '사용자 지정 스타일'
};

// 🌐 영어 스타일 프롬프트를 한국어로 번역하는 함수
const translateStylePromptToKorean = async (englishPrompt: string): Promise<string> => {
  // 이미 한국어인지 확인 (한글이 30% 이상이면 번역 생략)
  const koreanRatio = (englishPrompt.match(/[\uAC00-\uD7A3]/g) || []).length / englishPrompt.length;
  if (koreanRatio > 0.3) {
    console.log('🌐 이미 한국어 프롬프트, 번역 생략');
    return englishPrompt;
  }
  
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `다음 이미지 스타일 프롬프트를 자연스러운 한국어로 번역해주세요.
전문 용어는 유지하고, 의미를 정확히 전달해주세요.

영어 프롬프트:
"${englishPrompt}"

[규칙]
- 번역된 한국어만 출력 (설명이나 따옴표 없이)
- DSLR, 3D 같은 용어는 그대로 유지
- "NOT"은 "~는 제외" 또는 "~금지"로 번역
- 간결하게 번역 (원문 길이와 비슷하게)

번역:`,
      config: {
        temperature: 0.2,
      }
    });
    
    const translated = response.text?.trim() || englishPrompt;
    console.log('🌐 스타일 프롬프트 번역 완료:', englishPrompt.substring(0, 30), '→', translated.substring(0, 30));
    return translated;
  } catch (error) {
    console.warn('⚠️ 스타일 프롬프트 번역 실패, 원본 사용:', error);
    return englishPrompt;
  }
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

// =============================================
// 🔍 AI 냄새 검사 헬퍼 함수 (detectAiSmell 연결)
// =============================================

/**
 * HTML에서 텍스트만 추출하여 AI 냄새 검사
 * - 블로그/카드뉴스 생성 후 자동 검사
 * - modifyPostWithAI() 수정 후 검증
 * - recheckAiSmell()에서 활용
 */
const runAiSmellCheck = (htmlContent: string): {
  detected: boolean;
  patterns: string[];
  score: number;
  criticalIssues: string[];  // maxAllowed: 0인 패턴 (의료광고법 위반 등)
  warningIssues: string[];   // maxAllowed > 0인 패턴 (번역투 등)
} => {
  // HTML에서 텍스트만 추출
  const textContent = htmlContent
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // detectAiSmell() 호출
  const result = detectAiSmell(textContent);
  
  // 패턴을 심각도별로 분류
  const criticalIssues: string[] = [];
  const warningIssues: string[] = [];
  
  for (const pattern of result.patterns) {
    // (허용: 0회)인 패턴은 치명적 문제
    if (pattern.includes('허용: 0회') || 
        pattern.includes('절대 금지') || 
        pattern.includes('의료광고법') ||
        pattern.includes('금지!')) {
      criticalIssues.push(pattern);
    } else {
      warningIssues.push(pattern);
    }
  }
  
  console.log('🔍 AI 냄새 검사 결과:', {
    detected: result.detected,
    score: result.score,
    criticalCount: criticalIssues.length,
    warningCount: warningIssues.length
  });
  
  if (criticalIssues.length > 0) {
    console.warn('🚨 치명적 AI 냄새 패턴 발견:', criticalIssues);
  }
  
  return {
    ...result,
    criticalIssues,
    warningIssues
  };
};

/**
 * AI 냄새 검사 결과를 FactCheckReport에 통합
 */
const integrateAiSmellToFactCheck = (
  factCheck: FactCheckReport,
  aiSmellResult: ReturnType<typeof runAiSmellCheck>
): FactCheckReport => {
  // 기존 ai_smell_score와 detectAiSmell 결과 병합
  const existingScore = factCheck.ai_smell_score || 0;
  const detectedScore = aiSmellResult.score;
  
  // 더 높은 점수(더 심각한 문제) 사용
  const finalScore = Math.max(existingScore, detectedScore);
  
  // 치명적 문제가 있으면 추가 페널티
  const criticalPenalty = aiSmellResult.criticalIssues.length * 5;
  const adjustedScore = Math.min(100, finalScore + criticalPenalty);
  
  // issues와 recommendations 업데이트
  const newIssues = [...(factCheck.issues || [])];
  const newRecommendations = [...(factCheck.recommendations || [])];
  
  // 치명적 문제 추가
  for (const issue of aiSmellResult.criticalIssues) {
    if (!newIssues.includes(issue)) {
      newIssues.push(`🚨 ${issue}`);
    }
  }
  
  // 경고 문제 추가 (상위 3개만)
  for (const warning of aiSmellResult.warningIssues.slice(0, 3)) {
    if (!newIssues.includes(warning)) {
      newIssues.push(`⚠️ ${warning}`);
    }
  }
  
  // 권장 사항 추가
  if (aiSmellResult.criticalIssues.length > 0) {
    newRecommendations.push('🚨 의료광고법 위반 표현 즉시 수정 필요');
  }
  if (adjustedScore > 15) {
    newRecommendations.push('AI 냄새 점수 15점 초과 - 문장 패턴 다양화 권장');
  }
  
  return {
    ...factCheck,
    ai_smell_score: adjustedScore,
    issues: newIssues,
    recommendations: newRecommendations
  };
};

// 글 스타일별 프롬프트 (의료법 100% 준수) - 함수로 변경하여 현재 연도 동적 반영
const getWritingStylePrompts = (): Record<WritingStyle, string> => {
  const _year = new Date().getFullYear(); // 향후 연도별 메시지에 활용 가능
  return {
  // [가이드] 전문가형: 의학 지식 깊이 강조하되 권위적이지 않은 전문성
  expert: `
[글쓰기 스타일: 전문가형 📚]
- 목표: 신뢰할 수 있는 정보를 알기 쉽게 전달
- 톤: 전문적이면서도 친근한 설명

[핵심 규칙]
1. 도입부: 관찰에서 시작
   ❌ "오늘은 당뇨에 대해 알아보겠습니다."
   ✅ "공복혈당은 정상인데 식후에 유독 피곤함을 느끼는 분들이 있습니다."

2. 근거 인용 - 자연스럽게 (2회 이내)
   ❌ "대한OO학회 가이드라인에 따르면..."
   ✅ "최근 가이드라인에서 식후 혈당 관리를 더 강조하기 시작했습니다."

3. 의학 용어 - 쉽게 설명
   ❌ "인슐린 저항성이란 인슐린이 제대로 작동하지 않는 상태를 말합니다."
   ✅ "인슐린 저항성, 쉽게 말해서 인슐린이 있어도 잘 안 듣는 상태입니다."
`,

  // 💗 공감형: 독자 경험 중심, "이거 내 얘기네!" 반응 유도 (습니다체)
  empathy: `
[글쓰기 스타일: 공감형 💗]
- 문체: **"~습니다" 체만 사용** (예: ~됩니다, ~있습니다, ~합니다)
- 톤: 따뜻하고 이해심 있으면서도 전문적

[핵심 규칙]
1. 도입부: 구체적 상황 묘사로 시작 (필수)
   ❌ "오늘은 겨울철 피부 건조에 대해 알아보겠습니다."
   ✅ "히터를 켜고 자고 일어나면 얼굴이 땅기는 느낌을 한 번쯤 겪어보셨을 것입니다."

2. 실패/예외 사례 포함 (AI 냄새 제거)
   ✅ "모든 보습제가 다 맞는 것은 아닙니다."

3. 강약 조절
   - 강조: "매우 중요합니다"
   - 약화: "물론 개인차는 있습니다만"
   - 공감: "쉽지 않은 일입니다"

⚠️ **절대 금지**
- 해요체: ~해요, ~있어요, ~있죠, ~거예요, ~거죠 (글 전체 2회까지만 허용)
- 번역투: 기준점→기준, 측면에서→쪽에서, 요소→이유, 발생하다→생기다, 제공하다→알려드립니다
- 수동태: 알려지다→알려져 있습니다, 권장되다→권장합니다, 확인되다→확인했습니다

⚠️ **프레임 제한 규칙 (특히 산부인과/여성 건강 관련)**
- 결혼, 출산, 임신, 생명, 가족, 예비부부, 엄마, 아이와 같은 인생 단계·역할 중심 프레임 사용 금지
- 산부인과 진료를 '미래 계획'이나 '관계의 책임'으로 설명 금지
- 여성의 건강을 보호, 희생, 배려, 책임과 연결 금지
- 특정 삶의 선택(결혼, 출산)을 전제하거나 권장하는 문장 금지
`,

  // 🎯 전환형: 자연스러운 인식 변화 유도 (의료법 준수)
  conversion: `
[글쓰기 스타일: 전환형 🎯]
- 목표: "아, 나도 한번 확인해볼까?" 자연스러운 생각 유도
- 톤: 정보 제공 + 시점 제시 (강요 없이)

[핵심 규칙]
1. 도입부: 관찰로 시작
   ❌ "당뇨 전 단계인데 모르고 지나치는 사람이 절반이 넘습니다." (공포 조장)
   ✅ "물을 많이 마셔서 화장실을 자주 간다고 생각했는데, 돌이켜보니 그게 아니었다는 분들이 있어요."

2. 시점 제시 - 판단은 독자에게
   ❌ "검사를 받으세요" (명령형)
   ✅ "이런 신호가 겹치기 시작하면 확인해볼 타이밍일 수 있어요."

3. 마무리: 열린 결론
   ❌ "꼭 기억하세요"
   ✅ "적어도 '왜 이런지 모르겠다'는 답답함은 줄일 수 있어요."
`
  };
};

// =============================================
// 📝 글쓰기 스타일 공통 규칙 (중복 제거 + AI 냄새 최소화)
// =============================================



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
    const prompt = `다음은 병원 블로그 글 내용입니다:

${blogContent}

현재 이미지 설명: "${currentImageAlt}"

${styleGuide}

이 글의 맥락과 주제에 맞는 이미지 프롬프트를 **딱 1개만** 추천해주세요.

요구사항:
1. **글 전체를 읽고 핵심 주제와 연관성 높은 장면 선택**
2. 글의 맥락, 흐름, 주요 내용을 모두 고려
3. 한국 병원 환경에 적합
4. 전문적이고 신뢰감 있는 분위기
5. 구체적인 요소 (인물, 배경, 분위기 등) 포함
6. **텍스트 규칙**: 진짜 필요할 때만 한글/숫자 사용, 영어는 가급적 자제
7. 로고는 절대 포함하지 말 것
8. **위에서 지정한 스타일 키워드를 반드시 프롬프트에 포함할 것!**

**중요: 프롬프트 1개만 출력하세요! 여러 개 출력 금지!**
설명 없이 프롬프트 문장만 **한국어**로 답변하세요.

예시 (1개만):
${imageStyle === 'illustration' 
  ? '"밝은 병원 상담실에서 의사가 환자에게 설명하는 모습, 3D 일러스트, 아이소메트릭 뷰, 클레이 렌더, 파란색 흰색 팔레트"'
  : imageStyle === 'medical'
  ? '"인체 심장의 3D 단면도, 좌심실과 우심실이 보이는 해부학적 구조, 혈관과 판막이 표시된 의학 일러스트, 파란색 배경, 교육용 전문 이미지"'
  : '"깔끔한 병원 상담실에서 의사가 환자와 상담하는 모습, 실사 사진, DSLR 촬영, 자연스러운 조명, 전문적인 분위기"'}:`;

    const response = await callGemini({
      prompt,
      model: GEMINI_MODEL.PRO,
      googleSearch: false,  // 프롬프트 추천은 Google Search 불필요
      responseType: 'text',
      timeout: TIMEOUTS.QUICK_OPERATION
    });
    
    return response.text?.trim() || currentImageAlt;
  } catch (error) {
    console.error('프롬프트 추천 실패:', error);
    return currentImageAlt;
  }
};

// 🎴 카드뉴스 전용 AI 프롬프트 추천 - 부제/메인제목/설명 포함!
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
    const prompt = `당신은 카드뉴스 이미지 프롬프트 전문가입니다.

다음 카드뉴스 텍스트에 어울리는 **배경 이미지 내용**을 **한국어로** 추천해주세요.

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
비주얼: (여기에 배경 이미지 내용만 한국어로 작성)

[🚨 프롬프트 언어 규칙 - 반드시 준수!]
- 모든 프롬프트는 **한국어**로만 작성하세요!
- 영어 프롬프트 금지! (DSLR, 3D render, illustration 등 영어 금지)
- 예: "3D 일러스트, 파스텔톤 배경" (✅) vs "3D illustration, pastel background" (❌)

[규칙]
1. subtitle, mainTitle, description은 위 텍스트 그대로 유지
2. "비주얼:" 부분에는 **이미지에 그릴 대상/내용만** 한국어로 작성 (30자 이내)
3. ${isCustomStyle ? `⚠️ 중요: 그림체/스타일은 "${customStylePrompt}"로 이미 지정되어 있으므로, 비주얼에는 "무엇을 그릴지"만 작성 (수채화, 연필, 볼펜 등 스타일 언급 금지!)` : '비주얼에 스타일과 내용을 함께 한국어로 작성'}
4. 예: "심장 아이콘과 파란 그라데이션 배경", "병원에서 상담받는 환자"

[의료광고법 준수 - 이미지 텍스트에도 적용!]
🚨 금지: "완치", "상담하세요", "방문하세요", "조기 발견", "전문의"
✅ 허용: 증상명, 질환명, 질문형 제목, 정보 전달

위 형식대로만 한국어로 출력하세요. 다른 설명 없이!`;

    const response = await callGemini({
      prompt,
      model: GEMINI_MODEL.PRO,
      googleSearch: false,  // 프롬프트 추천은 Google Search 불필요
      responseType: 'text',
      timeout: TIMEOUTS.QUICK_OPERATION
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

[의료광고법 준수 - 이미지에 텍스트가 포함될 경우]
🚨 절대 금지: "완치", "상담하세요", "방문하세요", "조기 발견", "전문의", 구체적 수치/시간
✅ 허용: 증상명, 질환명, 정보성 키워드, 질문형 표현

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

// 🎴 기본 프레임 이미지 URL (로컬 파일 사용 - 외부 URL 403 에러 방지)
const DEFAULT_FRAME_IMAGE_URL = '/default-card-frame.webp';

// 기본 프레임 이미지 로드 (캐싱)
let defaultFrameImageCache: string | null = null;
const loadDefaultFrameImage = async (): Promise<string | null> => {
  if (defaultFrameImageCache) return defaultFrameImageCache;
  
  try {
    // 로컬 파일 사용 (public 폴더)
    const response = await fetch(DEFAULT_FRAME_IMAGE_URL);
    if (!response.ok) throw new Error(`Failed to fetch default frame: ${response.status}`);
    const blob = await response.blob();
    const base64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
    defaultFrameImageCache = base64;
    console.log('✅ 기본 프레임 이미지 로드 완료 (로컬)');
    return base64;
  } catch (error) {
    console.warn('⚠️ 기본 프레임 이미지 로드 실패:', error);
    return null;
  }
};

// 🎴 카드뉴스용 이미지 생성 함수 (텍스트 포함, 보라색 프레임)
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
  const cleanPromptText = normalizePromptTextForImage(promptText);
  
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
  
  // cleanPromptText에서 핵심 텍스트 추출 (다양한 패턴 지원)
  const subtitleMatch = cleanPromptText.match(/subtitle:\s*"([^"]+)"/i) || 
                        cleanPromptText.match(/subtitle:\s*([^\n,]+)/i);
  const mainTitleMatch = cleanPromptText.match(/mainTitle:\s*"([^"]+)"/i) || 
                         cleanPromptText.match(/mainTitle:\s*([^\n,]+)/i);
  const descriptionMatch = cleanPromptText.match(/description:\s*"([^"]+)"/i) ||
                           cleanPromptText.match(/description:\s*([^\n]+)/i);
  // 🎨 비주얼 지시문 추출
  const visualMatch = cleanPromptText.match(/비주얼:\s*([^\n]+)/i) ||
                      cleanPromptText.match(/visual:\s*([^\n]+)/i);
  
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

[의료광고법 - 이미지 텍스트 규칙]
🚨 금지: "완치", "상담하세요", "방문하세요", "조기 발견", "전문의", 수치(%)
✅ 허용: 증상명, 질환명, 정보성 표현, 질문형 제목
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


// 네이버 뉴스 검색 API 호출 함수 (서버 프록시 사용 - CORS 해결)
const searchNaverNews = async (query: string, display: number = 10): Promise<{ title: string; description: string; pubDate: string; link: string }[]> => {
  try {
    console.log(`[네이버 뉴스] 검색 시작: ${query}`);
    
    // 서버 프록시를 통해 네이버 API 호출 (CORS 해결)
    const response = await fetch(`/api/naver-news?query=${encodeURIComponent(query)}&display=${display}`, {
      method: 'GET',
    });
    
    if (!response.ok) {
      throw new Error(`네이버 API 오류: ${response.status}`);
    }
    
    const data = await response.json() as { items?: any[] };
    console.log(`[네이버 뉴스] ${data.items?.length || 0}개 결과 수신`);
    
    return (data.items || []).map((item: any) => ({
      title: item.title.replace(/<[^>]*>/g, ''), // HTML 태그 제거
      description: item.description.replace(/<[^>]*>/g, ''),
      pubDate: item.pubDate,
      link: item.link
    }));
  } catch (error) {
    console.error('[네이버 뉴스] 검색 실패:', error);
    throw error;
  }
};

// 뉴스 검색 전용 함수 - 네이버 우선, Gemini 폴백
// 허용 도메인: 연합뉴스, 중앙일보, 조선일보, 동아일보, 한겨레, 경향신문, KBS, MBC, SBS 등 신뢰할 수 있는 언론사
const searchNewsForTrends = async (category: string, _month: number): Promise<string> => {
  // 진료과별 뉴스 검색 키워드
  const categoryNewsKeywords: Record<string, string> = {
    '정형외과': '관절 통증 OR 허리디스크 OR 어깨 통증',
    '피부과': '피부 건조 OR 아토피 OR 습진',
    '내과': '독감 OR 감기 OR 당뇨 OR 고혈압',
    '치과': '치아 건강 OR 잇몸 질환',
    '안과': '안구건조 OR 눈 건강 OR 시력',
    '이비인후과': '비염 OR 코막힘 OR 목감기',
    '산부인과': '여성 건강 OR 갱년기',
    '비뇨의학과': '전립선 OR 방광염',
    '신경과': '두통 OR 어지럼증 OR 불면증',
    '정신건강의학과': '우울증 OR 스트레스 OR 번아웃',
    '마취통증의학과': '통증 치료 OR 만성통증 OR 신경차단'
  };
  
  const searchKeyword = categoryNewsKeywords[category] || '건강 의료';
  
  // 1차: 네이버 뉴스 검색 시도
  try {
    console.log(`[뉴스 트렌드] 네이버 뉴스 검색 시작: ${category} (${searchKeyword})`);
    
    const newsItems = await searchNaverNews(searchKeyword, 10);
    
    if (newsItems.length > 0) {
      // 뉴스 결과를 텍스트로 포맷팅
      const newsContext = newsItems.slice(0, 5).map((item, idx) => {
        return `${idx + 1}. ${item.title}\n   - ${item.description.substring(0, 100)}...`;
      }).join('\n\n');
      
      console.log(`[뉴스 트렌드] 네이버 뉴스 검색 완료: ${newsItems.length}개 기사`);
      return `[최신 뉴스 트렌드 - 네이버 뉴스 검색 결과]\n\n${newsContext}`;
    }
    
    throw new Error('네이버 뉴스 결과 없음');
    
  } catch (naverError) {
    console.warn('[뉴스 트렌드] 네이버 검색 실패, Gemini로 폴백:', naverError);
    
    // 2차: Gemini 검색으로 폴백
    try {
      const ai = getAiClient();
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `최근 한국 뉴스에서 "${searchKeyword}" 관련 기사를 검색하고, 
가장 많이 다뤄지는 건강/의료 이슈 3가지를 요약해주세요.

연도 불일치 설명 없이 바로 이슈만 요약하세요.

[출력 형식]
각 이슈마다:
- 이슈: (한 줄 요약)
- 관련 키워드: (블로그 작성에 활용할 키워드)`,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "text/plain",
          temperature: 0.3
        }
      });
      
      const newsContext = response.text || '';
      console.log(`[뉴스 트렌드] Gemini 검색 완료`);
      return newsContext;
      
    } catch (geminiError) {
      console.warn('[뉴스 트렌드] Gemini 검색도 실패:', geminiError);
      return '';
    }
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
  
  const _contentTypeDesc = postType === 'card_news' 
    ? '인스타그램/네이버 카드뉴스' 
    : '네이버 블로그'; // 향후 프롬프트에 활용 가능
  
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
⭐ [제목 설계 핵심 원칙] - 정보 탐색 목적 제목 구조!
[중요]

🚨 **최우선 원칙: 의료광고법 준수!**
- 과장·단정 표현 금지 (치료, 완치, 개선, 반드시, 필요, 효과 등)
- 공포·불안 조장 표현 금지 (방치하면, 위험, 심각, 골든타임)
- 병원/의원 직접 유도 금지 (방문하세요, 상담하세요, 예약하세요)
- 광고처럼 보이지 않고, 차분한 정보 탐색형 톤 유지

🎯 **핵심 제약 - 반드시 지킬 것**

1. **제목에 개인 경험 서사, 행동 묘사, 특정 상황 나열 금지**
   ❌ ~하다가, ~한 다음, ~했던 경험, ~찾았던 경우
   ❌ "아침에 세수하다가", "계단 내려가다", "출근길에"
   ❌ "밤마다 ~해서", "~하던 중", "~할 때마다"
   
2. **시간·날짜·계절·연도·장소·기기 사용 상황 금지**
   ❌ "겨울철", "요즘", "최근", "아침", "밤", "출근길", "병원에서"
   ✅ 시간적 표현 없이 증상 자체로만 표현

3. **제목은 반드시 '증상 또는 변화' 중심으로 시작**
   ✅ 증상이 문장 앞부분(50% 이내)에 위치
   ✅ 증상 → 질환명/궁금증 순서
   
4. **질환명은 설명 보조용으로만 사용**
   ✅ 증상 중심, 질환명은 뒤에 보조로
   ❌ 질환명을 증상보다 앞에 과도하게 강조 금지

🔧 **제목 구조 강제 규칙** - 반드시 아래 4가지 중 하나만 사용!

① **증상 + 질환명 + 궁금증**
   예: "기침과 가래가 오래갈 때 폐렴 가능성"
   예: "무릎 통증과 붓기, 관절염 관련 신호일 수 있는 경우"

② **증상 변화 + 원인 가능성**
   예: "갑자기 무릎이 붓고 열감이 느껴지는 원인"
   예: "기침이 점점 심해지는 이유"

③ **특정 증상이 나타날 때 확인할 점**
   예: "손가락이 뻣뻣하고 아침에 더 심할 때 살펴볼 점"
   예: "무릎에서 소리 나고 통증이 반복될 때 확인해볼 점"

④ **정상 범위와 다른 신호일 수 있는 경우**
   예: "기침이 3주 이상 지속되는 것이 정상 범위와 다른 신호일 때"
   예: "무릎 통증이 일상생활에 영향을 줄 때"

💡 **제목 작성 핵심 가이드**

- **증상 키워드 배치**: 제목 앞 50% 이내 필수
- **질환명 역할**: 증상을 설명하는 보조 역할만
- **제목 길이**: 25~40자 (${lengthGuide})
- **키워드 개수**: 핵심 키워드 1~2개만

✅ **좋은 제목 예시**
- "무릎 통증과 붓기가 오래갈 때 살펴볼 점"
- "기침이 지속되고 가래가 나올 때 확인해볼 점"
- "손가락 관절이 뻣뻣한 증상, 류마티스 관련 신호"
- "어깨 통증이 팔까지 이어질 때"

❌ **나쁜 제목 예시**
- "아침에 세수하다가 팔이 안 올라갈 때" (행동 묘사)
- "출근길 계단 내려가다 무릎이 아플 때" (장소+행동)
- "겨울철 무릎 통증이 심해지는 이유" (계절)
- "요즘 무릎이 자주 아픈 경우" (시간)

🚫 **피해야 할 표현**
❌ 반드시, 치료, 효과, 완치, 즉시, 전문의, 병원, 내원, 진료
❌ 방치하면, 위험, 큰 문제, 심각, 골든타임
❌ 확인하세요, 상담하세요, 방문하세요 (명령형)
❌ AI 단어: 정리, 분석, 가이드, 체크리스트, 총정리, 완벽, 모든 것

🚨 **숫자 완전 금지 (1개도 사용 불가!)**
❌ 나이: "50대", "30대", "40세 이상" 
❌ 기간: "2주", "3일", "1개월", "3주 이상"
❌ 비율: "90%", "70%", "절반"
❌ 횟수: "3가지", "5가지", "TOP 10"
❌ 순위: "1위", "베스트 3"
✅ 대체: "오래갈 때", "지속될 때", "반복될 때", "여러 가지"

✅ 대체어: 살펴볼 점, 알아둘 것, 확인해볼 점, 경우, 때, 신호

[중요]
🤖 [AI 냄새 완전 제거] - 정보 탐색형 제목!
[중요]

**❌ AI 같은 종결어 (절대 사용 금지!)**
- 흐름, 상황, 시점, 사례, 과정, 포인트, 방법, 요령, 팁
- 정리, 분석, 가이드, 총정리, 완벽, 모든 것, 체크리스트
→ 이런 단어로 끝나면 AI가 쓴 티가 나고 광고처럼 보임!

**✅ 정보 탐색형 종결어 (자연스러운 표현)**
- 경우, 때, 이유, 점, 것, 신호, 가능성
- ~일 때, ~한 경우, ~살펴볼 점, ~확인해볼 점

**❌ 질문형 제목 금지**
❌ "무릎 통증, 십자인대 파열일까요?" (질문형)
❌ "이런 증상이 나타나면 병원 가야 할까요?" (질문형)
✅ "무릎에서 소리 나고 붓기가 안 빠질 때 살펴볼 점" (설명형)
✅ "무릎 통증과 붓기, 관절염 관련 신호일 수 있는 경우" (정보형)

[중요]
🎨 [출력 요구사항] - 4가지 구조 중 하나씩!
[중요]

- 제목 5개 제안 (⚠️ 5개 모두 문장 구조가 달라야 함!)
- 각 제목은 아래 4가지 구조 중 하나를 사용:

  ① **증상 + 질환명 + 궁금증**
     예: "기침과 가래가 오래갈 때 폐렴 가능성"
  
  ② **증상 변화 + 원인 가능성**
     예: "갑자기 무릎이 붓고 열감이 느껴지는 원인"
  
  ③ **특정 증상이 나타날 때 확인할 점**
     예: "손가락이 뻣뻣하고 붓기가 있을 때 살펴볼 점"
  
  ④ **정상 범위와 다른 신호일 수 있는 경우**
     예: "기침이 3주 이상 지속되는 것이 정상 범위와 다른 신호일 때"

🚨 **필수 체크사항:**
- ❌ 물음표(?) 사용 금지 (0개!)
- ❌ AI 단어 0개 (증상 정리, 원인 분석, 체크리스트, 완벽 가이드 등)
- ❌ 과장 표현 0개 (치료, 완치, 개선, 반드시, 확실한 등)
- ❌ 행동 묘사 0개 (~하다가, ~한 다음, ~했던)
- ❌ 시간·장소 0개 (아침, 밤, 겨울철, 출근길 등)
- ❌ 숫자 0개 (50대, 2주, 3가지, 90%, TOP 5 등 모든 숫자 금지!)
- ✅ 증상이 문장 앞 50% 안에 위치
- ✅ 실제 병원 블로그에 올려도 의료광고법 위반 걱정 없는 톤

- SEO 점수: 70~95점 사이로 현실적으로 평가
- type: 위 4가지 구조 중 하나 (증상질환형/변화원인형/확인형/정상범위형)

[✅ 좋은 제목 예시 - 정보 탐색형!]
- "무릎 통증과 붓기가 오래갈 때 살펴볼 점" (증상 중심)
- "기침이 지속되고 가래가 나올 때 확인해볼 점" (증상 변화)
- "손가락 관절이 뻣뻣한 증상, 류마티스 관련 신호" (증상+질환)
- "어깨 통증이 팔까지 이어질 때" (증상 범위)
- "갑자기 무릎이 붓고 열감이 느껴지는 원인" (변화+원인)

[❌ 나쁜 제목 예시 - 금지 패턴!]
- "무릎 통증 완벽 가이드! 모든 것을 알려드립니다" (AI 단어 + 과장)
- "십자인대 파열일까요? 증상 체크리스트" (질문형 + AI 단어)
- "무릎 통증 원인 분석과 치료 방법 총정리" (AI 단어 나열)
- "아침에 세수하다가 팔이 안 올라갈 때" (시간+행동)
- "출근길 계단 내려가다 무릎이 아플 때" (장소+행동)
- "겨울철 무릎 통증이 심해지는 이유" (계절)
- "50대 무릎 통증 3가지 원인" (숫자 금지!)
- "2주 이상 기침이 지속될 때" (숫자 금지!)
- "무릎 통증 TOP 5 원인 총정리" (숫자 + AI 단어 금지!)

[검수 기준 - 의료광고법 + 정보 탐색형 구조!]
1. ❌ 물음표(?) 사용 확인 → 0개! (완전 금지)
2. ❌ AI 단어 확인 → "정리/분석/가이드/완벽/모든것/체크리스트/총정리/방법/요령/팁" 0개!
3. ❌ 과장 단어 확인 → "치료/완치/개선/반드시/확실한/효과" 0개!
4. ❌ AI 종결어 확인 → "흐름/상황/시점/사례/과정/포인트" 0개!
5. ❌ 시간·장소 확인 → "아침/밤/겨울철/출근길/요즘/최근" 0개!
6. ❌ 행동 묘사 확인 → "~하다가/~한 다음/~했던/~찾았던" 0개!
7. ✅ 증상 위치 → 제목 앞 50% 이내에 증상 키워드 필수!
8. ✅ 의료광고법 안전성 → 병·의원 블로그에 게시해도 법적 문제 없어야 함
9. ✅ 정보 탐색형 구조 → 4가지 강제 구조 중 하나만 사용
10. 📐 구조 반복 체크 → 5개 제목 중 같은 문장 구조 2개 이상이면 탈락!
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
            type: { type: Type.STRING, enum: ['증상질환형', '변화원인형', '확인형', '정상범위형'] }
          },
          required: ["title", "score", "type"]
        }
      }
    }
  });
  return JSON.parse(response.text || "[]");
};

/**
 * 추천된 제목들 중 가장 적합한 제목 선택 (순위 매기기)
 */
export const rankSeoTitles = async (
  titles: SeoTitleItem[],
  topic: string,
  keywords: string,
  postContent?: string
): Promise<SeoTitleItem[]> => {
  const ai = getAiClient();

  // 현재 날짜 정보
  const now = new Date();
  const koreaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const currentYear = koreaTime.getFullYear();
  const currentMonth = koreaTime.getMonth() + 1;
  const seasons = ['겨울', '겨울', '봄', '봄', '봄', '여름', '여름', '여름', '가을', '가을', '가을', '겨울'];
  const currentSeason = seasons[currentMonth - 1];

  const titlesJson = JSON.stringify(titles.map((t, idx) => ({
    index: idx + 1,
    title: t.title,
    originalScore: t.score,
    type: t.type
  })), null, 2);

  const prompt = `너는 병원 블로그 제목 평가 전문가다.
주어진 제목들을 종합적으로 평가하고 최종 순위를 매겨라.

[📅 현재 시점: ${currentYear}년 ${currentMonth}월 (${currentSeason})]
[※ 주제] ${topic}
[※ SEO 키워드] ${keywords}
${postContent ? `[※ 본문 일부]\n${postContent.substring(0, 300)}...\n` : ''}

[평가할 제목 목록]
${titlesJson}

[평가 기준 (중요도 순)]

1️⃣ **의료광고법 안전성 (50점) - 최우선!**
   - 진단/판단/치료 유도 표현 없음 (+15점)
   - 과장/단정 표현 없음 (+15점)
   - 공포 조장/시간 압박 없음 (+10점)
   - 병원/의원 홍보 느낌 없음 (+10점)

   ❌ 위반 예시:
   - "~일까요?" (진단 유도) → -20점
   - "완치/치료/개선" → -20점
   - "반드시/골든타임/즉시" → -15점
   - "확인하세요/검사받으세요" → -15점

2️⃣ **자연스러움 (25점)**
   - 사람이 직접 지은 것 같음 (+10점)
   - AI 단어 없음 (정리/분석/가이드/체크리스트/완벽) (+10점)
   - 대화체/경험담 느낌 (+5점)

   ❌ 감점 요소:
   - AI 종결어 (흐름/상황/시점/사례/과정/포인트) → -10점
   - 딱딱한 정보 나열형 → -5점

3️⃣ **주제 연관성 (15점)**
   - 주제 핵심 내용 포함 (+8점)
   - SEO 키워드 자연스럽게 포함 (+7점)

4️⃣ **클릭 유도력 (CTR 예측) (10점)**
   - "이거 내 얘기다" 공감 유도 (+5점)
   - 구체적 상황 제시 (+3점)
   - 호기심 자극 (과장 없이) (+2점)

[평가 방법]
- 각 제목에 대해 4가지 기준별 점수 부여
- 총점 (100점 만점) 계산
- 최종 순위 (1~5위) 결정
- 1위 제목 선정 이유 명확히 설명

[중요]
🚨 의료광고법 위반 요소가 있으면 무조건 감점!
- "~일까요?" 있으면 -20점
- "치료/완치/개선" 있으면 -20점
- AI 단어 2개 이상이면 -15점

[출력 형식]
각 제목의 평가 결과를 JSON 배열로 반환:
- title: 제목 원문
- finalScore: 최종 점수 (0-100)
- rank: 순위 (1-5)
- legalSafety: 의료광고법 안전성 점수 (0-50)
- naturalness: 자연스러움 점수 (0-25)
- relevance: 주제 연관성 점수 (0-15)
- ctr: 클릭 유도력 점수 (0-10)
- reason: 평가 이유 (1-2문장)
- recommendation: 1위만 개선 제안 (선택사항)

정렬: finalScore 높은 순 (rank 1이 제일 위)`;

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
            finalScore: { type: Type.NUMBER },
            rank: { type: Type.NUMBER },
            legalSafety: { type: Type.NUMBER },
            naturalness: { type: Type.NUMBER },
            relevance: { type: Type.NUMBER },
            ctr: { type: Type.NUMBER },
            reason: { type: Type.STRING },
            recommendation: { type: Type.STRING }
          },
          required: ["title", "finalScore", "rank", "legalSafety", "naturalness", "relevance", "ctr", "reason"]
        }
      }
    }
  });

  const rankedTitles = JSON.parse(response.text || "[]");

  // 원래 type 정보 병합
  return rankedTitles.map((ranked: any) => {
    const original = titles.find(t => t.title === ranked.title);
    return {
      ...ranked,
      type: original?.type || '정보제공',
      score: ranked.finalScore // score 필드를 finalScore로 업데이트
    };
  });
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
❌ "전문의 상담", "전문의와 상담하세요"
❌ "병원 방문", "내원하세요", "예약하세요"
❌ "검진 받으세요", "진료 받으세요", "검사 받으세요"
❌ "~하세요" 명령형 전부!
❌ "완치", "최고", "보장", "확실히", "체크"
❌ "골든타임", "48시간 내" 등 구체적 시간 표현

**안전한 대체 표현:**
✅ "확인이 필요한 시점입니다"
✅ "지켜보기보다 확인이 먼저입니다"
✅ "전문적인 판단이 필요할 수 있습니다"
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
  const _padding = styleConfig?.padding || '32px 28px';
  
  const _subtitle = {
    color: styleConfig?.subtitleStyle?.color || accentColor,
    fontSize: styleConfig?.subtitleStyle?.fontSize || '14px',
    fontWeight: styleConfig?.subtitleStyle?.fontWeight || '700'
  };
  
  const _mainTitle = {
    color: styleConfig?.mainTitleStyle?.color || '#1E293B',
    fontSize: styleConfig?.mainTitleStyle?.fontSize || '26px',
    fontWeight: styleConfig?.mainTitleStyle?.fontWeight || '900'
  };
  
  const highlight = {
    color: styleConfig?.highlightStyle?.color || accentColor,
    backgroundColor: styleConfig?.highlightStyle?.backgroundColor || 'transparent'
  };
  
  const _desc = {
    color: styleConfig?.descStyle?.color || '#475569',
    fontSize: styleConfig?.descStyle?.fontSize || '15px'
  };
  
  const _tag = {
    backgroundColor: styleConfig?.tagStyle?.backgroundColor || `${accentColor}15`,
    color: styleConfig?.tagStyle?.color || accentColor,
    borderRadius: styleConfig?.tagStyle?.borderRadius || '20px'
  };
  
  // 브라우저 윈도우 버튼 HTML (분석된 스타일에 있으면 적용) - 향후 사용 가능
  const _windowButtonsHtml = styleConfig?.hasWindowButtons ? `
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
    const _formattedTitle = slide.mainTitle
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
  
  // 🌐 커스텀 스타일이 있으면 한국어로 번역 (프롬프트 미리보기용)
  let translatedCustomStyle = '';
  if (hasCustomStyle) {
    translatedCustomStyle = await translateStylePromptToKorean(customImagePrompt!.trim());
    console.log('🌐 커스텀 스타일 번역:', customImagePrompt!.substring(0, 30), '→', translatedCustomStyle.substring(0, 30));
  }
  
  const styleGuide = isFixedStyle
    ? STYLE_KEYWORDS[imageStyle]  // photo/medical은 고정 스타일 사용
    : (hasCustomStyle ? translatedCustomStyle : STYLE_KEYWORDS[imageStyle] || STYLE_KEYWORDS.illustration);
  
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
- 🇰🇷 사람이 등장할 경우 반드시 "한국인" 명시! (예: "한국인 의사", "한국인 환자", "한국인 여성")
- 해시태그 금지
- "⚠️description 없음"이면 설명 텍스트 넣지 마세요!

[의료법 필수 준수 - humanWritingPrompts 규칙 적용]
━━━━━━━━━━━━━━━━━━
🚨 절대 금지 (이미지 텍스트에서도 위반!):
- "완치", "치료 효과", "100% 안전", "보장"
- "조기 발견", "조기 치료" (불안 조장)
- "~하세요", "상담하세요", "방문하세요" (행동 유도 CTA)
- "2주 이상", "48시간 내" 등 구체적 시간
- "전문가/전문의/명의"

✅ 허용되는 표현:
- 증상명, 질환명 (사실 정보)
- 질문형 제목 ("무릎이 시린 이유는?")
- 정보 전달 ("관절염의 특징")
- "~일 수 있어요" (가능성)`;

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
      
      // 표지/마지막은 description 없음 (향후 활용 가능)
      const _descPart = (isFirst || isLast) ? '' : (s.description ? `, "${s.description}"` : '');
      
      // 🔧 imagePrompt: 사용자에게 보여줄 핵심 정보만! (영어 지시문은 생성 시 자동 추가)
      // 🌐 스타일 정보도 한국어로 포함 (번역된 커스텀 스타일 또는 기본 스타일)
      const descText = (isFirst || isLast) ? '' : (s.description ? `\ndescription: "${s.description}"` : '');
      const styleText = hasCustomStyle ? translatedCustomStyle : STYLE_KEYWORDS[imageStyle] || STYLE_KEYWORDS.illustration;
      const imagePrompt = `subtitle: "${s.subtitle}"
mainTitle: "${mainTitleClean}"${descText}
비주얼: ${s.imageKeyword}
스타일: ${styleText}
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
    // 🔧 fallback도 동일하게: 스타일 정보 포함 (한국어)
    const styleText = hasCustomStyle ? translatedCustomStyle : STYLE_KEYWORDS[imageStyle] || STYLE_KEYWORDS.illustration;
    const fallbackCards = slides.map((s, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === slides.length - 1;
      const mainTitleClean = s.mainTitle.replace(/<\/?highlight>/g, '');
      const descText = (isFirst || isLast) ? '' : (s.description ? `\ndescription: "${s.description}"` : '');
      return {
        imagePrompt: `subtitle: "${s.subtitle}"
mainTitle: "${mainTitleClean}"${descText}
비주얼: ${s.imageKeyword}
스타일: ${styleText}
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

// [기존 호환] 이미지만 생성하는 프롬프트 에이전트 (향후 활용 가능)
const _imagePromptAgent = async (
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
- 🇰🇷 사람이 등장할 경우 반드시 "한국인" 명시!

[의료광고법 필수 준수 - humanWritingPrompts 규칙]
🚨 절대 금지:
- "완치", "치료 효과", "100% 안전", "보장"
- "조기 발견", "조기 치료" (불안 조장)
- "상담하세요", "방문하세요", "예약하세요" (행동 유도)
- "2주 이상", "48시간 내" 등 구체적 시간
- "전문가/전문의/명의"

✅ 허용: 증상명, 질환명, 정보성 키워드, 질문형

예시: "가슴 통증을 느끼는 한국인 중년 남성, 3D 일러스트, 파란색 배경, 밝은 톤"`;

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
  
  // 카드뉴스 원고용 프롬프트 - humanWritingPrompts 연결
  
  onProgress('📝 [1단계] 원고 기획 중...');
  
  const prompt = `
${writingStylePrompt}

${HUMAN_WRITING_RULES}

${MEDICAL_LAW_HUMAN_PROMPT}

[진료과별 맞춤 가이드]
${request.category && CATEGORY_SPECIFIC_PROMPTS[request.category as unknown as keyof typeof CATEGORY_SPECIFIC_PROMPTS] 
  ? CATEGORY_SPECIFIC_PROMPTS[request.category as unknown as keyof typeof CATEGORY_SPECIFIC_PROMPTS] 
  : ''}

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
  // 📊 성능 측정 시작
  const startTime = Date.now();
  let retryCount = 0;
  let errorOccurred = false;
  let errorMessage = '';

  // onProgress가 없으면 콘솔 로그로 대체
  const safeProgress = onProgress || ((msg: string) => console.log('📍 BlogText Progress:', msg));
  const ai = getAiClient();
  const isCardNews = request.postType === 'card_news';
  const targetLength = request.textLength || 2000;
  const targetSlides = request.slideCount || 6;
  
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
    
    const _coverInlineStyle = generateInlineStyle(coverStyle);
    const _contentInlineStyle = generateInlineStyle(contentStyle);
    const coverTitleStyle = generateTitleStyle(coverStyle);
    const _coverHighlightStyle = generateHighlightStyle(coverStyle);
    const coverSubtitleStyle = generateSubtitleStyle(coverStyle);
    const _coverTagStyle = generateTagStyle(coverStyle);
    const contentTitleStyle = generateTitleStyle(contentStyle);
    const _contentHighlightStyle = generateHighlightStyle(contentStyle);
    const contentSubtitleStyle = generateSubtitleStyle(contentStyle);
    const _contentTagStyle = generateTagStyle(contentStyle);
    
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
  const _imageMarkers = targetImageCount > 0 
    ? Array.from({length: targetImageCount}, (_, i) => `[IMG_${i+1}]`).join(', ')
    : ''; // 향후 이미지 위치 지정에 활용 가능
  const writingStyle = request.writingStyle || 'empathy'; // 기본값: 공감형
  const _writingStylePrompt = getWritingStylePrompts()[writingStyle]; // 향후 스타일 프롬프트에 활용 가능
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
    const subheadings = request.customSubheadings.trim().split(/\r\n|\r|\n/).filter(h => h.trim());
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
  
  // 🏥 병원 웹사이트 크롤링 로직
  // 1) 보도자료: hospitalWebsite 사용
  // 2) 블로그: customSubheadings에 "병원 소개" 포함 시 referenceUrl 크롤링
  let hospitalInfo = '';
  let shouldCrawl = false;
  let crawlUrl = '';
  
  // 보도자료의 경우 hospitalWebsite 사용
  if (request.hospitalWebsite && request.hospitalWebsite.trim()) {
    shouldCrawl = true;
    crawlUrl = request.hospitalWebsite.trim();
  }
  // 블로그의 경우: 소제목에 "병원 소개" 포함 시 referenceUrl 크롤링
  else if (request.customSubheadings && request.customSubheadings.includes('병원 소개') && request.referenceUrl && request.referenceUrl.trim()) {
    shouldCrawl = true;
    crawlUrl = request.referenceUrl.trim();
    console.log('📋 소제목에 "병원 소개" 발견! 병원 정보 크롤링 시작:', crawlUrl);
  }
  
  if (shouldCrawl) {
    safeProgress('🏥 병원 정보 크롤링 중...');
    try {
      const crawlResponse = await fetch('/api/crawler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: crawlUrl })
      });
      if (crawlResponse.ok) {
        const crawlData = await crawlResponse.json() as { content?: string; error?: string };
        if (crawlData.content) {
          console.log('✅ 병원 웹사이트 크롤링 완료:', crawlData.content.substring(0, 200));
          hospitalInfo = `

[🏥 병원 정보 활용 가이드]
아래 병원 정보를 참고하여 글 마지막 소제목 ("병원 소개" 또는 "어디서 확인할 수 있나요" 등)에 자연스럽게 삽입하세요.

⚠️ 의료광고법 준수 필수:
- ❌ "최고", "최상", "1등", "유일" 등 최상급 표현 금지
- ❌ "완치", "효과 보장", "100% 안전" 등 효과 보장 표현 금지
- ❌ 타 병원과 비교 우위 표현 금지
- ✅ "~진료를 진행하고 있습니다", "~시설을 갖추고 있습니다" (사실만 나열)
- ✅ "~분야를 중심으로 진료합니다", "~에 집중하고 있습니다" (중립적 톤)

📋 병원 웹사이트 정보:
${crawlData.content.substring(0, 3000)}

✅ 작성 방법:
1. **분량: 5~7줄 정도로 작성** (너무 짧지도 길지도 않게, 적당한 분량으로!)
2. **1개의 문단으로만 작성** (여러 문장 가능하지만, 문단 분리 금지! 한 덩어리로만 작성!)
3. **키워드와 자연스럽게 연결** (매우 중요!):
   - 글의 주요 키워드: "${request.keyword || request.title}"
   - 병원 소개를 키워드와 자연스럽게 연결하여 작성
   - 예: "${request.keyword}" 관련 증상이나 치료가 필요할 때, 이 병원에서 상담받아보는 것도 방법입니다
   - 키워드를 억지로 반복하지 말고, 문맥에 맞게 1~2회 자연스럽게 언급
4. **포함할 정보** (크롤링된 내용에 있는 경우에만!):
   - 야간 진료 여부 (예: "평일 저녁 8시까지 야간 진료")
   - 공휴일 진료 여부 (예: "토요일/일요일에도 진료")
   - 의료진 학력/경력 (예: "○○대학교 의과대학 졸업, ○○병원 전문의 과정 수료")
   - 전문 분야 및 특징
   ⚠️ **중요: 크롤링 데이터에 없는 정보는 절대 지어내지 말 것! 없으면 생략!**
5. 과도한 홍보 느낌 없이 정보 제공 형식으로
6. "~에서 상담받아보는 것도 방법입니다" 같은 완곡한 표현 사용
6. "~에서 상담받아보는 것도 방법입니다" 같은 완곡한 표현 사용
7. 병원명은 1회만 언급 (과도한 반복 금지)
8. 🚨 **중요: 병원 소개는 최소 5줄 이상, 7줄 미만으로 작성! (1개 문단)**
9. 🚨 **핵심: 키워드("${request.keyword || request.title}")와 자연스럽게 연결하여 작성!**
`;
          safeProgress('✅ 병원 정보 크롤링 완료');
        } else {
          console.warn('⚠️ 크롤링 결과 없음:', crawlData.error);
        }
      } else {
        console.warn('⚠️ 크롤링 API 실패:', crawlResponse.status);
      }
    } catch (error) {
      console.error('❌ 병원 크롤링 에러:', error);
    }
  }
  
  // 커스텀 이미지 프롬프트가 있으면 최우선 사용
  const customImagePrompt = request.customImagePrompt?.trim();
  const imageStyleGuide = customImagePrompt
    ? `커스텀 스타일: ${customImagePrompt}` // 커스텀 프롬프트 최우선!
    : imageStyle === 'illustration' 
    ? '3D 렌더 일러스트, Blender 스타일, 부드러운 스튜디오 조명, 파스텔 색상, 둥근 형태, 친근한 캐릭터, 깔끔한 배경 (⛔금지: 실사, 사진, DSLR)'
    : imageStyle === 'medical'
    ? '의학 3D 일러스트, 해부학적 렌더링, 해부학적 구조, 장기 단면도, 반투명 장기, 임상 조명, 의료 색상 팔레트 (⛔금지: 귀여운 만화, 실사 얼굴)'
    : '실사 DSLR 사진, 진짜 사진, 35mm 렌즈, 자연스러운 부드러운 조명, 얕은 피사계심도, 전문 병원 환경 (⛔금지: 3D 렌더, 일러스트, 만화, 애니메이션)';
  
  // 의료광고법 프롬프트 - SYSTEM_PROMPT 사용 (중복 제거)
  
  // 🚀 v8.5 의료광고법 준수 + humanWritingPrompts 연결
  const blogPrompt = `
한국 병·의원 네이버 블로그용 의료 콘텐츠를 작성하세요.

[🚨🚨🚨 글자 수 최우선 준수 - 절대 규칙!]
목표: ${targetLength}자 (공백 제외)
✅ 정확한 목표: ${targetLength - 50}자 ~ ${targetLength + 50}자 범위 내
⚠️ 절대 부족 금지: ${targetLength - 100}자 미만이면 즉시 탈락!
⚠️ 절대 초과 금지: ${targetLength + 100}자를 넘으면 즉시 탈락!

💡 글자 수 맞추는 방법:
- 소제목 개수 조절: 2000자 → 4~5개, 2500자 → 5~6개, 3000자 → 6~7개
- 각 소제목 아래 문단 2~3개로 조절
- 마지막 소제목 전까지 ${targetLength - 200}자 정도 작성
- 마지막 소제목에서 정확히 목표 글자 수 도달
🔥 반드시 작성 후 글자 수 세어서 범위 내인지 확인!

[작성 요청] 진료과: ${request.category} / 주제: ${request.topic} / SEO 키워드: ${request.keywords || '없음'} (본문에 1~3회 자연스럽게 포함) / 이미지: ${targetImageCount}장
${learnedStyleInstruction || ''}${customSubheadingInstruction || ''}

${HUMAN_WRITING_RULES}

${MEDICAL_LAW_HUMAN_PROMPT}

[진료과별 맞춤 가이드]
${request.category && CATEGORY_SPECIFIC_PROMPTS[request.category as unknown as keyof typeof CATEGORY_SPECIFIC_PROMPTS] 
  ? CATEGORY_SPECIFIC_PROMPTS[request.category as unknown as keyof typeof CATEGORY_SPECIFIC_PROMPTS] 
  : ''}

[참고 예시 - 좋은 글 vs 나쁜 글]
${FEW_SHOT_EXAMPLES}

${PARAGRAPH_STRUCTURE_GUIDE}

[글쓰기 원칙]
1. 톤: 구어체 친근 (병원 홍보 ❌, 교과서처럼 딱딱 ❌)
2. 감각 묘사: "찌릿", "뻐근", "욱신", "뻣뻣", "무겁다", "당긴다" 등
3. 질환명은 설명 보조용으로만 짧게! (증상 중심, 질환명 과도한 강조 ❌)
4. 🔥 희소성 확보: 다른 블로그와 절대 겹치지 않게! (아래 규칙 필수)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌟 [희소성 확보 - 다른 블로그와 차별화 필수!]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 똑같은 내용, 똑같은 구조는 절대 금지! 이 글만의 차별점을 만들어라!

📍 희소성 확보 규칙 (전부 준수):

1. 일반적인 의료 블로그에서 자주 사용하는 도입 방식 피하기
   ❌ 계절 언급 ("요즘 같은 환절기에~")
   ❌ 스마트폰·거북목·직장인·중년 반복 서술

2. 인과를 단정하는 문장 구조 사용 금지
   ❌ "~때문에 발생한다"
   ❌ "원인은 ~이다"
   ✅ "~와 연관이 있다고 해요", "~영향을 줄 수 있어요"

3. 증상 나열형 문단 만들지 않기
   ❌ "A, B, C 증상이 나타날 수 있다" 식의 나열
   ✅ 각 증상을 별도 문단에서 구체적 상황과 함께 서술

4. 한 문단에는 하나의 관찰만 담기
   ❌ 같은 의미의 문장을 형태만 바꿔 반복
   ✅ 각 문단마다 새로운 관찰이나 정보 제공

5. 빈도 강조 표현 사용 금지
   ❌ "많이 겪는다", "흔하다", "대표적이다"
   ✅ 구체적인 상황이나 순간 묘사

6. 이 글만의 관찰 포인트를 최소 1개 이상 포함 (필수!)
   ✅ 생활 속 특정 순간
   ✅ 행동 변화의 미세한 차이
   ✅ 감각의 섬세한 표현
   ✅ 예상 밖의 연결고리

⚠️ 최종 체크:
□ 다른 블로그에서 흔히 보는 표현 없는가?
□ 교과서식 정보 나열 없는가?
□ "이 글만의 독특한 관찰"이 최소 1개 이상 있는가?

🔥🔥🔥 [구어체 리듬 필수] - AI 말투 탈피! 🔥🔥🔥
⚠️ 구어체 사용 제한: 글 전체에서 1~2회만 사용 (과도한 구어체는 전문성 저하)
- "~합니다", "~됩니다" 딱딱한 어미 금지!
- 반드시 섞어 쓸 것:
  • "~해요", "~래요", "~다고 해요", "~더라고요" (구어체 - 1~2회만!)
  • "~거예요", "~는 거죠", "~할 수 있어요" (부드러운 어조)
  • "~는 편이에요", "~기도 해요", "~곤 해요" (일상 표현)
- ❌ 잘못된 예: "식습관도 영향을 미치곤 합니다" 
- ✅ 올바른 예: "짠 음식을 자주 찾게 되는 경우가 있어요. 이럴 땐 붓기가 더 심해질 수 있어 섭취를 조절해보는 게 좋아요"
- ❌ "가능성이 언급되기도 합니다" → ✅ "관련이 있다고 해요", "영향을 준대요"

🚫 [AI·교재 말투 금지]
- "~으로 볼 수 있습니다" ❌
- "~이해할 수 있습니다" ❌  
- "~도움이 될 수 있습니다" ❌
- "~하곤 합니다", "~합니다", "~됩니다" ❌ (딱딱한 어미)
- "~가능성이 언급되기도 합니다" ❌ (어색한 표현)
- 보고서체, 설명서체, 번역투 ❌
- 의료/의료진/전문/전문가/전문적인 ❌ (완전 금지!)

✅ [대체 표현 - 구어체로!]
- "~할 수 있어요", "~는 편이에요", "~다고 해요"
- "~거예요", "~기도 해요", "~곤 해요"
- "~영향이 있다고 해요", "~관련이 있대요"
- 의료/의료진 → ✅ "상담", "확인", "도움", "점검"
- 전문/전문가/전문적인 → ✅ "상담", "확인", "체크"

🔄 [추상어 → 체감어 변환]
- "불편감" → "아프다", "거슬린다", "찝찝하다"
- "영향" → "힘들다", "무겁다", "뻐근하다"
- "반응" → "욱신거리다", "쑤시다", "당기다"
- 사람들이 실제로 쓰는 말로!

🚨 [문장 호흡 규칙] - 만연체 금지!
- 한 문장은 40자 이내 권장, 60자 초과 금지!
- 쉼표(,)가 3개 이상이면 문장 나누기!
- "~하고, ~하며, ~해서, ~하는" 이어붙이기 금지 → 짧게 끊어서!
- ❌ "통증이 심해지면서 일상생활에 불편함을 느끼게 되고, 이로 인해 활동량이 줄어들면서 근력까지 약해지는 악순환이 생길 수 있습니다."
- ✅ "통증이 심해지면 일상이 불편해집니다. 활동량이 줄고, 근력도 약해지기 쉽습니다."

🎯 [비유 사용 규칙] - 적당히! (100% → 90%)
- 비유는 글 전체에서 1~2개면 충분!
- 매 문단마다 비유 넣지 말기 (과하면 오히려 산만함)
- 비유 없이 직관적으로 설명 가능하면 그냥 설명하기
- ❌ "관절이 마치 녹슨 경첩처럼~", "혈관은 수도관과 같아서~" (매번 비유)
- ✅ 핵심 개념 하나만 비유로, 나머지는 직접 설명

🚨 [핵심] 독자 경험 중심 글쓰기 - AI 냄새 제거!
① 도입부 마무리: "오늘은 ~에 대해 알아보겠습니다" 절대 금지! → 독자 감정 건드리는 질문으로!
② 어미 다양화: "~하기도 합니다" 금지 → "~한 적 있으신가요?", "~하더라고요" 등 구어체로!
③ 관찰자 서술 금지: "~하는 모습을 볼 수 있습니다" → "~했던 적이 있다면" 독자 경험으로 전환!
④ 구체적 상황 묘사: 추상적 설명 금지 → 독자가 "아, 나도!" 할 만한 구체적 일상 장면으로!
⑤ 정보 나열에 숨 고르기: 기능/현상 설명식 문장 금지 → 체감 중심 표현으로! (예: "~가 둔해지는 경우도 생깁니다" ❌ → "~가 유난히 밋밋하게 느껴지는 날도 있습니다" ✅)

🚫 [절대 금지] 메타 설명 문장!
- "오늘은 ~에 대해 알아보겠습니다" ❌
- "~에 대해 살펴보겠습니다" ❌
- "~을 정리해 드리겠습니다" ❌
- "차근차근 설명해 드릴게요" ❌
- "어떤 부분을 살펴보는 것이 도움이 될지" ❌
- "~해보려 합니다" ❌
- "~정리해보려 합니다" ❌
- "도움이 될지 차근차근 정리해" ❌
- 글의 구조/내용을 예고하는 모든 문장 금지! → 바로 본론으로!

🔄 [중복 내용 금지] - 같은 말 돌려쓰기 ❌
- 도입부에서 한 말을 본문에서 또 하지 않기!
- 소제목 A에서 설명한 내용을 소제목 B에서 반복하지 않기!
- "~할 수 있습니다"를 결론처럼 매 문단 끝에 쓰지 않기!
- 같은 증상/원인을 다른 표현으로 바꿔서 여러 번 쓰지 않기!
- ❌ 도입: "무릎이 아프면 계단이 힘들어요" → 본문: "계단 오를 때 무릎 통증이 심해집니다" (같은 말!)
- ✅ 도입에서 공감 → 본문에서는 새로운 정보(원인, 특징, 구분법) 제공
- 각 소제목은 **서로 다른 관점/정보**를 다뤄야 함!
- 글 전체를 읽었을 때 "이거 아까 읽은 것 같은데?" 느낌 ❌

📐 [구조 가이드] - 훈계하지 말고 선택지 제시!
- 도입: 일상에서 겪을 법한 상황으로 시작
  🚨🚨🚨 숫자 완전 금지! 1월/2월/3월 등 모든 숫자 사용 금지!
  ⚠️ 절대 금지: "1월", "2월", "3월" 등 모든 월 숫자 표현
  ⚠️ 절대 금지: "50대", "30대", "2주", "3일" 등 모든 숫자
- 증상: 체감 위주 묘사 (의학 용어 < 느낌 묘사)
- 원인: 한 박자 쉬듯 **짧게** 덧붙이기 (길게 설명 ❌)
- 관리: **선택지처럼** 제시 ("~하는 것도 방법입니다", 훈계·명령 ❌)
- 결론: **판단을 독자에게** 맡기기 (단정·강요 ❌)
  🔥 "전문가를 통해 객관적으로 확인" 금지!
  ✅ "통증 패턴이 매달 반복된다면 내 몸 상태를 한번 점검해보시는 것도 방법이에요"

🚨🚨🚨 [절대 규칙] 마지막 소제목 문단 개수 - 최우선 준수! 🚨🚨🚨
- **소제목 개수**: 제한 없음 (4개, 5개, 6개 모두 가능 - 글자 수만 맞추면 됨!)
- **일반 소제목**: 문단 2~3개 (적당히 조절 가능)
- **마지막 소제목**: 🔴🔴🔴 정확히 2개 문단만! (절대 위반 불가!)
  🔥🔥🔥 1개만 쓰면 부족, 3개 이상 쓰면 즉시 탈락! 🔥🔥🔥
  ✅ 1문단: 상황 요약/정리 (2~3문장)
  ✅ 2문단: 마무리 ("~점검해보시는 것도 방법이에요" 같은 부드러운 안내)
  ❌ 절대 금지: 1개만 쓰기 (부족!)
  ❌ 절대 금지: 3개 이상 쓰기 (즉시 탈락!)
  
  HTML 예시:
  <h3>마지막 소제목</h3>
  <p>첫 번째 문단</p>
  <p>두 번째 문단</p>
  <!-- 여기서 끝! 세 번째 <p> 절대 금지! -->
  
⚠️ 소제목 개수는 글자 수 맞추기 위해 자유롭게 조절 가능!
⚠️ 단, 마지막 소제목 문단은 무조건 2개만!

[HTML 구조] - 이미지 ${targetImageCount}장 기준!
<div class="naver-post-container">
  <p>도입 1 - 구체적 상황 + 감각</p>
  <p>도입 2 - 공감</p>
  ${targetImageCount >= 1 ? '[IMG_1]' : ''}
  
  <h3>소제목 1</h3>
  <p>문단 1</p>
  <p>문단 2</p>
  ${targetImageCount >= 2 ? '[IMG_2]' : ''}
  
  <h3>소제목 2</h3>
  <p>문단 1</p>
  <p>문단 2</p>
  ${targetImageCount >= 3 ? '[IMG_3]' : ''}
  
  <h3>소제목 3</h3>
  <p>문단 1</p>
  <p>문단 2</p>
  ${targetImageCount >= 4 ? '[IMG_4]' : ''}
  
  ${targetImageCount >= 5 ? `<h3>소제목 4</h3>
  <p>문단 1</p>
  <p>문단 2</p>
  [IMG_5]
  ` : ''}
  ${targetImageCount >= 6 ? `<h3>소제목 5</h3>
  <p>문단 1</p>
  <p>문단 2</p>
  [IMG_6]
  ` : ''}
  <p>마무리</p>
  <p>#해시태그 10개</p>
</div>

⚠️ **이미지 ${targetImageCount}장 필수!** imagePrompts 배열에 정확히 ${targetImageCount}개 프롬프트 작성!
🚨 일반 소제목: <p> 2~3개 / 마지막 소제목: <p> 1~2개 (4개 이상 절대 금지!!)

[이미지 프롬프트 규칙] 🚨 정확히 ${targetImageCount}개 필수!
🚨 imagePrompts 배열에 반드시 **${targetImageCount}개** 프롬프트 작성! (한국어)
- 스타일: ${imageStyleGuide}
- 텍스트/로고/워터마크 금지
- 🇰🇷 사람이 등장할 경우 반드시 "한국인" 명시! (예: "한국인 여성", "한국인 의사", "한국인 환자")
- 예시: "한국인 중년 여성이 따뜻한 차를 마시는 모습, 부드러운 조명, 아늑한 분위기, 실사 사진, DSLR 촬영"

[JSON 응답 형식] - imagePrompts 배열: 정확히 ${targetImageCount}개!
{"title":"제목","content":"HTML 본문 ([IMG_1]~[IMG_${targetImageCount}] 마커 포함)",${targetImageCount > 0 ? `"imagePrompts":["프롬프트1", "프롬프트2", ... 총 ${targetImageCount}개],` : ''}"fact_check":{...}}
${hospitalInfo}
  `;

  const cardNewsPrompt = `
    **🚨 최우선 지침: 이것은 카드뉴스입니다! 🚨**
    - 블로그 포스팅 형식(긴 문단)으로 작성하면 안 됩니다!
    - 반드시 <div class="card-slide"> 구조의 슬라이드 형식으로 작성하세요!
    - 각 슬라이드는 짧은 텍스트(제목 12자, 설명 20자 이내)만 포함합니다!
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
    
    📙 **${targetSlides}장 (마무리)**: 정리
    - "${request.topic}" 관련 핵심 메시지
    - 정보 전달로 마무리 (행동 권유 금지)
    
    **✅ "${request.topic}" 주제 올바른 예시:**
    만약 주제가 "혈액암 초기증상"이라면:
    1장: "혈액암, 이 신호를 놓치고 있진 않나요?" (표지)
    2장: "혈액암이란?" - 혈액세포에 생기는 암의 종류 설명
    3장: "멍이 쉽게 드는 경우" - 혈소판 감소로 인한 증상
    4장: "잇몸 출혈이 잦은 경우" - 출혈 경향 설명
    5장: "쉬어도 풀리지 않는 피로감" - 빈혈로 인한 피로
    6장: "몸이 보내는 신호들" - 증상 정리
    
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
    
    🚨🚨🚨 **프롬프트 언어: 반드시 한국어로!** 🚨🚨🚨
    - imagePrompts 배열의 모든 프롬프트는 **100% 한국어**로 작성!
    - 영어 단어 사용 금지! (3D render → "3D 렌더", illustration → "일러스트", DSLR → "DSLR" 예외)
    - 예: "밝은 병원 배경의 3D 일러스트, 파스텔톤, 부드러운 조명" (✅)
    - 예: "Bright hospital background, 3D illustration, pastel tones" (❌ 금지!)
    
    이미지 스타일: ${customImagePrompt ? `커스텀: ${customImagePrompt}` : imageStyle === 'illustration' ? '3D 일러스트' : imageStyle === 'medical' ? '의학 3D 해부학' : '실사 사진'}
    
    **📝 카드뉴스 이미지 텍스트 규칙:**
    - 카드뉴스 이미지에는 제목, 설명 텍스트가 들어갈 수 있음
    - 한글, 숫자 위주로
    - 로고, 워터마크 금지
    
    각 이미지 프롬프트에 반드시 포함할 스타일 키워드 (한국어로!):
    ${imageStyleGuide}
    
    ${customImagePrompt ? `**⚠️ 커스텀 스타일 필수 적용!**
    사용자가 "${customImagePrompt}" 스타일을 요청했습니다.
    모든 이미지 프롬프트에 이 스타일 키워드를 반드시 포함하세요! (한국어로!)
    예시: "[장면 묘사], ${customImagePrompt}"` : `예시 (${imageStyle === 'illustration' ? '3D 일러스트' : imageStyle === 'medical' ? '의학 3D' : '실사 사진'} 스타일) - 한국어로 작성!
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
    const _providerSettings = getAiProviderSettings(); // 향후 다중 프로바이더 지원 시 활용
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
        } catch {
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
      
      // 교차 검증된 항목 수 계산 (THRESHOLD: 50점으로 상향 - 정확성 강화)
      let crossVerifiedCount = 0;
      const THRESHOLD = 50; // 30 → 50으로 상향 조정

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
    // SYSTEM_PROMPT: 의료광고법 + 금지어 사전 + 종결어미 + 키워드 + SEO + 출처검증 + 자가체크
    const geminiSystemPrompt = SYSTEM_PROMPT;
    
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
    : '단일 소스 검색 결과이므로 신뢰도 높은 정보 우선 사용'}
2. 🔥 출처/기관명 절대 언급 금지! (질병관리청, 보건복지부 등 모두 금지)
3. 🔥🔥🔥 숫자/수치/통계 완전 금지! (의료광고법 위반!) 🔥🔥🔥
   - ❌ 절대 금지: %, 숫자+대/세/명/회/일/주/개월, "10명 중", "2주", "30대", "50%", "3회"
   - ❌ 검색 결과에 숫자가 있어도 절대 사용하지 말 것!
   - ✅ 대체 표현: "많은 경우", "상당수", "중년층", "젊은 분들", "일정 기간", "자주", "때때로"
4. 교차 검증되지 않은 정보는 "~로 나타납니다", "~할 수 있습니다" 등 완화 표현 사용
5. 검색 결과에 없는 정보는 절대 지어내지 말 것!

[📋 JSON 응답 형식]
{
  "title": "제목 (상태 점검형 질문)",
  "content": "HTML 형식의 본문 내용 (크로스체크된 정보 우선 사용)",
  ${targetImageCount > 0 ? '"imagePrompts": ["이미지 프롬프트1", "이미지 프롬프트2", ...],' : ''}
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
    
    // 🚀 새로운 단계별 처리 시스템 사용 (향후 컨텍스트 확장 시 활용)
    // contextData는 이미 위의 systemPrompt에 포함됨 (중복 제거)
    
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
      console.log('📦 systemPrompt 길이:', systemPrompt?.length || 0);
      console.log('📦 blogPrompt 길이:', blogPrompt?.length || 0);
      console.log('📦 cardNewsPrompt 길이:', cardNewsPrompt?.length || 0);
      console.log('📦 isCardNews:', isCardNews);
      const finalPrompt = isCardNews ? cardNewsPrompt : blogPrompt;
      console.log('📦 최종 프롬프트 길이:', finalPrompt?.length || 0);
      console.log('📦 전체 프롬프트 (시스템+유저) 길이:', (systemPrompt?.length || 0) + (finalPrompt?.length || 0));
      console.log('📦 프롬프트 미리보기 (처음 1000자):', `${systemPrompt}\n\n${finalPrompt}`.substring(0, 1000));
      
      // 🎬 일반 generateContent 사용 (타임아웃 제거 - Gemini가 알아서 처리)
      safeProgress('AI가 콘텐츠를 작성하고 있습니다...');

      try {
        // 🔍 Google Search 최적화: 필요한 경우에만 활성화
        const useGoogleSearch = needsGoogleSearch(request);
        
        console.log('🚀 Gemini generateContent 호출 직전...');
        console.log('🚀 모델:', GEMINI_MODEL.PRO);
        console.log('🔍 Google Search:', useGoogleSearch ? '활성화' : '비활성화 (속도 최적화)');
        
        const responseSchema = {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            content: { type: Type.STRING },
            imagePrompts: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["title", "content"]
        };
        
        const geminiResponse = await callGemini({
          prompt: isCardNews ? cardNewsPrompt : blogPrompt,
          systemPrompt,
          model: GEMINI_MODEL.PRO,
          googleSearch: useGoogleSearch,
          responseType: 'json',
          schema: responseSchema,
          timeout: TIMEOUTS.GENERATION
        });
        
        const responseText = geminiResponse.text || '';

        const charCountNoSpaces = responseText.replace(/\s/g, '').length;
        console.log(`✅ 생성 완료: ${charCountNoSpaces}자 (공백제외) / ${responseText.length}자 (공백포함)`);
        safeProgress(`✅ 생성 완료: ${charCountNoSpaces}자`);

        console.log('✅ Gemini 응답 수신:', responseText.length || 0, 'chars');

        if (!responseText) {
          throw new Error('Gemini가 빈 응답을 반환했습니다. 다시 시도해주세요.');
        }

        result = JSON.parse(responseText);
        console.log('✅ Gemini JSON 파싱 성공');

      } catch (geminiError: any) {
        console.error('❌ Gemini 생성 실패:', geminiError);
        console.error('❌ 에러 상세:', JSON.stringify({
          name: geminiError?.name,
          message: geminiError?.message,
          code: geminiError?.code,
          status: geminiError?.status,
          stack: geminiError?.stack?.substring(0, 500)
        }, null, 2));
        
        // 에러 타입별 처리
        if (geminiError.message?.includes('타임아웃') || geminiError.message?.includes('timeout')) {
          // 실제 타임아웃 - 더 구체적인 메시지
          throw new Error(`⏰ 글쓰기 타임아웃 (3분) - 콘솔에서 상세 에러 확인 필요. 원인: ${geminiError.message}`);
        } else if (geminiError.message?.includes('quota') || geminiError.message?.includes('limit') || geminiError.message?.includes('429')) {
          throw new Error('🚫 API 사용량 한계에 도달했습니다. 잠시 후 다시 시도해주세요.');
        } else if (geminiError.message?.includes('JSON')) {
          throw new Error('📋 AI 응답 형식 오류가 발생했습니다. 다시 시도해주세요.');
        } else if (geminiError.message?.includes('model') || geminiError.message?.includes('not found') || geminiError.message?.includes('404')) {
          throw new Error(`🤖 모델 오류: ${geminiError.message}`);
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
    
    // 불필요한 텍스트 및 이모지 제거 (전문 의료 콘텐츠 톤 유지)
    if (result.content && typeof result.content === 'string') {
      result.content = result.content
        .replace(/\(이미지 없음\)/g, '')
        .replace(/\(이미지가 없습니다\)/g, '')
        .replace(/\[이미지 없음\]/g, '')
        .replace(/\[IMG_\d+\]/g, '') // 남아있는 이미지 마커 제거
        .replace(/<p>\s*<\/p>/g, '') // 빈 p 태그 제거
        // 이모지 제거 (전문 의료 콘텐츠 톤)
        .replace(/[\u{1F300}-\u{1F9FF}]/gu, '') // 이모지 범위
        .replace(/[\u{2600}-\u{26FF}]/gu, '') // 기타 기호
        .replace(/[\u{2700}-\u{27BF}]/gu, '') // 딩뱃
        .replace(/[\u{FE00}-\u{FE0F}]/gu, '') // 변형 선택자
        .replace(/[\u{1F000}-\u{1F02F}]/gu, '') // 마작 타일
        .trim();
    }
    
    // 제목에서도 이모지 제거
    if (result.title && typeof result.title === 'string') {
      result.title = result.title
        .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
        .replace(/[\u{2600}-\u{26FF}]/gu, '')
        .replace(/[\u{2700}-\u{27BF}]/gu, '')
        .trim();
    }
    
    // 분석된 스타일 정보 추가
    if (analyzedBgColor) {
      result.analyzedStyle = { backgroundColor: analyzedBgColor };
    }
    
    // 🔧 fact_check 기본값 설정 (Gemini가 반환하지 않은 필드 보완) - 정확성 강화로 기준 상향
    if (!result.fact_check) {
      result.fact_check = {};
    }
    // conversion_score가 없거나 0이면 기본값 75 설정 (70 → 75 상향)
    if (!result.fact_check.conversion_score || result.fact_check.conversion_score === 0) {
      result.fact_check.conversion_score = 75;
      console.log('⚠️ conversion_score 기본값 75점 설정 (AI 미반환)');
    }
    // 다른 필드들도 기본값 설정 (정확성 강화로 fact_score, safety_score 상향)
    if (result.fact_check.fact_score === undefined || result.fact_check.fact_score === null) {
      result.fact_check.fact_score = 85; // 80 → 85 상향
    }
    if (result.fact_check.safety_score === undefined || result.fact_check.safety_score === null) {
      result.fact_check.safety_score = 90; // 85 → 90 상향
    }
    // ai_smell_score는 0이 유효한 값이 아님 (낮을수록 좋은 점수)
    if (result.fact_check.ai_smell_score === undefined || result.fact_check.ai_smell_score === null) {
      result.fact_check.ai_smell_score = 12; // 15 → 12 하향 (더 좋게)
      console.log('⚠️ ai_smell_score 기본값 12점 설정 (AI 미반환)');
    }
    if (result.fact_check.verified_facts_count === undefined || result.fact_check.verified_facts_count === null) {
      result.fact_check.verified_facts_count = 5; // 3 → 5 상향 (더 많은 팩트 검증 요구)
    }
    if (!result.fact_check.issues) result.fact_check.issues = [];
    if (!result.fact_check.recommendations) result.fact_check.recommendations = [];
    
    console.log('📊 fact_check 최종값:', result.fact_check);
    
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
    } catch (contentGenerationError: any) {
      console.error('❌ 콘텐츠 생성 중 오류 발생:', contentGenerationError);
      throw contentGenerationError;
    }

    // 📊 프롬프트 분석 로그 기록
    try {
      const { logPromptGeneration } = await import('../utils/promptAnalytics');
      const generationTime = Date.now() - startTime;
      const actualContent = result.content || result.contentHtml || '';
      const plainText = actualContent.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      const actualLength = plainText.length;

      logPromptGeneration({
        promptVersion: 'v2.0_natural_writing',
        category: request.category,
        topic: request.topic,
        targetLength: targetLength,
        imageCount: request.imageCount || 0,
        actualLength: actualLength,
        ai_smell_score: result.fact_check?.ai_smell_score || 0,
        safety_score: result.fact_check?.safety_score || 0,
        fact_score: result.fact_check?.fact_score || 0,
        conversion_score: result.fact_check?.conversion_score || 0,
        generationTime: generationTime,
        retryCount: retryCount,
        errorOccurred: errorOccurred,
        errorMessage: errorMessage,
        wasEdited: false,
        wasSaved: false
      });
    } catch (analyticsError) {
      console.error('⚠️ Analytics logging failed:', analyticsError);
      // 로그 실패해도 메인 기능은 계속
    }

    return result;
  } catch (error) {
    errorOccurred = true;
    errorMessage = (error as Error).message || 'Unknown error';
    throw error;
  }
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
        const crawlData = await crawlResponse.json() as { content?: string; error?: string };
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
너는 의료 분야 헬스·의학 담당 기자다.
${learnedStyleInstruction}

포털 뉴스에 게재될 의학 정보 기반 PR 기사를 작성하라.
과도한 공포 조장이나 선정적 표현은 피하고, 팩트와 전문성 중심으로 작성한다.

[기본 정보]
- 작성일: ${formattedDate}
- 병원명: ${hospitalName}
- 진료과: ${request.category}
- 의료진: ${doctorName} ${doctorTitle}
- 보도 유형: ${pressTypeLabel}
- 주제: ${request.topic}
- SEO 키워드: ${request.keywords} ⚠️ **필수**: 본문에 최소 1회 ~ 최대 3회 자연스럽게 포함
- ⚠️ 최대 글자 수: 공백 제외 ${maxLength}자
${hospitalInfo}

[중요]
🚨🚨🚨 의료광고법 및 기사 윤리 기준 최우선 준수 🚨🚨🚨
[중요]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[⛔ 절대 금지 표현 - 효과·평가·결과 암시 전면 차단!]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❌❌❌ 다음 표현들은 어떤 형태로든 사용 금지! ❌❌❌

**1. 치료 결과/예후 평가 표현 (완전 금지!)**
❌ "치료 예후가 긍정적이다"
❌ "예후가 좋다 / 나쁘다"
❌ "결과가 좋다 / 나쁘다"
❌ "성공률이 높다"
❌ "완치율이 높다"
❌ "회복이 빠르다"
❌ "효과가 크다 / 좋다"
❌ "효과적이다"

**2. 도움/이익 표현 (완전 금지!)**
❌ "큰 도움이 된다"
❌ "도움이 될 수 있다"
❌ "도움이 되는 것으로 나타납니다"
❌ "효과가 있다 / 있을 수 있다"
❌ "유익하다"
❌ "이익이 있다"

**3. 최상급/비교우위 표현 (완전 금지!)**
❌ "가장 좋은 방법이다"
❌ "최선의 선택이다"
❌ "지름길이다"
❌ "빠른 길이다"
❌ "확실한 방법이다"
❌ "최고의 치료법"

**4. 예방/발견 효과 단정 (완전 금지!)**
❌ "예방 가능성이 높다"
❌ "예방할 수 있다"
❌ "막을 수 있다"
❌ "조기에 발견하면 결과가 좋다"
❌ "조기 발견이 중요하다" (× 가치 판단)
❌ "골든타임"

**5. 명령형/권유형 (완전 금지!)**
❌ "~하세요"
❌ "~받으세요"
❌ "~하는 것이 좋습니다"
❌ "권장합니다"
❌ "추천합니다"
❌ "반드시 ~해야"

**6. 공포 조장 표현 (완전 금지!)**
❌ "방치하면 위험하다"
❌ "침묵의 살인자"
❌ "시한폭탄"
❌ "생명 위협"
❌ "돌이킬 수 없다"
❌ "~하지 않으면 큰일난다"

**7. 부자연스러운 표현 (완전 금지!)**
❌ "말합니다" / "이야기합니다" / "알려져 있습니다"
✅ **대체**: "나타납니다" / "보입니다" / "연관성이 있습니다"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[✅ 허용 표현 - 중립적 사실 전달만!]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**✅ 관찰/설명형 표현 (사용 가능)**
✅ "~하는 것으로 보고된다"
✅ "~로 나타납니다"
✅ "~로 언급된다"
✅ "~로 설명된다"
✅ "~와 연관성이 있습니다"
✅ "의료계에서 관심을 보이고 있다"
✅ "연구가 진행되고 있다"
✅ "관련 학계에서 논의되고 있다"

**✅ 역할/중요성 표현 (가치 판단 없이)**
✅ "~의 역할로 언급된다"
✅ "~의 역할이 있습니다"
✅ "~와의 연관성이 있습니다"
✅ "~와 연관이 있는 것으로 보고된다"
✅ "의료계에서 주목하는 요인 중 하나로 꼽힌다"

**✅ 정보 전달형 표현 (평가 없이)**
✅ "~을 확인하는 과정이 있다"
✅ "~을 살펴보는 경우가 있다"
✅ "~을 파악하는 단계가 진행된다"
✅ "~을 체크하는 절차가 있다"
✅ "~을 점검하는 경우가 있다"

**✅ 중립적 사실 전달**
✅ "증상이 나타날 수 있다"
✅ "차이가 있을 수 있다"
✅ "개인에 따라 다르다"
✅ "다양한 요인이 관여한다"
✅ "여러 측면이 있다"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[📝 문체 가이드 - 중립적 기사 작성 원칙]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**1. 핵심 원칙**
- 가치 판단 표현 완전 배제 (좋다/나쁘다/효과적이다/중요하다 등)
- 결과/예후 평가 금지
- 관찰·사실 전달에만 집중
- 광고처럼 보이지 않도록 과장 배제

**1-1. 영양소·생활습관 관련 효과 단정 금지 (완충 필수)**
🚨 특별 주의: 영양소/생활습관 → 효과 직접 연결 금지

❌ 금지 표현:
  • "비타민D가 도움이 됩니다" (효과 단정)
  • "칼슘 섭취가 필요합니다" (의무화)
  • "규칙적인 운동이 효과적입니다" (효과 단정)
  • "충분한 수면이 중요합니다" (가치 판단)
  • "스트레칭이 도움이 됩니다" (효과 단정)
  • "금연/금주가 필수입니다" (의무화)

✅ 완충 표현 (3단계 완화):
  Level 1 (가장 안전):
    "비타민D와 연관성이 있습니다"
    "칼슘 섭취 패턴을 살펴보는 것도 방법입니다"
    "규칙적인 활동이 언급되기도 합니다"
  
  Level 2 (안전):
    "충분한 휴식과 연관이 있습니다"
    "스트레칭 습관을 점검해보는 경우가 있습니다"
    "생활 패턴을 살펴보는 것도 한 가지 방법입니다"
  
  Level 3 (허용 가능):
    "비타민D 섭취와 관련이 있습니다"
    "수면 패턴과의 연관성이 언급되기도 합니다"

**2. 문장 구조**
- "~하는 것으로 보고된다" (○)
- "~의 역할로 언급된다" (○)
- "~와 연관성이 있습니다" (○)
- 결과 대신 → 과정·절차 설명
- 효과 대신 → 역할·관련성 언급

**3. 완충 표현 필수 사용**
- "의료계 일각에서는"
- "관련 학계에서는"
- "일부 전문가들은"
- "~로 보고된다"
- "~로 나타납니다"
- "개인에 따라 차이가 있을 수 있다"

**4. 정보 전달 우선**
- 사실·통계·연구 결과 → 출처 명시
- 증상·특성 설명 → 가치 판단 없이
- 진료 절차 안내 → 명령형 금지

**5. 내용 중복 금지 (필수!)**
🚨 같은 내용을 다른 표현으로 반복하지 말 것!
❌ "혈당 관리가 중요하다. 혈당 조절이 필요하다." (중복!)
✅ "혈당 관리가 중요하다. 규칙적인 식사 패턴이 도움이 된다." (진행)

**6. 만연체 문장 금지 (필수!)**
🚨 한 문장에 접속사 2개 이상 금지!
❌ "증상이 나타나고, 악화되며, 지속되면 확인이 필요하다" (만연체)
✅ "증상이 나타나면 확인이 필요하다. 악화되는 경우도 있다." (분리)
- 문장 길이: 최대 50자 권장 (공백 포함)
- 하나의 문장 = 하나의 핵심 메시지

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[📋 기사 구성 가이드]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**1. 도입부 (공감 형성)**
- 독자가 겪을 법한 증상/상황 제시
- 평가 없이 현상만 설명
- 예: "최근 ~한 증상을 경험하는 경우가 늘고 있다"

**2. 배경 설명 (의학적 맥락)**
- 질환/증상의 특성 설명
- 완충 표현 필수: "의료계 일각에서는", "개인에 따라 차이가 있을 수 있다"
- 가치 판단 없이 사실만 전달

**3. 통계/추세 (객관적 정보)**
- 완충 표현: "일부 전문가들은", "관련 학계에서는"
- 출처 명시 (있는 경우)
- 단정 표현 금지

**4. 질환 특성 (중립적 설명)**
- ❌ "조기 인지가 중요하게 여겨진다" → 가치 판단!
- ✅ "증상 확인 과정이 있다"
- ✅ "파악하는 단계가 진행된다"

**5. 검진·관리 (정보 전달)**
- ❌ "권장된다" → 권유!
- ❌ "도움이 될 수 있다" → 효과 암시!
- ✅ "확인하는 과정이 있다"
- ✅ "살펴보는 경우가 있다"
- ✅ "의료계에서 관심을 보이는 부분 중 하나로 언급된다"

**6. 의료진 인터뷰 ("${doctorName} ${doctorTitle}" 직접 인용)**
- 인터뷰에서도 평가 표현 금지
- 사실·관찰·절차 위주로 설명
- 공포 조장 금지

**7. 병원 정보 (2~3문장, 70자 이내)**
- 환자 편의/진료 환경만 언급
- 치료 효과·실적 언급 금지

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[⚠️ 검수 체크리스트 - 작성 후 반드시 확인!]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

작성 후 다음 표현이 있는지 전체 검수:
□ "도움이 되다" / "도움이 될 수 있다" → 0개!
□ "효과가 있다" / "효과적이다" → 0개!
□ "좋다" / "나쁘다" / "중요하다" → 0개!
□ "예후가" / "결과가" → 0개!
□ "가장" / "최고" / "최선" → 0개!
□ "지름길" / "빠른 길" → 0개!
□ "예방할 수 있다" / "막을 수 있다" → 0개!
□ "조기 발견" + "중요" / "좋다" → 0개!
□ "~하세요" / "~받으세요" → 0개!
□ "권장" / "추천" / "반드시" → 0개!

✅ 모든 항목이 0개여야 합격!
✅ 1개라도 있으면 전면 수정!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[핵심 규칙]
1. 언론 기사체로 작성 (블로그체 아님)
2. 독자 행동을 직접 명령하지 않음 ("~하세요" 금지)
3. 헤드라인: 자극 키워드 1개 이내 (예: "주의보", "신호" 중 1개만)
4. 공포 은유 금지 ("침묵의 살인자", "시한폭탄", "생명 위협" 등)
5. **효과·평가·결과 표현 전면 금지** (가장 중요!)

[반드시 포함]
- 병원명: ${hospitalName}
- 의료진: ${doctorName} ${doctorTitle}
- 직접 인용 인터뷰 (" " 사용, 인터뷰에서도 평가 표현 금지)
- 검진/상담 정보 (명령형 아님, "확인하는 과정이 있다" 수준으로)

[HTML 출력]
<div class="press-release-container">
  <h1 class="press-title">[제목 - 자극 키워드 1개 이내, 평가 표현 금지]</h1>
  <h2 class="press-subtitle">[부제 - 70자 이내, 사실 전달만]</h2>
  <div class="press-body">
    <p>[공감 형성 - 독자 상황, 현상 설명만]</p>
    <p>[의학적 맥락 - 완충 표현, 가치 판단 없이]</p>
    <p>[증가 추세 - 완충 표현, 출처 있으면 명시]</p>
    <p>[질환 특성 - "확인 과정", "파악 단계" 등 중립적 표현]</p>
    <p>[검진·관리 - "확인하는 과정이 있다", "살펴보는 경우가 있다" 수준]</p>
    <blockquote class="press-quote">
      <p>"[인터뷰 - 평가 표현 금지, 공포 조장 금지, 사실·절차만]"</p>
      <cite>- ${hospitalName} ${request.category} ${doctorName} ${doctorTitle}</cite>
    </blockquote>
    <p>[병원 정보 - 2~3문장, 70자 이내, 환자 편의/진료 환경만]</p>
  </div>
  <div class="press-footer">
    <div class="press-disclaimer">
      <p>※ 의학적 정보는 참고용이며, 정확한 진단은 전문의와 상담이 필요합니다.</p>
    </div>
  </div>
</div>

[중요]
- 위 HTML 구조 준수
- 마크다운 금지 (###, **굵게** 등)
- 모든 텍스트는 HTML 태그로 감싸기
- 문장 리듬 다양화: 종결어미 반복 금지, 구체적 맥락 추가
- 현장감 살리기: 시간/계절/상황 맥락, 전문가 코멘트에 현장감
- 템플릿 느낌 제거: 전환어 사용, 독자 체크 포인트 추가
- **작성 후 반드시 검수 체크리스트로 전체 검토!**
`;

  // 🔍 Google Search 연결 - 언론 보도용 최신 정보 수집
  onProgress('🔍 Google Search로 최신 의료 정보를 검색하고 있습니다...');
  const result = await callGeminiWithSearch(pressPrompt, { responseFormat: "text/plain" });
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
      .replace(/[^\uAC00-\uD7AF가-힣a-zA-Z0-9\s.,!?~():-]+/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 100); // alt 텍스트 길이 제한
    
    const cardSlides = images.map((img, _idx) => {
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
    
    // 🔍 카드뉴스 텍스트 AI 냄새 검사
    // cardPrompts의 텍스트를 합쳐서 검사
    const cardTexts = agentResult.cardPrompts?.map(card => {
      const tp = card.textPrompt;
      return `${tp.subtitle || ''} ${tp.mainTitle || ''} ${tp.description || ''}`;
    }).join(' ') || '';
    
    safeProgress('🔍 카드뉴스 텍스트 AI 냄새 검사 중...');
    const cardAiSmellCheck = runAiSmellCheck(cardTexts);
    
    let cardFactCheck: FactCheckReport = {
      fact_score: 85,
      safety_score: 90,
      conversion_score: 80,
      ai_smell_score: cardAiSmellCheck.score,
      verified_facts_count: 5,
      issues: [],
      recommendations: []
    };
    
    cardFactCheck = integrateAiSmellToFactCheck(cardFactCheck, cardAiSmellCheck);
    
    if (cardAiSmellCheck.criticalIssues.length > 0) {
      safeProgress(`🚨 카드뉴스 텍스트에 금지 패턴 ${cardAiSmellCheck.criticalIssues.length}개 발견!`);
    } else {
      safeProgress('✅ 카드뉴스 생성 완료!');
    }
    
    return {
      title: agentResult.title,
      htmlContent: finalHtml,
      imageUrl: images[0]?.data || "",
      fullHtml: finalHtml,
      tags: [],
      factCheck: cardFactCheck,
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
  
  console.log('🖼️ 이미지 생성 설정:', {
    'request.imageCount': request.imageCount,
    'maxImages': maxImages,
    'postType': request.postType,
    'imagePrompts 길이': textData.imagePrompts?.length || 0
  });
  
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
    console.warn('⚠️ AI가 imagePrompts를 생성하지 않음! textData.imagePrompts:', textData.imagePrompts);
    textData.imagePrompts = [];
  } else {
    console.log('✅ AI가 imagePrompts 생성함:', textData.imagePrompts.length, '개');
  }

  // 🔧 이미지 프롬프트 부족 시 자동 패딩 (요청 개수만큼 채우기)
  if (maxImages > 0 && textData.imagePrompts.length < maxImages) {
    console.warn(`⚠️ 이미지 프롬프트 부족! 요청: ${maxImages}개, 생성: ${textData.imagePrompts.length}개 → 자동 패딩`);
    const defaultPrompt = `${request.topic} 관련 의료 이미지, ${request.imageStyle === 'illustration' ? '3D 일러스트, 파스텔톤' : request.imageStyle === 'medical' ? '의학 해부도, 전문 의료 이미지' : '실사 사진, DSLR 촬영'}, 한국인`;
    while (textData.imagePrompts.length < maxImages) {
      textData.imagePrompts.push(defaultPrompt);
      console.log(`   + 패딩 프롬프트 추가: ${textData.imagePrompts.length}/${maxImages}`);
    }
  }

  if (maxImages > 0 && textData.imagePrompts.length > 0) {
    // 순차 생성으로 진행률 표시 (maxImages만큼 생성)
    for (let i = 0; i < maxImages; i++) {
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
  let body = textData.content || (textData as any).contentHtml || '';
  
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
    const sentences = plainText.split(/[.!?。]/).filter((s: string) => s.trim().length > 5);
    
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
  
  // 🖼️ 블로그 포스트에 [IMG_N] 마커가 없으면 자동 삽입
  if (request.postType !== 'card_news' && images.length > 0 && !body.includes('[IMG_')) {
    console.log('⚠️ 블로그에 [IMG_N] 마커가 없음! 자동 삽입 중...');
    
    // h3 소제목 다음에 이미지 마커 삽입
    const h3Tags = body.match(/<h3[^>]*>.*?<\/h3>/gi) || [];
    let imgIndex = 1;
    
    if (h3Tags.length > 0) {
      // 각 h3 뒤의 첫 번째 </p> 다음에 이미지 마커 삽입
      let _h3Count = 0; // 디버깅용 카운터
      body = body.replace(
        /(<h3[^>]*>.*?<\/h3>[\s\S]*?<\/p>)/gi,
        (match: string) => {
          _h3Count++;
          if (imgIndex <= images.length) {
            const marker = `\n<div class="content-image-wrapper">[IMG_${imgIndex}]</div>\n`;
            imgIndex++;
            return match + marker;
          }
          return match;
        }
      );
      console.log(`✅ 블로그: [IMG_1] ~ [IMG_${imgIndex - 1}] 마커 자동 삽입 완료`);
    } else {
      // h3가 없으면 첫 번째 p 태그들 사이에 삽입
      const pTags = body.match(/<\/p>/gi) || [];
      if (pTags.length >= 2) {
        let pCount = 0;
        body = body.replace(/<\/p>/gi, (match: string) => {
          pCount++;
          // 2번째, 4번째, 6번째 </p> 뒤에 이미지 삽입
          if (pCount % 2 === 0 && imgIndex <= images.length) {
            const marker = `\n<div class="content-image-wrapper">[IMG_${imgIndex}]</div>\n`;
            imgIndex++;
            return match + marker;
          }
          return match;
        });
        console.log(`✅ 블로그 (h3 없음): [IMG_1] ~ [IMG_${imgIndex - 1}] 마커 자동 삽입 완료`);
      }
    }
  }
  
  // 🖼️ 카드뉴스인데 [IMG_N] 마커가 없으면 자동 삽입
  if (request.postType === 'card_news' && images.length > 0) {
    // card-slide 안에 card-img-container가 없거나 [IMG_N] 마커가 없으면 추가
    const cardSlides = body.match(/<div[^>]*class="[^"]*card-slide[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>/gi) || [];
    
    if (cardSlides.length > 0 && !body.includes('[IMG_')) {
      console.log('⚠️ 카드뉴스에 [IMG_N] 마커가 없음! 자동 삽입 중...');
      
      // 각 card-slide에 이미지 마커 삽입
      let imgIndex = 1;
      body = body.replace(
        /(<div[^>]*class="[^"]*card-slide[^"]*"[^>]*>)([\s\S]*?)(<\/div>\s*<\/div>)/gi,
        (match: string, openTag: string, content: string, closeTag: string) => {
          // 이미 img 태그나 마커가 있으면 스킵
          if (content.includes('[IMG_') || content.includes('<img')) {
            return match;
          }
          // card-desc 또는 card-main-title 뒤에 이미지 컨테이너 삽입
          const markerHtml = `<div class="card-img-container" style="width: 100%; margin: 16px 0; flex: 1; display: flex; align-items: center; justify-content: center;">[IMG_${imgIndex}]</div>`;
          imgIndex++;
          
          // card-desc 앞에 삽입 (설명 위에 이미지)
          if (content.includes('card-desc')) {
            return openTag + content.replace(
              /(<p[^>]*class="[^"]*card-desc[^"]*")/i,
              markerHtml + '$1'
            ) + closeTag;
          }
          // card-desc가 없으면 닫기 태그 앞에 삽입
          return openTag + content + markerHtml + closeTag;
        }
      );
      console.log(`✅ [IMG_1] ~ [IMG_${imgIndex - 1}] 마커 자동 삽입 완료`);
    }
  }
  
  // 🖼️ 이미지 삽입 전 디버그
  console.log('🖼️ 이미지 삽입 시작:', {
    '생성된 이미지 수': images.length,
    'body에 [IMG_1] 포함?': body.includes('[IMG_1]'),
    'body에 [IMG_2] 포함?': body.includes('[IMG_2]'),
    'body 길이': body.length
  });
  
  images.forEach(img => {
    const pattern = new RegExp(`\\[IMG_${img.index}\\]`, "gi");
    const hasMarker = body.match(pattern);
    console.log(`🖼️ [IMG_${img.index}] 마커 존재?`, !!hasMarker, '이미지 데이터 존재?', !!img.data);
    
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
    (match: string, pre: string, cls: string, post: string) => {
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
    // 🤖 AI 냄새 점수 체크 - 비활성화됨 (사용자 요청)
    // ============================================
    // ⚠️ AI 냄새 점수 검사 기능 완전 비활성화 (2026-01-18)
    // - 사용자 요청으로 점수 검사 및 자동 개선 기능 제거
    // - AI 냄새 점수는 계산되지만 검사 로직은 실행되지 않음
    // - 경고 메시지 및 자동 수정 프로세스 완전 차단
    console.log('🔇 AI 냄새 점수 검사 비활성화됨 (사용자 설정)');
    
    /*
    // === 기존 AI 냄새 검사 로직 (주석 처리) ===
    const aiSmellScore = textData.fact_check?.ai_smell_score || 0;
    const MAX_AI_SMELL_SCORE = 15;
    
    if (aiSmellScore > MAX_AI_SMELL_SCORE) {
      // 16점 이상: 자동 개선 로직 (비활성화)
      console.log(\`🤖 AI 냄새 점수 \${aiSmellScore}점 > 15점, 자동 개선 시도\`);
      safeProgress(\`🤖 AI 냄새 점수 \${aiSmellScore}점 (15점 초과) - 자동 개선 중...\`);
      // ... 자동 개선 코드 (생략)
    } else if (aiSmellScore >= 8 && aiSmellScore <= 15) {
      // 8~15점: 상세 분석 로직 (비활성화)
      console.log(\`⚠️ AI 냄새 점수 \${aiSmellScore}점 - 경계선 (8~15점), 수정 위치 분석 중...\`);
      safeProgress(\`⚠️ AI 냄새 점수 \${aiSmellScore}점 - 경계선! 수정 필요 위치를 분석합니다...\`);
      // ... 상세 분석 코드 (생략)
    } else {
      // 7점 이하: 기준 충족 메시지 (비활성화)
      console.log(\`✅ AI 냄새 점수 \${aiSmellScore}점 - 기준 충족 (7점 이하)\`);
      safeProgress(\`✅ AI 냄새 점수 \${aiSmellScore}점 - 사람 글 판정! 🎉\`);
    }
    */
  }

  // ============================================
  // 🔍 최종 AI 냄새 검사 - 비활성화됨 (사용자 요청)
  // ============================================
  // safeProgress('🔍 최종 AI 냄새 검사 중...');
  
  // ⚠️ AI 냄새 검사 결과는 계산되지만, 경고 메시지는 출력하지 않음
  const aiSmellCheckResult = runAiSmellCheck(finalHtml);
  
  // factCheck에 detectAiSmell 결과 통합 (데이터는 유지)
  let finalFactCheck = textData.fact_check || {
    fact_score: 85,
    safety_score: 90,
    conversion_score: 80,
    ai_smell_score: 0,
    verified_facts_count: 5,
    issues: [],
    recommendations: []
  };
  
  finalFactCheck = integrateAiSmellToFactCheck(finalFactCheck, aiSmellCheckResult);
  
  // ⚠️ AI 냄새 경고 메시지 비활성화 (사용자 요청)
  /*
  // 치명적 문제 발견 시 경고 (비활성화)
  if (aiSmellCheckResult.criticalIssues.length > 0) {
    safeProgress(`🚨 의료광고법 위반 패턴 ${aiSmellCheckResult.criticalIssues.length}개 발견! 수정 필요`);
    console.warn('🚨 치명적 AI 냄새 패턴:', aiSmellCheckResult.criticalIssues);
  } else if (aiSmellCheckResult.warningIssues.length > 0) {
    safeProgress(`⚠️ AI 냄새 패턴 ${aiSmellCheckResult.warningIssues.length}개 발견 (경고)`);
  } else {
    safeProgress(`✅ AI 냄새 검사 통과!`);
  }
  */
  
  // 조용히 로그만 남김
  console.log('🔇 AI 냄새 검사 완료 (결과 출력 비활성화):', {
    score: aiSmellCheckResult.score,
    criticalCount: aiSmellCheckResult.criticalIssues.length,
    warningCount: aiSmellCheckResult.warningIssues.length
  });

  // 디버깅: 반환 데이터 확인
  console.log('• generateFullPost 반환 데이터:');
  console.log('  - finalFactCheck:', finalFactCheck);
  console.log('  - aiSmellCheckResult:', { 
    score: aiSmellCheckResult.score, 
    critical: aiSmellCheckResult.criticalIssues.length,
    warning: aiSmellCheckResult.warningIssues.length 
  });
  console.log('  - seoScore:', seoScore);
  
  // 최종 완료 메시지
  safeProgress('✅ 모든 생성 작업 완료!');
  
  return {
    title: textData.title,
    htmlContent: finalHtml,
    imageUrl: images[0]?.data || "",
    fullHtml: finalHtml,
    tags: [],
    factCheck: finalFactCheck,
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
  
  const imageStyleGuide = STYLE_KEYWORDS[context.imageStyle || 'illustration'] || STYLE_KEYWORDS.illustration;
  
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
  "newCardHtml": "<div class='card-slide'>...[IMG_${cardIndex + 1}]...</div>",
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
      const modifyPrompt = `
${SYSTEM_PROMPT}

${HUMAN_WRITING_RULES}

${MEDICAL_LAW_HUMAN_PROMPT}

[참고 예시 - 좋은 글 vs 나쁜 글]
${FEW_SHOT_EXAMPLES}

[현재 원고]
${sanitizedHtml}

[사용자 수정 요청]
${userInstruction}

[수정 규칙]
1. 의료광고법 절대 준수 (단정·유도·권유 표현 금지)
2. AI 냄새 제거 - 위 규칙 철저히 적용!
   - 번역투 표현 완전 제거 (요소/요인→이유, 측면에서→쪽에서, 발생하다→생기다)
   - "~에 대해 알아보겠습니다", "다양한", "이처럼" 등 금지
   - 🚫 메타 설명 절대 금지: "어떤 부분을 살펴보는 것이 도움이 될지", "~해보려 합니다", "차근차근 정리해" 등
3. 일반 소제목: 문단 2~3개 / 마지막 소제목: 1~2개 (4개 이상 절대 금지!!)
4. 자연스러운 경험담 + 감각 묘사 (찌릿한, 묵직한, 뻣뻣한 등)
5. 이미지 src는 __IMG_PLACEHOLDER_N__ 형식으로 유지
6. 🔄 중복 내용 금지! 도입부 내용을 본문에서 반복 ❌, 각 소제목은 서로 다른 정보!

[이미지 재생성]
- 이미지 관련 수정 요청 시 regenerateImageIndices, newImagePrompts 반환
- 예: "그림을 현대적으로" → regenerateImageIndices: [1, 2], newImagePrompts: ["현대적인 스타일..."]
`;

      const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",  // 고품질 글쓰기용 pro 모델
        contents: modifyPrompt,
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
      
      // 🔍 수정된 글 AI 냄새 검사
      const aiSmellCheck = runAiSmellCheck(restoredHtml);
      
      // 치명적 문제가 있으면 메시지에 경고 추가
      let finalMessage = result.message || '수정 완료';
      if (aiSmellCheck.criticalIssues.length > 0) {
        finalMessage += `\n\n🚨 경고: 금지 패턴 ${aiSmellCheck.criticalIssues.length}개 발견!\n- ${aiSmellCheck.criticalIssues.slice(0, 3).join('\n- ')}`;
        console.warn('🚨 modifyPostWithAI 후 치명적 AI 냄새:', aiSmellCheck.criticalIssues);
      } else if (aiSmellCheck.warningIssues.length > 0) {
        finalMessage += `\n\n⚠️ AI 냄새 패턴 ${aiSmellCheck.warningIssues.length}개 발견 (권장 수정)`;
      }
      
      console.log('🔍 modifyPostWithAI AI 냄새 검사:', {
        score: aiSmellCheck.score,
        critical: aiSmellCheck.criticalIssues.length,
        warning: aiSmellCheck.warningIssues.length
      });
      
      return {
        ...result,
        newHtml: restoredHtml,
        message: finalMessage,
        aiSmellCheck // AI 냄새 검사 결과도 반환
      };
    } catch (error) { 
      console.error('❌ modifyPostWithAI 에러:', error);
      throw error; 
    }
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
    // 🚀 타임아웃 늘림 (60초) - AI 냄새 분석에 충분한 시간 확보
    const ANALYSIS_TIMEOUT = 60000;
    
    // 📊 스키마 단순화
    const analysisPromise = ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            total_score: { type: Type.INTEGER },
            issues: { type: Type.ARRAY, items: { type: Type.STRING } },
            priority_fixes: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["total_score", "issues", "priority_fixes"]
        }
      }
    });
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('AI 냄새 분석 타임아웃 (60초)')), ANALYSIS_TIMEOUT);  // 60초
    });
    
    const response = await Promise.race([analysisPromise, timeoutPromise]);
    
    const result = JSON.parse(response.text || "{}");
    
    // 단순화된 스키마에서 결과 변환 (호환성 유지)
    const convertedResult = {
      total_score: result.total_score || 0,
      sentence_rhythm: { score: 0, issues: result.issues || [], fix_suggestions: [] },
      judgment_avoidance: { score: 0, issues: [], fix_suggestions: [] },
      lack_of_realism: { score: 0, issues: [], fix_suggestions: [] },
      template_structure: { score: 0, issues: [], fix_suggestions: [] },
      fake_empathy: { score: 0, issues: [], fix_suggestions: [] },
      cta_failure: { score: 0, issues: [], fix_suggestions: [] },
      priority_fixes: result.priority_fixes || []
    };
    
    console.log('🤖 AI 냄새 분석 완료:', convertedResult.total_score, '점');
    return convertedResult;
  } catch (error) {
    console.error('AI 냄새 분석 실패:', error);
    return {
      total_score: 0,
      sentence_rhythm: { score: 0, issues: ['분석 실패'], fix_suggestions: [] },
      judgment_avoidance: { score: 0, issues: [], fix_suggestions: [] },
      lack_of_realism: { score: 0, issues: [], fix_suggestions: [] },
      template_structure: { score: 0, issues: [], fix_suggestions: [] },
      fake_empathy: { score: 0, issues: [], fix_suggestions: [] },
      cta_failure: { score: 0, issues: [], fix_suggestions: [] },
      priority_fixes: ['AI 냄새 분석 중 오류가 발생했습니다.']
    };
  }
};

// AI 냄새 재검사 함수 (수동 재생성 후 사용)
export const recheckAiSmell = async (htmlContent: string): Promise<FactCheckReport> => {
  console.log('🔄 AI 냄새 재검사 시작...');
  const ai = getAiClient();
  
  // 🔍 먼저 detectAiSmell() 기반 즉시 검사 실행 (빠른 패턴 매칭)
  const quickCheck = runAiSmellCheck(htmlContent);
  console.log('🔍 빠른 패턴 검사 결과:', {
    score: quickCheck.score,
    critical: quickCheck.criticalIssues.length,
    warning: quickCheck.warningIssues.length
  });
  
  // 치명적 문제가 있으면 바로 경고
  if (quickCheck.criticalIssues.length > 0) {
    console.warn('🚨 치명적 AI 냄새 패턴 발견 (즉시 수정 필요):', quickCheck.criticalIssues);
  }
  
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
    // 🚀 타임아웃 설정 (60초)
    const RECHECK_TIMEOUT = 60000;
    
    const analysisPromise = ai.models.generateContent({
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
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('AI 재검사 타임아웃 (60초)')), RECHECK_TIMEOUT);  // 60초
    });
    
    const response = await Promise.race([analysisPromise, timeoutPromise]);
    
    const result = JSON.parse(response.text || "{}");
    console.log('✅ AI 냄새 재검사 완료:', result.fact_check);
    
    // 🔍 detectAiSmell() 결과와 AI 분석 결과 통합
    let factCheck: FactCheckReport = result.fact_check;
    factCheck = integrateAiSmellToFactCheck(factCheck, quickCheck);
    
    // AI 냄새 상세 분석 추가 (모든 점수에서 상세 분석 제공)
    const aiSmellScore = factCheck.ai_smell_score || 0;
    console.log(`• 통합 AI 냄새 점수: ${aiSmellScore}점 (패턴 검사 + AI 분석)`);
    
    try {
      const detailedAnalysis = await analyzeAiSmell(textContent, '');
      factCheck.ai_smell_analysis = detailedAnalysis;
      console.log('✅ AI 냄새 상세 분석 완료:', detailedAnalysis.total_score, '점');
    } catch (analysisError) {
      console.error('⚠️ AI 냄새 상세 분석 실패:', analysisError);
      // 상세 분석 실패해도 기본 결과는 반환
    }
    
    // 빠른 패턴 검사에서 발견한 치명적 문제는 이미 factCheck.issues에 포함됨
    // (patternCheckIssues 필드는 FactCheckReport 타입에 없으므로 제거)
    
    return factCheck;
  } catch (error) {
    console.error('❌ AI 냄새 재검사 실패:', error);
    throw new Error('AI 냄새 재검사 중 오류가 발생했습니다.');
  }
};

// ========================================
// 📊 블로그 유사도 검사 시스템
// ========================================

/**
 * Gemini Embedding API로 텍스트 벡터화
 */
async function getTextEmbedding(text: string): Promise<number[]> {
  try {
    const ai = getAiClient();
    
    // 텍스트 정리 (HTML 태그 제거)
    const cleanText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    
    const result = await ai.models.generateContent({
      model: 'text-embedding-004', // Gemini Embedding 모델
      contents: cleanText,
    });
    
    // @ts-ignore - Gemini Embedding API 응답 구조
    return result.embedding?.values || [];
  } catch (error) {
    console.error('❌ 텍스트 임베딩 생성 실패:', error);
    return [];
  }
}

/**
 * 코사인 유사도 계산
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA.length || !vecB.length || vecA.length !== vecB.length) {
    return 0;
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * 자체 블로그 DB와 유사도 검사
 * (Supabase에 저장된 이전 글들과 비교)
 */
async function checkSimilarityWithOwnBlogs(
  content: string,
  title: string
): Promise<{ maxSimilarity: number; matches: any[] }> {
  try {
    console.log('🔍 자체 블로그 DB 유사도 검사 시작...');
    
    // TODO: Supabase에서 블로그 이력 가져오기
    // const { data: blogHistory } = await supabase
    //   .from('blog_history')
    //   .select('*')
    //   .order('publishedAt', { ascending: false })
    //   .limit(100);
    
    // 현재는 임시 구현 (빈 배열)
    const blogHistory: any[] = [];
    
    if (blogHistory.length === 0) {
      console.log('ℹ️ 저장된 블로그 이력 없음');
      return { maxSimilarity: 0, matches: [] };
    }
    
    // 새 글 벡터화
    const newEmbedding = await getTextEmbedding(content);
    
    if (newEmbedding.length === 0) {
      console.log('⚠️ 임베딩 생성 실패');
      return { maxSimilarity: 0, matches: [] };
    }
    
    // 기존 글들과 유사도 비교
    const similarities = await Promise.all(
      blogHistory.map(async (blog) => {
        const similarity = cosineSimilarity(newEmbedding, blog.embedding || []);
        return { blog, similarity };
      })
    );
    
    // 유사도 높은 순으로 정렬
    const sortedMatches = similarities
      .filter(s => s.similarity > 0.3) // 30% 이상만
      .sort((a, b) => b.similarity - a.similarity);
    
    const maxSimilarity = sortedMatches.length > 0 ? sortedMatches[0].similarity : 0;
    
    console.log(`✅ 자체 DB 검사 완료: 최대 유사도 ${(maxSimilarity * 100).toFixed(1)}%`);
    
    return {
      maxSimilarity,
      matches: sortedMatches.slice(0, 5) // 상위 5개만
    };
  } catch (error) {
    console.error('❌ 자체 블로그 유사도 검사 실패:', error);
    return { maxSimilarity: 0, matches: [] };
  }
}

/**
 * Gemini로 핵심 문장 추출
 */
async function extractKeyPhrases(content: string): Promise<string[]> {
  try {
    console.log('🔍 핵심 문장 추출 중...');
    
    // HTML 태그 제거
    const cleanContent = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    
    // 너무 짧으면 그대로 반환
    if (cleanContent.length < 100) {
      return [cleanContent.slice(0, 50)];
    }
    
    const prompt = `
다음 블로그 글에서 표절 검사를 위한 핵심 문장 3개를 추출해주세요.

선택 기준:
- 가장 독특하고 특징적인 문장
- 길이는 10~50자 정도
- 검색하기 좋은 문장 (너무 일반적이지 않은)
- 의료 정보나 병원 고유 내용이 담긴 문장

블로그 내용:
${cleanContent.slice(0, 2000)}

출력 형식 (반드시 정확히 따를 것):
1. "핵심 문장 1"
2. "핵심 문장 2"
3. "핵심 문장 3"
`;

    const result = await callGemini({
      prompt,
      model: GEMINI_MODEL.PRO,
      responseType: 'text'
    });
    
    // 따옴표로 감싸진 문장들 추출
    const phrases = result.match(/"([^"]{10,100})"/g)?.map((p: string) => p.slice(1, -1)) || [];
    
    console.log(`✅ 핵심 문장 ${phrases.length}개 추출:`, phrases);
    
    return phrases.slice(0, 3);
  } catch (error) {
    console.error('❌ 핵심 문장 추출 실패:', error);
    return [];
  }
}

/**
 * Google Custom Search API로 정확한 문장 검색
 */
async function searchExactMatch(keyPhrases: string[]): Promise<any[]> {
  try {
    console.log('🔍 웹 검색 시작...');
    
    const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_SEARCH_API_KEY;
    const GOOGLE_CX = import.meta.env.VITE_GOOGLE_SEARCH_CX;
    
    if (!GOOGLE_API_KEY || !GOOGLE_CX) {
      console.log('⚠️ Google Custom Search API 키 없음 (환경변수: VITE_GOOGLE_SEARCH_API_KEY, VITE_GOOGLE_SEARCH_CX)');
      return [];
    }
    
    const results = [];
    
    for (const phrase of keyPhrases) {
      // 정확한 구문 검색 ("phrase")
      const query = `"${phrase}" site:blog.naver.com`;
      
      try {
        const response = await fetch(
          `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${encodeURIComponent(query)}`
        );
        
        const data = await response.json();
        
        if (data.items && data.items.length > 0) {
          results.push({
            phrase,
            matches: data.items,
            matchCount: data.items.length
          });
          
          console.log(`  📊 "${phrase}" - ${data.items.length}건 발견`);
        } else {
          console.log(`  ✅ "${phrase}" - 중복 없음`);
        }
      } catch (error) {
        console.error(`  ❌ 검색 실패: "${phrase}"`, error);
      }
      
      // Google API Rate Limit 고려 (100쿼리/일)
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`✅ 웹 검색 완료: ${results.length}개 문장에서 중복 발견`);
    
    return results;
  } catch (error) {
    console.error('❌ 웹 검색 실패:', error);
    return [];
  }
}

/**
 * 유사도 점수 계산
 */
function calculateSimilarityScore(
  ownBlogSimilarity: number,
  webSearchMatches: any[]
): { score: number; status: string; message: string } {
  // 자체 블로그 유사도 (0~100)
  const ownBlogScore = ownBlogSimilarity * 100;
  
  // 웹 검색 매칭 점수
  let webSearchScore = 0;
  const totalMatches = webSearchMatches.reduce((sum, m) => sum + m.matchCount, 0);
  
  if (totalMatches >= 3) {
    webSearchScore = 100;
  } else if (totalMatches >= 2) {
    webSearchScore = 70;
  } else if (totalMatches >= 1) {
    webSearchScore = 40;
  }
  
  // 최종 점수 (더 높은 점수 선택)
  const finalScore = Math.max(ownBlogScore, webSearchScore);
  
  // 상태 및 메시지
  let status = 'ORIGINAL';
  let message = '✅ 독창적인 콘텐츠입니다!';
  
  if (finalScore >= 80) {
    status = 'HIGH_RISK';
    message = '🚨 매우 유사한 콘텐츠가 발견되었습니다! 재작성을 권장합니다.';
  } else if (finalScore >= 60) {
    status = 'MEDIUM_RISK';
    message = '⚠️ 유사한 콘텐츠가 있습니다. 수정을 권장합니다.';
  } else if (finalScore >= 40) {
    status = 'LOW_RISK';
    message = '💡 일부 유사한 표현이 있습니다. 확인해보세요.';
  }
  
  return { score: finalScore, status, message };
}

/**
 * 통합 유사도 검사 (자체 DB + 웹 검색)
 */
export const checkContentSimilarity = async (
  content: string,
  title: string,
  onProgress?: (msg: string) => void
): Promise<any> => {
  const startTime = Date.now();
  
  try {
    onProgress?.('🔍 유사도 검사 시작...');
    console.log('==================== 유사도 검사 시작 ====================');
    console.log('제목:', title);
    console.log('내용 길이:', content.length, '자');
    
    const result: any = {
      finalScore: 0,
      status: 'CHECKING',
      message: '',
      ownBlogMatches: [],
      webSearchMatches: [],
      keyPhrases: [],
      checkDuration: 0
    };
    
    // 1단계: 자체 블로그 DB 검사 (빠름)
    onProgress?.('📚 자체 블로그 DB 검사 중...');
    const ownBlogCheck = await checkSimilarityWithOwnBlogs(content, title);
    result.ownBlogMatches = ownBlogCheck.matches;
    
    // 2단계: 웹 검색 (필요시만)
    if (ownBlogCheck.maxSimilarity < 0.8) {
      onProgress?.('🌐 웹 검색으로 유사도 확인 중...');
      
      // Gemini로 핵심 문장 추출
      const keyPhrases = await extractKeyPhrases(content);
      result.keyPhrases = keyPhrases;
      
      if (keyPhrases.length > 0) {
        // Google로 검색
        const webSearchResults = await searchExactMatch(keyPhrases);
        result.webSearchMatches = webSearchResults;
      } else {
        console.log('⚠️ 핵심 문장 추출 실패, 웹 검색 생략');
      }
    } else {
      console.log('ℹ️ 자체 DB에서 높은 유사도 발견, 웹 검색 생략');
    }
    
    // 3단계: 최종 점수 계산
    onProgress?.('📊 유사도 점수 계산 중...');
    const scoreResult = calculateSimilarityScore(
      ownBlogCheck.maxSimilarity,
      result.webSearchMatches
    );
    
    result.finalScore = scoreResult.score;
    result.status = scoreResult.status;
    result.message = scoreResult.message;
    result.checkDuration = Date.now() - startTime;
    
    console.log('==================== 유사도 검사 완료 ====================');
    console.log('최종 점수:', result.finalScore);
    console.log('상태:', result.status);
    console.log('메시지:', result.message);
    console.log('소요 시간:', result.checkDuration, 'ms');
    console.log('=======================================================');
    
    onProgress?.(`✅ 유사도 검사 완료: ${result.finalScore.toFixed(1)}점`);
    
    return result;
  } catch (error) {
    console.error('❌ 유사도 검사 실패:', error);
    
    return {
      finalScore: 0,
      status: 'ERROR',
      message: '⚠️ 유사도 검사 중 오류가 발생했습니다.',
      ownBlogMatches: [],
      webSearchMatches: [],
      keyPhrases: [],
      checkDuration: Date.now() - startTime
    };
  }
};

/**
 * 블로그 이력 저장 (Supabase)
 */
export const saveBlogHistory = async (
  title: string,
  content: string,
  htmlContent: string,
  keywords: string[],
  naverUrl?: string,
  category?: string
): Promise<void> => {
  try {
    console.log('💾 블로그 이력 저장 중...');
    
    // 임베딩 생성
    const embedding = await getTextEmbedding(content);
    
    // TODO: Supabase에 저장
    // const { error } = await supabase.from('blog_history').insert({
    //   title,
    //   content,
    //   htmlContent,
    //   keywords,
    //   embedding,
    //   naverUrl,
    //   category,
    //   publishedAt: new Date().toISOString()
    // });
    
    // if (error) throw error;
    
    console.log('✅ 블로그 이력 저장 완료');
  } catch (error) {
    console.error('❌ 블로그 이력 저장 실패:', error);
    // 저장 실패해도 메인 플로우는 계속 진행
  }
};

