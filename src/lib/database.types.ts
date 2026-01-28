export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          updated_at?: string;
        };
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          plan_type: 'free' | 'basic' | 'standard' | 'premium';
          credits_total: number;
          credits_used: number;
          expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan_type?: 'free' | 'basic' | 'standard' | 'premium';
          credits_total?: number;
          credits_used?: number;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          plan_type?: 'free' | 'basic' | 'standard' | 'premium';
          credits_total?: number;
          credits_used?: number;
          expires_at?: string | null;
          updated_at?: string;
        };
      };
      usage_logs: {
        Row: {
          id: string;
          user_id: string | null;
          ip_hash: string;
          action_type: 'generate_blog' | 'generate_card_news';
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          ip_hash: string;
          action_type: 'generate_blog' | 'generate_card_news';
          created_at?: string;
        };
        Update: {
          user_id?: string | null;
          ip_hash?: string;
          action_type?: 'generate_blog' | 'generate_card_news';
        };
      };
      ip_limits: {
        Row: {
          id: string;
          ip_hash: string;
          free_uses: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          ip_hash: string;
          free_uses?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          free_uses?: number;
          updated_at?: string;
        };
      };
      payments: {
        Row: {
          id: string;
          user_id: string;
          plan_type: 'basic' | 'standard' | 'premium';
          amount: number;
          payment_key: string | null;
          order_id: string;
          status: 'pending' | 'completed' | 'failed' | 'cancelled';
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan_type: 'basic' | 'standard' | 'premium';
          amount: number;
          payment_key?: string | null;
          order_id: string;
          status?: 'pending' | 'completed' | 'failed' | 'cancelled';
          created_at?: string;
        };
        Update: {
          payment_key?: string | null;
          status?: 'pending' | 'completed' | 'failed' | 'cancelled';
        };
      };
      blog_history: {
        Row: {
          id: string;
          user_id: string | null;
          title: string;
          content: string;
          html_content: string;
          keywords: string[];
          embedding: number[] | null;
          naver_url: string | null;
          category: string | null;
          published_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          title: string;
          content: string;
          html_content: string;
          keywords?: string[];
          embedding?: number[] | null;
          naver_url?: string | null;
          category?: string | null;
          published_at?: string;
          created_at?: string;
        };
        Update: {
          title?: string;
          content?: string;
          html_content?: string;
          keywords?: string[];
          embedding?: number[] | null;
          naver_url?: string | null;
          category?: string | null;
          published_at?: string;
        };
      };
      medical_law_cache: {
        Row: {
          id: string;
          source_url: string;
          last_crawled_at: string;
          prohibitions: any; // JSONB
          summary: string | null;
          raw_content: string | null;
          version: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          source_url: string;
          last_crawled_at?: string;
          prohibitions?: any;
          summary?: string | null;
          raw_content?: string | null;
          version?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          source_url?: string;
          last_crawled_at?: string;
          prohibitions?: any;
          summary?: string | null;
          raw_content?: string | null;
          version?: number;
          is_active?: boolean;
          updated_at?: string;
        };
      };
      generated_posts: {
        Row: {
          id: string;
          user_id: string | null;
          user_email: string | null;
          ip_hash: string | null;
          hospital_name: string | null;
          category: string | null;
          doctor_name: string | null;
          doctor_title: string | null;
          post_type: 'blog' | 'card_news' | 'press_release';
          title: string;
          content: string;
          plain_text: string | null;
          keywords: string[] | null;
          topic: string | null;
          image_style: string | null;
          slide_count: number | null;
          char_count: number | null;
          word_count: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          user_email?: string | null;
          ip_hash?: string | null;
          hospital_name?: string | null;
          category?: string | null;
          doctor_name?: string | null;
          doctor_title?: string | null;
          post_type: 'blog' | 'card_news' | 'press_release';
          title: string;
          content: string;
          plain_text?: string | null;
          keywords?: string[] | null;
          topic?: string | null;
          image_style?: string | null;
          slide_count?: number | null;
          char_count?: number | null;
          word_count?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string | null;
          user_email?: string | null;
          ip_hash?: string | null;
          hospital_name?: string | null;
          category?: string | null;
          doctor_name?: string | null;
          doctor_title?: string | null;
          post_type?: 'blog' | 'card_news' | 'press_release';
          title?: string;
          content?: string;
          plain_text?: string | null;
          keywords?: string[] | null;
          topic?: string | null;
          image_style?: string | null;
          slide_count?: number | null;
          char_count?: number | null;
          word_count?: number | null;
          updated_at?: string;
        };
      };
    };
  };
}

// 요금제 정보
export const PLANS = {
  free: {
    name: '맛보기',
    price: 0,
    credits: 3,
    validity: null,
    description: 'IP당 3회 무료 체험'
  },
  basic: {
    name: '베이직',
    price: 10000,
    credits: 10,
    validity: 90, // 3개월 = 90일
    description: '10개 글 생성'
  },
  standard: {
    name: '스탠다드',
    price: 19900,
    credits: 20,
    validity: 90,
    description: '20개 글 생성'
  },
  premium: {
    name: '프리미엄',
    price: 59900,
    credits: -1, // -1 = 무제한
    validity: 30, // 월간 구독
    description: '무제한 글 생성 (월간)'
  }
} as const;

export type PlanType = keyof typeof PLANS;
