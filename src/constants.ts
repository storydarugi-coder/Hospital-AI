import { ContentCategory } from './types';

export const CATEGORIES = [
  { value: ContentCategory.INTERNAL_MEDICINE, label: '🩺 내과' },
  { value: ContentCategory.ORTHOPEDICS, label: '🦴 정형외과' },
  { value: ContentCategory.DERMATOLOGY, label: '✨ 피부과' },
  { value: ContentCategory.DENTAL, label: '🦷 치과' },
  { value: ContentCategory.PLASTIC_SURGERY, label: '💎 성형외과' },
  { value: ContentCategory.OBGYN, label: '🤰 산부인과' },
  { value: ContentCategory.BREAST_SURGERY, label: '🎀 유방외과' },
  { value: ContentCategory.THYROID_SURGERY, label: '🦋 갑상선외과' },
  { value: ContentCategory.OPHTHALMOLOGY, label: '👁️ 안과' },
  { value: ContentCategory.ENT, label: '👂 이비인후과' },
  { value: ContentCategory.PSYCHIATRY, label: '🧠 정신건강의학과' },
  { value: ContentCategory.NEUROSURGERY, label: '⚡ 신경외과' },
  { value: ContentCategory.ANESTHESIOLOGY, label: '💉 마취통증의학과' },
  { value: ContentCategory.REHABILITATION, label: '🤸 재활의학과' },
  { value: ContentCategory.UROLOGY, label: '🚽 비뇨의학과' },
  { value: ContentCategory.PEDIATRICS, label: '👶 소아과' },
  { value: ContentCategory.SURGERY, label: '🔪 외과' },
  { value: ContentCategory.NEUROLOGY, label: '🔌 신경과' },
  { value: ContentCategory.FAMILY_MEDICINE, label: '🏠 가정의학과' },
  { value: ContentCategory.KOREAN_MEDICINE, label: '🌿 한의원' },
];

export const PERSONAS = [
  { value: 'hospital_info', label: '병원 공식 블로그 (정보성/객관적)' },
  { value: 'director_1st', label: '대표원장 1인칭 (진정성/전문성)' },
  { value: 'coordinator', label: '상담 실장님 (친근함/후기형)' },
];

export const TONES = [
  { value: 'warm', label: '따뜻하고 공감하는 (환자 위로)' },
  { value: 'logical', label: '논리적이고 명확한 (의학 정보)' },
  { value: 'premium', label: '고급스럽고 신뢰감 있는 (VIP 타겟)' },
];
