/**
 * 고급 팩트체크 시스템
 * 의료광고법 준수를 위한 사실 검증 강화
 */

export interface FactCheckRule {
  type: 'prohibited' | 'requires_source' | 'comparison' | 'testimonial' | 'effect_claim';
  severity: 'critical' | 'warning' | 'info';
  description: string;
}

export interface FactCheckResult {
  passed: boolean;
  violations: Array<{
    rule: FactCheckRule;
    text: string;
    suggestion?: string;
  }>;
  score: number; // 0-100
  recommendations: string[];
}

/**
 * 강화된 의료광고법 규칙
 */
export const ENHANCED_MEDICAL_LAW_RULES: Record<string, FactCheckRule> = {
  // 1. 효과/효능 관련 금지어 (가장 심각)
  PROHIBITED_EFFECTS: {
    type: 'prohibited',
    severity: 'critical',
    description: '의료광고법 위반: 효과/효능 과장 표현'
  },

  // 2. 통계/수치 출처 필수
  REQUIRES_SOURCE_FOR_STATS: {
    type: 'requires_source',
    severity: 'critical',
    description: '통계 데이터에 출처 표기 필수'
  },

  // 3. 비교 광고 금지
  COMPARISON_AD: {
    type: 'comparison',
    severity: 'critical',
    description: '다른 병원/치료법과의 비교 금지'
  },

  // 4. 환자 후기/사례 제한
  TESTIMONIAL_RESTRICTION: {
    type: 'testimonial',
    severity: 'warning',
    description: '환자 후기 사용 제한'
  },

  // 5. 치료 효과 주장
  EFFECT_CLAIM: {
    type: 'effect_claim',
    severity: 'warning',
    description: '치료 효과 주장 시 근거 필요'
  }
};

/**
 * 금지 표현 패턴 (확장)
 */
export const PROHIBITED_PATTERNS = {
  // 완치/치료 관련
  cure: [
    '완치', '완전 치료', '완벽한 치료',
    '100% 치료', '영구 치료', '근본 치료'
  ],

  // 효과 과장
  exaggeration: [
    '즉각적', '즉시', '바로', '당장',
    '기적', '놀라운', '혁명적', '획기적',
    '100%', '완벽', '최고', '최상', '최강',
    '유일', '독보적', '압도적'
  ],

  // 비교 광고
  comparison: [
    '타 병원', '다른 병원', '경쟁 병원',
    '~보다 좋은', '~보다 효과적',
    '업계 최초', '국내 최초', '세계 최초'
  ],

  // 부작용 없음 주장
  no_side_effects: [
    '부작용 없는', '부작용이 전혀 없',
    '100% 안전', '완전히 안전',
    '전혀 아프지 않은', '무통'
  ],

  // 후기/사례
  testimonial: [
    '환자 후기', '실제 사례', '치료 사례',
    '~님의 경험', '~씨의 이야기'
  ]
};

/**
 * 공공기관 출처 목록 (화이트리스트)
 */
export const TRUSTED_SOURCES = [
  'health.kdca.go.kr',
  'kdca.go.kr',
  'mohw.go.kr',
  'nhis.or.kr',
  'hira.or.kr',
  'mfds.go.kr',
  'who.int',
  'cdc.gov',
  'nih.gov',
  'pubmed',
  '질병관리청',
  '보건복지부',
  '건강보험심사평가원',
  '식품의약품안전처',
  '대한의학회',
  '대한의사협회'
];

/**
 * 통계/수치 패턴 감지
 */
export function detectStatistics(text: string): Array<{ stat: string; hasSource: boolean }> {
  // 숫자 + % 또는 숫자 + 단위
  const statPatterns = [
    /(\d+(?:\.\d+)?%)/g,
    /(\d+(?:,\d+)*(?:\.\d+)?(?:명|건|례|배|배수|회|년|개월|일))/g,
    /(\d+(?:\.\d+)?배)/g
  ];

  const results: Array<{ stat: string; hasSource: boolean }> = [];

  for (const pattern of statPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      for (const stat of matches) {
        // 해당 통계 주변에 출처가 있는지 확인
        const context = getContext(text, stat, 100);
        const hasSource = TRUSTED_SOURCES.some(source =>
          context.includes(source) || context.includes('출처:')
        );

        results.push({ stat, hasSource });
      }
    }
  }

  return results;
}

/**
 * 텍스트에서 특정 문자열 주변 컨텍스트 가져오기
 */
function getContext(text: string, target: string, radius: number): string {
  const index = text.indexOf(target);
  if (index === -1) return '';

  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + target.length + radius);

  return text.substring(start, end);
}

/**
 * 비교 광고 감지
 */
export function detectComparison(text: string): string[] {
  const comparisons: string[] = [];

  for (const pattern of PROHIBITED_PATTERNS.comparison) {
    if (text.includes(pattern)) {
      comparisons.push(pattern);
    }
  }

  // 추가 패턴: "A보다 B" 형태
  const comparisonRegex = /(.{0,20})(보다|에 비해|대비|비교해|비교하면)(.{0,20})(좋|우수|효과|뛰어)/g;
  const matches = text.match(comparisonRegex);
  if (matches) {
    comparisons.push(...matches);
  }

  return comparisons;
}

/**
 * 종합 팩트체크 실행
 */
export function performAdvancedFactCheck(content: string): FactCheckResult {
  const violations: FactCheckResult['violations'] = [];

  // 1. 금지 표현 체크
  for (const [category, patterns] of Object.entries(PROHIBITED_PATTERNS)) {
    for (const pattern of patterns) {
      if (content.includes(pattern)) {
        violations.push({
          rule: ENHANCED_MEDICAL_LAW_RULES.PROHIBITED_EFFECTS,
          text: pattern,
          suggestion: getSuggestion(pattern, category)
        });
      }
    }
  }

  // 2. 통계 출처 체크
  const stats = detectStatistics(content);
  for (const { stat, hasSource } of stats) {
    if (!hasSource) {
      violations.push({
        rule: ENHANCED_MEDICAL_LAW_RULES.REQUIRES_SOURCE_FOR_STATS,
        text: stat,
        suggestion: `"${stat}" 통계에 출처를 추가하세요. 예: (출처: 질병관리청)`
      });
    }
  }

  // 3. 비교 광고 체크
  const comparisons = detectComparison(content);
  for (const comparison of comparisons) {
    violations.push({
      rule: ENHANCED_MEDICAL_LAW_RULES.COMPARISON_AD,
      text: comparison,
      suggestion: '비교 표현을 제거하고 자체 정보만 제공하세요.'
    });
  }

  // 4. 점수 계산 (위반 건수와 심각도 고려)
  const criticalCount = violations.filter(v => v.rule.severity === 'critical').length;
  const warningCount = violations.filter(v => v.rule.severity === 'warning').length;

  const score = Math.max(0, 100 - (criticalCount * 20) - (warningCount * 10));

  // 5. 권장사항 생성
  const recommendations = generateRecommendations(violations);

  return {
    passed: criticalCount === 0,
    violations,
    score,
    recommendations
  };
}

/**
 * 위반 항목에 대한 대체 표현 제안
 */
function getSuggestion(prohibited: string, category: string): string {
  const suggestions: Record<string, Record<string, string>> = {
    cure: {
      '완치': '증상 개선 또는 관리',
      '완전 치료': '치료 가능',
      '근본 치료': '원인 치료'
    },
    exaggeration: {
      '즉각적': '일정 시간 후',
      '100%': '높은 비율로',
      '최고': '효과적인 방법 중 하나',
      '유일': '대표적인'
    },
    no_side_effects: {
      '부작용 없는': '부작용이 적은',
      '100% 안전': '안전성이 입증된'
    }
  };

  return suggestions[category]?.[prohibited] || '객관적 표현으로 수정';
}

/**
 * 권장사항 생성
 */
function generateRecommendations(
  violations: FactCheckResult['violations']
): string[] {
  const recommendations: string[] = [];

  if (violations.length === 0) {
    return ['의료광고법 준수 양호'];
  }

  const hasCritical = violations.some(v => v.rule.severity === 'critical');
  if (hasCritical) {
    recommendations.push('⚠️ 심각한 위반사항이 있습니다. 즉시 수정하세요.');
  }

  const missingSourceCount = violations.filter(
    v => v.rule.type === 'requires_source'
  ).length;
  if (missingSourceCount > 0) {
    recommendations.push(
      `📊 ${missingSourceCount}개의 통계에 출처를 추가하세요. (질병관리청, 보건복지부 등)`
    );
  }

  const prohibitedCount = violations.filter(
    v => v.rule.type === 'prohibited'
  ).length;
  if (prohibitedCount > 0) {
    recommendations.push(
      `🚫 ${prohibitedCount}개의 금지 표현을 객관적 표현으로 변경하세요.`
    );
  }

  return recommendations;
}

/**
 * 공공기관 출처 확인
 */
export function verifyPublicSource(source: string): boolean {
  return TRUSTED_SOURCES.some(trusted =>
    source.toLowerCase().includes(trusted.toLowerCase())
  );
}
