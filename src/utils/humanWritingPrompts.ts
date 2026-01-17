/**
 * 사람같은 글쓰기 프롬프트
 * AI 냄새를 제거하고 자연스러운 글쓰기 유도
 */

/**
 * 기본 사람같은 글쓰기 규칙
 */
export const HUMAN_WRITING_RULES = `
[AI 티 제거 규칙]
❌ 피해야 할 표현:
- "~에 대해 알아보겠습니다"
- "~라고 할 수 있습니다"
- "~것으로 나타났습니다"
- "다양한", "효과적인", "중요한" 남발
- 과도한 이모지 🚫
- "여러분", "오늘은" 등 틀에 박힌 서두
- 동일 종결어미 3회 초과 (특히 ~입니다/~편입니다/~있습니다)

❌ 번역투 표현 (AI 냄새 강함!):
- "요소/요인" → "이유", "원인", "계기"
- "~측면에서" → "~쪽에서 보면", "~부분을"
- "~관점에서" → "~입장에서", "~으로 보면"
- "~에 있어서" → "~에서", "~할 때"
- "발생하다" → "생기다", "나타나다", "일어나다"
- "제공하다" → "주다", "내주다", "알려주다"
- "포함하다" → "들어가다", "담기다"
- "시행하다" → "하다", "진행하다", "실시하다"
- "양상/양태" → "모습", "형태", "상태"
- "측면" → "부분", "면", "쪽"

✅ 자연스러운 표현:
- 짧은 문장과 긴 문장 자연스럽게 섞기
- 핵심을 먼저, 부연설명은 나중에
- 감각 묘사 사용 (찌릿한, 묵직한, 뻣뻣한, 당기는)
- 전환어 활용 (신기하게도, 다행히, 다만, 하지만, 그런데)
- 비유로 쉽게 설명 ("찢어진 옷자락을 계속 잡아당기면~")
- 대화체 흐름 (~겁니다, ~때도 있죠, ~이야기가 달라집니다)
- 반말/존댓말 일관성 유지
- 번역투 대신 일상 언어 사용 (요소→이유, 발생→생기다)
`;

/**
 * 톤별 사람같은 글쓰기 프롬프트
 * ⚠️ 주의: 질문형(?), 출처, 기관명 모두 금지!
 */
export const HUMAN_TONE_PROMPTS = {
  empathy: `
공감형 글쓰기:
- 3인칭 관찰자 시점으로 독자 상황 묘사
- 증상→공감→정보 순서
- ⚠️ 질문형(?) 금지! 서술형으로 공감 유도
❌ "이런 경험 있으시죠?" / "무릎이 아프신가요?"
✅ "무릎이 아플 때마다 계단이 두려워지는 분들이 있습니다."
✅ "아침에 일어나면 허리가 뻣뻣한 경우가 있습니다."
`,

  professional: `
신뢰형 글쓰기:
- 의학 용어는 ( ) 안에 쉬운 설명 추가
- ⚠️ 출처/기관명/수치 금지! "일반적으로 알려져 있습니다"로 대체
- 단정적 표현 피하기
❌ "(출처: 건강보험심사평가원)" / "50대 이상에서 30%"
✅ "퇴행성관절염(연골이 닳아 생기는 질환)은 중년층에서 흔히 나타나는 편입니다."
`,

  simple: `
쉬운 글쓰기:
- 전문용어 → 쉬운 말
- 한 문장에 한 가지 내용
- 능동태 우선
예: "약을 먹으면" (O) vs "약을 복용하시면" (X)
`,

  informative: `
정보형 글쓰기:
- 핵심 먼저, 부연 나중
- 자연스러운 문단 흐름 (번호 매기기 자제)
- "왜 그런지"에 대한 설명 포함
❌ "1. 혈압약은 아침에 먹습니다."
✅ "혈압약은 아침에 먹는 편이 좋습니다. 혈압이 오전에 높아지는 경향이 있기 때문입니다."
`
};

/**
 * 의료광고법 준수하면서 사람답게 쓰기
 */
export const MEDICAL_LAW_HUMAN_PROMPT = `
[의료광고법 + 자연스러운 표현]

🚨 절대 금지 (의료광고법 위반)
━━━━━━━━━━━━━━━━━━
- "완치", "치료 효과", "100% 안전"
- "조기 발견", "조기 치료" (불안 조장)
- "~하면 좋다", "~해야 한다", "~하는 것이 좋습니다" (행동 유도)
- "2주 이상", "48시간 내" (구체적 시간 → "일정 기간"으로)
- 출처, 기관명, 수치 (%, 명, 건)
- "전문가/전문의/명의/전문/전문적" → 사용 금지

❌ 과장 표현 → ✅ 사실적 표현
- "완치" → "증상 개선", "관리"
- "즉각적 효과" → "시간이 지나면서"
- "위험하다" → "주의가 필요한 경우가 있습니다"
- "반드시 ~해야" → "~하는 것도 방법입니다"

❌ AI 스타일 → ✅ 사람 스타일
- "당뇨병에 대해 알아보겠습니다" (X)
- "갈증이 심하고 화장실을 자주 가는 날이 있습니다." (O)

- "다양한 합병증이 발생할 수 있습니다" (X)
- "혈관이나 신경에 영향을 줄 수 있습니다" (O)
`;

/**
 * 네이버 스마트블록 최적화 + 문단 구조 가이드
 */
export const PARAGRAPH_STRUCTURE_GUIDE = `
[네이버 스마트블록 최적화]
━━━━━━━━━━━━━━━━━━
- 총 글 길이: 1500~2500자 (스마트블록 노출에 유리)
- 문단 길이: 3~5문장 (너무 길면 이탈률 증가)
- 소제목 개수: 3~5개 (너무 많으면 산만)
- 첫 200자 안에 핵심 키워드 자연스럽게 1회

[자연스러운 문단 구조]
━━━━━━━━━━━━━━━━━━
서두 (1-2문장):
- 생생한 증상/상황 묘사로 시작 (3인칭)
- ⚠️ 질문형(?) 금지!
❌ "허리 통증이 3개월 이상 지속된다면?"
✅ "허리 통증이 몇 달째 이어지는 분들이 있습니다."

본문 (3-5문장):
- 짧은 문장 → 긴 문장 → 짧은 문장 리듬
- 핵심 정보 → 부연 설명 순서
- ⚠️ 통계/수치/출처 금지! → "일반적으로", "흔히" 사용

마무리 (1-2문장):
- 정보 요약으로 마무리 (행동 유도 금지!)
- ⚠️ "병원 방문", "상담하세요" 등 CTA 금지!
✅ "이런 증상이 반복된다면 몸이 보내는 신호일 수 있습니다."
`;

/**
 * Few-shot 예시 (좋은 글 vs 나쁜 글)
 */
export const FEW_SHOT_EXAMPLES = `
[나쁜 예시 - AI 티남]
당뇨병은 현대인에게 흔한 질병입니다. 당뇨병에 대해 자세히 알아보겠습니다.
다양한 증상이 나타날 수 있으며, 적절한 관리가 중요합니다.
혈당 관리가 필요합니다. 합병증 예방이 중요합니다. 정기 검진이 필요합니다.
→ 문제: 메타 설명, "다양한", 종결어미 반복, "중요합니다" 남발

[나쁜 예시 - 번역투 AI 냄새]
당뇨병의 요인은 다양한 측면에서 발생합니다. 유전적 요소가 포함되며, 생활습관 측면에서도 문제가 나타날 수 있습니다.
→ 문제: 요인, 측면, 발생, 포함, 양상 (번역투 과다!)

[나쁜 예시 - 의료광고법 위반]
2주 이상 증상이 지속되면 조기 발견이 중요합니다. 전문의와 상담하세요.
질병관리청에 따르면 30%가 이런 증상을 겪습니다.
→ 문제: 구체적 시간(2주), 조기 발견, 행동 유도(상담하세요), 기관명, 수치(30%)

[나쁜 예시 - 질문형 사용]
혹시 이런 증상 있으신가요? 무릎이 아프신 적 있나요?
→ 문제: 질문형(?), 독자에게 말 걸기

---
[좋은 예시 - 자연스러운 3인칭 서술]
아침에 일어나자마자 입안이 바짝 마르고, 목구멍이 타는 듯한 느낌이 드는 날이 있습니다.
신기하게도 물을 아무리 마셔도 갈증이 쉽게 가시지 않고, 한두 시간도 안 돼 화장실을 다시 찾게 됩니다.
이런 패턴이 며칠째 반복된다면, 혈당 조절 쪽에 변화가 생긴 건 아닌지 살펴볼 필요가 있습니다.
→ 좋은 점: 생생한 감각 묘사, 전환어(신기하게도), 3인칭 관찰자 시점

[좋은 예시 - 의료광고법 준수]
당뇨병은 완치보다는 꾸준한 관리가 필요한 편입니다.
식습관과 운동 습관을 조금씩 바꿔가면서 혈당 변화를 지켜보는 것도 방법입니다.
→ 좋은 점: 행동 유도 없음, 출처/기관명 없음, 부드러운 마무리

[번역투 개선 예시]
❌ "당뇨병 발생 요인은 다양한 측면에서 나타납니다"
✅ "당뇨병이 생기는 이유는 여러 가지입니다"

❌ "운동 측면에 있어서 중요한 요소는 규칙성입니다"
✅ "운동할 때 가장 중요한 건 규칙적으로 하는 겁니다"
`;

/**
 * 카테고리별 맞춤 프롬프트
 */
export const CATEGORY_SPECIFIC_PROMPTS = {
  internal_medicine: `내과: 증상→원인→관리 순서. 일상생활 팁 포함`,
  orthopedics: `정형외과: 통증 부위 구체적 묘사. 운동법 포함`,
  dermatology: `피부과: 시각적 묘사 자제. 생활습관 중심`,
  pediatrics: `소아과: 보호자 관점. 불안 해소 먼저`,
  psychiatry: `정신건강의학과: 낙인 제거. 일상 언어 사용`,
  ophthalmology: `안과: 증상 구체화. 예방법 강조`,
  dentistry: `치과: 통증 공감. 치료 과정 설명`,
  oriental_medicine: `한의원: 체질 언급 자제. 과학적 근거 제시`
};

/**
 * 프롬프트 생성 함수
 */
export function generateHumanWritingPrompt(
  category?: string,
  tone: keyof typeof HUMAN_TONE_PROMPTS = 'empathy'
): string {
  const tonePrompt = HUMAN_TONE_PROMPTS[tone];
  const categoryPrompt = category && category in CATEGORY_SPECIFIC_PROMPTS
    ? CATEGORY_SPECIFIC_PROMPTS[category as keyof typeof CATEGORY_SPECIFIC_PROMPTS]
    : '';

  return `
${HUMAN_WRITING_RULES}
${tonePrompt}
${MEDICAL_LAW_HUMAN_PROMPT}
${PARAGRAPH_STRUCTURE_GUIDE}
${categoryPrompt}

[참고 예시]
${FEW_SHOT_EXAMPLES}
`.trim();
}

/**
 * AI 냄새 감지 함수
 */
export function detectAiSmell(text: string): {
  detected: boolean;
  patterns: string[];
  score: number; // 0-100, 높을수록 AI 냄새 강함
} {
  const aiPatterns: Array<{ pattern: RegExp; name: string; maxAllowed?: number }> = [
    { pattern: /에\s*대해\s*알아보[겠습니다|자]/g, name: '~에 대해 알아보겠습니다' },
    { pattern: /라고\s*할\s*수\s*있습니다/g, name: '~라고 할 수 있습니다' },
    { pattern: /것으로\s*나타났습니다/g, name: '~것으로 나타났습니다' },
    { pattern: /다양한/g, name: '다양한 (과다 사용)', maxAllowed: 2 },
    { pattern: /여러분/g, name: '여러분 (과다 사용)' },
    { pattern: /오늘은/g, name: '오늘은 (틀에 박힌 서두)' },
    { pattern: /입니다(?![가-힣])/g, name: '~입니다 (종결어미 반복)', maxAllowed: 3 },
    { pattern: /편입니다(?![가-힣])/g, name: '~편입니다 (종결어미 반복)', maxAllowed: 3 },
    { pattern: /있습니다(?![가-힣])/g, name: '~있습니다 (종결어미 반복)', maxAllowed: 3 },
    { pattern: /정리해보려\s*합니다/g, name: '~정리해보려 합니다 (메타 설명)' },
    { pattern: /살펴보[겠습니다|자]/g, name: '~살펴보겠습니다 (메타 설명)' },
    { pattern: /전문가|전문의|명의|베테랑|숙련된|전문적|(?<![가-힣])전문(?![가-힣의])/g, name: '자격 강조 표현 금지 (전문가/전문의/명의/전문/전문적)' },
    
    // 🚨 번역투 표현 감지 (AI 냄새 강함!)
    { pattern: /요소|요인/g, name: '요소/요인 (번역투 - AI 냄새!)', maxAllowed: 1 },
    { pattern: /측면에서/g, name: '~측면에서 (번역투 - AI 냄새!)', maxAllowed: 0 },
    { pattern: /관점에서/g, name: '~관점에서 (번역투 - AI 냄새!)', maxAllowed: 0 },
    { pattern: /~에\s*있어서/g, name: '~에 있어서 (번역투 - AI 냄새!)', maxAllowed: 0 },
    { pattern: /측면|양상|양태/g, name: '측면/양상/양태 (번역투 논문체!)', maxAllowed: 1 },
    { pattern: /제공하다|제공됩니다/g, name: '제공하다 (번역투)', maxAllowed: 1 },
    { pattern: /발생하다|발생합니다/g, name: '발생하다 (번역투 - 생기다/나타나다로 변경)', maxAllowed: 2 },
    { pattern: /나타나다|나타납니다/g, name: '나타나다 (과다 사용 - 보이다/드러나다로 변경)', maxAllowed: 3 },
    { pattern: /포함하다|포함됩니다/g, name: '포함하다 (번역투 - 들어가다로 변경)', maxAllowed: 1 },
    { pattern: /시행하다|시행됩니다/g, name: '시행하다 (번역투 - 하다/진행하다로 변경)', maxAllowed: 0 },
    
    // 🚨 의료광고법 위반 표현 추가 (절대 금지!)
    { pattern: /의심/g, name: '의심 (의료광고법 위반 - 절대 금지!)', maxAllowed: 0 },
    { pattern: /판단/g, name: '판단 (의료광고법 위반 - 절대 금지!)', maxAllowed: 0 },
    { pattern: /가능성/g, name: '가능성 (의료광고법 위반 - 절대 금지!)', maxAllowed: 0 },
    { pattern: /환자(?!.*분)/g, name: '환자 (독자 중심 표현 사용 권장)', maxAllowed: 0 },
    { pattern: /내원/g, name: '내원 (독자 중심 표현 사용 권장)', maxAllowed: 0 },
    { pattern: /\([가-힣]+\d{4}\)/g, name: '기관명(연도) 형식 (절대 금지!)', maxAllowed: 0 },
    
    // 🚨 추가 금지 표현 (의료광고법 + 네이버 로직)
    { pattern: /조기\s*발견/g, name: '조기 발견 (불안 조장 - 금지!)', maxAllowed: 0 },
    { pattern: /조기\s*치료/g, name: '조기 치료 (불안 조장 - 금지!)', maxAllowed: 0 },
    { pattern: /\d+주\s*(이상|이내|안에)/g, name: '구체적 시간 (2주 이상 등 - 금지!)', maxAllowed: 0 },
    { pattern: /\d+시간\s*(이내|안에)/g, name: '구체적 시간 (48시간 내 등 - 금지!)', maxAllowed: 0 },
    { pattern: /상담하세요|방문하세요|확인하세요/g, name: '행동 유도 (~하세요 - 금지!)', maxAllowed: 0 },
    { pattern: /하는\s*것이\s*좋습니다/g, name: '행동 유도 (~하는 것이 좋습니다 - 금지!)', maxAllowed: 0 },
    { pattern: /하면\s*좋다/g, name: '행동 유도 (~하면 좋다 - 금지!)', maxAllowed: 0 },
    { pattern: /\?/g, name: '질문형(?) 사용 (금지!)', maxAllowed: 0 },
    { pattern: /있으신가요|하신가요|아시나요|드시나요/g, name: '독자에게 말걸기 (금지!)', maxAllowed: 0 },
    { pattern: /질병관리청|보건복지부|대한[가-힣]+학회/g, name: '기관명 언급 (금지!)', maxAllowed: 0 },
    { pattern: /\d+%|\d+명|\d+건/g, name: '수치 표현 (%, 명, 건 - 금지!)', maxAllowed: 0 },
  ];

  const detected: string[] = [];
  let totalMatches = 0;

  for (const item of aiPatterns) {
    const { pattern, name } = item;
    const maxAllowed = item.maxAllowed ?? 0;
    const matches = text.match(pattern);
    if (matches && matches.length > maxAllowed) {
      detected.push(`${name} (${matches.length}회, 허용: ${maxAllowed}회)`);
      totalMatches += matches.length - maxAllowed;
    }
  }

  // 점수 계산 (텍스트 길이 대비)
  const textLength = text.length;
  const score = Math.min(100, Math.round((totalMatches / textLength) * 1000));

  return {
    detected: detected.length > 0,
    patterns: detected,
    score
  };
}
