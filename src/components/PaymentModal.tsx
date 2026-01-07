import React, { useState } from 'react';
import { 
  PLANS, 
  PlanInfo, 
  requestPayment, 
  savePaymentRecord, 
  addCreditsAfterPayment,
  isTestMode 
} from '../services/paymentService';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (credits: number) => void;
}

const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [selectedPlan, setSelectedPlan] = useState<string>('basic-50');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'select' | 'processing' | 'success'>('select');
  const [purchasedCredits, setPurchasedCredits] = useState(0);

  if (!isOpen) return null;

  const plans = Object.values(PLANS);

  const handlePayment = async () => {
    const plan = PLANS[selectedPlan];
    if (!plan) return;

    setIsProcessing(true);
    setError(null);
    setStep('processing');

    try {
      const result = await requestPayment(selectedPlan);

      if (result.success && result.paymentId) {
        // 결제 내역 저장
        savePaymentRecord({
          paymentId: result.paymentId,
          planId: plan.id,
          planName: plan.name,
          credits: plan.credits,
          amount: plan.price,
          status: 'completed',
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          tid: result.tid
        });

        // 크레딧 추가
        addCreditsAfterPayment(plan.credits);
        setPurchasedCredits(plan.credits);
        setStep('success');
        
        // 성공 콜백
        if (onSuccess) {
          onSuccess(plan.credits);
        }
      } else {
        setError(result.error || '결제에 실패했습니다.');
        setStep('select');
      }
    } catch (err: any) {
      setError(err.message || '결제 처리 중 오류가 발생했습니다.');
      setStep('select');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setStep('select');
    setError(null);
    setSelectedPlan('basic-50');
    onClose();
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString('ko-KR');
  };

  const getDiscountPercent = (plan: PlanInfo) => {
    return Math.round((1 - plan.price / plan.originalPrice) * 100);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* 헤더 */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-xl font-bold text-gray-900">
            {step === 'success' ? '🎉 결제 완료!' : '크레딧 충전'}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 콘텐츠 */}
        <div className="p-6">
          {/* 테스트 모드 안내 */}
          {isTestMode() && step !== 'success' && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                🧪 <strong>테스트 모드</strong>: 실제 결제가 진행되지 않습니다.
              </p>
            </div>
          )}

          {/* 요금제 선택 */}
          {step === 'select' && (
            <>
              <p className="text-gray-600 mb-6">
                원하시는 요금제를 선택해주세요.
              </p>

              <div className="space-y-3">
                {plans.map((plan) => (
                  <label
                    key={plan.id}
                    className={`block p-4 border-2 rounded-xl cursor-pointer transition-all ${
                      selectedPlan === plan.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start">
                      <input
                        type="radio"
                        name="plan"
                        value={plan.id}
                        checked={selectedPlan === plan.id}
                        onChange={(e) => setSelectedPlan(e.target.value)}
                        className="mt-1 mr-3"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900">{plan.name}</span>
                          {plan.id === 'basic-50' && (
                            <span className="px-2 py-0.5 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold rounded-full">
                              BEST
                            </span>
                          )}
                          <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs font-bold rounded">
                            {getDiscountPercent(plan)}% OFF
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">{plan.description}</p>
                        <div className="mt-2 flex items-baseline gap-2">
                          <span className="text-lg font-bold text-gray-900">
                            ₩{formatPrice(plan.price)}
                          </span>
                          <span className="text-sm text-gray-400 line-through">
                            ₩{formatPrice(plan.originalPrice)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <button
                onClick={handlePayment}
                disabled={isProcessing}
                className="mt-6 w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl
                         hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl
                         disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? '처리 중...' : `₩${formatPrice(PLANS[selectedPlan]?.price || 0)} 결제하기`}
              </button>

              <p className="mt-4 text-xs text-gray-400 text-center">
                결제 시 <span className="text-blue-600 cursor-pointer">이용약관</span> 및{' '}
                <span className="text-blue-600 cursor-pointer">개인정보처리방침</span>에 동의하는 것으로 간주됩니다.
              </p>
            </>
          )}

          {/* 결제 처리 중 */}
          {step === 'processing' && (
            <div className="py-12 text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4"></div>
              <p className="text-gray-600">결제를 처리하고 있습니다...</p>
              <p className="text-sm text-gray-400 mt-2">잠시만 기다려주세요.</p>
            </div>
          )}

          {/* 결제 성공 */}
          {step === 'success' && (
            <div className="py-8 text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">결제가 완료되었습니다!</h3>
              <p className="text-gray-600 mb-6">
                <span className="text-blue-600 font-bold">{purchasedCredits}개</span>의 크레딧이 충전되었습니다.
              </p>
              <button
                onClick={handleClose}
                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl
                         hover:from-blue-700 hover:to-indigo-700 transition-all"
              >
                확인
              </button>
            </div>
          )}
        </div>

        {/* 푸터 - 결제 안내 */}
        {step === 'select' && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 rounded-b-2xl">
            <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                안전한 결제
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                NICEPAY
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentModal;
