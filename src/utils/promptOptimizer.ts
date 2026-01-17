/**
 * 프롬프트 최적화 유틸리티
 * 토큰을 절약하면서 품질을 유지하는 프롬프트 최적화
 */

interface OptimizationOptions {
  maxLength?: number;
  removeExamples?: boolean;
  compressInstructions?: boolean;
}

/**
 * 중복된 지시사항 제거
 */
export function removeDuplicateInstructions(prompt: string): string {
  const lines = prompt.split('\n').filter(line => line.trim());
  const seen = new Set<string>();
  const uniqueLines: string[] = [];

  for (const line of lines) {
    const normalized = line.trim().toLowerCase();
    // 비슷한 의미의 문장들을 하나로 통합
    const key = normalized.replace(/[^가-힣a-z0-9]/g, '');

    if (!seen.has(key) && key.length > 5) {
      seen.add(key);
      uniqueLines.push(line);
    }
  }

  return uniqueLines.join('\n');
}

/**
 * 지시사항 압축 (의미 유지하면서 간결하게)
 */
export function compressInstructions(prompt: string): string {
  let compressed = prompt;

  // 장황한 표현을 간결하게
  const replacements: [RegExp, string][] = [
    [/반드시\s+(.+?)\s*해야\s*합니다/g, '$1'],
    [/~에\s*대해서?\s*/g, ''],
    [/~라고\s*할\s*수\s*있습니다/g, ''],
    [/~것이\s*중요합니다/g, ''],
    [/주의해\s*주세요|주의하세요/g, '주의'],
    [/작성해\s*주세요|작성하세요/g, '작성'],
    [/사용해\s*주세요|사용하세요/g, '사용'],
    [/포함해\s*주세요|포함하세요/g, '포함'],
    [/\s{2,}/g, ' '], // 연속된 공백 제거
    [/\n{3,}/g, '\n\n'], // 연속된 줄바꿈 제거
  ];

  for (const [pattern, replacement] of replacements) {
    compressed = compressed.replace(pattern, replacement);
  }

  return compressed.trim();
}

/**
 * 우선순위 재정렬 (중요한 지시사항만)
 */
export function prioritizeInstructions(prompt: string): string {
  const lines = prompt.split('\n');
  const prioritized: string[] = [];
  const normal: string[] = [];
  const optional: string[] = [];

  // 우선순위 키워드
  const highPriority = ['의료광고법', '금지', '필수', '반드시', '출처', '공공기관'];
  const lowPriority = ['예를 들어', '참고', '추가', '선택', '가능하면'];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (highPriority.some(kw => trimmed.includes(kw))) {
      prioritized.push(line);
    } else if (lowPriority.some(kw => trimmed.includes(kw))) {
      optional.push(line);
    } else {
      normal.push(line);
    }
  }

  // 우선순위 순으로 재정렬 (선택사항은 제거하여 토큰 절약)
  return [...prioritized, ...normal].join('\n');
}

/**
 * 프롬프트 최적화 (메인 함수)
 */
export function optimizePrompt(
  prompt: string,
  options: OptimizationOptions = {}
): string {
  const {
    maxLength,
    removeExamples = false,
    compressInstructions: shouldCompress = true
  } = options;

  let optimized = prompt;

  // 1. 예시 제거 (옵션)
  if (removeExamples) {
    optimized = optimized.replace(/\[예시\][\s\S]*?\[\/예시\]/g, '');
    optimized = optimized.replace(/예를 들어[\s\S]*?\n\n/g, '');
  }

  // 2. 중복 제거
  optimized = removeDuplicateInstructions(optimized);

  // 3. 압축
  if (shouldCompress) {
    optimized = compressInstructions(optimized);
  }

  // 4. 우선순위 재정렬
  optimized = prioritizeInstructions(optimized);

  // 5. 길이 제한
  if (maxLength && optimized.length > maxLength) {
    optimized = optimized.substring(0, maxLength) + '...';
  }

  return optimized;
}

/**
 * 토큰 추정 (대략적)
 * - 한글: 1글자 ≈ 1.5 토큰
 * - 영어: 1단어 ≈ 1.3 토큰
 */
export function estimateTokens(text: string): number {
  const koreanChars = (text.match(/[가-힣]/g) || []).length;
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
  const others = text.length - koreanChars - englishWords;

  return Math.ceil(
    koreanChars * 1.5 +
    englishWords * 1.3 +
    others * 0.5
  );
}

/**
 * 최적화 효과 보고
 */
export function getOptimizationReport(
  originalPrompt: string,
  optimizedPrompt: string
): {
  originalLength: number;
  optimizedLength: number;
  savedLength: number;
  savedPercentage: number;
  estimatedTokensSaved: number;
} {
  const originalLength = originalPrompt.length;
  const optimizedLength = optimizedPrompt.length;
  const savedLength = originalLength - optimizedLength;
  const savedPercentage = Math.round((savedLength / originalLength) * 100);

  const originalTokens = estimateTokens(originalPrompt);
  const optimizedTokens = estimateTokens(optimizedPrompt);
  const estimatedTokensSaved = originalTokens - optimizedTokens;

  return {
    originalLength,
    optimizedLength,
    savedLength,
    savedPercentage,
    estimatedTokensSaved
  };
}
