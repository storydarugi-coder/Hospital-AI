/**
 * GPT-5.2 프롬프트 시스템 v5.0 (토큰 최적화 + 2단계 구조)
 * 
 * v5.0 주요 변경:
 * - 4단계 → 2단계로 축소 (API 호출 50% 감소)
 * - 예시 최소화 (규칙당 1개)
 * - 테이블 통합 (금지어 사전 1개)
 * - JSON 자체 검증 필드 추가
 * - 금지→필수→선택 순서로 구조화
 * 
 * 단계별 역할:
 * - 1단계: 콘텐츠 생성 + SEO + 체류시간 (기존 1+3 통합)
 * - 2단계: AI 제거 + 의료광고법 심화 (기존 2+4 통합)
 */

/**
 * 1단계: 콘텐츠 생성 + SEO (기존 1+3 통합)
 */
export const getStage1_ContentGeneration = (textLength: number = 2000) => {
  return `[1단계] 네이버 병원 블로그 콘텐츠 생성 + SEO

■ 금지 (위반 시 탈락)
━━━━━━━━━━━━━━━━━━━━
• 물음표(?) 전체 금지
• 제목 16자 이상 금지
• "~인지, ~인지" 나열 패턴 금지
• 감정 자극 ("위험합니다", "방치하면") 금지
• CTA 박스, 메타 설명 금지

■ 필수 규칙
━━━━━━━━━━━━━━━━━━━━
1. 분량: ${textLength + 300}자 이상, 소제목 4~6개
2. 제목: 15자 이하 + 키워드 앞배치
3. 첫문장: 상황 서술형 ("~하는 경우가 있다")
4. 경험 표현: "임상에서 자주 보이는", "내원하시는 분들 중"

■ SEO 규칙
━━━━━━━━━━━━━━━━━━━━
• 첫 150자 내 메인 키워드
• 소제목: 생활 장면형 ("팔 올리기가 힘들어졌을 때")
• 금지 소제목: "OO의 원인", "OO 증상", "치료 방법"

■ 체류시간 요소 (1개 이상 필수)
━━━━━━━━━━━━━━━━━━━━
• 자가체크: "이런 경험이 있다면" 섹션
• 단계별: 초기→중기→후기 흐름
• 비교: "A와 B의 차이"

■ JSON 응답
━━━━━━━━━━━━━━━━━━━━
{
  "title": "15자 이하 제목",
  "content": "HTML 본문",
  "imagePrompts": ["프롬프트1", "프롬프트2"],
  "check": {
    "charCount": 숫자,
    "hasQuestion": false,
    "titleLength": 숫자
  }
}`;
};

/**
 * 2단계: AI 제거 + 의료광고법 (기존 2+4 통합)
 */
export const getStage2_AiRemovalAndCompliance = (textLength: number = 2000) => {
  return `[2단계] AI 냄새 제거 + 의료광고법 준수

■ 금지어 사전 (발견 즉시 대체)
━━━━━━━━━━━━━━━━━━━━
| 유형 | 금지 | 대체 |
|------|------|------|
| 환자 | 환자, 환자분들 | 내원하시는 분들 |
| 1인칭 | 저는, 제가, 저희 | 일반적으로 |
| 인용 | ~에 따르면 | ~로 알려져 있다 |
| 판단 | 가능성이 높다 | 언급되는 경우가 있다 |
| 정의 | OO이란 ~질환 | 자주 거론되는 것 중 하나 |
| 공포 | 방치하면 위험, 악화 | 경과를 살펴보는 것도 방법 |
| 나이 | 50대, 30대 여성 | 중년층, 젊은 여성 분들 |
| 기간 | 2~3일, 1주일 | 개인에 따라 차이 |
| 효과 | 개선, 완화, 호전 | 변화가 관찰되는 |
| 비교 | ~전에는/~후에는 | (사용 금지) |
| 비용 | 비용, 가격, 원 | (사용 금지) |
| 성공 | 효과적, 성공률 | (사용 금지) |

■ 종결어미 규칙
━━━━━━━━━━━━━━━━━━━━
| 금지 | 대체 |
|------|------|
| ~입니다/합니다 | ~경우가 있다, ~편이다 |
| ~수 있습니다 | ~경향이 있다, ~로 알려져 있다 |
| ~해야 합니다 | ~도움이 될 수 있다 |
※ 같은 종결어미 3회+ 반복 금지

■ AI 표현 제거
━━━━━━━━━━━━━━━━━━━━
• 연결어: 이처럼→이렇게 보면, 따라서→그래서
• 명사: 시점/사례/과정 → 순간/경우/때
• 피동형 → 능동형

■ 필수 포함
━━━━━━━━━━━━━━━━━━━━
• 신뢰 표현 1개+: "개인차가 있으므로", "전문적인 확인이 필요한"
• 마무리: "증상이 지속된다면 전문적인 확인을 받아보는 것도 방법이다"

■ 단어 반복 검증
━━━━━━━━━━━━━━━━━━━━
• 핵심 단어 16회 이상 → 대체 표현 사용
• "판단/진단/가능성/의심" 총 3회 이하

■ JSON 응답
━━━━━━━━━━━━━━━━━━━━
{
  "title": "1단계 제목 유지",
  "content": "수정된 HTML 본문",
  "imagePrompts": ["프롬프트들..."],
  "check": {
    "forbidden": [],
    "wordCounts": {"키워드": 횟수},
    "endingVariety": true
  }
}`;
};

/**
 * 레거시 호환: 기존 4단계 함수들 (deprecated)
 */
export const getStage2_RemoveAiSmell = getStage2_AiRemovalAndCompliance;
export const getStage3_SeoOptimization = () => getStage1_ContentGeneration();
export const getStage4_FinalCheck = () => getStage2_AiRemovalAndCompliance();

/**
 * 단계별 프롬프트 가져오기
 */
export const getStagePrompt = (stageNumber: 1 | 2, textLength: number = 2000): string => {
  switch (stageNumber) {
    case 1:
      return getStage1_ContentGeneration(textLength);
    case 2:
      return getStage2_AiRemovalAndCompliance(textLength);
    default:
      throw new Error(`Invalid stage number: ${stageNumber}. v5.0 uses 2 stages only.`);
  }
};

/**
 * 전체 단계 가져오기
 */
export const getAllStages = (textLength: number = 2000) => ({
  stage1: getStage1_ContentGeneration(textLength),
  stage2: getStage2_AiRemovalAndCompliance(textLength)
});
