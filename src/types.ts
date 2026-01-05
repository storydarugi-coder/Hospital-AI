export enum ContentCategory {
  INTERNAL_MEDICINE = '내과',
  SURGERY = '외과',
  OBGYN = '산부인과',
  DERMATOLOGY = '피부과',
  DENTAL = '치과',
  OPHTHALMOLOGY = '안과',
  ORTHOPEDICS = '정형외과',
  ENT = '이비인후과',
  PEDIATRICS = '소아과',
  KOREAN_MEDICINE = '한의원',
  PLASTIC_SURGERY = '성형외과',
  PSYCHIATRY = '정신건강의학과',
  UROLOGY = '비뇨의학과',
  NEUROLOGY = '신경과',
  NEUROSURGERY = '신경외과',
  REHABILITATION = '재활의학과',
  FAMILY_MEDICINE = '가정의학과',
  ANESTHESIOLOGY = '마취통증의학과'
}

export type AudienceMode = '환자용(친절/공감)' | '전문가용(신뢰/정보)';
export type ImageStyle = 'photo' | 'illustration' | 'medical' | 'custom';
export type PostType = 'blog' | 'card_news';
export type CssTheme = 'modern' | 'premium' | 'minimal' | 'warm' | 'professional';
export type WritingStyle = 'expert' | 'empathy' | 'conversion';  // 전문가형 / 공감형 / 전환형

export interface GenerationRequest {
  category: ContentCategory;
  topic: string;
  keywords: string;
  tone: string;
  audienceMode: AudienceMode;
  persona: string;
  imageStyle: ImageStyle;
  referenceUrl?: string;
  postType: PostType;
  textLength?: number;
  slideCount?: number;
  imageCount?: number; // 블로그 포스트 이미지 장수
  cssTheme?: CssTheme;
  writingStyle?: WritingStyle; // 글 스타일: 안전형/공감형/전환형
  coverStyleImage?: string; // 카드뉴스 표지 스타일 참고 이미지 (Base64)
  contentStyleImage?: string; // 카드뉴스 본문 스타일 참고 이미지 (Base64)
  customImagePrompt?: string; // 커스텀 이미지 스타일 프롬프트
}

export interface FactCheckReport {
  fact_score: number;
  verified_facts_count: number;
  safety_score: number;
  conversion_score: number;  // 전환력 점수 (0~100) - 의료법 준수하면서 행동 유도하는 능력
  issues: string[];
  recommendations: string[];
}

// 카드별 프롬프트 데이터 (재생성 UI용)
export interface CardPromptData {
  imagePrompt: string;
  textPrompt: {
    subtitle: string;
    mainTitle: string;
    description: string;
    tags: string[];
  };
}

// 카드뉴스 원고 (1단계: 스크립트)
export interface CardNewsScript {
  title: string;
  topic: string;
  totalSlides: number;
  slides: CardNewsSlideScript[];
  overallTheme: string;
}

export interface CardNewsSlideScript {
  slideNumber: number;
  slideType: 'cover' | 'concept' | 'content' | 'closing';
  subtitle: string;
  mainTitle: string;
  description: string;
  speakingNote: string; // 이 슬라이드에서 전달하고 싶은 핵심 메시지
  imageKeyword: string;
}

export interface GeneratedContent {
  htmlContent: string;
  title: string;
  imageUrl: string; 
  fullHtml: string; 
  tags: string[];
  factCheck?: FactCheckReport;
  postType: PostType;
  cssTheme?: CssTheme;
  imageStyle?: ImageStyle;
  customImagePrompt?: string; // 커스텀 이미지 프롬프트 (재생성용)
  cardPrompts?: CardPromptData[]; // 카드별 프롬프트 (재생성용)
}

export interface GenerationState {
  isLoading: boolean;
  error: string | null;
  data: GeneratedContent | null;
  progress: string; 
}

export interface TrendingItem {
  topic: string;
  keywords: string;
  score: number;
  seasonal_factor: string;
}

export interface SeoTitleItem {
  title: string;
  score: number;
  type: '신뢰' | '안전' | '정보' | '공감';
}
