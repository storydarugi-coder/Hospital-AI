/**
 * GPT-5.2 프롬프트 시스템 v5.2
 * 
 * v5.2 변경:
 * - 🆕 진료과별 동적 프롬프트 시스템 추가
 * - 진료과마다 맞춤 예시/표현/금지어 적용
 * 
 * v5.1 변경:
 * - 시스템/유저 프롬프트 분리 (캐시 최적화)
 * - 규칙 우선순위 P1/P2/P3 명시
 * - 네거티브 예시 제거 (금지어만)
 * - JSON 키 축약 (t/c/i)
 * - 1-shot 예시 추가
 */

import { ContentCategory } from '../types';

/**
 * 진료과별 동적 프롬프트 데이터
 * - 각 진료과마다 맞춤 예시, 표현, 추가 금지어 정의
 */
export interface DepartmentPromptData {
  name: string;                    // 진료과명
  commonSymptoms: string[];        // 자주 다루는 증상/주제
  exampleTitle: string;            // 예시 제목
  exampleContent: string;          // 예시 본문 (HTML)
  exampleImages: string[];         // 예시 이미지 프롬프트
  situationalPhrases: string[];    // 상황 묘사 표현
  additionalBannedWords?: string[];// 진료과 특수 금지어
  ctaStyle: string;                // CTA 스타일
}

/**
 * 진료과별 동적 프롬프트 데이터베이스
 */
export const DEPARTMENT_PROMPTS: Record<ContentCategory, DepartmentPromptData> = {
  [ContentCategory.ORTHOPEDICS]: {
    name: '정형외과',
    commonSymptoms: ['어깨 통증', '무릎 통증', '허리 통증', '손목 통증', '관절 뻣뻣함'],
    exampleTitle: '어깨 뻣뻣할 때 확인법',
    exampleContent: `<p>패딩 소매에 팔을 넣다가 걸리는 느낌이 반복되는 경우가 있다. 특히 아침에 일어났을 때 어깨가 굳어 있는 듯한 느낌이 드는 분들이 있다.</p><h3>팔 올리기가 힘들어졌을 때</h3><p>임상에서 자주 보이는 패턴 중 하나는 샤워기 뒤로 닿기가 불편해지는 경우다. 이런 경험을 하는 분들 중에는...</p><h3>밤에 유독 더 불편한 이유</h3><p>야간에 옆으로 돌아눕다가 깨어나는 경험을 하는 분들이 있다. 개인차가 있으므로...</p><h3>이런 경험이 있다면</h3><p>아래 상황이 익숙하게 느껴진다면 한번 살펴볼 만하다...</p><p>증상이 지속된다면 전문적인 확인을 받아보는 것도 방법이다.</p>`,
    exampleImages: ['어깨 스트레칭하는 중년 여성', '밤에 어깨 불편해하는 모습'],
    situationalPhrases: [
      '계단을 오를 때 무릎에서 소리가 나는 경우',
      '앉았다 일어날 때 허리가 뻣뻣한 느낌',
      '마우스 오래 쓰다 보면 손목이 저린 경험',
      '잠자리에서 돌아눕기 불편한 분들'
    ],
    additionalBannedWords: ['파열', '손상', '골절 의심'],
    ctaStyle: '움직임이 불편하다면 전문적인 확인을 받아보는 것도 방법이다'
  },

  [ContentCategory.DERMATOLOGY]: {
    name: '피부과',
    commonSymptoms: ['여드름', '기미', '주름', '모공', '피부 트러블', '탈모'],
    exampleTitle: '세안 후 당김 느낄 때',
    exampleContent: `<p>세안 후 거울을 보다가 피부가 땅기는 느낌이 드는 경우가 있다. 특히 환절기에 이런 경험을 하는 분들이 늘어나는 편이다.</p><h3>피부가 예민해진 것 같을 때</h3><p>평소 쓰던 제품인데 갑자기 따가운 느낌이 드는 경우가 있다. 내원하시는 분들 중에는 이런 변화를 겪는 분들이...</p><h3>붉어짐이 쉽게 가라앉지 않을 때</h3><p>얼굴이 달아오른 느낌이 오래 지속되는 경험을 하는 분들이 있다...</p><p>피부 상태가 신경 쓰인다면 전문적인 상담을 받아보는 것도 방법이다.</p>`,
    exampleImages: ['거울 보며 피부 걱정하는 여성', '환절기 건조한 피부 이미지'],
    situationalPhrases: [
      '화장이 들뜨는 날이 많아진 경우',
      '거울 볼 때 신경 쓰이는 부분이 생긴 분들',
      '마스크 벗고 나서 피부 컨디션이 달라진 느낌',
      '아침저녁 피부 상태가 다르게 느껴질 때'
    ],
    additionalBannedWords: ['완치', '제거', '없애다'],
    ctaStyle: '피부 상태가 신경 쓰인다면 전문적인 상담을 받아보는 것도 방법이다'
  },

  [ContentCategory.DENTAL]: {
    name: '치과',
    commonSymptoms: ['충치', '잇몸 출혈', '시린 이', '치아 변색', '사랑니'],
    exampleTitle: '시린 느낌 있을 때 체크법',
    exampleContent: `<p>아이스크림을 먹다가 이가 시린 경험을 해본 적이 있을 것이다. 가끔은 양치할 때도 이런 느낌이 드는 분들이 있다.</p><h3>찬 음식에 유독 민감할 때</h3><p>여름철 시원한 음료를 마실 때 순간적으로 찌릿한 느낌이 드는 경우가 있다. 내원하시는 분들 중에는...</p><h3>양치할 때 피가 비치는 경우</h3><p>칫솔질 후 거품에 분홍빛이 섞여 나오는 경험을 하는 분들이 있다...</p><p>구강 상태가 신경 쓰인다면 정기적인 체크를 받아보는 것도 방법이다.</p>`,
    exampleImages: ['치아 건강 체크하는 모습', '양치하는 일상 이미지'],
    situationalPhrases: [
      '뜨거운 국물 먹을 때 이가 시린 경우',
      '양치 후 잇몸에서 피가 비치는 분들',
      '단 것 먹고 나면 욱신거리는 느낌',
      '아침에 일어났을 때 입 안이 텁텁한 경우'
    ],
    additionalBannedWords: ['발치', '신경치료', '임플란트 수술'],
    ctaStyle: '구강 상태가 신경 쓰인다면 정기적인 체크를 받아보는 것도 방법이다'
  },

  [ContentCategory.PLASTIC_SURGERY]: {
    name: '성형외과',
    commonSymptoms: ['쌍꺼풀', '코 라인', '윤곽', '안티에이징', '리프팅'],
    exampleTitle: '눈매 인상 고민될 때',
    exampleContent: `<p>사진을 찍고 나서 눈이 작아 보인다고 느끼는 경우가 있다. 피곤해 보인다는 말을 자주 듣는 분들도 있다.</p><h3>인상이 달라 보이고 싶을 때</h3><p>셀카를 찍을 때 각도를 여러 번 바꿔보는 경험을 하는 분들이 있다. 내원하시는 분들 중에는 자연스러운 변화를 원하는 경우가...</p><h3>자연스러움이 중요한 분들</h3><p>티 나지 않으면서 달라 보이고 싶은 마음을 가진 분들이 있다...</p><p>고민이 있다면 전문적인 상담을 통해 정보를 얻어보는 것도 방법이다.</p>`,
    exampleImages: ['자연스러운 눈매의 여성', '카메라 들고 셀카 찍는 모습'],
    situationalPhrases: [
      '사진 찍을 때 각도 신경 쓰이는 분들',
      '화장으로 커버하기 어려운 고민이 있는 경우',
      '예전 사진과 비교했을 때 달라진 느낌',
      '피곤해 보인다는 말을 자주 듣는 분들'
    ],
    additionalBannedWords: ['성형', '수술', '시술 후', '다운타임'],
    ctaStyle: '고민이 있다면 전문적인 상담을 통해 정보를 얻어보는 것도 방법이다'
  },

  [ContentCategory.INTERNAL_MEDICINE]: {
    name: '내과',
    commonSymptoms: ['소화불량', '피로감', '두통', '어지러움', '감기 증상'],
    exampleTitle: '피로 쉽게 느낄 때 체크',
    exampleContent: `<p>충분히 잔 것 같은데도 아침에 개운하지 않은 경우가 있다. 오후만 되면 유독 피곤해지는 분들도 있다.</p><h3>쉬어도 피곤이 안 풀릴 때</h3><p>주말에 푹 쉬었는데도 월요일 아침이 힘든 경험을 하는 분들이 있다. 내원하시는 분들 중에는...</p><h3>식사 후 더부룩함이 자주 느껴질 때</h3><p>밥 먹고 나면 속이 답답한 느낌이 드는 분들이 있다...</p><p>컨디션 관리가 필요하다면 건강 상태를 점검받아보는 것도 방법이다.</p>`,
    exampleImages: ['피곤해하며 커피 마시는 직장인', '건강검진 받는 모습'],
    situationalPhrases: [
      '아침에 일어나기 유독 힘든 날이 많은 경우',
      '점심 먹고 나면 졸음이 쏟아지는 분들',
      '계절 바뀔 때마다 컨디션이 떨어지는 느낌',
      '물을 많이 마셔도 갈증이 해소되지 않는 경우'
    ],
    ctaStyle: '컨디션 관리가 필요하다면 건강 상태를 점검받아보는 것도 방법이다'
  },

  [ContentCategory.OBGYN]: {
    name: '산부인과',
    commonSymptoms: ['생리불순', '생리통', '갱년기', '임신 준비', '여성 건강'],
    exampleTitle: '생리 주기 불규칙할 때',
    exampleContent: `<p>달력에 표시해둔 날짜가 지나도 생리가 시작되지 않아 신경 쓰이는 경우가 있다. 주기가 들쭉날쭉해서 예측하기 어려운 분들도 있다.</p><h3>주기가 일정하지 않을 때</h3><p>한 달에 두 번 하는 달도 있고, 건너뛰는 달도 있는 경험을 하는 분들이 있다...</p><h3>컨디션 변화가 심할 때</h3><p>생리 전후로 기분이나 몸 상태가 크게 달라지는 분들이 있다...</p><p>주기적인 관리가 필요하다면 전문 상담을 받아보는 것도 방법이다.</p>`,
    exampleImages: ['달력 보며 체크하는 여성', '편안하게 차 마시는 여성'],
    situationalPhrases: [
      '생리 예정일을 예측하기 어려운 분들',
      '주기적으로 불편함을 느끼는 경우',
      '예전과 달리 컨디션 변화가 심해진 느낌',
      '체크해야 할 시기인지 고민되는 분들'
    ],
    additionalBannedWords: ['임신 확률', '불임', '완치율'],
    ctaStyle: '주기적인 관리가 필요하다면 전문 상담을 받아보는 것도 방법이다'
  },

  [ContentCategory.BREAST_SURGERY]: {
    name: '유방외과',
    commonSymptoms: ['유방 통증', '멍울', '유방 검진', '유두 분비물'],
    exampleTitle: '유방 자가검진 체크법',
    exampleContent: `<p>샤워하다가 무언가 만져지는 느낌이 들어 신경 쓰이는 경우가 있다. 생리 전후로 가슴이 뭉치는 느낌을 받는 분들도 있다.</p><h3>만져지는 느낌이 있을 때</h3><p>평소와 다르게 뭔가 잡히는 듯한 느낌이 드는 경우가 있다. 내원하시는 분들 중에는...</p><p>정기적인 체크가 필요하다면 검진을 받아보는 것도 방법이다.</p>`,
    exampleImages: ['건강검진 상담 받는 여성', '자가검진 설명 일러스트'],
    situationalPhrases: [
      '샤워할 때 평소와 다른 느낌이 드는 경우',
      '주기적으로 가슴이 뭉치는 느낌을 받는 분들',
      '가족력 때문에 체크가 필요한 분들'
    ],
    additionalBannedWords: ['암', '종양', '양성/악성'],
    ctaStyle: '정기적인 체크가 필요하다면 검진을 받아보는 것도 방법이다'
  },

  [ContentCategory.THYROID_SURGERY]: {
    name: '갑상선외과',
    commonSymptoms: ['목 이물감', '갑상선 결절', '갑상선 검진', '목 부음'],
    exampleTitle: '목에 뭔가 걸린 느낌일 때',
    exampleContent: `<p>물을 삼킬 때 뭔가 걸리는 듯한 느낌이 드는 경우가 있다. 거울로 목을 봤을 때 평소와 달라 보이는 것 같아 신경 쓰이는 분들도 있다.</p><h3>삼킬 때 불편함이 있을 때</h3><p>침을 삼킬 때마다 이물감이 느껴지는 경험을 하는 분들이 있다...</p><p>목 상태가 신경 쓰인다면 검진을 받아보는 것도 방법이다.</p>`,
    exampleImages: ['목 부위 만지며 거울 보는 여성', '건강검진 모습'],
    situationalPhrases: [
      '침 삼킬 때 뭔가 걸리는 느낌이 드는 경우',
      '목 부위가 평소와 달라 보이는 분들',
      '피로감과 함께 목 불편함을 느끼는 경우'
    ],
    additionalBannedWords: ['암', '종양', '수술'],
    ctaStyle: '목 상태가 신경 쓰인다면 검진을 받아보는 것도 방법이다'
  },

  [ContentCategory.OPHTHALMOLOGY]: {
    name: '안과',
    commonSymptoms: ['눈 피로', '시력 저하', '안구건조', '눈 충혈', '노안'],
    exampleTitle: '눈이 쉽게 피로할 때',
    exampleContent: `<p>하루 종일 모니터를 보다 보면 눈이 뻑뻑해지는 경우가 있다. 퇴근할 때쯤 눈이 침침해지는 분들도 있다.</p><h3>인공눈물을 자주 넣게 될 때</h3><p>눈이 건조해서 하루에 여러 번 인공눈물을 찾게 되는 분들이 있다...</p><h3>작은 글씨가 잘 안 보일 때</h3><p>예전엔 잘 보이던 글씨가 요즘 흐릿하게 느껴지는 경우가 있다...</p><p>눈 상태가 신경 쓰인다면 정기적인 체크를 받아보는 것도 방법이다.</p>`,
    exampleImages: ['모니터 보며 눈 비비는 직장인', '안경 쓰고 책 읽는 중년'],
    situationalPhrases: [
      '모니터 오래 보면 눈이 뻑뻑해지는 분들',
      '작은 글씨가 예전보다 흐릿하게 보이는 경우',
      '눈이 자주 충혈되는 분들',
      '밤에 운전할 때 빛 번짐이 느껴지는 경우'
    ],
    ctaStyle: '눈 상태가 신경 쓰인다면 정기적인 체크를 받아보는 것도 방법이다'
  },

  [ContentCategory.ENT]: {
    name: '이비인후과',
    commonSymptoms: ['코막힘', '귀 먹먹함', '목 통증', '비염', '코골이'],
    exampleTitle: '코막힘 반복될 때 체크',
    exampleContent: `<p>계절이 바뀔 때마다 코가 막히는 경우가 있다. 아침에 일어나면 유독 코가 답답한 분들도 있다.</p><h3>한쪽 코만 자주 막힐 때</h3><p>번갈아가며 한쪽씩 막히는 경험을 하는 분들이 있다...</p><h3>자고 일어나면 목이 칼칼할 때</h3><p>밤새 입으로 숨을 쉬어서 목이 건조해지는 경우가 있다...</p><p>호흡이 불편하다면 원인을 확인받아보는 것도 방법이다.</p>`,
    exampleImages: ['코 막혀서 불편해하는 모습', '아침에 목 만지는 직장인'],
    situationalPhrases: [
      '환절기마다 코가 막히는 분들',
      '자고 일어나면 목이 칼칼한 경우',
      '귀가 먹먹한 느낌이 자주 드는 분들',
      '코골이 때문에 숙면을 못 하는 경우'
    ],
    ctaStyle: '호흡이 불편하다면 원인을 확인받아보는 것도 방법이다'
  },

  [ContentCategory.PSYCHIATRY]: {
    name: '정신건강의학과',
    commonSymptoms: ['불면', '우울감', '불안', '스트레스', '번아웃'],
    exampleTitle: '잠들기 어려운 밤이 많을 때',
    exampleContent: `<p>침대에 누워도 잠이 오지 않아 천장만 바라보는 밤이 있다. 새벽에 자주 깨서 피곤한 분들도 있다.</p><h3>생각이 많아 잠들기 어려울 때</h3><p>내일 할 일이 자꾸 떠올라서 잠이 안 오는 경험을 하는 분들이 있다...</p><h3>기분 변화가 심할 때</h3><p>특별한 이유 없이 우울해지거나 불안해지는 경우가 있다...</p><p>마음이 힘들다면 전문적인 상담을 받아보는 것도 방법이다.</p>`,
    exampleImages: ['밤에 침대에서 잠 못 이루는 모습', '창밖 보며 생각에 잠긴 사람'],
    situationalPhrases: [
      '침대에 누워도 잠이 안 오는 분들',
      '특별한 이유 없이 우울한 날이 많은 경우',
      '일상에서 의욕이 떨어진 느낌',
      '작은 일에도 예민해지는 분들'
    ],
    additionalBannedWords: ['우울증 치료', '약물', '정신질환'],
    ctaStyle: '마음이 힘들다면 전문적인 상담을 받아보는 것도 방법이다'
  },

  [ContentCategory.NEUROSURGERY]: {
    name: '신경외과',
    commonSymptoms: ['허리 통증', '목 통증', '디스크', '손발 저림', '두통'],
    exampleTitle: '허리 아플 때 확인할 것',
    exampleContent: `<p>오래 앉아 있다 일어날 때 허리가 뻐근한 경우가 있다. 허리를 숙이면 다리까지 저린 느낌이 드는 분들도 있다.</p><h3>앉았다 일어날 때 뻣뻣할 때</h3><p>장시간 앉아서 일하다 보면 허리가 굳는 느낌이 드는 분들이 있다...</p><h3>다리까지 저린 느낌이 있을 때</h3><p>허리 통증과 함께 다리에 찌릿한 느낌이 내려가는 경우가 있다...</p><p>불편함이 지속된다면 원인을 확인받아보는 것도 방법이다.</p>`,
    exampleImages: ['허리 통증으로 의자에서 일어나는 직장인', '목 스트레칭하는 모습'],
    situationalPhrases: [
      '오래 앉아 있으면 허리가 뻐근한 분들',
      '고개를 숙이면 목이 뻣뻣한 경우',
      '아침에 일어날 때 허리가 굳어 있는 느낌',
      '손발이 자주 저린 분들'
    ],
    additionalBannedWords: ['수술', '파열', '신경 손상'],
    ctaStyle: '불편함이 지속된다면 원인을 확인받아보는 것도 방법이다'
  },

  [ContentCategory.ANESTHESIOLOGY]: {
    name: '마취통증의학과',
    commonSymptoms: ['만성 통증', '근육통', '신경통', '통증 관리'],
    exampleTitle: '통증이 자꾸 반복될 때',
    exampleContent: `<p>같은 부위가 자꾸 아파서 일상이 불편한 경우가 있다. 파스를 붙여도 일시적으로만 나아지는 분들도 있다.</p><h3>진통제 효과가 예전 같지 않을 때</h3><p>처음엔 효과가 있던 약도 점점 듣지 않는 느낌이 드는 경우가 있다...</p><p>통증 관리가 필요하다면 전문 상담을 받아보는 것도 방법이다.</p>`,
    exampleImages: ['어깨 통증 느끼는 직장인', '통증 부위에 파스 붙이는 모습'],
    situationalPhrases: [
      '같은 부위가 자꾸 아픈 분들',
      '파스나 진통제 효과가 줄어든 느낌',
      '날씨에 따라 통증이 심해지는 경우',
      '일상생활에 지장이 있을 정도의 불편함'
    ],
    ctaStyle: '통증 관리가 필요하다면 전문 상담을 받아보는 것도 방법이다'
  },

  [ContentCategory.REHABILITATION]: {
    name: '재활의학과',
    commonSymptoms: ['관절 뻣뻣함', '근력 저하', '거동 불편', '회복 운동'],
    exampleTitle: '움직임이 예전 같지 않을 때',
    exampleContent: `<p>예전엔 가볍게 하던 동작이 요즘 힘들게 느껴지는 경우가 있다. 몸이 굳어서 스트레칭이 잘 안 되는 분들도 있다.</p><h3>관절이 뻣뻣해진 느낌일 때</h3><p>아침에 일어나면 몸이 굳어 있는 느낌이 드는 분들이 있다...</p><p>기능 회복이 필요하다면 전문 상담을 받아보는 것도 방법이다.</p>`,
    exampleImages: ['스트레칭하는 중년 남성', '재활 운동하는 모습'],
    situationalPhrases: [
      '예전에 쉽던 동작이 힘들어진 분들',
      '아침마다 몸이 굳어 있는 느낌',
      '한쪽 근육이 약해진 것 같은 경우',
      '일상 동작에서 불편함을 느끼는 분들'
    ],
    ctaStyle: '기능 회복이 필요하다면 전문 상담을 받아보는 것도 방법이다'
  },

  [ContentCategory.UROLOGY]: {
    name: '비뇨의학과',
    commonSymptoms: ['소변 불편', '빈뇨', '야간뇨', '전립선', '남성 건강'],
    exampleTitle: '화장실 자주 갈 때 체크',
    exampleContent: `<p>회의 중에 화장실이 급해서 곤란한 경험이 있다. 밤에 자다가 여러 번 깨서 화장실을 가는 분들도 있다.</p><h3>소변 후에도 개운하지 않을 때</h3><p>화장실을 다녀와도 잔뇨감이 느껴지는 경우가 있다...</p><p>배뇨 습관이 신경 쓰인다면 체크를 받아보는 것도 방법이다.</p>`,
    exampleImages: ['야간에 화장실 가는 중년 남성', '물 마시는 직장인'],
    situationalPhrases: [
      '밤에 화장실 때문에 자주 깨는 분들',
      '소변 후에도 개운하지 않은 느낌',
      '급하게 화장실을 찾게 되는 경우',
      '소변 줄기가 예전 같지 않은 분들'
    ],
    additionalBannedWords: ['전립선암', '발기부전', '성기능'],
    ctaStyle: '배뇨 습관이 신경 쓰인다면 체크를 받아보는 것도 방법이다'
  },

  [ContentCategory.PEDIATRICS]: {
    name: '소아과',
    commonSymptoms: ['소아 감기', '성장', '아이 피부', '소아 알레르기', '예방접종'],
    exampleTitle: '아이가 자주 아플 때 체크',
    exampleContent: `<p>어린이집 다니기 시작하면서 아이가 자주 아프는 경우가 있다. 감기가 낫는가 싶으면 또 걸리는 분들도 있다.</p><h3>감기가 자주 반복될 때</h3><p>한 달에 두세 번씩 콧물, 기침이 반복되는 아이들이 있다...</p><h3>또래보다 작은 것 같을 때</h3><p>같은 반 친구들보다 키가 작아 보여 신경 쓰이는 부모님들이 있다...</p><p>아이 건강이 걱정된다면 정기적인 체크를 받아보는 것도 방법이다.</p>`,
    exampleImages: ['기침하는 아이와 걱정하는 부모', '건강검진 받는 아이'],
    situationalPhrases: [
      '어린이집 다니면서 자주 아픈 아이',
      '밥을 잘 안 먹어 걱정되는 경우',
      '또래보다 작아 보여 신경 쓰이는 부모님들',
      '알레르기 반응이 자주 나타나는 아이'
    ],
    additionalBannedWords: ['성장 장애', '발달 지연'],
    ctaStyle: '아이 건강이 걱정된다면 정기적인 체크를 받아보는 것도 방법이다'
  },

  [ContentCategory.SURGERY]: {
    name: '외과',
    commonSymptoms: ['탈장', '담석', '치질', '맹장', '외과 검진'],
    exampleTitle: '배에 불편함 있을 때 체크',
    exampleContent: `<p>힘을 줄 때 배 쪽에 뭔가 불룩하게 튀어나오는 느낌이 드는 경우가 있다. 기름진 음식 먹고 나면 옆구리가 아픈 분들도 있다.</p><h3>복부에 불편함이 있을 때</h3><p>특정 동작을 하면 배 쪽에 통증이 느껴지는 경우가 있다...</p><p>복부 상태가 신경 쓰인다면 확인을 받아보는 것도 방법이다.</p>`,
    exampleImages: ['복부 불편함 느끼는 직장인', '건강검진 상담 모습'],
    situationalPhrases: [
      '힘줄 때 배 쪽에 튀어나오는 느낌',
      '기름진 음식 후 옆구리 통증',
      '앉아 있기 불편한 경우',
      '화장실에서 불편함을 느끼는 분들'
    ],
    additionalBannedWords: ['수술', '절제', '제거술'],
    ctaStyle: '복부 상태가 신경 쓰인다면 확인을 받아보는 것도 방법이다'
  },

  [ContentCategory.NEUROLOGY]: {
    name: '신경과',
    commonSymptoms: ['두통', '어지러움', '손발 저림', '기억력', '수면장애'],
    exampleTitle: '두통이 자주 있을 때 체크',
    exampleContent: `<p>머리가 지끈거리는 날이 많아 진통제를 자주 찾게 되는 경우가 있다. 어지러움과 함께 두통이 오는 분들도 있다.</p><h3>진통제 없이 버티기 힘들 때</h3><p>두통이 올 것 같으면 미리 약을 먹게 되는 분들이 있다...</p><h3>갑자기 어지러울 때</h3><p>일어날 때나 고개를 돌릴 때 핑 도는 느낌이 드는 경우가 있다...</p><p>두통이 자주 반복된다면 원인을 확인받아보는 것도 방법이다.</p>`,
    exampleImages: ['두통으로 머리 짚는 직장인', '어지러워하는 모습'],
    situationalPhrases: [
      '두통 때문에 진통제를 자주 찾는 분들',
      '갑자기 어지러운 경험이 있는 경우',
      '손발이 자주 저린 분들',
      '기억력이 예전 같지 않은 느낌'
    ],
    additionalBannedWords: ['뇌졸중', '치매', '뇌출혈'],
    ctaStyle: '두통이 자주 반복된다면 원인을 확인받아보는 것도 방법이다'
  },

  [ContentCategory.FAMILY_MEDICINE]: {
    name: '가정의학과',
    commonSymptoms: ['건강검진', '만성피로', '비만', '생활습관', '예방접종'],
    exampleTitle: '전반적인 건강 체크 시기',
    exampleContent: `<p>특별히 아픈 곳은 없는데 컨디션이 예전 같지 않은 경우가 있다. 건강검진 결과가 신경 쓰이는 분들도 있다.</p><h3>검진 결과가 걱정될 때</h3><p>수치가 높게 나와서 어떻게 해야 할지 고민되는 분들이 있다...</p><h3>생활습관 개선이 필요할 때</h3><p>운동도 해야 하고 식단도 조절해야 하는데 어디서부터 시작할지 막막한 경우가 있다...</p><p>건강 관리가 필요하다면 종합적인 상담을 받아보는 것도 방법이다.</p>`,
    exampleImages: ['건강검진 결과 보는 중년', '건강 상담 받는 모습'],
    situationalPhrases: [
      '건강검진 결과가 신경 쓰이는 분들',
      '컨디션이 예전 같지 않은 경우',
      '생활습관 개선이 필요한 분들',
      '어디서부터 건강 관리를 시작할지 막막한 경우'
    ],
    ctaStyle: '건강 관리가 필요하다면 종합적인 상담을 받아보는 것도 방법이다'
  },

  [ContentCategory.KOREAN_MEDICINE]: {
    name: '한의원',
    commonSymptoms: ['체질 개선', '보양', '다이어트', '갱년기', '면역력'],
    exampleTitle: '기력 회복이 필요할 때',
    exampleContent: `<p>예전엔 안 그랬는데 요즘 유독 기운이 없는 경우가 있다. 환절기만 되면 컨디션이 떨어지는 분들도 있다.</p><h3>면역력이 약해진 것 같을 때</h3><p>감기에 자주 걸리거나 회복이 느린 분들이 있다...</p><h3>체질에 맞는 관리가 궁금할 때</h3><p>나에게 맞는 건강 관리 방법이 궁금한 분들이 있다...</p><p>체질에 맞는 관리가 필요하다면 상담을 받아보는 것도 방법이다.</p>`,
    exampleImages: ['한방차 마시는 모습', '체질 상담 받는 장면'],
    situationalPhrases: [
      '환절기마다 컨디션이 떨어지는 분들',
      '회복이 예전보다 느린 느낌',
      '체질에 맞는 관리가 궁금한 경우',
      '기력 보충이 필요한 분들'
    ],
    additionalBannedWords: ['치료 효과', '완치'],
    ctaStyle: '체질에 맞는 관리가 필요하다면 상담을 받아보는 것도 방법이다'
  }
};

/**
 * 진료과별 추가 금지어 가져오기
 */
export const getDepartmentBannedWords = (category: ContentCategory): string => {
  const dept = DEPARTMENT_PROMPTS[category];
  if (!dept?.additionalBannedWords?.length) return '';
  return `\n■ ${dept.name} 추가 금지어\n${dept.additionalBannedWords.join(', ')}`;
};

/**
 * 진료과별 예시 생성
 */
export const getDepartmentExample = (category: ContentCategory): string => {
  const dept = DEPARTMENT_PROMPTS[category];
  return `{
  "t": "${dept.exampleTitle}",
  "c": "${dept.exampleContent.replace(/"/g, '\\"').replace(/\n/g, '')}",
  "i": [${dept.exampleImages.map(img => `"${img}"`).join(', ')}]
}`;
};

/**
 * 진료과별 상황 표현 가져오기
 */
export const getDepartmentPhrases = (category: ContentCategory): string => {
  const dept = DEPARTMENT_PROMPTS[category];
  return dept.situationalPhrases.map(p => `• ${p}`).join('\n');
};

/**
 * 시스템 프롬프트 (불변 - 캐시 가능)
 * 의료광고법 + 금지어 사전
 */
export const getSystemPrompt = (category?: ContentCategory): string => {
  const basePrompt = `네이버 병원 블로그 에디터. 의료광고법 준수 필수.

■ 우선순위
[P1] 위반 시 탈락: 의료법 금지어, 물음표, 제목 16자+
[P2] 필수 수정: AI 표현, 종결어미
[P3] 권장: 체류시간 요소

■ 금지어 → 대체어
━━━━━━━━━━━━━━━━━━
환자/환자분들 → 내원하시는 분들
저는/제가/저희 → 일반적으로
~에 따르면 → ~로 알려져 있다
가능성이 높다 → 언급되는 경우가 있다
OO이란 ~질환 → 자주 거론되는 것 중 하나
방치하면 위험 → 경과를 살펴보는 것도 방법
50대/30대 → 중년층/젊은 분들
2~3일/1주일 → 개인에 따라 차이
개선/완화/호전 → 변화가 관찰되는
~입니다/합니다 → ~경우가 있다/~편이다
~수 있습니다 → ~경향이 있다
~해야 합니다 → ~도움이 될 수 있다

■ 완전 금지 (대체 불가)
━━━━━━━━━━━━━━━━━━
~전에는/~후에는, 비용/가격/원, 효과적/성공률

■ AI 표현 → 자연 표현
━━━━━━━━━━━━━━━━━━
이처럼→이렇게 보면, 따라서→그래서
시점/사례/과정→순간/경우/때
피동형→능동형

■ 종결어미: 같은 표현 3회 이상 반복 금지
■ 핵심단어: 16회 이상 반복 금지
■ 판단/진단/가능성/의심: 총 3회 이하`;

  // 진료과별 추가 금지어
  if (category) {
    const additionalBanned = getDepartmentBannedWords(category);
    if (additionalBanned) {
      return basePrompt + additionalBanned;
    }
  }
  return basePrompt;
};

  // 진료과별 추가 금지어
  if (category) {
    const additionalBanned = getDepartmentBannedWords(category);
    if (additionalBanned) {
      return basePrompt + additionalBanned;
    }
  }
  return basePrompt;
};

// 레거시 호환 (기존 코드에서 SYSTEM_PROMPT 사용 시)
export const SYSTEM_PROMPT = getSystemPrompt();

/**
 * 1단계: 콘텐츠 생성 + SEO (동적 프롬프트 지원)
 */
export const getStage1_ContentGeneration = (textLength: number = 2000, category?: ContentCategory) => {
  // 진료과별 예시와 상황 표현 가져오기
  const dept = category ? DEPARTMENT_PROMPTS[category] : null;
  const example = category ? getDepartmentExample(category) : `{
  "t": "어깨 뻣뻣할 때 확인법",
  "c": "<p>패딩 소매에 팔을 넣다가 걸리는 느낌이 반복되는 경우가 있다. 특히 아침에 일어났을 때 어깨가 굳어 있는 듯한 느낌이 드는 분들이 있다.</p><h3>팔 올리기가 힘들어졌을 때</h3><p>임상에서 자주 보이는 패턴 중 하나는 샤워기 뒤로 닿기가 불편해지는 경우다. 이런 경험을 하는 분들 중에는...</p><h3>밤에 유독 더 불편한 이유</h3><p>야간에 옆으로 돌아눕다가 깨어나는 경험을 하는 분들이 있다. 개인차가 있으므로...</p><h3>이런 경험이 있다면</h3><p>아래 상황이 익숙하게 느껴진다면 한번 살펴볼 만하다...</p><p>증상이 지속된다면 전문적인 확인을 받아보는 것도 방법이다.</p>",
  "i": ["어깨 스트레칭하는 중년 여성", "밤에 어깨 불편해하는 모습"]
}`;
  const phrases = category ? getDepartmentPhrases(category) : '';
  const ctaStyle = dept?.ctaStyle || '전문적인 확인을 받아보는 것도 방법이다';
  const deptName = dept?.name || '';

  return `■ 작성 규칙
[P1] 물음표 금지, 제목 15자 이하
[P2] 분량 ${textLength + 300}자+, 소제목 4~6개
[P3] 체류요소: 자가체크/단계별/비교 중 1개+

■ 제목: 키워드 앞배치, 15자 이하
■ 첫문장: 상황 서술형
■ 소제목: 생활 장면형 (금지: "OO의 원인", "치료 방법")
■ 경험 표현: "임상에서 자주 보이는", "내원하시는 분들 중"
■ 첫 150자 내 메인 키워드 포함
■ 마무리: "${ctaStyle}"${deptName ? `\n\n■ ${deptName} 상황 표현 참고\n${phrases}` : ''}

■ ${deptName || '예시'}${deptName ? ' 맞춤' : ''} 예시
━━━━━━━━━━━━━━━━━━
${example}

■ JSON 응답 (키 축약)
{"t":"제목","c":"HTML본문","i":["이미지프롬프트"]}`;
};

/**
 * 2단계: AI 제거 + 최종 검증
 */
export const getStage2_AiRemovalAndCompliance = (textLength: number = 2000) => {
  return `■ 검증 및 수정
[P1] 금지어 발견 → 즉시 대체 (시스템 프롬프트 참조)
[P2] 종결어미 3회+ 반복 → 다양화
[P2] AI 표현 → 자연 표현으로 교체
[P3] 핵심단어 16회+ → 대체 표현 사용

■ 필수 확인
□ 물음표 0개
□ 제목 15자 이하
□ 금지어 0개
□ "판단/진단/가능성/의심" 3회 이하
□ 신뢰 표현 1개+ ("개인차가 있으므로" 등)
□ 마무리 문장 포함

■ JSON 응답
{"t":"제목유지","c":"수정된본문","i":["이미지들"]}`;
};

/**
 * 레거시 호환
 */
export const getStage2_RemoveAiSmell = getStage2_AiRemovalAndCompliance;
export const getStage3_SeoOptimization = (category?: ContentCategory) => getStage1_ContentGeneration(2000, category);
export const getStage4_FinalCheck = () => getStage2_AiRemovalAndCompliance();

/**
 * 프롬프트 가져오기 (진료과 동적 지원)
 */
export const getStagePrompt = (stageNumber: 1 | 2, textLength: number = 2000, category?: ContentCategory): string => {
  switch (stageNumber) {
    case 1:
      return getStage1_ContentGeneration(textLength, category);
    case 2:
      return getStage2_AiRemovalAndCompliance(textLength);
    default:
      throw new Error(`Invalid stage: ${stageNumber}`);
  }
};

/**
 * 전체 프롬프트 (시스템 + 단계별) - 진료과 동적 지원
 */
export const getFullPrompt = (stageNumber: 1 | 2, textLength: number = 2000, category?: ContentCategory) => ({
  system: getSystemPrompt(category),
  user: getStagePrompt(stageNumber, textLength, category)
});

export const getAllStages = (textLength: number = 2000, category?: ContentCategory) => ({
  system: getSystemPrompt(category),
  stage1: getStage1_ContentGeneration(textLength, category),
  stage2: getStage2_AiRemovalAndCompliance(textLength)
});
