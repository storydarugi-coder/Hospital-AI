import { GoogleGenAI, Type } from "@google/genai";
import { LearnedWritingStyle } from "../types";

const getAiClient = () => {
  const apiKey = localStorage.getItem('GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error("API Key가 설정되지 않았습니다.");
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * 이미지에서 텍스트 추출 (OCR)
 */
export const extractTextFromImage = async (base64Image: string): Promise<string> => {
  const ai = getAiClient();
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: base64Image.includes('png') ? 'image/png' : 'image/jpeg',
                data: base64Image.split(',')[1]
              }
            },
            {
              text: `이 이미지에서 모든 텍스트를 추출해주세요.

[요구사항]
1. 이미지에 보이는 모든 한국어/영어 텍스트를 그대로 추출
2. 줄바꿈과 단락 구분 유지
3. 블로그 글, 카드뉴스, 게시물 등의 텍스트 추출
4. 메뉴, 버튼, UI 요소 텍스트는 제외하고 본문 내용만 추출
5. 텍스트만 출력하세요. 설명이나 부가 내용 없이!

추출된 텍스트:`
            }
          ]
        }
      ],
      config: {
        responseMimeType: "text/plain"
      }
    });
    
    return response.text?.trim() || '';
  } catch (error) {
    console.error('OCR 실패:', error);
    throw new Error('이미지에서 텍스트를 추출할 수 없습니다.');
  }
};

/**
 * 문서에서 텍스트 추출 (Word, PDF, TXT)
 */
export const extractTextFromDocument = async (file: File): Promise<string> => {
  const fileName = file.name.toLowerCase();
  
  // TXT 파일
  if (fileName.endsWith('.txt')) {
    return await file.text();
  }
  
  // PDF/Word 파일은 Gemini로 처리
  const ai = getAiClient();
  
  try {
    // 파일을 base64로 변환
    const arrayBuffer = await file.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );
    
    const mimeType = fileName.endsWith('.pdf') 
      ? 'application/pdf' 
      : fileName.endsWith('.docx') 
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'application/msword';
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64
              }
            },
            {
              text: `이 문서에서 모든 텍스트를 추출해주세요.

[요구사항]
1. 문서에 있는 모든 한국어/영어 텍스트를 그대로 추출
2. 줄바꿈과 단락 구분 유지
3. 헤더, 푸터, 페이지 번호 등은 제외
4. 본문 내용만 추출
5. 텍스트만 출력하세요. 설명이나 부가 내용 없이!

추출된 텍스트:`
            }
          ]
        }
      ],
      config: {
        responseMimeType: "text/plain"
      }
    });
    
    return response.text?.trim() || '';
  } catch (error) {
    console.error('문서 텍스트 추출 실패:', error);
    throw new Error('문서에서 텍스트를 추출할 수 없습니다.');
  }
};

/**
 * 텍스트에서 말투/어조 분석
 */
export const analyzeWritingStyle = async (
  sampleText: string, 
  styleName: string
): Promise<LearnedWritingStyle> => {
  const ai = getAiClient();
  
  const prompt = `당신은 블로그 글의 말투와 어조를 분석하는 전문가입니다.

[분석할 텍스트]
${sampleText.substring(0, 3000)}

[미션]
위 텍스트의 말투, 어조, 문체 특징을 상세히 분석해주세요.

[분석 항목]
1. tone: 전체적인 어조 (예: "친근하고 따뜻한", "전문적이고 신뢰감 있는", "유머러스한", "감성적인")
2. sentenceEndings: 자주 사용하는 문장 끝 패턴 (예: ["~요", "~죠?", "~거든요", "ㅎㅎ", "~합니다"])
3. vocabulary: 특징적인 단어나 표현 5-10개 (예: ["사실", "근데", "진짜", "그렇죠?"])
4. structure: 글 구조 특징 (예: "질문으로 시작해서 답변 형식", "개인 경험 → 정보 제공 패턴")
5. emotionLevel: 감정 표현 정도 ("low"=절제된, "medium"=적당한, "high"=풍부한)
6. formalityLevel: 격식 수준 ("casual"=편한, "neutral"=중립, "formal"=격식)

[출력 형식]
JSON으로 답변해주세요:
{
  "tone": "어조 설명",
  "sentenceEndings": ["끝말 1", "끝말 2", ...],
  "vocabulary": ["단어1", "단어2", ...],
  "structure": "구조 설명",
  "emotionLevel": "low/medium/high",
  "formalityLevel": "casual/neutral/formal",
  "description": "이 말투를 한 줄로 설명 (예: 친근한 언니가 조언해주는 듯한 따뜻한 말투)",
  "stylePrompt": "AI가 이 말투로 글을 쓸 때 사용할 프롬프트 (50-100자, 핵심 특징만)"
}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tone: { type: Type.STRING },
            sentenceEndings: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING } 
            },
            vocabulary: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING } 
            },
            structure: { type: Type.STRING },
            emotionLevel: { 
              type: Type.STRING,
              enum: ["low", "medium", "high"]
            },
            formalityLevel: { 
              type: Type.STRING,
              enum: ["casual", "neutral", "formal"]
            },
            description: { type: Type.STRING },
            stylePrompt: { type: Type.STRING }
          },
          required: ["tone", "sentenceEndings", "vocabulary", "structure", "emotionLevel", "formalityLevel", "description", "stylePrompt"]
        }
      }
    });
    
    const result = JSON.parse(response.text || "{}");
    
    // LearnedWritingStyle 객체 생성
    const learnedStyle: LearnedWritingStyle = {
      id: `style_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: styleName,
      description: result.description,
      sampleText: sampleText.substring(0, 500), // 원본 샘플 일부 저장
      analyzedStyle: {
        tone: result.tone,
        sentenceEndings: result.sentenceEndings,
        vocabulary: result.vocabulary,
        structure: result.structure,
        emotionLevel: result.emotionLevel,
        formalityLevel: result.formalityLevel
      },
      stylePrompt: result.stylePrompt,
      createdAt: new Date().toISOString()
    };
    
    return learnedStyle;
  } catch (error) {
    console.error('말투 분석 실패:', error);
    throw new Error('말투 분석에 실패했습니다. 다시 시도해주세요.');
  }
};

// 의료광고법 금지 표현 필터링
const MEDICAL_AD_PROHIBITED_WORDS = [
  // 직접 권유
  '방문하세요', '내원하세요', '예약하세요', '문의하세요', '상담하세요',
  '오세요', '연락주세요', '전화주세요', '문의해주세요',
  // 과대광고
  '완치', '최고', '유일', '특효', '1등', '최고급', '최대', '최상',
  '획기적', '혁신적', '기적', '100%', '확실', '보장', '반드시',
  // 치료 효과 암시
  '완벽한 치료', '빠른 회복', '확실한 효과', '증명된',
  // 비교광고
  '업계 최초', '업계 유일', '타 병원보다', '다른 곳보다',
  // 공포 조장
  '늦으면 손 쓸 수 없', '큰일납니다', '위험합니다', '죽을 수',
];

// 금지 표현 필터링 함수
const filterProhibitedExpressions = (words: string[]): string[] => {
  return words.filter(word => 
    !MEDICAL_AD_PROHIBITED_WORDS.some(prohibited => 
      word.toLowerCase().includes(prohibited.toLowerCase())
    )
  );
};

/**
 * 학습된 스타일을 프롬프트로 변환
 * ⚠️ 의료광고법 준수를 위해 금지 표현 필터링 적용
 */
export const getStylePromptForGeneration = (style: LearnedWritingStyle): string => {
  const { analyzedStyle } = style;
  
  // 학습된 표현 중 의료광고법 위반 가능성 있는 것 필터링
  const safeVocabulary = filterProhibitedExpressions(analyzedStyle.vocabulary);
  const safeSentenceEndings = filterProhibitedExpressions(analyzedStyle.sentenceEndings);
  
  return `[학습된 말투 스타일: ${style.name}]
- 어조: ${analyzedStyle.tone}
- 문장 끝 패턴: ${safeSentenceEndings.join(', ')}
- 자주 사용하는 표현: ${safeVocabulary.join(', ')}
- 글 구조: ${analyzedStyle.structure}
- 감정 표현: ${analyzedStyle.emotionLevel === 'high' ? '풍부하게' : analyzedStyle.emotionLevel === 'medium' ? '적당히' : '절제하여'}
- 격식: ${analyzedStyle.formalityLevel === 'formal' ? '격식체' : analyzedStyle.formalityLevel === 'casual' ? '편한 말투' : '중립적'}

⚠️ 위 말투 특징을 적용하되, 아래 의료광고법 필수 준수사항을 최우선으로 지켜주세요!

████████████████████████████████████████████████████████████████████████████████
🚨🚨🚨 [의료광고법 최우선 - 말투보다 법률 준수가 먼저!] 🚨🚨🚨
████████████████████████████████████████████████████████████████████████████████

**⛔ 학습된 말투에서 아래 표현이 있더라도 절대 사용 금지:**
- '방문하세요', '오세요', '예약하세요', '상담하세요' → 직접 권유 금지!
- '완치', '최고', '유일', '보장', '확실' → 과대광고 금지!
- '~해야 합니다', '반드시 ~' → 단정적 표현 금지!
- 구체적 숫자/시간 (출처 없이) → '충분히', '상당 시간' 등으로 대체!

**✅ 말투는 적용하되 표현은 안전하게 변환:**
- "병원에 오세요" → "전문의 상담을 고려해 보실 수 있습니다"
- "확실히 나아요" → "도움이 될 수 있습니다"
- "반드시 해야 해요" → "하는 것이 좋을 수 있어요"

📌 핵심: 말투(어조, 친근함)는 유지 + 표현(단어, 문장)은 의료법 안전하게!
`;
};

/**
 * 저장된 스타일 불러오기
 */
export const getSavedStyles = (): LearnedWritingStyle[] => {
  try {
    const saved = localStorage.getItem('hospital_learned_writing_styles');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

/**
 * ID로 스타일 찾기
 */
export const getStyleById = (id: string): LearnedWritingStyle | null => {
  const styles = getSavedStyles();
  return styles.find(s => s.id === id) || null;
};
