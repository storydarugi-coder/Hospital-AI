import { GoogleGenAI, Type } from "@google/genai";
import { GenerationRequest, GeneratedContent, TrendingItem, FactCheckReport, SeoTitleItem, ImageStyle } from "../types";

const getAiClient = () => {
  const apiKey = localStorage.getItem('GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error("API Key가 설정되지 않았습니다. 우측 상단 설정(⚙️) 버튼을 눌러 API Key를 입력해주세요.");
  }
  return new GoogleGenAI({ apiKey });
};

const MEDICAL_SAFETY_SYSTEM_PROMPT = `
당신은 대한민국 의료광고법을 완벽히 숙지한 '네이버 공식 병원 블로그' 전문 에디터입니다.

[필수 준수 사항 - 의료광고법]
1. 네이버 '스마트에디터 ONE' 스타일에 맞춰 작성.

2. **절대 금지 표현:**
   - '완치', '최고', '유일', '특효', '1등', '최고급', '최대', '최상'
   - '방문하세요', '내원하세요', '예약하세요', '문의하세요', '상담하세요'
   - '확실한 효과', '반드시', '보장', '증명된'
   
3. **안전한 표현으로 대체:**
   - '도움이 될 수 있습니다' / '개선 가능성이 있습니다'
   - '경과에 따라 다를 수 있습니다' / '개인차가 있습니다'
   - '검진을 고려해 보시는 것도 좋습니다' / '전문의와 상담이 필요할 수 있습니다'
   
4. **결론/마무리 부분 안전 패턴:**
   ❌ 금지: "저희 병원으로 방문해 주세요", "지금 바로 예약하세요"
   ✅ 안전: "증상이 지속될 경우 전문의와의 상담을 고려해 보시기 바랍니다"
   ✅ 안전: "건강 관리에 도움이 필요하신 분들은 가까운 의료기관을 찾아보시는 것도 하나의 방법입니다"
   
5. 모든 문장은 친절하면서도 전문적인 '해요체' 또는 '합니다체'로 일관성 있게 작성.

6. **병원 이름/연락처 절대 포함 금지**
   - 병원명, 전화번호, 주소 등 직접적인 광고성 정보는 작성하지 말 것
   - "저희 병원" 대신 "의료기관", "병원" 등 일반 명사 사용
`;

export const recommendImagePrompt = async (blogContent: string, currentImageAlt: string): Promise<string> => {
  const ai = getAiClient();
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `다음은 병원 블로그 글 내용입니다:

${blogContent.substring(0, 3000)}

현재 이미지 설명: "${currentImageAlt}"

이 글의 맥락과 주제에 맞는 더 나은 이미지 프롬프트를 영어로 추천해주세요.
프롬프트는 구체적이고 상세해야 하며, 의료/병원 맥락에 적합해야 합니다.

요구사항:
1. 글의 핵심 주제와 연관성 높은 장면
2. 한국 병원 환경에 적합
3. 전문적이고 신뢰감 있는 분위기
4. 구체적인 요소 (인물, 배경, 분위기 등) 포함
5. 텍스트나 로고는 절대 포함하지 말 것

프롬프트만 영어로 답변하세요 (설명 없이):`,
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

export const generateSingleImage = async (promptText: string, style: ImageStyle = 'photo', aspectRatio: string = "16:9"): Promise<string> => {
    const ai = getAiClient();
    
    let stylePrompt = "";
    if (style === 'photo') {
        stylePrompt = "Hyper-realistic, 8k resolution, professional DSLR photography, soft hospital lighting, trustworthy medical atmosphere, shallow depth of field.";
    } else {
        stylePrompt = "High-quality 3D medical illustration, clean infographic style, bright blue and white color palette, friendly and modern, isometric view, soft clay render style.";
    }

    const finalPrompt = `${stylePrompt} Subject: ${promptText}. No text, no scary elements, professional Korean medical context. Aspect ratio ${aspectRatio}.`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-pro-image-preview",
        contents: { parts: [{ text: finalPrompt }] },
        config: { imageConfig: { aspectRatio: aspectRatio, imageSize: "1K" } }
      });
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
      return "";
    } catch (error) { 
      console.error('이미지 생성 실패:', error);
      return ""; 
    }
};

export const getTrendingTopics = async (category: string): Promise<TrendingItem[]> => {
  const ai = getAiClient();
  const today = new Date().toISOString().split('T')[0];
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `오늘 날짜: ${today}. 대한민국 '${category}' 분야와 관련하여 현재 주요 언론사 뉴스나 기사에서 보도되는 최신 건강/의료 이슈 5가지를 분석해줘.
    
    [점수 산정 및 정렬 기준]
    1. 각 이슈에 대해 'SEO 적합도 점수'(0~100)를 산정할 것.
       - 점수 기준: (뉴스 보도량 + 대중적 관심도)가 높을수록, (기존 블로그 문서 수/경쟁도)가 낮을수록 높은 점수.
    2. 반드시 점수가 높은 순서대로(내림차순) 정렬하여 배열로 반환할 것.

    [제약조건]
    1. '블로그 포스팅이 활발함' 같은 메타적인 설명은 제외하고, 실제 '질병명', '증상', '건강 뉴스' 내용만 추출.
    2. seasonal_factor에는 점수를 매긴 구체적인 근거를 짧게 요약.`,
    config: {
      tools: [{ googleSearch: {} }],
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
      }
    }
  });
  return JSON.parse(response.text || "[]");
};

export const recommendSeoTitles = async (topic: string, keywords: string): Promise<SeoTitleItem[]> => {
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `주제: ${topic}, 키워드: ${keywords}. 네이버 스마트블록 상위 노출을 위한 클릭률(CTR) 높은 제목 4개를 생성해줘.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            score: { type: Type.NUMBER },
            type: { type: Type.STRING, enum: ['신뢰', '안전', '정보', '공감'] }
          },
          required: ["title", "score", "type"]
        }
      }
    }
  });
  return JSON.parse(response.text || "[]");
};

export const generateBlogPostText = async (request: GenerationRequest): Promise<{ 
    title: string; 
    content: string; 
    imagePrompts: string[];
    fact_check: FactCheckReport;
}> => {
  const ai = getAiClient();
  const isCardNews = request.postType === 'card_news';
  const targetLength = request.textLength || 2000;
  const targetSlides = request.slideCount || 6;
  
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

  const blogPrompt = `
    ${MEDICAL_SAFETY_SYSTEM_PROMPT}
    ${benchmarkingInstruction}
    진료과: ${request.category}, 페르소나: ${request.persona}, 주제: ${request.topic}
    목표 글자 수: 공백 포함 약 ${targetLength}자 (너무 짧지 않게 풍부한 내용 작성)
    
    [네이버 블로그 HTML 형식 작성 필수]
    **중요: 반드시 HTML 태그로 작성하세요. 마크다운(###, **, -) 절대 사용 금지!**
    
    HTML 구조:
    <div class="naver-post-container">
      <h3>제목 (서론 제목)</h3>
      <p>서론 문단... (친근하게 인사, 공감, 계절 이야기)</p>
      
      [IMG_1]
      
      <h3>본론 소제목 1</h3>
      <p>전문적인 의학 정보... (상세히 설명)</p>
      <ul>
        <li>증상 1 - 개선 가능성 언급</li>
        <li>증상 2 - 도움이 될 수 있다고 표현</li>
      </ul>
      
      [IMG_2]
      
      <h3>본론 소제목 2</h3>
      <p>검사/치료 방법 설명... (안전한 표현 사용)</p>
      
      [IMG_3]
      
      <h3>건강 관리 팁</h3>
      <p>마무리: "증상이 지속될 경우 전문의와의 상담을 고려해 보시기 바랍니다" 식으로 안전하게 마무리</p>
      <p>해시태그 10개</p>
    </div>
    
    주의사항:
    1. 모든 제목은 <h3> 태그 사용
    2. 모든 문단은 <p> 태그 사용
    3. 리스트는 <ul><li> 태그 사용
    4. [IMG_1], [IMG_2], [IMG_3] 마커는 그대로 유지
    5. 해시태그는 마지막에 <p> 안에 작성
    
    **마무리 문단 필수 규칙:**
    - "방문하세요", "내원하세요" 같은 직접 권유 표현 절대 금지
    - "검진을 고려해 보시는 것도 좋습니다", "전문의와 상담이 필요할 수 있습니다" 등 간접 표현 사용
    - 병원 이름, 전화번호, 주소 절대 금지
  `;

  const cardNewsPrompt = `
    ${MEDICAL_SAFETY_SYSTEM_PROMPT}
    ${benchmarkingInstruction}
    진료과: ${request.category}, 주제: ${request.topic}
    목표 장수: 총 ${targetSlides}장
    
    [카드뉴스 대본 및 디자인 포맷]
    당신은 인스타그램/네이버 포스트용 전문 카드뉴스 디자이너입니다.
    다음 HTML 구조를 사용하여 깔끔하고 가독성 높은 디자인의 카드뉴스를 만드십시오.
    텍스트는 카드 이미지 내부에 포함되어야 합니다.
    
    ${request.referenceUrl ? '★중요: 벤치마킹 URL의 템플릿 구성을 분석하여, 해당 URL이 질문을 던지는 방식이면 질문형으로, 팩트 나열식이면 팩트 나열식으로 내용을 구성하십시오.' : ''}
    
    [HTML 구조 가이드]
    <div class="card-slide">
       <div class="card-border-box">
           <div class="card-header-row">
               <span class="brand-text">HOSPITAL NOTE</span>
               <span class="arrow-icon">→</span>
           </div>
           
           <div class="card-content-area">
               <p class="card-subtitle">...서브타이틀(벤치마킹 URL 스타일 반영)...</p>
               <div class="card-divider-dotted"></div>
               <h1 class="card-main-title">...핵심 메인 타이틀(벤치마킹 URL 스타일 반영)...</h1>
               
               <div class="card-img-container">[IMG_1]</div>
               
               <p class="card-desc">...본문 내용(벤치마킹 URL의 문장 호흡과 길이감 반영)...</p>
           </div>
           
           <div class="card-footer-row">
               <span class="pill-tag">부서: ${request.category}</span>
               <span class="pill-tag">담당: 전문의</span>
           </div>
       </div>
    </div>
    
    위 구조를 사용하여 총 ${targetSlides}장의 슬라이드를 만드십시오.
    각 슬라이드마다 [IMG_1] ~ [IMG_${targetSlides}] 마커를 적절히 배치하십시오.
    표지(첫 장)는 제목 위주로, 나머지는 내용 위주로 구성하십시오.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: isCardNews ? cardNewsPrompt : blogPrompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
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
                verified_facts_count: { type: Type.INTEGER },
                issues: { type: Type.ARRAY, items: { type: Type.STRING } },
                recommendations: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["fact_score", "safety_score", "verified_facts_count", "issues", "recommendations"]
            }
          },
          required: ["title", "content", "imagePrompts", "fact_check"]
        }
      }
    });
    return JSON.parse(response.text || "{}");
  } catch (error) { throw error; }
};

export const generateFullPost = async (request: GenerationRequest, onProgress: (msg: string) => void): Promise<GeneratedContent> => {
  const step1Msg = request.referenceUrl 
      ? `🔗 레퍼런스 URL 분석 및 ${request.postType === 'card_news' ? '카드뉴스 템플릿 모방' : '스타일 벤치마킹'} 중...` 
      : `네이버 로직 분석 및 ${request.postType === 'card_news' ? '카드뉴스 기획' : '블로그 원고 작성'} 중...`;
  
  onProgress(step1Msg);
  
  const textData = await generateBlogPostText(request);
  
  const styleName = request.imageStyle === 'illustration' ? '3D 일러스트' : '실사 촬영';
  const imgRatio = request.postType === 'card_news' ? "1:1" : "16:9";
  
  onProgress(`${styleName} 스타일로 ${imgRatio} 이미지 생성 중...`);
  
  const maxImages = request.postType === 'card_news' ? (request.slideCount || 6) : 3;
  
  const images = await Promise.all(textData.imagePrompts.slice(0, maxImages).map((p, i) => 
     generateSingleImage(p, request.imageStyle, imgRatio).then(img => ({ index: i + 1, data: img, prompt: p }))
  ));

  let body = textData.content;
  
  // AI가 class를 빼먹었을 경우 강제로 감싸기
  if (request.postType !== 'card_news' && !body.includes('class="naver-post-container"')) {
    body = `<div class="naver-post-container">${body}</div>`;
  }
  
  images.forEach(img => {
    if (img.data) {
      let imgHtml = "";
      if (request.postType === 'card_news') {
          imgHtml = `<img src="${img.data}" alt="${img.prompt}" data-index="${img.index}" class="card-inner-img" />`;
      } else {
          imgHtml = `<div class="content-image-wrapper"><img src="${img.data}" alt="${img.prompt}" data-index="${img.index}" /></div>`;
      }
      
      const pattern = new RegExp(`\\[IMG_${img.index}\\]`, "gi");
      body = body.replace(pattern, imgHtml);
    }
  });

  const disclaimer = `본 콘텐츠는 의료 정보 제공 및 병원 광고를 목적으로 합니다.<br/>개인의 체질과 건강 상태에 따라 치료 결과는 차이가 있을 수 있으며, 부작용이 발생할 수 있습니다.`;

  let finalHtml = "";
  if (request.postType === 'card_news') {
      finalHtml = `
      <div class="card-news-container">
         <h2 class="hidden-title">${textData.title}</h2>
         <div class="card-grid-wrapper">
            ${body}
         </div>
         <div class="legal-box-card">${disclaimer}</div>
      </div>
      `.trim();
  } else {
      // 이미 naver-post-container가 있으면 그대로 사용
      finalHtml = body;
  }

  return {
    title: textData.title,
    htmlContent: finalHtml,
    imageUrl: images[0]?.data || "",
    fullHtml: finalHtml,
    tags: [],
    factCheck: textData.fact_check,
    postType: request.postType,
    imageStyle: request.imageStyle
  };
};

export const modifyPostWithAI = async (currentHtml: string, userInstruction: string): Promise<{ 
  newHtml: string, 
  message: string, 
  regenerateImageIndices?: number[],
  newImagePrompts?: string[]
}> => {
    const ai = getAiClient();
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: `${MEDICAL_SAFETY_SYSTEM_PROMPT}\n[현재 원고] ${currentHtml}\n[수정 요청] ${userInstruction}\n의료법 준수 필수.`,
        config: { 
          tools: [{ googleSearch: {} }],
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
      return JSON.parse(response.text || "{}");
    } catch (error) { throw error; }
};
