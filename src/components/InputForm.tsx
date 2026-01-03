import React, { useState } from 'react';
import { CATEGORIES, TONES, PERSONAS } from '../constants';
import { GenerationRequest, ContentCategory, TrendingItem, SeoTitleItem, AudienceMode, ImageStyle, PostType, CssTheme } from '../types';
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
      slideCount
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
        <span className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center text-white text-xl shadow-lg shadow-green-200">N</span> 
        Hospital Toolchain
      </h2>

      <div className="flex p-1 bg-slate-100 rounded-2xl mb-8">
        <button 
          type="button" 
          onClick={() => setPostType('blog')}
          className={`flex-1 py-3 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 ${postType === 'blog' ? 'bg-white text-green-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
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
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:border-green-500"
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
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:border-green-500"
              disabled={isLoading}
            >
              <option value="환자용(친절/공감)">환자용 (친절/공감)</option>
              <option value="전문가용(신뢰/정보)">전문가용 (신뢰/정보)</option>
            </select>
          </div>
        </div>

        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
           {postType === 'blog' ? (
               <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">글자 수 목표</label>
                    <span className="text-xs font-bold text-green-600">{textLength}자</span>
                  </div>
                  <input 
                    type="range" 
                    min="1500" 
                    max="2500" 
                    step="100" 
                    value={textLength} 
                    onChange={(e) => setTextLength(parseInt(e.target.value))}
                    className="w-full accent-green-500 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between mt-1 text-[10px] text-slate-400 font-bold">
                     <span>1500자</span>
                     <span>2500자</span>
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
          <div className="flex justify-between items-center mb-4 bg-green-50 p-4 rounded-2xl border border-green-100">
             <div className="flex flex-col">
                <label className="text-xs font-black text-green-800 uppercase tracking-widest mb-1">Naver Data Analysis</label>
                <span className="text-[10px] text-green-600 font-bold">네이버 뉴스/기사 기반 트렌드 분석</span>
             </div>
             <button type="button" onClick={handleRecommendTrends} disabled={isLoadingTrends} className="text-xs font-black text-white bg-green-600 px-4 py-2 rounded-xl hover:bg-green-700 shadow-md transition-all active:scale-95 flex items-center gap-2">
               {isLoadingTrends ? '데이터 분석 중...' : '🔍 실시간 인기 키워드 찾기'}
             </button>
          </div>
          {trendingItems.length > 0 && (
            <div className="grid grid-cols-1 gap-2 mb-4 animate-fadeIn">
              {trendingItems.map((item, idx) => (
                <button key={idx} type="button" onClick={() => { setTopic(item.topic); setKeywords(item.keywords); }} className="text-left p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-green-500 transition-all hover:shadow-md group relative overflow-hidden">
                   <div className="absolute top-0 right-0 bg-slate-100 px-3 py-1 rounded-bl-2xl text-[10px] font-black text-slate-500">
                      SEO 점수 <span className="text-green-600 text-sm">{item.score}</span>
                   </div>
                  <div className="flex flex-col gap-1 pr-16">
                    <span className="font-bold text-slate-800 group-hover:text-green-700 text-lg">{item.topic}</span>
                    <p className="text-[11px] text-slate-400 truncate font-medium">키워드: {item.keywords}</p>
                    <p className="text-[11px] text-blue-600 bg-blue-50 inline-block px-2 py-1 rounded-md mt-1 font-bold w-fit">💡 {item.seasonal_factor}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-black text-slate-400 mb-2 uppercase tracking-widest">2단계. 제목 및 키워드</label>
          <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="직접 주제를 입력하거나 위에서 핫토픽을 선택하세요" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold mb-3 focus:border-green-500 outline-none" required />
          <input type="text" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="핵심 키워드 (쉼표 구분)" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-medium mb-4 focus:border-green-500 outline-none" />
          
          <button type="button" onClick={handleRecommendTitles} disabled={isLoadingTitles || !topic} className="w-full py-3 bg-slate-900 text-white rounded-2xl text-xs font-black hover:bg-black transition-all">
            {isLoadingTitles ? '생성 중...' : '🎯 스마트블록 상위 노출용 제목 추천'}
          </button>
          
          {seoTitles.length > 0 && (
            <div className="mt-4 space-y-2">
              {seoTitles.map((item, idx) => (
                <button key={idx} type="button" onClick={() => setTopic(item.title)} className="w-full text-left p-4 bg-white border border-slate-100 rounded-2xl hover:bg-green-50 transition-all group shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-green-50 px-2 py-1 rounded-bl-xl text-[10px] font-black text-green-700 border-b border-l border-green-100">
                    SEO {item.score}점
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase mb-1 block">{item.type} 특화형</span>
                  <span className="text-sm font-bold text-slate-700 group-hover:text-green-700 block pr-8">{item.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
           <label className="block text-xs font-black text-slate-400 mb-2 uppercase tracking-widest">3단계. 이미지 스타일 선택</label>
           <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setImageStyle('photo')}
                className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2 ${imageStyle === 'photo' ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-100 bg-white text-slate-400 hover:border-slate-300'}`}
              >
                 <span className="text-2xl">📸</span>
                 <span className="text-sm font-black">실사 촬영</span>
              </button>
              <button
                type="button"
                onClick={() => setImageStyle('illustration')}
                className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2 ${imageStyle === 'illustration' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-100 bg-white text-slate-400 hover:border-slate-300'}`}
              >
                 <span className="text-2xl">🎨</span>
                 <span className="text-sm font-black">3D 일러스트</span>
              </button>
           </div>
        </div>

        <div>
           <label className="block text-xs font-black text-slate-400 mb-2 uppercase tracking-widest">🎨 블로그 레이아웃 스타일</label>
           <p className="text-[11px] text-slate-500 mb-3 font-medium">병원별로 다른 박스/테두리/간격 스타일을 선택하세요</p>
           <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setCssTheme('modern')}
                className={`p-4 rounded-2xl border-2 transition-all text-left ${cssTheme === 'modern' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-100 bg-white hover:border-slate-300'}`}
              >
                 <div className="flex items-center gap-2 mb-2">
                   <span className="text-xl">💻</span>
                   <span className={`text-sm font-black ${cssTheme === 'modern' ? 'text-indigo-700' : 'text-slate-600'}`}>모던 카드</span>
                 </div>
                 <p className="text-[10px] text-slate-500 font-medium">카드형 박스 + 그림자 효과</p>
              </button>
              <button
                type="button"
                onClick={() => setCssTheme('premium')}
                className={`p-4 rounded-2xl border-2 transition-all text-left ${cssTheme === 'premium' ? 'border-purple-500 bg-purple-50' : 'border-slate-100 bg-white hover:border-slate-300'}`}
              >
                 <div className="flex items-center gap-2 mb-2">
                   <span className="text-xl">💎</span>
                   <span className={`text-sm font-black ${cssTheme === 'premium' ? 'text-purple-700' : 'text-slate-600'}`}>프리미엄 라인</span>
                 </div>
                 <p className="text-[10px] text-slate-500 font-medium">얇은 테두리 + 넓은 여백</p>
              </button>
              <button
                type="button"
                onClick={() => setCssTheme('minimal')}
                className={`p-4 rounded-2xl border-2 transition-all text-left ${cssTheme === 'minimal' ? 'border-slate-500 bg-slate-50' : 'border-slate-100 bg-white hover:border-slate-300'}`}
              >
                 <div className="flex items-center gap-2 mb-2">
                   <span className="text-xl">✨</span>
                   <span className={`text-sm font-black ${cssTheme === 'minimal' ? 'text-slate-700' : 'text-slate-600'}`}>미니멀 클린</span>
                 </div>
                 <p className="text-[10px] text-slate-500 font-medium">여백 중심 + 최소 장식</p>
              </button>
              <button
                type="button"
                onClick={() => setCssTheme('warm')}
                className={`p-4 rounded-2xl border-2 transition-all text-left ${cssTheme === 'warm' ? 'border-orange-500 bg-orange-50' : 'border-slate-100 bg-white hover:border-slate-300'}`}
              >
                 <div className="flex items-center gap-2 mb-2">
                   <span className="text-xl">☀️</span>
                   <span className={`text-sm font-black ${cssTheme === 'warm' ? 'text-orange-700' : 'text-slate-600'}`}>따뜻한 박스</span>
                 </div>
                 <p className="text-[10px] text-slate-500 font-medium">둥근 박스 + 부드러운 배경</p>
              </button>
              <button
                type="button"
                onClick={() => setCssTheme('professional')}
                className={`p-4 rounded-2xl border-2 transition-all text-left ${cssTheme === 'professional' ? 'border-blue-500 bg-blue-50' : 'border-slate-100 bg-white hover:border-slate-300'}`}
              >
                 <div className="flex items-center gap-2 mb-2">
                   <span className="text-xl">🏛️</span>
                   <span className={`text-sm font-black ${cssTheme === 'professional' ? 'text-blue-700' : 'text-slate-600'}`}>의료 전문</span>
                 </div>
                 <p className="text-[10px] text-slate-500 font-medium">신뢰감 있는 블루 포인트</p>
              </button>
           </div>
        </div>

        <div className="border-t border-slate-100 pt-6 mt-2">
          <label className="block text-xs font-black text-slate-400 mb-2 uppercase tracking-widest flex justify-between">
             4단계. 스타일 설정 (선택사항)
             <span className="text-green-600 font-bold">벤치마킹 URL 입력 시 자동 적용</span>
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
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-medium focus:border-green-500 outline-none text-sm"
            />
            {referenceUrl && <p className="text-[11px] text-green-600 mt-2 font-bold px-2">✅ URL이 입력되었습니다. {postType === 'card_news' ? '해당 카드뉴스 템플릿의 논리 구조와 전개 방식을 분석하여 적용합니다.' : '기존 페르소나 설정 대신 해당 블로그의 말투와 논리를 모방합니다.'}</p>}
          </div>

          {!referenceUrl && (
            <div className="grid grid-cols-2 gap-4 animate-fadeIn">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-2">페르소나 직접 선택</label>
                <select value={persona} onChange={(e) => setPersona(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:border-green-500">
                  {PERSONAS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-2">말투 직접 선택</label>
                <select value={tone} onChange={(e) => setTone(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:border-green-500">
                  {TONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading || !topic.trim()}
          className={`w-full py-5 rounded-2xl text-white font-black text-lg shadow-2xl transition-all active:scale-95 ${isLoading ? 'bg-slate-400' : postType === 'blog' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {isLoading ? '생성 중...' : postType === 'blog' ? '병원 블로그 원고 생성 🚀' : '병원 카드뉴스 제작 🚀'}
        </button>
      </form>
    </div>
  );
};

export default InputForm;
