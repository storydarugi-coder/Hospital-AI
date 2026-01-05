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
  
  // 도움말 모달 상태
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [helpTab, setHelpTab] = useState<'guide' | 'faq'>('guide');
  
  // 다크모드 상태
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('darkMode');
      return saved === 'true';
    }
    return false;
  });
  
  // 다크모드 토글
  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('darkMode', String(newMode));
  };
  
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
    <div className={`min-h-screen flex flex-col font-sans relative transition-colors duration-300 ${darkMode ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <header className={`backdrop-blur-xl border-b sticky top-0 z-30 h-16 flex items-center shadow-sm flex-none transition-colors duration-300 ${darkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-white/80 border-slate-100'}`}>
        <div className="max-w-[1600px] w-full mx-auto px-6 flex justify-between items-center">
          <a href="#" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-100">
                <span className="text-white font-black text-lg">H</span>
            </div>
            <span className={`font-black text-xl tracking-tight ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>Hospital<span className="text-emerald-500">AI</span></span>
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
             <button 
               onClick={() => setShowHelpModal(true)}
               className={`w-9 h-9 rounded-xl transition-all text-lg font-black flex items-center justify-center ${darkMode ? 'hover:bg-slate-700 text-slate-400 hover:text-emerald-400' : 'hover:bg-slate-100 text-slate-400 hover:text-emerald-600'}`}
               title="도움말"
             >
                ?
             </button>
             
             {/* 다크모드 토글 */}
             <button 
               onClick={toggleDarkMode}
               className={`w-9 h-9 rounded-xl transition-all text-lg flex items-center justify-center ${darkMode ? 'hover:bg-slate-700 text-yellow-400' : 'hover:bg-slate-100 text-slate-400'}`}
               title={darkMode ? '라이트 모드로 전환' : '다크 모드로 전환'}
             >
                {darkMode ? '☀️' : '🌙'}
             </button>
             
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
            <div className={`rounded-[40px] border p-20 flex flex-col items-center justify-center h-full text-center shadow-2xl animate-pulse transition-colors duration-300 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
              <div className="relative mb-10">
                <div className={`w-24 h-24 border-8 border-t-emerald-500 rounded-full animate-spin ${darkMode ? 'border-slate-700' : 'border-emerald-50'}`}></div>
                <div className="absolute inset-0 flex items-center justify-center text-3xl">🏥</div>
              </div>
              <h2 className={`text-2xl font-black mb-4 ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>{state.progress}</h2>
              <p className={`max-w-xs font-medium text-center ${darkMode ? 'text-slate-400' : 'text-slate-400'}`}>네이버 스마트블록 노출을 위한<br/>최적의 의료 콘텐츠를 생성하고 있습니다.</p>
            </div>
          ) : state.data ? (
            <ResultPreview content={state.data} darkMode={darkMode} />
          ) : (
            <div className={`h-full rounded-[40px] shadow-2xl border flex flex-col items-center justify-center p-20 text-center group transition-colors duration-300 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
               <div className={`w-32 h-32 rounded-full flex items-center justify-center text-6xl mb-10 group-hover:scale-110 transition-transform duration-500 grayscale opacity-20 ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>📝</div>
               <h3 className={`text-2xl font-black ${darkMode ? 'text-slate-500' : 'text-slate-300'}`}>블로그 원고 생성</h3>
               <p className={`mt-4 max-w-xs font-medium ${darkMode ? 'text-slate-500' : 'text-slate-300'}`}>좌측 메뉴에서 진료과와 주제를 선택하면<br/>상위 노출 로직이 적용된 글이 생성됩니다.</p>
            </div>
          )}
        </div>

      </main>

      <div className={`lg:hidden backdrop-blur-xl border-t fixed bottom-0 left-0 right-0 z-30 flex p-2 transition-colors duration-300 ${darkMode ? 'bg-slate-800/90 border-slate-700' : 'bg-white/90 border-slate-200'}`}>
        <button onClick={() => setMobileTab('input')} className={`flex-1 py-3 rounded-2xl text-sm font-black transition-all ${mobileTab === 'input' ? 'bg-emerald-600 text-white shadow-lg' : darkMode ? 'text-slate-400' : 'text-slate-400'}`}>🛠️ 설정</button>
        <button onClick={() => setMobileTab('result')} className={`flex-1 py-3 rounded-2xl text-sm font-black transition-all ${mobileTab === 'result' ? 'bg-emerald-600 text-white shadow-lg' : darkMode ? 'text-slate-400' : 'text-slate-400'}`}>📄 결과</button>
      </div>
      
      {/* 도움말 모달 */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl max-h-[85vh] flex flex-col">
            {/* 헤더 */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 flex-shrink-0">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <span className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600">?</span>
                도움말
              </h3>
              <button 
                onClick={() => setShowHelpModal(false)}
                className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-all"
              >
                ✕
              </button>
            </div>
            
            {/* 탭 */}
            <div className="flex p-2 mx-6 mt-4 bg-slate-100 rounded-xl flex-shrink-0">
              <button
                onClick={() => setHelpTab('guide')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${helpTab === 'guide' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                📖 사용 설명서
              </button>
              <button
                onClick={() => setHelpTab('faq')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${helpTab === 'faq' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                💬 자주 묻는 질문
              </button>
            </div>
            
            {/* 컨텐츠 */}
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
              {helpTab === 'guide' ? (
                <div className="space-y-6">
                  {/* 사용 설명서 내용 */}
                  <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-100">
                    <h4 className="font-black text-emerald-800 mb-3 flex items-center gap-2">
                      <span>🚀</span> 빠른 시작 가이드
                    </h4>
                    <ol className="text-sm text-emerald-700 space-y-2">
                      <li className="flex gap-2"><span className="font-black">1.</span> 진료과를 선택하세요 (내과, 정형외과, 피부과 등)</li>
                      <li className="flex gap-2"><span className="font-black">2.</span> 블로그 주제를 입력하세요 (예: "겨울철 관절 통증")</li>
                      <li className="flex gap-2"><span className="font-black">3.</span> 키워드를 입력하세요 (네이버 검색 키워드)</li>
                      <li className="flex gap-2"><span className="font-black">4.</span> 이미지 스타일을 선택하세요 (실사/3D/의학)</li>
                      <li className="flex gap-2"><span className="font-black">5.</span> "생성하기" 버튼을 클릭!</li>
                    </ol>
                  </div>
                  
                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                    <h4 className="font-black text-slate-800 mb-3 flex items-center gap-2">
                      <span>📝</span> 콘텐츠 타입
                    </h4>
                    <div className="text-sm text-slate-600 space-y-3">
                      <div className="flex gap-3">
                        <span className="text-lg">📄</span>
                        <div>
                          <p className="font-bold text-slate-700">블로그 포스팅</p>
                          <p className="text-slate-500">네이버 블로그에 최적화된 긴 글 형식</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <span className="text-lg">🎴</span>
                        <div>
                          <p className="font-bold text-slate-700">카드뉴스</p>
                          <p className="text-slate-500">인스타그램/SNS용 정사각형 슬라이드</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-indigo-50 rounded-2xl p-5 border border-indigo-100">
                    <h4 className="font-black text-indigo-800 mb-3 flex items-center gap-2">
                      <span>🎨</span> 카드뉴스 스타일 참고 기능
                    </h4>
                    <div className="text-sm text-indigo-700 space-y-3">
                      <p className="text-indigo-600 mb-2">따라하고 싶은 카드뉴스 디자인이 있다면:</p>
                      <div className="flex gap-3">
                        <span className="text-lg">📕</span>
                        <div>
                          <p className="font-bold text-indigo-700">표지 스타일 (1장)</p>
                          <p className="text-indigo-500">첫 장 디자인 참고 이미지 업로드</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <span className="text-lg">📄</span>
                        <div>
                          <p className="font-bold text-indigo-700">본문 스타일 (2장~)</p>
                          <p className="text-indigo-500">본문 디자인 참고 이미지 업로드</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <span className="text-lg">🔗</span>
                        <div>
                          <p className="font-bold text-indigo-700">URL 벤치마킹</p>
                          <p className="text-indigo-500">블로그/뉴스 링크로 구조 분석 (4단계)</p>
                        </div>
                      </div>
                      <p className="text-xs text-indigo-500 bg-indigo-100 p-2 rounded-lg mt-2">
                        💡 표지만 업로드하면 본문도 같은 스타일로 생성됩니다!
                      </p>
                    </div>
                  </div>
                  
                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                    <h4 className="font-black text-slate-800 mb-3 flex items-center gap-2">
                      <span>🎨</span> 이미지 스타일 설명
                    </h4>
                    <div className="text-sm text-slate-600 space-y-3">
                      <div className="flex gap-3">
                        <span className="text-lg">📸</span>
                        <div>
                          <p className="font-bold text-slate-700">실사 촬영</p>
                          <p className="text-slate-500">DSLR로 촬영한 듯한 실제 병원 사진 스타일</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <span className="text-lg">🎨</span>
                        <div>
                          <p className="font-bold text-slate-700">3D 일러스트</p>
                          <p className="text-slate-500">친근한 클레이/인포그래픽 스타일</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <span className="text-lg">🫀</span>
                        <div>
                          <p className="font-bold text-slate-700">의학 3D</p>
                          <p className="text-slate-500">해부학적 구조를 보여주는 전문 의학 이미지</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
                    <h4 className="font-black text-blue-800 mb-3 flex items-center gap-2">
                      <span>✏️</span> 결과 수정하기
                    </h4>
                    <div className="text-sm text-blue-700 space-y-2">
                      <p>• <strong>직접 편집:</strong> 미리보기 화면에서 텍스트를 클릭하여 직접 수정</p>
                      <p>• <strong>AI 수정:</strong> 하단 입력창에 수정 요청 입력 (예: "첫 문단 더 친근하게")</p>
                      <p>• <strong>이미지 재생성:</strong> 이미지 클릭 → 프롬프트 수정 → 재생성</p>
                    </div>
                  </div>
                  
                  <div className="bg-purple-50 rounded-2xl p-5 border border-purple-100">
                    <h4 className="font-black text-purple-800 mb-3 flex items-center gap-2">
                      <span>📋</span> 복사 & 다운로드
                    </h4>
                    <div className="text-sm text-purple-700 space-y-2">
                      <p>• <strong>Word 다운로드:</strong> .docx 파일로 저장 → 네이버 블로그에 업로드</p>
                      <p>• <strong>이미지 저장:</strong> 개별 이미지 클릭 후 우클릭 저장</p>
                      <p>• <strong>HTML 복사:</strong> 티스토리 등 HTML 지원 블로그용</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* FAQ 내용 */}
                  {[
                    {
                      q: "생성된 글을 네이버 블로그에 어떻게 올리나요?",
                      a: "'Word 다운로드' 버튼으로 .docx 파일을 저장한 후, 네이버 블로그 에디터에서 Word 파일을 직접 업로드하세요. 네이버 블로그는 HTML 붙여넣기가 지원되지 않아 Word 파일로 올리는 게 가장 편리합니다."
                    },
                    {
                      q: "이미지가 마음에 들지 않아요. 다시 생성할 수 있나요?",
                      a: "네! 이미지를 클릭하면 재생성 팝업이 나타납니다. 프롬프트를 수정하거나 'AI 추천' 버튼으로 새로운 프롬프트를 받아 재생성할 수 있습니다."
                    },
                    {
                      q: "글 내용을 부분적으로 수정하고 싶어요.",
                      a: "두 가지 방법이 있습니다: 1) 미리보기에서 직접 텍스트 클릭 후 수정, 2) 하단 입력창에 '두 번째 문단 더 자세하게 써줘' 같은 요청 입력"
                    },
                    {
                      q: "의료광고법에 문제없는 건가요?",
                      a: `모든 글은 ${new Date().getFullYear()}년 최신 의료광고법 가이드라인을 적용하여 생성됩니다. AI가 과장 표현, 비교 광고, 보장성 문구 등을 자동으로 필터링하지만, 최종 확인은 업로드 전에 한 번 더 해주세요.`
                    },
                    {
                      q: "크레딧은 어떻게 충전하나요?",
                      a: "상단 '결제' 버튼 또는 홈페이지 요금제 페이지에서 원하는 플랜을 선택하여 충전할 수 있습니다. 쿠폰 코드가 있다면 크레딧 버튼을 클릭하여 등록하세요."
                    },
                    {
                      q: "레퍼런스 URL은 뭔가요?",
                      a: "벤치마킹하고 싶은 블로그 글의 URL을 입력하면, 해당 글의 스타일과 구조를 참고하여 콘텐츠를 생성합니다. 경쟁 병원의 인기 글을 분석할 때 유용합니다."
                    },
                    {
                      q: "카드뉴스와 블로그 포스팅의 차이는?",
                      a: "블로그 포스팅은 긴 글 형식(16:9 이미지)이고, 카드뉴스는 인스타그램/SNS용 정사각형 슬라이드 형식입니다. 목적에 맞게 선택하세요."
                    },
                    {
                      q: "카드뉴스 스타일 참고 이미지는 어떻게 사용하나요?",
                      a: "캔바나 인스타에서 마음에 드는 카드뉴스를 캡처해서 업로드하세요. AI가 색상, 레이아웃, 타이포그래피를 분석해서 동일한 스타일로 생성합니다. 표지(1장)와 본문(2장~)을 따로 지정할 수도 있고, 표지만 업로드하면 본문도 같은 스타일로 만들어집니다. (참고: 캔바/인스타는 로그인이 필요해서 URL 분석이 안 되니 이미지 캡처 후 업로드해주세요!)"
                    },
                    {
                      q: "생성 속도가 느려요.",
                      a: "글 작성 + 이미지 생성에 약 1-2분이 소요됩니다. 이미지 개수가 많을수록 시간이 더 걸립니다. 잠시만 기다려주세요!"
                    }
                  ].map((item, idx) => (
                    <details key={idx} className="bg-slate-50 rounded-xl border border-slate-200 group">
                      <summary className="p-4 cursor-pointer font-bold text-slate-700 flex items-center justify-between hover:bg-slate-100 rounded-xl transition-all">
                        <span className="flex items-center gap-2">
                          <span className="text-emerald-500">Q.</span>
                          {item.q}
                        </span>
                        <span className="text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                      </summary>
                      <div className="px-4 pb-4 text-sm text-slate-600 leading-relaxed">
                        <span className="text-emerald-600 font-bold">A.</span> {item.a}
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </div>
            
            {/* 문의 안내 푸터 */}
            <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-3xl flex-shrink-0">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-700">📧 문의 및 건의사항</p>
                  <p className="text-xs text-slate-500">기능 제안, 오류 신고, 기타 문의</p>
                </div>
                <a 
                  href="mailto:story.darugi@gmail.com?subject=[HospitalAI 문의]" 
                  className="px-5 py-2.5 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 transition-all text-sm flex items-center gap-2"
                >
                  ✉️ 메일 보내기
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
      
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
