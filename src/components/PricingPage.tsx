import React, { useState } from 'react';
import { requestPayment, PLANS, isPaymentConfigured } from '../services/paymentService';

interface PricingPageProps {
  onNavigate: (page: 'landing' | 'app' | 'admin' | 'auth' | 'pricing') => void;
  isLoggedIn?: boolean;
  currentPlan?: string;
  remainingCredits?: number;
  onPaymentComplete?: (planId: string, credits: number) => void;
  userEmail?: string;
  userName?: string;
}

export const PricingPage: React.FC<PricingPageProps> = ({ 
  onNavigate, 
  isLoggedIn = false,
  currentPlan = 'free',
  remainingCredits = 3,
  onPaymentComplete,
  userEmail,
  userName
}) => {
  const [selectedBasic, setSelectedBasic] = useState<10 | 20>(10);
  const [selectedPremium, setSelectedPremium] = useState<'monthly' | 'yearly'>('monthly');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 가격 계산
  const basicPrices = {
    10: { price: 10000, original: 15000, perUnit: 1000 },
    20: { price: 19900, original: 30000, perUnit: 995 }
  };

  const premiumPrices = {
    monthly: { price: 59900, original: 99000 },
    yearly: { price: 499000, original: 718800, monthly: 41583 }
  };

  const handlePurchase = async (planType: 'basic' | 'premium') => {
    if (!isLoggedIn) {
      onNavigate('auth');
      return;
    }

    // 요금제 ID 결정
    let planId: string;
    if (planType === 'basic') {
      planId = selectedBasic === 10 ? 'basic-10' : 'basic-20';
    } else {
      planId = selectedPremium === 'monthly' ? 'premium-monthly' : 'premium-yearly';
    }

    const plan = PLANS[planId];
    if (!plan) {
      setPaymentMessage({ type: 'error', text: '유효하지 않은 요금제입니다.' });
      return;
    }

    setIsProcessing(true);
    setPaymentMessage(null);

    try {
      // 테스트 모드 안내
      if (!isPaymentConfigured()) {
        const confirmed = confirm(
          `[테스트 모드]\n\n` +
          `요금제: ${plan.name}\n` +
          `금액: ₩${plan.price.toLocaleString()}\n\n` +
          `실제 결제 없이 크레딧이 충전됩니다.\n계속하시겠습니까?`
        );
        
        if (!confirmed) {
          setIsProcessing(false);
          return;
        }
      }

      // 결제 요청
      const result = await requestPayment(planId, {
        name: userName,
        email: userEmail
      });

      if (result.success) {
        // 결제 성공
        setPaymentMessage({ 
          type: 'success', 
          text: `🎉 결제가 완료되었습니다! ${plan.credits === -1 ? '프리미엄' : `+${plan.credits}회`} 충전 완료!` 
        });

        // 부모 컴포넌트에 알림
        if (onPaymentComplete) {
          onPaymentComplete(planId, plan.credits);
        }

        // 3초 후 앱으로 이동
        setTimeout(() => {
          onNavigate('app');
        }, 2500);
      } else {
        // 결제 실패
        setPaymentMessage({ 
          type: 'error', 
          text: result.error || '결제에 실패했습니다.' 
        });
      }
    } catch (error: any) {
      console.error('결제 오류:', error);
      setPaymentMessage({ 
        type: 'error', 
        text: error.message || '결제 처리 중 오류가 발생했습니다.' 
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <button 
            onClick={() => onNavigate('landing')}
            className="flex items-center gap-2"
          >
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-black text-lg">H</span>
            </div>
            <span className="font-black text-xl text-slate-800">Hospital<span className="text-emerald-600">AI</span></span>
          </button>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => onNavigate('landing')}
              className="text-sm font-bold text-slate-500 hover:text-slate-800"
            >
              홈
            </button>
            {isLoggedIn ? (
              <button
                onClick={() => onNavigate('app')}
                className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-bold hover:bg-emerald-600"
              >
                앱으로 이동
              </button>
            ) : (
              <button
                onClick={() => onNavigate('auth')}
                className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-bold hover:bg-emerald-600"
              >
                로그인
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero - 비용 비교 */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 mb-4">비용 비교</h1>
            <p className="text-slate-500 font-medium">기존 대행사 방식 vs HospitalAI</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* 기존 방식 */}
            <div className="bg-slate-100 rounded-3xl p-8 relative overflow-hidden">
              <div className="absolute top-4 right-4 px-3 py-1 bg-slate-300 text-slate-600 text-xs font-bold rounded-full">
                구식 방법
              </div>
              <h3 className="text-xl font-black text-slate-700 mb-6">기존 대행사 방식</h3>
              <div className="text-4xl font-black text-slate-800 mb-2">월 180만원</div>
              <p className="text-slate-500 text-sm mb-6">포스팅 90건 기준 (이미지 포함)</p>
              
              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>포스팅 1건당</span>
                  <span className="font-bold">20,000원</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>소요 시간</span>
                  <span className="font-bold">평균 2일</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>수정 비용</span>
                  <span className="font-bold">건당 5,000원</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>이미지 비용</span>
                  <span className="font-bold">별도 5,000원</span>
                </div>
              </div>
            </div>

            {/* HospitalAI */}
            <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-3xl p-8 relative overflow-hidden text-white shadow-2xl shadow-emerald-200">
              <div className="absolute top-4 right-4 px-3 py-1 bg-white/20 text-white text-xs font-bold rounded-full">
                🚀 89% 절약!
              </div>
              <h3 className="text-xl font-black mb-6">HospitalAI 프리미엄</h3>
              <div className="text-4xl font-black mb-2">월 59,900원</div>
              <p className="text-emerald-100 text-sm mb-6">무제한 사용 (월 구독)</p>
              
              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-emerald-50">
                  <span>포스팅 1건당</span>
                  <span className="font-bold">💎 무제한</span>
                </div>
                <div className="flex justify-between text-emerald-50">
                  <span>소요 시간</span>
                  <span className="font-bold">⚡ 30초</span>
                </div>
                <div className="flex justify-between text-emerald-50">
                  <span>수정 비용</span>
                  <span className="font-bold">🆓 무료</span>
                </div>
                <div className="flex justify-between text-emerald-50">
                  <span>AI 이미지</span>
                  <span className="font-bold">🎁 모두 포함</span>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-white/20 text-center">
                <div className="text-2xl font-black">연간 1,440만원 절약!</div>
                <p className="text-emerald-200 text-sm">기존 방식 대비 월 120만원 절약</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 요금제 섹션 */}
      <section className="py-16 px-4 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 text-red-600 rounded-full text-sm font-bold mb-4">
              🔥 오늘이 제일 싸요 · 첫 달 50% 할인
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-4">요금제</h2>
            <p className="text-slate-500 font-medium">필요한 만큼만 선택하세요</p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* 무료 체험 */}
            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-lg">
              <div className="text-center mb-6">
                <span className="inline-block px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-full mb-4">
                  무료 체험
                </span>
                <h3 className="text-2xl font-black text-slate-800 mb-2">맛보기</h3>
                <p className="text-slate-500 text-sm">서비스 체험용</p>
              </div>

              <div className="text-center mb-6">
                <div className="text-4xl font-black text-slate-900">무료</div>
                <p className="text-emerald-600 font-bold text-sm mt-2">원고 3회 · 계정당 1회</p>
              </div>

              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="text-emerald-500">✓</span> 블로그 원고 생성 3회
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="text-emerald-500">✓</span> AI 이미지 생성
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="text-emerald-500">✓</span> 의료광고법 준수 검사
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="text-emerald-500">✓</span> 5가지 디자인 테마
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-400">
                  <span className="text-slate-300">✗</span> 카드뉴스 생성
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-400">
                  <span className="text-slate-300">✗</span> 이메일 지원
                </li>
              </ul>

              <button
                onClick={() => onNavigate('auth')}
                className="w-full py-4 bg-slate-100 text-slate-700 font-bold rounded-2xl hover:bg-slate-200 transition-all"
              >
                무료로 시작하기
              </button>
            </div>

            {/* 건별 결제 */}
            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-lg">
              <div className="text-center mb-6">
                <span className="inline-block px-3 py-1 bg-blue-100 text-blue-600 text-xs font-bold rounded-full mb-4">
                  💡 건별 결제
                </span>
                <h3 className="text-2xl font-black text-slate-800 mb-2">베이직</h3>
                <p className="text-slate-500 text-sm">필요한 만큼만</p>
              </div>

              {/* 건수 선택 */}
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => setSelectedBasic(10)}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                    selectedBasic === 10
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  10건
                </button>
                <button
                  onClick={() => setSelectedBasic(20)}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                    selectedBasic === 20
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  20건
                </button>
              </div>

              <div className="text-center mb-6">
                <div className="text-slate-400 line-through text-sm">
                  ₩{basicPrices[selectedBasic].original.toLocaleString()}
                </div>
                <div className="text-4xl font-black text-slate-900">
                  ₩{basicPrices[selectedBasic].price.toLocaleString()}
                </div>
                <p className="text-emerald-600 font-bold text-sm mt-2">
                  건당 ₩{basicPrices[selectedBasic].perUnit.toLocaleString()} · 유효기간 3개월
                </p>
              </div>

              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="text-emerald-500">✓</span> 블로그 원고 생성 {selectedBasic}회
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="text-emerald-500">✓</span> AI 이미지 생성
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="text-emerald-500">✓</span> 의료광고법 준수 검사
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="text-emerald-500">✓</span> 카드뉴스 생성
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="text-emerald-500">✓</span> 5가지 디자인 테마
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-400">
                  <span className="text-slate-300">✗</span> 이메일 지원
                </li>
              </ul>

              <button
                onClick={() => handlePurchase('basic')}
                disabled={isProcessing}
                className={`w-full py-4 font-bold rounded-2xl transition-all ${
                  isProcessing 
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed' 
                    : 'bg-emerald-500 text-white hover:bg-emerald-600'
                }`}
              >
                {isProcessing ? '처리 중...' : '구매하기'}
              </button>
            </div>

            {/* 프리미엄 */}
            <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-3xl p-8 shadow-2xl shadow-emerald-200 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="px-4 py-1 bg-yellow-400 text-yellow-900 text-xs font-black rounded-full shadow-lg">
                  🏆 BEST
                </span>
              </div>

              <div className="text-center mb-6">
                <span className="inline-block px-3 py-1 bg-white/20 text-white text-xs font-bold rounded-full mb-4">
                  🚀 무제한
                </span>
                <h3 className="text-2xl font-black text-white mb-2">프리미엄</h3>
                <p className="text-emerald-100 text-sm">대형 병원 / 대행사용</p>
              </div>

              {/* 기간 선택 */}
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => setSelectedPremium('monthly')}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                    selectedPremium === 'monthly'
                      ? 'bg-white text-emerald-600'
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  월간
                </button>
                <button
                  onClick={() => setSelectedPremium('yearly')}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                    selectedPremium === 'yearly'
                      ? 'bg-white text-emerald-600'
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  연간 (30% 할인)
                </button>
              </div>

              <div className="text-center mb-6">
                <div className="text-white/60 line-through text-sm">
                  ₩{premiumPrices[selectedPremium].original.toLocaleString()}
                </div>
                <div className="text-4xl font-black text-white">
                  ₩{premiumPrices[selectedPremium].price.toLocaleString()}
                </div>
                <p className="text-emerald-200 font-bold text-sm mt-2">
                  {selectedPremium === 'monthly' ? '무제한 · 월 구독' : `월 ₩${premiumPrices.yearly.monthly.toLocaleString()} · 연간 결제`}
                </p>
              </div>

              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-sm text-white">
                  <span>✓</span> 무제한 원고 생성
                </li>
                <li className="flex items-center gap-2 text-sm text-white">
                  <span>✓</span> AI 이미지 무제한
                </li>
                <li className="flex items-center gap-2 text-sm text-white">
                  <span>✓</span> 의료광고법 준수 검사
                </li>
                <li className="flex items-center gap-2 text-sm text-white">
                  <span>✓</span> 카드뉴스 생성
                </li>
                <li className="flex items-center gap-2 text-sm text-white">
                  <span>✓</span> 5가지 디자인 테마
                </li>
                <li className="flex items-center gap-2 text-sm text-white">
                  <span>✓</span> 우선 이메일 지원
                </li>
              </ul>

              <button
                onClick={() => handlePurchase('premium')}
                disabled={isProcessing}
                className={`w-full py-4 font-bold rounded-2xl transition-all ${
                  isProcessing 
                    ? 'bg-white/50 text-emerald-400 cursor-not-allowed' 
                    : 'bg-white text-emerald-600 hover:bg-emerald-50'
                }`}
              >
                {isProcessing ? '처리 중...' : '구독하기'}
              </button>
            </div>
          </div>

          {/* 플랜 선택 가이드 */}
          <div className="max-w-3xl mx-auto mt-12 bg-white rounded-2xl p-6 border border-slate-200">
            <h4 className="font-black text-slate-800 mb-4">💡 어떤 플랜을 선택해야 할까요?</h4>
            <div className="grid sm:grid-cols-3 gap-4 text-sm">
              <div className="p-4 bg-slate-50 rounded-xl">
                <div className="font-bold text-slate-800 mb-1">맛보기</div>
                <p className="text-slate-500">처음 사용해보시는 분</p>
              </div>
              <div className="p-4 bg-blue-50 rounded-xl">
                <div className="font-bold text-blue-800 mb-1">베이직</div>
                <p className="text-blue-600">개인 블로거, 소규모 병원</p>
              </div>
              <div className="p-4 bg-emerald-50 rounded-xl">
                <div className="font-bold text-emerald-800 mb-1">프리미엄</div>
                <p className="text-emerald-600">대형 병원, 마케팅 대행사</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-black text-slate-900 text-center mb-8">자주 묻는 질문</h2>
          
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-2">결제 수단은 무엇이 있나요?</h3>
              <p className="text-slate-500 text-sm">신용카드, 체크카드, 카카오페이, 네이버페이, 토스페이 등 다양한 결제 수단을 지원합니다.</p>
            </div>
            
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-2">유효기간이 지나면 어떻게 되나요?</h3>
              <p className="text-slate-500 text-sm">유효기간 내 사용하지 않은 크레딧은 소멸됩니다. 프리미엄 구독은 매월/매년 자동 갱신됩니다.</p>
            </div>
            
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-2">환불이 가능한가요?</h3>
              <p className="text-slate-500 text-sm">크레딧 사용 전 7일 이내 전액 환불 가능합니다. 일부 사용 시 잔여 크레딧에 대해 환불 요청할 수 있습니다.</p>
            </div>
            
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-2">같은 IP로 다른 계정을 만들면 맛보기가 추가로 주어지나요?</h3>
              <p className="text-slate-500 text-sm">아니요. 동일한 IP에서는 여러 계정을 생성하더라도 맛보기 크레딧이 추가로 주어지지 않습니다.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-black text-white mb-4">지금 시작하고 89% 비용을 절약하세요</h2>
          <p className="text-slate-400 mb-8">무료 체험으로 HospitalAI의 놀라운 효과를 직접 경험해보세요</p>
          
          <div className="grid grid-cols-3 gap-4 max-w-md mx-auto mb-8">
            <div className="text-center">
              <div className="text-2xl font-black text-emerald-400">⚡ 30초</div>
              <p className="text-slate-500 text-xs">생성 시간</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black text-emerald-400">💰 1,000원</div>
              <p className="text-slate-500 text-xs">건당 비용</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black text-emerald-400">🎉 89%</div>
              <p className="text-slate-500 text-xs">비용 절감</p>
            </div>
          </div>

          <button
            onClick={() => onNavigate('auth')}
            className="px-8 py-4 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-black text-lg rounded-2xl hover:shadow-2xl hover:shadow-emerald-500/30 transition-all"
          >
            🚀 무료로 시작하기
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 bg-slate-900 border-t border-slate-800">
        <div className="max-w-6xl mx-auto text-center text-slate-500 text-sm">
          <p>© 2025 HospitalAI. All rights reserved.</p>
        </div>
      </footer>

      {/* 결제 결과 모달 */}
      {paymentMessage && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border-2 ${
            paymentMessage.type === 'success' ? 'border-emerald-200' : 'border-red-200'
          }`}>
            <div className="text-center">
              <div className="text-6xl mb-4">
                {paymentMessage.type === 'success' ? '🎉' : '😢'}
              </div>
              <h3 className={`text-xl font-black mb-2 ${
                paymentMessage.type === 'success' ? 'text-emerald-600' : 'text-red-600'
              }`}>
                {paymentMessage.type === 'success' ? '결제 완료!' : '결제 실패'}
              </h3>
              <p className="text-slate-600 mb-6">{paymentMessage.text}</p>
              
              {paymentMessage.type === 'success' ? (
                <p className="text-sm text-slate-400">잠시 후 앱으로 이동합니다...</p>
              ) : (
                <button
                  onClick={() => setPaymentMessage(null)}
                  className="px-6 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all"
                >
                  닫기
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
