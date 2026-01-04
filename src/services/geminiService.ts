import { GoogleGenAI, Type } from "@google/genai";
import { GenerationRequest, GeneratedContent, TrendingItem, FactCheckReport, SeoTitleItem, ImageStyle, WritingStyle } from "../types";

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

// 글 스타일별 프롬프트 (의료법 100% 준수)
const WRITING_STYLE_PROMPTS: Record<WritingStyle, string> = {
  // 📚 전문가형: 의학 지식 깊이 강조, 논문/연구 인용, 전문의 권위감
  expert: `
[글쓰기 스타일: 전문가형 📚]
- 목표: "이 의사 진짜 잘 아네" 신뢰감과 권위 구축
- 톤: 전문적이면서도 이해하기 쉬운 설명

[🎯 핵심 테크닉 - 반드시 적용]

1. **도입부: 의학적 인사이트로 시작**
   ❌ "오늘은 당뇨에 대해 알아보겠습니다."
   ✅ "최근 대한당뇨병학회에서 발표한 자료를 보면, 공복혈당보다 '식후 2시간 혈당'이 더 중요한 지표로 주목받고 있습니다."
   ✅ "임상에서 환자분들을 만나다 보면, 의외로 많이 오해하시는 부분이 있습니다."

2. **논문/학회/가이드라인 인용** (최소 2회 이상)
   ✅ "2024년 대한OO학회 가이드라인에 따르면..."
   ✅ "JAMA에 발표된 최근 연구에서는..."
   ✅ "국민건강영양조사 데이터를 분석해보면..."
   ✅ "임상 경험상 이런 케이스가 많은데요..."

3. **의학 용어 + 쉬운 설명 병행**
   ✅ "인슐린 저항성(쉽게 말해, 인슐린이 제대로 작동하지 않는 상태)이..."
   ✅ "HbA1c, 흔히 '당화혈색소'라고 부르는 이 수치는..."
   ✅ "야간 다뇨증(밤에 소변을 자주 보는 증상)은..."

4. **전문의 관점에서의 조언**
   ✅ "진료실에서 자주 드리는 말씀인데요..."
   ✅ "환자분들께 늘 강조하는 부분이 있습니다."
   ✅ "의료진 입장에서 볼 때, 가장 아쉬운 케이스는..."

5. **근거 기반 정보 강조**
   ✅ 구체적 수치와 통계 활용
   ✅ 연구 결과와 임상 데이터 인용
   ✅ 최신 의학 트렌드 언급
`,

  // 💗 공감형: 독자 경험 중심, "이거 내 얘기네!" 반응 유도
  empathy: `
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
   ✅ "모든 보습제가 다 맞는 건 아니에요. 저도 세라마이드 제품 발랐다가 오히려 따가웠던 적 있거든요."
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

  // 🎯 전환형: 행동 유도 최적화, 상담/예약 유도 (의료법 준수)
  conversion: `
[글쓰기 스타일: 전환형 🎯]
- 목표: 독자가 글을 읽고 "나도 검진받아봐야겠다"라고 행동하게 만들기
- 톤: 신뢰감 + 적절한 긴장감 + 해결책 제시

[🎯 핵심 테크닉 - 반드시 적용]

1. **도입부: 충격적 사실 또는 질문으로 시작**
   ❌ "오늘은 당뇨에 대해 알아보겠습니다."
   ✅ "당뇨 전 단계인데 모르고 지나치는 사람이 절반이 넘는다는 사실, 알고 계셨나요?"
   ✅ "혹시 최근에 소변을 자주 보시나요? 그냥 물을 많이 마셔서라고 생각하셨다면..."
   
2. **손실 회피 심리 활용** (의료법 준수하면서!)
   ❌ 금지: "지금 안 하면 후회합니다"
   ✅ 안전: "초기에 발견하면 관리가 훨씬 수월해질 수 있어요"
   ✅ 안전: "작은 신호를 놓치면 나중에 아쉬울 수 있어요"
   ✅ 안전: "미루다 보면 놓치기 쉬운 타이밍이 있어요"

3. **구체적 수치/데이터 활용**
   ✅ "국민건강영양조사에 따르면..."
   ✅ "대한OO학회 발표 자료를 보면..."
   ✅ "10명 중 7명이 이 증상을 가볍게 여긴다고 해요"

4. **결론: 행동을 하나로 집중**
   ❌ 여러 메시지 나열
   ✅ "이번 겨울, 딱 하나만 기억하세요. '샤워 후 3분 보습'이에요."
   ✅ "오늘 할 일: 거울 앞에서 혀 한번 내밀어보기. 그게 첫걸음이에요."

5. **CTA 박스에서 심리학 기법 조합**
   - 사회적 증거: "많은 분들이 이맘때 검진을 받으세요"
   - 시의성: "환절기가 지나기 전에 체크해보시는 건 어떨까요"
   - 일관성: "오늘 자가체크 한번 해보시고, 궁금한 점이 있으면 전문의와 상담을 고려해 보세요"
`
};

// 글 스타일별 금지 표현 체크 (공통)
const WRITING_STYLE_COMMON_RULES = `
[🧠 핵심: 모든 글은 심리학 기반으로 작성 - 관심을 끌어야 함!]

**★★★ 가장 중요: 첫 문장에서 승부 ★★★**
독자는 첫 3초 안에 "이 글 읽을까 말까"를 결정합니다.
반드시 심리학적 후킹으로 시작하세요!

[🎣 후킹 심리학 기법 - 도입부 필수 적용]

1. **호기심 갭 (Curiosity Gap)** - 알고 싶게 만들기
   ✅ "대부분 모르고 있는 사실인데요..."
   ✅ "이거 아는 사람만 알더라고요"
   ✅ "왜 아무도 이 얘기 안 할까요?"

2. **공포 어필 (Fear Appeal)** - 의료법 준수하면서 경각심
   ✅ "혹시 이 증상, 그냥 넘기고 계신 건 아니죠?"
   ✅ "설마 나는 아니겠지... 했는데"
   ✅ "무심코 지나쳤던 이 신호, 사실은..."

3. **숫자/통계 충격** - 정확한 출처 기반 수치만 사용!
   ⚠️ 중요: 보건복지부, 질병관리청, 대한OO학회 등 공신력 있는 출처의 통계만 사용
   ⚠️ 팩트체크 85점 이상 필수 - 허위/과장 통계 절대 금지!
   ✅ "질병관리청 통계에 따르면..."
   ✅ "대한당뇨병학회 발표 자료를 보면..."
   ✅ "국민건강영양조사 결과..."

4. **질문형 오프닝** - 독자를 대화에 끌어들이기
   ✅ "혹시 이런 경험 있으세요?"
   ✅ "왜 유독 이맘때 이런 걸까요?"
   ✅ "이거... 저만 그런 거 아니죠?"

5. **반전/의외성** - 기존 상식 뒤집기
   ✅ "사실 이건 완전히 반대예요"
   ✅ "그동안 잘못 알고 계셨을 수도 있어요"
   ✅ "흔히 알려진 것과 다르게..."

[📌 본문 전체 심리학 기법 - 계속 적용]

1. **사회적 증거** - 중간중간 삽입
   ✅ "요즘 이런 분들이 정말 많더라고요"
   ✅ "실제로 많은 분들이 공감하시는 부분인데요"

2. **손실 회피** - 적절히 활용
   ✅ "미루다 보면 놓치기 쉬운 타이밍이 있어요"
   ✅ "나중에 '그때 할걸' 하시는 분들 꽤 계시거든요"

3. **권위 활용** - 신뢰감 구축
   ✅ "전문의들이 공통적으로 강조하는 부분이에요"
   ✅ "최근 연구에서도 확인된 내용인데요"

4. **일관성 원리** - 작은 행동 유도
   ✅ "오늘 딱 하나만 해보세요"
   ✅ "1분이면 확인할 수 있어요"

[🔍 SEO 최적화 필수 - 네이버 상위 노출용]

**★★★ SEO 핵심 규칙 ★★★**

1. **제목(H3) SEO 최적화**
   - 핵심 키워드를 제목 앞부분에 배치
   - 검색 의도에 맞는 질문형/해결형 제목
   ✅ "겨울철 피부건조 원인과 해결법"
   ✅ "당뇨 초기증상 5가지 체크리스트"
   ❌ "피부에 대해 알아봅시다"

2. **키워드 자연스럽게 반복**
   - 핵심 키워드 본문에 5-8회 자연스럽게 포함
   - 동의어/유사어 함께 사용 (LSI 키워드)
   ✅ "피부건조" + "건조한 피부" + "피부 수분" + "보습"
   ✅ "당뇨" + "혈당" + "당뇨병" + "혈당관리"

3. **소제목(H3) 구조화**
   - 검색 키워드 포함한 소제목 3-5개
   - "원인", "증상", "치료법", "예방법" 등 검색 의도 반영
   
4. **첫 문단에 핵심 키워드**
   - 첫 100자 안에 메인 키워드 필수 포함
   - 검색 결과 미리보기에 노출되는 부분

5. **리스트/넘버링 활용**
   - "3가지 방법", "5가지 증상" 등 숫자 활용
   - <ul><li> 태그로 구조화 (스니펫 노출 유리)

6. **해시태그 SEO**
   - 검색량 높은 키워드 우선 배치
   - 롱테일 키워드 포함
   ✅ #피부건조 #겨울철피부관리 #피부보습 #건조한피부 #피부건강

[🎯 마케팅 글 핵심 - 예약 전환율 높이기 (의료법 100% 준수)]

**★★★ CTA 핵심 공식: "오세요"가 아니라 "다른 선택지는 아니다" ★★★**
CTA의 목적은 '방문 권유'가 아니라 **'다른 선택지를 지워주는 것'**입니다.
사람은 아플 때도 결정을 미룹니다. 그래서 **판단 기준**을 제시해야 합니다.

1. **배제형 CTA (가장 강력!) - 반드시 1개 이상 포함**
   - "이 경우엔 이게 맞다"를 명확히 → 다른 선택지를 지워줌
   - 병원 이름 ❌ / 예약 유도 ❌ / 광고 느낌 ❌ → 하지만 행동은 시작됨
   
   ✅ 배제형 예시 (이 중 상황에 맞게 선택):
   - "이 정도 통증과 열이 있다면, 단순 감기약만으로 버티는 단계는 이미 지났습니다"
   - "침 삼키는 통증이 점점 심해지고 열까지 난다면, 약으로 버티기보다는 목 상태를 직접 확인하는 진료가 필요한 시점입니다"
   - "자가 판단으로 약을 고르는 것보다 원인균을 구분하는 진료가 먼저입니다"
   - "증상이 3일 이상 지속되거나 고열이 동반된다면, 단순 감기 관리만으로는 충분하지 않을 수 있습니다"
   
   ❌ 약한 CTA (사용 금지):
   - "증상이 심하면 병원 진료를 고려해 보세요" (정보형 - 결정 대신 안 해줌)
   - "전문의와 상담하세요" (방향성 없음)
   - "병원에 가보세요" (너무 추상적)

2. **'검사/확인'을 CTA 중심에 두기**
   - 병원은 '치료'보다 **'확인'**에서 신뢰를 얻음
   - "필요해지는 시점" 표현 활용 → 명령도 광고도 아닌데 행동 타이밍 인식시킴
   
   ✅ 검사 중심 CTA:
   - "겉으로 보이는 증상만으로는 구분이 어려워, 목 상태를 직접 확인하는 진료가 필요해지는 시점입니다"
   - "이 단계에서는 증상 설명보다 실제 목 안 상태를 확인하는 것이 치료 방향을 결정합니다"
   - "OO 검사를 바로 할 수 있는 의료기관에서 확인하는 게 순서입니다"

3. **CTA 위치: 마지막 문단만 아니라 중간에도 삽입**
   - 각 파트(원인, 증상, 치료 등) 끝에 자연스럽게 배제형 CTA 삽입
   - 광고처럼 안 보이면서 행동 유도 가능
   
   ✅ 중간 CTA 예시 (항생제 파트 끝에):
   - "이런 경우에는 자가 판단으로 약을 고르는 것보다 원인균을 구분하는 진료가 먼저입니다"

4. **예방/관리 파트는 30%로 압축**
   - 검사/진단이 주인공, 생활습관은 조연
   - 핵심 2-3개만 간결하게 → 바로 검사/진단으로 연결
   ❌ 장황한 건강 생활 팁 나열

5. **마무리는 감성 ↓ 판단 ↑**
   - 따뜻한 마무리 대신 **결정의 명분** 제공
   - 마지막 문단은 '왜 지금 해야 하는지'에 집중
   
   ✅ 강한 마무리:
   - "2주 이상 지속된다면 단순 피로가 아닐 수 있어요. 원인을 파악하는 게 먼저입니다"
   - "초기 발견이 치료 예후를 크게 바꿉니다. 미루지 마세요"
   ❌ "건강한 하루 되세요~" / "활기찬 내일을 위해~"

[⚠️ AI 티 나는 문장 - 반드시 삭제 또는 대체]
**★★★ 아래 문장들은 절대 사용 금지 ★★★**
- "꼭 기억해 주셔야 해요" → 삭제 (정보로 대체)
- "주저하지 마세요" → 삭제
- "지체하지 말고" → 삭제
- "소중한 감각입니다" → 삭제
- "함께 지켜나가요" → 삭제
- "건강한 하루 보내세요" → 삭제
- "활기찬 내일" → 삭제
- "효율적입니다" → 구체적 결과로 대체
- "도움이 될 수 있습니다" → 2회 이상 사용 금지

**감정 문장 규칙:**
- 마지막 문단에서 감정 문장 1개 이하
- 판단/결정 문장 위주로 마무리

[⚠️ 절대 금지]
- "~에 도움이 될 수 있습니다" 3회 이상 반복 금지
- "중요합니다" 3회 이상 반복 금지  
- 모든 문장이 "~합니다"로 끝나는 단조로움 금지
- "오늘은 ~에 대해 알아보겠습니다" 같은 진부한 도입 절대 금지!
- 키워드 과다 삽입 (키워드 스터핑) 금지

[✅ 권장 문장 엔딩 다양화]
- "~거든요", "~잖아요", "~더라고요" (친근함)
- "~인데요", "~예요/이에요" (부드러움)
- "~세요", "~보세요" (권유)
- "~죠?", "~을까요?" (질문형)
`;

// 배제형 CTA 공식 (의료광고법 100% 준수하면서 전환율 극대화)
const PSYCHOLOGY_CTA_PROMPT = `
[🎯 배제형 CTA 공식 - 의료광고법 100% 준수]

**★★★ 핵심 원칙 ★★★**
CTA = "오세요" ❌
CTA = "이 경우엔 다른 선택지는 아니다" ✅

사람은 무엇을 할지보다 **무엇을 하면 안 되는지**가 명확할 때 움직입니다.
병원 이름 없이, 예약 유도 없이, 광고 느낌 없이 → 행동을 시작하게 합니다.

[🔥 배제형 CTA 실전 공식 - 반드시 적용]

**공식: "이런 경우라면 ○○이 아니라 △△를 선택해야 합니다"**

1. **가장 안전한 버전 (광고심의 100% 통과)**
   ✅ "증상이 3일 이상 지속되거나 고열이 동반된다면, 단순 감기 관리만으로는 충분하지 않을 수 있습니다"
   ✅ "이 정도 증상이라면 약국에서 약을 사는 단계는 이미 지났습니다"

2. **가장 전환 잘 되는 버전**
   ✅ "침 삼키는 통증이 점점 심해지고 열까지 난다면, 약으로 버티기보다는 목 상태를 직접 확인하는 진료가 필요한 시점입니다"
   ✅ "고열이 동반되거나 삼키기 힘들 정도의 통증이 있다면, 일반 감기 관리보다는 목 상태를 직접 확인하는 진료가 필요한 상황입니다"

3. **가장 '의사 글' 같은 버전**
   ✅ "이 단계에서는 증상 설명보다 실제 목 안 상태를 확인하는 것이 치료 방향을 결정합니다"
   ✅ "겉으로 보이는 증상만으로는 구분이 어려워, 직접 확인하는 진료가 필요해지는 시점입니다"

[📍 중간 CTA - 각 파트 끝에 삽입]
- 항생제/약물 파트 끝: "이런 경우에는 자가 판단으로 약을 고르는 것보다 원인균을 구분하는 진료가 먼저입니다"
- 증상 파트 끝: "이런 증상이 겹친다면, 일반 관리로 넘어가기보다 정확한 원인을 확인하는 게 순서입니다"
- 검사 파트 끝: "증상만으로 판단하기보다, OO 검사로 직접 확인하는 것이 치료 방향을 명확하게 합니다"

[🔑 핵심 표현: "필요해지는 시점"]
이 표현은 명령도 아니고 광고도 아닌데, 독자는 행동 타이밍을 인식합니다.
✅ "목 상태를 직접 확인하는 진료가 필요해지는 시점입니다"
✅ "원인을 파악하는 게 필요한 시점입니다"

[🚫 절대 금지 - 의료광고법 위반]
- 직접적인 내원/예약 권유 ("방문하세요", "예약하세요", "문의하세요")
- 병원명, 전화번호, 주소 언급
- 치료 효과 보장 ("완치", "확실한 효과")
- 과장 표현 ("최고", "유일", "1등")
- 타 의료기관 비교/비방

[🚫 약한 CTA - 사용 금지]
❌ "증상이 심하면 병원 진료를 고려해 보세요" (정보형 - 결정 대신 안 해줌)
❌ "전문의와 상담하세요" (방향성 없음)
❌ "병원에 가보세요" (추상적)
❌ "검사가 필요할 수 있습니다" (판단 미룸)
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
  const writingStyle = request.writingStyle || 'empathy'; // 기본값: 공감형
  const writingStylePrompt = WRITING_STYLE_PROMPTS[writingStyle];
  
  const blogPrompt = `
    ${MEDICAL_SAFETY_SYSTEM_PROMPT}
    ${writingStylePrompt}
    ${WRITING_STYLE_COMMON_RULES}
    ${benchmarkingInstruction}
    
    진료과: ${request.category}, 페르소나: ${request.persona}, 주제: ${request.topic}
    목표 글자 수: 공백 포함 약 ${targetLength}자 (너무 짧지 않게 풍부한 내용 작성)
    이미지 개수: ${targetImageCount}장 (${imageMarkers} 마커 사용)
    
    [네이버 블로그 HTML 형식 작성 필수]
    **중요: 반드시 HTML 태그로 작성하세요. 마크다운(###, **, -) 절대 사용 금지!**
    
    HTML 구조 (이미지 ${targetImageCount}장 배치):
    <div class="naver-post-container">
      <h3>제목 (서론 제목)</h3>
      <p>서론 문단 - ${writingStyle === 'expert' ? '의학적 인사이트나 논문/학회 인용으로 시작' : '구체적 상황 묘사로 시작! (예: "히터 켜고 자고 일어나면...")'}</p>
      
      [IMG_1]
      
      <h3>본론 소제목 1</h3>
      <p>전문적인 의학 정보... ${writingStyle === 'expert' ? '+ 논문/학회 인용' : '+ 실제 상황 예시 포함'}</p>
      <ul>
        <li>증상 1 ${writingStyle === 'expert' ? '+ 의학 용어와 쉬운 설명 병행' : '+ 구체적 상황 ("아침에 일어났을 때...")'}</li>
        <li>증상 2 ${writingStyle === 'expert' ? '+ 근거 기반 정보' : '+ 공감 표현 ("이런 경험 있으시죠?")'}</li>
      </ul>
      
      ${targetImageCount >= 2 ? '[IMG_2]' : ''}
      
      <h3>본론 소제목 2</h3>
      <p>검사/치료 방법 설명... ${writingStyle === 'expert' ? '+ 최신 가이드라인 인용' : '+ 예외 사례 언급 ("물론 개인차가 있어서...")'}</p>
      
      ${targetImageCount >= 3 ? '[IMG_3]' : ''}
      
      ${targetImageCount >= 4 ? '<h3>추가 정보</h3><p>더 자세한 내용...</p>[IMG_4]' : ''}
      
      ${targetImageCount >= 5 ? '<h3>전문가 조언</h3><p>전문적인 내용...</p>[IMG_5]' : ''}
      
      <h3>건강 관리 팁</h3>
      <p>마무리: ${writingStyle === 'conversion' ? '행동을 하나로 집중! ("딱 하나만 기억하세요...")' : '핵심 정보 요약 (짧게 2-3줄)'}</p>
      
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
    ${writingStylePrompt}
    ${WRITING_STYLE_COMMON_RULES}
    ${benchmarkingInstruction}
    진료과: ${request.category}, 주제: ${request.topic}
    총 ${targetSlides}장의 카드뉴스
    글 스타일: ${writingStyle === 'expert' ? '전문가형(신뢰·권위·논문 인용)' : writingStyle === 'empathy' ? '공감형(독자 공감 유도)' : '전환형(행동 유도)'}
    
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
    const pattern = new RegExp(`\\[IMG_${img.index}\\]`, "gi");
    if (img.data) {
      let imgHtml = "";
      if (request.postType === 'card_news') {
          imgHtml = `<img src="${img.data}" alt="${img.prompt}" data-index="${img.index}" class="card-inner-img" />`;
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
      // 블로그 포스트: 맨 위에 메인 제목(h2) 추가
      const mainTitle = request.topic || textData.title;
      if (body.includes('class="naver-post-container"')) {
        // naver-post-container 안에 제목 삽입
        finalHtml = body.replace(
          '<div class="naver-post-container">',
          `<div class="naver-post-container"><h2 class="main-title">${mainTitle}</h2>`
        );
      } else {
        finalHtml = `<div class="naver-post-container"><h2 class="main-title">${mainTitle}</h2>${body}</div>`;
      }
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
      const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: `${MEDICAL_SAFETY_SYSTEM_PROMPT}\n[현재 원고] ${sanitizedHtml}\n[수정 요청] ${userInstruction}\n의료법 준수 필수. 이미지 src는 __IMG_PLACEHOLDER_N__ 형식으로 유지하세요.`,
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
