import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

// Admin 비밀번호 - 실제로는 환경변수나 Supabase로 관리해야 함
const ADMIN_PASSWORD = 'rosmrtl718';

// Supabase 테이블 타입
type ProfileRow = Database['public']['Tables']['profiles']['Row'] & { plan?: string };
type PaymentRow = Database['public']['Tables']['payments']['Row'];

interface UserData {
  id: string;
  email: string;
  name: string;
  plan: string;
  remaining_credits: number;
  created_at: string;
}

interface PaymentData {
  id: string;
  user_id: string;
  user_email?: string;
  amount: number;
  plan: string;
  status: string;
  created_at: string;
}

interface AdminPageProps {
  onAdminVerified?: () => void;
}

const AdminPage: React.FC<AdminPageProps> = ({ onAdminVerified }) => {
  // 초기값을 localStorage에서 직접 읽어서 설정 (useEffect 내 setState 방지)
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ADMIN_AUTHENTICATED') === 'true';
    }
    return false;
  });
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState<'api' | 'users' | 'payments' | 'blogs'>('api');
  
  // 초기값을 localStorage에서 직접 읽어서 설정 (useEffect 내 setState 방지)
  const [configValues, setConfigValues] = useState(() => {
    if (typeof window !== 'undefined') {
      return {
        geminiKey: localStorage.getItem('GLOBAL_GEMINI_API_KEY') || '',
        perplexityKey: localStorage.getItem('GLOBAL_PERPLEXITY_API_KEY') || ''
      };
    }
    return { geminiKey: '', perplexityKey: '' };
  });
  const [saved, setSaved] = useState(false);
  
  // 사용자 및 결제 데이터
  const [users, setUsers] = useState<UserData[]>([]);
  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [blogs, setBlogs] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    paidUsers: 0,
    totalRevenue: 0,
    todaySignups: 0,
    totalBlogs: 0
  });
  
  // SQL 힌트 모달
  const [sqlModal, setSqlModal] = useState<{ show: boolean; sql: string; title: string }>({
    show: false,
    sql: '',
    title: ''
  });
  
  // 블로그 미리보기 모달
  const [previewBlog, setPreviewBlog] = useState<any | null>(null);

  const [dataError, setDataError] = useState<string>('');
  
  // 데이터 로드 함수 (useEffect보다 먼저 선언)
  const loadUsersAndPayments = useCallback(async () => {
    setLoadingData(true);
    setDataError('');
    
    try {
      // 방법 1: profiles 테이블에서 가져오기 시도
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false }) as { data: ProfileRow[] | null; error: any };
      
      if (profilesError) {
        console.error('프로필 로드 에러:', profilesError);
        
        // profiles 테이블이 없으면 안내 메시지
        if (profilesError.code === '42P01' || profilesError.message?.includes('does not exist')) {
          setDataError('⚠️ profiles 테이블이 없습니다. Supabase에서 테이블을 생성해주세요.');
        } else {
          setDataError(`프로필 로드 실패: ${profilesError.message}`);
        }
        
        // 현재 로그인한 사용자 정보라도 가져오기
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUsers([{
            id: user.id,
            email: user.email || '',
            name: user.user_metadata?.name || user.email?.split('@')[0] || '사용자',
            plan: 'free',
            remaining_credits: 999,
            created_at: user.created_at || new Date().toISOString()
          }]);
          setStats(prev => ({ ...prev, totalUsers: 1, todaySignups: 1 }));
        }
      } else {
        // ProfileRow를 UserData로 변환
        const mappedUsers: UserData[] = (profilesData || []).map(p => ({
          id: p.id,
          email: p.email || '',
          name: p.full_name || p.email?.split('@')[0] || '사용자',
          plan: (p as any).plan || 'free',
          remaining_credits: 999, // 기본값
          created_at: p.created_at
        }));
        setUsers(mappedUsers);
        
        // 통계 계산
        const today = new Date().toISOString().split('T')[0];
        const todayUsers = mappedUsers.filter(u => 
          u.created_at?.startsWith(today)
        ).length;
        const paidCount = mappedUsers.filter(u => 
          u.plan && u.plan !== 'free'
        ).length;
        
        setStats(prev => ({
          ...prev,
          totalUsers: mappedUsers.length,
          paidUsers: paidCount,
          todaySignups: todayUsers
        }));
      }

      // 결제 내역 가져오기
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false }) as { data: PaymentRow[] | null; error: any };
      
      if (paymentsError) {
        console.error('결제 로드 에러:', paymentsError);
        // payments 테이블 에러는 무시 (아직 결제가 없을 수 있음)
      } else {
        // PaymentRow를 PaymentData로 변환
        const mappedPayments: PaymentData[] = (paymentsData || []).map(p => ({
          id: p.id,
          user_id: p.user_id,
          amount: p.amount,
          plan: p.plan_type,
          status: p.status,
          created_at: p.created_at
        }));
        setPayments(mappedPayments);
        
        // 총 매출 계산
        const totalRev = mappedPayments
          .filter(p => p.status === 'completed')
          .reduce((sum, p) => sum + (p.amount || 0), 0);
        
        setStats(prev => ({
          ...prev,
          totalRevenue: totalRev
        }));
      }
    } catch (err) {
      console.error('데이터 로드 오류:', err);
      setDataError(`데이터 로드 오류: ${String(err)}`);
    }
    setLoadingData(false);
  }, []);

  // 블로그 이력 로드 함수 (재시도 로직 포함)
  const loadBlogHistory = useCallback(async (retryCount = 0): Promise<void> => {
    const MAX_RETRIES = 3;
    
    setLoadingData(true);
    setDataError('');
    
    try {
      console.log('[Admin] 블로그 이력 로드 시작...', retryCount > 0 ? `(재시도 ${retryCount}/${MAX_RETRIES})` : '');
      console.log('[Admin] Supabase 클라이언트:', supabase ? '✅ 존재' : '❌ 없음');
      
      const { data: blogsData, error: blogsError } = await supabase
        .from('blog_history')
        .select('*')
        .order('created_at', { ascending: false });
      
      console.log('[Admin] 블로그 쿼리 결과:', { 
        데이터개수: blogsData?.length, 
        에러: blogsError,
        에러코드: blogsError?.code,
        에러메시지: blogsError?.message
      });
      
      if (blogsError) {
        console.error('블로그 이력 로드 에러:', blogsError);
        
        // 네트워크 오류 시 재시도
        if ((blogsError.message?.includes('fetch') || blogsError.message?.includes('network')) && retryCount < MAX_RETRIES) {
          console.log(`⏳ 네트워크 오류 감지, ${retryCount + 1}초 후 재시도...`);
          setDataError(`네트워크 연결 재시도 중... (${retryCount + 1}/${MAX_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 1000));
          void loadBlogHistory(retryCount + 1);
          return;
        }
        
        if (blogsError.code === '42P01' || blogsError.message?.includes('does not exist')) {
          setDataError('⚠️ blog_history 테이블이 없습니다. Supabase에서 테이블을 생성해주세요.');
        } else {
          setDataError(`블로그 이력 로드 실패: ${blogsError.message || blogsError.code || '알 수 없는 오류'}${retryCount >= MAX_RETRIES ? ' (재시도 실패)' : ''}`);
        }
      } else {
        console.log(`[Admin] ✅ 블로그 ${blogsData?.length || 0}개 로드 완료`);
        setBlogs(blogsData || []);
        setStats(prev => ({
          ...prev,
          totalBlogs: blogsData?.length || 0
        }));
      }
    } catch (err) {
      console.error('블로그 이력 로드 오류:', err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('에러 상세:', {
        message: errorMsg,
        stack: err instanceof Error ? err.stack : undefined
      });
      
      // 네트워크 오류 시 재시도
      if (errorMsg.includes('fetch') && retryCount < MAX_RETRIES) {
        console.log(`⏳ 네트워크 오류 감지, ${retryCount + 1}초 후 재시도...`);
        setDataError(`네트워크 연결 재시도 중... (${retryCount + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 1000));
        void loadBlogHistory(retryCount + 1);
        return;
      }
      
      setDataError(`블로그 이력 로드 실패: ${errorMsg}${retryCount >= MAX_RETRIES ? ' (재시도 실패)' : ''}`);
    }
    setLoadingData(false);
  }, []);

  // 블로그 삭제 함수
  const deleteBlog = async (blogId: string) => {
    if (!confirm('정말로 이 블로그 글을 삭제하시겠습니까?')) return;
    
    try {
      const { error } = await supabase
        .from('blog_history')
        .delete()
        .eq('id', blogId);
      
      if (error) {
        alert(`삭제 실패: ${error.message}`);
      } else {
        alert('✅ 삭제 완료!');
        loadBlogHistory(); // 목록 새로고침
      }
    } catch (err) {
      alert(`삭제 오류: ${String(err)}`);
    }
  };

  // 관리자 인증 확인 - 이미 인증된 경우 콜백만 호출
  useEffect(() => {
    if (isAuthenticated) {
      onAdminVerified?.();
    }
  }, [isAuthenticated, onAdminVerified]);

  // 데이터 로드 (인증 상태 변경 시) - 비동기 콜백 내 setState는 안전함
  useEffect(() => {
    if (!isAuthenticated) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadUsersAndPayments();
  }, [isAuthenticated, loadUsersAndPayments]);

  // 블로그 탭 활성화 시 블로그 이력 로드
  useEffect(() => {
    if (!isAuthenticated) return;
    if (activeTab === 'blogs') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadBlogHistory();
    }
  }, [isAuthenticated, activeTab, loadBlogHistory]);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      localStorage.setItem('ADMIN_AUTHENTICATED', 'true');
      setLoginError('');
      // 관리자 인증 완료 콜백
      onAdminVerified?.();
    } else {
      setLoginError('비밀번호가 올바르지 않습니다.');
    }
  };

  const handleAdminLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('ADMIN_AUTHENTICATED');
  };

  const handleSaveConfig = () => {
    // GLOBAL_ 접두사로 저장하여 모든 사용자가 이용하도록 함
    localStorage.setItem('GLOBAL_GEMINI_API_KEY', configValues.geminiKey);
    localStorage.setItem('GLOBAL_PERPLEXITY_API_KEY', configValues.perplexityKey);
    
    // 기존 개인용 키도 업데이트 (호환성)
    localStorage.setItem('GEMINI_API_KEY', configValues.geminiKey);
    localStorage.setItem('PERPLEXITY_API_KEY', configValues.perplexityKey);
    
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClearConfig = () => {
    if (confirm('API 키를 삭제하시겠습니까?')) {
      localStorage.removeItem('GLOBAL_GEMINI_API_KEY');
      localStorage.removeItem('GLOBAL_PERPLEXITY_API_KEY');
      localStorage.removeItem('GEMINI_API_KEY');
      localStorage.removeItem('PERPLEXITY_API_KEY');
      setConfigValues({
        geminiKey: '',
        perplexityKey: ''
      });
    }
  };

  const maskApiKey = (key: string) => {
    if (!key) return '';
    if (key.length <= 8) return '••••••••';
    return key.substring(0, 4) + '••••••••' + key.substring(key.length - 4);
  };
  
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW'
    }).format(amount);
  };
  
  const getPlanBadge = (plan: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      'free': { bg: 'bg-slate-500/20', text: 'text-slate-400', label: '무료' },
      'basic': { bg: 'bg-blue-500/20', text: 'text-blue-400', label: '베이직' },
      'standard': { bg: 'bg-purple-500/20', text: 'text-purple-400', label: '스탠다드' },
      'premium': { bg: 'bg-amber-500/20', text: 'text-amber-400', label: '프리미엄' },
    };
    const badge = badges[plan] || badges['free'];
    return (
      <span className={`px-2 py-1 ${badge.bg} ${badge.text} text-xs font-bold rounded-full`}>
        {badge.label}
      </span>
    );
  };

  // 로그인 화면
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-red-500 to-orange-600 rounded-3xl shadow-2xl shadow-red-500/30 mb-6">
              <span className="text-4xl">🔐</span>
            </div>
            <h1 className="text-3xl font-black text-white mb-2">Admin Access</h1>
            <p className="text-slate-400 font-medium">관리자 비밀번호를 입력하세요</p>
          </div>

          <form onSubmit={handleAdminLogin} className="bg-white/10 backdrop-blur-xl rounded-[32px] p-8 shadow-2xl border border-white/10">
            {loginError && (
              <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 text-sm font-medium">
                {loginError}
              </div>
            )}
            
            <div className="mb-6">
              <label className="text-xs font-black text-slate-300 uppercase tracking-widest mb-3 block">
                비밀번호
              </label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="관리자 비밀번호"
                className="w-full p-4 bg-slate-900/50 border border-slate-700 rounded-xl font-mono text-sm text-white placeholder-slate-500 focus:border-emerald-500 outline-none transition-colors"
                autoFocus
              />
            </div>

            <button 
              type="submit"
              className="w-full py-4 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-emerald-500/30 transition-all"
            >
              로그인
            </button>

            <div className="mt-6 text-center">
              <a 
                href="#" 
                className="text-sm text-slate-400 hover:text-white transition-colors"
              >
                ← 홈으로 돌아가기
              </a>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // 관리자 대시보드
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-2xl">⚙️</span>
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">Admin Dashboard</h1>
              <p className="text-slate-400 text-sm">HospitalAI 관리자 페이지</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a 
              href="#app" 
              className="px-4 py-2 bg-emerald-500/20 text-emerald-400 font-bold rounded-xl hover:bg-emerald-500/30 transition-colors text-sm"
            >
              앱으로 이동 →
            </a>
            <button
              onClick={handleAdminLogout}
              className="px-4 py-2 bg-red-500/20 text-red-400 font-bold rounded-xl hover:bg-red-500/30 transition-colors text-sm"
            >
              로그아웃
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-5 border border-white/10">
            <div className="text-3xl mb-2">👥</div>
            <div className="text-2xl font-black text-white">{stats.totalUsers}</div>
            <div className="text-sm text-slate-400">전체 회원</div>
          </div>
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-5 border border-white/10">
            <div className="text-3xl mb-2">💎</div>
            <div className="text-2xl font-black text-white">{stats.paidUsers}</div>
            <div className="text-sm text-slate-400">유료 회원</div>
          </div>
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-5 border border-white/10">
            <div className="text-3xl mb-2">💰</div>
            <div className="text-2xl font-black text-white">{formatMoney(stats.totalRevenue)}</div>
            <div className="text-sm text-slate-400">총 매출</div>
          </div>
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-5 border border-white/10">
            <div className="text-3xl mb-2">🆕</div>
            <div className="text-2xl font-black text-white">{stats.todaySignups}</div>
            <div className="text-sm text-slate-400">오늘 가입</div>
          </div>
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-5 border border-white/10">
            <div className="text-3xl mb-2">📝</div>
            <div className="text-2xl font-black text-white">{stats.totalBlogs}</div>
            <div className="text-sm text-slate-400">저장된 글</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('api')}
            className={`px-5 py-3 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'api' 
                ? 'bg-emerald-500 text-white' 
                : 'bg-white/10 text-slate-400 hover:text-white'
            }`}
          >
            🔑 API 설정
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-5 py-3 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'users' 
                ? 'bg-emerald-500 text-white' 
                : 'bg-white/10 text-slate-400 hover:text-white'
            }`}
          >
            👥 회원 관리
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`px-5 py-3 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'payments' 
                ? 'bg-emerald-500 text-white' 
                : 'bg-white/10 text-slate-400 hover:text-white'
            }`}
          >
            💳 결제 내역
          </button>
          <button
            onClick={() => setActiveTab('blogs')}
            className={`px-5 py-3 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'blogs' 
                ? 'bg-emerald-500 text-white' 
                : 'bg-white/10 text-slate-400 hover:text-white'
            }`}
          >
            📝 블로그 관리
          </button>
        </div>

        {/* Tab Content */}
        <div className="bg-white/10 backdrop-blur-xl rounded-[32px] p-6 lg:p-8 shadow-2xl border border-white/10">
          
          {/* API Settings Tab */}
          {activeTab === 'api' && (
            <div>
              {/* Status Badges */}
              <div className="flex flex-wrap items-center gap-4 mb-6">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${configValues.geminiKey ? 'bg-blue-500 animate-pulse' : 'bg-red-500'}`}></div>
                  <span className="text-sm font-bold text-slate-300">
                    Gemini: {configValues.geminiKey ? '✅ 활성' : '❌ 미설정'}
                  </span>
                </div>
              </div>

              {/* Info Banner */}
              <div className="mb-6 p-4 bg-blue-500/20 border border-blue-500/30 rounded-xl">
                <p className="text-blue-300 text-sm font-medium">
                  ℹ️ 여기서 설정한 API 키는 <strong>모든 사용자</strong>가 공유합니다.<br/>
                  사용자들은 API 키 없이도 서비스를 이용할 수 있습니다.
                </p>
              </div>

              <div className="space-y-6">
                {/* Gemini API Key */}
                <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 p-6 rounded-2xl border border-blue-500/20">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-black text-blue-300 uppercase tracking-widest">
                      Google Gemini API
                    </label>
                    <span className="text-[10px] font-bold text-red-400 bg-red-500/20 px-2 py-1 rounded-full">필수</span>
                  </div>
                  <input 
                    type="password" 
                    value={configValues.geminiKey}
                    onChange={(e) => setConfigValues({...configValues, geminiKey: e.target.value})}
                    placeholder="AI Studio에서 발급받은 API Key"
                    className="w-full p-4 bg-slate-900/50 border border-slate-700 rounded-xl font-mono text-sm text-white placeholder-slate-500 focus:border-blue-500 outline-none transition-colors"
                  />
                  {configValues.geminiKey && (
                    <p className="text-[11px] text-blue-400 mt-2 font-mono">
                      현재 키: {maskApiKey(configValues.geminiKey)}
                    </p>
                  )}
                  <a 
                    href="https://aistudio.google.com/app/apikey" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-blue-400 mt-2 font-bold hover:text-blue-300"
                  >
                    🔗 Google AI Studio에서 키 발급받기
                  </a>
                </div>

              </div>

              {/* AI 역할 분리 설정 */}

              {/* Actions */}
              <div className="flex gap-3 mt-8">
                <button 
                  onClick={handleClearConfig} 
                  className="flex-1 py-4 bg-red-500/20 text-red-400 font-bold rounded-xl hover:bg-red-500/30 transition-colors border border-red-500/30"
                >
                  🗑️ 전체 삭제
                </button>
                <button 
                  onClick={handleSaveConfig} 
                  className={`flex-1 py-4 font-bold rounded-xl transition-all shadow-lg ${
                    saved 
                      ? 'bg-green-500 text-white' 
                      : 'bg-gradient-to-r from-emerald-500 to-green-600 text-white hover:shadow-emerald-500/30 hover:shadow-xl'
                  }`}
                >
                  {saved ? '✅ 저장됨!' : '💾 저장하기'}
                </button>
              </div>
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black text-white">회원 목록</h2>
                <div className="flex gap-2">
                  <button 
                    onClick={loadUsersAndPayments}
                    disabled={loadingData}
                    className="px-4 py-2 bg-slate-700 text-white font-bold rounded-xl hover:bg-slate-600 transition-colors text-sm disabled:opacity-50"
                  >
                    {loadingData ? '로딩...' : '🔄 새로고침'}
                  </button>
                </div>
              </div>
              
              {/* 에러 메시지 */}
              {dataError && (
                <div className="mb-6 p-4 bg-amber-500/20 border border-amber-500/30 rounded-xl">
                  <p className="text-amber-300 text-sm font-medium mb-3">{dataError}</p>
                  <p className="text-slate-400 text-xs">
                    📌 Supabase Dashboard → SQL Editor에서 profiles 테이블을 생성해주세요.
                  </p>
                  <a 
                    href="https://supabase.com/dashboard/project/giiatpxkhponcbduyzci/sql" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-block mt-2 text-xs text-amber-400 hover:text-amber-300 underline"
                  >
                    🔗 Supabase SQL Editor 열기
                  </a>
                </div>
              )}
              
              {users.length === 0 && !dataError ? (
                <div className="text-center py-12">
                  <div className="text-5xl mb-4">👥</div>
                  <p className="text-slate-400 font-medium">
                    {loadingData ? '회원 목록을 불러오는 중...' : '아직 가입한 회원이 없습니다.'}
                  </p>
                  <p className="text-slate-500 text-sm mt-2">
                    Supabase 프로필 테이블을 확인하세요.
                  </p>
                </div>
              ) : users.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-3 px-4 text-xs font-bold text-slate-400 uppercase">이메일</th>
                        <th className="text-left py-3 px-4 text-xs font-bold text-slate-400 uppercase">이름</th>
                        <th className="text-left py-3 px-4 text-xs font-bold text-slate-400 uppercase">요금제</th>
                        <th className="text-left py-3 px-4 text-xs font-bold text-slate-400 uppercase">크레딧</th>
                        <th className="text-left py-3 px-4 text-xs font-bold text-slate-400 uppercase">가입일</th>
                        <th className="text-left py-3 px-4 text-xs font-bold text-slate-400 uppercase">관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user.id} className="border-b border-slate-800 hover:bg-white/5">
                          <td className="py-3 px-4 text-sm text-white font-mono">{user.email}</td>
                          <td className="py-3 px-4 text-sm text-slate-300">{user.name || '-'}</td>
                          <td className="py-3 px-4">{getPlanBadge(user.plan)}</td>
                          <td className="py-3 px-4 text-sm text-slate-300">{user.remaining_credits}</td>
                          <td className="py-3 px-4 text-sm text-slate-400">{formatDate(user.created_at)}</td>
                          <td className="py-3 px-4">
                            <button
                              onClick={async () => {
                                if (!confirm(`정말 ${user.email} 회원을 삭제하시겠습니까?\n\n⚠️ 주의: 이 작업은 되돌릴 수 없습니다.\n\n삭제 대상:\n- 프로필 정보\n- 구독 정보\n- 사용 기록`)) return;
                                
                                console.log('[Admin] 회원 삭제 시작:', user.id, user.email);
                                
                                try {
                                  // 1. usage_logs 테이블에서 삭제 (외래키 제약 때문에 먼저)
                                  const { error: logsError, count: logsCount } = await supabase
                                    .from('usage_logs')
                                    .delete({ count: 'exact' })
                                    .eq('user_id', user.id);
                                  console.log('[Admin] usage_logs:', logsError?.message || `✓ ${logsCount ?? 0}개 삭제됨`);
                                  
                                  // 2. payments 테이블에서 삭제
                                  const { error: payError, count: payCount } = await supabase
                                    .from('payments')
                                    .delete({ count: 'exact' })
                                    .eq('user_id', user.id);
                                  console.log('[Admin] payments:', payError?.message || `✓ ${payCount ?? 0}개 삭제됨`);
                                  
                                  // 3. subscriptions 테이블에서 삭제
                                  const { error: subError, count: subCount } = await supabase
                                    .from('subscriptions')
                                    .delete({ count: 'exact' })
                                    .eq('user_id', user.id);
                                  console.log('[Admin] subscriptions:', subError?.message || `✓ ${subCount ?? 0}개 삭제됨`);
                                  
                                  // 4. profiles 테이블에서 삭제 (마지막에!)
                                  const { error: profileError, count: profileCount } = await supabase
                                    .from('profiles')
                                    .delete({ count: 'exact' })
                                    .eq('id', user.id);
                                  console.log('[Admin] profiles:', profileError?.message || `✓ ${profileCount ?? 0}개 삭제됨`);
                                  
                                  // RLS가 조용히 실패하면 count가 0
                                  if (profileError || (profileCount === 0)) {
                                    const sql = `-- 🔧 Supabase SQL Editor에서 실행하세요
-- https://supabase.com/dashboard/project/giiatpxkhponcbduyzci/sql

-- 방법 1: 관리자 삭제 정책 추가 (권장)
CREATE POLICY "Allow authenticated delete" ON profiles
FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated delete" ON subscriptions
FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated delete" ON usage_logs
FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated delete" ON payments
FOR DELETE USING (auth.role() = 'authenticated');

-- 방법 2: 이 회원만 직접 삭제
DELETE FROM usage_logs WHERE user_id = '${user.id}';
DELETE FROM payments WHERE user_id = '${user.id}';
DELETE FROM subscriptions WHERE user_id = '${user.id}';
DELETE FROM profiles WHERE id = '${user.id}';`;
                                    
                                    setSqlModal({
                                      show: true,
                                      sql,
                                      title: `🔒 RLS 정책이 삭제를 차단 (${user.email})`
                                    });
                                    return;
                                  }
                                  
                                  // 성공! UI 업데이트
                                  setUsers(prev => prev.filter(u => u.id !== user.id));
                                  setStats(prev => ({ ...prev, totalUsers: prev.totalUsers - 1 }));
                                  
                                  alert('✅ 회원이 완전히 삭제되었습니다.');
                                } catch (err: any) {
                                  console.error('[Admin] 삭제 예외:', err);
                                  alert(`삭제 실패: ${err.message || String(err)}`);
                                }
                              }}
                              className="px-2 py-1 bg-red-500/20 text-red-400 text-xs font-bold rounded hover:bg-red-500/30 transition-colors"
                            >
                              🗑️ 삭제
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          )}

          {/* Payments Tab */}
          {activeTab === 'payments' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black text-white">결제 내역</h2>
                <button 
                  onClick={loadUsersAndPayments}
                  disabled={loadingData}
                  className="px-4 py-2 bg-slate-700 text-white font-bold rounded-xl hover:bg-slate-600 transition-colors text-sm disabled:opacity-50"
                >
                  {loadingData ? '로딩...' : '🔄 새로고침'}
                </button>
              </div>
              
              {payments.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-5xl mb-4">💳</div>
                  <p className="text-slate-400 font-medium">
                    {loadingData ? '결제 내역을 불러오는 중...' : '아직 결제 내역이 없습니다.'}
                  </p>
                  <p className="text-slate-500 text-sm mt-2">
                    결제가 완료되면 여기에 표시됩니다.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-3 px-4 text-xs font-bold text-slate-400 uppercase">결제일</th>
                        <th className="text-left py-3 px-4 text-xs font-bold text-slate-400 uppercase">사용자</th>
                        <th className="text-left py-3 px-4 text-xs font-bold text-slate-400 uppercase">요금제</th>
                        <th className="text-left py-3 px-4 text-xs font-bold text-slate-400 uppercase">금액</th>
                        <th className="text-left py-3 px-4 text-xs font-bold text-slate-400 uppercase">상태</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((payment) => (
                        <tr key={payment.id} className="border-b border-slate-800 hover:bg-white/5">
                          <td className="py-3 px-4 text-sm text-slate-400">{formatDate(payment.created_at)}</td>
                          <td className="py-3 px-4 text-sm text-white font-mono">{payment.user_email || payment.user_id.slice(0, 8)}</td>
                          <td className="py-3 px-4">{getPlanBadge(payment.plan)}</td>
                          <td className="py-3 px-4 text-sm text-emerald-400 font-bold">{formatMoney(payment.amount)}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                              payment.status === 'completed' 
                                ? 'bg-green-500/20 text-green-400' 
                                : payment.status === 'pending'
                                ? 'bg-yellow-500/20 text-yellow-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}>
                              {payment.status === 'completed' ? '완료' : payment.status === 'pending' ? '대기' : '실패'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Blog History Tab */}
          {activeTab === 'blogs' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black text-white">블로그 관리</h2>
                <button 
                  onClick={loadBlogHistory}
                  disabled={loadingData}
                  className="px-4 py-2 bg-slate-700 text-white font-bold rounded-xl hover:bg-slate-600 transition-colors text-sm disabled:opacity-50"
                >
                  {loadingData ? '로딩...' : '🔄 새로고침'}
                </button>
              </div>
              
              {dataError && (
                <div className="mb-4 p-4 bg-red-500/20 border border-red-500/30 rounded-xl">
                  <p className="text-red-300 text-sm font-medium">{dataError}</p>
                </div>
              )}
              
              {blogs.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-5xl mb-4">📝</div>
                  <p className="text-slate-400 font-medium">
                    {loadingData ? '블로그 이력을 불러오는 중...' : '아직 저장된 블로그 글이 없습니다.'}
                  </p>
                  <p className="text-slate-500 text-sm mt-2">
                    블로그 글을 생성하면 여기에 자동으로 저장됩니다.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-sm text-slate-400 mb-4">
                    총 {blogs.length}개의 블로그 글이 저장되어 있습니다.
                  </div>
                  {blogs.map((blog) => (
                    <div 
                      key={blog.id} 
                      className="bg-white/5 rounded-xl p-5 border border-slate-700 hover:bg-white/10 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-bold text-white mb-2 truncate">
                            {blog.title}
                          </h3>
                          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400 mb-3">
                            <span>📅 {formatDate(blog.created_at)}</span>
                            {blog.category && (
                              <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-bold">
                                {blog.category}
                              </span>
                            )}
                            {blog.keywords && blog.keywords.length > 0 && (
                              <span className="text-xs text-slate-500">
                                🏷️ {blog.keywords.slice(0, 3).join(', ')}
                                {blog.keywords.length > 3 && ` +${blog.keywords.length - 3}`}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-300 line-clamp-2">
                            {blog.content?.substring(0, 150)}...
                          </p>
                          {blog.naver_url && (
                            <a 
                              href={blog.naver_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block mt-2 text-xs text-green-400 hover:text-green-300 underline"
                            >
                              🔗 네이버 블로그에서 보기
                            </a>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setPreviewBlog(blog)}
                            className="px-3 py-2 bg-blue-500/20 text-blue-400 font-bold rounded-lg hover:bg-blue-500/30 transition-colors text-sm whitespace-nowrap"
                          >
                            👁️ 보기
                          </button>
                          <button
                            onClick={() => deleteBlog(blog.id)}
                            className="px-3 py-2 bg-red-500/20 text-red-400 font-bold rounded-lg hover:bg-red-500/30 transition-colors text-sm whitespace-nowrap"
                          >
                            🗑️ 삭제
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-slate-500 text-sm font-medium">
            ⚠️ API 키는 브라우저의 LocalStorage에 저장됩니다.
          </p>
          <p className="text-slate-600 text-xs mt-1">
            Cloudflare 배포 시 환경변수로 설정하는 것을 권장합니다.
          </p>
        </div>
      </div>
      
      {/* SQL 힌트 모달 */}
      {sqlModal.show && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden border border-slate-600">
            <div className="p-4 border-b border-slate-600 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">{sqlModal.title}</h3>
              <button
                onClick={() => setSqlModal({ show: false, sql: '', title: '' })}
                className="text-slate-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>
            <div className="p-4">
              <p className="text-yellow-400 text-sm mb-3">
                💡 아래 SQL을 복사해서 Supabase SQL Editor에서 실행하세요
              </p>
              <div className="relative">
                <pre className="bg-slate-900 p-4 rounded-lg text-green-400 text-sm overflow-auto max-h-[50vh] whitespace-pre-wrap">
                  {sqlModal.sql}
                </pre>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(sqlModal.sql);
                    alert('✅ SQL이 클립보드에 복사되었습니다!');
                  }}
                  className="absolute top-2 right-2 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded transition-colors"
                >
                  📋 복사
                </button>
              </div>
              <div className="mt-4 flex gap-2">
                <a
                  href="https://supabase.com/dashboard/project/giiatpxkhponcbduyzci/sql"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-center font-bold rounded-lg transition-colors"
                >
                  🔗 Supabase SQL Editor 열기
                </a>
                <button
                  onClick={() => setSqlModal({ show: false, sql: '', title: '' })}
                  className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white font-bold rounded-lg transition-colors"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* 블로그 미리보기 모달 */}
      {previewBlog && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl my-8">
            {/* 헤더 */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-700 p-6 border-b border-slate-600 flex justify-between items-start gap-4">
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-bold text-white mb-2">{previewBlog.title}</h2>
                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
                  <span>📅 {formatDate(previewBlog.created_at)}</span>
                  {previewBlog.category && (
                    <span className="px-2 py-1 bg-blue-500/30 text-blue-300 rounded-full text-xs font-bold">
                      {previewBlog.category}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setPreviewBlog(null)}
                className="text-white hover:text-slate-300 text-3xl font-bold leading-none flex-shrink-0"
              >
                ×
              </button>
            </div>
            
            {/* 콘텐츠 */}
            <div className="p-8 overflow-y-auto max-h-[calc(90vh-200px)] bg-slate-50">
              <div 
                className="prose prose-slate max-w-none"
                dangerouslySetInnerHTML={{ __html: previewBlog.content || '<p class="text-slate-400">내용이 없습니다.</p>' }}
              />
            </div>
            
            {/* 푸터 */}
            <div className="bg-slate-100 p-4 border-t border-slate-300 flex justify-between items-center gap-4">
              <div className="flex gap-2 flex-wrap">
                {previewBlog.keywords && previewBlog.keywords.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {previewBlog.keywords.map((keyword: string, idx: number) => (
                      <span key={idx} className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-xs font-medium">
                        #{keyword}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => setPreviewBlog(null)}
                className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition-colors whitespace-nowrap"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;
