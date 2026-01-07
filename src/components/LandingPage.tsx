import React, { useState, useEffect } from 'react';
import TermsPage from './TermsPage';
import PrivacyPage from './PrivacyPage';
import PaymentModal from './PaymentModal';

interface LandingPageProps {
  isLoggedIn?: boolean;
  userName?: string;
  onLogout?: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ isLoggedIn = false, userName, onLogout }) => {
  const [scrollY, setScrollY] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  useEffect(() => {
    if (mobileMenuOpen || showHelp || showTerms || showPrivacy || showPayment) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [mobileMenuOpen, showHelp, showTerms, showPrivacy, showPayment]);

  return (
    <div className="min-h-screen bg-white text-slate-900 overflow-x-hidden">
      {/* 🎉 오픈 이벤트 배너 */}
      <div className="bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 text-white py-3 px-4 text-center fixed top-0 left-0 right-0 z-[60]">
        <p className="text-sm sm:text-base font-bold animate-pulse">
          🎉 오픈 이벤트! <span className="underline">일주일간 무제한 무료</span> 사용 (~1/10까지) 🚀
        </p>
      </div>
      
      {/* Navigation */}
      <nav className={`fixed top-12 left-0 right-0 z-50 transition-all duration-300 ${scrollY > 50 ? 'bg-white/90 backdrop-blur-xl shadow-lg' : 'bg-transparent'}`}>
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white font-black text-xl">H</span>
            </div>
            <span className="font-black text-xl text-slate-800">Hospital<span className="text-emerald-600">AI</span></span>
          </div>
          {/* Desktop Menu */}
          <div className="hidden sm:flex items-center gap-4">
            <button onClick={() => setShowHelp(true)} className="text-sm font-bold text-slate-600 hover:text-emerald-600 transition-colors">도움말</button>
            <a href="#pricing" className="text-sm font-bold text-slate-600 hover:text-emerald-600 transition-colors">요금제</a>
            <a href="#app" className="text-sm font-bold text-slate-600 hover:text-emerald-600 transition-colors">블로그 AI</a>
            {isLoggedIn ? (
              <>
                <span className="text-sm font-bold text-emerald-600">{userName} 님</span>
                <button 
                  onClick={onLogout}
                  className="px-6 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all"
                >
                  로그아웃
                </button>
              </>
            ) : (
              <>
                <a href="#auth" className="text-sm font-bold text-slate-600 hover:text-emerald-600 transition-colors">로그인</a>
                <a href="#auth" className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-emerald-200 transition-all">
                  회원가입
                </a>
              </>
            )}
          </div>
          
          {/* Mobile Hamburger Button */}
          <button 
            onClick={() => setMobileMenuOpen(true)}
            className="sm:hidden w-10 h-10 flex flex-col items-center justify-center gap-1.5"
          >
            <span className="w-6 h-0.5 bg-slate-700 rounded-full"></span>
            <span className="w-6 h-0.5 bg-slate-700 rounded-full"></span>
            <span className="w-6 h-0.5 bg-slate-700 rounded-full"></span>
          </button>
        </div>
      </nav>
      
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[100] sm:hidden">
          <div className="absolute inset-0 bg-black/20" onClick={() => setMobileMenuOpen(false)}></div>
          <div className="absolute top-0 left-0 right-0 bg-white shadow-2xl animate-slideDown">
            <div className="flex items-center justify-between px-6 h-20 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white font-black text-xl">H</span>
                </div>
                <span className="font-black text-xl text-slate-800">Hospital<span className="text-emerald-600">AI</span></span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-slate-800">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-4">
              <button onClick={() => { setShowHelp(true); setMobileMenuOpen(false); }} className="block w-full text-left py-4 text-lg font-bold text-slate-800 border-b border-slate-100">도움말</button>
              <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="block py-4 text-lg font-bold text-slate-800 border-b border-slate-100">요금제</a>
              <a href="#app" onClick={() => setMobileMenuOpen(false)} className="block py-4 text-lg font-bold text-slate-800 border-b border-slate-100">블로그 AI</a>
              {!isLoggedIn && <a href="#auth" onClick={() => setMobileMenuOpen(false)} className="block py-4 text-lg font-bold text-slate-800 border-b border-slate-100">로그인</a>}
              {isLoggedIn && <div className="py-4 border-b border-slate-100"><span className="text-lg font-bold text-emerald-600">{userName} 님</span></div>}
            </div>
            <div className="px-6 pb-6">
              {isLoggedIn ? (
                <button onClick={() => { onLogout?.(); setMobileMenuOpen(false); }} className="block w-full py-4 text-center bg-slate-200 text-slate-700 font-bold text-lg rounded-xl">로그아웃</button>
              ) : (
                <a href="#auth" onClick={() => setMobileMenuOpen(false)} className="block w-full py-4 text-center bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold text-lg rounded-xl">회원가입</a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="pt-44 pb-20 px-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-emerald-100/50 to-green-50/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-blue-100/40 to-cyan-50/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3"></div>
        
        <div className="max-w-6xl mx-auto relative">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-full border border-emerald-100 mb-8">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              <span className="text-sm font-bold text-emerald-700">2026년 의료광고법 가이드라인 100% 준수</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 leading-tight mb-6">
              병원 콘텐츠,<br/>
              <span className="bg-gradient-to-r from-emerald-600 to-green-500 bg-clip-text text-transparent">AI가 30초 만에</span>
            </h1>

            <p className="text-lg sm:text-xl text-slate-500 font-medium mb-10 max-w-2xl mx-auto leading-relaxed">
              블로그 · 카드뉴스 · 보도자료까지 한 번에!<br className="hidden sm:block"/>
              의료법 준수 + 네이버 SEO 최적화 + AI 이미지 자동 생성
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <a href="#app" className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-black text-lg rounded-2xl hover:shadow-2xl hover:shadow-emerald-200 transition-all hover:-translate-y-1">
                🚀 무료로 시작하기
              </a>
              <button onClick={() => setShowHelp(true)} className="w-full sm:w-auto px-8 py-4 bg-slate-100 text-slate-700 font-bold text-lg rounded-2xl hover:bg-slate-200 transition-all flex items-center justify-center gap-2">
                ❓ 사용법 보기
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 sm:gap-8 max-w-3xl mx-auto">
              <div className="text-center p-4">
                <div className="text-2xl sm:text-4xl font-black text-emerald-600 mb-1">3<span className="text-lg">종</span></div>
                <div className="text-[10px] sm:text-sm text-slate-500 font-medium">콘텐츠 타입</div>
              </div>
              <div className="text-center p-4 border-x border-slate-100">
                <div className="text-2xl sm:text-4xl font-black text-emerald-600 mb-1">21<span className="text-lg">개</span></div>
                <div className="text-[10px] sm:text-sm text-slate-500 font-medium">진료과 지원</div>
              </div>
              <div className="text-center p-4 border-r border-slate-100">
                <div className="text-2xl sm:text-4xl font-black text-emerald-600 mb-1">4<span className="text-lg">종</span></div>
                <div className="text-[10px] sm:text-sm text-slate-500 font-medium">이미지 스타일</div>
              </div>
              <div className="text-center p-4">
                <div className="text-2xl sm:text-4xl font-black text-emerald-600 mb-1">30<span className="text-lg">초</span></div>
                <div className="text-[10px] sm:text-sm text-slate-500 font-medium">생성 시간</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3종 콘텐츠 Section */}
      <section className="py-20 px-6 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full border border-blue-100 mb-6">
              <span className="text-sm font-bold text-blue-700">📝 3종 콘텐츠</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-4">하나의 도구로 모든 콘텐츠를</h2>
            <p className="text-slate-500 font-medium">블로그, 카드뉴스, 보도자료까지 한 번에 생성</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/50 hover:shadow-2xl hover:shadow-emerald-100/50 transition-all group">
              <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl flex items-center justify-center text-2xl mb-6 group-hover:scale-110 transition-transform">📰</div>
              <h3 className="text-xl font-black text-slate-800 mb-3">블로그 글</h3>
              <p className="text-slate-500 font-medium leading-relaxed mb-4">네이버 블로그에 최적화된 SEO 글. 이미지 3~5장 자동 생성, 원클릭 복사!</p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full">SEO 최적화</span>
                <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full">AI 이미지</span>
              </div>
            </div>
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/50 hover:shadow-2xl hover:shadow-blue-100/50 transition-all group">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-2xl mb-6 group-hover:scale-110 transition-transform">🎴</div>
              <h3 className="text-xl font-black text-slate-800 mb-3">카드뉴스</h3>
              <p className="text-slate-500 font-medium leading-relaxed mb-4">인스타그램/네이버에 최적화! 원고 미리보기 → 디자인 생성 → ZIP 다운로드</p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full">6~10장 슬라이드</span>
                <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full">ZIP 다운로드</span>
              </div>
            </div>
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/50 hover:shadow-2xl hover:shadow-purple-100/50 transition-all group">
              <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center text-2xl mb-6 group-hover:scale-110 transition-transform">🗞️</div>
              <h3 className="text-xl font-black text-slate-800 mb-3">보도자료</h3>
              <p className="text-slate-500 font-medium leading-relaxed mb-4">언론사 배포용 보도자료. 병원명/의사명 입력하면 전문적인 보도자료 완성!</p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-purple-50 text-purple-700 text-xs font-bold rounded-full">6종 유형</span>
                <span className="px-3 py-1 bg-purple-50 text-purple-700 text-xs font-bold rounded-full">언론사 형식</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 핵심 기능 Section */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-full border border-emerald-100 mb-6">
              <span className="text-sm font-bold text-emerald-700">✨ 핵심 기능</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-4">왜 HospitalAI인가요?</h2>
            <p className="text-slate-500 font-medium max-w-xl mx-auto">병원 마케팅에 필요한 모든 것을 하나로</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-red-50 to-orange-50 p-8 rounded-3xl border border-red-100 hover:shadow-xl transition-all">
              <div className="text-4xl mb-4">⚖️</div>
              <h3 className="text-xl font-black text-slate-800 mb-3">의료광고법 100% 준수</h3>
              <p className="text-slate-600 font-medium leading-relaxed">2026년 최신 가이드라인 기반, 금칙어 자동 필터링. 심의 걱정 없는 안전한 콘텐츠!</p>
            </div>

            <div className="bg-gradient-to-br from-emerald-50 to-green-50 p-8 rounded-3xl border border-emerald-100 hover:shadow-xl transition-all">
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="text-xl font-black text-slate-800 mb-3">네이버 SEO 최적화</h3>
              <p className="text-slate-600 font-medium leading-relaxed">스마트블록 상위노출! AI가 트렌드 키워드 분석 + SEO 최적화 제목 자동 추천</p>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-8 rounded-3xl border border-blue-100 hover:shadow-xl transition-all">
              <div className="text-4xl mb-4">🖼️</div>
              <h3 className="text-xl font-black text-slate-800 mb-3">AI 이미지 4종 스타일</h3>
              <p className="text-slate-600 font-medium leading-relaxed">실사 / 3D 일러스트 / 의학 3D / 커스텀 스타일. 참고 이미지로 느낌 통일!</p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-8 rounded-3xl border border-purple-100 hover:shadow-xl transition-all">
              <div className="text-4xl mb-4">✍️</div>
              <h3 className="text-xl font-black text-slate-800 mb-3">글 스타일 3종</h3>
              <p className="text-slate-600 font-medium leading-relaxed">전문가형 / 공감형 / 전환형 선택! 목적에 맞는 톤앤매너로 글 생성</p>
            </div>

            <div className="bg-gradient-to-br from-amber-50 to-yellow-50 p-8 rounded-3xl border border-amber-100 hover:shadow-xl transition-all">
              <div className="text-4xl mb-4">🧠</div>
              <h3 className="text-xl font-black text-slate-800 mb-3">말투 학습 기능</h3>
              <p className="text-slate-600 font-medium leading-relaxed">기존 글 분석해서 말투 저장! 우리 병원만의 일관된 톤으로 글 생성</p>
            </div>

            <div className="bg-gradient-to-br from-cyan-50 to-sky-50 p-8 rounded-3xl border border-cyan-100 hover:shadow-xl transition-all">
              <div className="text-4xl mb-4">💬</div>
              <h3 className="text-xl font-black text-slate-800 mb-3">AI 채팅 수정</h3>
              <p className="text-slate-600 font-medium leading-relaxed">"두 번째 문단 더 부드럽게" 말만 하면 AI가 수정! 의료법 준수 유지</p>
            </div>
          </div>
        </div>
      </section>

      {/* AI 편집 기능 Section */}
      <section className="py-20 px-6 bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-20 left-10 w-72 h-72 bg-purple-500 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-20 right-10 w-72 h-72 bg-blue-500 rounded-full blur-[120px]"></div>
        </div>
        
        <div className="max-w-6xl mx-auto relative">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full border border-white/20 mb-6">
              <span className="text-sm font-bold text-white">🪄 마법 같은 편집</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">생성 후에도 자유롭게</h2>
            <p className="text-purple-200 font-medium max-w-xl mx-auto">이미지 재생성, AI 프롬프트 추천, 참고 이미지 고정</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white/10 backdrop-blur-xl p-6 rounded-3xl border border-white/20 hover:bg-white/15 transition-all">
              <div className="text-3xl mb-4">🖼️</div>
              <h3 className="text-lg font-black text-white mb-2">이미지 클릭 → 재생성</h3>
              <p className="text-purple-200 text-sm font-medium">마음에 안 드는 이미지? 클릭 한 번으로 새로 생성!</p>
            </div>

            <div className="bg-white/10 backdrop-blur-xl p-6 rounded-3xl border border-white/20 hover:bg-white/15 transition-all">
              <div className="text-3xl mb-4">🤖</div>
              <h3 className="text-lg font-black text-white mb-2">AI 프롬프트 추천</h3>
              <p className="text-purple-200 text-sm font-medium">글 내용 분석해서 최적의 이미지 프롬프트 자동 추천!</p>
            </div>

            <div className="bg-white/10 backdrop-blur-xl p-6 rounded-3xl border border-white/20 hover:bg-white/15 transition-all">
              <div className="text-3xl mb-4">📌</div>
              <h3 className="text-lg font-black text-white mb-2">참고 이미지 고정</h3>
              <p className="text-purple-200 text-sm font-medium">원하는 스타일 참고 이미지 고정! 모든 카드에 일관된 느낌</p>
            </div>
          </div>

          <div className="text-center mt-12">
            <a href="#app" className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black text-lg rounded-2xl hover:shadow-2xl hover:shadow-emerald-500/30 transition-all hover:-translate-y-1">
              🚀 직접 체험해보기
            </a>
          </div>
        </div>
      </section>

      {/* 진료과 지원 */}
      <section className="py-20 px-6 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-4">21개 진료과 지원</h2>
            <p className="text-slate-500 font-medium">각 진료과에 맞는 전문적인 콘텐츠 생성</p>
          </div>
          
          <div className="flex flex-wrap justify-center gap-3 max-w-4xl mx-auto">
            {['내과', '외과', '유방외과', '갑상선외과', '산부인과', '피부과', '치과', '안과', '정형외과', '이비인후과', '소아과', '한의원', '성형외과', '정신건강의학과', '비뇨의학과', '신경과', '신경외과', '재활의학과', '가정의학과', '마취통증의학과'].map((dept) => (
              <span key={dept} className="px-4 py-2 bg-white border border-slate-200 rounded-full text-sm font-bold text-slate-600 hover:border-emerald-300 hover:text-emerald-600 transition-all cursor-default">
                {dept}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-full border border-emerald-100 mb-6">
              <span className="text-sm font-bold text-emerald-700">💰 심플한 가격</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-4">합리적인 요금제</h2>
            <p className="text-slate-500 font-medium">필요한 만큼만 선택하세요</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {/* Free */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-lg hover:shadow-xl transition-all">
              <h3 className="text-xl font-black text-slate-800 mb-1">맛보기</h3>
              <p className="text-sm text-slate-400 mb-4">서비스 체험용</p>
              <div className="text-3xl font-black text-slate-900 mb-1">무료</div>
              <p className="text-sm text-emerald-600 font-medium mb-6">3회 | 계정당 1회</p>
              <ul className="space-y-2 text-sm text-slate-600 mb-6">
                <li className="flex items-center gap-2"><span className="text-emerald-500">✓</span> 블로그/카드뉴스/보도자료</li>
                <li className="flex items-center gap-2"><span className="text-emerald-500">✓</span> AI 이미지 생성</li>
                <li className="flex items-center gap-2"><span className="text-emerald-500">✓</span> 모든 기능 동일</li>
              </ul>
              <a href="#auth" className="block w-full py-3 text-center bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all">무료 체험</a>
            </div>

            {/* Basic */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-lg hover:shadow-xl transition-all">
              <h3 className="text-xl font-black text-slate-800 mb-1">베이직</h3>
              <p className="text-sm text-slate-400 mb-4">개인 블로거용</p>
              <div className="text-3xl font-black text-slate-900 mb-1">₩15,900</div>
              <p className="text-sm text-emerald-600 font-medium mb-6">10회 | 3개월</p>
              <ul className="space-y-2 text-sm text-slate-600 mb-6">
                <li className="flex items-center gap-2"><span className="text-emerald-500">✓</span> 블로그/카드뉴스/보도자료</li>
                <li className="flex items-center gap-2"><span className="text-emerald-500">✓</span> AI 이미지 생성</li>
                <li className="flex items-center gap-2"><span className="text-emerald-500">✓</span> 모든 기능 동일</li>
              </ul>
              <button onClick={() => setShowPayment(true)} className="block w-full py-3 text-center bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 transition-all">구매하기</button>
            </div>

            {/* Standard */}
            <div className="bg-gradient-to-br from-emerald-500 to-green-600 p-6 rounded-2xl shadow-xl shadow-emerald-200 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-yellow-400 text-yellow-900 text-xs font-black rounded-full">인기</div>
              <h3 className="text-xl font-black text-white mb-1">스탠다드</h3>
              <p className="text-sm text-emerald-100 mb-4">소규모 병원용</p>
              <div className="text-3xl font-black text-white mb-1">₩29,900</div>
              <p className="text-sm text-emerald-200 font-medium mb-6">20회 | 3개월</p>
              <ul className="space-y-2 text-sm text-white/90 mb-6">
                <li className="flex items-center gap-2"><span>✓</span> 블로그/카드뉴스/보도자료</li>
                <li className="flex items-center gap-2"><span>✓</span> AI 이미지 생성</li>
                <li className="flex items-center gap-2"><span>✓</span> 모든 기능 동일</li>
              </ul>
              <button onClick={() => setShowPayment(true)} className="block w-full py-3 text-center bg-white text-emerald-600 font-bold rounded-xl hover:bg-emerald-50 transition-all">구매하기</button>
            </div>

            {/* Premium */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-lg hover:shadow-xl transition-all relative">
              <div className="absolute -top-3 right-4 px-3 py-1 bg-red-500 text-white text-xs font-black rounded-full">BEST</div>
              <h3 className="text-xl font-black text-slate-800 mb-1">프리미엄</h3>
              <p className="text-sm text-slate-400 mb-4">대형 병원/대행사</p>
              <div className="text-3xl font-black text-slate-900 mb-1">₩55,900</div>
              <p className="text-sm text-emerald-600 font-medium mb-6">50회 | 3개월</p>
              <ul className="space-y-2 text-sm text-slate-600 mb-6">
                <li className="flex items-center gap-2"><span className="text-emerald-500">✓</span> 블로그/카드뉴스/보도자료</li>
                <li className="flex items-center gap-2"><span className="text-emerald-500">✓</span> AI 이미지 생성</li>
                <li className="flex items-center gap-2"><span className="text-emerald-500">✓</span> 모든 기능 동일</li>
              </ul>
              <button onClick={() => setShowPayment(true)} className="block w-full py-3 text-center bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-all">구매하기</button>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
            <div className="bg-slate-50 p-6 rounded-2xl text-center">
              <div className="text-3xl font-black text-emerald-600 mb-1">89%</div>
              <div className="text-sm text-slate-500 font-medium">비용 절감</div>
            </div>
            <div className="bg-slate-50 p-6 rounded-2xl text-center">
              <div className="text-3xl font-black text-emerald-600 mb-1">99%</div>
              <div className="text-sm text-slate-500 font-medium">시간 절약</div>
            </div>
            <div className="bg-slate-50 p-6 rounded-2xl text-center">
              <div className="text-3xl font-black text-emerald-600 mb-1">100%</div>
              <div className="text-sm text-slate-500 font-medium">의료법 준수</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-6">지금 바로 시작하세요</h2>
          <p className="text-slate-400 font-medium mb-10 max-w-xl mx-auto">의료광고법 걱정 없이, 30초 만에 전문적인 병원 콘텐츠를 만들어보세요.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="#app" className="w-full sm:w-auto px-10 py-4 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-black text-lg rounded-2xl hover:shadow-2xl hover:shadow-emerald-500/30 transition-all">🚀 무료로 시작하기</a>
            <button onClick={() => setShowHelp(true)} className="w-full sm:w-auto px-10 py-4 bg-white/10 text-white font-bold text-lg rounded-2xl hover:bg-white/20 transition-all border border-white/20">❓ 사용법 보기</button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 bg-slate-900 border-t border-slate-800">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-black text-xl">H</span>
              </div>
              <span className="font-black text-xl text-white">Hospital<span className="text-emerald-500">AI</span></span>
            </div>
            <div className="flex items-center gap-6 text-sm text-slate-400">
              <button onClick={() => setShowHelp(true)} className="hover:text-white transition-colors">도움말</button>
              <a href="#features" className="hover:text-white transition-colors">기능</a>
              <a href="#pricing" className="hover:text-white transition-colors">요금제</a>
              <a href="#app" className="hover:text-white transition-colors">앱 실행</a>
            </div>
          </div>
          
          <div className="mt-8 pt-8 border-t border-slate-800">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 text-sm text-slate-400 mb-8">
              <div>
                <h4 className="font-bold text-white mb-2">사업자 정보</h4>
                <p>상호명: 미쁘다</p>
                <p>대표자: 이지안</p>
                <p>사업자등록번호: 677-45-01149</p>
                <p>통신판매업신고: 준비중</p>
              </div>
              <div>
                <h4 className="font-bold text-white mb-2">연락처</h4>
                <p>전화: 010-3238-8284</p>
                <p>이메일: story.darugi@gmail.com</p>
                <p>서울특별시 송파구 거마로 56 17층</p>
              </div>
              <div>
                <h4 className="font-bold text-white mb-2">서비스 안내</h4>
                <p>결제 즉시 이용 가능</p>
                <p>이용권: 결제일로부터 90일</p>
              </div>
              <div>
                <h4 className="font-bold text-white mb-2">환불 규정</h4>
                <p>미사용 시: 7일 이내 전액 환불</p>
                <p>사용 시: 잔여분 비례 환불</p>
              </div>
            </div>
            
            {/* 약관 링크 */}
            <div className="flex flex-wrap justify-center gap-4 text-xs text-slate-500 mb-6">
              <button onClick={() => setShowTerms(true)} className="hover:text-white transition-colors">이용약관</button>
              <span>|</span>
              <button onClick={() => setShowPrivacy(true)} className="hover:text-white transition-colors">개인정보처리방침</button>
            </div>
          </div>
          
          <div className="text-center text-sm text-slate-500">
            © 2025 HospitalAI. Made with ❤️ using AI Technology
          </div>
        </div>
      </footer>

      {/* 도움말 모달 */}
      {showHelp && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4" onClick={() => setShowHelp(false)}>
          <div className="w-full max-w-3xl max-h-[85vh] bg-white rounded-3xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 bg-gradient-to-r from-emerald-500 to-green-600 flex items-center justify-between">
              <h2 className="text-xl font-black text-white">📖 HospitalAI 사용 가이드</h2>
              <button onClick={() => setShowHelp(false)} className="text-white/80 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(85vh-80px)] space-y-6">
              {/* 기본 사용법 */}
              <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-100">
                <h3 className="font-black text-emerald-800 mb-3 flex items-center gap-2">🚀 기본 사용법</h3>
                <ol className="space-y-2 text-sm text-emerald-700">
                  <li><span className="font-bold">1.</span> <span className="font-bold">콘텐츠 타입</span> 선택 (블로그/카드뉴스/보도자료)</li>
                  <li><span className="font-bold">2.</span> <span className="font-bold">진료과</span> 선택 (21개 진료과 지원)</li>
                  <li><span className="font-bold">3.</span> <span className="font-bold">주제</span> 입력 또는 AI 트렌드 추천 클릭</li>
                  <li><span className="font-bold">4.</span> <span className="font-bold">생성하기</span> 클릭 → 30초 내 완성!</li>
                </ol>
              </div>

              {/* 콘텐츠 타입 */}
              <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100">
                <h3 className="font-black text-blue-800 mb-3 flex items-center gap-2">📝 콘텐츠 타입별 안내</h3>
                <div className="space-y-3 text-sm text-blue-700">
                  <div>
                    <p className="font-bold">📰 블로그</p>
                    <p>네이버 블로그에 최적화된 글 + AI 이미지 3~5장 자동 생성. 원클릭으로 복사해서 붙여넣기!</p>
                  </div>
                  <div>
                    <p className="font-bold">🎴 카드뉴스</p>
                    <p>① 원고 생성 → ② 미리보기에서 수정 → ③ 디자인 생성 → ④ ZIP 다운로드. 인스타그램/네이버에 바로 업로드!</p>
                  </div>
                  <div>
                    <p className="font-bold">🗞️ 보도자료</p>
                    <p>병원명, 의사명, 직함 입력 → 6종 유형 선택 → 언론사 배포용 전문 보도자료 완성!</p>
                  </div>
                </div>
              </div>

              {/* 이미지 스타일 */}
              <div className="bg-purple-50 p-5 rounded-2xl border border-purple-100">
                <h3 className="font-black text-purple-800 mb-3 flex items-center gap-2">🖼️ 이미지 스타일</h3>
                <div className="grid grid-cols-2 gap-3 text-sm text-purple-700">
                  <div><span className="font-bold">📷 실사</span>: 실제 사진 느낌</div>
                  <div><span className="font-bold">🎨 3D 일러스트</span>: 친근한 3D 캐릭터</div>
                  <div><span className="font-bold">🏥 의학 3D</span>: 해부학/장기 시각화</div>
                  <div><span className="font-bold">✨ 커스텀</span>: 직접 스타일 입력</div>
                </div>
                <p className="text-xs text-purple-600 mt-3">💡 팁: 커스텀에서 "수채화 스타일", "색연필 느낌" 등 원하는 스타일 직접 입력!</p>
              </div>

              {/* 글 스타일 */}
              <div className="bg-amber-50 p-5 rounded-2xl border border-amber-100">
                <h3 className="font-black text-amber-800 mb-3 flex items-center gap-2">✍️ 글 스타일</h3>
                <div className="space-y-2 text-sm text-amber-700">
                  <div><span className="font-bold">📚 전문가형</span>: 논문/학회 인용, 전문적인 신뢰감</div>
                  <div><span className="font-bold">💕 공감형</span>: 환자 눈높이, 따뜻한 톤</div>
                  <div><span className="font-bold">🎯 전환형</span>: 행동 유도, 마케팅 최적화</div>
                </div>
              </div>

              {/* 고급 기능 */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                <h3 className="font-black text-slate-800 mb-3 flex items-center gap-2">⚡ 고급 기능</h3>
                <div className="space-y-3 text-sm text-slate-600">
                  <div>
                    <p className="font-bold">🤖 AI 프롬프트 추천</p>
                    <p>이미지 재생성 시 "AI 추천" 버튼 클릭 → 글 내용에 맞는 최적 프롬프트 자동 생성!</p>
                  </div>
                  <div>
                    <p className="font-bold">📌 참고 이미지 고정</p>
                    <p>원하는 스타일의 참고 이미지를 "고정" → 모든 카드에 동일한 느낌 적용!</p>
                  </div>
                  <div>
                    <p className="font-bold">💬 AI 채팅 수정</p>
                    <p>"두 번째 문단 더 부드럽게", "결론에 CTA 추가해줘" 등 말로 수정 요청!</p>
                  </div>
                  <div>
                    <p className="font-bold">🧠 말투 학습</p>
                    <p>기존 글 붙여넣기 → 분석 → 저장 → 우리 병원만의 일관된 말투로 생성!</p>
                  </div>
                </div>
              </div>

              {/* 팁 */}
              <div className="bg-gradient-to-r from-emerald-500 to-green-600 p-5 rounded-2xl text-white">
                <h3 className="font-black mb-3">💡 꿀팁!</h3>
                <ul className="space-y-2 text-sm text-white/90">
                  <li>• <span className="font-bold">트렌드 추천</span>: 주제가 고민될 때 "AI 트렌드" 버튼 클릭!</li>
                  <li>• <span className="font-bold">SEO 제목</span>: 주제 입력 후 "SEO 제목 추천" 으로 상위노출 제목 받기</li>
                  <li>• <span className="font-bold">저장 기능</span>: 생성된 콘텐츠는 자동 저장. 새 생성 시 이전 저장 삭제됨</li>
                  <li>• <span className="font-bold">이미지 재생성</span>: 이미지 클릭 → 프롬프트 수정 → 재생성으로 원하는 이미지 완성!</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 이용약관 모달 */}
      {showTerms && <TermsPage onClose={() => setShowTerms(false)} />}

      {/* 개인정보처리방침 모달 */}
      {showPrivacy && <PrivacyPage onClose={() => setShowPrivacy(false)} />}

      {/* 결제 모달 */}
      <PaymentModal 
        isOpen={showPayment} 
        onClose={() => setShowPayment(false)}
        onSuccess={(credits) => {
          console.log(`${credits} 크레딧 충전 완료!`);
        }}
      />
    </div>
  );
};

export default LandingPage;
