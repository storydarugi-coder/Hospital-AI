/**
 * PortOne V2 결제 서비스
 * 
 * 포트원(구 아임포트) V2 SDK를 사용한 결제 처리
 * PG사: NHN KCP 또는 KG이니시스 (가입비 무료)
 * 
 * 필요한 설정:
 * 1. 포트원 콘솔에서 스토어 생성
 * 2. PG사 연동 (KCP 또는 이니시스)
 * 3. 채널키 발급
 */

// PortOne SDK 타입 정의
declare global {
  interface Window {
    PortOne: {
      requestPayment: (options: PaymentRequest) => Promise<PaymentResponse>;
    };
  }
}

// 결제 요청 타입
interface PaymentRequest {
  storeId: string;
  channelKey: string;
  paymentId: string;
  orderName: string;
  totalAmount: number;
  currency: string;
  payMethod: string;
  customer?: {
    fullName?: string;
    phoneNumber?: string;
    email?: string;
  };
  customData?: Record<string, any>;
  redirectUrl?: string;
}

// 결제 응답 타입
interface PaymentResponse {
  code?: string;
  message?: string;
  paymentId?: string;
  transactionType?: string;
}

// 요금제 정보
export interface PlanInfo {
  id: string;
  name: string;
  credits: number;  // -1은 무제한
  price: number;
  originalPrice: number;
  duration: 'once' | 'monthly' | 'yearly';
  description: string;
}

// 사용 가능한 요금제
export const PLANS: Record<string, PlanInfo> = {
  'basic-10': {
    id: 'basic-10',
    name: '베이직 10건',
    credits: 10,
    price: 15900,
    originalPrice: 25000,
    duration: 'once',
    description: '블로그 원고 10회 생성권'
  },
  'standard-20': {
    id: 'standard-20',
    name: '스탠다드 20건',
    credits: 20,
    price: 29900,
    originalPrice: 45000,
    duration: 'once',
    description: '블로그 원고 20회 생성권'
  },
  'premium-monthly': {
    id: 'premium-monthly',
    name: '프리미엄 월간',
    credits: -1, // 무제한
    price: 69900,
    originalPrice: 99000,
    duration: 'monthly',
    description: '무제한 원고 생성 (월 구독)'
  },
  'premium-yearly': {
    id: 'premium-yearly',
    name: '프리미엄 연간',
    credits: -1, // 무제한
    price: 599000,
    originalPrice: 838800,
    duration: 'yearly',
    description: '무제한 원고 생성 (연 구독)'
  }
};

// 결제 설정 (실제 사용 시 환경 변수로 관리)
const PAYMENT_CONFIG = {
  // 포트원 스토어 ID (포트원 콘솔에서 확인)
  // 테스트: 'store-xxxxxxxxxx'
  storeId: localStorage.getItem('PORTONE_STORE_ID') || 'store-test',
  
  // 채널키 (PG사 연동 후 발급)
  // KCP 테스트: 'channel-key-xxxxxxxxxx'
  channelKey: localStorage.getItem('PORTONE_CHANNEL_KEY') || 'channel-key-test'
};

// 고유 결제 ID 생성
export const generatePaymentId = (): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `payment_${timestamp}_${random}`;
};

// 결제 요청
export const requestPayment = async (
  planId: string,
  customer?: {
    name?: string;
    email?: string;
    phone?: string;
  }
): Promise<{ success: boolean; paymentId?: string; error?: string }> => {
  // SDK 로드 확인
  if (!window.PortOne) {
    return { 
      success: false, 
      error: 'PortOne SDK가 로드되지 않았습니다. 페이지를 새로고침해주세요.' 
    };
  }

  // 요금제 확인
  const plan = PLANS[planId];
  if (!plan) {
    return { 
      success: false, 
      error: '유효하지 않은 요금제입니다.' 
    };
  }

  // 결제 설정 확인
  if (PAYMENT_CONFIG.storeId === 'store-test' || PAYMENT_CONFIG.channelKey === 'channel-key-test') {
    // 테스트 모드 - 결제 성공으로 시뮬레이션
    console.log('[테스트 모드] 결제 시뮬레이션:', { planId, plan });
    
    return new Promise((resolve) => {
      setTimeout(() => {
        const paymentId = generatePaymentId();
        resolve({ success: true, paymentId });
      }, 1500); // 1.5초 대기 (결제 처리 시뮬레이션)
    });
  }

  // 실제 결제 요청
  const paymentId = generatePaymentId();
  
  try {
    const response = await window.PortOne.requestPayment({
      storeId: PAYMENT_CONFIG.storeId,
      channelKey: PAYMENT_CONFIG.channelKey,
      paymentId,
      orderName: plan.name,
      totalAmount: plan.price,
      currency: 'KRW',
      payMethod: 'CARD', // 신용카드
      customer: customer ? {
        fullName: customer.name,
        email: customer.email,
        phoneNumber: customer.phone
      } : undefined,
      customData: {
        planId: plan.id,
        credits: plan.credits,
        duration: plan.duration
      }
    });

    // 결제 결과 확인
    if (response.code) {
      // 에러 발생
      return {
        success: false,
        error: response.message || '결제에 실패했습니다.'
      };
    }

    // 결제 성공
    return {
      success: true,
      paymentId: response.paymentId || paymentId
    };

  } catch (error: any) {
    console.error('결제 오류:', error);
    return {
      success: false,
      error: error.message || '결제 처리 중 오류가 발생했습니다.'
    };
  }
};

// 결제 설정 저장 (관리자용)
export const savePaymentConfig = (storeId: string, channelKey: string): void => {
  localStorage.setItem('PORTONE_STORE_ID', storeId);
  localStorage.setItem('PORTONE_CHANNEL_KEY', channelKey);
};

// 결제 설정 확인
export const isPaymentConfigured = (): boolean => {
  const storeId = localStorage.getItem('PORTONE_STORE_ID');
  const channelKey = localStorage.getItem('PORTONE_CHANNEL_KEY');
  return !!(storeId && channelKey && storeId !== 'store-test' && channelKey !== 'channel-key-test');
};

// 결제 내역 저장 (로컬)
export interface PaymentRecord {
  paymentId: string;
  planId: string;
  planName: string;
  credits: number;
  amount: number;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  createdAt: string;
  completedAt?: string;
  userId?: string;
}

export const savePaymentRecord = (record: PaymentRecord): void => {
  const records = getPaymentRecords();
  records.unshift(record);
  localStorage.setItem('payment_records', JSON.stringify(records));
};

export const getPaymentRecords = (): PaymentRecord[] => {
  try {
    return JSON.parse(localStorage.getItem('payment_records') || '[]');
  } catch {
    return [];
  }
};

export const updatePaymentStatus = (paymentId: string, status: PaymentRecord['status']): void => {
  const records = getPaymentRecords();
  const index = records.findIndex(r => r.paymentId === paymentId);
  if (index !== -1) {
    records[index].status = status;
    if (status === 'completed') {
      records[index].completedAt = new Date().toISOString();
    }
    localStorage.setItem('payment_records', JSON.stringify(records));
  }
};
