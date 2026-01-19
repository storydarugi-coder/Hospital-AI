import React, { useState } from 'react';
import {
  calculateOverallSimilarity,
  getSimilarityLevel,
  findSimilarSentences,
} from '../services/similarityService';
import { prepareNaverBlogsForComparison } from '../services/naverSearchService';

interface SimilarityCheckerProps {
  onClose: () => void;
  darkMode?: boolean;
}

const SimilarityChecker: React.FC<SimilarityCheckerProps> = ({ onClose, darkMode = false }) => {
  const [mode, setMode] = useState<'web' | 'single'>('web');
  const [text1, setText1] = useState('');
  const [text2, setText2] = useState('');
  const [keywords, setKeywords] = useState('');
  const [result, setResult] = useState<any>(null);
  const [webResults, setWebResults] = useState<any[]>([]);
  const [isChecking, setIsChecking] = useState(false);

  // 단일 비교
  const handleSingleCheck = () => {
    if (!text1.trim() || !text2.trim()) {
      alert('비교할 텍스트를 모두 입력해주세요.');
      return;
    }

    setIsChecking(true);
    setTimeout(() => {
      const similarity = calculateOverallSimilarity(text1, text2);
      const level = getSimilarityLevel(similarity);
      const similarSentences = findSimilarSentences(text1, text2, 60);

      setResult({
        similarity,
        level,
        similarSentences,
        text1Length: text1.length,
        text2Length: text2.length,
      });
      setIsChecking(false);
    }, 500);
  };

  // 웹 검색 유사도 검사
  const handleWebCheck = async () => {
    if (!text1.trim()) {
      alert('검사할 텍스트를 입력해주세요.');
      return;
    }
    
    if (!keywords.trim()) {
      alert('검색 키워드를 입력해주세요.');
      return;
    }

    setIsChecking(true);
    setWebResults([]);
    
    try {
      // 구글 검색으로 블로그 찾기
      const blogs = await prepareNaverBlogsForComparison(keywords, 10);
      
      if (blogs.length === 0) {
        alert('검색 결과가 없습니다. 다른 키워드로 시도해주세요.');
        setIsChecking(false);
        return;
      }
      
      // 각 블로그와 유사도 비교
      const results = blogs.map(blog => {
        const similarity = calculateOverallSimilarity(text1, blog.text);
        const level = getSimilarityLevel(similarity);
        
        return {
          id: blog.id,
          title: blog.title,
          url: blog.url,
          blogger: blog.blogger,
          similarity,
          level,
          snippet: blog.text.substring(0, 150) + '...',
        };
      });
      
      // 유사도 높은 순으로 정렬
      results.sort((a, b) => b.similarity - a.similarity);
      setWebResults(results);
    } catch (error) {
      console.error('웹 검색 유사도 검사 오류:', error);
      alert('웹 검색에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className={`h-full rounded-[40px] shadow-2xl border flex flex-col overflow-hidden ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-purple-500 to-pink-600 text-white p-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">🔍 유사도 검사</h2>
          <p className="text-sm opacity-90">
            외부 글 전문을 붙여넣어 웹상의 유사한 콘텐츠를 검색합니다
          </p>
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        {/* 모드 선택 */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => {
              setMode('web');
              setResult(null);
              setWebResults([]);
            }}
            className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all ${
              mode === 'web'
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                : darkMode
                ? 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            🌐 웹 검색
          </button>
          <button
            onClick={() => {
              setMode('single');
              setResult(null);
              setWebResults([]);
            }}
            className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all ${
              mode === 'single'
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                : darkMode
                ? 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            📝 텍스트 비교
          </button>
        </div>

        {/* 웹 검색 모드 */}
        {mode === 'web' && (
          <div className="space-y-4">
            <div>
              <label className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                📄 검사할 텍스트 (외부 글 전문)
              </label>
              <textarea
                value={text1}
                onChange={(e) => setText1(e.target.value)}
                className={`w-full h-60 p-4 border-2 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none ${
                  darkMode 
                    ? 'bg-slate-700 border-slate-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
                placeholder="검사할 전문을 입력하세요. 구글 검색으로 유사한 웹사이트를 찾아 비교합니다..."
              />
              <p className={`text-sm mt-1 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                {text1.length}자
              </p>
            </div>

            <div>
              <label className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                🔑 검색 키워드
              </label>
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                className={`w-full p-4 border-2 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                  darkMode 
                    ? 'bg-slate-700 border-slate-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
                placeholder="예: 당뇨병 예방법"
              />
              <p className={`text-sm mt-1 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                이 키워드로 구글 검색 후 상위 10개 웹사이트와 비교합니다
              </p>
            </div>

            <button
              onClick={handleWebCheck}
              disabled={isChecking || !text1.trim() || !keywords.trim()}
              className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-600 text-white font-bold rounded-xl hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isChecking ? '🔍 웹 검색 중...' : '🔍 웹 검색 유사도 검사'}
            </button>
          </div>
        )}

        {/* 단일 비교 모드 */}
        {mode === 'single' && (
          <div className="space-y-4">
            <div>
              <label className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                📄 비교할 텍스트 1
              </label>
              <textarea
                value={text1}
                onChange={(e) => setText1(e.target.value)}
                className={`w-full h-40 p-4 border-2 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none ${
                  darkMode 
                    ? 'bg-slate-700 border-slate-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
                placeholder="첫 번째 텍스트를 입력하세요..."
              />
              <p className={`text-sm mt-1 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                {text1.length}자
              </p>
            </div>

            <div>
              <label className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                📄 비교할 텍스트 2
              </label>
              <textarea
                value={text2}
                onChange={(e) => setText2(e.target.value)}
                className={`w-full h-40 p-4 border-2 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none ${
                  darkMode 
                    ? 'bg-slate-700 border-slate-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
                placeholder="두 번째 텍스트를 입력하세요..."
              />
              <p className={`text-sm mt-1 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                {text2.length}자
              </p>
            </div>

            <button
              onClick={handleSingleCheck}
              disabled={isChecking || !text1.trim() || !text2.trim()}
              className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-600 text-white font-bold rounded-xl hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isChecking ? '🔍 검사 중...' : '🔍 유사도 검사 시작'}
            </button>
          </div>
        )}

        {/* 단일 비교 결과 */}
        {result && (
          <div className="mt-8 space-y-6">
            {/* 종합 점수 */}
            <div className={`p-6 rounded-2xl ${darkMode ? 'bg-slate-700' : 'bg-gradient-to-br from-purple-50 to-pink-50'}`}>
              <h3 className={`text-lg font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                📊 종합 유사도 점수
              </h3>
              <div className="flex items-center justify-center gap-8">
                <div className="text-center">
                  <div
                    className="text-6xl font-bold mb-2"
                    style={{ color: result.level.color }}
                  >
                    {result.similarity}%
                  </div>
                  <div
                    className="text-xl font-semibold px-4 py-2 rounded-lg"
                    style={{
                      backgroundColor: result.level.color + '20',
                      color: result.level.color,
                    }}
                  >
                    {result.level.label}
                  </div>
                </div>
              </div>
              <p className={`text-center mt-4 ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                {result.level.description}
              </p>
            </div>

            {/* 유사한 문장 */}
            {result.similarSentences.length > 0 && (
              <div className={`p-6 rounded-2xl border-2 ${darkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-gray-200'}`}>
                <h3 className={`text-lg font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                  🎯 유사한 문장 ({result.similarSentences.length}개)
                </h3>
                <div className="space-y-4 max-h-96 overflow-y-auto custom-scrollbar">
                  {result.similarSentences.slice(0, 10).map((pair: any, index: number) => (
                    <div
                      key={index}
                      className={`p-4 rounded-xl ${darkMode ? 'bg-slate-600' : 'bg-gray-50'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-sm font-semibold ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                          문장 {index + 1}
                        </span>
                        <span
                          className="text-sm font-bold px-3 py-1 rounded-full"
                          style={{
                            backgroundColor: getSimilarityLevel(pair.similarity).color + '20',
                            color: getSimilarityLevel(pair.similarity).color,
                          }}
                        >
                          {pair.similarity.toFixed(1)}% 유사
                        </span>
                      </div>
                      <div className="space-y-2">
                        <div className={`p-3 rounded-lg ${darkMode ? 'bg-purple-900' : 'bg-purple-50'}`}>
                          <p className={`text-sm ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                            {pair.sentence1}
                          </p>
                        </div>
                        <div className={`p-3 rounded-lg ${darkMode ? 'bg-pink-900' : 'bg-pink-50'}`}>
                          <p className={`text-sm ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                            {pair.sentence2}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 웹 검색 결과 */}
        {webResults.length > 0 && (
          <div className="mt-8 space-y-4">
            <h3 className={`text-lg font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
              🌐 웹 검색 유사도 결과 ({webResults.length}개)
            </h3>
            <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar">
              {webResults.map((item, index) => (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl border-2 hover:shadow-lg transition cursor-pointer ${
                    darkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-gray-200'
                  }`}
                  style={{ borderColor: item.level.color + '40' }}
                  onClick={() => window.open(item.url, '_blank')}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`text-2xl font-bold ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}>
                          #{index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <h4 className={`font-semibold truncate ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                            {item.title}
                          </h4>
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-purple-500 hover:underline truncate block"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {item.blogger}
                          </a>
                        </div>
                      </div>
                      <p className={`text-sm line-clamp-2 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                        {item.snippet}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div
                        className="text-3xl font-bold mb-1"
                        style={{ color: item.level.color }}
                      >
                        {item.similarity}%
                      </div>
                      <div
                        className="text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap"
                        style={{
                          backgroundColor: item.level.color + '20',
                          color: item.level.color,
                        }}
                      >
                        {item.level.label}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SimilarityChecker;
