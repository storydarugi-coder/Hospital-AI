import React, { useState, useEffect } from 'react';
import { GenerationRequest, GenerationState } from './types';
import { generateFullPost } from './services/geminiService';
import InputForm from './components/InputForm';
import ResultPreview from './components/ResultPreview';
import AdminPage from './components/AdminPage';
import LandingPage from './components/LandingPage';
import { AuthPage } from './components/AuthPage';
import { PricingPage } from './components/PricingPage';

type PageType = 'landing' | 'app' | 'admin' | 'auth' | 'pricing';

// 사용자 정보 타입
interface UserInfo {
  id: string;
  email: string;
  name: string;
  plan: 'free' | 'basic' | 'standard' | 'premium';
  remainingCredits: number;
  ipHash: string;
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
  
  // 사용자 인증 상태 (임시 - Supabase 연동 시 교체)
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);

  const [mobileTab, setMobileTab] = useState<'input' | 'result'>('input');

  // URL hash 기반 라우팅
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash === '#admin') {
        setCurrentPage('admin');
      } else if (hash === '#app') {
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
  }, []);

  // 페이지 네비게이션 헬퍼
  const handleNavigate = (page: PageType) => {
    if (page === 'landing') {
      window.location.hash = '';
    } else {
      window.location.hash = page;
    }
    setCurrentPage(page);
  };

  // 임시 로그인 상태 확인 (Supabase 연동 시 교체)
  useEffect(() => {
    const savedUser = localStorage.getItem('hospitalai_user');
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setUser(userData);
        setIsLoggedIn(true);
      } catch (e) {
        console.error('Failed to parse user data');
      }
    }
  }, []);

  useEffect(() => {
    const checkApiKey = () => {
      const localGemini = localStorage.getItem('GEMINI_API_KEY');
      setApiKeyReady(!!localGemini);
    };
    
    checkApiKey();
    
    const handleStorageChange = () => checkApiKey();
    window.addEventListener('storage', handleStorageChange);
    
    const handleFocus = () => checkApiKey();
    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [currentPage]);

  const handleGenerate = async (request: GenerationRequest) => {
    // 크레딧 체크 (로그인 시에만)
    if (isLoggedIn && user && user.remainingCredits <= 0 && user.plan !== 'premium') {
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
      
      // 크레딧 차감 (로그인 시에만, 프리미엄 제외)
      if (isLoggedIn && user && user.plan !== 'premium') {
        const updatedUser = { ...user, remainingCredits: user.remainingCredits - 1 };
        setUser(updatedUser);
        localStorage.setItem('hospitalai_user', JSON.stringify(updatedUser));
        // TODO: Supabase에 사용량 기록
      }
    } catch (err: any) {
       setState(prev => ({ ...prev, isLoading: false, error: err.message }));
       setMobileTab('input');
    }
  };

  // Auth 페이지 렌더링
  if (currentPage === 'auth') {
    return <AuthPage onNavigate={handleNavigate} />;
  }

  // Pricing 페이지 렌더링
  if (currentPage === 'pricing') {
    return (
      <PricingPage 
        onNavigate={handleNavigate}
        isLoggedIn={isLoggedIn}
        currentPlan={user?.plan || 'free'}
        remainingCredits={user?.remainingCredits || 0}
      />
    );
  }

  // Landing 페이지 렌더링
  if (currentPage === 'landing') {
    return <LandingPage />;
  }

  // Admin 페이지 렌더링
  if (currentPage === 'admin') {
    return <AdminPage />;
  }

  // API Key 미설정 시 안내 화면
  if (!apiKeyReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center bg-white p-12 rounded-[40px] shadow-2xl border border-slate-100 relative overflow-hidden">
          <div className="text-6xl mb-6">🏥</div>
          <h1 className="text-2xl font-black mb-3 text-slate-900">HospitalAI</h1>
          <h2 className="text-lg font-bold text-emerald-600 mb-6">API 키 설정이 필요합니다</h2>
          <p className="text-slate-500 mb-8 font-medium">서비스 이용을 위해 Gemini API Key를 먼저 설정해주세요.</p>
          <a 
            href="#admin" 
            className="block w-full bg-gradient-to-r from-emerald-500 to-green-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-emerald-100 hover:shadow-2xl transition-all active:scale-95 mb-4"
          >
             ⚙️ API 키 설정하기
          </a>
          <a 
            href="#" 
            className="block w-full bg-slate-100 text-slate-600 font-bold py-4 rounded-2xl hover:bg-slate-200 transition-all active:scale-95"
          >
             ← 홈으로 돌아가기
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
             {isLoggedIn && user && (
               <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-xl">
                 <span className="text-sm text-slate-500">크레딧:</span>
                 <span className="text-sm font-bold text-emerald-600">
                   {user.plan === 'premium' ? '∞' : user.remainingCredits}
                 </span>
               </div>
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
                💎 요금제
             </a>
             <a 
               href="#admin" 
               className="p-2.5 hover:bg-slate-100 rounded-xl transition-all flex items-center gap-2"
             >
                <span className="text-xl">⚙️</span>
                <span className="text-sm font-bold text-slate-500 hidden sm:inline">설정</span>
             </a>
             
             {/* 로그인/사용자 버튼 */}
             {isLoggedIn && user ? (
               <button 
                 onClick={() => {
                   localStorage.removeItem('hospitalai_user');
                   setUser(null);
                   setIsLoggedIn(false);
                 }}
                 className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all hidden sm:block"
               >
                 {user.name || user.email.split('@')[0]} 님
               </button>
             ) : (
               <a 
                 href="#auth" 
                 className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-bold hover:bg-emerald-600 transition-all hidden sm:block"
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
              <p className="text-slate-400 max-w-xs font-medium">네이버 스마트블록 노출을 위한 최적의 의료 콘텐츠를 생성하고 있습니다.</p>
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
    </div>
  );
};

export default App;
