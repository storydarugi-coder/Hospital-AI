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

// 심리학적 설득 기법 기반 전환 문구 (의료광고법 100% 준수)
const PSYCHOLOGY_CTA_PROMPT = `
[🧠 심리학적 전환 문구 생성 - 의료광고법 100% 준수]

당신은 설득 심리학 전문가이자 의료광고법 전문 카피라이터입니다.
다음 심리학 원칙을 활용하되, 의료광고법을 절대 위반하지 않는 전환 문구를 생성하세요.

[활용 가능한 심리학 원칙]

1. **사회적 증거 (Social Proof)** - 많은 사람들이 이미 하고 있다는 암시
   ❌ 금지: "1000명이 예약했습니다", "인기 있는 병원"
   ✅ 안전: "많은 분들이 정기 검진의 중요성을 알고 계십니다"
   ✅ 안전: "건강에 관심 있는 분들 사이에서 화제가 되고 있는 정보입니다"

2. **손실 회피 (Loss Aversion)** - 놓치면 손해라는 느낌
   ❌ 금지: "지금 안 하면 후회합니다", "늦기 전에 예약하세요"
   ✅ 안전: "초기에 발견하면 관리가 수월해질 수 있습니다"
   ✅ 안전: "미루다 보면 놓치기 쉬운 건강 신호들이 있습니다"
   ✅ 안전: "작은 증상을 가볍게 여기면 나중에 아쉬울 수 있어요"

3. **희소성/시의성 (Scarcity/Timeliness)** - 지금이 적기라는 느낌
   ❌ 금지: "한정 이벤트", "선착순 마감"
   ✅ 안전: "환절기에는 특히 건강 관리에 신경 쓸 필요가 있습니다"
   ✅ 안전: "이맘때쯤 검진을 받아보시는 분들이 많습니다"
   ✅ 안전: "계절이 바뀌는 시기, 우리 몸도 점검이 필요할 때입니다"

4. **호혜성 (Reciprocity)** - 유용한 정보를 줬으니 관심을 가져달라는 느낌
   ❌ 금지: "무료 상담 해드립니다"
   ✅ 안전: "이 글이 도움이 되셨다면, 주변 분들께도 공유해 주세요"
   ✅ 안전: "건강 정보는 알수록 도움이 됩니다. 더 궁금한 점이 있으시면 전문의와 상담을 고려해 보세요"

5. **권위 (Authority)** - 전문가가 말하는 것이라는 신뢰감
   ❌ 금지: "유명 의사", "국내 최고 전문의"
   ✅ 안전: "전문의들이 강조하는 건강 수칙입니다"
   ✅ 안전: "의학계에서 권장하는 생활 습관이에요"
   ✅ 안전: "학회에서 발표된 연구 결과에 따르면..."

6. **일관성 (Commitment & Consistency)** - 작은 행동부터 시작하게 유도
   ❌ 금지: "지금 바로 예약하세요"
   ✅ 안전: "오늘 하루, 건강 일기 한 줄 적어보시는 건 어떨까요?"
   ✅ 안전: "먼저 자가 체크리스트로 증상을 확인해 보세요"
   ✅ 안전: "작은 습관 하나가 건강을 지키는 첫걸음입니다"

7. **공감/감정 호소 (Emotional Appeal)** - 감정적 연결
   ❌ 금지: "아프지 마세요, 저희가 치료해 드릴게요"
   ✅ 안전: "가족의 건강, 함께 지켜가요"
   ✅ 안전: "당신의 건강이 가족의 행복입니다"
   ✅ 안전: "소중한 일상을 오래 누리시길 바랍니다"

[🚫 절대 금지 - 의료광고법 위반]
- 직접적인 내원/예약 권유 ("방문하세요", "예약하세요", "문의하세요")
- 병원명, 전화번호, 주소 언급
- 치료 효과 보장 ("완치", "확실한 효과")
- 과장 표현 ("최고", "유일", "1등")
- 타 의료기관 비교/비방

[✅ 마무리 전환 문구 패턴 - 이 중에서 선택]
1. 정보 제공형: "이 글이 건강 관리에 도움이 되셨으면 합니다 😊"
2. 행동 유도형: "증상이 지속된다면 전문의와 상담을 고려해 보세요"
3. 감정 호소형: "건강한 오늘이 행복한 내일을 만듭니다"
4. 사회적 증거형: "많은 분들이 정기 검진으로 건강을 지키고 계십니다"
5. 계절/시의형: "건강 관리하기 좋은 계절입니다. 이번 기회에 점검해 보시는 건 어떨까요?"
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
  const now = new Date();
  const koreaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const year = koreaTime.getFullYear();
  const month = koreaTime.getMonth() + 1;
  const day = koreaTime.getDate();
  const hour = koreaTime.getHours();
  const dateStr = `${year}년 ${month}월 ${day}일 ${hour}시`;
  
  // 1단계: 네이버 뉴스 API로 실시간 뉴스 수집
  let newsData: any = null;
  try {
    const newsResponse = await fetch(`/api/naver/news?query=${encodeURIComponent(category + ' 건강')}&display=30&sort=date`);
    if (newsResponse.ok) {
      newsData = await newsResponse.json();
    }
  } catch (e) {
    console.warn('네이버 뉴스 API 호출 실패, Gemini 분석으로 대체:', e);
  }
  
  // 2단계: 뉴스 데이터를 Gemini로 분석
  let newsContext = '';
  if (newsData?.items?.length > 0) {
    newsContext = `[네이버 뉴스 실시간 검색 결과 - ${dateStr} 기준]
${newsData.items.slice(0, 20).map((item: any, i: number) => 
  `${i+1}. ${item.title.replace(/<[^>]*>/g, '')} (${item.pubDate})`
).join('\n')}

위 실시간 뉴스를 기반으로 `;
  }
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `[현재 시각: ${dateStr} (한국 표준시)]

${newsContext}'${category}' 진료과와 관련된 건강/의료 트렌드 5가지를 분석해주세요.

[점수 산정 기준]
1. SEO 적합도 점수(0~100): 뉴스 보도량 + 대중적 관심도가 높을수록, 블로그 경쟁도가 낮을수록 높은 점수
2. 점수 높은 순서대로 정렬

[제약조건]
1. 실제 '질병명', '증상', '치료법', '건강 뉴스' 내용만 추출
2. seasonal_factor에는 "왜 지금 이 주제가 뜨는지" 근거를 짧게 작성
3. ${month}월 계절적 특성 반영 (예: 1월=독감/동상, 7월=열사병/식중독 등)`,
    config: {
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

  const targetImageCount = request.imageCount || 3;
  const imageMarkers = Array.from({length: targetImageCount}, (_, i) => `[IMG_${i+1}]`).join(', ');
  
  const blogPrompt = `
    ${MEDICAL_SAFETY_SYSTEM_PROMPT}
    ${benchmarkingInstruction}
    진료과: ${request.category}, 페르소나: ${request.persona}, 주제: ${request.topic}
    목표 글자 수: 공백 포함 약 ${targetLength}자 (너무 짧지 않게 풍부한 내용 작성)
    이미지 개수: ${targetImageCount}장 (${imageMarkers} 마커 사용)
    
    [네이버 블로그 HTML 형식 작성 필수]
    **중요: 반드시 HTML 태그로 작성하세요. 마크다운(###, **, -) 절대 사용 금지!**
    
    HTML 구조 (이미지 ${targetImageCount}장 배치):
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
      
      ${targetImageCount >= 2 ? '[IMG_2]' : ''}
      
      <h3>본론 소제목 2</h3>
      <p>검사/치료 방법 설명... (안전한 표현 사용)</p>
      
      ${targetImageCount >= 3 ? '[IMG_3]' : ''}
      
      ${targetImageCount >= 4 ? '<h3>추가 정보</h3><p>더 자세한 내용...</p>[IMG_4]' : ''}
      
      ${targetImageCount >= 5 ? '<h3>전문가 조언</h3><p>전문적인 내용...</p>[IMG_5]' : ''}
      
      <h3>건강 관리 팁</h3>
      <p>마무리 1: 핵심 정보 요약 (짧게 2-3줄)</p>
      
      <div class="cta-box">
        <p class="cta-title">💡 건강 체크 포인트</p>
        <p class="cta-text">심리학적 전환 문구 삽입 (아래 규칙 참조)</p>
      </div>
      
      <p>해시태그 10개</p>
    </div>
    
    ${PSYCHOLOGY_CTA_PROMPT}
    
    [🎯 마무리 CTA 박스 작성 규칙]
    1. 글의 주제와 연관된 심리학 기법 2-3개 조합
    2. 독자가 "다음 행동"을 자연스럽게 떠올리게 유도
    3. 직접적 권유 없이 간접적으로 행동 유도
    
    **CTA 박스 HTML 구조:**
    <div class="cta-box">
      <p class="cta-title">💡 [관련 이모지] [후킹 제목]</p>
      <p class="cta-text">[심리학 기반 전환 문구 2-3문장]</p>
      <p class="cta-subtext">[부드러운 마무리 한 줄]</p>
    </div>
    
    **예시:**
    <div class="cta-box">
      <p class="cta-title">💡 혹시 이런 증상, 그냥 넘기고 계신가요?</p>
      <p class="cta-text">
        작은 불편함도 초기에 확인하면 관리가 훨씬 수월해질 수 있습니다.<br/>
        많은 분들이 정기 검진으로 건강을 지키고 계세요.<br/>
        이번 기회에 내 몸 상태를 점검해 보시는 건 어떨까요?
      </p>
      <p class="cta-subtext">건강한 오늘이 행복한 내일을 만듭니다 😊</p>
    </div>
    
    주의사항:
    1. 모든 제목은 <h3> 태그 사용
    2. 모든 문단은 <p> 태그 사용
    3. 리스트는 <ul><li> 태그 사용
    4. 이미지 마커 ${imageMarkers}를 글 중간에 적절히 배치
    5. 해시태그는 마지막에 <p> 안에 작성
    6. **CTA 박스는 반드시 마지막 이미지 다음, 해시태그 전에 배치**
    
    **마무리 문단 필수 규칙:**
    - "방문하세요", "내원하세요" 같은 직접 권유 표현 절대 금지
    - "검진을 고려해 보시는 것도 좋습니다", "전문의와 상담이 필요할 수 있습니다" 등 간접 표현 사용
    - 병원 이름, 전화번호, 주소 절대 금지
  `;

  const cardNewsPrompt = `
    ${MEDICAL_SAFETY_SYSTEM_PROMPT}
    ${benchmarkingInstruction}
    진료과: ${request.category}, 주제: ${request.topic}
    총 ${targetSlides}장의 카드뉴스
    
    [🚨 가장 중요: 스토리 연결성]
    카드뉴스는 반드시 **하나의 이야기**로 연결되어야 합니다.
    각 슬라이드가 "그래서 → 왜냐하면 → 따라서" 논리로 자연스럽게 이어져야 합니다.
    
    **스토리 구조 (${targetSlides}장):**
    1장: 🎯 후킹 - 독자의 관심을 끄는 질문/충격적 사실
    2장: ❓ 문제 제기 - "왜 이게 문제인가?"
    3장: 💡 원인/배경 - "이런 이유 때문입니다"
    4장: ✅ 해결책 1 - 첫 번째 실천 방법
    5장: ✅ 해결책 2 - 두 번째 실천 방법  
    ${targetSlides}장: 📌 마무리 - 핵심 요약 + 심리학적 전환 문구 (아래 참조)
    
    **예시 (겨울철 심근경색):**
    1장: "겨울에 심장마비가 3배 증가한다는 사실, 알고 계셨나요?"
    2장: "왜 유독 겨울에 위험할까요?"
    3장: "추위에 혈관이 수축하면서 혈압이 급상승합니다"
    4장: "예방법 1: 외출 시 목도리로 목 보호하기"
    5장: "예방법 2: 아침 운동보다 오후 운동이 안전해요"
    6장: "작은 습관이 생명을 지킵니다 💪" (심리학적 전환 문구)
    
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
    
    [HTML 구조 - 반드시 이 형식 그대로 따르세요]
    <div class="card-slide">
      <div class="card-border-box">
        <div class="card-header-row">
          <span class="brand-text">HEALTH NOTE</span>
          <span class="arrow-icon">→</span>
        </div>
        <div class="card-content-area">
          <p class="card-subtitle">짧은 질문형 (예: 왜 위험할까요?)</p>
          <div class="card-divider-dotted"></div>
          <p class="card-main-title">짧은 핵심<br/><span class="card-highlight">강조단어</span></p>
          <div class="card-img-container">[IMG_N]</div>
          <p class="card-desc">부연 설명 한 문장</p>
        </div>
        <div class="card-footer-row">
          <span class="pill-tag">${request.category}</span>
          <span class="pill-tag">건강정보</span>
        </div>
      </div>
    </div>
    
    [🚫 절대 금지 표현 - 카드에 이런 텍스트 넣지 마세요!]
    ❌ "01.", "02.", "03." 같은 슬라이드 번호
    ❌ "해결책 1", "해결책 2", "마무리" 같은 구조 용어
    ❌ "첫 번째", "두 번째", "세 번째" 같은 순서 표현
    ❌ "후킹", "문제 제기", "원인/배경" 같은 프레임워크 용어
    
    [✅ 올바른 예시]
    card-subtitle: "알고 계셨나요?" / "왜 위험할까요?" / "이렇게 해보세요"
    card-main-title: "겨울철 심장마비<br/><span class='card-highlight'>3배</span> 증가" 
    
    [🚨 작성 규칙 - 매우 중요]
    1. 각 슬라이드에 [IMG_1]~[IMG_${targetSlides}] 마커 필수
    2. 이전 슬라이드와 내용이 자연스럽게 연결
    3. card-main-title은 **반드시 <p> 태그 사용** (h1 사용 금지!)
    4. card-main-title은 **12자 이내**로 짧게! 줄바꿈은 <br/> 사용
    5. card-subtitle은 **8자 이내**의 질문형
    6. card-desc는 **20자 이내**의 부연 설명
    7. 긴 문장은 절대 금지! 핵심 키워드만!
    8. 실제 독자가 볼 콘텐츠만 작성 (메타 정보 금지)
    
    [❌ 잘못된 예시 - 절대 이렇게 쓰지 마세요]
    <p class="card-main-title">스타틴 임의 중단은 금물! 전문의가 강조하는 만성질환 복약 순응도의 중요성</p>
    
    [✅ 올바른 예시]
    <p class="card-main-title">스타틴<br/><span class="card-highlight">중단 금지!</span></p>
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
  
  const maxImages = request.postType === 'card_news' ? (request.slideCount || 6) : (request.imageCount || 3);
  
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
