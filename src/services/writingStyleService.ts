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
특히 글의 시선 방향과 독자와의 관계 설정 방식에 주목합니다.

[분석 항목]
1. tone: 전체적인 어조 (예: "친근하고 따뜻한", "전문적이면서 편안한", "관찰자적", "대화하듯")
2. sentenceEndings: 자주 사용하는 문장 끝 패턴 (예: ["~요", "~죠?", "~거든요", "~더라고요", "~합니다"])
3. vocabulary: 특징적인 단어나 표현 5-10개 (예: ["사실", "근데", "진짜", "그렇죠?", "~인 편이에요"])
4. structure: 글 구조 특징
   - TYPE A (에세이형): "관찰 → 해석 → 정리" 흐름, 여백 있음, 열린 마무리
   - TYPE B (정보 전달형): "핵심 → 근거 → 적용" 흐름, 명확한 정보 전달
5. emotionLevel: 감정 표현 정도 ("low"=절제된, "medium"=적당한, "high"=풍부한)
   - 감정이 정보 전달의 도구로만 사용되는지, 자연스러운 공감인지 구분
6. formalityLevel: 격식 수준 ("casual"=편한, "neutral"=중립, "formal"=격식)
7. styleType: 글 유형 ("essay"=에세이형/관찰→해석→정리, "informative"=정보전달형/전문칼럼)
8. readerRelation: 독자와의 관계 ("companion"=함께 생각하는 동료, "guide"=안내자, "expert"=전문가)

[출력 형식]
JSON으로 답변해주세요:
{
  "tone": "어조 설명",
  "sentenceEndings": ["끝말 1", "끝말 2", ...],
  "vocabulary": ["단어1", "단어2", ...],
  "structure": "구조 설명 (TYPE A/B 중 어느 쪽에 가까운지 명시)",
  "emotionLevel": "low/medium/high",
  "formalityLevel": "casual/neutral/formal",
  "styleType": "essay/informative",
  "readerRelation": "companion/guide/expert",
  "description": "이 말투를 한 줄로 설명 (시선 방향과 독자 관계 포함)",
  "stylePrompt": "AI가 이 말투로 글을 쓸 때 사용할 프롬프트 (50-100자, 핵심 특징 + AI 냄새 제거 포인트)"
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
 * ⚠️ 의료광고법 준수 + AI 냄새 제거 원칙 적용
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
- 감정 표현: ${analyzedStyle.emotionLevel === 'high' ? '풍부하게' : analyzedStyle.emotionLevel === 'medium' ? '적당히' : '절제하여'} (정보 전달의 보조 수단으로만)
- 격식: ${analyzedStyle.formalityLevel === 'formal' ? '격식체' : analyzedStyle.formalityLevel === 'casual' ? '편한 말투' : '중립적'}

████████████████████████████████████████████████████████████████████████████████
[🎯 AI 냄새 제거 + 의료법 준수 - 최우선 적용]
████████████████████████████████████████████████████████████████████████████████

**⛔ 피해야 할 AI 패턴:**
- "~가 핵심입니다" / "기억하세요" / "중요한 것은" → 삭제
- "~수 있습니다" 2회 연속 → 1회는 "~경우도 있습니다", "~분들도 많습니다"로 변환
- 문단마다 기능이 너무 명확한 구조 → 관찰→해석→정리 흐름으로
- 모든 가능성 나열 → 대표적인 것만 언급, 여백 남기기

**⛔ 의료광고법 금지 표현:**
- '방문하세요', '예약하세요', '상담하세요' → "고려해 보실 수 있습니다"
- '완치', '최고', '보장', '확실' → 과대광고 금지
- 구체적 숫자/시간 (출처 없이) → 범주형 표현으로 대체

**✅ 사람다운 글쓰기 원칙:**
- 첫 문장: 정의/설명이 아닌 상황 묘사나 질문으로 시작
- 감정 표현: 정보 전달의 도구로만 사용, 과도한 감정 표현 자제
- 결론: 너무 깔끔하게 정리하지 않음, 독자가 끼워 넣을 여백 남기기
- 태도: "같이 생각해보자" (설득이 아닌 동행)

📌 핵심: 말투(어조)는 유지 + 구조(관찰→해석→정리) + 의료법 준수 + AI 패턴 제거
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
