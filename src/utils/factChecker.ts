/**
 * 의료 정보 팩트 체킹 시스템
 * - 의학적 주장(claim) 자동 추출
 * - 신뢰할 수 있는 정보원과 교차 검증
 * - 정보 정확성 점수 계산
 */

// ============================================
// 1. 타입 정의
// ============================================

export interface MedicalClaim {
  text: string; // 주장 텍스트
  type: 'symptom' | 'treatment' | 'cause' | 'statistic' | 'general'; // 주장 유형
  confidence: number; // 주장 추출 신뢰도 (0-100)
  position: { start: number; end: number }; // 텍스트 내 위치
}

export interface FactCheckSource {
  url: string;
  domain: string;
  credibilityScore: number; // 0-100
  category: 'government' | 'academic' | 'international' | 'unknown';
  lastUpdated?: Date;
  snippet: string; // 관련 내용 발췌
}

export interface FactCheckResult {
  claim: MedicalClaim;
  verified: boolean; // 검증 성공 여부
  sources: FactCheckSource[]; // 검증에 사용된 출처
  confidence: number; // 검증 신뢰도 (0-100)
  notes: string; // 검증 결과 설명
  recommendation: 'safe' | 'warning' | 'danger'; // 안전성 등급
}

export interface MedicalFactCheckReport {
  totalClaims: number; // 추출된 총 주장 수
  verifiedClaims: number; // 검증된 주장 수
  unverifiedClaims: number; // 검증 실패 주장 수
  accuracyScore: number; // 정확성 점수 (0-100)
  results: FactCheckResult[]; // 개별 검증 결과
  overallRecommendation: 'safe' | 'warning' | 'danger';
  suggestions: string[]; // 개선 제안
}

// ============================================
// 2. 정보원 신뢰도 데이터베이스
// ============================================

export const SOURCE_CREDIBILITY: Record<string, { score: number; category: FactCheckSource['category'] }> = {
  // 정부기관 (최고 신뢰도)
  'health.kdca.go.kr': { score: 100, category: 'government' },
  'kdca.go.kr': { score: 100, category: 'government' },
  'mohw.go.kr': { score: 95, category: 'government' },
  'nhis.or.kr': { score: 90, category: 'government' },
  'hira.or.kr': { score: 90, category: 'government' },
  'mfds.go.kr': { score: 90, category: 'government' },

  // 국제 기관 (높은 신뢰도)
  'who.int': { score: 85, category: 'international' },
  'cdc.gov': { score: 85, category: 'international' },
  'nih.gov': { score: 85, category: 'international' },

  // 학술 기관 (높은 신뢰도)
  'pubmed.ncbi.nlm.nih.gov': { score: 80, category: 'academic' },
  'jamanetwork.com': { score: 80, category: 'academic' },
  'nejm.org': { score: 80, category: 'academic' },
  'thelancet.com': { score: 80, category: 'academic' },

  // 국내 학회 (높은 신뢰도)
  '.or.kr': { score: 75, category: 'academic' }, // 대한OO학회 등
};

/**
 * 도메인 신뢰도 점수 계산
 */
export function getSourceCredibility(url: string): { score: number; category: FactCheckSource['category'] } {
  try {
    const domain = new URL(url).hostname.replace('www.', '');

    // 정확히 일치하는 도메인 찾기
    if (SOURCE_CREDIBILITY[domain]) {
      return SOURCE_CREDIBILITY[domain];
    }

    // 부분 일치 검색 (.or.kr 등)
    for (const [key, value] of Object.entries(SOURCE_CREDIBILITY)) {
      if (domain.includes(key) || key.includes(domain)) {
        return value;
      }
    }

    // 기본값 (신뢰도 낮음)
    return { score: 30, category: 'unknown' };
  } catch {
    return { score: 0, category: 'unknown' };
  }
}

// ============================================
// 3. 의학적 주장(Claim) 추출
// ============================================

/**
 * 텍스트에서 의학적 주장 추출
 */
export function extractMedicalClaims(html: string): MedicalClaim[] {
  const claims: MedicalClaim[] = [];
  const plainText = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

  // 1. 증상 관련 주장 추출
  const symptomPatterns = [
    /([가-힣\s]+(?:증상|통증|불편함|이상)(?:이|가|은|는)\s*[^.!?]{10,80}(?:나타납니다|발생합니다|있습니다))/g,
    /([가-힣\s]+(?:때|경우)\s*[^.!?]{10,80}(?:느껴집니다|보입니다|있습니다))/g,
  ];

  symptomPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(plainText)) !== null) {
      claims.push({
        text: match[1].trim(),
        type: 'symptom',
        confidence: 80,
        position: { start: match.index, end: match.index + match[0].length }
      });
    }
  });

  // 2. 치료/관리 관련 주장 추출
  const treatmentPatterns = [
    /([^.!?]{5,30}(?:치료|관리|개선|완화|예방)(?:이|가)?\s*[^.!?]{10,80}(?:도움이 됩니다|효과적입니다|중요합니다))/g,
    /([^.!?]{10,80}(?:방법|운동|습관|식단)(?:이|가|은|는)\s*[^.!?]{10,60}(?:좋습니다|권장됩니다))/g,
  ];

  treatmentPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(plainText)) !== null) {
      claims.push({
        text: match[1].trim(),
        type: 'treatment',
        confidence: 75,
        position: { start: match.index, end: match.index + match[0].length }
      });
    }
  });

  // 3. 원인 관련 주장 추출
  const causePatterns = [
    /([^.!?]{10,60}(?:원인|요인|이유)(?:은|는|이|가)\s*[^.!?]{10,80}(?:있습니다|됩니다|입니다))/g,
    /([^.!?]{10,80}(?:때문|인해|의해)\s*[^.!?]{10,60}(?:발생합니다|생깁니다|나타납니다))/g,
  ];

  causePatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(plainText)) !== null) {
      claims.push({
        text: match[1].trim(),
        type: 'cause',
        confidence: 70,
        position: { start: match.index, end: match.index + match[0].length }
      });
    }
  });

  // 4. 통계/수치 관련 주장 추출
  const statisticPatterns = [
    /([^.!?]{10,80}(?:\d+%|\d+명|\d+배|\d+건|절반|대부분|많은)\s*[^.!?]{10,80}(?:있습니다|됩니다|나타납니다))/g,
    /([^.!?]{10,80}(?:증가|감소|늘어|줄어)(?:났습니다|나고 있습니다))/g,
  ];

  statisticPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(plainText)) !== null) {
      // 숫자가 포함되어 있는지 확인
      if (/\d+/.test(match[1])) {
        claims.push({
          text: match[1].trim(),
          type: 'statistic',
          confidence: 85,
          position: { start: match.index, end: match.index + match[0].length }
        });
      }
    }
  });

  // 5. 일반 의학 정보 주장 추출
  const generalPatterns = [
    /([가-힣\s]{3,20}(?:이란|란)\s*[^.!?]{10,100}(?:말합니다|의미합니다|가리킵니다))/g,
    /([^.!?]{10,80}(?:특징|증상|형태)(?:은|는|이|가)\s*[^.!?]{10,80}(?:있습니다|됩니다))/g,
  ];

  generalPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(plainText)) !== null) {
      claims.push({
        text: match[1].trim(),
        type: 'general',
        confidence: 60,
        position: { start: match.index, end: match.index + match[0].length }
      });
    }
  });

  // 중복 제거 (같은 위치의 주장들)
  const uniqueClaims = claims.filter((claim, index, self) =>
    index === self.findIndex(c =>
      Math.abs(c.position.start - claim.position.start) < 10
    )
  );

  // 신뢰도 순으로 정렬
  return uniqueClaims.sort((a, b) => b.confidence - a.confidence);
}

// ============================================
// 4. 팩트 검증 로직
// ============================================

/**
 * 웹 검색 결과와 주장 비교 검증
 */
export function verifyClaim(
  claim: MedicalClaim,
  searchResults: { url: string; snippet: string }[]
): FactCheckResult {
  const sources: FactCheckSource[] = [];
  let verificationScore = 0;
  let matchCount = 0;

  // 주장에서 핵심 키워드 추출 (조사 제거)
  const keywords = claim.text
    .replace(/이|가|을|를|은|는|에|의|로|과|와|도|만|부터|까지/g, ' ')
    .split(/\s+/)
    .filter(word => word.length >= 2)
    .slice(0, 5); // 상위 5개 키워드만

  // 각 검색 결과와 비교
  searchResults.forEach(result => {
    const credibility = getSourceCredibility(result.url);

    // 스니펫에서 키워드 매칭 확인
    const matchedKeywords = keywords.filter(keyword =>
      result.snippet.includes(keyword)
    );

    const matchRate = keywords.length > 0
      ? matchedKeywords.length / keywords.length
      : 0;

    // 30% 이상 매칭되면 관련 있는 출처로 간주
    if (matchRate >= 0.3) {
      sources.push({
        url: result.url,
        domain: new URL(result.url).hostname,
        credibilityScore: credibility.score,
        category: credibility.category,
        snippet: result.snippet.slice(0, 200)
      });

      // 신뢰도 가중치 적용한 검증 점수
      verificationScore += credibility.score * matchRate;
      matchCount++;
    }
  });

  // 평균 검증 점수 계산
  const confidence = matchCount > 0
    ? Math.min(100, verificationScore / matchCount)
    : 0;

  // 검증 성공 여부 (60점 이상)
  const verified = confidence >= 60;

  // 안전성 등급 결정
  let recommendation: 'safe' | 'warning' | 'danger';
  if (confidence >= 75) {
    recommendation = 'safe';
  } else if (confidence >= 50) {
    recommendation = 'warning';
  } else {
    recommendation = 'danger';
  }

  // 검증 결과 설명
  let notes = '';
  if (verified) {
    const highCredSources = sources.filter(s => s.credibilityScore >= 80);
    if (highCredSources.length > 0) {
      notes = `신뢰할 수 있는 ${highCredSources.length}개 출처에서 확인됨`;
    } else {
      notes = `${sources.length}개 출처에서 일부 확인됨 (추가 검증 권장)`;
    }
  } else {
    if (sources.length === 0) {
      notes = '검증 가능한 출처를 찾지 못함 (내용 수정 권장)';
    } else {
      notes = '출처와 일치도가 낮음 (내용 확인 필요)';
    }
  }

  return {
    claim,
    verified,
    sources: sources.sort((a, b) => b.credibilityScore - a.credibilityScore),
    confidence: Math.round(confidence),
    notes,
    recommendation
  };
}

/**
 * 전체 콘텐츠 팩트 체크
 */
export function checkContentFacts(
  html: string,
  searchResults: { url: string; snippet: string }[]
): MedicalFactCheckReport {
  // 1. 의학적 주장 추출
  const claims = extractMedicalClaims(html);

  // 2. 각 주장 검증
  const results = claims.map(claim => verifyClaim(claim, searchResults));

  // 3. 통계 계산
  const verifiedCount = results.filter(r => r.verified).length;
  const unverifiedCount = results.length - verifiedCount;

  // 4. 정확성 점수 계산 (가중 평균)
  const totalConfidence = results.reduce((sum, r) => sum + r.confidence, 0);
  const accuracyScore = results.length > 0
    ? Math.round(totalConfidence / results.length)
    : 100; // 주장이 없으면 100점 (안전)

  // 5. 전체 권장사항 결정
  let overallRecommendation: 'safe' | 'warning' | 'danger';
  const dangerCount = results.filter(r => r.recommendation === 'danger').length;
  const warningCount = results.filter(r => r.recommendation === 'warning').length;

  if (dangerCount > 0) {
    overallRecommendation = 'danger';
  } else if (warningCount > results.length * 0.3) {
    overallRecommendation = 'warning';
  } else {
    overallRecommendation = 'safe';
  }

  // 6. 개선 제안 생성
  const suggestions: string[] = [];

  if (unverifiedCount > 0) {
    suggestions.push(`${unverifiedCount}개 주장이 검증되지 않았습니다. 신뢰할 수 있는 출처 확인 필요`);
  }

  const lowCredSources = results
    .flatMap(r => r.sources)
    .filter(s => s.credibilityScore < 70);
  if (lowCredSources.length > 0) {
    suggestions.push('일부 정보의 출처 신뢰도가 낮습니다. 정부기관/학회 자료 참고 권장');
  }

  const statisticClaims = results.filter(r => r.claim.type === 'statistic');
  const unverifiedStats = statisticClaims.filter(r => !r.verified);
  if (unverifiedStats.length > 0) {
    suggestions.push('통계/수치 정보가 검증되지 않았습니다. 정확한 데이터 확인 필요');
  }

  if (accuracyScore < 70 && results.length > 0) {
    suggestions.push('전반적인 정확성이 낮습니다. 내용을 더 신중하게 검토해주세요');
  }

  if (suggestions.length === 0 && results.length > 0) {
    suggestions.push('팩트 체킹 결과 양호합니다');
  }

  return {
    totalClaims: claims.length,
    verifiedClaims: verifiedCount,
    unverifiedClaims: unverifiedCount,
    accuracyScore,
    results: results.sort((a, b) => {
      // 위험도 순으로 정렬 (danger > warning > safe)
      const order = { danger: 0, warning: 1, safe: 2 };
      return order[a.recommendation] - order[b.recommendation];
    }),
    overallRecommendation,
    suggestions
  };
}

// ============================================
// 5. 편의 함수
// ============================================

/**
 * 간단한 정확성 점수 계산 (주장 없이)
 */
export function quickFactCheck(
  html: string,
  searchResults: { url: string; snippet: string }[]
): { score: number; recommendation: 'safe' | 'warning' | 'danger' } {
  const report = checkContentFacts(html, searchResults);
  return {
    score: report.accuracyScore,
    recommendation: report.overallRecommendation
  };
}

/**
 * 검색 결과를 표준 형식으로 변환
 */
export function normalizeSearchResults(rawResults: any[]): { url: string; snippet: string }[] {
  return rawResults
    .filter(r => r.url && r.snippet)
    .map(r => ({
      url: r.url,
      snippet: r.snippet || r.description || r.content || ''
    }));
}
