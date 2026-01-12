/**
 * 콘텐츠 최적화 헬퍼 함수
 * geminiService.ts에서 쉽게 사용할 수 있도록 통합된 인터페이스 제공
 */

import { optimizePrompt, estimateTokens } from './promptOptimizer';
import { generateHumanWritingPrompt, detectAiSmell } from './humanWritingPrompts';
import { autoFixMedicalLaw, generateFixReport } from './autoMedicalLawFixer';
import { contentCache } from './contentCache';
import type { ContentCategory } from '../types';

/**
 * 프롬프트 준비 (최적화 + 사람같은 글쓰기 규칙 추가)
 *
 * @example
 * const optimizedPrompt = prepareOptimizedPrompt(
 *   originalPrompt,
 *   'internal_medicine',
 *   'empathy'
 * );
 */
export function prepareOptimizedPrompt(
  originalPrompt: string,
  category?: ContentCategory,
  tone: 'empathy' | 'professional' | 'simple' | 'informative' = 'empathy'
): {
  prompt: string;
  originalTokens: number;
  optimizedTokens: number;
  savedTokens: number;
  savedPercentage: number;
} {
  // 1. 프롬프트 최적화
  const optimized = optimizePrompt(originalPrompt, {
    maxLength: 3000,
    removeExamples: false,
    compressInstructions: true
  });

  // 2. 사람같은 글쓰기 규칙 추가
  const humanRules = generateHumanWritingPrompt(category, tone);

  // 3. 결합
  const finalPrompt = optimized + '\n\n' + humanRules;

  // 4. 토큰 계산
  const originalTokens = estimateTokens(originalPrompt);
  const optimizedTokens = estimateTokens(finalPrompt);
  const savedTokens = Math.max(0, originalTokens - optimizedTokens);
  const savedPercentage = originalTokens > 0
    ? Math.round((savedTokens / originalTokens) * 100)
    : 0;

  console.log('📊 프롬프트 최적화 결과:');
  console.log(`  원본: ${originalTokens} 토큰`);
  console.log(`  최적화: ${optimizedTokens} 토큰`);
  console.log(`  절약: ${savedTokens} 토큰 (${savedPercentage}%)`);

  return {
    prompt: finalPrompt,
    originalTokens,
    optimizedTokens,
    savedTokens,
    savedPercentage
  };
}

/**
 * AI 생성 후 자동 수정 (의료광고법 + AI 냄새 제거)
 *
 * @example
 * const result = postProcessContent(aiGeneratedContent);
 * console.log(result.fixedText);
 * console.log(result.report);
 */
export function postProcessContent(generatedContent: string): {
  originalText: string;
  fixedText: string;
  changeCount: number;
  aiSmellScore: number;
  report: string;
  passed: boolean;
} {
  // 1. 의료광고법 자동 수정
  const fixResult = autoFixMedicalLaw(generatedContent);

  // 2. AI 냄새 감지
  const aiSmell = detectAiSmell(fixResult.fixedText);

  // 3. 리포트 생성
  const report = generateFixReport(fixResult);

  // 4. 통과 여부 (심각한 변경이 없으면 통과)
  const criticalChanges = fixResult.changes.filter(
    c => c.type === 'remove' || c.reason.includes('critical')
  ).length;
  const passed = criticalChanges === 0 && aiSmell.score < 50;

  console.log('🔧 콘텐츠 후처리 결과:');
  console.log(`  수정 항목: ${fixResult.changes.length}개`);
  console.log(`  AI 냄새 점수: ${aiSmell.score}/100`);
  console.log(`  통과 여부: ${passed ? '✅' : '⚠️'}`);

  return {
    originalText: fixResult.originalText,
    fixedText: fixResult.fixedText,
    changeCount: fixResult.changes.length,
    aiSmellScore: aiSmell.score,
    report,
    passed
  };
}

/**
 * 전체 워크플로우 (프롬프트 최적화 → AI 생성 → 후처리)
 *
 * @example
 * const workflow = createOptimizedWorkflow();
 *
 * // 1단계: 프롬프트 준비
 * const { prompt } = workflow.preparePrompt(originalPrompt, 'internal_medicine');
 *
 * // 2단계: AI 생성 (직접 호출)
 * const generated = await ai.generate(prompt);
 *
 * // 3단계: 후처리
 * const result = workflow.postProcess(generated);
 */
export function createOptimizedWorkflow() {
  const stats = {
    totalTokensSaved: 0,
    totalContentProcessed: 0,
    totalAiSmellReduced: 0
  };

  return {
    /**
     * 1단계: 프롬프트 준비
     */
    preparePrompt(
      originalPrompt: string,
      category?: ContentCategory,
      tone?: 'empathy' | 'professional' | 'simple' | 'informative'
    ) {
      const result = prepareOptimizedPrompt(originalPrompt, category, tone);
      stats.totalTokensSaved += result.savedTokens;
      return result;
    },

    /**
     * 3단계: 후처리
     */
    postProcess(generatedContent: string) {
      const result = postProcessContent(generatedContent);
      stats.totalContentProcessed++;
      stats.totalAiSmellReduced += result.aiSmellScore;
      return result;
    },

    /**
     * 통계 확인
     */
    getStats() {
      return {
        ...stats,
        averageAiSmell: stats.totalContentProcessed > 0
          ? Math.round(stats.totalAiSmellReduced / stats.totalContentProcessed)
          : 0
      };
    }
  };
}

/**
 * 간단한 사용법 (한 번에 모두 처리)
 *
 * @example
 * const result = await optimizeAndGenerate(
 *   originalPrompt,
 *   (prompt) => ai.generate(prompt), // AI 생성 함수
 *   'internal_medicine'
 * );
 */
export async function optimizeAndGenerate<T>(
  originalPrompt: string,
  generateFn: (optimizedPrompt: string) => Promise<T>,
  category?: ContentCategory,
  tone?: 'empathy' | 'professional' | 'simple' | 'informative'
): Promise<{
  result: T;
  stats: {
    originalTokens: number;
    optimizedTokens: number;
    savedTokens: number;
  };
}> {
  // 1. 프롬프트 최적화
  const { prompt, originalTokens, optimizedTokens, savedTokens } = prepareOptimizedPrompt(
    originalPrompt,
    category,
    tone
  );

  // 2. AI 생성
  const result = await generateFn(prompt);

  return {
    result,
    stats: {
      originalTokens,
      optimizedTokens,
      savedTokens
    }
  };
}

/**
 * 캐시 확인 및 활용
 */
export function getCachedOrGenerate<T>(
  cacheKey: string,
  generateFn: () => Promise<T>,
  ttlHours: number = 12
): Promise<T> {
  // TODO: promptResultCache 활용
  // 현재는 generateFn만 실행
  return generateFn();
}
