/**
 * 나이스페이 결제 서비스
 * 
 * NICEPAY V2 SDK를 사용한 결제 처리
 * 
 * 필요한 설정 (실제 운영 시):
 * 1. 나이스페이 가맹점 가입
 * 2. MID (상점 아이디) 발급
 * 3. Client Key / Secret Key 발급
 */

// 나이스페이 SDK 타입 정의
declare global {
  interface Window {
    AUTHNICE: {
      requestPay: (options: NicepayRequest) => void;
    };
  }
}

// 나이스페이 결제 요청 타입
interface NicepayRequest {
  clientId: string;
  method: string;
  orderId: string;
  amount: number;
  goodsName: string;
  returnUrl: string;
  fnError: (result: NicepayError) => void;
  mallReserved?: string;
  buyerName?: string;
  buyerEmail?: string;
  buyerTel?: string;
}

interface NicepayError {
  errorCode: string;
  errorMsg: string;
}

// 결제 결과 타입
interface PaymentResult {
  success: boolean;
  paymentId?: string;
  error?: string;
  tid?: string;
  amount?: number;
}

// 요금제 정보
export interface PlanInfo {
  id: string;
  name: string;
  credits: number;
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
    price: 20000,
    originalPrice: 30000,
    duration: 'once',
    description: '블로그 원고 10회 생성권 (건당 2,000원)'
  },
  'basic-20': {
    id: 'basic-20',
    name: '베이직 20건',
    credits: 20,
    price: 39000,
    originalPrice: 50000,
    duration: 'once',
    description: '블로그 원고 20회 생성권 (건당 1,950원)'
  },
  'basic-50': {
    id: 'basic-50',
    name: '베이직 50건',
    credits: 50,
    price: 89000,
    originalPrice: 125000,
    duration: 'once',
    description: '블로그 원고 50회 생성권 (건당 1,780원) 🏆 BEST'
  }
};

// 나이스페이 설정
const NICEPAY_CONFIG = {
  // 테스트 Client ID (나이스페이 테스트용)
  clientId: localStorage.getItem('NICEPAY_CLIENT_ID') || 'S2_af4543a0be4d49a98122e01ec2059a56',
  // 테스트 모드 여부
  isTestMode: !localStorage.getItem('NICEPAY_CLIENT_ID'),
  // 결제 결과 수신 URL (실제 운영 시 서버 URL로 변경)
  returnUrl: window.location.origin + '/payment/result'
};

// 고유 주문 ID 생성
export const generateOrderId = (): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `ORDER_${timestamp}_${random}`;
};

// 고유 결제 ID 생성 (기존 호환성)
export const generatePaymentId = generateOrderId;

// 나이스페이 SDK 로드
export const loadNicepaySDK = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.AUTHNICE) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = NICEPAY_CONFIG.isTestMode
      ? 'https://pay.nicepay.co.kr/v1/js/'  // 테스트/운영 동일
      : 'https://pay.nicepay.co.kr/v1/js/';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('나이스페이 SDK 로드 실패'));
    document.head.appendChild(script);
  });
};

// 결제 요청
export const requestPayment = async (
  planId: string,
  customer?: {
    name?: string;
    email?: string;
    phone?: string;
  }
): Promise<PaymentResult> => {
  // 요금제 확인
  const plan = PLANS[planId];
  if (!plan) {
    return { 
      success: false, 
      error: '유효하지 않은 요금제입니다.' 
    };
  }

  const orderId = generateOrderId();

  // 테스트 모드 - 결제 성공 시뮬레이션
  if (NICEPAY_CONFIG.isTestMode) {
    console.log('[테스트 모드] 나이스페이 결제 시뮬레이션:', { planId, plan, orderId });
    
    return new Promise((resolve) => {
      // 결제 진행 중 표시를 위한 약간의 딜레이
      setTimeout(() => {
        const tid = `NICETID_TEST_${Date.now()}`;
        
        // 결제 성공 시뮬레이션
        resolve({ 
          success: true, 
          paymentId: orderId,
          tid,
          amount: plan.price
        });
      }, 2000); // 2초 대기 (실제 결제창 대신)
    });
  }

  // 실제 나이스페이 결제 요청
  try {
    await loadNicepaySDK();

    return new Promise((resolve) => {
      // 결제 결과를 받을 콜백 설정
      (window as any).__nicepayCallback = (result: any) => {
        if (result.resultCode === '0000') {
          resolve({
            success: true,
            paymentId: orderId,
            tid: result.tid,
            amount: plan.price
          });
        } else {
          resolve({
            success: false,
            error: result.resultMsg || '결제가 취소되었습니다.'
          });
        }
      };

      window.AUTHNICE.requestPay({
        clientId: NICEPAY_CONFIG.clientId,
        method: 'card',
        orderId,
        amount: plan.price,
        goodsName: plan.name,
        returnUrl: NICEPAY_CONFIG.returnUrl,
        buyerName: customer?.name,
        buyerEmail: customer?.email,
        buyerTel: customer?.phone,
        mallReserved: JSON.stringify({
          planId: plan.id,
          credits: plan.credits
        }),
        fnError: (error) => {
          resolve({
            success: false,
            error: error.errorMsg || '결제 처리 중 오류가 발생했습니다.'
          });
        }
      });
    });

  } catch (error: any) {
    console.error('나이스페이 결제 오류:', error);
    return {
      success: false,
      error: error.message || '결제 처리 중 오류가 발생했습니다.'
    };
  }
};

// 결제 설정 저장 (관리자용)
export const savePaymentConfig = (clientId: string): void => {
  localStorage.setItem('NICEPAY_CLIENT_ID', clientId);
};

// 결제 설정 확인
export const isPaymentConfigured = (): boolean => {
  const clientId = localStorage.getItem('NICEPAY_CLIENT_ID');
  return !!clientId;
};

// 테스트 모드 확인
export const isTestMode = (): boolean => {
  return NICEPAY_CONFIG.isTestMode;
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
  tid?: string;  // 나이스페이 거래 ID
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

// 결제 완료 후 크레딧 추가
export const addCreditsAfterPayment = (credits: number): void => {
  const currentCredits = parseInt(localStorage.getItem('user_credits') || '3', 10);
  const newCredits = currentCredits + credits;
  localStorage.setItem('user_credits', newCredits.toString());
  
  // 이벤트 발생 (UI 업데이트용)
  window.dispatchEvent(new CustomEvent('creditsUpdated', { 
    detail: { credits: newCredits, added: credits } 
  }));
};

// 현재 크레딧 조회
export const getCurrentCredits = (): number => {
  return parseInt(localStorage.getItem('user_credits') || '3', 10);
};
