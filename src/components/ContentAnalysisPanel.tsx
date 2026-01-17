/**
 * 콘텐츠 실시간 분석 패널
 * - 금지어 스캔 + 하이라이트
 * - SEO 점수 시각화
 * - AI 냄새 분석
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  analyzeContent, 
  FullAnalysisReport, 
  ScanResult,
  AiSmellIssue 
} from '../utils/medicalLawChecker';

interface ContentAnalysisPanelProps {
  html: string;
  title: string;
  keyword: string;
  darkMode?: boolean;
  onHighlightToggle?: (showHighlight: boolean) => void;
  getHighlightedHtml?: (html: string) => void;
}

// 점수 게이지 컴포넌트 (외부로 분리하여 매 렌더시 재생성 방지)
const ScoreGauge = ({ score, label, color, darkMode }: { score: number; label: string; color: string; darkMode: boolean }) => (
  <div className="flex flex-col items-center gap-1">
    <div className="relative w-12 h-12">
      <svg className="w-full h-full transform -rotate-90">
        <circle
          cx="24" cy="24" r="20"
          fill="none"
          stroke={darkMode ? '#374151' : '#E5E7EB'}
          strokeWidth="4"
        />
        <circle
          cx="24" cy="24" r="20"
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={`${score * 1.256} 125.6`}
          strokeLinecap="round"
        />
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center text-xs font-black ${darkMode ? 'text-white' : 'text-slate-700'}`}>
        {score}
      </span>
    </div>
    <span className={`text-[10px] font-bold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{label}</span>
  </div>
);

const ContentAnalysisPanel: React.FC<ContentAnalysisPanelProps> = ({
  html,
  title,
  keyword,
  darkMode = false,
  onHighlightToggle,
  getHighlightedHtml
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'medical' | 'seo' | 'ai'>('overview');
  const [showHighlight, setShowHighlight] = useState(false);
  
  // 분석 실행 (메모이제이션)
  const analysis: FullAnalysisReport = useMemo(() => {
    return analyzeContent(html, title, keyword);
  }, [html, title, keyword]);
  
  // 하이라이트 토글 시 부모에 알림
  useEffect(() => {
    onHighlightToggle?.(showHighlight);
    if (showHighlight && getHighlightedHtml) {
      getHighlightedHtml(analysis.medicalLaw.highlightedHtml);
    }
  }, [showHighlight, analysis.medicalLaw.highlightedHtml, onHighlightToggle, getHighlightedHtml]);
  
  // 등급별 색상
  const gradeColors = {
    A: 'text-emerald-500',
    B: 'text-blue-500',
    C: 'text-yellow-500',
    D: 'text-orange-500',
    F: 'text-red-500'
  };
  
  const gradeBgColors = {
    A: 'bg-emerald-500',
    B: 'bg-blue-500',
    C: 'bg-yellow-500',
    D: 'bg-orange-500',
    F: 'bg-red-500'
  };
  
  // 심각도별 색상 (현재 미사용이지만 향후 확장용으로 유지)
  const _severityColors = {
    critical: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
    high: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
    medium: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300' },
    low: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' }
  };
  
  // 최소화된 뷰
  if (!isExpanded) {
    return (
      <div 
        onClick={() => setIsExpanded(true)}
        className={`cursor-pointer rounded-2xl border p-3 transition-all hover:shadow-lg ${
          darkMode 
            ? 'bg-slate-800 border-slate-700 hover:border-slate-600' 
            : 'bg-white border-slate-200 hover:border-slate-300'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black text-white ${gradeBgColors[analysis.overallGrade]}`}>
              {analysis.overallGrade}
            </div>
            <div>
              <div className={`text-sm font-black ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                콘텐츠 점수 {analysis.overallScore}점
              </div>
              <div className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {analysis.topIssues[0]}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* 미니 점수 표시 */}
            <div className="hidden sm:flex items-center gap-3 mr-2">
              <div className="text-center">
                <div className={`text-xs font-black ${analysis.seo.totalScore >= 80 ? 'text-emerald-500' : analysis.seo.totalScore >= 60 ? 'text-yellow-500' : 'text-red-500'}`}>
                  {analysis.seo.totalScore}
                </div>
                <div className={`text-[9px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>SEO</div>
              </div>
              <div className="text-center">
                <div className={`text-xs font-black ${analysis.aiSmell.totalScore >= 80 ? 'text-emerald-500' : analysis.aiSmell.totalScore >= 60 ? 'text-yellow-500' : 'text-red-500'}`}>
                  {analysis.aiSmell.totalScore}
                </div>
                <div className={`text-[9px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>자연스러움</div>
              </div>
            </div>
            
            <span className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>클릭하여 상세보기 ▼</span>
          </div>
        </div>
      </div>
    );
  }
  
  // 확장된 뷰
  return (
    <div className={`rounded-2xl border shadow-xl transition-all ${
      darkMode 
        ? 'bg-slate-800 border-slate-700' 
        : 'bg-white border-slate-200'
    }`}>
      {/* 헤더 */}
      <div className={`flex items-center justify-between p-4 border-b ${darkMode ? 'border-slate-700' : 'border-slate-100'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black text-white ${gradeBgColors[analysis.overallGrade]}`}>
            {analysis.overallGrade}
          </div>
          <div>
            <div className={`text-lg font-black ${darkMode ? 'text-white' : 'text-slate-800'}`}>
              콘텐츠 분석 리포트
            </div>
            <div className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              종합 점수 <span className={gradeColors[analysis.overallGrade]}>{analysis.overallScore}점</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* 하이라이트 토글 */}
          <button
            onClick={(e) => { e.stopPropagation(); setShowHighlight(!showHighlight); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              showHighlight
                ? 'bg-red-500 text-white'
                : darkMode 
                  ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {showHighlight ? '🔴 하이라이트 ON' : '⚪ 하이라이트'}
          </button>
          
          <button
            onClick={() => setIsExpanded(false)}
            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              darkMode 
                ? 'hover:bg-slate-700 text-slate-400' 
                : 'hover:bg-slate-100 text-slate-500'
            }`}
          >
            ▲
          </button>
        </div>
      </div>
      
      {/* 점수 요약 */}
      <div className={`flex justify-around p-4 border-b ${darkMode ? 'border-slate-700' : 'border-slate-100'}`}>
        <ScoreGauge 
          score={analysis.seo.totalScore} 
          label="SEO" 
          color={analysis.seo.totalScore >= 80 ? '#10B981' : analysis.seo.totalScore >= 60 ? '#F59E0B' : '#EF4444'}
          darkMode={darkMode}
        />
        <ScoreGauge 
          score={analysis.aiSmell.totalScore} 
          label="자연스러움" 
          color={analysis.aiSmell.totalScore >= 80 ? '#10B981' : analysis.aiSmell.totalScore >= 60 ? '#F59E0B' : '#EF4444'}
          darkMode={darkMode}
        />
      </div>
      
      {/* 탭 */}
      <div className={`flex border-b ${darkMode ? 'border-slate-700' : 'border-slate-100'}`}>
        {[
          { id: 'overview', label: '요약', icon: '📊' },
          { id: 'seo', label: 'SEO', icon: '🔍' },
          { id: 'ai', label: 'AI냄새', icon: '🤖', count: analysis.aiSmell.issues.length }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex-1 py-2.5 text-xs font-bold transition-all flex items-center justify-center gap-1 ${
              activeTab === tab.id
                ? darkMode 
                  ? 'bg-slate-700 text-emerald-400 border-b-2 border-emerald-400' 
                  : 'bg-emerald-50 text-emerald-600 border-b-2 border-emerald-500'
                : darkMode
                  ? 'text-slate-400 hover:text-slate-300'
                  : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${
                tab.id === 'medical' 
                  ? 'bg-red-500 text-white' 
                  : 'bg-orange-500 text-white'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>
      
      {/* 탭 내용 */}
      <div className="p-4 max-h-[400px] overflow-y-auto custom-scrollbar">
        {/* 요약 탭 */}
        {activeTab === 'overview' && (
          <div className="space-y-3">
            {analysis.topIssues.map((issue, idx) => (
              <div 
                key={idx}
                className={`p-3 rounded-xl text-sm ${
                  issue.includes('🚨') 
                    ? darkMode ? 'bg-red-900/30 text-red-300' : 'bg-red-50 text-red-700'
                    : issue.includes('⚠️')
                    ? darkMode ? 'bg-orange-900/30 text-orange-300' : 'bg-orange-50 text-orange-700'
                    : issue.includes('📉') || issue.includes('🤖')
                    ? darkMode ? 'bg-yellow-900/30 text-yellow-300' : 'bg-yellow-50 text-yellow-700'
                    : darkMode ? 'bg-emerald-900/30 text-emerald-300' : 'bg-emerald-50 text-emerald-700'
                }`}
              >
                {issue}
              </div>
            ))}
            
            {/* 추천 개선사항 */}
            {(analysis.seo.suggestions.length > 0 || analysis.aiSmell.suggestions.length > 0) && (
              <div className={`mt-4 p-3 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                <div className={`text-xs font-black mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  💡 개선 제안
                </div>
                <ul className={`text-xs space-y-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {analysis.seo.suggestions.slice(0, 2).map((s, i) => (
                    <li key={`seo-${i}`}>• {s}</li>
                  ))}
                  {analysis.aiSmell.suggestions.slice(0, 2).map((s, i) => (
                    <li key={`ai-${i}`}>• {s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        
        {/* SEO 탭 */}
        {activeTab === 'seo' && (
          <div className="space-y-4">
            {/* 세부 점수 */}
            <div className="grid grid-cols-2 gap-2">
              <SeoScoreItem label="제목" score={analysis.seo.titleScore} darkMode={darkMode} />
              <SeoScoreItem label="키워드 밀도" score={analysis.seo.keywordDensityScore} darkMode={darkMode} />
              <SeoScoreItem label="첫 문단" score={analysis.seo.firstParagraphScore} darkMode={darkMode} />
              <SeoScoreItem label="소제목" score={analysis.seo.subheadingScore} darkMode={darkMode} />
            </div>
            
            {/* 세부 정보 */}
            <div className={`p-3 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
              <div className={`text-xs font-black mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                📈 세부 정보
              </div>
              <div className={`grid grid-cols-2 gap-2 text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                <div>제목 길이: <span className="font-bold">{analysis.seo.details.titleLength}자</span></div>
                <div>총 글자수: <span className="font-bold">{analysis.seo.details.totalCharCount.toLocaleString()}자</span></div>
                <div>키워드 횟수: <span className="font-bold">{analysis.seo.details.keywordCount}회</span></div>
                <div>키워드 밀도: <span className="font-bold">{analysis.seo.details.keywordDensity.toFixed(1)}%</span></div>
                <div>소제목 수: <span className="font-bold">{analysis.seo.details.subheadingCount}개</span></div>
                <div>평균 문장: <span className="font-bold">{Math.round(analysis.seo.details.avgSentenceLength)}자</span></div>
              </div>
            </div>
            
            {/* 제안 */}
            {analysis.seo.suggestions.length > 0 && (
              <div className={`p-3 rounded-xl ${darkMode ? 'bg-yellow-900/20' : 'bg-yellow-50'}`}>
                <div className={`text-xs font-black mb-2 ${darkMode ? 'text-yellow-400' : 'text-yellow-700'}`}>
                  💡 SEO 개선 제안
                </div>
                <ul className={`text-xs space-y-1 ${darkMode ? 'text-yellow-300' : 'text-yellow-600'}`}>
                  {analysis.seo.suggestions.map((s, i) => (
                    <li key={i}>• {s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        
        {/* AI 냄새 탭 */}
        {activeTab === 'ai' && (
          <div className="space-y-3">
            {analysis.aiSmell.issues.length === 0 ? (
              <div className={`text-center py-8 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                <div className="text-4xl mb-2">✨</div>
                <div className="font-bold">자연스러운 글입니다!</div>
              </div>
            ) : (
              analysis.aiSmell.issues.map((issue, idx) => (
                <AiSmellCard key={idx} issue={issue} darkMode={darkMode} />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// 금지어 카드 컴포넌트 (향후 금지어 상세 표시 UI에 활용)
const _ViolationCard: React.FC<{ violation: ScanResult; darkMode: boolean }> = ({ violation, darkMode }) => {
  const severityLabels = {
    critical: '🚨 중대',
    high: '⚠️ 높음',
    medium: '⚡ 보통',
    low: '💡 낮음'
  };
  
  const severityColors = {
    critical: darkMode ? 'bg-red-900/30 border-red-700' : 'bg-red-50 border-red-200',
    high: darkMode ? 'bg-orange-900/30 border-orange-700' : 'bg-orange-50 border-orange-200',
    medium: darkMode ? 'bg-yellow-900/30 border-yellow-700' : 'bg-yellow-50 border-yellow-200',
    low: darkMode ? 'bg-blue-900/30 border-blue-700' : 'bg-blue-50 border-blue-200'
  };
  
  return (
    <div className={`p-3 rounded-xl border ${severityColors[violation.severity]}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
            violation.severity === 'critical' ? 'bg-red-500 text-white' :
            violation.severity === 'high' ? 'bg-orange-500 text-white' :
            violation.severity === 'medium' ? 'bg-yellow-500 text-white' :
            'bg-blue-500 text-white'
          }`}>
            {severityLabels[violation.severity]}
          </span>
          <span className={`font-black ${darkMode ? 'text-white' : 'text-slate-800'}`}>
            "{violation.word}"
          </span>
          <span className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            ({violation.count}회)
          </span>
        </div>
      </div>
      
      <div className={`text-xs mb-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
        {violation.reason}
      </div>
      
      <div className={`flex items-center gap-2 text-xs ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
        <span className="font-bold">→ 대체어:</span>
        {violation.replacement.map((r, i) => (
          <span 
            key={i}
            className={`px-2 py-0.5 rounded cursor-pointer hover:opacity-80 ${
              darkMode ? 'bg-emerald-900/50' : 'bg-emerald-100'
            }`}
            onClick={() => navigator.clipboard.writeText(r)}
            title="클릭하여 복사"
          >
            {r}
          </span>
        ))}
      </div>
    </div>
  );
};

// SEO 점수 아이템
const SeoScoreItem: React.FC<{ label: string; score: number; darkMode: boolean }> = ({ label, score, darkMode }) => (
  <div className={`p-2 rounded-lg ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
    <div className="flex items-center justify-between">
      <span className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{label}</span>
      <span className={`text-sm font-black ${
        score >= 80 ? 'text-emerald-500' : score >= 60 ? 'text-yellow-500' : 'text-red-500'
      }`}>
        {score}
      </span>
    </div>
    <div className={`mt-1 h-1.5 rounded-full ${darkMode ? 'bg-slate-600' : 'bg-slate-200'}`}>
      <div 
        className={`h-full rounded-full transition-all ${
          score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
        }`}
        style={{ width: `${score}%` }}
      />
    </div>
  </div>
);

// AI 냄새 카드
const AiSmellCard: React.FC<{ issue: AiSmellIssue; darkMode: boolean }> = ({ issue, darkMode }) => {
  const severityColors = {
    high: darkMode ? 'bg-red-900/30 border-red-700' : 'bg-red-50 border-red-200',
    medium: darkMode ? 'bg-yellow-900/30 border-yellow-700' : 'bg-yellow-50 border-yellow-200',
    low: darkMode ? 'bg-blue-900/30 border-blue-700' : 'bg-blue-50 border-blue-200'
  };
  
  const typeLabels = {
    repetition: '🔄 반복',
    structure: '🏗️ 구조',
    expression: '💬 표현',
    ending: '📝 종결어미'
  };
  
  return (
    <div className={`p-3 rounded-xl border ${severityColors[issue.severity]}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
          darkMode ? 'bg-slate-600 text-slate-200' : 'bg-slate-200 text-slate-700'
        }`}>
          {typeLabels[issue.type]}
        </span>
        <span className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>
          {issue.description}
        </span>
      </div>
      
      {issue.examples.length > 0 && (
        <div className={`text-xs mb-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          예시: {issue.examples.slice(0, 3).join(', ')}
        </div>
      )}
      
      <div className={`text-xs ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
        💡 {issue.fixSuggestion}
      </div>
    </div>
  );
};

export default ContentAnalysisPanel;
