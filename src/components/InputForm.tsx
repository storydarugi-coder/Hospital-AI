import React, { useState, useEffect } from 'react';
import { CATEGORIES, TONES, PERSONAS } from '../constants';
import { GenerationRequest, ContentCategory, TrendingItem, SeoTitleItem, AudienceMode, ImageStyle, PostType, CssTheme, WritingStyle } from '../types';
import { getTrendingTopics, recommendSeoTitles } from '../services/geminiService';
import WritingStyleLearner from './WritingStyleLearner';

// localStorage 키
const CUSTOM_PROMPT_KEY = 'hospital_custom_image_prompt';

interface InputFormProps {
  onSubmit: (data: GenerationRequest) => void;
  isLoading: boolean;
  onTabChange?: (tab: 'blog' | 'similarity' | 'refine' | 'card_news' | 'press') => void;
  currentTab?: 'blog' | 'similarity' | 'refine' | 'card_news' | 'press';
}

const InputForm: React.FC<InputFormProps> = ({ onSubmit, isLoading, onTabChange, currentTab = 'blog' }) => {
  const [postType, setPostType] = useState<PostType>('blog');
  const [category, setCategory] = useState<ContentCategory>(CATEGORIES[0].value);
  const [audienceMode, setAudienceMode] = useState<AudienceMode>('환자용(친절/공감)');
  const [persona, setPersona] = useState(PERSONAS[0].value);
  const [tone, setTone] = useState(TONES[0].value);
  const [imageStyle, setImageStyle] = useState<ImageStyle>('photo');
  const [cssTheme, setCssTheme] = useState<CssTheme>('modern');
  const [topic, setTopic] = useState('');
  const [keywords, setKeywords] = useState('');
  const [referenceUrl, setReferenceUrl] = useState('');
  
  // 커스텀 이미지 프롬프트
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  
  // localStorage에서 저장된 커스텀 프롬프트 불러오기
  useEffect(() => {
    const saved = localStorage.getItem(CUSTOM_PROMPT_KEY);
    if (saved) {
      setCustomPrompt(saved);
      // UI는 imageStyle === 'custom'일 때만 보여주므로 여기서 setShowCustomInput 안 함
    }
  }, []);
  
  const [textLength, setTextLength] = useState<number>(2000);
  const [slideCount, setSlideCount] = useState<number>(6);
  const [imageCount, setImageCount] = useState<number>(0); // 기본값 0장
  const [writingStyle, setWritingStyle] = useState<WritingStyle>('empathy'); // 기본값: 공감형
  
  // 말투 학습 스타일
  const [learnedStyleId, setLearnedStyleId] = useState<string | undefined>(undefined);
  
  // 🗞️ 보도자료용 state
  const [hospitalName, setHospitalName] = useState<string>('');
  const [hospitalWebsite, setHospitalWebsite] = useState<string>('');
  const [doctorName, setDoctorName] = useState<string>('');
  const [doctorTitle, setDoctorTitle] = useState<string>('원장');
  const [pressType, setPressType] = useState<'achievement' | 'new_service' | 'research' | 'event' | 'award' | 'health_tips'>('achievement');
  
  // 커스텀 소제목
  const [customSubheadings, setCustomSubheadings] = useState<string>('');
  
  const [trendingItems, setTrendingItems] = useState<TrendingItem[]>([]);
  const [isLoadingTrends, setIsLoadingTrends] = useState(false);
  const [seoTitles, setSeoTitles] = useState<SeoTitleItem[]>([]);
  const [isLoadingTitles, setIsLoadingTitles] = useState(false);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🔵 Form Submit 시작');
    console.log('  - topic:', topic);
    console.log('  - postType:', postType, '(type:', typeof postType, ')');
    console.log('  - category:', category);
    
    if (!topic.trim()) {
      console.warn('⚠️ topic이 비어있어 중단');
      return;
    }
    
    const requestData = { 
      category, 
      topic, 
      keywords, 
      tone, 
      audienceMode, 
      persona, 
      imageStyle, 
      cssTheme,
      referenceUrl, 
      postType,
      textLength,
      slideCount,
      imageCount,
      writingStyle,
      // 🎨 커스텀 스타일 선택 시에만 커스텀 프롬프트 전달!
      customImagePrompt: (() => {
        const result = imageStyle === 'custom' ? (customPrompt?.trim() || undefined) : undefined;
        console.log('📤 InputForm 전송 - imageStyle:', imageStyle, ', customPrompt:', customPrompt?.substring(0, 30), ', 전달값:', result?.substring(0, 30));
        return result;
      })(),
      // 📝 학습된 말투 스타일 ID
      learnedStyleId,
      // 📋 커스텀 소제목
      customSubheadings: customSubheadings.trim() || undefined,
      // 🗞️ 보도자료용 필드
      hospitalName: postType === 'press_release' ? hospitalName : undefined,
      hospitalWebsite: postType === 'press_release' ? hospitalWebsite : undefined,
      doctorName: postType === 'press_release' ? doctorName : undefined,
      doctorTitle: postType === 'press_release' ? doctorTitle : undefined,
      pressType: postType === 'press_release' ? pressType : undefined,
    };
    
    console.log('📦 전송할 requestData:', JSON.stringify(requestData, null, 2));
    console.log('✅ onSubmit 호출');
    onSubmit(requestData);
  };

  const handleRecommendTrends = async () => {
    setIsLoadingTrends(true);
    setTrendingItems([]);
    try {
      const items = await getTrendingTopics(category);
      setTrendingItems(items);
    } catch (e) {
      alert("트렌드 로딩 실패");
    } finally {
      setIsLoadingTrends(false);
    }
  };

  const handleRecommendTitles = async () => {
    if (!topic || !keywords) return;
    setIsLoadingTitles(true);
    setSeoTitles([]);
    try {
        // postType에 따라 블로그/카드뉴스용 제목 추천
        // press_release는 blog로 처리
        const titles = await recommendSeoTitles(topic, keywords, postType === 'press_release' ? 'blog' : postType);
        const sortedTitles = titles.sort((a, b) => b.score - a.score);
        setSeoTitles(sortedTitles);
    } catch (e) {
        alert("제목 추천 실패");
    } finally {
        setIsLoadingTitles(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-2xl p-8 border border-slate-100">
      <h2 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-3">
        <span className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center text-white text-xl shadow-lg shadow-emerald-200">H</span> 
        Hospital<span className="text-emerald-600">AI</span>
      </h2>

      {/* 탭 메뉴 - 2줄 그리드 */}
      <div className="grid grid-cols-3 p-1 bg-slate-100 rounded-2xl mb-8 gap-1">
        <button 
          type="button" 
          onClick={() => {
            setPostType('blog');
            onTabChange?.('blog');
          }}
          className={`py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 ${(postType === 'blog' || currentTab === 'blog') ? 'bg-white text-emerald-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <span>📝</span> 블로그
        </button>
        <button 
          type="button" 
          onClick={() => onTabChange?.('similarity')}
          className={`py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 ${currentTab === 'similarity' ? 'bg-white text-purple-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <span>🔍</span> 유사도
        </button>
        <button 
          type="button" 
          onClick={() => onTabChange?.('refine')}
          className={`py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 ${currentTab === 'refine' ? 'bg-white text-rose-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <span>✨</span> AI보정
        </button>
        <button 
          type="button" 
          onClick={() => {
            setPostType('card_news');
            onTabChange?.('card_news');
          }}
          className={`py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 ${(postType === 'card_news' || currentTab === 'card_news') ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <span>🖼️</span> 카드뉴스
        </button>
        <button 
          type="button" 
          onClick={() => {
            setPostType('press_release');
            onTabChange?.('press');
          }}
          className={`py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 ${(postType === 'press_release' || currentTab === 'press') ? 'bg-white text-purple-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <span>🗞️</span> 보도자료
        </button>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-black text-slate-400 mb-2 uppercase tracking-widest">진료과 선택</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ContentCategory)}
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:border-emerald-500"
              disabled={isLoading}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-black text-slate-400 mb-2 uppercase tracking-widest">청중 모드</label>
            <select
              value={audienceMode}
              onChange={(e) => setAudienceMode(e.target.value as AudienceMode)}
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:border-emerald-500"
              disabled={isLoading}
            >
              <option value="환자용(친절/공감)">환자용 (친절/공감)</option>
              <option value="전문가용(신뢰/정보)">전문가용 (신뢰/정보)</option>
            </select>
          </div>
        </div>

        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
           {postType === 'blog' ? (
               <div className="space-y-4">
                  {/* 병원 홈페이지 URL 입력란 */}
                  <div>
                    <label className="block text-xs font-black text-slate-400 mb-1.5 uppercase tracking-widest">
                      🏥 병원 홈페이지 (선택)
                      <span className="text-xs font-normal text-slate-500 ml-2">소제목에 "병원 소개" 입력 시 자동 크롤링</span>
                    </label>
                    <input 
                      type="url"
                      value={referenceUrl}
                      onChange={(e) => setReferenceUrl(e.target.value)}
                      placeholder="예: https://www.hospital.com"
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500 text-sm"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest">글자 수 목표</label>
                      <span className="text-xs font-bold text-emerald-600">{textLength}자</span>
                    </div>
                    <input 
                      type="range" 
                      min="1500" 
                      max="3500" 
                      step="100" 
                      value={textLength} 
                      onChange={(e) => setTextLength(parseInt(e.target.value))}
                      className="w-full accent-emerald-500 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between mt-1 text-[10px] text-slate-400 font-bold">
                       <span>1500자</span>
                       <span>2500자</span>
                       <span>3500자</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest">🖼️ AI 이미지 장수</label>
                      <span className={`text-xs font-bold ${imageCount === 0 ? 'text-slate-400' : 'text-emerald-600'}`}>
                        {imageCount === 0 ? '없음' : `${imageCount}장`}
                      </span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="5" 
                      step="1" 
                      value={imageCount} 
                      onChange={(e) => setImageCount(parseInt(e.target.value))}
                      className="w-full accent-emerald-500 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between mt-1 text-[10px] text-slate-400 font-bold">
                       <span>0장</span>
                       <span>5장</span>
                    </div>
                  </div>
               </div>
           ) : postType === 'card_news' ? (
               <div className="space-y-4">
                  {/* 카드뉴스 장수 슬라이더 */}
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest">카드뉴스 장수</label>
                      <span className="text-xs font-bold text-blue-600">{slideCount}장</span>
                    </div>
                    <input 
                      type="range" 
                      min="4" 
                      max="10" 
                      step="1" 
                      value={slideCount} 
                      onChange={(e) => setSlideCount(parseInt(e.target.value))}
                      className="w-full accent-blue-500 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between mt-1 text-[10px] text-slate-400 font-bold">
                       <span>4장</span>
                       <span>10장</span>
                    </div>
                  </div>
               </div>
           ) : postType === 'press_release' ? (
               /* 🗞️ 보도자료 설정 UI */
               <div className="space-y-4">
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 mb-2">
                    <p className="text-xs text-purple-700 font-bold flex items-center gap-1">
                      <span>⚠️</span> 본 보도자료는 홍보 목적의 자료이며, 의학적 조언이나 언론 보도로 사용될 경우 법적 책임은 사용자에게 있습니다.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-black text-slate-400 mb-1.5 uppercase tracking-widest">병원명</label>
                      <input 
                        type="text"
                        value={hospitalName}
                        onChange={(e) => setHospitalName(e.target.value)}
                        placeholder="예: 서울OO병원"
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-purple-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-400 mb-1.5 uppercase tracking-widest">의료진</label>
                      <input 
                        type="text"
                        value={doctorName}
                        onChange={(e) => setDoctorName(e.target.value)}
                        placeholder="예: 홍길동"
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-purple-500 text-sm"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-black text-slate-400 mb-1.5 uppercase tracking-widest">
                      병원 웹사이트 (선택)
                      <span className="text-xs font-normal text-slate-500 ml-2">병원 정보를 자동으로 분석합니다</span>
                    </label>
                    <input 
                      type="url"
                      value={hospitalWebsite}
                      onChange={(e) => setHospitalWebsite(e.target.value)}
                      placeholder="예: https://www.hospital.com"
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-purple-500 text-sm"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-black text-slate-400 mb-1.5 uppercase tracking-widest">직함</label>
                    <select
                      value={doctorTitle}
                      onChange={(e) => setDoctorTitle(e.target.value)}
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-purple-500 text-sm"
                    >
                      <option value="원장">원장</option>
                      <option value="부원장">부원장</option>
                      <option value="과장">과장</option>
                      <option value="교수">교수</option>
                      <option value="부교수">부교수</option>
                      <option value="전문의">전문의</option>
                      <option value="센터장">센터장</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-black text-slate-400 mb-2 uppercase tracking-widest">보도 유형</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: 'achievement', label: '🏆 실적/달성', desc: '수술 N례 달성' },
                        { value: 'new_service', label: '🆕 신규 도입', desc: '장비/서비스 도입' },
                        { value: 'research', label: '📚 연구/학술', desc: '논문/학회 발표' },
                        { value: 'event', label: '🎉 행사/이벤트', desc: '개소식/캠페인' },
                        { value: 'award', label: '🎖️ 수상/인증', desc: '수상/인증 획득' },
                        { value: 'health_tips', label: '💡 건강 조언', desc: '질환 예방/관리 팁' },
                      ].map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => setPressType(item.value as typeof pressType)}
                          className={`p-3 rounded-xl text-left transition-all ${
                            pressType === item.value 
                              ? 'bg-purple-100 border-2 border-purple-500' 
                              : 'bg-white border border-slate-200 hover:border-purple-300'
                          }`}
                        >
                          <div className="font-bold text-sm text-slate-700">{item.label}</div>
                          <div className="text-[10px] text-slate-400">{item.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest">최대 글자 수</label>
                      <span className="text-xs font-bold text-purple-600">{textLength}자</span>
                    </div>
                    <input 
                      type="range" 
                      min="800" 
                      max="2000" 
                      step="200" 
                      value={textLength} 
                      onChange={(e) => setTextLength(parseInt(e.target.value))}
                      className="w-full accent-purple-500 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between mt-1 text-[10px] text-slate-400 font-bold">
                       <span>800자 (짧게)</span>
                       <span>1400자</span>
                       <span>2000자 (상세)</span>
                    </div>
                  </div>
               </div>
           ) : null}
        </div>

        <div>
          <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 mb-4">
             <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="text-sm font-black text-emerald-700">🔍 인기 키워드</span>
                  <p className="text-[10px] text-emerald-600 font-medium mt-1">AI 트렌드 키워드 분석</p>
                </div>
                <button type="button" onClick={handleRecommendTrends} disabled={isLoadingTrends} className="text-xs font-black text-white bg-emerald-600 px-4 py-2.5 rounded-xl hover:bg-emerald-700 shadow-md transition-all active:scale-95 whitespace-nowrap">
                  {isLoadingTrends ? '분석 중...' : '키워드 찾기'}
                </button>
             </div>
          </div>
          {trendingItems.length > 0 && (
            <div className="grid grid-cols-1 gap-2 mb-4 animate-fadeIn">
              {trendingItems.map((item, idx) => (
                <button key={idx} type="button" onClick={() => { setTopic(item.topic); setKeywords(item.keywords); }} className="text-left p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-emerald-500 transition-all hover:shadow-md group relative overflow-hidden">
                   <div className="absolute top-0 right-0 bg-slate-100 px-3 py-1 rounded-bl-2xl text-[10px] font-black text-slate-500">
                      SEO 점수 <span className="text-emerald-600 text-sm">{item.score}</span>
                   </div>
                  <div className="flex flex-col gap-1 pr-16">
                    <span className="font-bold text-slate-800 group-hover:text-emerald-700 text-lg">{item.topic}</span>
                    <p className="text-[11px] text-slate-400 truncate font-medium">키워드: {item.keywords}</p>
                    <p className="text-[11px] text-blue-600 bg-blue-50 inline-block px-2 py-1 rounded-md mt-1 font-bold w-fit">💡 {item.seasonal_factor}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-black text-slate-400 mb-2 uppercase tracking-widest">
            2단계. {postType === 'press_release' ? '기사 제목' : '블로그 제목'}
          </label>
          <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={postType === 'press_release' ? '기사 주제를 입력하세요 (예: 겨울철 피부건조 주의보)' : '블로그 글 제목을 입력하세요 (예: 겨울철 피부건조 원인과 해결법)'} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold mb-3 focus:border-emerald-500 outline-none text-lg" required />
          <input type="text" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="SEO 키워드 (쉼표 구분, 예: 피부건조, 겨울철 피부관리, 보습)" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-medium mb-4 focus:border-emerald-500 outline-none" />
          
          {/* 소제목 직접 입력 영역 */}
          <div className="mt-4 p-4 bg-blue-50 rounded-2xl border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-black text-blue-700">📝 소제목 직접 입력 (선택사항)</label>
              <span className="text-[10px] text-blue-600 font-medium">한 줄에 하나씩 입력</span>
            </div>
            <textarea
              value={customSubheadings}
              onChange={(e) => setCustomSubheadings(e.target.value)}
              placeholder={"소제목을 한 줄에 하나씩 입력하세요\n예:\n무릎 통증의 주요 원인\n통증을 줄이는 생활 습관\n병원 방문이 필요한 시점"}
              className="w-full p-3 bg-white border border-blue-200 rounded-xl text-sm font-medium focus:border-blue-400 outline-none resize-none"
              rows={5}
            />
            <p className="text-[10px] text-blue-600 mt-2">
              💡 소제목을 직접 입력하면 AI가 그대로 사용하여 문단을 작성합니다. 입력하지 않으면 AI가 자동으로 소제목을 생성합니다.
            </p>
          </div>
          
          <button type="button" onClick={handleRecommendTitles} disabled={isLoadingTitles || !topic} className="w-full py-3 bg-slate-900 text-white rounded-2xl text-xs font-black hover:bg-black transition-all mt-4">
            {isLoadingTitles ? '생성 중...' : '🎯 AI 제목 추천받기'}
          </button>
          
          {seoTitles.length > 0 && (
            <div className="mt-4 space-y-2">
              {seoTitles.map((item, idx) => (
                <button key={idx} type="button" onClick={() => setTopic(item.title)} className="w-full text-left p-4 bg-white border border-slate-100 rounded-2xl hover:bg-emerald-50 transition-all group shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-emerald-50 px-2 py-1 rounded-bl-xl text-[10px] font-black text-emerald-700 border-b border-l border-emerald-100">
                    SEO {item.score}점
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase mb-1 block">{item.type} 특화형</span>
                  <span className="text-sm font-bold text-slate-700 group-hover:text-emerald-700 block pr-8">{item.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 이미지 스타일 선택 - 보도자료는 이미지 없으므로 숨김 */}
        {postType !== 'press_release' && (
        <div>
           <label className="block text-xs font-black text-slate-400 mb-2 uppercase tracking-widest">3단계. 이미지 스타일 선택</label>
           <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setImageStyle('photo'); setShowCustomInput(false); }}
                className={`p-3 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-1.5 ${imageStyle === 'photo' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-100 bg-white text-slate-400 hover:border-slate-300'}`}
              >
                 <span className="text-xl">📸</span>
                 <span className="text-xs font-black leading-tight">실사<br/>촬영</span>
              </button>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setImageStyle('illustration'); setShowCustomInput(false); }}
                className={`p-3 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-1.5 ${imageStyle === 'illustration' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-100 bg-white text-slate-400 hover:border-slate-300'}`}
              >
                 <span className="text-xl">🎨</span>
                 <span className="text-xs font-black leading-tight">3D<br/>일러스트</span>
              </button>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setImageStyle('medical'); setShowCustomInput(false); }}
                className={`p-3 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-1.5 ${imageStyle === 'medical' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-slate-100 bg-white text-slate-400 hover:border-slate-300'}`}
              >
                 <span className="text-xl">🫀</span>
                 <span className="text-xs font-black leading-tight">의학<br/>3D</span>
              </button>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setImageStyle('custom'); setShowCustomInput(true); }}
                className={`p-3 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-1.5 ${imageStyle === 'custom' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-100 bg-white text-slate-400 hover:border-slate-300'}`}
              >
                 <span className="text-xl">✏️</span>
                 <span className="text-xs font-black">커스텀</span>
              </button>
           </div>
           
           {/* 커스텀 프롬프트 입력 영역 - 커스텀 스타일 선택 시에만 표시 */}
           {showCustomInput && imageStyle === 'custom' && (
             <div className="mt-3 p-4 bg-orange-50 rounded-2xl border border-orange-200 animate-fadeIn">
               <div className="flex items-center justify-between mb-2">
                 <label className="text-xs font-black text-orange-700">✨ 나만의 이미지 스타일 프롬프트</label>
                 {customPrompt && (
                   <button
                     type="button"
                     onClick={() => {
                       localStorage.setItem(CUSTOM_PROMPT_KEY, customPrompt);
                       alert('✅ 프롬프트가 저장되었습니다! 다음에도 사용할 수 있어요.');
                     }}
                     className="px-3 py-1 bg-orange-500 text-white text-[10px] font-bold rounded-lg hover:bg-orange-600 transition-all"
                   >
                     💾 저장
                   </button>
                 )}
               </div>
               <textarea
                 value={customPrompt}
                 onChange={(e) => setCustomPrompt(e.target.value)}
                 placeholder="예: 따뜻한 파스텔톤, 손그림 느낌의 일러스트, 부드러운 선, 귀여운 캐릭터 스타일..."
                 className="w-full p-3 bg-white border border-orange-200 rounded-xl text-sm font-medium focus:border-orange-400 outline-none resize-none"
                 rows={3}
               />
               <p className="text-[10px] text-orange-600 mt-2">
                 💡 원하는 이미지 스타일을 자유롭게 입력하세요. 저장하면 다음에도 사용할 수 있어요!
               </p>
             </div>
           )}
        </div>
        )}


        {/* 4단계: 블로그만 스타일 설정 표시 (보도자료/카드뉴스는 숨김) */}
        {postType === 'blog' && (
          <div className="border-t border-slate-100 pt-6 mt-2 space-y-6">
            <label className="block text-xs font-black text-slate-400 mb-2 uppercase tracking-widest flex justify-between">
               4단계. 스타일 설정 (선택사항)
               <span className="text-emerald-600 font-bold">말투 학습으로 나만의 스타일 적용</span>
            </label>
            
            {/* 말투/문체 학습 섹션 */}
            <WritingStyleLearner
              onStyleSelect={(styleId) => {
                setLearnedStyleId(styleId);
              }}
              selectedStyleId={learnedStyleId}
              contentType="blog"
            />

            {/* 학습된 말투가 없을 때만 기본 페르소나/말투 선택 표시 */}
            {!learnedStyleId && (
              <div className="grid grid-cols-2 gap-4 animate-fadeIn">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-2">페르소나 직접 선택</label>
                  <select value={persona} onChange={(e) => setPersona(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:border-emerald-500">
                    {PERSONAS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-2">말투 직접 선택</label>
                  <select value={tone} onChange={(e) => setTone(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:border-emerald-500">
                    {TONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || !topic.trim()}
          className={`w-full py-5 rounded-2xl text-white font-black text-lg shadow-2xl transition-all active:scale-95 ${isLoading ? 'bg-slate-400' : postType === 'blog' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {isLoading ? '생성 중...' : postType === 'blog' ? '병원 블로그 원고 생성 🚀' : postType === 'press_release' ? '병원 보도자료 작성 🗞️' : '병원 카드뉴스 제작 🚀'}
        </button>
      </form>
    </div>
  );
};

// 🚀 성능 개선: React.memo로 불필요한 리렌더 방지
export default React.memo(InputForm);
