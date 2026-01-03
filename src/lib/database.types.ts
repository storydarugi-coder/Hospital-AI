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
