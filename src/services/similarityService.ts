/**
 * 유사도 검사 서비스
 * - 텍스트 간 유사도 측정
 * - 중복 콘텐츠 감지
 */

// 코사인 유사도 계산 (0~1, 1에 가까울수록 유사)
export function calculateCosineSimilarity(text1: string, text2: string): number {
  const tokens1 = tokenize(text1);
  const tokens2 = tokenize(text2);
  
  const vector1 = createVector(tokens1);
  const vector2 = createVector(tokens2);
  
  return cosineSimilarity(vector1, vector2);
}

// 텍스트를 토큰으로 분리 (단어 단위)
function tokenize(text: string): string[] {
  // 한글, 영문, 숫자만 추출
  return text
    .toLowerCase()
    .replace(/[^\w\sㄱ-ㅎㅏ-ㅣ가-힣]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 1); // 1글자 제외
}

// 단어 빈도 벡터 생성
function createVector(tokens: string[]): Map<string, number> {
  const vector = new Map<string, number>();
  tokens.forEach(token => {
    vector.set(token, (vector.get(token) || 0) + 1);
  });
  return vector;
}

// 코사인 유사도 계산
function cosineSimilarity(vec1: Map<string, number>, vec2: Map<string, number>): number {
  const allKeys = new Set([...vec1.keys(), ...vec2.keys()]);
  
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;
  
  allKeys.forEach(key => {
    const val1 = vec1.get(key) || 0;
    const val2 = vec2.get(key) || 0;
    
    dotProduct += val1 * val2;
    magnitude1 += val1 * val1;
    magnitude2 += val2 * val2;
  });
  
  if (magnitude1 === 0 || magnitude2 === 0) return 0;
  
  return dotProduct / (Math.sqrt(magnitude1) * Math.sqrt(magnitude2));
}

// Jaccard 유사도 계산 (0~1, 1에 가까울수록 유사)
export function calculateJaccardSimilarity(text1: string, text2: string): number {
  const tokens1 = new Set(tokenize(text1));
  const tokens2 = new Set(tokenize(text2));
  
  const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);
  
  if (union.size === 0) return 0;
  
  return intersection.size / union.size;
}

// 레벤슈타인 거리 (편집 거리)
export function calculateLevenshteinDistance(text1: string, text2: string): number {
  const len1 = text1.length;
  const len2 = text2.length;
  
  const dp: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));
  
  for (let i = 0; i <= len1; i++) dp[i][0] = i;
  for (let j = 0; j <= len2; j++) dp[0][j] = j;
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = text1[i - 1] === text2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // 삭제
        dp[i][j - 1] + 1,      // 삽입
        dp[i - 1][j - 1] + cost // 치환
      );
    }
  }
  
  return dp[len1][len2];
}

// 정규화된 편집 거리 (0~1, 0에 가까울수록 유사)
export function calculateNormalizedEditDistance(text1: string, text2: string): number {
  const distance = calculateLevenshteinDistance(text1, text2);
  const maxLen = Math.max(text1.length, text2.length);
  
  if (maxLen === 0) return 0;
  
  return 1 - (distance / maxLen);
}

// 종합 유사도 점수 (0~100, 100에 가까울수록 유사)
export function calculateOverallSimilarity(text1: string, text2: string): number {
  const cosine = calculateCosineSimilarity(text1, text2);
  const jaccard = calculateJaccardSimilarity(text1, text2);
  const editDistance = calculateNormalizedEditDistance(text1, text2);
  
  // 가중 평균 (코사인 50%, Jaccard 30%, 편집 거리 20%)
  const score = (cosine * 0.5 + jaccard * 0.3 + editDistance * 0.2) * 100;
  
  return Math.round(score * 100) / 100; // 소수점 2자리
}

// 유사도 레벨 판정
export function getSimilarityLevel(score: number): {
  level: 'very-high' | 'high' | 'medium' | 'low' | 'very-low';
  label: string;
  color: string;
  description: string;
} {
  if (score >= 90) {
    return {
      level: 'very-high',
      label: '매우 높음',
      color: '#ef4444',
      description: '거의 동일한 콘텐츠입니다. 표절 위험이 매우 높습니다.',
    };
  } else if (score >= 70) {
    return {
      level: 'high',
      label: '높음',
      color: '#f97316',
      description: '상당히 유사한 콘텐츠입니다. 수정이 필요합니다.',
    };
  } else if (score >= 50) {
    return {
      level: 'medium',
      label: '보통',
      color: '#eab308',
      description: '일부 유사한 내용이 있습니다. 검토가 필요합니다.',
    };
  } else if (score >= 30) {
    return {
      level: 'low',
      label: '낮음',
      color: '#22c55e',
      description: '유사도가 낮습니다. 독창적인 콘텐츠입니다.',
    };
  } else {
    return {
      level: 'very-low',
      label: '매우 낮음',
      color: '#10b981',
      description: '거의 다른 콘텐츠입니다. 독창성이 높습니다.',
    };
  }
}

// 유사한 문장 찾기
export function findSimilarSentences(
  text1: string,
  text2: string,
  threshold: number = 70
): Array<{ sentence1: string; sentence2: string; similarity: number }> {
  const sentences1 = text1.split(/[.!?]\s+/).filter(s => s.trim().length > 10);
  const sentences2 = text2.split(/[.!?]\s+/).filter(s => s.trim().length > 10);
  
  const similarPairs: Array<{ sentence1: string; sentence2: string; similarity: number }> = [];
  
  sentences1.forEach(s1 => {
    sentences2.forEach(s2 => {
      const similarity = calculateOverallSimilarity(s1, s2);
      if (similarity >= threshold) {
        similarPairs.push({
          sentence1: s1,
          sentence2: s2,
          similarity,
        });
      }
    });
  });
  
  // 유사도 높은 순으로 정렬
  return similarPairs.sort((a, b) => b.similarity - a.similarity);
}

// 배치 유사도 검사 (여러 텍스트와 비교)
export function checkSimilarityBatch(
  targetText: string,
  compareTexts: Array<{ id: string; text: string; title?: string }>
): Array<{
  id: string;
  title?: string;
  similarity: number;
  level: ReturnType<typeof getSimilarityLevel>;
}> {
  return compareTexts
    .map(item => {
      const similarity = calculateOverallSimilarity(targetText, item.text);
      return {
        id: item.id,
        title: item.title,
        similarity,
        level: getSimilarityLevel(similarity),
      };
    })
    .sort((a, b) => b.similarity - a.similarity); // 유사도 높은 순
}
