/**
 * 의료광고법 실시간 검증 시스템
 * - 금지어 실시간 스캔 + 하이라이트 + 대체어 추천
 * - SEO 점수 실시간 분석
 * - AI 냄새 후처리 검증
 */

// ============================================
// 1. 금지어 데이터베이스 + 대체어
// ============================================

export interface ForbiddenWord {
  word: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  replacement: string[];
  reason: string;
  category: 'medical_law' | 'exaggeration' | 'comparison' | 'guarantee' | 'urgency' | 'first_person' | 'definition';
}

export const FORBIDDEN_WORDS_DATABASE: ForbiddenWord[] = [
  // ===== Critical: 의료법 중대 위반 (단어) =====
  { word: '완치', severity: 'critical', replacement: ['경과 관찰', '변화 확인'], reason: '치료 효과 보장 금지 (의료광고법)', category: 'guarantee' },
  { word: '100%', severity: 'critical', replacement: ['많은 분들이', '대부분의 경우'], reason: '효과 보장 금지 (의료광고법)', category: 'guarantee' },
  { word: '확실히 치료', severity: 'critical', replacement: ['도움이 될 수 있습니다', '(삭제)'], reason: '치료 효과 보장 금지 (의료광고법)', category: 'guarantee' },
  { word: '반드시 낫', severity: 'critical', replacement: ['개인차가 있습니다', '경과에 따라 다릅니다'], reason: '치료 효과 보장 금지 (의료광고법)', category: 'guarantee' },
  { word: '완전히 제거', severity: 'critical', replacement: ['변화가 나타날 수', '(삭제)'], reason: '치료 효과 보장 금지 (의료광고법)', category: 'guarantee' },
  { word: '영구적 효과', severity: 'critical', replacement: ['장기적인 관리', '꾸준한 관리'], reason: '치료 효과 보장 금지 (의료광고법)', category: 'guarantee' },
  { word: '특효약', severity: 'critical', replacement: ['도움이 되는 방법', '고려해볼 만한 방법'], reason: '과장 광고 금지 (의료광고법)', category: 'exaggeration' },
  { word: '기적의', severity: 'critical', replacement: ['(삭제)', '도움이 되는'], reason: '과장 광고 금지 (의료광고법)', category: 'exaggeration' },
  
  // 🚨 증상 호전·개선·완화 암시 표현 금지
  { word: '증상 호전', severity: 'critical', replacement: ['경과 관찰', '변화 확인'], reason: '증상 호전 암시 금지 (의료광고법)', category: 'medical_law' },
  { word: '호전됩니다', severity: 'critical', replacement: ['변화가 나타나기도 합니다', '경과를 살펴볼 수 있습니다'], reason: '호전 암시 금지 (의료광고법)', category: 'medical_law' },
  { word: '호전될 수', severity: 'critical', replacement: ['변화가 나타날 수', '경과를 살펴볼 수'], reason: '호전 암시 금지 (의료광고법)', category: 'medical_law' },
  { word: '호전이 가능', severity: 'critical', replacement: ['변화가 나타날 수 있습니다', '경과를 확인할 수 있습니다'], reason: '호전 암시 금지 (의료광고법)', category: 'medical_law' },
  { word: '호전', severity: 'critical', replacement: ['변화', '경과'], reason: '호전 암시 금지 (의료광고법)', category: 'medical_law' },
  { word: '증상이 개선', severity: 'critical', replacement: ['변화가 나타날 수', '경과 확인'], reason: '개선 암시 금지 (의료광고법)', category: 'medical_law' },
  { word: '개선됩니다', severity: 'critical', replacement: ['변화가 나타나기도 합니다', '경과를 살펴볼 수 있습니다'], reason: '개선 암시 금지 (의료광고법)', category: 'medical_law' },
  { word: '개선될 수', severity: 'critical', replacement: ['변화가 나타날 수', '경과를 확인할 수'], reason: '개선 암시 금지 (의료광고법)', category: 'medical_law' },
  { word: '개선이 가능', severity: 'critical', replacement: ['변화가 나타날 수 있습니다', '경과를 확인할 수 있습니다'], reason: '개선 암시 금지 (의료광고법)', category: 'medical_law' },
  { word: '개선', severity: 'critical', replacement: ['변화', '경과'], reason: '개선 암시 금지 (의료광고법)', category: 'medical_law' },
  { word: '증상이 완화', severity: 'critical', replacement: ['변화가 나타날 수', '경과 확인'], reason: '완화 암시 금지 (의료광고법)', category: 'medical_law' },
  { word: '완화됩니다', severity: 'critical', replacement: ['변화가 나타나기도 합니다', '경과를 살펴볼 수 있습니다'], reason: '완화 암시 금지 (의료광고법)', category: 'medical_law' },
  { word: '완화될 수', severity: 'critical', replacement: ['변화가 나타날 수', '경과를 확인할 수'], reason: '완화 암시 금지 (의료광고법)', category: 'medical_law' },
  { word: '완화', severity: 'critical', replacement: ['변화', '경과'], reason: '완화 암시 금지 (의료광고법)', category: 'medical_law' },
  { word: '증상이 나아', severity: 'critical', replacement: ['변화가 나타날 수', '경과 확인'], reason: '증상 호전 암시 금지 (의료광고법)', category: 'medical_law' },
  { word: '나아집니다', severity: 'critical', replacement: ['변화가 나타나기도 합니다', '경과를 살펴볼 수 있습니다'], reason: '증상 호전 암시 금지 (의료광고법)', category: 'medical_law' },
  { word: '상태가 좋아', severity: 'critical', replacement: ['변화가 나타날 수', '경과 확인'], reason: '증상 호전 암시 금지 (의료광고법)', category: 'medical_law' },
  
  // ===== Critical: 의료광고법 위반 (비교/보장/과장) =====
  { word: '최고', severity: 'critical', replacement: ['(삭제)', '양질의'], reason: '비교 광고 금지 (의료광고법)', category: 'comparison' },
  { word: '1위', severity: 'critical', replacement: ['(삭제)', '경험 많은'], reason: '비교 광고 금지 (의료광고법)', category: 'comparison' },
  { word: '최상', severity: 'critical', replacement: ['양질의', '우수한'], reason: '비교 광고 금지 (의료광고법)', category: 'comparison' },
  { word: '최고급', severity: 'critical', replacement: ['양질의', '우수한'], reason: '비교 광고 금지 (의료광고법)', category: 'comparison' },
  { word: '반드시', severity: 'critical', replacement: ['권장됩니다', '도움이 됩니다'], reason: '강제성 표현 금지 (의료광고법)', category: 'urgency' },
  { word: '확실히', severity: 'critical', replacement: ['대체로', '일반적으로'], reason: '보장성 표현 금지 (의료광고법)', category: 'guarantee' },
  { word: '무조건', severity: 'critical', replacement: ['대부분', '많은 경우'], reason: '보장성 표현 금지 (의료광고법)', category: 'guarantee' },
  { word: '보증', severity: 'critical', replacement: ['(삭제)', '도움이 됩니다'], reason: '보장성 표현 금지 (의료광고법)', category: 'guarantee' },
  { word: '획기적', severity: 'critical', replacement: ['(삭제)', '유용한'], reason: '과장 광고 금지 (의료광고법)', category: 'exaggeration' },
  { word: '혁신적', severity: 'critical', replacement: ['새로운', '발전된'], reason: '과장 광고 금지 (의료광고법)', category: 'exaggeration' },
  { word: '타 병원', severity: 'critical', replacement: ['(삭제)', '(삭제)'], reason: '비교 광고 금지 (의료광고법)', category: 'comparison' },
  { word: '다른 병원', severity: 'critical', replacement: ['(삭제)', '(삭제)'], reason: '비교 광고 금지 (의료광고법)', category: 'comparison' },
  { word: '어디보다', severity: 'critical', replacement: ['(삭제)', '(삭제)'], reason: '비교 광고 금지 (의료광고법)', category: 'comparison' },
  
  // 🚨 의료진/전문 관련 단어 완전 금지 강화
  { word: '전문가', severity: 'critical', replacement: ['(사용 금지)', '(사용 금지)'], reason: '자격 강조 금지 (의료광고법) - 완전 금지', category: 'medical_law' },
  { word: '전문의', severity: 'critical', replacement: ['(사용 금지)', '(사용 금지)'], reason: '자격 강조 금지 (의료광고법) - 완전 금지', category: 'medical_law' },
  { word: '전문적', severity: 'critical', replacement: ['(사용 금지)', '(사용 금지)'], reason: '자격 강조 금지 (의료광고법) - 완전 금지', category: 'medical_law' },
  { word: '전문', severity: 'critical', replacement: ['(사용 금지)', '(사용 금지)'], reason: '자격 강조 금지 (의료광고법) - 완전 금지', category: 'medical_law' },
  { word: '의료진', severity: 'critical', replacement: ['(사용 금지)', '(사용 금지)'], reason: '의료진 표현 금지 (의료광고법) - 완전 금지', category: 'medical_law' },
  { word: '의료 연구', severity: 'critical', replacement: ['알려진 바에 따르면', '(삭제)'], reason: '의료 연구 표현 금지 (의료광고법) - 완전 금지', category: 'medical_law' },
  { word: '의료연구', severity: 'critical', replacement: ['알려진 바에 따르면', '(삭제)'], reason: '의료연구 표현 금지 (의료광고법) - 완전 금지', category: 'medical_law' },
  { word: '의료', severity: 'critical', replacement: ['(사용 금지)', '(사용 금지)'], reason: '의료 직접 표현 금지 (의료광고법) - 완전 금지', category: 'medical_law' },
  { word: '명의', severity: 'critical', replacement: ['(사용 금지)', '(사용 금지)'], reason: '자격 강조 금지 (의료광고법) - 완전 금지', category: 'medical_law' },
  { word: '베테랑', severity: 'critical', replacement: ['경험 있는', '(삭제)'], reason: '자격 강조 금지 (의료광고법)', category: 'exaggeration' },
  { word: '숙련된', severity: 'critical', replacement: ['경험 있는', '(삭제)'], reason: '자격 강조 금지 (의료광고법)', category: 'exaggeration' },
  { word: '의사', severity: 'critical', replacement: ['(사용 금지)', '(사용 금지)'], reason: '의료인 직접 표현 금지 (의료광고법) - 완전 금지', category: 'medical_law' },
  { word: '원장', severity: 'critical', replacement: ['(사용 금지)', '(사용 금지)'], reason: '의료인 직접 표현 금지 (의료광고법) - 완전 금지', category: 'medical_law' },
  { word: '의학', severity: 'critical', replacement: ['(사용 금지)', '(사용 금지)'], reason: '의학 직접 표현 금지 (의료광고법) - 완전 금지', category: 'medical_law' },
  { word: '의학적', severity: 'critical', replacement: ['(사용 금지)', '(사용 금지)'], reason: '의학적 표현 금지 (의료광고법) - 완전 금지', category: 'medical_law' },
  { word: '의료적', severity: 'critical', replacement: ['(사용 금지)', '(사용 금지)'], reason: '의료적 표현 금지 (의료광고법) - 완전 금지', category: 'medical_law' },
  { word: '치료', severity: 'critical', replacement: ['(사용 금지)', '(사용 금지)'], reason: '치료 직접 표현 금지 (의료광고법) - 완전 금지', category: 'medical_law' },
  
  // 🚨 진단/질환 관련 단어 완전 금지 강화
  { word: '진단', severity: 'critical', replacement: ['(사용 금지)', '(사용 금지)'], reason: '진단 표현 완전 금지 (의료광고법) - 완전 금지', category: 'medical_law' },
  { word: '의심', severity: 'critical', replacement: ['(사용 금지)', '(사용 금지)'], reason: '진단 유도 완전 금지 (의료광고법) - 완전 금지', category: 'medical_law' },
  { word: '판단', severity: 'critical', replacement: ['(사용 금지)', '(사용 금지)'], reason: '판단 표현 완전 금지 (의료광고법) - 완전 금지', category: 'medical_law' },
  { word: '질환', severity: 'critical', replacement: ['(사용 금지)', '(사용 금지)'], reason: '질환 직접 표현 금지 (의료광고법) - 완전 금지', category: 'medical_law' },
  { word: '질병', severity: 'critical', replacement: ['(사용 금지)', '(사용 금지)'], reason: '질병 직접 표현 금지 (의료광고법) - 완전 금지', category: 'medical_law' },
  { word: '병', severity: 'critical', replacement: ['(사용 금지)', '(사용 금지)'], reason: '병 직접 표현 금지 (의료광고법) - 완전 금지', category: 'medical_law' },
  { word: '증상', severity: 'critical', replacement: ['(사용 금지)', '(사용 금지)'], reason: '증상 직접 표현 금지 (의료광고법) - 완전 금지', category: 'medical_law' },
  { word: '처방', severity: 'critical', replacement: ['(사용 금지)', '(사용 금지)'], reason: '처방 표현 완전 금지 (의료광고법) - 완전 금지', category: 'medical_law' },
  { word: '검사', severity: 'critical', replacement: ['(사용 금지)', '(사용 금지)'], reason: '검사 유도 완전 금지 (의료광고법) - 완전 금지', category: 'medical_law' },
  { word: '체크', severity: 'critical', replacement: ['(사용 금지)', '(사용 금지)'], reason: '자가진단 유도 금지 (의료광고법) - 완전 금지', category: 'medical_law' },
  { word: '수술', severity: 'critical', replacement: ['(사용 금지)', '(사용 금지)'], reason: '수술 직접 표현 금지 (의료광고법) - 완전 금지', category: 'medical_law' },
  { word: '시술', severity: 'critical', replacement: ['(사용 금지)', '(사용 금지)'], reason: '시술 직접 표현 금지 (의료광고법) - 완전 금지', category: 'medical_law' },
  { word: '투약', severity: 'critical', replacement: ['(사용 금지)', '(사용 금지)'], reason: '투약 표현 완전 금지 (의료광고법) - 완전 금지', category: 'medical_law' },
  { word: '약물', severity: 'critical', replacement: ['(사용 금지)', '(사용 금지)'], reason: '약물 직접 표현 금지 (의료광고법) - 완전 금지', category: 'medical_law' },
  { word: '의약품', severity: 'critical', replacement: ['(사용 금지)', '(사용 금지)'], reason: '의약품 직접 표현 금지 (의료광고법) - 완전 금지', category: 'medical_law' },
  { word: '약', severity: 'critical', replacement: ['(사용 금지)', '(사용 금지)'], reason: '약 직접 표현 금지 (의료광고법) - 완전 금지', category: 'medical_law' },
  { word: '진료', severity: 'critical', replacement: ['(사용 금지)', '(사용 금지)'], reason: '진료 직접 표현 금지 (의료광고법) - 완전 금지', category: 'medical_law' },
  { word: '임상', severity: 'critical', replacement: ['(사용 금지)', '(사용 금지)'], reason: '임상 표현 완전 금지 (의료광고법) - 완전 금지', category: 'medical_law' },
  { word: '환자', severity: 'critical', replacement: ['(사용 금지)', '(사용 금지)'], reason: '환자 표현 완전 금지 (의료광고법) - 완전 금지', category: 'medical_law' },
  { word: '환자분', severity: 'critical', replacement: ['(사용 금지)', '(사용 금지)'], reason: '환자 표현 완전 금지 (의료광고법) - 완전 금지', category: 'medical_law' },

  // ===== Critical: 의료광고법 위반 (공포 조장/긴급성 과장) =====
  { word: '골든타임', severity: 'critical', replacement: ['적절한 시기', '시기를 놓치지 않고'], reason: '공포 조장 금지 (의료광고법)', category: 'urgency' },
  { word: '즉시', severity: 'critical', replacement: ['가급적 빨리', '시간이 되실 때'], reason: '긴급성 과장 금지 (의료광고법)', category: 'urgency' },
  { word: '지금 당장', severity: 'critical', replacement: ['여유가 되실 때', '시간이 되시면'], reason: '긴급성 과장 금지 (의료광고법)', category: 'urgency' },
  { word: '놓치면 후회', severity: 'critical', replacement: ['미리 확인해보시면', '참고해보시면'], reason: '공포 조장 금지 (의료광고법)', category: 'urgency' },
  { word: '위험합니다', severity: 'critical', replacement: ['주의가 필요합니다', '살펴볼 필요가 있습니다'], reason: '공포 조장 금지 (의료광고법)', category: 'urgency' },
  { word: '서둘러', severity: 'critical', replacement: ['여유를 갖고', '시간이 되실 때'], reason: '긴급성 과장 금지 (의료광고법)', category: 'urgency' },
  { word: '방치하면', severity: 'critical', replacement: ['경과를 살펴보는 것도', '확인해보시는 것도'], reason: '공포 조장 금지 (의료광고법)', category: 'urgency' },
  // 🚨 숫자 관련: P1 (critical)로 상향 - gpt52-prompts-staged.ts와 일관성 유지
  { word: '48시간', severity: 'critical', replacement: ['일정 시간', '상황에 따라'], reason: '숫자 완전 금지 (P1)', category: 'medical_law' },
  { word: '24시간', severity: 'critical', replacement: ['일정 시간', '상황에 따라'], reason: '숫자 완전 금지 (P1)', category: 'medical_law' },
  { word: '2~3일', severity: 'critical', replacement: ['며칠', '일정 기간'], reason: '숫자 완전 금지 (P1)', category: 'medical_law' },
  { word: '1주일', severity: 'critical', replacement: ['일정 기간', '며칠'], reason: '숫자 완전 금지 (P1)', category: 'medical_law' },
  
  // ===== Critical: 의료광고법 위반 (1인칭/정의형/행동유도/판단유도) =====
  { word: '저는', severity: 'critical', replacement: ['일반적으로', '(삭제)'], reason: '1인칭 표현 금지 (의료광고법)', category: 'first_person' },
  { word: '제가', severity: 'critical', replacement: ['일반적으로', '(삭제)'], reason: '1인칭 표현 금지 (의료광고법)', category: 'first_person' },
  { word: '저희', severity: 'critical', replacement: ['(삭제)', '일반적으로'], reason: '1인칭 표현 금지 (의료광고법)', category: 'first_person' },
  { word: '진료실', severity: 'critical', replacement: ['(삭제)', '(사용 금지)'], reason: '의사 사칭 주의 (의료광고법)', category: 'first_person' },
  { word: '진료 현장', severity: 'critical', replacement: ['일반적으로', '(사용 금지)'], reason: '의사 사칭 주의 (의료광고법)', category: 'first_person' },
  { word: '~란 무엇', severity: 'critical', replacement: ['자주 언급되는 것 중 하나가', '이 시기에 거론되는'], reason: '정의형 금지 (의료광고법)', category: 'definition' },
  { word: '~이란', severity: 'critical', replacement: ['자주 언급되는', '거론되는'], reason: '정의형 금지 (의료광고법)', category: 'definition' },
  // 🚨 행동 유도: P1 (critical)로 상향 - gpt52-prompts-staged.ts와 일관성 유지
  { word: '~해야 합니다', severity: 'critical', replacement: ['~경향을 보입니다', '~경우가 있습니다'], reason: '행동 유도 완전 금지 (P1)', category: 'urgency' },
  { word: '가능성이 높', severity: 'critical', replacement: ['언급되는 경우가 있습니다', '나타나는 경우도 있습니다'], reason: '판단 유도 금지 (의료광고법)', category: 'medical_law' },
  
  // ===== Critical: 의료광고법 위반 (문장 구조 패턴) =====
  // 효과 보장 문장 패턴
  { word: '~하면 낫습니다', severity: 'critical', replacement: ['~을 고려할 수 있습니다', '~경우가 있습니다'], reason: '효과 보장 문장 구조 금지 (의료광고법)', category: 'guarantee' },
  { word: '~로 치료됩니다', severity: 'critical', replacement: ['~을 고려할 수 있습니다', '~방법이 있습니다'], reason: '효과 보장 문장 구조 금지 (의료광고법)', category: 'guarantee' },
  { word: '~로 해결됩니다', severity: 'critical', replacement: ['~을 고려할 수 있습니다', '~방법이 있습니다'], reason: '효과 보장 문장 구조 금지 (의료광고법)', category: 'guarantee' },
  { word: '~하면 좋아집니다', severity: 'critical', replacement: ['~경우가 있습니다', '~도움이 되기도 합니다'], reason: '효과 보장 문장 구조 금지 (의료광고법)', category: 'guarantee' },
  { word: '~하면 개선됩니다', severity: 'critical', replacement: ['~변화가 나타나기도 합니다', '~경과를 확인할 수 있습니다'], reason: '효과 보장 문장 구조 금지 (의료광고법)', category: 'guarantee' },
  { word: '~하면 호전됩니다', severity: 'critical', replacement: ['~변화가 나타나기도 합니다', '~경과를 확인할 수 있습니다'], reason: '효과 보장 문장 구조 금지 (의료광고법)', category: 'guarantee' },
  { word: '~을 통해 치료', severity: 'critical', replacement: ['~을 통해 변화 확인', '~방법을 고려'], reason: '효과 보장 문장 구조 금지 (의료광고법)', category: 'guarantee' },
  { word: '~을 통해 개선', severity: 'critical', replacement: ['~을 통해 변화 확인', '~방법을 고려'], reason: '효과 보장 문장 구조 금지 (의료광고법)', category: 'guarantee' },
  { word: '~을 통해 호전', severity: 'critical', replacement: ['~을 통해 변화 확인', '~방법을 고려'], reason: '효과 보장 문장 구조 금지 (의료광고법)', category: 'guarantee' },
  
  // 진단/판단 유도 문장 패턴
  { word: '~일 수 있습니다', severity: 'critical', replacement: ['~으로 알려져 있습니다', '~경우도 있습니다'], reason: '진단 유도 문장 구조 금지 (의료광고법)', category: 'medical_law' },
  { word: '~이라면', severity: 'critical', replacement: ['~상황에서는', '~경우에는'], reason: '진단 유도 문장 구조 금지 (의료광고법)', category: 'medical_law' },
  { word: '~인지 확인', severity: 'critical', replacement: ['~상황을 살펴보기', '~경과 확인'], reason: '자가진단 유도 문장 구조 금지 (의료광고법)', category: 'medical_law' },
  { word: '셀프 체크', severity: 'critical', replacement: ['상황 확인', '경과 살펴보기'], reason: '자가진단 유도 문장 구조 금지 (의료광고법)', category: 'medical_law' },
  { word: '자가 진단', severity: 'critical', replacement: ['상황 확인', '경과 파악'], reason: '자가진단 유도 문장 구조 금지 (의료광고법)', category: 'medical_law' },
  { word: '스스로 체크', severity: 'critical', replacement: ['스스로 확인', '상황 살펴보기'], reason: '자가진단 유도 문장 구조 금지 (의료광고법)', category: 'medical_law' },
  { word: '본인의 증상', severity: 'critical', replacement: ['경험하는 상황', '나타나는 변화'], reason: '자가진단 유도 문장 구조 금지 (의료광고법)', category: 'medical_law' },
  
  // 비교 광고 문장 패턴
  { word: '다른 곳보다', severity: 'critical', replacement: ['(삭제)', '(사용 금지)'], reason: '비교 광고 문장 구조 금지 (의료광고법)', category: 'comparison' },
  { word: '타 의료기관', severity: 'critical', replacement: ['(삭제)', '(사용 금지)'], reason: '비교 광고 문장 구조 금지 (의료광고법)', category: 'comparison' },
  { word: '다른 병원보다', severity: 'critical', replacement: ['(삭제)', '(사용 금지)'], reason: '비교 광고 문장 구조 금지 (의료광고법)', category: 'comparison' },
  { word: '여기서만', severity: 'critical', replacement: ['(삭제)', '(사용 금지)'], reason: '비교 광고 문장 구조 금지 (의료광고법)', category: 'comparison' },
  { word: '유일하게', severity: 'critical', replacement: ['(삭제)', '(사용 금지)'], reason: '비교 광고 문장 구조 금지 (의료광고법)', category: 'comparison' },
  { word: '독보적', severity: 'critical', replacement: ['(삭제)', '(사용 금지)'], reason: '비교 광고 문장 구조 금지 (의료광고법)', category: 'comparison' },
  
  // 긴급성/공포 조장 문장 패턴
  { word: '빨리 치료하지 않으면', severity: 'critical', replacement: ['시간이 되실 때', '여유를 갖고'], reason: '공포 조장 문장 구조 금지 (의료광고법)', category: 'urgency' },
  { word: '방치할 경우', severity: 'critical', replacement: ['경과를 지켜보면', '시간이 지나면'], reason: '공포 조장 문장 구조 금지 (의료광고법)', category: 'urgency' },
  { word: '늦기 전에', severity: 'critical', replacement: ['시간이 되실 때', '여유가 되시면'], reason: '긴급성 과장 문장 구조 금지 (의료광고법)', category: 'urgency' },
  { word: '손쓸 수 없', severity: 'critical', replacement: ['경과가 달라질 수', '변화가 나타날 수'], reason: '공포 조장 문장 구조 금지 (의료광고법)', category: 'urgency' },
  { word: '악화될 수 있', severity: 'critical', replacement: ['변화가 나타날 수', '경과가 달라질 수'], reason: '공포 조장 문장 구조 금지 (의료광고법)', category: 'urgency' },
  { word: '더 심각해', severity: 'critical', replacement: ['변화가 나타나', '경과가 달라져'], reason: '공포 조장 문장 구조 금지 (의료광고법)', category: 'urgency' },
  { word: '큰일', severity: 'critical', replacement: ['주의가 필요', '살펴볼 필요'], reason: '공포 조장 문장 구조 금지 (의료광고법)', category: 'urgency' },
  
  // 행동 유도/강제성 문장 패턴
  { word: '~해야만 합니다', severity: 'critical', replacement: ['~경우가 있습니다', '~도움이 되기도 합니다'], reason: '행동 강제 문장 구조 금지 (의료광고법)', category: 'urgency' },
  { word: '반드시 ~해야', severity: 'critical', replacement: ['~도움이 될 수', '~고려할 수'], reason: '행동 강제 문장 구조 금지 (의료광고법)', category: 'urgency' },
  { word: '꼭 ~해야', severity: 'critical', replacement: ['~도움이 될 수', '~고려할 수'], reason: '행동 강제 문장 구조 금지 (의료광고법)', category: 'urgency' },
  { word: '필수적으로', severity: 'critical', replacement: ['도움이 되는', '고려해볼 만한'], reason: '행동 강제 문장 구조 금지 (의료광고법)', category: 'urgency' },
  { word: '꼭 필요', severity: 'critical', replacement: ['도움이 될 수 있는', '고려해볼 만한'], reason: '행동 강제 문장 구조 금지 (의료광고법)', category: 'urgency' },
  { word: '~하셔야 합니다', severity: 'critical', replacement: ['~경우가 있습니다', '~도움이 되기도 합니다'], reason: '행동 강제 문장 구조 금지 (의료광고법)', category: 'urgency' },
  { word: '~하시길 권합니다', severity: 'critical', replacement: ['~경우가 있습니다', '~도움이 되기도 합니다'], reason: '행동 강제 문장 구조 금지 (의료광고법)', category: 'urgency' },
  { word: '내원하셔야', severity: 'critical', replacement: ['내원하시면', '방문하시면'], reason: '행동 강제 문장 구조 금지 (의료광고법)', category: 'urgency' },
  
  // 기간/시간 명시 문장 패턴
  { word: '일주일 이내', severity: 'critical', replacement: ['일정 기간 내', '며칠 사이'], reason: '구체적 기간 명시 금지 (의료광고법)', category: 'medical_law' },
  { word: '며칠 안에', severity: 'critical', replacement: ['일정 기간 내', '시간이 지나면'], reason: '구체적 기간 명시 금지 (의료광고법)', category: 'medical_law' },
  { word: '3일 이내', severity: 'critical', replacement: ['며칠 사이', '일정 기간 내'], reason: '구체적 기간 명시 금지 (의료광고법)', category: 'medical_law' },
  { word: '5일 만에', severity: 'critical', replacement: ['며칠 만에', '일정 기간 후'], reason: '구체적 기간 명시 금지 (의료광고법)', category: 'medical_law' },
  { word: '2주 후', severity: 'critical', replacement: ['일정 기간 후', '시간이 지나면'], reason: '구체적 기간 명시 금지 (의료광고법)', category: 'medical_law' },
  { word: '한 달 내', severity: 'critical', replacement: ['일정 기간 내', '시간이 지나면'], reason: '구체적 기간 명시 금지 (의료광고법)', category: 'medical_law' },
  
  // 성공률/통계 제시 문장 패턴
  { word: '%의 환자', severity: 'critical', replacement: ['많은 분들', '일부 경우'], reason: '통계 제시 문장 구조 금지 (의료광고법)', category: 'guarantee' },
  { word: '만족도 %', severity: 'critical', replacement: ['(삭제)', '일반적으로'], reason: '통계 제시 문장 구조 금지 (의료광고법)', category: 'guarantee' },
  { word: '성공률', severity: 'critical', replacement: ['(삭제)', '경과 확인'], reason: '통계 제시 문장 구조 금지 (의료광고법)', category: 'guarantee' },
  { word: '개선율', severity: 'critical', replacement: ['(삭제)', '경과 확인'], reason: '통계 제시 문장 구조 금지 (의료광고법)', category: 'guarantee' },
  { word: '호전율', severity: 'critical', replacement: ['(삭제)', '경과 확인'], reason: '통계 제시 문장 구조 금지 (의료광고법)', category: 'guarantee' },
  { word: '대부분의 환자', severity: 'critical', replacement: ['많은 분들', '내원하시는 분들 중'], reason: '통계 제시 + 환자 표현 금지 (의료광고법)', category: 'guarantee' },
  { word: '거의 모든', severity: 'critical', replacement: ['많은', '흔한'], reason: '통계 과장 문장 구조 금지 (의료광고법)', category: 'guarantee' },
  
  // ===== P1: 구체적 표현 강화 =====
  // "확인이 필요", "점검해볼 필요" 문장 패턴
  { word: '확인이 필요', severity: 'critical', replacement: ['살펴보시면', '참고해보시면'], reason: '검사 유도 문장 구조 금지 (의료광고법)', category: 'urgency' },
  { word: '점검해볼 필요', severity: 'critical', replacement: ['살펴보시는 것도', '확인해보시는 것도'], reason: '검사 유도 문장 구조 금지 (의료광고법)', category: 'urgency' },
  { word: '확인해보는 것이 좋', severity: 'critical', replacement: ['살펴보시는 것도', '참고하시는 것도'], reason: '검사 유도 문장 구조 금지 (의료광고법)', category: 'urgency' },
  { word: '점검이 필요', severity: 'critical', replacement: ['살펴보시면', '확인해보시면'], reason: '검사 유도 문장 구조 금지 (의료광고법)', category: 'urgency' },
  
  // "병원에서", "검사로 확인" 표현
  { word: '병원에서', severity: 'critical', replacement: ['(삭제)', '내원 시'], reason: '병원 직접 언급 금지 (의료광고법)', category: 'medical_law' },
  { word: '검사로 확인', severity: 'critical', replacement: ['경과 확인', '살펴보기'], reason: '검사 유도 금지 (의료광고법)', category: 'medical_law' },
  { word: '검사를 통해', severity: 'critical', replacement: ['경과 확인을 통해', '살펴보면'], reason: '검사 유도 금지 (의료광고법)', category: 'medical_law' },
  { word: '의료진과 상담', severity: 'critical', replacement: ['(사용 금지)', '내원 상담'], reason: '의료진 표현 + 상담 유도 금지 (의료광고법)', category: 'medical_law' },
  
  // 구체적 검사명
  { word: '초음파', severity: 'critical', replacement: ['(삭제)', '영상 확인'], reason: '구체적 검사명 금지 (의료광고법)', category: 'medical_law' },
  { word: 'CT', severity: 'critical', replacement: ['(삭제)', '영상 확인'], reason: '구체적 검사명 금지 (의료광고법)', category: 'medical_law' },
  { word: 'MRI', severity: 'critical', replacement: ['(삭제)', '영상 확인'], reason: '구체적 검사명 금지 (의료광고법)', category: 'medical_law' },
  { word: 'X-ray', severity: 'critical', replacement: ['(삭제)', '영상 확인'], reason: '구체적 검사명 금지 (의료광고법)', category: 'medical_law' },
  { word: '엑스레이', severity: 'critical', replacement: ['(삭제)', '영상 확인'], reason: '구체적 검사명 금지 (의료광고법)', category: 'medical_law' },
  { word: '내시경', severity: 'critical', replacement: ['(삭제)', '확인'], reason: '구체적 검사명 금지 (의료광고법)', category: 'medical_law' },
  { word: '혈액검사', severity: 'critical', replacement: ['(삭제)', '확인'], reason: '구체적 검사명 금지 (의료광고법)', category: 'medical_law' },
  { word: '피검사', severity: 'critical', replacement: ['(삭제)', '확인'], reason: '구체적 검사명 금지 (의료광고법)', category: 'medical_law' },
  { word: '생검', severity: 'critical', replacement: ['(삭제)', '확인'], reason: '구체적 검사명 금지 (의료광고법)', category: 'medical_law' },
  
  // "원인은 ~", "특징은 ~" 정의형 패턴
  { word: '원인은', severity: 'critical', replacement: ['관련이 있는 것으로', '연관되는 것으로'], reason: '질환 정의형 금지 (의료광고법)', category: 'definition' },
  { word: '특징은', severity: 'critical', replacement: ['나타나는 것으로', '알려진 것은'], reason: '질환 정의형 금지 (의료광고법)', category: 'definition' },
  { word: '증상은', severity: 'critical', replacement: ['나타나는 경우는', '경험하는 것은'], reason: '질환 정의형 금지 (의료광고법)', category: 'definition' },
  { word: '발생 원인', severity: 'critical', replacement: ['관련된 요인', '연관된 부분'], reason: '질환 원인 설명 금지 (의료광고법)', category: 'definition' },
  
  // ===== P0: 서술 구조 패턴 감지 =====
  // 간접 연결 패턴
  { word: '~와 연관될 수 있', severity: 'critical', replacement: ['~와 관련이 있다고 알려져 있습니다', '~요인 중 하나로 거론됩니다'], reason: '질환 간접 연결 구조 금지 (의료광고법)', category: 'medical_law' },
  { word: '~와 관련이 있을 수', severity: 'critical', replacement: ['~와 관련이 있다고 알려져 있습니다', '~요인으로 언급됩니다'], reason: '질환 간접 연결 구조 금지 (의료광고법)', category: 'medical_law' },
  { word: '~의 가능성', severity: 'critical', replacement: ['~로 알려진 경우', '~로 언급되는 경우'], reason: '질환 추정 유도 금지 (의료광고법)', category: 'medical_law' },
  { word: '~을 의심해볼', severity: 'critical', replacement: ['~를 고려해볼', '~로 알려진'], reason: '진단 유도 구조 금지 (의료광고법)', category: 'medical_law' },
  
  // 증상 나열 → 확인 유도 흐름
  { word: '이런 증상이 있다면', severity: 'critical', replacement: ['이런 경우에는', '이런 상황에서는'], reason: '자가진단 유도 구조 금지 (의료광고법)', category: 'medical_law' },
  { word: '해당된다면', severity: 'critical', replacement: ['경우에는', '상황에서는'], reason: '자가진단 유도 구조 금지 (의료광고법)', category: 'medical_law' },
  { word: '나타난다면', severity: 'critical', replacement: ['나타나는 경우', '경험하는 경우'], reason: '자가진단 유도 구조 금지 (의료광고법)', category: 'medical_law' },
  { word: '체크해보세요', severity: 'critical', replacement: ['살펴보세요', '참고하세요'], reason: '자가진단 유도 구조 금지 (의료광고법)', category: 'medical_law' },
  { word: '확인해보시기 바랍니다', severity: 'critical', replacement: ['살펴보시면', '참고하시면'], reason: '검사 유도 구조 금지 (의료광고법)', category: 'urgency' },
  
  // 검사 방법을 해결책처럼 제시
  { word: '검사가 도움', severity: 'critical', replacement: ['살펴보는 것이 도움', '확인이 도움'], reason: '검사 해결책 제시 금지 (의료광고법)', category: 'medical_law' },
  { word: '검사를 받으면', severity: 'critical', replacement: ['살펴보면', '확인하면'], reason: '검사 유도 구조 금지 (의료광고법)', category: 'medical_law' },
  { word: '검사로 알 수', severity: 'critical', replacement: ['살펴볼 수', '확인할 수'], reason: '검사 유도 구조 금지 (의료광고법)', category: 'medical_law' },
  { word: '병원 방문', severity: 'critical', replacement: ['내원', '(삭제)'], reason: '병원 직접 언급 + 방문 유도 금지 (의료광고법)', category: 'urgency' },
  { word: '내원하시면', severity: 'critical', replacement: ['상황에 따라', '경우에 따라'], reason: '내원 유도 구조 금지 (의료광고법)', category: 'urgency' },
  
  // 여러 증상을 하나의 질환으로 수렴
  { word: '이는 ~의 신호', severity: 'critical', replacement: ['이는 나타나는 경우입니다', '이는 알려진 경우입니다'], reason: '질환 수렴 구조 금지 (의료광고법)', category: 'medical_law' },
  { word: '~일 가능성이 높', severity: 'critical', replacement: ['~로 알려진 경우', '~로 언급되는 경우'], reason: '질환 추정 유도 금지 (의료광고법)', category: 'medical_law' },
  { word: '~때문일 수', severity: 'critical', replacement: ['~관련이 있을 수', '~연관이 있을 수'], reason: '원인 단정 구조 금지 (의료광고법)', category: 'medical_law' },
];

// ============================================
// 2. 금지어 스캔 결과 인터페이스
// ============================================

export interface ScanResult {
  word: string;
  severity: ForbiddenWord['severity'];
  replacement: string[];
  reason: string;
  category: ForbiddenWord['category'];
  positions: { start: number; end: number }[];
  count: number;
}

export interface FullScanReport {
  totalViolations: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  violations: ScanResult[];
  safetyScore: number; // 0-100
  highlightedHtml: string; // 하이라이트된 HTML
}

// ============================================
// 3. 금지어 스캔 함수
// ============================================

/**
 * 텍스트에서 금지어 스캔
 */
export function scanForbiddenWords(text: string): FullScanReport {
  const violations: ScanResult[] = [];
  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;
  
  // HTML 태그 제거하고 텍스트만 추출
  const plainText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  
  FORBIDDEN_WORDS_DATABASE.forEach(fw => {
    // 단어 위치 찾기 (정규식으로 모든 매치 찾기)
    const regex = new RegExp(escapeRegex(fw.word), 'gi');
    const positions: { start: number; end: number }[] = [];
    let match;
    
    while ((match = regex.exec(plainText)) !== null) {
      positions.push({
        start: match.index,
        end: match.index + match[0].length
      });
    }
    
    if (positions.length > 0) {
      violations.push({
        word: fw.word,
        severity: fw.severity,
        replacement: fw.replacement,
        reason: fw.reason,
        category: fw.category,
        positions,
        count: positions.length
      });
      
      switch (fw.severity) {
        case 'critical': criticalCount += positions.length; break;
        case 'high': highCount += positions.length; break;
        case 'medium': mediumCount += positions.length; break;
        case 'low': lowCount += positions.length; break;
      }
    }
  });
  
  // 안전 점수 계산 (100점에서 감점)
  const deductions = criticalCount * 25 + highCount * 15 + mediumCount * 8 + lowCount * 3;
  const safetyScore = Math.max(0, Math.min(100, 100 - deductions));
  
  // 하이라이트된 HTML 생성
  const highlightedHtml = generateHighlightedHtml(text, violations);
  
  return {
    totalViolations: violations.length,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    violations: violations.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    }),
    safetyScore,
    highlightedHtml
  };
}

/**
 * 금지어를 하이라이트한 HTML 생성
 */
function generateHighlightedHtml(html: string, violations: ScanResult[]): string {
  let result = html;
  
  // 심각도별 색상
  const colors = {
    critical: '#EF4444', // 빨강
    high: '#F97316',     // 주황
    medium: '#EAB308',   // 노랑
    low: '#3B82F6'       // 파랑
  };
  
  // 긴 단어부터 치환 (짧은 단어가 긴 단어에 포함되어 있을 때 문제 방지)
  const sortedViolations = [...violations].sort((a, b) => b.word.length - a.word.length);
  
  sortedViolations.forEach(v => {
    const regex = new RegExp(`(${escapeRegex(v.word)})`, 'gi');
    const color = colors[v.severity];
    const tooltip = `${v.reason} → ${v.replacement[0]}`;
    
    result = result.replace(regex, 
      `<mark class="forbidden-word" style="background-color: ${color}20; border-bottom: 2px solid ${color}; cursor: help;" title="${tooltip}" data-severity="${v.severity}" data-replacement="${v.replacement[0]}">$1</mark>`
    );
  });
  
  return result;
}

/**
 * 정규식 특수문자 이스케이프
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================
// 4. SEO 실시간 분석
// ============================================

export interface SeoAnalysisResult {
  totalScore: number;
  titleScore: number;
  keywordDensityScore: number;
  firstParagraphScore: number;
  subheadingScore: number;
  readabilityScore: number;
  structuralRiskScore: number; // 추가: 구조적 위험 점수
  
  details: {
    titleLength: number;
    titleHasKeyword: boolean;
    keywordCount: number;
    keywordDensity: number; // 백분율
    firstParagraphHasKeyword: boolean;
    subheadingCount: number;
    avgSentenceLength: number;
    totalCharCount: number;
    diseasePatternCount: number; // 추가: 질환 중심 패턴 수
    checklistCount: number; // 추가: 체크리스트 패턴 수
    shortSentenceRatio: number; // 추가: 짧은 문장 비율
  };
  
  suggestions: string[];
}

/**
 * SEO 실시간 분석
 */
export function analyzeSeo(html: string, title: string, keyword: string): SeoAnalysisResult {
  // 본문 글자 수 계산을 위한 전처리 (제목, 해시태그, 이미지 마커 제외)
  let processedHtml = html;
  
  // 1. 제목 제거 (main-title 클래스, h1 태그)
  processedHtml = processedHtml.replace(/<[^>]*class="[^"]*main-title[^"]*"[^>]*>.*?<\/[^>]+>/gi, '');
  processedHtml = processedHtml.replace(/<h1[^>]*>.*?<\/h1>/gi, '');
  
  // 2. 해시태그 문단 제거 (#태그가 2개 이상 포함된 p 태그)
  processedHtml = processedHtml.replace(/<p[^>]*>([^<]*#[^<]*#[^<]*)<\/p>/gi, '');
  
  // 3. 이미지 마커 제거
  processedHtml = processedHtml.replace(/\[IMG_\d+\]/g, '');
  
  // 본문 텍스트 추출 (공백 제거 전)
  const plainText = processedHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  
  // 본문 글자 수 (공백 제외)
  const bodyCharCount = plainText.replace(/\s/g, '').length;
  
  const suggestions: string[] = [];
  
  // 1. 제목 분석
  const titleLength = title.length;
  const titleHasKeyword = keyword ? title.toLowerCase().includes(keyword.toLowerCase()) : true;
  let titleScore = 100;
  
  if (titleLength > 30) {
    titleScore -= 20;
    suggestions.push(`제목이 너무 깁니다 (${titleLength}자). 30자 이내로 줄여주세요.`);
  } else if (titleLength > 20) {
    titleScore -= 10;
  }
  
  if (keyword && !titleHasKeyword) {
    titleScore -= 30;
    suggestions.push('제목에 키워드가 포함되어 있지 않습니다.');
  }
  
  if (title.includes('?')) {
    titleScore -= 20;
    suggestions.push('제목에 물음표 사용을 피해주세요 (의료광고법).');
  }
  
  // 2. 키워드 밀도 분석 (3~4회 자연스러운 포함 기준)
  // bodyCharCount는 위에서 이미 계산됨 (제목, 해시태그, 이미지 마커 제외)
  const keywordCount = keyword ? (plainText.match(new RegExp(escapeRegex(keyword), 'gi')) || []).length : 0;
  const keywordDensity = keyword && bodyCharCount > 0 
    ? (keywordCount * keyword.length / bodyCharCount) * 100 
    : 0;
  
  let keywordDensityScore = 100;
  
  if (keyword) {
    // 3~4회 권장: 1000자 기준 약 1.0~1.6% 밀도
    if (keywordCount < 3) {
      keywordDensityScore -= 30;
      suggestions.push(`키워드가 ${keywordCount}회만 사용되었습니다. 3~4회 자연스럽게 추가해주세요.`);
    } else if (keywordDensity > 4) {
      keywordDensityScore -= 40;
      suggestions.push(`키워드 밀도가 너무 높습니다 (${keywordDensity.toFixed(1)}%). 키워드 스터핑으로 인식될 수 있습니다.`);
    } else if (keywordDensity > 3.5) {
      keywordDensityScore -= 15;
      suggestions.push(`키워드가 약간 많습니다 (${keywordCount}회). 3~4회가 적정합니다.`);
    } else if (keywordCount >= 3 && keywordCount <= 4) {
      // 최적 범위 (추가 점수 없음, 100점 유지)
    }
  }
  
  // 3. 첫 문단 키워드 체크
  const firstParagraph = plainText.slice(0, 200);
  const firstParagraphHasKeyword = keyword ? firstParagraph.toLowerCase().includes(keyword.toLowerCase()) : true;
  let firstParagraphScore = 100;
  
  if (keyword && !firstParagraphHasKeyword) {
    firstParagraphScore -= 40;
    suggestions.push('첫 문단(150자 이내)에 키워드가 없습니다. SEO를 위해 키워드를 추가해주세요.');
  }
  
  // 4. 소제목 분석
  const subheadingMatches = html.match(/<h[2-4][^>]*>/gi) || [];
  const subheadingCount = subheadingMatches.length;
  let subheadingScore = 100;
  
  if (bodyCharCount > 1500 && subheadingCount < 3) {
    subheadingScore -= 30;
    suggestions.push(`소제목이 부족합니다 (${subheadingCount}개). 최소 3~4개의 소제목을 권장합니다.`);
  } else if (subheadingCount < 2 && bodyCharCount > 800) {
    subheadingScore -= 20;
  }
  
  // 5. 가독성 분석
  const sentences = plainText.split(/[.!?。]/);
  const avgSentenceLength = sentences.length > 0 
    ? sentences.reduce((sum, s) => sum + s.trim().length, 0) / sentences.length 
    : 0;
  
  let readabilityScore = 100;
  
  if (avgSentenceLength > 80) {
    readabilityScore -= 25;
    suggestions.push('문장이 너무 깁니다. 짧고 간결한 문장으로 나눠주세요.');
  } else if (avgSentenceLength > 60) {
    readabilityScore -= 10;
  }
  
  // ===== P2: 네이버 SEO 위험 판정 (질환 중심 글, 체크리스트형 글) =====
  let structuralRiskScore = 100;
  
  // 6. 질환 중심 글 감지
  const diseasePatterns = [
    /질환.*원인/gi,
    /질환.*특징/gi,
    /질환.*증상/gi,
    /발생.*원인/gi,
    /원인은.*입니다/gi,
    /특징은.*입니다/gi,
    /증상은.*입니다/gi,
    /질병.*정의/gi,
    /질환.*정의/gi
  ];
  
  let diseasePatternCount = 0;
  diseasePatterns.forEach(pattern => {
    const matches = plainText.match(pattern);
    if (matches) diseasePatternCount += matches.length;
  });
  
  if (diseasePatternCount >= 3) {
    structuralRiskScore -= 40;
    suggestions.push('⚠️ 질환 중심 글로 판정될 위험: 증상/경험 중심으로 재구성하세요.');
  } else if (diseasePatternCount >= 2) {
    structuralRiskScore -= 20;
    suggestions.push('질환 정의형 표현이 많습니다. 독자 경험 중심으로 수정하세요.');
  }
  
  // 7. 체크리스트형 글 감지
  const checklistPatterns = [
    /1\./g,
    /2\./g,
    /3\./g,
    /✓/g,
    /□/g,
    /☑/g,
    /증상.*해당/gi,
    /체크.*필요/gi,
    /확인.*필요/gi,
    /이런 증상/gi,
    /다음 증상/gi
  ];
  
  let checklistCount = 0;
  checklistPatterns.forEach(pattern => {
    const matches = plainText.match(pattern);
    if (matches) checklistCount += matches.length;
  });
  
  // 나열 구조 감지 (연속된 짧은 문장)
  const shortSentences = sentences.filter(s => s.trim().length < 30 && s.trim().length > 5);
  const shortSentenceRatio = shortSentences.length / sentences.length;
  
  if ((checklistCount >= 5 || shortSentenceRatio > 0.4) && diseasePatternCount >= 1) {
    structuralRiskScore -= 50;
    suggestions.push('🚨 체크리스트형 글로 판정될 위험: 증상 나열 → 스토리텔링 구조로 변경하세요.');
  } else if (checklistCount >= 3 || shortSentenceRatio > 0.3) {
    structuralRiskScore -= 25;
    suggestions.push('나열형 구조가 많습니다. 이야기 흐름으로 연결하세요.');
  }
  
  // 총점 계산 (구조적 위험 추가)
  const totalScore = Math.round(
    titleScore * 0.22 +
    keywordDensityScore * 0.22 +
    firstParagraphScore * 0.18 +
    subheadingScore * 0.13 +
    readabilityScore * 0.13 +
    structuralRiskScore * 0.12  // 구조적 위험 가중치 추가
  );
  
  return {
    totalScore,
    titleScore: Math.max(0, titleScore),
    keywordDensityScore: Math.max(0, keywordDensityScore),
    firstParagraphScore: Math.max(0, firstParagraphScore),
    subheadingScore: Math.max(0, subheadingScore),
    readabilityScore: Math.max(0, readabilityScore),
    structuralRiskScore: Math.max(0, structuralRiskScore), // 추가
    details: {
      titleLength,
      titleHasKeyword,
      keywordCount,
      keywordDensity,
      firstParagraphHasKeyword,
      subheadingCount,
      avgSentenceLength,
      totalCharCount: bodyCharCount,
      diseasePatternCount, // 추가
      checklistCount, // 추가
      shortSentenceRatio // 추가
    },
    suggestions
  };
}

// ============================================
// 5. AI 냄새 후처리 검증
// ============================================

export interface AiSmellAnalysisResult {
  totalScore: number; // 100이 자연스러움
  issues: AiSmellIssue[];
  suggestions: string[];
}

export interface AiSmellIssue {
  type: 'repetition' | 'structure' | 'expression' | 'ending';
  description: string;
  examples: string[];
  severity: 'high' | 'medium' | 'low';
  fixSuggestion: string;
}

/**
 * AI 냄새 후처리 검증
 */
export function analyzeAiSmell(html: string): AiSmellAnalysisResult {
  const plainText = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const issues: AiSmellIssue[] = [];
  const suggestions: string[] = [];
  let deductions = 0;
  
  // 1. 종결어미 반복 체크
  const endingPatterns = [
    { pattern: /수 있습니다/g, name: '~수 있습니다', threshold: 3 },
    { pattern: /하는 것이 좋습니다/g, name: '~하는 것이 좋습니다', threshold: 2 },
    { pattern: /알려져 있습니다/g, name: '~알려져 있습니다', threshold: 2 },
    { pattern: /됩니다\./g, name: '~됩니다', threshold: 4 },
    { pattern: /합니다\./g, name: '~합니다', threshold: 4 },
    { pattern: /입니다\./g, name: '~입니다', threshold: 4 },
  ];
  
  endingPatterns.forEach(({ pattern, name, threshold }) => {
    const matches = plainText.match(pattern) || [];
    if (matches.length >= threshold) {
      const overCount = matches.length - threshold + 1;
      deductions += overCount * 8;
      issues.push({
        type: 'ending',
        description: `"${name}" 표현이 ${matches.length}회 반복됨`,
        examples: matches.slice(0, 3),
        severity: overCount >= 3 ? 'high' : 'medium',
        fixSuggestion: `다양한 종결어미로 교체 (~경우가 있습니다, ~편입니다, ~기도 합니다)`
      });
    }
  });
  
  // 2. AI 특유의 구조적 패턴 체크
  if ((plainText.match(/이처럼|따라서|결론적으로|요약하면/g)?.length ?? 0) >= 3) {
    deductions += 15;
    issues.push({
      type: 'structure',
      description: '접속부사 과다 사용 (이처럼, 따라서 등)',
      examples: ['이처럼', '따라서', '결론적으로'],
      severity: 'medium',
      fixSuggestion: '자연스러운 연결 (그래서, 이렇게 보면, 이런 상황에서)'
    });
  }
  
  // 3. 정의형 시작 체크
  if (plainText.match(/^[가-힣]+은\/는|[가-힣]+이란 |[가-힣]+란 무엇/)) {
    deductions += 20;
    issues.push({
      type: 'expression',
      description: '교과서식 정의형 시작',
      examples: ['~란 무엇인가요?', '~이란 ~을 의미합니다'],
      severity: 'high',
      fixSuggestion: '상황 묘사로 시작 (예: "요즘 ~한 경험을 하시는 분들이 있습니다")'
    });
  }
  
  // 4. 메타 설명 체크
  if (plainText.match(/이 글에서는|이번 포스팅에서는|오늘은.*?알아보겠습니다/)) {
    deductions += 15;
    issues.push({
      type: 'expression',
      description: '메타 설명 포함 (블로그 전형적 표현)',
      examples: ['이 글에서는', '오늘은 ~에 대해 알아보겠습니다'],
      severity: 'medium',
      fixSuggestion: '바로 본문 내용으로 시작 (삭제 권장)'
    });
  }
  
  // 5. 추상명사 연결 과다
  const abstractCount = (plainText.match(/기준을|방법을|과정을|단계를|사례를|시점을/g) || []).length;
  if (abstractCount > 5) {
    deductions += abstractCount * 3;
    issues.push({
      type: 'expression',
      description: `추상명사 과다 사용 (${abstractCount}개)`,
      examples: ['기준을', '방법을', '과정을'],
      severity: 'low',
      fixSuggestion: '구체적인 상황으로 대체 (때, 경우, 순간 등)'
    });
  }
  
  // 6. 나열 패턴 체크
  if (plainText.match(/인지,.*?인지,.*?인지/)) {
    deductions += 12;
    issues.push({
      type: 'structure',
      description: '~인지 나열 패턴 발견',
      examples: ['~인지, ~인지, ~인지'],
      severity: 'medium',
      fixSuggestion: '다른 구조로 풀어서 작성'
    });
  }

  // 7. 원 숫자 사용 체크 (AI 특유 패턴)
  const circleNumbers = plainText.match(/[①②③④⑤⑥⑦⑧⑨⑩]/g) || [];
  if (circleNumbers.length > 0) {
    deductions += circleNumbers.length * 10;
    issues.push({
      type: 'structure',
      description: `원 숫자 사용 (${circleNumbers.length}개) - AI 특유 표현`,
      examples: circleNumbers.slice(0, 3),
      severity: 'high',
      fixSuggestion: '일반 숫자(1, 2, 3) 또는 한글(첫째, 둘째)로 변경'
    });
  }

  // 8. 연결어 과다 체크 (문장 흐름 부자연스러움)
  const conjunctionMatches = plainText.match(/그러나|하지만|그런데|그렇지만|그럼에도|한편|반면에/g) || [];
  if (conjunctionMatches.length >= 5) {
    deductions += (conjunctionMatches.length - 4) * 5;
    issues.push({
      type: 'structure',
      description: `연결어 과다 (${conjunctionMatches.length}회) - 딱딱한 문체`,
      examples: conjunctionMatches.slice(0, 3),
      severity: 'medium',
      fixSuggestion: '연결어 없이 자연스러운 흐름으로 작성 (일부 문장 통합)'
    });
  }

  // 9. 강조 부사 과다 체크 (과장된 표현)
  const emphasisMatches = plainText.match(/매우|굉장히|상당히|아주|너무|정말|극도로|심각하게/g) || [];
  if (emphasisMatches.length >= 6) {
    deductions += (emphasisMatches.length - 5) * 4;
    issues.push({
      type: 'expression',
      description: `강조 부사 과다 (${emphasisMatches.length}회) - 과장된 느낌`,
      examples: emphasisMatches.slice(0, 3),
      severity: 'medium',
      fixSuggestion: '강조 부사 줄이고 구체적 상황으로 표현 (예: "매우 많다" → "흔히 있는 경우", "상당히 높다" → "드물지 않게")'
    });
  }

  // 10. 번역투 표현 체크 (영어 → 한국어 직역)
  const translationPatterns = [
    { pattern: /하는 것이[다|ㅂ니다|중요|필수|좋]/g, name: '~하는 것이다 (명사형 종결)' },
    { pattern: /에 있어서/g, name: '~에 있어서' },
    { pattern: /함으로써|하기 위해서는/g, name: '~함으로써/하기 위해서는' },
    { pattern: /되어지|이루어지|여겨지/g, name: '피동태 과다 (되어지다)' },
    { pattern: /을 통해|로 인해|에 의해/g, name: '~을 통해/로 인해/에 의해' }
  ];

  translationPatterns.forEach(({ pattern, name }) => {
    const matches = plainText.match(pattern) || [];
    if (matches.length >= 3) {
      deductions += matches.length * 6;
      issues.push({
        type: 'structure',
        description: `번역투 표현 "${name}" 과다 (${matches.length}회)`,
        examples: matches.slice(0, 3),
        severity: 'high',
        fixSuggestion: '자연스러운 한국어로 변경 (예: "~하는 것이다" → "~습니다", "~에 있어서" → "~에서/때")'
      });
    }
  });

  // 11. 문장 길이 패턴 체크 (균등하면 AI 냄새)
  const sentences = plainText.split(/[.!?]\s+/).filter(s => s.length > 10);
  if (sentences.length >= 5) {
    const lengths = sentences.map(s => s.length);
    const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / lengths.length;
    const stdDev = Math.sqrt(variance);

    // 표준편차가 15 이하면 너무 균등 (AI 패턴)
    if (stdDev < 15 && sentences.length >= 8) {
      deductions += 12;
      issues.push({
        type: 'structure',
        description: `문장 길이가 너무 균등함 (표준편차: ${stdDev.toFixed(1)}) - AI 패턴 의심`,
        examples: [`평균 ${avgLength.toFixed(0)}자 내외로 반복`],
        severity: 'medium',
        fixSuggestion: '짧은 문장(10~15자), 중간 문장(20~30자), 긴 문장(35~45자)을 섞어서 리듬감 있게 작성'
      });
    }
  }

  // 12. 문단 시작 패턴 반복 감지
  const paragraphs = html.split(/<\/p>|<br\s*\/?>/i).filter(p => p.trim().length > 20);
  const startPatterns: string[] = [];
  paragraphs.forEach(p => {
    const text = p.replace(/<[^>]*>/g, '').trim();
    const firstChars = text.substring(0, 2);
    if (firstChars) startPatterns.push(firstChars);
  });

  // 같은 시작 패턴 3회 연속 체크
  let consecutiveCount = 1;
  let maxConsecutive = 1;
  for (let i = 1; i < startPatterns.length; i++) {
    if (startPatterns[i] === startPatterns[i-1]) {
      consecutiveCount++;
      maxConsecutive = Math.max(maxConsecutive, consecutiveCount);
    } else {
      consecutiveCount = 1;
    }
  }

  if (maxConsecutive >= 3) {
    deductions += maxConsecutive * 5;
    issues.push({
      type: 'structure',
      description: `같은 문단 시작 패턴 ${maxConsecutive}회 연속 - 단조로운 구조`,
      examples: ['문단 시작을 다양하게 (설명형/상황형/조건형/시간형/비교형)'],
      severity: 'medium',
      fixSuggestion: '각 문단을 다른 방식으로 시작 (예: "무릎 통증은~" → "아침에 일어날 때~" → "만약 통증이~")'
    });
  }

  // 13. 1인칭/2인칭 직접 지칭 체크 (체험담 느낌)
  const firstPersonMatches = plainText.match(/저는|제가|우리|저희 병원|저희는/g) || [];
  const secondPersonMatches = plainText.match(/당신은|당신의|여러분은|여러분의/g) || [];
  const totalPersonal = firstPersonMatches.length + secondPersonMatches.length;

  if (totalPersonal >= 2) {
    deductions += totalPersonal * 8;
    issues.push({
      type: 'expression',
      description: `인칭 대명사 과다 (${totalPersonal}회) - 체험담/광고 느낌`,
      examples: [...firstPersonMatches.slice(0, 2), ...secondPersonMatches.slice(0, 2)],
      severity: 'high',
      fixSuggestion: '3인칭 관찰자 시점으로 변경 (예: "저는" → 삭제, "여러분은" → "~하는 분들은")'
    });
  }

  // 14. 본문 내 이모지 과다 사용 감지
  const emojiInContent = plainText.match(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu) || [];
  if (emojiInContent.length > 5) {
    deductions += emojiInContent.length * 3;
    issues.push({
      type: 'expression',
      description: `본문 내 이모지 과다 (${emojiInContent.length}개) - 부적절`,
      examples: emojiInContent.slice(0, 5),
      severity: 'medium',
      fixSuggestion: '이모지는 소제목(H3)에만 사용하고 본문에서는 제거'
    });
  }

  // 15. 감정 과도 표현 체크
  const emotionalMatches = plainText.match(/끔찍한|엄청난|심각한|굉장한|놀라운|대단한/g) || [];
  if (emotionalMatches.length >= 3) {
    deductions += emotionalMatches.length * 7;
    issues.push({
      type: 'expression',
      description: `감정 과도 표현 (${emotionalMatches.length}회) - 과장된 느낌`,
      examples: emotionalMatches.slice(0, 3),
      severity: 'high',
      fixSuggestion: '객관적 표현으로 변경 (예: "끔찍한 통증" → "밤잠을 설칠 정도의 통증")'
    });
  }

  // 16. 구어체 표현 과다 체크 (자연스러움 목적이지만 과하면 부적절)
  const colloquialMatches = plainText.match(/거든요|잖아요|더라고요|~ㅋㅋ|~ㅎㅎ|~요~/g) || [];
  if (colloquialMatches.length > 10) {
    deductions += (colloquialMatches.length - 10) * 4;
    issues.push({
      type: 'expression',
      description: `구어체 과다 (${colloquialMatches.length}회) - 지나치게 캐주얼`,
      examples: colloquialMatches.slice(0, 3),
      severity: 'low',
      fixSuggestion: '적당한 구어체만 유지 (글 전체 8~10회 이하 권장)'
    });
  }

  // 제안 생성
  if (deductions > 30) {
    suggestions.push('종결어미를 더 다양하게 사용해보세요.');
  }
  if (issues.some(i => i.type === 'structure')) {
    suggestions.push('AI 특유의 구조적 패턴을 자연스럽게 수정해보세요.');
  }
  if (issues.some(i => i.type === 'expression' && i.severity === 'high')) {
    suggestions.push('도입부를 상황 묘사 형식으로 변경해보세요.');
  }
  if (issues.some(i => i.description.includes('번역투'))) {
    suggestions.push('번역투 표현을 자연스러운 한국어로 변경해보세요.');
  }
  if (issues.some(i => i.description.includes('문장 길이'))) {
    suggestions.push('문장 길이를 다양하게 (짧음/중간/긴 문장 섞기)');
  }
  if (issues.some(i => i.description.includes('인칭 대명사'))) {
    suggestions.push('1인칭/2인칭 제거하고 3인칭 관찰자 시점으로 작성');
  }
  if (issues.some(i => i.description.includes('감정 과도'))) {
    suggestions.push('과장된 감정 표현 대신 구체적 상황으로 표현');
  }
  
  const totalScore = Math.max(0, Math.min(100, 100 - deductions));
  
  return {
    totalScore,
    issues: issues.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    }),
    suggestions
  };
}

// ============================================
// 6. 통합 분석 리포트
// ============================================

export interface FullAnalysisReport {
  medicalLaw: FullScanReport;
  seo: SeoAnalysisResult;
  aiSmell: AiSmellAnalysisResult;
  overallScore: number;
  overallGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  topIssues: string[];
}

/**
 * 통합 분석
 */
export function analyzeContent(
  html: string, 
  title: string, 
  keyword: string
): FullAnalysisReport {
  const medicalLaw = scanForbiddenWords(html);
  const seo = analyzeSeo(html, title, keyword);
  const aiSmell = analyzeAiSmell(html);
  
  // 종합 점수 (가중치: 의료법 40%, SEO 30%, AI냄새 30%)
  const overallScore = Math.round(
    medicalLaw.safetyScore * 0.4 +
    seo.totalScore * 0.3 +
    aiSmell.totalScore * 0.3
  );
  
  // 등급 계산
  let overallGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  if (overallScore >= 90) overallGrade = 'A';
  else if (overallScore >= 80) overallGrade = 'B';
  else if (overallScore >= 70) overallGrade = 'C';
  else if (overallScore >= 60) overallGrade = 'D';
  else overallGrade = 'F';
  
  // 주요 이슈 3개
  const topIssues: string[] = [];
  
  if (medicalLaw.criticalCount > 0) {
    topIssues.push(`🚨 의료법 중대 위반 ${medicalLaw.criticalCount}건`);
  }
  if (medicalLaw.highCount > 0) {
    topIssues.push(`⚠️ 의료법 주의 표현 ${medicalLaw.highCount}건`);
  }
  if (seo.totalScore < 70) {
    topIssues.push(`📉 SEO 점수 개선 필요 (${seo.totalScore}점)`);
  }
  if (aiSmell.totalScore < 70) {
    topIssues.push(`🤖 AI 냄새 감지 (자연스러움 ${aiSmell.totalScore}점)`);
  }
  
  if (topIssues.length === 0) {
    topIssues.push('✅ 전반적으로 양호합니다');
  }
  
  return {
    medicalLaw,
    seo,
    aiSmell,
    overallScore,
    overallGrade,
    topIssues: topIssues.slice(0, 3)
  };
}
