/**
 * 의료광고법 공식 정보 크롤링 및 관리 서비스
 * - 국가법령정보센터, 보건복지부 등 공식 사이트에서 최신 의료광고법 정보 수집
 * - 금지사항 자동 추출 및 데이터베이스 업데이트
 * - 의료법 제56조 관련 정보 실시간 조회
 */

export interface MedicalLawSource {
  name: string;
  url: string;
  type: 'law' | 'guideline' | 'news';
  priority: number;
}

export interface MedicalLawInfo {
  source: string;
  lastUpdated: string;
  prohibitions: ProhibitionRule[];
  summary: string;
}

export interface ProhibitionRule {
  category: 'treatment_experience' | 'false_info' | 'comparison' | 'exaggeration' | 'guarantee' | 'urgency' | 'other';
  description: string;
  examples: string[];
  legalBasis: string; // 예: "의료법 제56조 제2항 제2호"
  severity: 'critical' | 'high' | 'medium' | 'low';
}

// 공식 의료광고법 정보 소스
export const MEDICAL_LAW_SOURCES: MedicalLawSource[] = [
  {
    name: '국가법령정보센터 - 의료법 제56조',
    url: 'https://www.law.go.kr/LSW/lsInfoP.do?lsId=001788&ancYnChk=0#0000',
    type: 'law',
    priority: 1
  },
  {
    name: '보건복지부 - 의료광고 가이드라인',
    url: 'https://www.mohw.go.kr/board.es?mid=a10503010100&bid=0027&act=view&list_no=355295',
    type: 'guideline',
    priority: 2
  },
  {
    name: '국가법령정보센터 - 의료법 시행령',
    url: 'https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=92661',
    type: 'law',
    priority: 3
  }
];

/**
 * 의료광고법 정보를 공식 사이트에서 가져오기
 */
export async function fetchMedicalLawInfo(sourceUrl: string): Promise<MedicalLawInfo | null> {
  try {
    // 실제 환경에서는 백엔드 API를 통해 크롤링
    // 프론트엔드에서 직접 크롤링은 CORS 문제로 불가능
    const response = await fetch('/api/medical-law/fetch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: sourceUrl })
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('의료광고법 정보 가져오기 실패:', error);
    return null;
  }
}

/**
 * 의료법 제56조 금지사항 파싱 (텍스트에서 금지 규칙 추출)
 */
export function parseMedicalLaw56(lawText: string): ProhibitionRule[] {
  const rules: ProhibitionRule[] = [];

  // 의료법 제56조 제2항 각 호 파싱
  const prohibitionPatterns = [
    {
      keyword: '치료경험담',
      category: 'treatment_experience' as const,
      description: '환자에 관한 치료경험담 등 소비자로 하여금 치료 효과를 오인하게 할 우려가 있는 내용의 광고',
      examples: ['환자 후기', '치료 사례', 'Before & After', '체험담'],
      legalBasis: '의료법 제56조 제2항 제2호',
      severity: 'critical' as const
    },
    {
      keyword: '거짓된 내용',
      category: 'false_info' as const,
      description: '거짓된 내용을 표시하는 광고',
      examples: ['허위 자격증', '거짓 학력', '없는 시술 광고'],
      legalBasis: '의료법 제56조 제2항 제3호',
      severity: 'critical' as const
    },
    {
      keyword: '비교하는 내용',
      category: 'comparison' as const,
      description: '다른 의료인등의 기능 또는 진료 방법과 비교하는 내용의 광고',
      examples: ['타 병원 대비', '최고', '1위', '어디보다 좋은'],
      legalBasis: '의료법 제56조 제2항 제4호',
      severity: 'high' as const
    },
    {
      keyword: '객관적인 사실을 과장',
      category: 'exaggeration' as const,
      description: '객관적인 사실을 과장하는 내용의 광고',
      examples: ['100% 완치', '기적의 치료', '확실한 효과', '반드시 낫습니다'],
      legalBasis: '의료법 제56조 제2항 제8호',
      severity: 'critical' as const
    },
    {
      keyword: '법적 근거가 없는 자격',
      category: 'false_info' as const,
      description: '법적 근거가 없는 자격이나 명칭을 표방하는 내용의 광고',
      examples: ['비공식 자격증', '인증 받지 않은 전문가'],
      legalBasis: '의료법 제56조 제2항 제9호',
      severity: 'critical' as const
    }
  ];

  // 텍스트에서 각 금지사항 추출
  prohibitionPatterns.forEach(pattern => {
    if (lawText.includes(pattern.keyword)) {
      rules.push(pattern);
    }
  });

  return rules;
}

/**
 * 금지사항을 medicalLawChecker.ts의 FORBIDDEN_WORDS_DATABASE 형식으로 변환
 */
export function convertToForbiddenWords(rules: ProhibitionRule[]): any[] {
  const forbiddenWords: any[] = [];

  rules.forEach(rule => {
    rule.examples.forEach(example => {
      forbiddenWords.push({
        word: example,
        severity: rule.severity,
        replacement: getSafeAlternatives(example, rule.category),
        reason: rule.description,
        category: rule.category
      });
    });
  });

  return forbiddenWords;
}

/**
 * 금지어에 대한 안전한 대체 표현 추천
 */
function getSafeAlternatives(prohibitedWord: string, category: ProhibitionRule['category']): string[] {
  const alternatives: Record<string, string[]> = {
    '완치': ['증상 호전', '경과 관찰'],
    '100%': ['많은 분들이', '대부분의 경우'],
    '확실히': ['대체로', '일반적으로'],
    '반드시': ['권장됩니다', '도움이 됩니다'],
    '최고': ['우수한', '전문적인'],
    '1위': ['전문', '경험 많은'],
    '타 병원': ['(삭제)', '(삭제)'],
    '다른 병원': ['(삭제)', '(삭제)'],
    '치료 사례': ['(사용 금지)', '(사용 금지)'],
    '환자 후기': ['(사용 금지)', '(사용 금지)'],
    'Before & After': ['(사용 금지)', '(사용 금지)']
  };

  return alternatives[prohibitedWord] || ['(사용 주의)', '의료진 상담 권장'];
}

/**
 * 의료광고법 정보를 로컬 스토리지에 캐싱
 */
export function cacheMedicalLawInfo(info: MedicalLawInfo): void {
  try {
    localStorage.setItem('medical_law_cache', JSON.stringify(info));
    localStorage.setItem('medical_law_cache_timestamp', new Date().toISOString());
  } catch (error) {
    console.error('의료광고법 정보 캐싱 실패:', error);
  }
}

/**
 * 캐시된 의료광고법 정보 가져오기 (24시간 유효)
 */
export function getCachedMedicalLawInfo(): MedicalLawInfo | null {
  try {
    const cached = localStorage.getItem('medical_law_cache');
    const timestamp = localStorage.getItem('medical_law_cache_timestamp');

    if (!cached || !timestamp) return null;

    const cacheTime = new Date(timestamp).getTime();
    const now = new Date().getTime();
    const hoursDiff = (now - cacheTime) / (1000 * 60 * 60);

    // 24시간 이상 지나면 캐시 무효화
    if (hoursDiff > 24) {
      localStorage.removeItem('medical_law_cache');
      localStorage.removeItem('medical_law_cache_timestamp');
      return null;
    }

    return JSON.parse(cached);
  } catch (error) {
    console.error('캐시된 의료광고법 정보 가져오기 실패:', error);
    return null;
  }
}

/**
 * 의료광고법 정보 검색 (키워드 기반)
 */
export function searchMedicalLaw(keyword: string, info: MedicalLawInfo): ProhibitionRule[] {
  return info.prohibitions.filter(rule => 
    rule.description.includes(keyword) ||
    rule.examples.some(ex => ex.includes(keyword)) ||
    rule.legalBasis.includes(keyword)
  );
}

/**
 * 의료광고법 준수 여부 체크 (텍스트 검증)
 */
export function checkMedicalLawCompliance(text: string, prohibitions: ProhibitionRule[]): {
  isCompliant: boolean;
  violations: Array<{ rule: ProhibitionRule; matches: string[] }>;
} {
  const violations: Array<{ rule: ProhibitionRule; matches: string[] }> = [];

  prohibitions.forEach(rule => {
    const matches: string[] = [];
    
    rule.examples.forEach(example => {
      const regex = new RegExp(example, 'gi');
      const found = text.match(regex);
      if (found) {
        matches.push(...found);
      }
    });

    if (matches.length > 0) {
      violations.push({ rule, matches });
    }
  });

  return {
    isCompliant: violations.length === 0,
    violations
  };
}

/**
 * 의료광고법 관련 최신 뉴스/업데이트 확인
 */
export async function checkMedicalLawUpdates(): Promise<{
  hasUpdates: boolean;
  latestUpdate?: {
    date: string;
    title: string;
    url: string;
  };
}> {
  try {
    // 보건복지부 보도자료에서 의료광고 관련 최신 정보 확인
    const response = await fetch('/api/medical-law/updates');
    
    if (!response.ok) {
      return { hasUpdates: false };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('의료광고법 업데이트 확인 실패:', error);
    return { hasUpdates: false };
  }
}

/**
 * 의료광고법 정보 전체 동기화 (모든 소스에서 최신 정보 수집)
 */
export async function syncMedicalLawInfo(): Promise<MedicalLawInfo[]> {
  const results: MedicalLawInfo[] = [];

  for (const source of MEDICAL_LAW_SOURCES) {
    const info = await fetchMedicalLawInfo(source.url);
    if (info) {
      results.push(info);
    }
  }

  return results;
}

/**
 * 금지어 데이터베이스 자동 업데이트 (최신 의료광고법 정보 기반)
 */
export async function updateForbiddenWordsDatabase(): Promise<{
  success: boolean;
  newWords: number;
  updatedWords: number;
}> {
  try {
    const lawInfos = await syncMedicalLawInfo();
    
    if (lawInfos.length === 0) {
      return { success: false, newWords: 0, updatedWords: 0 };
    }

    // 모든 금지사항을 수집
    const allProhibitions = lawInfos.flatMap(info => info.prohibitions);
    
    // FORBIDDEN_WORDS_DATABASE 형식으로 변환
    const newForbiddenWords = convertToForbiddenWords(allProhibitions);

    // 로컬 스토리지에 저장 (실제로는 백엔드 DB 업데이트)
    localStorage.setItem('custom_forbidden_words', JSON.stringify(newForbiddenWords));
    localStorage.setItem('forbidden_words_last_update', new Date().toISOString());

    return {
      success: true,
      newWords: newForbiddenWords.length,
      updatedWords: 0
    };
  } catch (error) {
    console.error('금지어 데이터베이스 업데이트 실패:', error);
    return { success: false, newWords: 0, updatedWords: 0 };
  }
}

/**
 * 사용자 커스텀 금지어 추가
 */
export function addCustomForbiddenWord(word: {
  word: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  replacement: string[];
  reason: string;
  category: string;
}): boolean {
  try {
    const existing = localStorage.getItem('custom_forbidden_words');
    const words = existing ? JSON.parse(existing) : [];
    
    // 중복 체크
    if (words.some((w: any) => w.word === word.word)) {
      return false;
    }

    words.push(word);
    localStorage.setItem('custom_forbidden_words', JSON.stringify(words));
    return true;
  } catch (error) {
    console.error('커스텀 금지어 추가 실패:', error);
    return false;
  }
}

/**
 * 사용자 커스텀 금지어 가져오기
 */
export function getCustomForbiddenWords(): any[] {
  try {
    const stored = localStorage.getItem('custom_forbidden_words');
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('커스텀 금지어 가져오기 실패:', error);
    return [];
  }
}
