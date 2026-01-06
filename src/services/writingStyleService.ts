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

/**
 * 학습된 스타일을 프롬프트로 변환
 */
export const getStylePromptForGeneration = (style: LearnedWritingStyle): string => {
  const { analyzedStyle } = style;
  
  return `[학습된 말투 스타일: ${style.name}]
- 어조: ${analyzedStyle.tone}
- 문장 끝 패턴: ${analyzedStyle.sentenceEndings.join(', ')}
- 자주 사용하는 표현: ${analyzedStyle.vocabulary.join(', ')}
- 글 구조: ${analyzedStyle.structure}
- 감정 표현: ${analyzedStyle.emotionLevel === 'high' ? '풍부하게' : analyzedStyle.emotionLevel === 'medium' ? '적당히' : '절제하여'}
- 격식: ${analyzedStyle.formalityLevel === 'formal' ? '격식체' : analyzedStyle.formalityLevel === 'casual' ? '편한 말투' : '중립적'}

⚠️ 위 말투 특징을 반드시 적용하여 글을 작성하세요!
특히 문장 끝 패턴(${analyzedStyle.sentenceEndings.slice(0, 3).join(', ')})을 자연스럽게 사용하세요.

[참고 샘플]
${style.sampleText.substring(0, 300)}...
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
