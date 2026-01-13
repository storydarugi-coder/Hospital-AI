/**
 * 소제목 자동 최적화 (네이버 C-Rank 알고리즘 대응)
 * - 검색 의도 분석
 * - 호기심 유발 패턴
 * - SEO 최적화 소제목 추천
 */

export interface SubheadingSuggestion {
  original?: string;
  optimized: string;
  reason: string;
  seoScore: number; // 0-100
  pattern: 'question' | 'curiosity' | 'checklist' | 'number' | 'emotion';
}

export interface SubheadingOptimizationResult {
  suggestions: SubheadingSuggestion[];
  totalSeoScore: number;
  improvements: string[];
}

/**
 * 네이버 C-Rank 최적화 패턴
 */
const CRANK_PATTERNS = {
  question: {
    templates: [
      '{topic}, 왜 생기는 걸까요?',
      '{symptom} 증상, 정상인가요?',
      '이 증상, 언제 병원에 가야 할까요?',
      '{condition}과 {condition2}, 어떻게 다를까요?'
    ],
    score: 25
  },
  curiosity: {
    templates: [
      '{topic}, 이것만 확인하세요',
      '많은 분들이 놓치는 {topic}',
      '{topic}의 의외의 신호',
      '알아두면 유용한 {topic}'
    ],
    score: 20
  },
  checklist: {
    templates: [
      '{topic} 자가 체크 리스트',
      '{symptom}, 이런 증상 있다면 주의',
      '{topic} 확인해야 할 신호들',
      '{condition} 체크 포인트'
    ],
    score: 22
  },
  number: {
    templates: [
      '{topic} 3가지 핵심',
      '{symptom} 5가지 신호',
      '{condition} 관리 7가지 방법',
      '{topic}에 좋은 4가지 습관'
    ],
    score: 18
  },
  emotion: {
    templates: [
      '{topic}로 힘드신가요?',
      '{symptom}, 혼자 고민하지 마세요',
      '{condition} 극복하는 방법',
      '{topic}, 미리 알았다면 좋았을 것들'
    ],
    score: 15
  }
};

/**
 * 검색 의도 분석
 */
function analyzeSearchIntent(topic: string): string {
  const intentKeywords = {
    symptom: ['증상', '아프', '통증', '불편', '이상', '신호'],
    cause: ['원인', '이유', '왜', '발생', '생기'],
    treatment: ['치료', '방법', '완화', '개선', '관리'],
    diagnosis: ['진단', '검사', '확인', '체크', '판별'],
    prevention: ['예방', '방지', '막기', '주의', '관리']
  };

  for (const [intent, keywords] of Object.entries(intentKeywords)) {
    if (keywords.some(keyword => topic.includes(keyword))) {
      return intent;
    }
  }

  return 'general';
}

/**
 * 키워드 추출
 */
function extractKeywords(text: string): string[] {
  // 명사 추출 (간단한 패턴 매칭)
  const nouns = text.match(/[가-힣]{2,}/g) || [];

  // 빈도수 계산
  const frequency: Record<string, number> = {};
  nouns.forEach(noun => {
    if (noun.length >= 2 && noun.length <= 10) {
      frequency[noun] = (frequency[noun] || 0) + 1;
    }
  });

  // 상위 5개 키워드 반환
  return Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

/**
 * 소제목 SEO 점수 계산
 */
function calculateSeoScore(subheading: string, mainTopic: string): number {
  let score = 0;

  // 1. 길이 체크 (20~40자 ideal)
  const length = subheading.length;
  if (length >= 20 && length <= 40) score += 25;
  else if (length >= 15 && length <= 50) score += 15;

  // 2. 메인 키워드 포함 여부
  const mainKeywords = extractKeywords(mainTopic);
  const hasMainKeyword = mainKeywords.some(kw => subheading.includes(kw));
  if (hasMainKeyword) score += 30;

  // 3. 이모지 사용 (1개)
  const emojiCount = (subheading.match(/[⚠️💡🎯📌🔍✅❌]/g) || []).length;
  if (emojiCount === 1) score += 15;
  else if (emojiCount > 1) score -= 5; // 과다 사용 감점

  // 4. 질문형 또는 호기심 유발 패턴
  if (subheading.includes('?') || subheading.includes('왜') || subheading.includes('어떻게')) {
    score += 20;
  }
  if (subheading.includes('이것만') || subheading.includes('놓치는') || subheading.includes('의외의')) {
    score += 10;
  }

  // 5. 숫자 포함 (구체성)
  if (/\d+가지|\d+개|\d+단계/.test(subheading)) {
    score += 10;
  }

  return Math.min(100, score);
}

/**
 * 소제목 최적화 추천
 */
export function optimizeSubheading(
  currentSubheading: string,
  mainTopic: string,
  context?: { category?: string; keywords?: string }
): SubheadingSuggestion {
  const intent = analyzeSearchIntent(currentSubheading);
  const mainKeywords = extractKeywords(mainTopic);
  const currentScore = calculateSeoScore(currentSubheading, mainTopic);

  // 개선 제안 생성
  let optimized = currentSubheading;
  let reason = '';
  let pattern: SubheadingSuggestion['pattern'] = 'question';

  // 메인 키워드가 없으면 추가
  if (!mainKeywords.some(kw => currentSubheading.includes(kw))) {
    optimized = `${mainKeywords[0]} ${currentSubheading}`;
    reason = `메인 키워드 "${mainKeywords[0]}" 추가`;
  }

  // 너무 짧으면 질문형으로 변환
  if (currentSubheading.length < 15) {
    optimized = `${currentSubheading}, 왜 생기는 걸까요?`;
    pattern = 'question';
    reason = reason ? `${reason}, 질문형으로 변환` : '질문형으로 변환하여 검색 의도 매칭';
  }

  // 이모지가 없으면 추가
  if (!/[⚠️💡🎯📌🔍✅❌]/.test(optimized)) {
    const emojiMap: Record<string, string> = {
      symptom: '⚠️',
      cause: '🔍',
      treatment: '💡',
      diagnosis: '📌',
      prevention: '✅'
    };
    const emoji = emojiMap[intent] || '🎯';
    optimized = `${emoji} ${optimized}`;
    reason = reason ? `${reason}, SEO 최적화 이모지 추가` : 'SEO 최적화 이모지 추가';
  }

  const optimizedScore = calculateSeoScore(optimized, mainTopic);

  return {
    original: currentSubheading,
    optimized: optimized,
    reason: reason || '이미 최적화되어 있습니다',
    seoScore: optimizedScore,
    pattern: pattern
  };
}

/**
 * 전체 소제목 리스트 최적화
 */
export function optimizeAllSubheadings(
  subheadings: string[],
  mainTopic: string,
  context?: { category?: string; keywords?: string }
): SubheadingOptimizationResult {
  const suggestions = subheadings.map(sh =>
    optimizeSubheading(sh, mainTopic, context)
  );

  const totalSeoScore = suggestions.reduce((sum, s) => sum + s.seoScore, 0) / suggestions.length;

  const improvements: string[] = [];

  if (totalSeoScore < 70) {
    improvements.push('소제목에 메인 키워드를 더 포함시켜보세요');
  }

  const questionCount = suggestions.filter(s => s.pattern === 'question').length;
  if (questionCount === 0) {
    improvements.push('질문형 소제목을 1~2개 추가하면 검색 매칭률이 높아집니다');
  }

  const emojiCount = suggestions.filter(s => /[⚠️💡🎯📌🔍✅]/.test(s.optimized)).length;
  if (emojiCount < suggestions.length * 0.5) {
    improvements.push('각 소제목에 관련 이모지를 추가하면 클릭률이 높아집니다');
  }

  return {
    suggestions,
    totalSeoScore,
    improvements
  };
}

/**
 * 자동 소제목 생성 (주제 기반)
 */
export function generateSubheadings(
  mainTopic: string,
  count: number = 5,
  category?: string
): string[] {
  const keywords = extractKeywords(mainTopic);
  const mainKeyword = keywords[0] || mainTopic.substring(0, 5);

  const templates = [
    `🎯 ${mainKeyword}란?`,
    `⚠️ ${mainKeyword} 주요 증상`,
    `🔍 ${mainKeyword} 원인은?`,
    `💡 ${mainKeyword} 관리 방법`,
    `✅ 이런 경우 확인이 필요합니다`,
    `📌 ${mainKeyword}, 이것만 기억하세요`,
    `❓ ${mainKeyword}, 자주 묻는 질문`
  ];

  return templates.slice(0, count);
}
