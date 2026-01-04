import React, { useState } from 'react';
import { CATEGORIES, TONES, PERSONAS } from '../constants';
import { GenerationRequest, ContentCategory, TrendingItem, SeoTitleItem, AudienceMode, ImageStyle, PostType, CssTheme, WritingStyle } from '../types';
import { getTrendingTopics, recommendSeoTitles } from '../services/geminiService';

interface InputFormProps {
  onSubmit: (data: GenerationRequest) => void;
  isLoading: boolean;
}

const InputForm: React.FC<InputFormProps> = ({ onSubmit, isLoading }) => {
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
  
  const [textLength, setTextLength] = useState<number>(2000);
  const [slideCount, setSlideCount] = useState<number>(6);
  const [imageCount, setImageCount] = useState<number>(3);
  const [writingStyle, setWritingStyle] = useState<WritingStyle>('empathy'); // 기본값: 공감형
  
  const [trendingItems, setTrendingItems] = useState<TrendingItem[]>([]);
  const [isLoadingTrends, setIsLoadingTrends] = useState(false);
  const [seoTitles, setSeoTitles] = useState<SeoTitleItem[]>([]);
  const [isLoadingTitles, setIsLoadingTitles] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    onSubmit({ 
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
      writingStyle
    });
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
        const titles = await recommendSeoTitles(topic, keywords);
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

      <div className="flex p-1 bg-slate-100 rounded-2xl mb-8">
        <button 
          type="button" 
          onClick={() => setPostType('blog')}
          className={`flex-1 py-3 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 ${postType === 'blog' ? 'bg-white text-emerald-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <span>📝</span> 블로그 포스팅
        </button>
        <button 
          type="button" 
          onClick={() => setPostType('card_news')}
          className={`flex-1 py-3 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 ${postType === 'card_news' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <span>💳</span> 카드뉴스 제작
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
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest">글자 수 목표</label>
                      <span className="text-xs font-bold text-emerald-600">{textLength}자</span>
                    </div>
                    <input 
                      type="range" 
                      min="1500" 
                      max="2500" 
                      step="100" 
                      value={textLength} 
                      onChange={(e) => setTextLength(parseInt(e.target.value))}
                      className="w-full accent-emerald-500 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between mt-1 text-[10px] text-slate-400 font-bold">
                       <span>1500자</span>
                       <span>2500자</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest">🖼️ AI 이미지 장수</label>
                      <span className="text-xs font-bold text-emerald-600">{imageCount}장</span>
                    </div>
                    <input 
                      type="range" 
                      min="1" 
                      max="5" 
                      step="1" 
                      value={imageCount} 
                      onChange={(e) => setImageCount(parseInt(e.target.value))}
                      className="w-full accent-emerald-500 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between mt-1 text-[10px] text-slate-400 font-bold">
                       <span>1장</span>
                       <span>5장</span>
                    </div>
                  </div>
               </div>
           ) : (
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
           )}
        </div>

        <div>
          <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 mb-4">
             <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="text-sm font-black text-emerald-700">🔍 인기 키워드</span>
                  <p className="text-[10px] text-emerald-600 font-medium mt-1">네이버 기사 및 뉴스 데이터 분석</p>
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
          <label className="block text-xs font-black text-slate-400 mb-2 uppercase tracking-widest">2단계. 블로그 제목</label>
          <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="블로그 글 제목을 입력하세요 (예: 겨울철 피부건조 원인과 해결법)" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold mb-3 focus:border-emerald-500 outline-none text-lg" required />
          <input type="text" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="SEO 키워드 (쉼표 구분, 예: 피부건조, 겨울철 피부관리, 보습)" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-medium mb-4 focus:border-emerald-500 outline-none" />
          
          <button type="button" onClick={handleRecommendTitles} disabled={isLoadingTitles || !topic} className="w-full py-3 bg-slate-900 text-white rounded-2xl text-xs font-black hover:bg-black transition-all">
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

        <div>
           <label className="block text-xs font-black text-slate-400 mb-2 uppercase tracking-widest">3단계. 이미지 스타일 선택</label>
           <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setImageStyle('photo')}
                className={`p-3 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-1.5 ${imageStyle === 'photo' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-100 bg-white text-slate-400 hover:border-slate-300'}`}
              >
                 <span className="text-xl">📸</span>
                 <span className="text-xs font-black">실사 촬영</span>
              </button>
              <button
                type="button"
                onClick={() => setImageStyle('illustration')}
                className={`p-3 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-1.5 ${imageStyle === 'illustration' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-100 bg-white text-slate-400 hover:border-slate-300'}`}
              >
                 <span className="text-xl">🎨</span>
                 <span className="text-xs font-black">3D 일러스트</span>
              </button>
              <button
                type="button"
                onClick={() => setImageStyle('medical')}
                className={`p-3 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-1.5 ${imageStyle === 'medical' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-slate-100 bg-white text-slate-400 hover:border-slate-300'}`}
              >
                 <span className="text-xl">🫀</span>
                 <span className="text-xs font-black">의학 3D</span>
              </button>
           </div>
        </div>

        {/* 글 스타일 선택 - 마케팅 핵심 설정 (가로 배치) */}
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-4 rounded-2xl border border-slate-200">
           <div className="flex items-center gap-4">
              <div className="shrink-0">
                 <label className="text-xs font-black text-slate-700">✍️ 글 스타일</label>
              </div>
              <div className="flex-1 flex gap-2">
                 <button
                   type="button"
                   onClick={() => setWritingStyle('expert')}
                   className={`flex-1 px-3 py-2 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${writingStyle === 'expert' ? 'border-blue-500 bg-white shadow-md' : 'border-slate-200 bg-white hover:border-slate-400'}`}
                 >
                    <span className="text-lg">📚</span>
                    <span className={`text-xs font-black ${writingStyle === 'expert' ? 'text-blue-700' : 'text-slate-600'}`}>전문가형</span>
                 </button>
                 <button
                   type="button"
                   onClick={() => setWritingStyle('empathy')}
                   className={`flex-1 px-3 py-2 rounded-xl border-2 transition-all flex items-center justify-center gap-2 relative ${writingStyle === 'empathy' ? 'border-pink-500 bg-white shadow-md' : 'border-slate-200 bg-white hover:border-slate-400'}`}
                 >
                    <div className="absolute -top-1.5 right-1 bg-pink-500 text-white text-[7px] font-black px-1 py-0.5 rounded">추천</div>
                    <span className="text-lg">💗</span>
                    <span className={`text-xs font-black ${writingStyle === 'empathy' ? 'text-pink-700' : 'text-slate-600'}`}>공감형</span>
                 </button>
                 <button
                   type="button"
                   onClick={() => setWritingStyle('conversion')}
                   className={`flex-1 px-3 py-2 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${writingStyle === 'conversion' ? 'border-amber-500 bg-white shadow-md' : 'border-slate-200 bg-white hover:border-slate-400'}`}
                 >
                    <span className="text-lg">🎯</span>
                    <span className={`text-xs font-black ${writingStyle === 'conversion' ? 'text-amber-700' : 'text-slate-600'}`}>전환형</span>
                 </button>
              </div>
           </div>
        </div>

        <div>
           <label className="block text-xs font-black text-slate-400 mb-2 uppercase tracking-widest">🎨 블로그 레이아웃</label>
           <div className="grid grid-cols-5 gap-2">
              <button
                type="button"
                onClick={() => setCssTheme('modern')}
                className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center justify-center text-center ${cssTheme === 'modern' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-100 bg-white hover:border-slate-300'}`}
              >
                 <span className="text-xl mb-1">💻</span>
                 <span className={`text-[11px] font-black ${cssTheme === 'modern' ? 'text-indigo-700' : 'text-slate-600'}`}>모던</span>
              </button>
              <button
                type="button"
                onClick={() => setCssTheme('premium')}
                className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center justify-center text-center ${cssTheme === 'premium' ? 'border-purple-500 bg-purple-50' : 'border-slate-100 bg-white hover:border-slate-300'}`}
              >
                 <span className="text-xl mb-1">💎</span>
                 <span className={`text-[11px] font-black ${cssTheme === 'premium' ? 'text-purple-700' : 'text-slate-600'}`}>프리미엄</span>
              </button>
              <button
                type="button"
                onClick={() => setCssTheme('minimal')}
                className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center justify-center text-center ${cssTheme === 'minimal' ? 'border-slate-500 bg-slate-50' : 'border-slate-100 bg-white hover:border-slate-300'}`}
              >
                 <span className="text-xl mb-1">✨</span>
                 <span className={`text-[11px] font-black ${cssTheme === 'minimal' ? 'text-slate-700' : 'text-slate-600'}`}>미니멀</span>
              </button>
              <button
                type="button"
                onClick={() => setCssTheme('warm')}
                className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center justify-center text-center ${cssTheme === 'warm' ? 'border-orange-500 bg-orange-50' : 'border-slate-100 bg-white hover:border-slate-300'}`}
              >
                 <span className="text-xl mb-1">☀️</span>
                 <span className={`text-[11px] font-black ${cssTheme === 'warm' ? 'text-orange-700' : 'text-slate-600'}`}>따뜻한</span>
              </button>
              <button
                type="button"
                onClick={() => setCssTheme('professional')}
                className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center justify-center text-center ${cssTheme === 'professional' ? 'border-blue-500 bg-blue-50' : 'border-slate-100 bg-white hover:border-slate-300'}`}
              >
                 <span className="text-xl mb-1">🏛️</span>
                 <span className={`text-[11px] font-black ${cssTheme === 'professional' ? 'text-blue-700' : 'text-slate-600'}`}>전문</span>
              </button>
           </div>
        </div>

        <div className="border-t border-slate-100 pt-6 mt-2">
          <label className="block text-xs font-black text-slate-400 mb-2 uppercase tracking-widest flex justify-between">
             4단계. 스타일 설정 (선택사항)
             <span className="text-emerald-600 font-bold">벤치마킹 URL 입력 시 자동 적용</span>
          </label>
          
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
               <span className="text-lg">🔗</span>
               <span className="text-sm font-bold text-slate-700">경쟁사/우수 블로그 스타일 벤치마킹</span>
            </div>
            <input 
              type="url" 
              value={referenceUrl} 
              onChange={(e) => setReferenceUrl(e.target.value)}
              placeholder={postType === 'card_news' ? "참고할 카드뉴스(인스타/블로그) URL 입력 (구성 모방)" : "따라하고 싶은 네이버 블로그 URL을 입력하세요 (말투/로직 복사)"}
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-medium focus:border-emerald-500 outline-none text-sm"
            />
            {referenceUrl && <p className="text-[11px] text-emerald-600 mt-2 font-bold px-2">✅ URL이 입력되었습니다. {postType === 'card_news' ? '해당 카드뉴스 템플릿의 논리 구조와 전개 방식을 분석하여 적용합니다.' : '기존 페르소나 설정 대신 해당 블로그의 말투와 논리를 모방합니다.'}</p>}
          </div>

          {!referenceUrl && (
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

        <button
          type="submit"
          disabled={isLoading || !topic.trim()}
          className={`w-full py-5 rounded-2xl text-white font-black text-lg shadow-2xl transition-all active:scale-95 ${isLoading ? 'bg-slate-400' : postType === 'blog' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {isLoading ? '생성 중...' : postType === 'blog' ? '병원 블로그 원고 생성 🚀' : '병원 카드뉴스 제작 🚀'}
        </button>
      </form>
    </div>
  );
};

export default InputForm;
