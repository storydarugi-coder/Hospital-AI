import React, { useState, useEffect, useRef } from 'react';
import { GeneratedContent, ImageStyle, CssTheme } from '../types';
import { modifyPostWithAI, generateSingleImage, recommendImagePrompt } from '../services/geminiService';
import { CSS_THEMES, applyThemeToHtml } from '../utils/cssThemes';

interface ResultPreviewProps {
  content: GeneratedContent;
}

const ResultPreview: React.FC<ResultPreviewProps> = ({ content }) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'html'>('preview');
  const [localHtml, setLocalHtml] = useState(content.fullHtml);
  const [currentTheme, setCurrentTheme] = useState<CssTheme>(content.cssTheme || 'modern');
  const [editorInput, setEditorInput] = useState('');
  const [isEditingAi, setIsEditingAi] = useState(false);
  const [editProgress, setEditProgress] = useState('');
  
  const [regenOpen, setRegenOpen] = useState(false);
  const [regenIndex, setRegenIndex] = useState<number>(1);
  const [regenPrompt, setRegenPrompt] = useState<string>('');
  const [regenRefDataUrl, setRegenRefDataUrl] = useState<string | undefined>(undefined);
  const [regenRefName, setRegenRefName] = useState<string>('');
  const [isRecommendingPrompt, setIsRecommendingPrompt] = useState(false);
  
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalHtml(content.fullHtml);
  }, [content.fullHtml]);

  const handleHtmlChange = () => {
    if (editorRef.current) {
      setLocalHtml(editorRef.current.innerHTML);
    }
  };

  const openRegenModal = (imgIndex: number, currentPrompt: string) => {
    setRegenIndex(imgIndex);
    setRegenPrompt(currentPrompt || 'professional illustration');
    setRegenRefDataUrl(undefined);
    setRegenRefName('');
    setRegenOpen(true);
  };

  const handleRegenFileChange = (file: File | null) => {
    if (!file) {
      setRegenRefDataUrl(undefined);
      setRegenRefName('');
      return;
    }
    setRegenRefName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const v = (reader.result || '').toString();
      if (v.startsWith('data:')) setRegenRefDataUrl(v);
    };
    reader.readAsDataURL(file);
  };

  const handleRecommendPrompt = async () => {
    setIsRecommendingPrompt(true);
    try {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = localHtml;
      const textContent = tempDiv.innerText || tempDiv.textContent || '';
      
      const recommendedPrompt = await recommendImagePrompt(textContent, regenPrompt);
      setRegenPrompt(recommendedPrompt);
    } catch (err) {
      alert('프롬프트 추천 중 오류가 발생했습니다.');
    } finally {
      setIsRecommendingPrompt(false);
    }
  };

  const submitRegenerateImage = async () => {
    if (!regenPrompt.trim()) return;
    setIsEditingAi(true);
    setEditProgress(`${regenIndex}번 이미지를 다시 생성 중...`);
    try {
      const style = content.imageStyle || 'illustration';
      const imgRatio = content.postType === 'card_news' ? "1:1" : "16:9";
      const newImageData = await generateSingleImage(regenPrompt.trim(), style, imgRatio);
      if (newImageData) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = localHtml;
        const imgs = tempDiv.querySelectorAll('img');
        if (imgs[regenIndex - 1]) {
          imgs[regenIndex - 1].src = newImageData;
          imgs[regenIndex - 1].alt = regenPrompt.trim();
          setLocalHtml(tempDiv.innerHTML);
        }
      }
      setRegenOpen(false);
    } catch (err) {
      alert('이미지 생성 중 오류가 발생했습니다.');
    } finally {
      setIsEditingAi(false);
      setEditProgress('');
    }
  };

  const handleBatchImageStyleChange = async (style: ImageStyle) => {
     if (!confirm("모든 이미지를 재생성하시겠습니까? 시간이 소요됩니다.")) return;
     
     setIsEditingAi(true);
     setEditProgress(style === 'photo' ? '모든 이미지를 실사로 변경 중...' : '모든 이미지를 일러스트로 변경 중...');
     const aspectRatio = content.postType === 'card_news' ? "1:1" : "16:9";
     
     try {
         const tempDiv = document.createElement('div');
         tempDiv.innerHTML = localHtml;
         const imgs = Array.from(tempDiv.querySelectorAll('img'));
         
         await Promise.all(imgs.map(async (img) => {
             const prompt = img.alt;
             if (prompt) {
                 const newUrl = await generateSingleImage(prompt, style, aspectRatio);
                 if (newUrl) img.src = newUrl;
             }
         }));
         
         setLocalHtml(tempDiv.innerHTML);
     } catch(e) { alert('이미지 변경 중 오류가 발생했습니다.'); }
     finally { setIsEditingAi(false); setEditProgress(''); }
  };

  const applyInlineStylesForNaver = (html: string, theme: CssTheme = currentTheme) => {
    let styled = html;
    
    if (content.postType === 'card_news') {
        styled = styled
            .replace(/<div class="card-news-container"/g, '<div style="max-width: 600px; margin: 0 auto; background: #fafafa; padding: 20px;"')
            .replace(/<div class="card-slide"/g, '<div style="background: white; border-radius: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); margin-bottom: 30px; overflow: hidden; position: relative; width: 100%; aspect-ratio: 1/1;"')
            .replace(/<div class="card-border-box"/g, '<div style="border: 2px solid #000; border-radius: 30px; margin: 20px; height: calc(100% - 40px); display: flex; flex-direction: column; justify-content: space-between; position: relative;"')
            .replace(/<div class="card-header-row"/g, '<div style="padding: 20px; display: flex; justify-content: space-between; align-items: center;"')
            .replace(/class="brand-text"/g, 'style="font-size: 10px; font-weight: 900; letter-spacing: 1px;"')
            .replace(/class="arrow-icon"/g, 'style="font-size: 24px; border: 1px solid #000; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;"')
            .replace(/<div class="card-content-area"/g, '<div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 0 20px;"')
            .replace(/class="card-subtitle"/g, 'style="font-size: 16px; font-weight: 800; color: #333; margin-bottom: 10px;"')
            .replace(/class="card-divider-dotted"/g, 'style="width: 100%; border-bottom: 2px dotted #000; margin: 10px 0 20px 0;"')
            .replace(/class="card-main-title"/g, 'style="font-size: 42px; font-weight: 900; color: #000; line-height: 1.1; margin: 0 0 20px 0; word-break: keep-all;"')
            .replace(/class="card-inner-img"/g, 'style="max-width: 80%; max-height: 200px; border-radius: 12px; margin: 10px auto; display: block;"')
            .replace(/class="card-desc"/g, 'style="font-size: 14px; color: #666; margin-top: 10px; line-height: 1.4;"')
            .replace(/<div class="card-footer-row"/g, '<div style="padding: 20px; display: flex; justify-content: center; gap: 10px;"')
            .replace(/class="pill-tag"/g, 'style="background: #eee; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: bold; color: #333;"');
    } else {
        styled = applyThemeToHtml(styled, theme);
    }
    return styled;
  };

  const handleCopy = async () => {
    try {
      const styledHtml = applyInlineStylesForNaver(localHtml, currentTheme);
      const blob = new Blob([styledHtml], { type: 'text/html' });
      const plainText = new Blob([editorRef.current?.innerText || ""], { type: 'text/plain' });
      const item = new ClipboardItem({
        'text/html': blob,
        'text/plain': plainText
      });
      await navigator.clipboard.write([item]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) { 
        try {
            await navigator.clipboard.writeText(applyInlineStylesForNaver(localHtml));
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (e) { console.error(e); }
    }
  };

  const handleAiEditSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editorInput.trim()) return;
      setIsEditingAi(true);
      setEditProgress('AI 에디터가 요청하신 내용을 바탕으로 원고를 최적화하고 있습니다...');
      
      try {
          const result = await modifyPostWithAI(localHtml, editorInput);
          let workingHtml = result.newHtml;

          if (result.regenerateImageIndices && result.newImagePrompts) {
              setEditProgress('요청하신 부분에 맞춰 새로운 일러스트를 생성 중입니다...');

              const idxList = result.regenerateImageIndices.slice(0, 3);
              const promptList = result.newImagePrompts.slice(0, idxList.length);
              const newImageMap: Record<number, string> = {};

              await Promise.all(
                promptList.map(async (prompt, i) => {
                  const targetIdx = idxList[i];
                  if (!targetIdx) return;
                  const style = content.imageStyle || 'illustration';
                  newImageMap[targetIdx] = await generateSingleImage(prompt, style);
                })
              );

              const markerPattern = /\[IMG_(\d+)\]/g;
              let markersFound = false;
              if (markerPattern.test(workingHtml)) {
                  markersFound = true;
                  workingHtml = workingHtml.replace(markerPattern, (match, idx) => {
                      const imgNum = parseInt(idx, 10);
                      const newSrc = newImageMap[imgNum];
                      if (newSrc) {
                          return `<div class="content-image-wrapper"><img src="${newSrc}" /></div>`;
                      }
                      return '';
                  });
              }

              if (!markersFound) {
                  try {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(workingHtml, 'text/html');
                    const imgs = Array.from(doc.querySelectorAll('img'));
                    imgs.forEach((img, i) => {
                      const ordinal = i + 1;
                      const newSrc = newImageMap[ordinal];
                      if (newSrc) img.setAttribute('src', newSrc);
                    });
                    workingHtml = doc.body.innerHTML;
                  } catch (e) {
                    workingHtml = workingHtml.replace(/\[IMG_\d+\]/g, '');
                  }
              }
          }

          setLocalHtml(workingHtml);
          setEditorInput('');
          setEditProgress('');
      } catch (err: any) { 
          const msg = (err?.message || err?.toString || "").toString();
          alert("AI 보정 실패: " + (msg || "Gemini API 응답을 확인해주세요.")); 
          setEditProgress('');
      } finally { 
          setIsEditingAi(false); 
      }
  };

  return (
    <div className="bg-white rounded-[48px] shadow-2xl border border-slate-200 h-full flex flex-col overflow-hidden relative">
      <style>{`
        .naver-preview h3 { font-size: 24px; font-weight: bold; margin-top: 50px; margin-bottom: 20px; color: #000; }
        .naver-preview p { font-size: 16px; margin-bottom: 20px; color: #333; line-height: 1.8; }
        .naver-preview .content-image-wrapper { position: relative; margin: 90px 0; }
        .naver-preview .content-image-wrapper img { width: 100%; border-radius: 48px; display: block; box-shadow: 0 30px 70px rgba(0,0,0,0.12); cursor: pointer; transition: filter 0.3s; }
        .naver-preview .content-image-wrapper:hover img { filter: brightness(0.8); }
        .naver-preview .content-image-wrapper::after { content: '✨ 이미지 재생성'; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(79, 70, 229, 0.9); color: white; padding: 12px 24px; border-radius: 20px; font-weight: 900; font-size: 14px; opacity: 0; pointer-events: none; transition: opacity 0.3s; }
        .naver-preview .content-image-wrapper:hover::after { opacity: 1; }

        .card-news-container { max-width: 500px; margin: 0 auto; }
        
        .card-slide { 
           background: white; 
           border-radius: 20px; 
           box-shadow: 0 10px 40px rgba(0,0,0,0.08); 
           margin-bottom: 30px; 
           overflow: hidden; 
           position: relative; 
           width: 100%; 
           aspect-ratio: 1/1; 
        }

        .card-border-box {
           border: 3px solid #000;
           border-radius: 30px;
           margin: 20px;
           height: calc(100% - 40px);
           display: flex;
           flex-direction: column;
           justify-content: space-between;
           position: relative;
           background: #fff;
        }

        .card-header-row {
           padding: 20px 24px;
           display: flex;
           justify-content: space-between;
           align-items: center;
        }
        
        .brand-text {
           font-size: 11px;
           font-weight: 900;
           letter-spacing: 1px;
           text-transform: uppercase;
           color: #000;
        }

        .arrow-icon {
           font-size: 20px;
           border: 2px solid #000;
           border-radius: 50%;
           width: 36px;
           height: 36px;
           display: flex;
           align-items: center;
           justify-content: center;
           color: #000;
        }

        .card-content-area {
           flex: 1;
           display: flex;
           flex-direction: column;
           align-items: center;
           justify-content: center;
           text-align: center;
           padding: 0 30px;
        }

        .card-subtitle {
           font-size: 16px;
           font-weight: 800;
           color: #333;
           margin-bottom: 12px;
           letter-spacing: -0.5px;
        }

        .card-divider-dotted {
           width: 100%;
           border-bottom: 3px dotted #000;
           margin: 10px 0 24px 0;
           opacity: 0.8;
        }

        .card-main-title {
           font-size: 42px;
           font-weight: 900;
           color: #000;
           line-height: 1.15;
           margin: 0 0 20px 0;
           word-break: keep-all;
           letter-spacing: -1px;
        }
        
        .card-inner-img {
            max-width: 80%;
            max-height: 180px;
            object-fit: cover;
            border-radius: 16px;
            margin: 10px auto;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        
        .card-desc {
            font-size: 14px;
            color: #555;
            margin-top: 10px;
            font-weight: 600;
            line-height: 1.5;
            word-break: keep-all;
        }

        .card-footer-row {
           padding: 20px;
           display: flex;
           justify-content: center;
           gap: 12px;
           padding-bottom: 24px;
        }

        .pill-tag {
           background: #f1f5f9;
           padding: 8px 16px;
           border-radius: 20px;
           font-size: 13px;
           font-weight: 800;
           color: #1e293b;
           border: 1px solid #e2e8f0;
        }

        .hidden-title { display: none; }
        .legal-box-card { font-size: 11px; color: #94a3b8; text-align: center; margin-top: 20px; }
      `}</style>

      {regenOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/40 flex items-center justify-center p-6">
          <div className="w-full max-w-2xl bg-white rounded-[36px] shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-sm font-black text-slate-900">✨ {regenIndex}번 이미지 재생성</div>
                <div className="text-xs text-slate-500">프롬프트를 수정하여 새 이미지를 생성합니다.</div>
              </div>
              <button
                type="button"
                onClick={() => setRegenOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-black bg-slate-100 hover:bg-slate-200"
              >
                닫기
              </button>
            </div>

            <div className="p-8 space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-black text-slate-700">프롬프트</div>
                  <button
                    type="button"
                    onClick={handleRecommendPrompt}
                    disabled={isRecommendingPrompt}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isRecommendingPrompt ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        AI 분석중...
                      </>
                    ) : (
                      <>
                        🤖 AI 프롬프트 추천
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  value={regenPrompt}
                  onChange={(e) => setRegenPrompt(e.target.value)}
                  className="w-full h-32 p-4 rounded-2xl border border-slate-200 bg-slate-50 outline-none font-mono text-sm"
                  placeholder="예: Korean professional doctor consultation scene..."
                  disabled={isRecommendingPrompt}
                />
                <div className="text-[11px] text-slate-500 mt-2">
                  💡 팁: "프롬프트 추천" 버튼을 누르면 AI가 글 내용을 분석해서 최적의 이미지 프롬프트를 자동으로 생성해줍니다!
                </div>
              </div>

              <div>
                <div className="text-xs font-black text-slate-700 mb-2">참고 이미지 (선택)</div>
                <div className="flex items-center gap-4">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleRegenFileChange(e.target.files?.[0] || null)}
                    className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                  />
                  {regenRefName && (
                    <div className="text-xs font-bold text-slate-600 truncate max-w-[180px]">📎 {regenRefName}</div>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 mt-2">
                  참고 이미지는 "무드/실루엣/배색" 참고용으로만 사용됩니다.
                </div>
                {regenRefDataUrl && (
                  <div className="mt-3">
                    <img src={regenRefDataUrl} alt="참고 이미지" className="max-h-32 rounded-xl border border-slate-200" />
                  </div>
                )}
              </div>
            </div>

            <div className="px-8 py-6 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setRegenOpen(false)}
                className="px-6 py-3 rounded-2xl font-black text-sm bg-slate-100 hover:bg-slate-200"
                disabled={isEditingAi}
              >
                취소
              </button>
              <button
                type="button"
                onClick={submitRegenerateImage}
                className="px-8 py-3 rounded-2xl font-black text-sm bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50"
                disabled={isEditingAi}
              >
                이 프롬프트로 재생성
              </button>
            </div>
          </div>
        </div>
      )}

      {content.factCheck && (
        <div className="bg-slate-900 p-6 flex items-center justify-between text-white flex-none">
          <div className="flex items-center gap-8">
            <div className="flex flex-col">
              <span className="text-[10px] font-black opacity-50 uppercase tracking-[0.1em] mb-1">Naver Logic Score</span>
              <div className="flex items-center gap-3">
                 <span className={`text-3xl font-black ${content.factCheck.safety_score > 80 ? 'text-green-400' : 'text-amber-400'}`}>
                   {content.factCheck.safety_score}점
                 </span>
                 <span className="text-xs opacity-70">안전성 확보</span>
              </div>
            </div>
            {content.postType === 'card_news' && (
                <div className="hidden lg:block">
                   <span className="text-xs font-bold text-blue-400 border border-blue-400 px-2 py-1 rounded-lg">카드뉴스 모드</span>
                </div>
            )}
          </div>
          <div className="flex items-center gap-2">
             <span className="text-[10px] font-black uppercase text-slate-400 mr-2 hidden lg:inline">Quick Actions</span>
             <button onClick={() => handleBatchImageStyleChange('photo')} disabled={isEditingAi} className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2">
                📸 전체 실사로
             </button>
             <button onClick={() => handleBatchImageStyleChange('illustration')} disabled={isEditingAi} className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2">
                🎨 전체 일러스트로
             </button>
          </div>
        </div>
      )}

      <div className="p-6 border-b border-slate-100 bg-white flex-none">
        <div className="flex justify-between items-center mb-4">
          <div className="flex bg-slate-100 p-1.5 rounded-xl">
              <button onClick={() => setActiveTab('preview')} className={`px-8 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'preview' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-400'}`}>미리보기</button>
              <button onClick={() => setActiveTab('html')} className={`px-8 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'html' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-400'}`}>HTML</button>
          </div>
          <button onClick={handleCopy} className={`px-10 py-3 rounded-xl text-md font-bold text-white shadow-xl transition-all active:scale-95 ${copied ? 'bg-emerald-500' : 'bg-green-500 hover:bg-green-600'}`}>
              {copied ? '✅ 복사 완료' : '블로그로 복사'}
          </button>
        </div>
        
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-black text-slate-400">🎨 블로그 레이아웃 스타일:</span>
            <span className="text-[10px] text-slate-500 font-medium">{CSS_THEMES[currentTheme].description}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {(['modern', 'premium', 'minimal', 'warm', 'professional'] as CssTheme[]).map((theme) => {
              const themeInfo = CSS_THEMES[theme];
              const isActive = currentTheme === theme;
              return (
                <button
                  key={theme}
                  type="button"
                  onClick={() => setCurrentTheme(theme)}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border-2 ${
                    isActive
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  {themeInfo.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 lg:p-16 bg-slate-50 custom-scrollbar">
        {activeTab === 'preview' ? (
          <div className={`mx-auto bg-white shadow-lg border border-slate-100 p-12 naver-preview min-h-[800px] ${content.postType === 'card_news' ? 'max-w-xl' : 'max-w-3xl'}`}>
              <div 
                ref={editorRef}
                contentEditable
                onInput={handleHtmlChange}
                onClick={(e) => {
                   const target = e.target as HTMLElement;
                   if (target.tagName === 'IMG') {
                      const allImgs = Array.from(editorRef.current?.querySelectorAll('img') || []);
                      const index = allImgs.indexOf(target as HTMLImageElement) + 1;
                      openRegenModal(index, (target as HTMLImageElement).alt || 'professional illustration');
                   }
                }}
                dangerouslySetInnerHTML={{ __html: applyInlineStylesForNaver(localHtml, currentTheme) }}
                className="focus:outline-none"
              />
          </div>
        ) : (
          <div className="max-w-3xl mx-auto h-full">
            <textarea 
                value={localHtml} 
                onChange={(e) => setLocalHtml(e.target.value)}
                className="w-full h-full p-10 font-mono text-sm bg-slate-900 text-green-400 rounded-3xl outline-none border-none shadow-inner resize-none" 
            />
          </div>
        )}
      </div>
      
      <div className="p-6 bg-white border-t border-slate-100 flex-none">
         <div className="max-w-4xl mx-auto">
            {isEditingAi && (
                <div className="mb-3 flex items-center gap-3 animate-pulse">
                    <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm font-bold text-green-600">{editProgress}</span>
                </div>
            )}
            <form onSubmit={handleAiEditSubmit} className="flex gap-3">
                <input 
                    type="text" 
                    value={editorInput} 
                    onChange={(e) => setEditorInput(e.target.value)}
                    placeholder="예: '3번째 문단을 더 부드럽게 고치고 전체 그림을 현대적인 스타일로 바꿔줘'"
                    className="flex-1 px-6 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:border-green-500 outline-none font-bold text-sm"
                    disabled={isEditingAi}
                />
                <button type="submit" disabled={isEditingAi} className="px-8 py-4 bg-slate-900 text-white font-bold rounded-xl hover:bg-black transition-all text-sm">
                    {isEditingAi ? 'AI 작동중' : 'AI 정밀보정'}
                </button>
            </form>
         </div>
      </div>
    </div>
  );
};

export default ResultPreview;
