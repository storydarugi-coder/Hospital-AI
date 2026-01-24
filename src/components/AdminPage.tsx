import React, { useState, useEffect } from 'react';

// Admin 비밀번호
const ADMIN_PASSWORD = '0000';

// 백엔드 API URL - 프로덕션에서는 상대 경로, 개발에서는 절대 경로
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

interface ContentData {
  id: number;
  title: string;
  category: string;
  postType: string;
  createdAt: string;
  content?: string;
}

interface AdminPageProps {
  onAdminVerified?: () => void;
}

const AdminPage: React.FC<AdminPageProps> = ({ onAdminVerified }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState<'api' | 'contents'>('api');
  
  // API 키 설정
  const [geminiKey, setGeminiKey] = useState('');
  const [saved, setSaved] = useState(false);
  
  // 콘텐츠 목록
  const [contents, setContents] = useState<ContentData[]>([]);
  const [loadingContents, setLoadingContents] = useState(false);
  const [selectedContent, setSelectedContent] = useState<ContentData | null>(null);
  
  // 통계
  const [stats, setStats] = useState({
    totalContents: 0,
    blogPosts: 0,
    cardNews: 0,
    todayCreated: 0
  });

  // 관리자 인증 확인
  useEffect(() => {
    const adminAuth = localStorage.getItem('ADMIN_AUTHENTICATED');
    if (adminAuth === 'true') {
      setIsAuthenticated(true);
      onAdminVerified?.();
    }
  }, [onAdminVerified]);

  // API 키 로드
  useEffect(() => {
    if (isAuthenticated) {
      const storedKey = localStorage.getItem('GEMINI_API_KEY');
      setGeminiKey(storedKey || '');
      
      // 콘텐츠 목록 로드
      loadContents();
    }
  }, [isAuthenticated]);

  // 콘텐츠 목록 로드
  const loadContents = async () => {
    setLoadingContents(true);
    try {
      const response = await fetch(`${API_BASE_URL}/content/list?limit=100`);
      
      // HTML 응답 체크 (404 에러)
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('❌ API 응답이 JSON이 아닙니다:', contentType);
        console.log('⚠️ 콘텐츠 API가 아직 설정되지 않았습니다.');
        setContents([]);
        setStats({ totalContents: 0, blogPosts: 0, cardNews: 0, todayCreated: 0 });
        setLoadingContents(false);
        return;
      }
      
      const data = await response.json();
      
      if (data.success && data.data) {
        setContents(data.data);
        
        // 통계 계산
        const total = data.data.length;
        const blogs = data.data.filter((c: ContentData) => c.postType === 'blog').length;
        const cards = data.data.filter((c: ContentData) => c.postType === 'card_news').length;
        
        const today = new Date().toISOString().split('T')[0];
        const todayCount = data.data.filter((c: ContentData) => 
          c.createdAt?.startsWith(today)
        ).length;
        
        setStats({
          totalContents: total,
          blogPosts: blogs,
          cardNews: cards,
          todayCreated: todayCount
        });
      } else {
        console.log('⚠️ 콘텐츠 목록이 비어있습니다.');
        setContents([]);
      }
    } catch (error) {
      console.error('콘텐츠 로드 실패:', error);
      setContents([]);
      setStats({ totalContents: 0, blogPosts: 0, cardNews: 0, todayCreated: 0 });
    }
    setLoadingContents(false);
  };

  // 콘텐츠 상세 조회
  const viewContent = async (id: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/content/${id}`);
      const data = await response.json();
      
      if (data.success && data.data) {
        setSelectedContent(data.data);
      }
    } catch (error) {
      console.error('콘텐츠 조회 실패:', error);
    }
  };

  // 콘텐츠 삭제
  const deleteContent = async (id: number) => {
    if (!confirm('정말 이 콘텐츠를 삭제하시겠습니까?')) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/content/${id}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      
      if (data.success) {
        alert('✅ 삭제되었습니다.');
        loadContents();
      }
    } catch (error) {
      console.error('콘텐츠 삭제 실패:', error);
      alert('❌ 삭제에 실패했습니다.');
    }
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      localStorage.setItem('ADMIN_AUTHENTICATED', 'true');
      setLoginError('');
      onAdminVerified?.();
    } else {
      setLoginError('비밀번호가 올바르지 않습니다.');
    }
  };

  const handleAdminLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('ADMIN_AUTHENTICATED');
  };

  const handleSaveApiKey = () => {
    localStorage.setItem('GEMINI_API_KEY', geminiKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClearApiKey = () => {
    if (confirm('API 키를 삭제하시겠습니까?')) {
      localStorage.removeItem('GEMINI_API_KEY');
      setGeminiKey('');
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
  
  const getPostTypeBadge = (postType: string) => {
    const badges: Record<string, { bg: string; text: string; label: string; emoji: string }> = {
      'blog': { bg: 'bg-blue-500/20', text: 'text-blue-400', label: '블로그', emoji: '📝' },
      'card_news': { bg: 'bg-purple-500/20', text: 'text-purple-400', label: '카드뉴스', emoji: '📱' },
      'press_release': { bg: 'bg-amber-500/20', text: 'text-amber-400', label: '보도자료', emoji: '📰' },
    };
    const badge = badges[postType] || badges['blog'];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 ${badge.bg} ${badge.text} text-xs font-bold rounded-full`}>
        <span>{badge.emoji}</span>
        <span>{badge.label}</span>
      </span>
    );
  };

  // 로그인 화면
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-emerald-500 to-green-600 rounded-3xl shadow-2xl shadow-emerald-500/30 mb-6">
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
                href="#app" 
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
            <div className="text-3xl mb-2">📝</div>
            <div className="text-2xl font-black text-white">{stats.totalContents}</div>
            <div className="text-sm text-slate-400">전체 콘텐츠</div>
          </div>
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-5 border border-white/10">
            <div className="text-3xl mb-2">📰</div>
            <div className="text-2xl font-black text-white">{stats.blogPosts}</div>
            <div className="text-sm text-slate-400">블로그 포스트</div>
          </div>
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-5 border border-white/10">
            <div className="text-3xl mb-2">📱</div>
            <div className="text-2xl font-black text-white">{stats.cardNews}</div>
            <div className="text-sm text-slate-400">카드뉴스</div>
          </div>
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-5 border border-white/10">
            <div className="text-3xl mb-2">🆕</div>
            <div className="text-2xl font-black text-white">{stats.todayCreated}</div>
            <div className="text-sm text-slate-400">오늘 작성</div>
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
            onClick={() => setActiveTab('contents')}
            className={`px-5 py-3 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'contents' 
                ? 'bg-emerald-500 text-white' 
                : 'bg-white/10 text-slate-400 hover:text-white'
            }`}
          >
            📚 콘텐츠 관리
          </button>
        </div>

        {/* Tab Content */}
        <div className="bg-white/10 backdrop-blur-xl rounded-[32px] p-6 lg:p-8 shadow-2xl border border-white/10">
          
          {/* API Settings Tab */}
          {activeTab === 'api' && (
            <div>
              {/* Status Badge */}
              <div className="flex items-center gap-2 mb-6">
                <div className={`w-3 h-3 rounded-full ${geminiKey ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
                <span className="text-sm font-bold text-slate-300">
                  Gemini: {geminiKey ? '✅ 활성' : '❌ 미설정'}
                </span>
              </div>

              {/* Info Banner */}
              <div className="mb-6 p-4 bg-blue-500/20 border border-blue-500/30 rounded-xl">
                <p className="text-blue-300 text-sm font-medium">
                  ℹ️ 여기서 설정한 API 키는 모든 사용자가 공유합니다.<br/>
                  사용자들은 API 키 없이도 서비스를 이용할 수 있습니다.
                </p>
              </div>

              {/* Gemini API Key */}
              <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 p-6 rounded-2xl border border-blue-500/20 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-black text-blue-300 uppercase tracking-widest">
                    Google Gemini API
                  </label>
                  <span className="text-[10px] font-bold text-red-400 bg-red-500/20 px-2 py-1 rounded-full">필수</span>
                </div>
                <input 
                  type="password" 
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AI Studio에서 발급받은 API Key"
                  className="w-full p-4 bg-slate-900/50 border border-slate-700 rounded-xl font-mono text-sm text-white placeholder-slate-500 focus:border-blue-500 outline-none transition-colors"
                />
                {geminiKey && (
                  <p className="text-[11px] text-blue-400 mt-2 font-mono">
                    현재 키: {maskApiKey(geminiKey)}
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

              {/* Actions */}
              <div className="flex gap-3">
                <button 
                  onClick={handleClearApiKey} 
                  className="flex-1 py-4 bg-red-500/20 text-red-400 font-bold rounded-xl hover:bg-red-500/30 transition-colors border border-red-500/30"
                >
                  🗑️ 전체 삭제
                </button>
                <button 
                  onClick={handleSaveApiKey} 
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

          {/* Contents Tab */}
          {activeTab === 'contents' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black text-white">이전 콘텐츠 목록</h2>
                <button 
                  onClick={loadContents}
                  disabled={loadingContents}
                  className="px-4 py-2 bg-slate-700 text-white font-bold rounded-xl hover:bg-slate-600 transition-colors text-sm disabled:opacity-50"
                >
                  {loadingContents ? '로딩...' : '🔄 새로고침'}
                </button>
              </div>
              
              {contents.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-5xl mb-4">📚</div>
                  <p className="text-slate-400 font-medium">
                    {loadingContents ? '콘텐츠를 불러오는 중...' : '아직 저장된 콘텐츠가 없습니다.'}
                  </p>
                  <p className="text-slate-500 text-sm mt-2">
                    콘텐츠를 생성하면 여기에 표시됩니다.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-3 px-4 text-xs font-bold text-slate-400 uppercase">제목</th>
                        <th className="text-left py-3 px-4 text-xs font-bold text-slate-400 uppercase">카테고리</th>
                        <th className="text-left py-3 px-4 text-xs font-bold text-slate-400 uppercase">타입</th>
                        <th className="text-left py-3 px-4 text-xs font-bold text-slate-400 uppercase">작성일</th>
                        <th className="text-left py-3 px-4 text-xs font-bold text-slate-400 uppercase">관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contents.map((content) => (
                        <tr key={content.id} className="border-b border-slate-800 hover:bg-white/5">
                          <td className="py-3 px-4 text-sm text-white font-medium">{content.title}</td>
                          <td className="py-3 px-4 text-sm text-slate-300">{content.category}</td>
                          <td className="py-3 px-4">{getPostTypeBadge(content.postType)}</td>
                          <td className="py-3 px-4 text-sm text-slate-400">{formatDate(content.createdAt)}</td>
                          <td className="py-3 px-4">
                            <div className="flex gap-2">
                              <button
                                onClick={() => viewContent(content.id)}
                                className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs font-bold rounded hover:bg-blue-500/30 transition-colors"
                              >
                                👁️ 보기
                              </button>
                              <button
                                onClick={() => deleteContent(content.id)}
                                className="px-2 py-1 bg-red-500/20 text-red-400 text-xs font-bold rounded hover:bg-red-500/30 transition-colors"
                              >
                                🗑️ 삭제
                              </button>
                            </div>
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
      
      {/* Content Detail Modal */}
      {selectedContent && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setSelectedContent(null)}>
          <div className="bg-slate-800 rounded-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden border border-slate-600" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-600 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-white">{selectedContent.title}</h3>
                <div className="flex items-center gap-2 mt-1">
                  {getPostTypeBadge(selectedContent.postType)}
                  <span className="text-xs text-slate-400">{selectedContent.category}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedContent(null)}
                className="text-slate-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>
            <div className="p-6 overflow-auto max-h-[60vh]">
              <div className="prose prose-invert max-w-none">
                <div 
                  className="text-slate-300 leading-relaxed whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ __html: selectedContent.content || '콘텐츠를 불러오지 못했습니다.' }}
                />
              </div>
            </div>
            <div className="p-4 border-t border-slate-600 flex justify-end">
              <button
                onClick={() => setSelectedContent(null)}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white font-bold rounded-lg transition-colors"
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
