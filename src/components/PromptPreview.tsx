import React, { useState } from 'react';
import { CardPromptData } from '../types';

interface PromptPreviewProps {
  prompts: CardPromptData[];
  onApprove: () => void;
  onBack: () => void;
  onEditPrompts: (updatedPrompts: CardPromptData[]) => void;
  isLoading: boolean;
  progress: string;
  darkMode?: boolean;
}

const PromptPreview: React.FC<PromptPreviewProps> = ({
  prompts,
  onApprove,
  onBack,
  onEditPrompts,
  isLoading,
  progress,
  darkMode = false,
}) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [tempPrompt, setTempPrompt] = useState<string>('');

  // 편집 시작
  const startEditing = (index: number) => {
    setEditingIndex(index);
    setTempPrompt(prompts[index].imagePrompt);
  };

  // 편집 저장
  const saveEdit = () => {
    if (editingIndex === null) return;
    
    const updatedPrompts = [...prompts];
    updatedPrompts[editingIndex] = {
      ...updatedPrompts[editingIndex],
      imagePrompt: tempPrompt,
    };
    onEditPrompts(updatedPrompts);
    setEditingIndex(null);
    setTempPrompt('');
  };

  // 편집 취소
  const cancelEdit = () => {
    setEditingIndex(null);
    setTempPrompt('');
  };

  // 프롬프트에서 핵심 텍스트 추출해서 보여주기 (""안의 텍스트만!)
  const extractDisplayText = (prompt: string): { subtitle: string; mainTitle: string; description: string; visual: string; style: string } => {
    // "" 안의 텍스트만 추출
    const subtitleMatch = prompt.match(/subtitle:\s*"([^"]+)"/i);
    const mainTitleMatch = prompt.match(/mainTitle:\s*"([^"]+)"/i);
    const descMatch = prompt.match(/description:\s*"([^"]+)"/i);
    const visualMatch = prompt.match(/비주얼:\s*(.+?)(?:\n|$)/i) || prompt.match(/\[VISUAL\]\s*(.+?)(?:\n|$)/i);
    const styleMatch = prompt.match(/스타일:\s*(.+?)(?:\n|$)/i) || prompt.match(/style:\s*(.+?)(?:\n|$)/i);
    
    return {
      subtitle: subtitleMatch?.[1]?.trim() || '',
      mainTitle: mainTitleMatch?.[1]?.trim() || '',
      description: descMatch?.[1]?.trim() || '',
      visual: visualMatch?.[1]?.trim().replace(/,?\s*Background:.*$/i, '') || '',
      style: styleMatch?.[1]?.trim() || '',
    };
  };

  return (
    <div className={`h-full flex flex-col rounded-[48px] shadow-2xl border overflow-hidden transition-colors duration-300 ${
      darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
    }`}>
      {/* 헤더 */}
      <div className={`px-8 py-6 border-b flex-none ${
        darkMode ? 'bg-slate-900 border-slate-700' : 'bg-gradient-to-r from-purple-500 to-pink-600'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎨</span>
              <h2 className="text-xl font-black text-white">이미지 프롬프트 확인</h2>
            </div>
            <p className="text-white/80 text-sm mt-1">
              {prompts.length}장의 카드 이미지 프롬프트
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 bg-white/20 rounded-xl text-white text-xs font-bold">
              2단계: 프롬프트 확인
            </span>
          </div>
        </div>
      </div>

      {/* 로딩 상태 */}
      {isLoading && (
        <div className={`px-8 py-4 flex items-center gap-3 border-b ${
          darkMode ? 'bg-purple-900/30 border-slate-700' : 'bg-purple-50 border-purple-100'
        }`}>
          <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
          <span className={`text-sm font-bold ${darkMode ? 'text-purple-400' : 'text-purple-700'}`}>
            {progress}
          </span>
        </div>
      )}

      {/* 안내 메시지 */}
      <div className={`px-8 py-4 border-b ${darkMode ? 'border-slate-700' : 'border-slate-100'}`}>
        <div className={`p-4 rounded-xl ${darkMode ? 'bg-amber-900/30 border border-amber-700/50' : 'bg-amber-50 border border-amber-100'}`}>
          <p className={`text-sm ${darkMode ? 'text-amber-300' : 'text-amber-700'}`}>
            💡 <strong>이 프롬프트로 이미지가 생성됩니다.</strong> 
            <br />원하는 텍스트/스타일이 맞는지 확인하고, 수정이 필요하면 '수정' 버튼을 클릭하세요.
          </p>
        </div>
      </div>

      {/* 프롬프트 목록 */}
      <div className={`flex-1 overflow-y-auto px-8 py-6 space-y-4 custom-scrollbar ${
        darkMode ? 'bg-slate-900' : 'bg-slate-50'
      }`}>
        {prompts.map((promptData, index) => {
          const displayText = extractDisplayText(promptData.imagePrompt);
          const isEditing = editingIndex === index;

          return (
            <div
              key={index}
              className={`rounded-2xl border overflow-hidden transition-all ${
                isEditing 
                  ? (darkMode ? 'border-purple-500 ring-2 ring-purple-500/30' : 'border-purple-400 ring-2 ring-purple-100')
                  : (darkMode ? 'border-slate-700 hover:border-slate-600' : 'border-slate-200 hover:border-slate-300')
              } ${darkMode ? 'bg-slate-800' : 'bg-white'}`}
            >
              {/* 카드 헤더 */}
              <div className={`px-5 py-3 flex items-center justify-between ${
                darkMode ? 'bg-slate-700' : 'bg-slate-50'
              }`}>
                <div className="flex items-center gap-3">
                  <span className={`w-8 h-8 flex items-center justify-center rounded-full font-black text-sm ${
                    index === 0 
                      ? 'bg-purple-500 text-white' 
                      : index === prompts.length - 1 
                        ? 'bg-amber-500 text-white'
                        : darkMode ? 'bg-slate-600 text-slate-300' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {index + 1}
                  </span>
                  <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                    index === 0 
                      ? 'bg-purple-100 text-purple-700' 
                      : index === prompts.length - 1 
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {index === 0 ? '📕 표지' : index === prompts.length - 1 ? '🎯 CTA' : '📝 본문'}
                  </span>
                </div>
                
                {!isEditing && (
                  <button
                    onClick={() => startEditing(index)}
                    disabled={isLoading}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50 ${
                      darkMode 
                        ? 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    ✏️ 수정
                  </button>
                )}
              </div>

              {/* 카드 내용 */}
              <div className="p-5 space-y-4">
                {isEditing ? (
                  // 편집 모드
                  <>
                    <div>
                      <label className={`text-xs font-bold mb-2 block ${darkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                        🎨 이미지 프롬프트 (전체)
                      </label>
                      <textarea
                        value={tempPrompt}
                        onChange={(e) => setTempPrompt(e.target.value)}
                        rows={8}
                        className={`w-full px-4 py-3 rounded-xl text-sm border outline-none resize-none font-mono transition-all ${
                          darkMode 
                            ? 'bg-slate-700 border-slate-600 text-slate-100 focus:border-purple-500'
                            : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-purple-400'
                        }`}
                      />
                      <p className={`text-xs mt-2 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        💡 subtitle, mainTitle, description 부분을 수정하면 이미지에 해당 텍스트가 렌더링됩니다.
                      </p>
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
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-500 text-white hover:bg-purple-600 transition-all"
                      >
                        ✅ 저장
                      </button>
                    </div>
                  </>
                ) : (
                  // 보기 모드 - 핵심 정보만 깔끔하게!
                  <>
                    {/* 📝 렌더링될 텍스트 */}
                    <div className={`p-4 rounded-xl border ${darkMode ? 'bg-slate-700/50 border-slate-600' : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100'}`}>
                      <div className={`text-[10px] font-bold mb-2 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                        📝 이미지에 렌더링될 텍스트
                      </div>
                      {displayText.subtitle && (
                        <div className={`text-xs mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          "{displayText.subtitle}"
                        </div>
                      )}
                      <div className={`text-lg font-black ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
                        "{displayText.mainTitle || '(메인 제목 없음)'}"
                      </div>
                      {displayText.description && (
                        <div className={`text-sm mt-1 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                          "{displayText.description}"
                        </div>
                      )}
                    </div>
                    
                    {/* 🎨 비주얼 키워드 */}
                    {displayText.visual && (
                      <div className={`p-3 rounded-xl border ${darkMode ? 'bg-emerald-900/30 border-emerald-700/50' : 'bg-emerald-50 border-emerald-100'}`}>
                        <div className={`text-[10px] font-bold mb-1 ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
                          🎨 비주얼 키워드
                        </div>
                        <div className={`text-sm ${darkMode ? 'text-emerald-300' : 'text-emerald-700'}`}>
                          {displayText.visual}
                        </div>
                      </div>
                    )}
                    
                    {/* 🖼️ 이미지 스타일 */}
                    {displayText.style && (
                      <div className={`p-3 rounded-xl border ${darkMode ? 'bg-purple-900/30 border-purple-700/50' : 'bg-purple-50 border-purple-100'}`}>
                        <div className={`text-[10px] font-bold mb-1 ${darkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                          🖼️ 이미지 스타일
                        </div>
                        <div className={`text-sm ${darkMode ? 'text-purple-300' : 'text-purple-700'}`}>
                          {displayText.style}
                        </div>
                      </div>
                    )}
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
          {/* 이전 단계 버튼 */}
          <button
            onClick={onBack}
            disabled={isLoading}
            className={`flex-1 py-4 rounded-2xl font-bold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${
              darkMode 
                ? 'bg-slate-700 text-slate-300 hover:bg-slate-600 border border-slate-600'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            ← 원고 수정하기
          </button>
          
          {/* 승인 버튼 */}
          <button
            onClick={onApprove}
            disabled={isLoading}
            className="flex-1 sm:flex-[2] py-4 rounded-2xl font-bold text-sm bg-gradient-to-r from-purple-500 to-pink-600 text-white hover:from-purple-600 hover:to-pink-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20"
          >
            ✅ 이 프롬프트로 이미지 생성
          </button>
        </div>
        
        <p className={`text-center text-[11px] mt-3 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          🖼️ 승인하면 {prompts.length}장의 이미지 생성이 시작됩니다. 각 이미지 생성에 약 10~15초가 소요됩니다.
        </p>
      </div>
    </div>
  );
};

export default PromptPreview;
