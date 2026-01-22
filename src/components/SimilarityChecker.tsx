import React, { useState } from 'react';
import {
  calculateOverallSimilarity,
  getSimilarityLevel,
  findSimilarSentences,
} from '../services/similarityService';
import { prepareNaverBlogsForComparison } from '../services/naverSearchService';
import { checkContentSimilarity } from '../services/geminiService';

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
  const [checkingMessage, setCheckingMessage] = useState('');

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

  // 웹 검색 유사도 검사 - geminiService의 강력한 로직 사용!
  const handleWebCheck = async () => {
    if (!text1.trim()) {
      alert('검사할 텍스트를 입력해주세요.');
      return;
    }

    setIsChecking(true);
    setWebResults([]);
    setCheckingMessage('🔍 통합 유사도 검사 시작...');
    
    try {
      // geminiService의 checkContentSimilarity 사용 (자체 DB + Google 검색)
      const title = keywords.trim() || text1.substring(0, 50) + '...';
      
      const result = await checkContentSimilarity(
        text1,
        title,
        (msg) => {
          console.log('📊 유사도 검사:', msg);
          setCheckingMessage(msg);
        }
      );
      
      console.log('✅ 유사도 검사 완료:', result);
      
      // 결과 변환: geminiService 형식 → SimilarityChecker 형식
      const allMatches: any[] = [];
      
      // 자체 블로그 매칭 결과
      if (result.ownBlogMatches && result.ownBlogMatches.length > 0) {
        result.ownBlogMatches.forEach((match: any, index: number) => {
          // similarity 값 안전하게 처리
          const similarityValue = typeof match.similarity === 'number' && !isNaN(match.similarity)
            ? match.similarity
            : 0;
          const similarity = Math.round(similarityValue * 100);
          const level = getSimilarityLevel(similarity);
          
          allMatches.push({
            id: `own-${index}`,
            title: `[내 블로그] ${match.blog?.title || match.title || '제목 없음'}`,
            url: match.blog?.url || match.url || '#',
            blogger: '내 블로그',
            similarity,
            level,
            snippet: (match.blog?.content || match.content || '').substring(0, 150) + '...',
          });
        });
      }
      
      // 웹 검색 매칭 결과
      if (result.webSearchMatches && result.webSearchMatches.length > 0) {
        result.webSearchMatches.forEach((match: any, index: number) => {
          // similarity가 소수(0~1)면 100 곱하기, 이미 100점대면 그대로
          const similarity = match.similarity < 2 
            ? Math.round(match.similarity * 100) 
            : Math.round(match.similarity);
          const level = getSimilarityLevel(similarity);
          
          allMatches.push({
            id: `web-${index}`,
            title: match.title || '제목 없음',
            url: match.url || match.link || '#',
            blogger: match.source || '출처 불명',
            similarity,
            level,
            snippet: match.snippet || match.description || '내용 없음',
          });
        });
      }
      
      // 유사도 높은 순으로 정렬
      allMatches.sort((a, b) => b.similarity - a.similarity);
      
      setWebResults(allMatches);
      
      // 최종 결과 메시지
      if (result.status === 'HIGH_RISK') {
        setCheckingMessage(`⚠️ 유사도 위험: ${result.finalScore.toFixed(1)}점 - ${result.message}`);
      } else if (result.status === 'MEDIUM_RISK') {
        setCheckingMessage(`💡 주의 필요: ${result.finalScore.toFixed(1)}점 - ${result.message}`);
      } else if (result.status === 'ORIGINAL') {
        setCheckingMessage(`✅ 독창적: ${result.finalScore.toFixed(1)}점 - ${result.message}`);
      } else {
        setCheckingMessage(`📊 검사 완료: ${result.finalScore.toFixed(1)}점`);
      }
      
      setTimeout(() => setCheckingMessage(''), 3000);
      
      console.log('✅ 유사도 검사 완료:', allMatches.length, '개 결과');
    } catch (error) {
      console.error('웹 검색 유사도 검사 오류:', error);
      setCheckingMessage('❌ 검사 실패');
      alert('유사도 검사에 실패했습니다.\n\n원인: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* 헤더 */}
      <div className="mb-4">
        <h2 className={`text-xl font-bold mb-1 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
          🔍 유사도 검사
        </h2>
        <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
          외부 글 전문을 검사합니다
        </p>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* 모드 선택 */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => {
              setMode('web');
              setResult(null);
              setWebResults([]);
            }}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
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
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
              mode === 'single'
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                : darkMode
                ? 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            📝 텍스트
          </button>
        </div>

        {/* 웹 검색 모드 */}
        {mode === 'web' && (
          <div className="space-y-3">
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                📄 검사할 텍스트
              </label>
              <textarea
                value={text1}
                onChange={(e) => setText1(e.target.value)}
                className={`w-full h-32 p-3 text-sm border-2 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none ${
                  darkMode 
                    ? 'bg-slate-700 border-slate-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
                placeholder="외부 글 전문을 입력하세요..."
              />
              <p className={`text-xs mt-1 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                {text1.length}자
              </p>
            </div>

            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                🔑 검색 키워드 (선택사항 - 비워두면 AI가 자동 추출)
              </label>
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                className={`w-full p-3 text-sm border-2 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                  darkMode 
                    ? 'bg-slate-700 border-slate-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
                placeholder='예: "당뇨병 예방법" 병원이름 (비워두면 자동 추출)'
              />
              <p className={`text-xs mt-1 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                💡 <strong>AI 자동 추출:</strong> 비워두면 글 내용을 분석하여 자동으로 키워드를 찾습니다
              </p>
              <p className={`text-xs mt-0.5 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                📌 <strong>수동 입력:</strong> 특정 키워드로 검색하려면 직접 입력하세요
              </p>
            </div>

            <button
              onClick={handleWebCheck}
              disabled={isChecking || !text1.trim()}
              className="w-full py-3 text-sm bg-gradient-to-r from-purple-500 to-pink-600 text-white font-bold rounded-lg hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isChecking ? (checkingMessage || '🔍 검색 중...') : '🔍 웹 검색 시작'}
            </button>
          </div>
        )}

        {/* 웹 검색 진행 상태 */}
        {isChecking && checkingMessage && mode === 'web' && (
          <div className={`mt-3 p-3 rounded-lg ${darkMode ? 'bg-slate-700' : 'bg-blue-50'}`}>
            <div className="flex items-center gap-2">
              <div className="animate-spin">⏳</div>
              <span className={`text-sm ${darkMode ? 'text-slate-300' : 'text-blue-700'}`}>
                {checkingMessage}
              </span>
            </div>
          </div>
        )}

        {/* 단일 비교 모드 */}
        {mode === 'single' && (
          <div className="space-y-3">
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                📄 텍스트 1
              </label>
              <textarea
                value={text1}
                onChange={(e) => setText1(e.target.value)}
                className={`w-full h-28 p-3 text-sm border-2 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none ${
                  darkMode 
                    ? 'bg-slate-700 border-slate-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
                placeholder="첫 번째 텍스트..."
              />
              <p className={`text-xs mt-1 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                {text1.length}자
              </p>
            </div>

            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                📄 텍스트 2
              </label>
              <textarea
                value={text2}
                onChange={(e) => setText2(e.target.value)}
                className={`w-full h-28 p-3 text-sm border-2 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none ${
                  darkMode 
                    ? 'bg-slate-700 border-slate-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
                placeholder="두 번째 텍스트..."
              />
              <p className={`text-xs mt-1 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                {text2.length}자
              </p>
            </div>

            <button
              onClick={handleSingleCheck}
              disabled={isChecking || !text1.trim() || !text2.trim()}
              className="w-full py-3 text-sm bg-gradient-to-r from-purple-500 to-pink-600 text-white font-bold rounded-lg hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isChecking ? '🔍 검사 중...' : '🔍 검사 시작'}
            </button>
          </div>
        )}

        {/* 단일 비교 결과 */}
        {result && (
          <div className="mt-4 space-y-3">
            {/* 종합 점수 */}
            <div className={`p-4 rounded-lg ${darkMode ? 'bg-slate-700' : 'bg-gradient-to-br from-purple-50 to-pink-50'}`}>
              <h3 className={`text-sm font-bold mb-2 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                📊 종합 점수
              </h3>
              <div className="text-center">
                <div
                  className="text-4xl font-bold mb-1"
                  style={{ color: result.level.color }}
                >
                  {result.similarity}%
                </div>
                <div
                  className="text-xs font-semibold px-3 py-1 rounded-full inline-block"
                  style={{
                    backgroundColor: result.level.color + '20',
                    color: result.level.color,
                  }}
                >
                  {result.level.label}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 웹 검색 결과 */}
        {webResults.length > 0 && (
          <div className="mt-4 space-y-2">
            <h3 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
              🌐 검색 결과 ({webResults.length}개)
            </h3>
            <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
              {webResults.map((item, index) => (
                <div
                  key={item.id}
                  className={`p-3 rounded-lg border hover:shadow-md transition cursor-pointer ${
                    darkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-gray-200'
                  }`}
                  style={{ borderColor: item.level.color + '40' }}
                  onClick={() => window.open(item.url, '_blank')}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className={`text-xs font-semibold truncate mb-1 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                        {item.title}
                      </h4>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-purple-500 hover:underline truncate block"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {item.blogger}
                      </a>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div
                        className="text-xl font-bold"
                        style={{ color: item.level.color }}
                      >
                        {item.similarity}%
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
