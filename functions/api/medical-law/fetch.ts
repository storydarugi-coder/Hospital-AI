// Cloudflare Pages Function
// Path: /api/medical-law/fetch
// 의료광고법 정보를 공식 사이트에서 크롤링

interface Env {
  // 환경 변수
}

interface MedicalLawInfo {
  source: string;
  lastUpdated: string;
  prohibitions: ProhibitionRule[];
  summary: string;
  rawContent: string;
}

interface ProhibitionRule {
  category: 'treatment_experience' | 'false_info' | 'comparison' | 'exaggeration' | 'guarantee' | 'urgency' | 'other';
  description: string;
  examples: string[];
  legalBasis: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const { url } = await context.request.json() as { url: string };
    
    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('🏥 의료광고법 정보 크롤링:', url);

    // URL 가져오기
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MedicalLawBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
      },
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch URL', status: response.status }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const html = await response.text();
    
    // HTML에서 텍스트 추출
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // 의료법 제56조 관련 내용 파싱
    const prohibitions = parseMedicalLaw56(textContent);

    // 요약 생성
    const summary = generateSummary(textContent, prohibitions);

    const medicalLawInfo: MedicalLawInfo = {
      source: url,
      lastUpdated: new Date().toISOString(),
      prohibitions,
      summary,
      rawContent: textContent.substring(0, 10000) // 첫 10000자만 저장
    };

    console.log('✅ 의료광고법 정보 파싱 완료:', prohibitions.length, '개 금지사항');

    return new Response(
      JSON.stringify(medicalLawInfo),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ 의료광고법 정보 크롤링 실패:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Medical law fetch failed', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * 의료법 제56조 금지사항 파싱
 */
function parseMedicalLaw56(text: string): ProhibitionRule[] {
  const rules: ProhibitionRule[] = [];

  // 제56조 제2항 각 호 패턴 매칭
  const prohibitionPatterns = [
    {
      regex: /(치료경험담|환자.*경험|치료.*사례|Before.*After)/i,
      category: 'treatment_experience' as const,
      description: '환자에 관한 치료경험담 등 소비자로 하여금 치료 효과를 오인하게 할 우려가 있는 내용의 광고',
      examples: ['환자 후기', '치료 사례', 'Before & After', '체험담', '실제 사례'],
      legalBasis: '의료법 제56조 제2항 제2호',
      severity: 'critical' as const
    },
    {
      regex: /거짓.*내용.*표시/i,
      category: 'false_info' as const,
      description: '거짓된 내용을 표시하는 광고',
      examples: ['허위 정보', '거짓 자격', '없는 장비', '가짜 인증'],
      legalBasis: '의료법 제56조 제2항 제3호',
      severity: 'critical' as const
    },
    {
      regex: /(비교|다른.*의료인|타.*병원)/i,
      category: 'comparison' as const,
      description: '다른 의료인등의 기능 또는 진료 방법과 비교하는 내용의 광고',
      examples: ['타 병원 대비', '다른 병원보다', '최고', '1위', '어디보다'],
      legalBasis: '의료법 제56조 제2항 제4호',
      severity: 'high' as const
    },
    {
      regex: /(과장|100%|완치|확실|반드시)/i,
      category: 'exaggeration' as const,
      description: '객관적인 사실을 과장하는 내용의 광고',
      examples: ['100% 완치', '반드시 낫습니다', '확실한 효과', '기적의 치료'],
      legalBasis: '의료법 제56조 제2항 제8호',
      severity: 'critical' as const
    },
    {
      regex: /법적.*근거.*없는.*자격/i,
      category: 'false_info' as const,
      description: '법적 근거가 없는 자격이나 명칭을 표방하는 내용의 광고',
      examples: ['비공식 인증', '임의 자격증', '국제 OO 전문의'],
      legalBasis: '의료법 제56조 제2항 제9호',
      severity: 'critical' as const
    },
    {
      regex: /(부작용|중요.*정보|누락)/i,
      category: 'other' as const,
      description: '의료인등의 기능, 진료 방법과 관련하여 심각한 부작용 등 중요한 정보를 누락하는 광고',
      examples: ['부작용 숨김', '위험 정보 미고지', '중요 사항 누락'],
      legalBasis: '의료법 제56조 제2항 제7호',
      severity: 'high' as const
    }
  ];

  // 텍스트에서 각 패턴 검색
  prohibitionPatterns.forEach(pattern => {
    if (pattern.regex.test(text)) {
      rules.push({
        category: pattern.category,
        description: pattern.description,
        examples: pattern.examples,
        legalBasis: pattern.legalBasis,
        severity: pattern.severity
      });
    }
  });

  // 항상 기본 금지사항은 포함 (법령에 명시된 사항)
  if (rules.length === 0) {
    // 기본 금지사항 추가
    prohibitionPatterns.forEach(pattern => {
      rules.push({
        category: pattern.category,
        description: pattern.description,
        examples: pattern.examples,
        legalBasis: pattern.legalBasis,
        severity: pattern.severity
      });
    });
  }

  return rules;
}

/**
 * 요약 생성
 */
function generateSummary(text: string, prohibitions: ProhibitionRule[]): string {
  const criticalCount = prohibitions.filter(p => p.severity === 'critical').length;
  const highCount = prohibitions.filter(p => p.severity === 'high').length;
  
  return `의료광고법 제56조에 따라 ${prohibitions.length}개의 주요 금지사항이 있습니다. ` +
         `중대 위반 ${criticalCount}개, 높은 위험 ${highCount}개를 포함하여 의료광고 시 반드시 준수해야 합니다.`;
}

// CORS preflight
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
