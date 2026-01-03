import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// Admin 비밀번호 - 실제로는 환경변수나 Supabase로 관리해야 함
const ADMIN_PASSWORD = 'rosmrtl718';

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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState<'api' | 'users' | 'payments'>('api');
  
  const [configValues, setConfigValues] = useState({
    geminiKey: '',
    naverClientId: '',
    naverClientSecret: ''
  });
  const [saved, setSaved] = useState(false);
  
  // 사용자 및 결제 데이터
  const [users, setUsers] = useState<UserData[]>([]);
  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    paidUsers: 0,
    totalRevenue: 0,
    todaySignups: 0
  });

  // 관리자 인증 확인
  useEffect(() => {
    const adminAuth = localStorage.getItem('ADMIN_AUTHENTICATED');
    if (adminAuth === 'true') {
      setIsAuthenticated(true);
      // 이미 인증된 경우도 콜백 호출
      onAdminVerified?.();
    }
  }, [onAdminVerified]);

  // API 키 로드
  useEffect(() => {
    if (isAuthenticated) {
      // GLOBAL_ 접두사로 전역 API 키 관리
      const globalGemini = localStorage.getItem('GLOBAL_GEMINI_API_KEY');
      const globalNaverId = localStorage.getItem('GLOBAL_NAVER_CLIENT_ID');
      const globalNaverSecret = localStorage.getItem('GLOBAL_NAVER_CLIENT_SECRET');

      setConfigValues({
        geminiKey: globalGemini || '',
        naverClientId: globalNaverId || '',
        naverClientSecret: globalNaverSecret || ''
      });
      
      // 데이터 로드
      loadUsersAndPayments();
    }
  }, [isAuthenticated]);

  const loadUsersAndPayments = async () => {
    setLoadingData(true);
    try {
      // 사용자 목록 가져오기
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (profilesError) {
        console.error('프로필 로드 에러:', profilesError);
      } else {
        setUsers(profilesData || []);
        
        // 통계 계산
        const today = new Date().toISOString().split('T')[0];
        const todayUsers = (profilesData || []).filter(u => 
          u.created_at?.startsWith(today)
        ).length;
        const paidCount = (profilesData || []).filter(u => 
          u.plan && u.plan !== 'free'
        ).length;
        
        setStats(prev => ({
          ...prev,
          totalUsers: profilesData?.length || 0,
          paidUsers: paidCount,
          todaySignups: todayUsers
        }));
      }

      // 결제 내역 가져오기
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (paymentsError) {
        console.error('결제 로드 에러:', paymentsError);
      } else {
        setPayments(paymentsData || []);
        
        // 총 매출 계산
        const totalRev = (paymentsData || [])
          .filter(p => p.status === 'completed')
          .reduce((sum, p) => sum + (p.amount || 0), 0);
        
        setStats(prev => ({
          ...prev,
          totalRevenue: totalRev
        }));
      }
    } catch (err) {
      console.error('데이터 로드 오류:', err);
    }
    setLoadingData(false);
  };

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
    localStorage.setItem('GLOBAL_NAVER_CLIENT_ID', configValues.naverClientId);
    localStorage.setItem('GLOBAL_NAVER_CLIENT_SECRET', configValues.naverClientSecret);
    
    // 기존 개인용 키도 업데이트 (호환성)
    localStorage.setItem('GEMINI_API_KEY', configValues.geminiKey);
    localStorage.setItem('NAVER_CLIENT_ID', configValues.naverClientId);
    localStorage.setItem('NAVER_CLIENT_SECRET', configValues.naverClientSecret);
    
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClearConfig = () => {
    if (confirm('모든 API 키를 삭제하시겠습니까?')) {
      localStorage.removeItem('GLOBAL_GEMINI_API_KEY');
      localStorage.removeItem('GLOBAL_NAVER_CLIENT_ID');
      localStorage.removeItem('GLOBAL_NAVER_CLIENT_SECRET');
      localStorage.removeItem('GEMINI_API_KEY');
      localStorage.removeItem('NAVER_CLIENT_ID');
      localStorage.removeItem('NAVER_CLIENT_SECRET');
      setConfigValues({
        geminiKey: '',
        naverClientId: '',
        naverClientSecret: ''
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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
        </div>

        {/* Tab Content */}
        <div className="bg-white/10 backdrop-blur-xl rounded-[32px] p-6 lg:p-8 shadow-2xl border border-white/10">
          
          {/* API Settings Tab */}
          {activeTab === 'api' && (
            <div>
              {/* Status Badge */}
              <div className="flex items-center gap-3 mb-6">
                <div className={`w-3 h-3 rounded-full ${configValues.geminiKey ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                <span className="text-sm font-bold text-slate-300">
                  {configValues.geminiKey ? '서비스 활성화됨' : '서비스 비활성화'}
                </span>
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

                {/* Naver API */}
                <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 p-6 rounded-2xl border border-green-500/20">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-black text-green-300 uppercase tracking-widest">
                      Naver Developers API
                    </label>
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-500/20 px-2 py-1 rounded-full">선택</span>
                  </div>
                  <div className="space-y-3">
                    <input 
                      type="text" 
                      value={configValues.naverClientId}
                      onChange={(e) => setConfigValues({...configValues, naverClientId: e.target.value})}
                      placeholder="Client ID"
                      className="w-full p-4 bg-slate-900/50 border border-slate-700 rounded-xl font-mono text-sm text-white placeholder-slate-500 focus:border-green-500 outline-none transition-colors"
                    />
                    <input 
                      type="password" 
                      value={configValues.naverClientSecret}
                      onChange={(e) => setConfigValues({...configValues, naverClientSecret: e.target.value})}
                      placeholder="Client Secret"
                      className="w-full p-4 bg-slate-900/50 border border-slate-700 rounded-xl font-mono text-sm text-white placeholder-slate-500 focus:border-green-500 outline-none transition-colors"
                    />
                  </div>
                  <p className="text-[11px] text-green-400/70 mt-2 font-medium">
                    ※ 추후 정확한 검색량 조회를 위해 사용됩니다.
                  </p>
                </div>
              </div>

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
                <button 
                  onClick={loadUsersAndPayments}
                  disabled={loadingData}
                  className="px-4 py-2 bg-slate-700 text-white font-bold rounded-xl hover:bg-slate-600 transition-colors text-sm disabled:opacity-50"
                >
                  {loadingData ? '로딩...' : '🔄 새로고침'}
                </button>
              </div>
              
              {users.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-5xl mb-4">👥</div>
                  <p className="text-slate-400 font-medium">
                    {loadingData ? '회원 목록을 불러오는 중...' : '아직 가입한 회원이 없습니다.'}
                  </p>
                  <p className="text-slate-500 text-sm mt-2">
                    Supabase 프로필 테이블을 확인하세요.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-3 px-4 text-xs font-bold text-slate-400 uppercase">이메일</th>
                        <th className="text-left py-3 px-4 text-xs font-bold text-slate-400 uppercase">이름</th>
                        <th className="text-left py-3 px-4 text-xs font-bold text-slate-400 uppercase">요금제</th>
                        <th className="text-left py-3 px-4 text-xs font-bold text-slate-400 uppercase">크레딧</th>
                        <th className="text-left py-3 px-4 text-xs font-bold text-slate-400 uppercase">가입일</th>
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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
    </div>
  );
};

export default AdminPage;
