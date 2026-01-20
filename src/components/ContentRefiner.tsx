import React, { useState } from 'react';
import { recheckAiSmell } from '../services/geminiService';

interface ContentRefinerProps {
  onClose: () => void;
  darkMode?: boolean;
}

const ContentRefiner: React.FC<ContentRefinerProps> = ({ onClose, darkMode = false }) => {
  const [content, setContent] = useState('');
  const [refinedContent, setRefinedContent] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [factCheck, setFactCheck] = useState<any>(null);

  const handleRefine = async () => {
    if (!content.trim()) {
      alert('수정할 콘텐츠를 입력해주세요.');
      return;
    }

    setIsRefining(true);
    setRefinedContent('');
    setFactCheck(null);

    try {
      console.log('✨ AI 정밀보정 시작...');
      
      // 1단계: AI 냄새 검사
      const checkResult = await recheckAiSmell(content);
      setFactCheck(checkResult);
      
      console.log('📊 검사 결과:', checkResult);
      
      // 2단계: 의료광고법 기준으로 수정
      // TODO: 실제 수정 API 호출 (현재는 검사만)
      // 임시로 원본을 refinedContent에 설정
      setRefinedContent(content);
      
      console.log('✅ AI 정밀보정 완료');
    } catch (error) {
      console.error('❌ AI 정밀보정 실패:', error);
      alert('AI 정밀보정에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsRefining(false);
    }
  };

  const copyToClipboard = () => {
    if (refinedContent) {
      navigator.clipboard.writeText(refinedContent);
      alert('클립보드에 복사되었습니다!');
    }
  };

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
            ✨ AI 정밀보정
          </h2>
          <p className={`text-sm mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            의료광고법 및 보건복지부 심의 기준에 맞게 콘텐츠를 자동 수정합니다
          </p>
        </div>
        <button
          onClick={onClose}
          className={`p-2 rounded-lg transition-colors ${
            darkMode
              ? 'hover:bg-slate-700 text-slate-400'
              : 'hover:bg-slate-100 text-slate-600'
          }`}
        >
          ✕
        </button>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-hidden">
        {/* 원본 콘텐츠 */}
        <div className="flex flex-col gap-2 h-full">
          <label className={`text-sm font-bold ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
            📝 원본 콘텐츠
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="수정할 블로그 글을 붙여넣으세요..."
            className={`flex-1 p-4 rounded-xl border resize-none font-mono text-sm ${
              darkMode
                ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500'
                : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
            }`}
          />
          <button
            onClick={handleRefine}
            disabled={isRefining || !content.trim()}
            className={`py-3 px-6 rounded-xl font-bold transition-all ${
              isRefining || !content.trim()
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-rose-500 to-pink-500 text-white hover:shadow-lg'
            }`}
          >
            {isRefining ? '🔄 분석 중...' : '✨ AI 정밀보정 시작'}
          </button>
        </div>

        {/* 수정된 콘텐츠 */}
        <div className="flex flex-col gap-2 h-full">
          <div className="flex items-center justify-between">
            <label className={`text-sm font-bold ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              ✅ 수정된 콘텐츠
            </label>
            {refinedContent && (
              <button
                onClick={copyToClipboard}
                className={`text-xs py-1 px-3 rounded-lg transition-colors ${
                  darkMode
                    ? 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                    : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                }`}
              >
                📋 복사
              </button>
            )}
          </div>
          <div
            className={`flex-1 p-4 rounded-xl border overflow-y-auto custom-scrollbar ${
              darkMode
                ? 'bg-slate-900 border-slate-700 text-white'
                : 'bg-slate-50 border-slate-300 text-slate-900'
            }`}
          >
            {isRefining ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-pink-200 border-t-pink-500 rounded-full animate-spin mx-auto mb-4"></div>
                  <p className={darkMode ? 'text-slate-400' : 'text-slate-600'}>
                    의료광고법 기준 검사 중...
                  </p>
                </div>
              </div>
            ) : refinedContent ? (
              <div className="space-y-4">
                <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: refinedContent }} />
                
                {factCheck && (
                  <div className={`mt-4 p-4 rounded-lg ${darkMode ? 'bg-slate-800' : 'bg-white'}`}>
                    <h3 className={`text-sm font-bold mb-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                      📊 검사 결과
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className={darkMode ? 'text-slate-400' : 'text-slate-600'}>팩트 정확성:</span>
                        <span className={`ml-2 font-bold ${factCheck.fact_check?.fact_score >= 80 ? 'text-green-500' : 'text-yellow-500'}`}>
                          {factCheck.fact_check?.fact_score || 0}점
                        </span>
                      </div>
                      <div>
                        <span className={darkMode ? 'text-slate-400' : 'text-slate-600'}>의료법 안전성:</span>
                        <span className={`ml-2 font-bold ${factCheck.fact_check?.safety_score >= 80 ? 'text-green-500' : 'text-yellow-500'}`}>
                          {factCheck.fact_check?.safety_score || 0}점
                        </span>
                      </div>
                      <div>
                        <span className={darkMode ? 'text-slate-400' : 'text-slate-600'}>AI 냄새:</span>
                        <span className={`ml-2 font-bold ${factCheck.fact_check?.ai_smell_score <= 20 ? 'text-green-500' : 'text-yellow-500'}`}>
                          {factCheck.fact_check?.ai_smell_score || 0}점
                        </span>
                      </div>
                      <div>
                        <span className={darkMode ? 'text-slate-400' : 'text-slate-600'}>전환력:</span>
                        <span className={`ml-2 font-bold ${factCheck.fact_check?.conversion_score >= 70 ? 'text-green-500' : 'text-yellow-500'}`}>
                          {factCheck.fact_check?.conversion_score || 0}점
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className={`text-sm ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  수정 결과가 여기에 표시됩니다
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContentRefiner;
