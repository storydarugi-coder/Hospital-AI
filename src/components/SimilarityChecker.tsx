import React, { useState } from 'react';
import {
  calculateOverallSimilarity,
  getSimilarityLevel,
  findSimilarSentences,
  checkSimilarityBatch,
} from '../services/similarityService';

interface SimilarityCheckerProps {
  onClose: () => void;
  savedContents?: Array<{ id: string; content: string; title?: string }>;
}

const SimilarityChecker: React.FC<SimilarityCheckerProps> = ({ onClose, savedContents = [] }) => {
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [text1, setText1] = useState('');
  const [text2, setText2] = useState('');
  const [result, setResult] = useState<any>(null);
  const [batchResults, setBatchResults] = useState<any[]>([]);
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

  // 배치 비교 (저장된 모든 글과 비교)
  const handleBatchCheck = () => {
    if (!text1.trim()) {
      alert('비교할 텍스트를 입력해주세요.');
      return;
    }

    if (savedContents.length === 0) {
      alert('비교할 저장된 글이 없습니다.');
      return;
    }

    setIsChecking(true);
    setTimeout(() => {
      const results = checkSimilarityBatch(text1, savedContents);
      setBatchResults(results);
      setIsChecking(false);
    }, 500);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6 rounded-t-2xl">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold mb-2">🔍 유사도 검사</h2>
              <p className="text-sm opacity-90">
                AI가 생성한 글 또는 외부 글의 유사도를 검사합니다
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* 본문 */}
        <div className="p-6">
          {/* 모드 선택 */}
          <div className="flex gap-4 mb-6">
            <button
              onClick={() => {
                setMode('single');
                setResult(null);
                setBatchResults([]);
              }}
              className={`flex-1 py-3 px-6 rounded-xl font-semibold transition ${
                mode === 'single'
                  ? 'bg-blue-500 text-white shadow-lg'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              📝 단일 비교
            </button>
            <button
              onClick={() => {
                setMode('batch');
                setResult(null);
                setBatchResults([]);
              }}
              className={`flex-1 py-3 px-6 rounded-xl font-semibold transition ${
                mode === 'batch'
                  ? 'bg-blue-500 text-white shadow-lg'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              📚 배치 비교 ({savedContents.length}개)
            </button>
          </div>

          {/* 단일 비교 모드 */}
          {mode === 'single' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  📄 비교할 텍스트 1
                </label>
                <textarea
                  value={text1}
                  onChange={(e) => setText1(e.target.value)}
                  className="w-full h-40 p-4 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
                  placeholder="첫 번째 텍스트를 입력하세요..."
                />
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {text1.length}자
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  📄 비교할 텍스트 2
                </label>
                <textarea
                  value={text2}
                  onChange={(e) => setText2(e.target.value)}
                  className="w-full h-40 p-4 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
                  placeholder="두 번째 텍스트를 입력하세요..."
                />
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {text2.length}자
                </p>
              </div>

              <button
                onClick={handleSingleCheck}
                disabled={isChecking || !text1.trim() || !text2.trim()}
                className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold rounded-xl hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isChecking ? '🔍 검사 중...' : '🔍 유사도 검사 시작'}
              </button>
            </div>
          )}

          {/* 배치 비교 모드 */}
          {mode === 'batch' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  📄 검사할 텍스트 (외부 글 또는 생성한 글)
                </label>
                <textarea
                  value={text1}
                  onChange={(e) => setText1(e.target.value)}
                  className="w-full h-60 p-4 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
                  placeholder="검사할 텍스트를 입력하세요. 저장된 모든 글과 비교됩니다..."
                />
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {text1.length}자 • {savedContents.length}개 글과 비교 예정
                </p>
              </div>

              <button
                onClick={handleBatchCheck}
                disabled={isChecking || !text1.trim() || savedContents.length === 0}
                className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold rounded-xl hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isChecking ? '🔍 검사 중...' : `🔍 ${savedContents.length}개 글과 비교하기`}
              </button>
            </div>
          )}

          {/* 단일 비교 결과 */}
          {result && (
            <div className="mt-8 space-y-6">
              {/* 종합 점수 */}
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-700 dark:to-gray-600 p-6 rounded-2xl">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">
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
                <p className="text-center text-gray-700 dark:text-gray-300 mt-4">
                  {result.level.description}
                </p>
              </div>

              {/* 유사한 문장 */}
              {result.similarSentences.length > 0 && (
                <div className="bg-white dark:bg-gray-700 p-6 rounded-2xl border-2 border-gray-200 dark:border-gray-600">
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">
                    🎯 유사한 문장 ({result.similarSentences.length}개)
                  </h3>
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {result.similarSentences.slice(0, 10).map((pair: any, index: number) => (
                      <div
                        key={index}
                        className="bg-gray-50 dark:bg-gray-600 p-4 rounded-xl"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
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
                          <div className="bg-blue-50 dark:bg-blue-900 p-3 rounded-lg">
                            <p className="text-sm text-gray-700 dark:text-gray-200">
                              {pair.sentence1}
                            </p>
                          </div>
                          <div className="bg-purple-50 dark:bg-purple-900 p-3 rounded-lg">
                            <p className="text-sm text-gray-700 dark:text-gray-200">
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

          {/* 배치 비교 결과 */}
          {batchResults.length > 0 && (
            <div className="mt-8 space-y-4">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">
                📊 유사도 검사 결과 ({batchResults.length}개)
              </h3>
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {batchResults.map((item, index) => (
                  <div
                    key={item.id}
                    className="bg-white dark:bg-gray-700 p-4 rounded-xl border-2 hover:shadow-lg transition"
                    style={{ borderColor: item.level.color + '40' }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl font-bold text-gray-400">
                            #{index + 1}
                          </span>
                          <div>
                            <h4 className="font-semibold text-gray-800 dark:text-white">
                              {item.title || `글 ${item.id.slice(0, 8)}`}
                            </h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {item.level.description}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className="text-3xl font-bold mb-1"
                          style={{ color: item.level.color }}
                        >
                          {item.similarity}%
                        </div>
                        <div
                          className="text-sm font-semibold px-3 py-1 rounded-full"
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
    </div>
  );
};

export default SimilarityChecker;
