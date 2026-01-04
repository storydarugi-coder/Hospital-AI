import React, { useState, useEffect } from 'react';
import { GenerationRequest, GenerationState } from './types';
import { generateFullPost } from './services/geminiService';
import InputForm from './components/InputForm';
import ResultPreview from './components/ResultPreview';
import AdminPage from './components/AdminPage';
import LandingPage from './components/LandingPage';
import { AuthPage } from './components/AuthPage';
import { PricingPage } from './components/PricingPage';
import { supabase, signOut } from './lib/supabase';
import type { User } from '@supabase/supabase-js';
import { PLANS, savePaymentRecord, generatePaymentId } from './services/paymentService';

type PageType = 'landing' | 'app' | 'admin' | 'auth' | 'pricing';

// 사용자 정보 타입
interface UserProfile {
  id: string;
  email: string;
  name: string;
  plan: 'free' | 'basic' | 'standard' | 'premium';
  remainingCredits: number;
}

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageType>('landing');
  const [apiKeyReady, setApiKeyReady] = useState<boolean>(false);
  const [state, setState] = useState<GenerationState>({
    isLoading: false,
    error: null,
    data: null,
    progress: '',
  });
  
  // Supabase 인증 상태
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [isAdmin, setIsAdmin] = useState<boolean>(false); // 관리자 여부

  const [mobileTab, setMobileTab] = useState<'input' | 'result'>('input');
  
  // 쿠폰 모달 상태
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponMessage, setCouponMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // 유효한 쿠폰 목록
  const VALID_COUPONS: Record<string, { credits: number; description: string }> = {
    'MARKETING2026': { credits: 5, description: '마케팅 2026 프로모션' },
    'WELCOME2025': { credits: 3, description: '신규 가입 환영' },
    'HOSPITAL100': { credits: 10, description: '병원 마케팅 100일 기념' },
  };
  
  // 사용한 쿠폰 저장 (localStorage)
  const getUsedCoupons = (): string[] => {
    try {
      return JSON.parse(localStorage.getItem('used_coupons') || '[]');
    } catch {
      return [];
    }
  };
  
  // 크레딧 저장/불러오기 (localStorage)
  const saveUserCredits = (userId: string, credits: number, plan: string, expiresAt?: string) => {
    const creditData = { credits, plan, expiresAt, updatedAt: new Date().toISOString() };
    localStorage.setItem(`user_credits_${userId}`, JSON.stringify(creditData));
  };
  
  const loadUserCredits = (userId: string): { credits: number; plan: string; expiresAt?: string } | null => {
    try {
      const data = localStorage.getItem(`user_credits_${userId}`);
      if (data) {
        const parsed = JSON.parse(data);
        // 만료일 체크 (프리미엄 구독)
        if (parsed.expiresAt && new Date(parsed.expiresAt) < new Date()) {
          // 구독 만료됨
          return { credits: 0, plan: 'free' };
        }
        return parsed;
      }
    } catch {
      // ignore
    }
    return null;
  };
  
  const handleApplyCoupon = () => {
    const code = couponCode.toUpperCase().trim();
    setCouponMessage(null);
    
    if (!code) {
      setCouponMessage({ type: 'error', text: '쿠폰 코드를 입력해주세요.' });
      return;
    }
    
    const usedCoupons = getUsedCoupons();
    
    if (usedCoupons.includes(code)) {
      setCouponMessage({ type: 'error', text: '이미 사용한 쿠폰입니다.' });
      return;
    }
    
    const coupon = VALID_COUPONS[code];
    
    if (!coupon) {
      setCouponMessage({ type: 'error', text: '유효하지 않은 쿠폰 코드입니다.' });
      return;
    }
    
    // 쿠폰 적용
    if (userProfile) {
      const currentCredits = userProfile.remainingCredits === -1 ? 0 : userProfile.remainingCredits;
      const newCredits = currentCredits + coupon.credits;
      const updatedProfile = { ...userProfile, remainingCredits: newCredits };
      setUserProfile(updatedProfile);
      
      // 사용한 쿠폰 저장
      localStorage.setItem('used_coupons', JSON.stringify([...usedCoupons, code]));
      
      // 크레딧 저장
      saveUserCredits(userProfile.id, newCredits, userProfile.plan);
      
      setCouponMessage({ type: 'success', text: `🎉 ${coupon.description} 쿠폰 적용! +${coupon.credits}회 추가되었습니다.` });
      setCouponCode('');
      
      // 3초 후 모달 닫기
      setTimeout(() => {
        setShowCouponModal(false);
        setCouponMessage(null);
      }, 2000);
    } else {
      setCouponMessage({ type: 'error', text: '로그인 후 쿠폰을 사용할 수 있습니다.' });
    }
  };

  // Supabase 인증 상태 감시
  useEffect(() => {
    // 관리자 인증 상태 확인 (localStorage)
    const adminAuth = localStorage.getItem('ADMIN_AUTHENTICATED');
    if (adminAuth === 'true') {
      setIsAdmin(true);
    }
    
    // 현재 세션 확인
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Session check result:', session?.user?.email);
      if (session?.user) {
        console.log('User found, setting isLoggedIn to true');
        setSupabaseUser(session.user);
        setIsLoggedIn(true);
        // 프로필 정보 설정 (저장된 크레딧 불러오기)
        const { plan, remainingCredits } = loadSavedCredits(session.user);
        setUserProfile({
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || '사용자',
          plan,
          remainingCredits
        });
      }
      setAuthLoading(false);
    };
    
    checkSession();

    console.log('Initial auth check started');
    
    // 저장된 크레딧 불러오기 함수
    const loadSavedCredits = (user: User) => {
      const savedCredits = loadUserCredits(user.id);
      if (savedCredits) {
        return {
          plan: savedCredits.plan as 'free' | 'basic' | 'standard' | 'premium',
          remainingCredits: savedCredits.credits
        };
      }
      // 신규 사용자: 무료 3회 (오픈 이벤트 기간에는 999)
      return {
        plan: 'free' as const,
        remainingCredits: 999 // 🎉 오픈 이벤트: 무제한 무료 사용
      };
    };
    
    // 인증 상태 변경 감시
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth event:', event);
      
      if (session?.user) {
        setSupabaseUser(session.user);
        setIsLoggedIn(true);
        // 프로필 정보 설정 (저장된 크레딧 불러오기)
        const { plan, remainingCredits } = loadSavedCredits(session.user);
        setUserProfile({
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || '사용자',
          plan,
          remainingCredits
        });
        
        // 로그인 성공 시 앱으로 이동
        if (event === 'SIGNED_IN' && currentPage === 'auth') {
          window.location.hash = 'app';
          setCurrentPage('app');
        }
      } else {
        setSupabaseUser(null);
        setUserProfile(null);
        setIsLoggedIn(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // URL hash 기반 라우팅
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      
      // 페이지 전환 시 스크롤을 맨 위로
      window.scrollTo(0, 0);
      
      if (hash === '#admin') {
        setCurrentPage('admin');
      } else if (hash === '#app') {
        // 비로그인 시 #app 접근 차단 (관리자는 예외)
        if (!isLoggedIn && !isAdmin && !authLoading) {
          window.location.hash = 'auth';
          setCurrentPage('auth');
          return;
        }
        setCurrentPage('app');
      } else if (hash === '#auth' || hash === '#login' || hash === '#register') {
        setCurrentPage('auth');
      } else if (hash === '#pricing') {
        setCurrentPage('pricing');
      } else {
        setCurrentPage('landing');
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [isLoggedIn, isAdmin, authLoading]);

  // 페이지 네비게이션 헬퍼
  const handleNavigate = (page: PageType) => {
    if (page === 'landing') {
      window.location.hash = '';
    } else {
      window.location.hash = page;
    }
    setCurrentPage(page);
  };

  // 로그아웃 핸들러
  const handleLogout = async () => {
    await signOut();
    setSupabaseUser(null);
    setUserProfile(null);
    setIsLoggedIn(false);
    window.location.hash = '';
    setCurrentPage('landing');
  };

  // 서버에서 API 키 불러오기 (Cloudflare 환경변수)
  useEffect(() => {
    const loadConfigFromServer = async () => {
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          const config = await res.json();
          // 서버에서 받은 키를 localStorage에 저장
          if (config.geminiKey) {
            localStorage.setItem('GEMINI_API_KEY', config.geminiKey);
            localStorage.setItem('GLOBAL_GEMINI_API_KEY', config.geminiKey);
          }
          if (config.naverClientId) {
            localStorage.setItem('NAVER_CLIENT_ID', config.naverClientId);
            localStorage.setItem('GLOBAL_NAVER_CLIENT_ID', config.naverClientId);
          }
          if (config.naverClientSecret) {
            localStorage.setItem('NAVER_CLIENT_SECRET', config.naverClientSecret);
            localStorage.setItem('GLOBAL_NAVER_CLIENT_SECRET', config.naverClientSecret);
          }
          setApiKeyReady(!!config.geminiKey);
        }
      } catch (err) {
        console.log('서버 config 로드 실패, localStorage 사용');
      }
      
      // 서버에서 못 받으면 localStorage 확인
      const localGemini = localStorage.getItem('GEMINI_API_KEY');
      if (localGemini) {
        setApiKeyReady(true);
      }
    };
    
    loadConfigFromServer();
  }, [currentPage]);

  const handleGenerate = async (request: GenerationRequest) => {
    // 크레딧 체크 (로그인 시에만, 관리자 제외)
    if (isLoggedIn && userProfile && !isAdmin && userProfile.remainingCredits <= 0 && userProfile.plan !== 'premium') {
      setState(prev => ({ 
        ...prev, 
        error: '크레딧이 부족합니다. 요금제를 업그레이드해주세요.' 
      }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null, progress: '네이버 로직 기반 키워드 분석 및 이미지 생성 중...' }));
    setMobileTab('result');
    try {
      const result = await generateFullPost(request, (p) => setState(prev => ({ ...prev, progress: p })));
      setState({ isLoading: false, error: null, data: result, progress: '' });
      
      // 크레딧 차감 (로그인 시에만, 프리미엄/관리자 제외)
      if (isLoggedIn && userProfile && userProfile.plan !== 'premium' && userProfile.remainingCredits !== -1 && !isAdmin) {
        const newCredits = userProfile.remainingCredits - 1;
        const updatedProfile = { ...userProfile, remainingCredits: newCredits };
        setUserProfile(updatedProfile);
        // localStorage에 저장
        saveUserCredits(userProfile.id, newCredits, userProfile.plan);
      }
    } catch (err: any) {
       setState(prev => ({ ...prev, isLoading: false, error: err.message }));
       setMobileTab('input');
    }
  };

  // 로딩 중
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500">로딩 중...</p>
        </div>
      </div>
    );
  }

  // Auth 페이지 렌더링
  if (currentPage === 'auth') {
    return <AuthPage onNavigate={handleNavigate} />;
  }

  // 결제 완료 콜백
  const handlePaymentComplete = (planId: string, credits: number) => {
    if (!userProfile) return;
    
    const plan = PLANS[planId];
    if (!plan) return;
    
    // 결제 기록 저장
    savePaymentRecord({
      paymentId: generatePaymentId(),
      planId,
      planName: plan.name,
      credits: plan.credits,
      amount: plan.price,
      status: 'completed',
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      userId: userProfile.id
    });
    
    // 크레딧 업데이트
    let newPlan: 'free' | 'basic' | 'standard' | 'premium';
    let newCredits: number;
    let expiresAt: string | undefined;
    
    if (credits === -1) {
      // 프리미엄 (무제한)
      newPlan = 'premium';
      newCredits = -1;
      // 만료일 설정 (월간: 30일, 연간: 365일)
      const days = plan.duration === 'yearly' ? 365 : 30;
      expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    } else {
      // 베이직/스탠다드 (크레딧 추가)
      const currentCredits = userProfile.remainingCredits === -1 ? 0 : userProfile.remainingCredits;
      newCredits = currentCredits + credits;
      newPlan = planId.includes('standard') ? 'standard' : 'basic';
      // 유효기간 3개월
      expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    }
    
    // 프로필 업데이트
    const updatedProfile = {
      ...userProfile,
      plan: newPlan,
      remainingCredits: newCredits
    };
    setUserProfile(updatedProfile);
    
    // localStorage에 저장
    saveUserCredits(userProfile.id, newCredits, newPlan, expiresAt);
    
    console.log(`결제 완료: ${plan.name}, 크레딧: ${credits === -1 ? '무제한' : `+${credits}회`}, 저장됨`);
  };

  // Pricing 페이지 렌더링
  if (currentPage === 'pricing') {
    return (
      <PricingPage 
        onNavigate={handleNavigate}
        isLoggedIn={isLoggedIn}
        currentPlan={userProfile?.plan || 'free'}
        remainingCredits={userProfile?.remainingCredits || 0}
        onPaymentComplete={handlePaymentComplete}
        userEmail={userProfile?.email}
        userName={userProfile?.name}
      />
    );
  }

  // Landing 페이지 렌더링
  if (currentPage === 'landing') {
    console.log('Landing page - isLoggedIn:', isLoggedIn, 'userName:', userProfile?.name);
    return <LandingPage isLoggedIn={isLoggedIn} userName={userProfile?.name} onLogout={handleLogout} />;
  }

  // Admin 페이지 렌더링
  if (currentPage === 'admin') {
    return <AdminPage onAdminVerified={() => setIsAdmin(true)} />;
  }

  // API Key 미설정 시 안내 화면
  if (!apiKeyReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center bg-white p-12 rounded-[40px] shadow-2xl border border-slate-100 relative overflow-hidden">
          <div className="text-6xl mb-6">🛠️</div>
          <h1 className="text-2xl font-black mb-3 text-slate-900">HospitalAI</h1>
          <h2 className="text-lg font-bold text-amber-600 mb-6">서비스 준비 중</h2>
          <p className="text-slate-500 mb-8 font-medium">서비스가 곧 오픈될 예정입니다.<br/>잠시만 기다려주세요!</p>
          <a 
            href="#" 
            className="block w-full bg-gradient-to-r from-emerald-500 to-green-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-emerald-100 hover:shadow-2xl transition-all active:scale-95"
          >
             🏠 홈으로 돌아가기
          </a>
        </div>
      </div>
    );
  }

  // 메인 앱 렌더링
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans relative">
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-30 h-16 flex items-center shadow-sm flex-none">
        <div className="max-w-[1600px] w-full mx-auto px-6 flex justify-between items-center">
          <a href="#" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-100">
                <span className="text-white font-black text-lg">H</span>
            </div>
            <span className="font-black text-xl tracking-tight text-slate-800">Hospital<span className="text-emerald-600">AI</span></span>
          </a>
          
          <div className="flex items-center gap-3">
             {/* 크레딧 표시 */}
             {isLoggedIn && userProfile && (
               <button 
                 onClick={() => setShowCouponModal(true)}
                 className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition-all"
               >
                 <span className="text-sm text-slate-500">크레딧:</span>
                 <span className="text-sm font-bold text-emerald-600">
                   {userProfile.plan === 'premium' ? '∞' : userProfile.remainingCredits}
                 </span>
                 <span className="text-xs text-emerald-500">🎟️</span>
               </button>
             )}
             
             <a 
               href="#" 
               className="p-2.5 hover:bg-slate-100 rounded-xl transition-all text-sm font-bold text-slate-500 hidden sm:flex items-center gap-2"
             >
                🏠 홈
             </a>
             <a 
               href="#pricing" 
               className="p-2.5 hover:bg-slate-100 rounded-xl transition-all text-sm font-bold text-slate-500 hidden sm:flex items-center gap-2"
             >
                💎 결제
             </a>
             
             {/* 로그인/사용자 버튼 */}
             {isLoggedIn && userProfile ? (
               <div className="flex items-center gap-2">
                 {isAdmin && (
                   <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold">
                     👑 관리자
                   </span>
                 )}
                 <span className="text-sm text-slate-600 hidden sm:block">
                   {userProfile.name} 님
                 </span>
                 <button 
                   onClick={handleLogout}
                   className="px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all"
                 >
                   로그아웃
                 </button>
               </div>
             ) : (
               <a 
                 href="#auth" 
                 className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-bold hover:bg-emerald-600 transition-all"
               >
                 로그인
               </a>
             )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 lg:p-8 flex flex-col lg:flex-row gap-8 overflow-hidden h-[calc(100vh-64px)]">
        
        <div className={`lg:w-[400px] flex flex-col gap-6 overflow-y-auto pb-24 lg:pb-0 custom-scrollbar ${mobileTab === 'result' ? 'hidden lg:flex' : 'flex'}`}>
          <InputForm onSubmit={handleGenerate} isLoading={state.isLoading} />
        </div>

        <div className={`flex-1 h-full flex flex-col ${mobileTab === 'input' ? 'hidden lg:flex' : 'flex'} overflow-hidden`}>
          {state.isLoading ? (
            <div className="bg-white rounded-[40px] border border-slate-100 p-20 flex flex-col items-center justify-center h-full text-center shadow-2xl animate-pulse">
              <div className="relative mb-10">
                <div className="w-24 h-24 border-8 border-emerald-50 border-t-emerald-500 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center text-3xl">🏥</div>
              </div>
              <h2 className="text-2xl font-black text-slate-800 mb-4">{state.progress}</h2>
              <p className="text-slate-400 max-w-xs font-medium text-center">네이버 스마트블록 노출을 위한<br/>최적의 의료 콘텐츠를 생성하고 있습니다.</p>
            </div>
          ) : state.data ? (
            <ResultPreview content={state.data} />
          ) : (
            <div className="h-full bg-white rounded-[40px] shadow-2xl border border-slate-100 flex flex-col items-center justify-center p-20 text-center group">
               <div className="w-32 h-32 bg-slate-50 rounded-full flex items-center justify-center text-6xl mb-10 group-hover:scale-110 transition-transform duration-500 grayscale opacity-20">📝</div>
               <h3 className="text-2xl font-black text-slate-300">블로그 원고 생성</h3>
               <p className="text-slate-300 mt-4 max-w-xs font-medium">좌측 메뉴에서 진료과와 주제를 선택하면<br/>상위 노출 로직이 적용된 글이 생성됩니다.</p>
            </div>
          )}
        </div>

      </main>

      <div className="lg:hidden bg-white/90 backdrop-blur-xl border-t border-slate-200 fixed bottom-0 left-0 right-0 z-30 flex p-2">
        <button onClick={() => setMobileTab('input')} className={`flex-1 py-3 rounded-2xl text-sm font-black transition-all ${mobileTab === 'input' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400'}`}>🛠️ 설정</button>
        <button onClick={() => setMobileTab('result')} className={`flex-1 py-3 rounded-2xl text-sm font-black transition-all ${mobileTab === 'result' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400'}`}>📄 결과</button>
      </div>
      
      {/* 쿠폰 모달 */}
      {showCouponModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-slate-800">🎟️ 쿠폰 등록</h3>
              <button 
                onClick={() => { setShowCouponModal(false); setCouponMessage(null); setCouponCode(''); }}
                className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"
              >
                ✕
              </button>
            </div>
            
            <div className="mb-6">
              <p className="text-sm text-slate-500 mb-4">
                현재 크레딧: <span className="font-bold text-emerald-600">{userProfile?.remainingCredits || 0}회</span>
              </p>
              
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="쿠폰 코드 입력"
                  className="flex-1 px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono uppercase"
                  onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
                />
                <button
                  onClick={handleApplyCoupon}
                  className="px-6 py-3 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 transition-all"
                >
                  적용
                </button>
              </div>
            </div>
            
            {couponMessage && (
              <div className={`p-4 rounded-xl mb-4 ${
                couponMessage.type === 'success' 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                <p className="text-sm font-medium">{couponMessage.text}</p>
              </div>
            )}
            
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-2">💡 쿠폰 사용 안내</p>
              <ul className="text-xs text-slate-400 space-y-1">
                <li>• 쿠폰은 계정당 1회만 사용 가능합니다.</li>
                <li>• 대소문자 구분 없이 입력하세요.</li>
                <li>• 추가된 크레딧은 즉시 적용됩니다.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
