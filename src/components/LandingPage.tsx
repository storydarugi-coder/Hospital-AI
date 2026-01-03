import React, { useState, useEffect } from 'react';

const LandingPage: React.FC = () => {
  const [scrollY, setScrollY] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  // 모바일 메뉴 열릴 때 스크롤 방지
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [mobileMenuOpen]);

  return (
    <div className="min-h-screen bg-white text-slate-900 overflow-x-hidden">
      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrollY > 50 ? 'bg-white/90 backdrop-blur-xl shadow-lg' : 'bg-transparent'}`}>
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white font-black text-xl">H</span>
            </div>
            <span className="font-black text-xl text-slate-800">Hospital<span className="text-emerald-600">AI</span></span>
          </div>
          {/* Desktop Menu */}
          <div className="hidden sm:flex items-center gap-4">
            <a href="#pricing" className="text-sm font-bold text-slate-600 hover:text-emerald-600 transition-colors">결제하기</a>
            <a href="#app" className="text-sm font-bold text-slate-600 hover:text-emerald-600 transition-colors">블로그 AI</a>
            <a href="#auth" className="text-sm font-bold text-slate-600 hover:text-emerald-600 transition-colors">로그인</a>
            <a href="#auth" className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-emerald-200 transition-all">
              회원가입
            </a>
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
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/20"
            onClick={() => setMobileMenuOpen(false)}
          ></div>
          
          {/* Menu Panel */}
          <div className="absolute top-0 left-0 right-0 bg-white shadow-2xl animate-slideDown">
            {/* Header */}
            <div className="flex items-center justify-between px-6 h-20 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white font-black text-xl">H</span>
                </div>
                <span className="font-black text-xl text-slate-800">Hospital<span className="text-emerald-600">AI</span></span>
              </div>
              <button 
                onClick={() => setMobileMenuOpen(false)}
                className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-slate-800"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Menu Items */}
            <div className="px-6 py-4">
              <a 
                href="#" 
                onClick={() => setMobileMenuOpen(false)}
                className="block py-4 text-lg font-bold text-slate-800 border-b border-slate-100"
              >
                홈
              </a>
              <a 
                href="#pricing" 
                onClick={() => setMobileMenuOpen(false)}
                className="block py-4 text-lg font-bold text-slate-800 border-b border-slate-100"
              >
                결제하기
              </a>
              <a 
                href="#app" 
                onClick={() => setMobileMenuOpen(false)}
                className="block py-4 text-lg font-bold text-slate-800 border-b border-slate-100"
              >
                블로그 AI
              </a>
              <a 
                href="#auth" 
                onClick={() => setMobileMenuOpen(false)}
                className="block py-4 text-lg font-bold text-slate-800 border-b border-slate-100"
              >
                로그인
              </a>
            </div>
            
            {/* CTA Button */}
            <div className="px-6 pb-6">
              <a 
                href="#auth" 
                onClick={() => setMobileMenuOpen(false)}
                className="block w-full py-4 text-center bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold text-lg rounded-xl"
              >
                회원가입
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-emerald-100/50 to-green-50/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-blue-100/40 to-cyan-50/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3"></div>
        
        <div className="max-w-6xl mx-auto relative">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-full border border-emerald-100 mb-8">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              <span className="text-sm font-bold text-emerald-700">2025 의료광고법 가이드라인 100% 준수</span>
            </div>

            {/* Main Title */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 leading-tight mb-6">
              병원 블로그 원고,<br/>
              <span className="bg-gradient-to-r from-emerald-600 to-green-500 bg-clip-text text-transparent">30초면 완성</span>
            </h1>

            <p className="text-lg sm:text-xl text-slate-500 font-medium mb-10 max-w-2xl mx-auto leading-relaxed">
              의료광고법 금칙어 자동 필터링 + AI 이미지 생성까지<br className="hidden sm:block"/>
              네이버 상위노출에 최적화된 병원 전용 AI 콘텐츠 생성기
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <a href="#app" className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-black text-lg rounded-2xl hover:shadow-2xl hover:shadow-emerald-200 transition-all hover:-translate-y-1">
                🚀 무료로 시작하기
              </a>
              <a href="#pricing" className="w-full sm:w-auto px-8 py-4 bg-slate-100 text-slate-700 font-bold text-lg rounded-2xl hover:bg-slate-200 transition-all flex items-center justify-center gap-2">
                💎 요금제 보기
              </a>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 sm:gap-8 max-w-2xl mx-auto">
              <div className="text-center p-4">
                <div className="text-3xl sm:text-4xl font-black text-emerald-600 mb-1">30<span className="text-xl">초</span></div>
                <div className="text-xs sm:text-sm text-slate-500 font-medium">원고 생성 시간</div>
              </div>
              <div className="text-center p-4 border-x border-slate-100">
                <div className="text-3xl sm:text-4xl font-black text-emerald-600 mb-1">100<span className="text-xl">%</span></div>
                <div className="text-xs sm:text-sm text-slate-500 font-medium">의료법 준수</div>
              </div>
              <div className="text-center p-4">
                <div className="text-3xl sm:text-4xl font-black text-emerald-600 mb-1">5<span className="text-xl">장</span></div>
                <div className="text-xs sm:text-sm text-slate-500 font-medium">AI 이미지 생성</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section id="process" className="py-20 px-6 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-4">간단한 3단계</h2>
            <p className="text-slate-500 font-medium">키워드 입력부터 완성까지, 단 30초</p>
          </div>

          {/* Process Steps */}
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/50 hover:shadow-2xl hover:shadow-emerald-100/50 transition-all group">
              <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl flex items-center justify-center text-white font-black text-xl mb-6 group-hover:scale-110 transition-transform">1</div>
              <h3 className="text-xl font-black text-slate-800 mb-3">키워드 입력</h3>
              <p className="text-slate-500 font-medium leading-relaxed">진료과 선택 후 원하는 키워드만 입력하세요. AI가 트렌드를 분석합니다.</p>
            </div>
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/50 hover:shadow-2xl hover:shadow-emerald-100/50 transition-all group">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-xl mb-6 group-hover:scale-110 transition-transform">2</div>
              <h3 className="text-xl font-black text-slate-800 mb-3">AI 원고 생성</h3>
              <p className="text-slate-500 font-medium leading-relaxed">의료광고법을 100% 준수하는 SEO 최적화 원고가 자동 생성됩니다.</p>
            </div>
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/50 hover:shadow-2xl hover:shadow-emerald-100/50 transition-all group">
              <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center text-white font-black text-xl mb-6 group-hover:scale-110 transition-transform">3</div>
              <h3 className="text-xl font-black text-slate-800 mb-3">이미지 자동 생성</h3>
              <p className="text-slate-500 font-medium leading-relaxed">글에 맞는 AI 이미지까지 자동 생성. 바로 블로그에 복사하세요.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full border border-blue-100 mb-6">
              <span className="text-sm font-bold text-blue-700">✨ 핵심 기능</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-4">왜 HospitalAI인가요?</h2>
            <p className="text-slate-500 font-medium max-w-xl mx-auto">병원 마케팅에 필요한 모든 것을 하나의 도구로</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature Cards */}
            <div className="bg-gradient-to-br from-red-50 to-orange-50 p-8 rounded-3xl border border-red-100 hover:shadow-xl transition-all">
              <div className="text-4xl mb-4">⚖️</div>
              <h3 className="text-xl font-black text-slate-800 mb-3">의료광고법 100% 준수</h3>
              <p className="text-slate-600 font-medium leading-relaxed">2025년 최신 가이드라인 기반, 금칙어/금지어 자동 필터링으로 안전한 콘텐츠만 생성</p>
            </div>

            <div className="bg-gradient-to-br from-emerald-50 to-green-50 p-8 rounded-3xl border border-emerald-100 hover:shadow-xl transition-all">
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="text-xl font-black text-slate-800 mb-3">네이버 SEO 최적화</h3>
              <p className="text-slate-600 font-medium leading-relaxed">스마트블록 상위 노출을 위한 키워드 분석과 제목 추천 기능</p>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-8 rounded-3xl border border-blue-100 hover:shadow-xl transition-all">
              <div className="text-4xl mb-4">🖼️</div>
              <h3 className="text-xl font-black text-slate-800 mb-3">AI 이미지 자동 생성</h3>
              <p className="text-slate-600 font-medium leading-relaxed">실사/일러스트 선택 가능, 글 내용에 맞는 고품질 이미지 자동 생성</p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-8 rounded-3xl border border-purple-100 hover:shadow-xl transition-all">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-xl font-black text-slate-800 mb-3">실시간 트렌드 분석</h3>
              <p className="text-slate-600 font-medium leading-relaxed">네이버 뉴스 기반 실시간 인기 키워드 분석으로 핫한 주제 선점</p>
            </div>

            <div className="bg-gradient-to-br from-amber-50 to-yellow-50 p-8 rounded-3xl border border-amber-100 hover:shadow-xl transition-all">
              <div className="text-4xl mb-4">🎨</div>
              <h3 className="text-xl font-black text-slate-800 mb-3">5가지 디자인 테마</h3>
              <p className="text-slate-600 font-medium leading-relaxed">모던, 프리미엄, 미니멀, 따뜻한, 의료전문 - 병원 분위기에 맞게 선택</p>
            </div>

            <div className="bg-gradient-to-br from-cyan-50 to-sky-50 p-8 rounded-3xl border border-cyan-100 hover:shadow-xl transition-all">
              <div className="text-4xl mb-4">📋</div>
              <h3 className="text-xl font-black text-slate-800 mb-3">원클릭 복사</h3>
              <p className="text-slate-600 font-medium leading-relaxed">생성된 콘텐츠를 티스토리, 네이버 블로그에 바로 붙여넣기</p>
            </div>
          </div>
        </div>
      </section>

      {/* Target Users Section */}
      <section className="py-20 px-6 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-4">이런 분들에게 필요해요</h2>
            <p className="text-slate-500 font-medium">병원 마케팅의 모든 분들을 위한 솔루션</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-lg hover:shadow-xl transition-all text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">👨‍⚕️</div>
              <h3 className="font-black text-slate-800 mb-2">병원 원장님</h3>
              <p className="text-sm text-slate-500 font-medium">의료법 걱정 없이 효과적인 홍보가 필요한 분</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-lg hover:shadow-xl transition-all text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">💼</div>
              <h3 className="font-black text-slate-800 mb-2">마케팅 담당자</h3>
              <p className="text-sm text-slate-500 font-medium">매일 새로운 콘텐츠를 안전하게 생산해야 하는 분</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-lg hover:shadow-xl transition-all text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">🏢</div>
              <h3 className="font-black text-slate-800 mb-2">의료 마케팅 대행사</h3>
              <p className="text-sm text-slate-500 font-medium">다수의 병원 블로그를 효율적으로 운영해야 하는 분</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-lg hover:shadow-xl transition-all text-center">
              <div className="w-16 h-16 bg-pink-100 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">✍️</div>
              <h3 className="font-black text-slate-800 mb-2">콘텐츠 작가</h3>
              <p className="text-sm text-slate-500 font-medium">전문성과 의료법 준수를 동시에 만족시켜야 하는 분</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-lg hover:shadow-xl transition-all text-center">
              <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">🆕</div>
              <h3 className="font-black text-slate-800 mb-2">개원 예정 의료진</h3>
              <p className="text-sm text-slate-500 font-medium">개원 준비 단계에서 마케팅이 필요한 분</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-lg hover:shadow-xl transition-all text-center">
              <div className="w-16 h-16 bg-cyan-100 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">🏥</div>
              <h3 className="font-black text-slate-800 mb-2">대형병원 홍보팀</h3>
              <p className="text-sm text-slate-500 font-medium">체계적이고 대량의 콘텐츠가 필요한 기관</p>
            </div>
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

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {/* Free Plan */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-lg hover:shadow-xl transition-all">
              <h3 className="text-xl font-black text-slate-800 mb-1">맛보기</h3>
              <p className="text-sm text-slate-400 mb-4">서비스 체험용</p>
              <div className="text-3xl font-black text-slate-900 mb-1">무료</div>
              <p className="text-sm text-emerald-600 font-medium mb-6">원고 3회 | 계정당 1회</p>
              <ul className="space-y-2 text-sm text-slate-600 mb-6">
                <li className="flex items-center gap-2"><span className="text-emerald-500">✓</span> AI 원고 생성</li>
                <li className="flex items-center gap-2"><span className="text-emerald-500">✓</span> AI 이미지 생성</li>
                <li className="flex items-center gap-2"><span className="text-emerald-500">✓</span> 5가지 테마</li>
              </ul>
              <a href="#auth" className="block w-full py-3 text-center bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all">
                무료 체험
              </a>
            </div>

            {/* Basic Plan */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-lg hover:shadow-xl transition-all">
              <h3 className="text-xl font-black text-slate-800 mb-1">베이직</h3>
              <p className="text-sm text-slate-400 mb-4">개인 블로거용</p>
              <div className="text-3xl font-black text-slate-900 mb-1">₩10,000</div>
              <p className="text-sm text-emerald-600 font-medium mb-6">원고 10회 | 3개월</p>
              <ul className="space-y-2 text-sm text-slate-600 mb-6">
                <li className="flex items-center gap-2"><span className="text-emerald-500">✓</span> 모든 무료 기능</li>
                <li className="flex items-center gap-2"><span className="text-emerald-500">✓</span> 카드뉴스 생성</li>
                <li className="flex items-center gap-2"><span className="text-slate-300">×</span> 이메일 지원</li>
              </ul>
              <a href="#pricing" className="block w-full py-3 text-center bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 transition-all">
                구매하기
              </a>
            </div>

            {/* Standard Plan - Popular */}
            <div className="bg-gradient-to-br from-emerald-500 to-green-600 p-6 rounded-2xl shadow-xl shadow-emerald-200 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-yellow-400 text-yellow-900 text-xs font-black rounded-full">인기</div>
              <h3 className="text-xl font-black text-white mb-1">스탠다드</h3>
              <p className="text-sm text-emerald-100 mb-4">소규모 병원용</p>
              <div className="text-3xl font-black text-white mb-1">₩19,900</div>
              <p className="text-sm text-emerald-200 font-medium mb-6">원고 20회 | 3개월</p>
              <ul className="space-y-2 text-sm text-white/90 mb-6">
                <li className="flex items-center gap-2"><span>✓</span> 모든 베이직 기능</li>
                <li className="flex items-center gap-2"><span>✓</span> 카드뉴스 생성</li>
                <li className="flex items-center gap-2"><span>✓</span> 이메일 지원</li>
              </ul>
              <a href="#pricing" className="block w-full py-3 text-center bg-white text-emerald-600 font-bold rounded-xl hover:bg-emerald-50 transition-all">
                구매하기
              </a>
            </div>

            {/* Premium Plan */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-lg hover:shadow-xl transition-all">
              <h3 className="text-xl font-black text-slate-800 mb-1">프리미엄</h3>
              <p className="text-sm text-slate-400 mb-4">대형 병원/대행사용</p>
              <div className="text-3xl font-black text-slate-900 mb-1">₩59,900</div>
              <p className="text-sm text-emerald-600 font-medium mb-6">무제한 | 월 구독</p>
              <ul className="space-y-2 text-sm text-slate-600 mb-6">
                <li className="flex items-center gap-2"><span className="text-emerald-500">✓</span> 모든 기능 무제한</li>
                <li className="flex items-center gap-2"><span className="text-emerald-500">✓</span> 우선 이메일 지원</li>
                <li className="flex items-center gap-2"><span className="text-emerald-500">✓</span> 전용 상담</li>
              </ul>
              <a href="#pricing" className="block w-full py-3 text-center bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-all">
                구독하기
              </a>
            </div>
          </div>

          {/* View Full Pricing */}
          <div className="text-center">
            <a href="#pricing" className="inline-flex items-center gap-2 px-6 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all">
              전체 요금제 보기 →
            </a>
          </div>

          {/* Cost Comparison */}
          <div className="mt-16 grid sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
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
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-6">
            지금 바로 시작하세요
          </h2>
          <p className="text-slate-400 font-medium mb-10 max-w-xl mx-auto">
            의료광고법 걱정 없이, 30초 만에 전문적인 병원 블로그 콘텐츠를 만들어보세요.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="#app" className="w-full sm:w-auto px-10 py-4 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-black text-lg rounded-2xl hover:shadow-2xl hover:shadow-emerald-500/30 transition-all">
              🚀 무료로 시작하기
            </a>
            <a href="#pricing" className="w-full sm:w-auto px-10 py-4 bg-white/10 text-white font-bold text-lg rounded-2xl hover:bg-white/20 transition-all border border-white/20">
              💎 요금제 보기
            </a>
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
              <a href="#features" className="hover:text-white transition-colors">기능</a>
              <a href="#pricing" className="hover:text-white transition-colors">요금제</a>
              <a href="#auth" className="hover:text-white transition-colors">로그인</a>
              <a href="#app" className="hover:text-white transition-colors">앱 실행</a>
              <a href="#terms" className="hover:text-white transition-colors">이용약관</a>
              <a href="#refund" className="hover:text-white transition-colors">환불정책</a>
            </div>
          </div>
          
          {/* 사업자 정보 - PG사 심사 필수 */}
          <div className="mt-8 pt-8 border-t border-slate-800">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 text-sm text-slate-400 mb-8">
              <div>
                <h4 className="font-bold text-white mb-2">사업자 정보</h4>
                <p>상호명: 미쁘다</p>
                <p>대표자: 이지안</p>
                <p>사업자등록번호: 677-45-01149</p>
                <p>업태: 도매 및 소매업 (전자상거래 소매업)</p>
                <p>간이과세자</p>
              </div>
              <div>
                <h4 className="font-bold text-white mb-2">연락처</h4>
                <p>이메일: story.darugi@gmail.com</p>
                <p>전화: 02-2224-9232</p>
                <p>사업장주소: 서울특별시 송파구 거마로 56, 116동 1709호 (거여동, 송파시그니처롯데캐슬)</p>
              </div>
              <div>
                <h4 className="font-bold text-white mb-2">서비스 안내</h4>
                <p>서비스 제공기간: 결제 즉시 ~ 이용권 기간 만료일</p>
                <p>베이직/스탠다드: 결제일로부터 90일</p>
                <p>프리미엄 월간: 결제일로부터 30일</p>
                <p>프리미엄 연간: 결제일로부터 365일</p>
              </div>
              <div>
                <h4 className="font-bold text-white mb-2">환불 규정</h4>
                <p>• 미사용 시: 결제 후 7일 이내 전액 환불</p>
                <p>• 사용 시: 잔여 이용권 수에 비례하여 환불</p>
                <p>• 프리미엄: 잔여 일수 비례 환불</p>
                <p>환불 문의: story.darugi@gmail.com</p>
              </div>
            </div>
            
            {/* 교환/환불 정책 상세 */}
            <div className="p-4 bg-slate-800/50 rounded-xl text-xs text-slate-500 mb-6">
              <p className="font-bold text-slate-400 mb-2">📋 교환/환불/취소 규정</p>
              <p>1. 디지털 콘텐츠 서비스 특성상 교환은 불가하며, 환불만 가능합니다.</p>
              <p>2. 결제 후 7일 이내, 서비스 미사용 시 전액 환불 가능합니다.</p>
              <p>3. 서비스 사용(원고 생성 1회 이상) 후에는 잔여 이용권 수에 비례하여 부분 환불됩니다.</p>
              <p>4. 프리미엄(월간/연간) 구독 상품은 잔여 일수에 비례하여 환불 금액이 산정됩니다.</p>
              <p>5. 환불 신청: story.darugi@gmail.com으로 [환불신청] 제목으로 메일 발송 (처리기간: 영업일 기준 3~5일)</p>
              <p>6. 쿠폰/프로모션으로 충전된 무료 이용권은 환불 대상에서 제외됩니다.</p>
            </div>
          </div>
          
          <div className="text-center text-sm text-slate-500">
            © 2025 HospitalAI. Made with ❤️ using AI Technology
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
