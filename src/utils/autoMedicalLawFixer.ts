/**
 * 의료광고법 자동 수정 시스템
 * AI가 생성한 글을 자동으로 의료광고법에 맞게 수정
 */

// 의료광고법 금지 패턴
const PROHIBITED_PATTERNS = {
  // 기존 코드에서 사용되는 패턴 정의
  suspicion: /의심/g,
  judgment: /판단/g,
  possibility: /가능성/g,
  // 비교 광고 금지 패턴
  comparison: ['최고', '최상', '가장', '유일', '독보적', '업계 1위', '최초', '타 병원보다', '경쟁 병원'],
  // 환자 후기 패턴  
  testimonial: ['치료 후기', '환자 후기', '치료 사례', '완치 사례', '성공 사례', '치료 경험담'],
};

// 신뢰할 수 있는 출처 (사용하지 않으면 빈 배열)
const TRUSTED_SOURCES: string[] = [];

export interface FixResult {
  originalText: string;
  fixedText: string;
  changes: Array<{
    type: 'replace' | 'remove' | 'add_source';
    original: string;
    fixed: string;
    reason: string;
  }>;
  autoFixSuccessRate: number; // 0-100
}

/**
 * 과장 표현 자동 완화
 */
const EXAGGERATION_REPLACEMENTS: Record<string, string> = {
  // 완치 관련
  '완치': '증상 개선',
  '완전히 치료': '치료 가능',
  '완벽하게 치료': '효과적으로 치료',
  '근본적으로 치료': '원인을 치료',
  '100% 치료': '높은 치료율',

  // 효과 과장
  '즉각적인 효과': '일정 시간 후 효과',
  '즉시 효과': '빠른 효과',
  '바로 효과': '효과',
  '당장 효과': '효과',
  '기적적인': '효과적인',
  '놀라운 효과': '좋은 효과',
  '혁명적인': '새로운',
  '획기적인': '효과적인',

  // 최상급 표현
  '최고의 치료': '효과적인 치료 방법 중 하나',
  '최상의 치료': '우수한 치료',
  '최강의': '효과적인',
  '유일한 치료': '대표적인 치료',
  '독보적인': '효과적인',

  // 100% 주장
  '100% 안전': '안전성이 입증된',
  '100% 효과': '높은 효과',
  '완벽하게 안전': '안전한',
  '전혀 위험이 없': '안전성이 검증된',

  // 부작용 없음 주장
  '부작용이 전혀 없': '부작용이 적은',
  '부작용 없는': '부작용이 적은',
  '전혀 아프지 않': '통증이 적은',
  '무통': '저통증',

  // 비교 표현
  '타 병원보다': '',
  '다른 곳보다': '',
  '경쟁 병원보다': '',
  '업계 최초': '새로운',
  '국내 최초': '새로운',
};

/**
 * 과장 표현 자동 수정
 */
export function fixExaggeration(text: string): {
  fixed: string;
  changes: FixResult['changes'];
} {
  let fixed = text;
  const changes: FixResult['changes'] = [];

  // 정확한 매칭을 위해 긴 패턴부터 처리
  const sortedPatterns = Object.entries(EXAGGERATION_REPLACEMENTS)
    .sort((a, b) => b[0].length - a[0].length);

  for (const [original, replacement] of sortedPatterns) {
    if (fixed.includes(original)) {
      fixed = fixed.replace(new RegExp(original, 'g'), replacement);
      changes.push({
        type: 'replace',
        original,
        fixed: replacement,
        reason: '의료광고법: 과장 표현 완화'
      });
    }
  }

  return { fixed, changes };
}

/**
 * 숫자/통계 완전 제거 (gpt52-prompts-staged.ts P1 규칙과 일관성 유지)
 * ⚠️ 숫자는 출처 추가가 아닌 완전 대체 필요!
 */
export function fixMissingSource(text: string): {
  fixed: string;
  changes: FixResult['changes'];
} {
  let fixed = text;
  const changes: FixResult['changes'] = [];

  // 🚨 숫자 완전 제거/대체 (P1 규칙)
  const numberReplacements: [RegExp, string, string][] = [
    [/(\d+(?:\.\d+)?%)/g, '상당수', '퍼센트 수치 금지'],
    [/(\d+(?:,\d+)*명)/g, '많은 분들이', '인원 수치 금지'],
    [/(\d+(?:,\d+)*건)/g, '여러 사례에서', '건수 수치 금지'],
    [/(\d+배)/g, '상당히 높은', '배수 표현 금지'],
    [/(\d+여\s*종)/g, '다양한', '수량 표현 금지'],
    [/(\d+~\d+일)/g, '며칠', '기간 수치 금지'],
    [/(\d+주)/g, '일정 기간', '기간 수치 금지'],
    [/(\d+시간)/g, '일정 시간', '시간 수치 금지'],
    [/(\d+대)/g, '중년층/젊은 분들', '연령대 수치 금지'],
  ];

  for (const [pattern, replacement, reason] of numberReplacements) {
    const matches = Array.from(fixed.matchAll(pattern));
    for (const match of matches) {
      fixed = fixed.replace(match[0], replacement);
      changes.push({
        type: 'replace',
        original: match[0],
        fixed: replacement,
        reason: `의료광고법: ${reason}`
      });
    }
  }

  return { fixed, changes };
}

/**
 * 비교 광고 제거
 */
export function removeComparison(text: string): {
  fixed: string;
  changes: FixResult['changes'];
} {
  let fixed = text;
  const changes: FixResult['changes'] = [];

  // 비교 표현 제거
  for (const pattern of PROHIBITED_PATTERNS.comparison) {
    if (fixed.includes(pattern)) {
      // 문장 전체 제거 (비교 표현이 포함된)
      const sentences = fixed.split(/[.!?]\s*/);
      const filteredSentences = sentences.filter(s => !s.includes(pattern));

      if (filteredSentences.length < sentences.length) {
        fixed = filteredSentences.join('. ') + '.';
        changes.push({
          type: 'remove',
          original: pattern,
          fixed: '(제거됨)',
          reason: '의료광고법: 비교 광고 금지'
        });
      }
    }
  }

  return { fixed, changes };
}

/**
 * 환자 후기/사례 제거 또는 경고
 */
export function handleTestimonials(text: string): {
  fixed: string;
  changes: FixResult['changes'];
} {
  let fixed = text;
  const changes: FixResult['changes'] = [];

  for (const pattern of PROHIBITED_PATTERNS.testimonial) {
    if (fixed.includes(pattern)) {
      // 후기/사례 문장에 경고 추가
      const replacement = `[의료광고법 주의: 환자 후기 사용 제한]`;

      changes.push({
        type: 'replace',
        original: pattern,
        fixed: replacement,
        reason: '의료광고법: 환자 후기 사용 제한'
      });
    }
  }

  return { fixed, changes };
}

/**
 * AI 냄새 제거 (부수적 개선)
 */
export function removeAiSmell(text: string): {
  fixed: string;
  changes: FixResult['changes'];
} {
  let fixed = text;
  const changes: FixResult['changes'] = [];

  // 🚨 gpt52-prompts-staged.ts와 일관성 유지
  const aiPatterns: Record<string, string> = {
    '에 대해 알아보겠습니다': '',
    '에 대해 살펴보겠습니다': '',
    '라고 할 수 있습니다': '경우가 있습니다',
    '것으로 나타났습니다': '경향을 보입니다',
    '것으로 알려져 있습니다': '언급되기도 합니다',
    '여러분': '', // 🚨 '환자분들' 대신 삭제 (환자 표현 금지!)
    '환자분들': '~을 겪는 분들', // 환자 표현 대체
    '환자': '~을 겪는 분',
  };

  for (const [original, replacement] of Object.entries(aiPatterns)) {
    if (fixed.includes(original)) {
      fixed = fixed.replace(new RegExp(original, 'g'), replacement);
      changes.push({
        type: 'replace',
        original,
        fixed: replacement,
        reason: 'AI 특유 표현 제거'
      });
    }
  }

  return { fixed, changes };
}

/**
 * 종합 자동 수정 실행
 */
export function autoFixMedicalLaw(content: string): FixResult {
  const originalText = content;
  let fixedText = content;
  const allChanges: FixResult['changes'] = [];

  // 1. 과장 표현 수정
  const exaggerationResult = fixExaggeration(fixedText);
  fixedText = exaggerationResult.fixed;
  allChanges.push(...exaggerationResult.changes);

  // 2. 출처 추가
  const sourceResult = fixMissingSource(fixedText);
  fixedText = sourceResult.fixed;
  allChanges.push(...sourceResult.changes);

  // 3. 비교 광고 제거
  const comparisonResult = removeComparison(fixedText);
  fixedText = comparisonResult.fixed;
  allChanges.push(...comparisonResult.changes);

  // 4. 환자 후기 처리
  const testimonialResult = handleTestimonials(fixedText);
  fixedText = testimonialResult.fixed;
  allChanges.push(...testimonialResult.changes);

  // 5. AI 냄새 제거
  const aiSmellResult = removeAiSmell(fixedText);
  fixedText = aiSmellResult.fixed;
  allChanges.push(...aiSmellResult.changes);

  // 성공률 계산
  const successRate = allChanges.length > 0
    ? Math.round((allChanges.filter(c => c.fixed !== '(제거됨)').length / allChanges.length) * 100)
    : 100;

  return {
    originalText,
    fixedText,
    changes: allChanges,
    autoFixSuccessRate: successRate
  };
}

/**
 * 수정 전후 비교 리포트 생성
 */
export function generateFixReport(result: FixResult): string {
  const { changes, autoFixSuccessRate } = result;

  if (changes.length === 0) {
    return '✅ 의료광고법 위반사항이 발견되지 않았습니다.';
  }

  let report = `📊 자동 수정 완료 (성공률: ${autoFixSuccessRate}%)\n\n`;
  report += `총 ${changes.length}개 항목 수정:\n\n`;

  const groupedChanges = changes.reduce((acc, change) => {
    if (!acc[change.type]) acc[change.type] = [];
    acc[change.type].push(change);
    return acc;
  }, {} as Record<string, FixResult['changes']>);

  for (const [type, items] of Object.entries(groupedChanges)) {
    const typeLabel = {
      replace: '🔄 표현 수정',
      remove: '🗑️ 제거',
      add_source: '📎 출처 추가 필요'
    }[type] || type;

    report += `${typeLabel} (${items.length}건):\n`;
    for (const item of items.slice(0, 5)) { // 최대 5개만 표시
      report += `  • "${item.original}" → "${item.fixed}"\n`;
      report += `    이유: ${item.reason}\n`;
    }
    if (items.length > 5) {
      report += `  ... 외 ${items.length - 5}건\n`;
    }
    report += '\n';
  }

  return report;
}
