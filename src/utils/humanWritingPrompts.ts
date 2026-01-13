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

✅ 자연스러운 표현:
- 짧은 문장과 긴 문장 자연스럽게 섞기
- 핵심을 먼저, 부연설명은 나중에
- 구체적 숫자와 예시 사용
- 반말/존댓말 일관성 유지
`;

/**
 * 톤별 사람같은 글쓰기 프롬프트
 */
export const HUMAN_TONE_PROMPTS = {
  empathy: `
공감형 글쓰기:
- "이런 경험 있으시죠?" 같은 공감 유도
- 독자의 상황을 먼저 언급
- 걱정→해결책 순서
예: "무릎이 아플 때마다 계단이 두렵습니다. 관절염일까요?"
`,

  professional: `
전문형 글쓰기:
- 의학 용어는 ( ) 설명 추가
- 통계는 출처와 함께
- 단정적 표현 피하기
예: "퇴행성관절염(연골이 닳아 생기는 질환)은 50대 이상에서 흔합니다. (출처: 건강보험심사평가원)"
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
- 핵심 먼저, 근거 나중
- 번호/불릿으로 구조화
- "왜?"에 대한 답변 포함
예: "1. 혈압약은 아침에 먹습니다. → 2. 이유: 혈압이 오전에 높기 때문"
`
};

/**
 * 의료광고법 준수하면서 사람답게 쓰기
 */
export const MEDICAL_LAW_HUMAN_PROMPT = `
[의료광고법 + 자연스러운 표현]

❌ 과장 표현 → ✅ 사실적 표현
- "완치" → "증상 개선" 또는 "관리"
- "최고의 치료" → "효과적인 치료 방법 중 하나"
- "즉각적 효과" → "일정 시간 후 효과"
- "100% 안전" → "안전성이 입증된" (출처 필수)

❌ AI 스타일 → ✅ 사람 스타일
- "당뇨병에 대해 알아보겠습니다" (X)
- "당뇨병, 혈당만 관리하면 될까요?" (O)

- "다양한 합병증이 발생할 수 있습니다" (X)
- "신장, 눈, 신경 손상으로 이어질 수 있습니다" (O)
`;

/**
 * 문단 구조 가이드 (사람같은 흐름)
 */
export const PARAGRAPH_STRUCTURE_GUIDE = `
[자연스러운 문단 구조]

서두 (1-2문장):
- 독자 상황 공감 또는 질문으로 시작
- 예: "허리 통증이 3개월 이상 지속된다면?"

본문 (3-5문장):
- 짧은 문장 → 긴 문장 → 짧은 문장 리듬
- 핵심 정보 → 부연 설명 순서
- 통계/수치는 괄호 안에 출처

마무리 (1-2문장):
- 행동 유도 (CTA) 또는 요약
- 의료광고법 주의: "병원 방문" 대신 "전문의 상담"
`;

/**
 * Few-shot 예시 (좋은 글 vs 나쁜 글)
 */
export const FEW_SHOT_EXAMPLES = `
[나쁜 예시 - AI 티남]
당뇨병은 현대인에게 흔한 질병입니다. 당뇨병에 대해 자세히 알아보겠습니다.
다양한 증상이 나타날 수 있으며, 적절한 관리가 중요합니다.
혈당 관리가 필요합니다. 합병증 예방이 중요합니다. 정기 검진이 필요합니다. (종결어미 반복)

[좋은 예시 - 자연스러움]
갈증이 심하고 화장실을 자주 간다면 당뇨병을 의심해볼 수 있다.
혈당이 높아지면 우리 몸은 소변으로 당을 배출하려는 경향을 보인다.
조절이 제대로 되지 않으면 혈관 건강에 영향을 줄 수 있는 것으로 알려져 있다.
---
[나쁜 예시 - 의료광고법 위반]
우리 병원의 최첨단 치료로 당뇨를 완치할 수 있습니다!
100% 안전하고 효과가 즉각 나타납니다.

[좋은 예시 - 법 준수]
당뇨병은 완치보다는 꾸준한 관리가 중요합니다.
혈당 조절, 식이요법, 운동으로 합병증을 예방할 수 있습니다. (출처: 대한당뇨병학회)
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
  ];

  const detected: string[] = [];
  let totalMatches = 0;

  for (const item of aiPatterns) {
    const { pattern, name } = item;
    const maxAllowed = 'maxAllowed' in item ? item.maxAllowed : 0;
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
