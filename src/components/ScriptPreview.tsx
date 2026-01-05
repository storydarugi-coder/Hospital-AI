import React, { useState } from 'react';
import { CardNewsScript, CardNewsSlideScript } from '../types';

interface ScriptPreviewProps {
  script: CardNewsScript;
  onApprove: () => void;
  onRegenerate: () => void;
  onEditScript: (updatedScript: CardNewsScript) => void;
  isLoading: boolean;
  progress: string;
  darkMode?: boolean;
}

// 슬라이드 타입 라벨
const SLIDE_TYPE_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  cover: { label: '표지', emoji: '📕', color: 'bg-purple-100 text-purple-700' },
  concept: { label: '개념', emoji: '💡', color: 'bg-blue-100 text-blue-700' },
  content: { label: '본문', emoji: '📝', color: 'bg-emerald-100 text-emerald-700' },
  closing: { label: 'CTA', emoji: '🎯', color: 'bg-amber-100 text-amber-700' },
};

const ScriptPreview: React.FC<ScriptPreviewProps> = ({
  script,
  onApprove,
  onRegenerate,
  onEditScript,
  isLoading,
  progress,
  darkMode = false,
}) => {
  const [editingSlide, setEditingSlide] = useState<number | null>(null);
  const [tempEdit, setTempEdit] = useState<CardNewsSlideScript | null>(null);

  // 슬라이드 편집 시작
  const startEditing = (slideIndex: number) => {
    setEditingSlide(slideIndex);
    setTempEdit({ ...script.slides[slideIndex] });
  };

  // 슬라이드 편집 저장
  const saveEdit = () => {
    if (editingSlide === null || !tempEdit) return;
    
    const updatedSlides = [...script.slides];
    updatedSlides[editingSlide] = tempEdit;
    onEditScript({
      ...script,
      slides: updatedSlides,
    });
    
    setEditingSlide(null);
    setTempEdit(null);
  };

  // 편집 취소
  const cancelEdit = () => {
    setEditingSlide(null);
    setTempEdit(null);
  };

  return (
    <div className={`h-full flex flex-col rounded-[48px] shadow-2xl border overflow-hidden transition-colors duration-300 ${
      darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
    }`}>
      {/* 헤더 */}
      <div className={`px-8 py-6 border-b flex-none ${
        darkMode ? 'bg-slate-900 border-slate-700' : 'bg-gradient-to-r from-blue-500 to-indigo-600'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">📝</span>
              <h2 className="text-xl font-black text-white">카드뉴스 원고 미리보기</h2>
            </div>
            <p className="text-white/80 text-sm mt-1">
              {script.totalSlides}장 | {script.overallTheme}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 bg-white/20 rounded-xl text-white text-xs font-bold">
              1단계: 원고 확인
            </span>
          </div>
        </div>
      </div>

      {/* 로딩 상태 */}
      {isLoading && (
        <div className={`px-8 py-4 flex items-center gap-3 border-b ${
          darkMode ? 'bg-blue-900/30 border-slate-700' : 'bg-blue-50 border-blue-100'
        }`}>
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className={`text-sm font-bold ${darkMode ? 'text-blue-400' : 'text-blue-700'}`}>
            {progress}
          </span>
        </div>
      )}

      {/* 제목 섹션 */}
      <div className={`px-8 py-4 border-b ${darkMode ? 'border-slate-700' : 'border-slate-100'}`}>
        <div className={`text-xs font-bold mb-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          📌 제목
        </div>
        <h3 className={`text-lg font-black ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
          {script.title}
        </h3>
      </div>

      {/* 슬라이드 목록 */}
      <div className={`flex-1 overflow-y-auto px-8 py-6 space-y-4 custom-scrollbar ${
        darkMode ? 'bg-slate-900' : 'bg-slate-50'
      }`}>
        {script.slides.map((slide, index) => {
          const typeInfo = SLIDE_TYPE_LABELS[slide.slideType] || SLIDE_TYPE_LABELS.content;
          const isEditing = editingSlide === index;

          return (
            <div
              key={index}
              className={`rounded-2xl border overflow-hidden transition-all ${
                isEditing 
                  ? (darkMode ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-blue-400 ring-2 ring-blue-100')
                  : (darkMode ? 'border-slate-700 hover:border-slate-600' : 'border-slate-200 hover:border-slate-300')
              } ${darkMode ? 'bg-slate-800' : 'bg-white'}`}
            >
              {/* 슬라이드 헤더 */}
              <div className={`px-5 py-3 flex items-center justify-between ${
                darkMode ? 'bg-slate-700' : 'bg-slate-50'
              }`}>
                <div className="flex items-center gap-3">
                  <span className={`w-8 h-8 flex items-center justify-center rounded-full font-black text-sm ${
                    darkMode ? 'bg-slate-600 text-slate-300' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {index + 1}
                  </span>
                  <span className={`px-2 py-1 rounded-lg text-xs font-bold ${typeInfo.color}`}>
                    {typeInfo.emoji} {typeInfo.label}
                  </span>
                </div>
                
                {!isEditing && (
                  <button
                    onClick={() => startEditing(index)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      darkMode 
                        ? 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    ✏️ 수정
                  </button>
                )}
              </div>

              {/* 슬라이드 내용 */}
              <div className="p-5 space-y-4">
                {isEditing && tempEdit ? (
                  // 편집 모드
                  <>
                    <div>
                      <label className={`text-xs font-bold mb-1 block ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                        부제 (subtitle)
                      </label>
                      <input
                        type="text"
                        value={tempEdit.subtitle}
                        onChange={(e) => setTempEdit({ ...tempEdit, subtitle: e.target.value })}
                        className={`w-full px-4 py-2.5 rounded-xl text-sm font-bold border outline-none transition-all ${
                          darkMode 
                            ? 'bg-slate-700 border-slate-600 text-slate-100 focus:border-blue-500'
                            : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-blue-400'
                        }`}
                      />
                    </div>
                    
                    <div>
                      <label className={`text-xs font-bold mb-1 block ${darkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                        메인 제목 (mainTitle)
                      </label>
                      <input
                        type="text"
                        value={tempEdit.mainTitle}
                        onChange={(e) => setTempEdit({ ...tempEdit, mainTitle: e.target.value })}
                        className={`w-full px-4 py-2.5 rounded-xl text-sm font-bold border outline-none transition-all ${
                          darkMode 
                            ? 'bg-slate-700 border-slate-600 text-slate-100 focus:border-purple-500'
                            : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-purple-400'
                        }`}
                      />
                    </div>
                    
                    <div>
                      <label className={`text-xs font-bold mb-1 block ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
                        설명 (description)
                      </label>
                      <textarea
                        value={tempEdit.description}
                        onChange={(e) => setTempEdit({ ...tempEdit, description: e.target.value })}
                        rows={3}
                        className={`w-full px-4 py-2.5 rounded-xl text-sm border outline-none resize-none transition-all ${
                          darkMode 
                            ? 'bg-slate-700 border-slate-600 text-slate-100 focus:border-emerald-500'
                            : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-emerald-400'
                        }`}
                      />
                    </div>
                    
                    <div>
                      <label className={`text-xs font-bold mb-1 block ${darkMode ? 'text-amber-400' : 'text-amber-600'}`}>
                        이미지 키워드 (imageKeyword)
                      </label>
                      <input
                        type="text"
                        value={tempEdit.imageKeyword}
                        onChange={(e) => setTempEdit({ ...tempEdit, imageKeyword: e.target.value })}
                        className={`w-full px-4 py-2.5 rounded-xl text-sm border outline-none transition-all ${
                          darkMode 
                            ? 'bg-slate-700 border-slate-600 text-slate-100 focus:border-amber-500'
                            : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-amber-400'
                        }`}
                      />
                    </div>
                    
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        onClick={cancelEdit}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                          darkMode 
                            ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        취소
                      </button>
                      <button
                        onClick={saveEdit}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-500 text-white hover:bg-blue-600 transition-all"
                      >
                        ✅ 저장
                      </button>
                    </div>
                  </>
                ) : (
                  // 보기 모드
                  <>
                    <div>
                      <span className={`text-[10px] font-bold ${darkMode ? 'text-blue-400' : 'text-blue-500'}`}>부제</span>
                      <p className={`text-sm font-bold mt-0.5 ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                        {slide.subtitle || '(없음)'}
                      </p>
                    </div>
                    
                    <div>
                      <span className={`text-[10px] font-bold ${darkMode ? 'text-purple-400' : 'text-purple-500'}`}>메인 제목</span>
                      <p className={`text-lg font-black mt-0.5 ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}
                         dangerouslySetInnerHTML={{ 
                           __html: slide.mainTitle
                             .replace(/\\n/g, '<br/>')
                             .replace(/<highlight>/g, `<span class="${darkMode ? 'text-blue-400' : 'text-blue-600'}">`)
                             .replace(/<\/highlight>/g, '</span>')
                         }}
                      />
                    </div>
                    
                    <div>
                      <span className={`text-[10px] font-bold ${darkMode ? 'text-emerald-400' : 'text-emerald-500'}`}>설명</span>
                      <p className={`text-sm mt-0.5 leading-relaxed ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                        {slide.description}
                      </p>
                    </div>
                    
                    {/* Speaking Note (편집자용 메모) */}
                    <div className={`p-3 rounded-xl ${darkMode ? 'bg-amber-900/30 border border-amber-700/50' : 'bg-amber-50 border border-amber-100'}`}>
                      <span className={`text-[10px] font-bold ${darkMode ? 'text-amber-400' : 'text-amber-600'}`}>
                        💬 Speaking Note (내부 메모)
                      </span>
                      <p className={`text-xs mt-1 ${darkMode ? 'text-amber-300/80' : 'text-amber-700/80'}`}>
                        {slide.speakingNote || '(없음)'}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold ${darkMode ? 'text-slate-400' : 'text-slate-400'}`}>🎨 이미지:</span>
                      <span className={`text-xs px-2 py-1 rounded-lg ${darkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                        {slide.imageKeyword}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 액션 버튼 */}
      <div className={`px-8 py-6 border-t flex-none ${darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-100 bg-white'}`}>
        <div className="flex flex-col sm:flex-row gap-3">
          {/* 원고 재생성 버튼 */}
          <button
            onClick={onRegenerate}
            disabled={isLoading}
            className={`flex-1 py-4 rounded-2xl font-bold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${
              darkMode 
                ? 'bg-slate-700 text-slate-300 hover:bg-slate-600 border border-slate-600'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            🔄 원고 재생성
          </button>
          
          {/* 승인 버튼 */}
          <button
            onClick={onApprove}
            disabled={isLoading}
            className="flex-1 sm:flex-[2] py-4 rounded-2xl font-bold text-sm bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
          >
            ✅ 이 원고로 카드뉴스 만들기
          </button>
        </div>
        
        <p className={`text-center text-[11px] mt-3 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          💡 승인하면 이미지 생성이 시작됩니다. 원고 수정이 필요하면 각 슬라이드의 '수정' 버튼을 클릭하세요.
        </p>
      </div>
    </div>
  );
};

export default ScriptPreview;
