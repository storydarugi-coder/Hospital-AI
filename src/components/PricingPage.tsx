import React from 'react';

interface PricingPageProps {
  onNavigate: (page: 'landing' | 'app' | 'admin' | 'auth' | 'pricing') => void;
  isLoggedIn?: boolean;
  currentPlan?: string;
  remainingCredits?: number;
}

interface PlanFeature {
  text: string;
  included: boolean;
}

interface Plan {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  period: string;
  credits: number | 'unlimited';
  validity: string;
  description: string;
  features: PlanFeature[];
  popular?: boolean;
  cta: string;
}

export const PricingPage: React.FC<PricingPageProps> = ({ 
  onNavigate, 
  isLoggedIn = false,
  currentPlan = 'free',
  remainingCredits = 3
}) => {
  const plans: Plan[] = [
    {
      id: 'free',
      name: '맛보기',
      price: 0,
      period: '',
      credits: 3,
      validity: '계정당 1회',
      description: '서비스 체험용',
      features: [
        { text: '원고 3회 생성', included: true },
        { text: 'AI 이미지 생성', included: true },
        { text: '5가지 CSS 테마', included: true },
        { text: '의료광고법 준수 검사', included: true },
        { text: '네이버/티스토리 복사', included: true },
        { text: '카드뉴스 생성', included: false },
        { text: '이메일 지원', included: false },
      ],
      cta: '무료로 시작하기',
    },
    {
      id: 'basic',
      name: '베이직',
      price: 10000,
      period: '',
      credits: 10,
      validity: '3개월',
      description: '개인 블로거용',
      features: [
        { text: '원고 10회 생성', included: true },
        { text: 'AI 이미지 생성', included: true },
        { text: '5가지 CSS 테마', included: true },
        { text: '의료광고법 준수 검사', included: true },
        { text: '네이버/티스토리 복사', included: true },
        { text: '카드뉴스 생성', included: true },
        { text: '이메일 지원', included: false },
      ],
      cta: '베이직 시작하기',
    },
    {
      id: 'standard',
      name: '스탠다드',
      price: 19900,
      originalPrice: 20000,
      period: '',
      credits: 20,
      validity: '3개월',
      description: '소규모 병원용',
      features: [
        { text: '원고 20회 생성', included: true },
        { text: 'AI 이미지 생성', included: true },
        { text: '5가지 CSS 테마', included: true },
        { text: '의료광고법 준수 검사', included: true },
        { text: '네이버/티스토리 복사', included: true },
        { text: '카드뉴스 생성', included: true },
        { text: '이메일 지원', included: true },
      ],
      popular: true,
      cta: '스탠다드 시작하기',
    },
    {
      id: 'premium',
      name: '프리미엄',
      price: 59900,
      period: '/월',
      credits: 'unlimited',
      validity: '구독 중 무제한',
      description: '대형 병원/대행사용',
      features: [
        { text: '무제한 원고 생성', included: true },
        { text: 'AI 이미지 생성', included: true },
        { text: '5가지 CSS 테마', included: true },
        { text: '의료광고법 준수 검사', included: true },
        { text: '네이버/티스토리 복사', included: true },
        { text: '카드뉴스 생성', included: true },
        { text: '우선 이메일 지원', included: true },
      ],
      cta: '프리미엄 구독하기',
    },
  ];

  const handlePurchase = (planId: string) => {
    if (!isLoggedIn) {
      onNavigate('auth');
      return;
    }
    
    // TODO: 결제 연동 (Toss Payments, etc.)
    console.log('Purchase plan:', planId);
    alert(`${planId} 플랜 결제 기능은 Supabase 연동 후 활성화됩니다.`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-500/20 rounded-full blur-3xl"></div>
      </div>

      {/* Header */}
      <header className="relative border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <button 
            onClick={() => onNavigate('landing')}
            className="flex items-center gap-2 text-white hover:opacity-80 transition-opacity"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center">
              <span className="text-xl font-bold text-white">H</span>
            </div>
            <span className="text-xl font-bold">HospitalAI</span>
          </button>
          
          <div className="flex items-center gap-4">
            {isLoggedIn ? (
              <>
                <span className="text-slate-300 text-sm">
                  남은 크레딧: <span className="text-emerald-400 font-bold">{remainingCredits}</span>
                </span>
                <button
                  onClick={() => onNavigate('app')}
                  className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
                >
                  앱으로 이동
                </button>
              </>
            ) : (
              <button
                onClick={() => onNavigate('auth')}
                className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
              >
                로그인
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative max-w-7xl mx-auto px-4 py-16">
        {/* Hero */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            합리적인 <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">요금제</span>
          </h1>
          <p className="text-slate-300 text-lg max-w-2xl mx-auto">
            필요한 만큼만 선택하세요. 모든 플랜에서 의료광고법 준수 검사와 AI 이미지 생성을 이용하실 수 있습니다.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-slate-800/80 backdrop-blur-xl rounded-2xl border transition-all hover:scale-105 ${
                plan.popular
                  ? 'border-emerald-500 shadow-2xl shadow-emerald-500/20'
                  : 'border-slate-700/50'
              }`}
            >
              {/* Popular Badge */}
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="px-4 py-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-bold rounded-full">
                    인기
                  </span>
                </div>
              )}

              <div className="p-6">
                {/* Plan Info */}
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-white mb-1">{plan.name}</h3>
                  <p className="text-slate-400 text-sm mb-4">{plan.description}</p>
                  
                  <div className="mb-2">
                    {plan.originalPrice && (
                      <span className="text-slate-500 line-through text-sm mr-2">
                        ₩{plan.originalPrice.toLocaleString()}
                      </span>
                    )}
                    <span className="text-3xl font-bold text-white">
                      {plan.price === 0 ? '무료' : `₩${plan.price.toLocaleString()}`}
                    </span>
                    {plan.period && <span className="text-slate-400">{plan.period}</span>}
                  </div>
                  
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <span className="text-emerald-400 font-semibold">
                      {plan.credits === 'unlimited' ? '무제한' : `${plan.credits}회`}
                    </span>
                    <span className="text-slate-500">|</span>
                    <span className="text-slate-400">{plan.validity}</span>
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm">
                      {feature.included ? (
                        <i className="fas fa-check text-emerald-400"></i>
                      ) : (
                        <i className="fas fa-times text-slate-600"></i>
                      )}
                      <span className={feature.included ? 'text-slate-300' : 'text-slate-600'}>
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <button
                  onClick={() => handlePurchase(plan.id)}
                  disabled={currentPlan === plan.id && plan.id !== 'free'}
                  className={`w-full py-3 rounded-xl font-semibold transition-all ${
                    plan.popular
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 shadow-lg'
                      : currentPlan === plan.id && plan.id !== 'free'
                      ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                      : 'bg-slate-700 text-white hover:bg-slate-600'
                  }`}
                >
                  {currentPlan === plan.id && plan.id !== 'free' ? '현재 플랜' : plan.cta}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-white text-center mb-8">자주 묻는 질문</h2>
          
          <div className="space-y-4">
            <div className="bg-slate-800/60 rounded-xl p-6 border border-slate-700/50">
              <h3 className="text-white font-semibold mb-2">결제 수단은 무엇이 있나요?</h3>
              <p className="text-slate-400 text-sm">신용카드, 체크카드, 카카오페이, 네이버페이, 토스페이 등 다양한 결제 수단을 지원합니다.</p>
            </div>
            
            <div className="bg-slate-800/60 rounded-xl p-6 border border-slate-700/50">
              <h3 className="text-white font-semibold mb-2">유효기간이 지나면 어떻게 되나요?</h3>
              <p className="text-slate-400 text-sm">유효기간 내 사용하지 않은 크레딧은 소멸됩니다. 프리미엄 구독은 매월 자동 갱신됩니다.</p>
            </div>
            
            <div className="bg-slate-800/60 rounded-xl p-6 border border-slate-700/50">
              <h3 className="text-white font-semibold mb-2">환불이 가능한가요?</h3>
              <p className="text-slate-400 text-sm">크레딧 사용 전 7일 이내 전액 환불 가능합니다. 일부 사용 시 잔여 크레딧에 대해 환불 요청할 수 있습니다.</p>
            </div>
            
            <div className="bg-slate-800/60 rounded-xl p-6 border border-slate-700/50">
              <h3 className="text-white font-semibold mb-2">같은 IP로 다른 계정을 만들면 맛보기가 추가로 주어지나요?</h3>
              <p className="text-slate-400 text-sm">아니요. 동일한 IP에서는 여러 계정을 생성하더라도 맛보기 크레딧이 추가로 주어지지 않습니다. 이는 서비스 남용을 방지하기 위한 정책입니다.</p>
            </div>
            
            <div className="bg-slate-800/60 rounded-xl p-6 border border-slate-700/50">
              <h3 className="text-white font-semibold mb-2">세금계산서 발급이 가능한가요?</h3>
              <p className="text-slate-400 text-sm">네, 사업자등록증 제출 시 세금계산서 발급이 가능합니다. 결제 후 고객센터로 문의해주세요.</p>
            </div>
          </div>
        </div>

        {/* Contact CTA */}
        <div className="text-center mt-16">
          <p className="text-slate-400 mb-4">더 큰 규모의 사용이 필요하신가요?</p>
          <button className="px-6 py-3 border border-emerald-500 text-emerald-400 rounded-xl hover:bg-emerald-500/10 transition-colors">
            기업 맞춤 상담 요청
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative border-t border-slate-700/50 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-slate-500 text-sm">
          <p>© 2025 HospitalAI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};
