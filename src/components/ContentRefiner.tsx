import React, { useState, useRef, useEffect } from 'react';
import { refineContentByMedicalLaw } from '../services/geminiService';
import { getAiClient } from '../services/geminiService';
import { SYSTEM_PROMPT, getStage2_AiRemovalAndCompliance } from '../lib/gpt52-prompts-staged';
import { applyThemeToHtml } from '../utils/cssThemes';
import type { CssTheme } from '../types';

interface ContentRefinerProps {
  onClose: () => void;
  onNavigate?: (tab: 'blog' | 'card_news' | 'press') => void;
  darkMode?: boolean;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const ContentRefiner: React.FC<ContentRefinerProps> = ({ onClose, onNavigate, darkMode = false }) => {
  const [mode, setMode] = useState<'auto' | 'chat'>('auto');
  const [content, setContent] = useState('');
  const [refinedContent, setRefinedContent] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [factCheck, setFactCheck] = useState<any>(null);
  
  // 채팅 모드 상태
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatTextareaRef = useRef<HTMLTextAreaElement>(null);

  // 채팅 스크롤
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Textarea 자동 높이 조절
  useEffect(() => {
    if (chatTextareaRef.current) {
      chatTextareaRef.current.style.height = 'auto';
      chatTextareaRef.current.style.height = `${Math.min(chatTextareaRef.current.scrollHeight, 120)}px`;
    }
  }, [chatInput]);

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
      
      // 의료광고법 기준으로 자동 수정
      const result = await refineContentByMedicalLaw(content, (msg) => {
        console.log('📍', msg);
      });
      
      setRefinedContent(result.refinedContent);
      setFactCheck(result.fact_check);
      
      console.log('✅ AI 정밀보정 완료');
    } catch (error) {
      console.error('❌ AI 정밀보정 실패:', error);
      alert('AI 정밀보정에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsRefining(false);
    }
  };

  const handleChatSubmit = async () => {
    if (!chatInput.trim()) return;
    if (!refinedContent) {
      alert('먼저 자동 보정을 실행해주세요.');
      return;
    }

    const userMessage: ChatMessage = {
      role: 'user',
      content: chatInput,
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsChatting(true);

    try {
      const ai = getAiClient();
      
      // URL 패턴 감지 (http://, https://, www.)
      const urlPattern = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/gi;
      const urls = chatInput.match(urlPattern);
      
      let crawledContent = '';
      
      // URL이 있으면 크롤링 시도
      if (urls && urls.length > 0) {
        console.log('🕷️ URL 감지:', urls);
        
        for (const url of urls) {
          try {
            // www로 시작하면 https:// 추가
            const fullUrl = url.startsWith('www.') ? `https://${url}` : url;
            
            console.log('🔍 크롤링 시작:', fullUrl);
            
            const response = await fetch('/api/crawler', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ url: fullUrl }),
            });
            
            if (response.ok) {
              const data = await response.json();
              crawledContent += `\n\n[${fullUrl}에서 크롤링한 내용]\n${data.content}\n`;
              console.log('✅ 크롤링 성공:', data.content.substring(0, 100));
            } else {
              console.warn('⚠️ 크롤링 실패:', fullUrl, response.status);
              crawledContent += `\n\n[${fullUrl} 크롤링 실패: 접근 불가]\n`;
            }
          } catch (error) {
            console.error('❌ 크롤링 에러:', error);
            crawledContent += `\n\n[크롤링 중 오류 발생]\n`;
          }
        }
      }
      
      // 사용자 요청 분석: 확장 요청인지 확인
      const isExpandRequest = /자세히|자세하게|더 쓰|길게|확장|추가|더 설명|상세|구체적/.test(chatInput);
      
      // Stage 2 프롬프트 사용 (자동 보정과 동일한 기준 적용)
      const stage2Prompt = getStage2_AiRemovalAndCompliance(refinedContent.length);
      
      const prompt = `${SYSTEM_PROMPT}

${stage2Prompt}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 미션: 사용자 요청 정확히 이해하고 실행
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[현재 콘텐츠]
${refinedContent}

[사용자 요청]
${chatInput}
${crawledContent ? `\n\n[크롤링한 웹사이트 내용]\n${crawledContent}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 핵심 원칙
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚨 **중복 절대 금지** (최우선!)
   ❌ 같은 내용을 다른 표현으로 반복 금지!
   ❌ "즉", "다시 말해", "달리 표현하면" 같은 반복 연결어 금지!
   
   예시:
   ❌ "혈당이 오르면 피로합니다. 다시 말해 혈당 변화로 몸이 무겁습니다."
   ✅ "혈당이 오르면 피로합니다. 지속되면 집중력도 떨어집니다."
   
   **각 문단은 새로운 정보를 제공해야 함!**

1️⃣ **사용자 요청만 정확히 수행**
   • 요청하지 않은 부분은 절대 수정 금지
   • 전체를 다시 쓰지 말 것
   • 최소한의 수정으로 목표 달성

${isExpandRequest ? `
2️⃣ **내용 확장 모드 활성화**
   ✅ 확장 허용: 원본 +50%까지
   🔍 Google Search 필수:
      • "질병관리청 [검색어]"
      • "보건복지부 [검색어]"
      • 대한의학회, 대한[전문과]학회
   ✅ 검색 결과 기반으로 정확한 정보 추가
   ✅ 출처 명시 금지 (사실만 서술)
   ❌ 전체 확장 금지 (요청 부분만!)
   ❌ 중복 내용 추가 금지! (새로운 정보만!)
` : `
2️⃣ **최소 수정 모드**
   • 원본 길이 ±20% 유지
   • 요청 부분만 수정
   • 불필요한 변경 금지
`}

3️⃣ **의료광고법 준수 (시스템 프롬프트 참조)**
   ❌ 단정 표현: "치료", "개선", "효과"
   ❌ 수치/통계: "90%", "3일 만에"
   ❌ 출처 명시: "질병관리청에 따르면"
   ✅ 가능성 표현: "도움이 될 수 있습니다"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 Google Search 활용
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• 질병관리청, 보건복지부에서 사실 확인
• 잘못된 의료 정보는 반드시 수정
• 검색 결과 출처는 절대 명시 금지

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ 작업 체크리스트
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

□ **중복 없음?** (같은 내용 반복 금지! 각 문단 새로운 정보!)
□ 사용자 요청만 정확히 수행?
${isExpandRequest ? '□ Google Search로 정확한 정보 추가?' : '□ 원본 길이 ±20% 유지?'}
□ 요청하지 않은 부분 수정 안 함?
□ 의료광고법 준수? (시스템 프롬프트의 모든 금지어 체크!)
□ 금지어 사용 안 함?
□ 자연스러움 유지?

수정된 HTML 콘텐츠만 반환해주세요 (설명 없이).`;

      const result = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }] // Google Search 활성화
        }
      });

      const response = result.text || '';
      
      // 크롤링 성공 메시지 생성
      let responseMessage = '수정 완료! 오른쪽 콘텐츠를 확인해주세요.';
      if (urls && urls.length > 0) {
        const successCount = (crawledContent.match(/크롤링한 내용/g) || []).length;
        const failCount = (crawledContent.match(/크롤링 실패/g) || []).length;
        
        if (successCount > 0) {
          responseMessage = `✅ ${successCount}개 사이트 크롤링 완료!\n수정된 콘텐츠를 확인해주세요.`;
        }
        if (failCount > 0) {
          responseMessage += `\n⚠️ ${failCount}개 사이트는 접근 불가`;
        }
      }
      
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: responseMessage,
        timestamp: new Date()
      };

      setChatMessages(prev => [...prev, assistantMessage]);
      setRefinedContent(response);
      
    } catch (error) {
      console.error('❌ 채팅 수정 실패:', error);
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: '죄송합니다. 수정에 실패했습니다. 다시 시도해주세요.',
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsChatting(false);
    }
  };

  const copyToClipboard = () => {
    if (refinedContent) {
      try {
        // HTML 엔티티 디코딩
        const parser = new DOMParser();
        const doc = parser.parseFromString(refinedContent, 'text/html');
        const decodedContent = doc.body.innerHTML;
        
        // 맑은 고딕 12pt로 복사
        const cleanHtml = decodedContent
          .replace(/<p>/g, '<p style="font-family: \'맑은 고딕\', \'Malgun Gothic\', sans-serif; font-size: 12pt; margin: 0 0 1em 0; line-height: 1.6;">')
          .replace(/<ul>/g, '<ul style="font-family: \'맑은 고딕\', \'Malgun Gothic\', sans-serif; font-size: 12pt; margin: 0 0 1em 0; padding-left: 1.5em; line-height: 1.6;">')
          .replace(/<li>/g, '<li style="font-family: \'맑은 고딕\', \'Malgun Gothic\', sans-serif; font-size: 12pt; margin: 0.25em 0; line-height: 1.6;">');
        
        // Clipboard API 사용 (권한 팝업 없음)
        const blob = new Blob([cleanHtml], { type: 'text/html' });
        const blobText = new Blob([decodedContent.replace(/<[^>]*>/g, '')], { type: 'text/plain' });
        
        const clipboardItem = new ClipboardItem({
          'text/html': blob,
          'text/plain': blobText
        });
        
        navigator.clipboard.write([clipboardItem]).then(() => {
          console.log('✅ HTML 복사 성공 (깨끗한 형식)');
          alert('복사 완료! 워드에 붙여넣기 하세요.');
        }).catch(err => {
          console.error('Clipboard API 실패, fallback 시도:', err);
          // Fallback: execCommand 방식
          const tempDiv = document.createElement('div');
          tempDiv.contentEditable = 'true';
          tempDiv.innerHTML = cleanHtml;
          tempDiv.style.position = 'fixed';
          tempDiv.style.left = '-9999px';
          document.body.appendChild(tempDiv);
          
          const range = document.createRange();
          range.selectNodeContents(tempDiv);
          const selection = window.getSelection();
          if (selection) {
            selection.removeAllRanges();
            selection.addRange(range);
            document.execCommand('copy');
            selection.removeAllRanges();
          }
          document.body.removeChild(tempDiv);
          console.log('✅ HTML 복사 성공 (fallback)');
          alert('복사 완료! 워드에 붙여넣기 하세요.');
        });
      } catch (err) {
        console.error('❌ 복사 실패:', err);
        alert('복사에 실패했습니다.');
      }
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

      {/* 모드 선택 */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode('auto')}
          className={`flex-1 py-2 px-4 rounded-lg font-bold text-sm transition-all ${
            mode === 'auto'
              ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-lg'
              : darkMode
              ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
          }`}
        >
          ⚡ 자동 보정
        </button>
        <button
          onClick={() => setMode('chat')}
          disabled={!refinedContent}
          className={`flex-1 py-2 px-4 rounded-lg font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            mode === 'chat'
              ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-lg'
              : darkMode
              ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
          }`}
        >
          💬 채팅 수정 {!refinedContent && <span className="text-xs ml-1">(먼저 보정 실행)</span>}
        </button>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-hidden">
        {/* 왼쪽: 원본 콘텐츠 또는 채팅 */}
        <div className="flex flex-col gap-2 h-full">
          {mode === 'auto' ? (
            <>
              <label className={`text-sm font-bold ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                📝 원본 콘텐츠
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onPaste={(e) => {
                  e.preventDefault();
                  const text = e.clipboardData.getData('text/plain');
                  document.execCommand('insertText', false, text);
                }}
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
            </>
          ) : (
            <>
              <label className={`text-sm font-bold ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                💬 채팅으로 수정하기
              </label>
              <div className={`flex-1 rounded-xl border overflow-hidden flex flex-col ${
                darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'
              }`}>
                {/* 채팅 메시지 */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                  {chatMessages.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center">
                        <p className={`text-sm ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                          수정 요청을 입력해보세요
                        </p>
                        <p className={`text-xs mt-2 ${darkMode ? 'text-slate-600' : 'text-slate-500'}`}>
                          예: "더 부드러운 톤으로 바꿔줘"<br/>
                          "첫 문단을 더 짧게 만들어줘"
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {chatMessages.map((msg, idx) => (
                        <div
                          key={idx}
                          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[80%] px-4 py-2 rounded-lg ${
                              msg.role === 'user'
                                ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white'
                                : darkMode
                                ? 'bg-slate-800 text-slate-200'
                                : 'bg-slate-100 text-slate-900'
                            }`}
                          >
                            <p className="text-sm">{msg.content}</p>
                            <p className={`text-xs mt-1 opacity-60`}>
                              {msg.timestamp.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      ))}
                      <div ref={chatEndRef} />
                    </>
                  )}
                </div>
                
                {/* 채팅 입력 */}
                <div className={`p-3 border-t ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                  <div className="flex gap-2">
                    <textarea
                      ref={chatTextareaRef}
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onPaste={(e) => {
                        e.preventDefault();
                        const text = e.clipboardData.getData('text/plain');
                        document.execCommand('insertText', false, text);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && !isChatting) {
                          e.preventDefault();
                          handleChatSubmit();
                        }
                      }}
                      placeholder="수정 요청을 입력하세요... (Shift+Enter: 줄바꿈)"
                      disabled={isChatting}
                      rows={1}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm resize-none ${
                        darkMode
                          ? 'bg-slate-800 border-slate-600 text-white placeholder-slate-500'
                          : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                      } border focus:outline-none focus:ring-2 focus:ring-purple-500`}
                      style={{ minHeight: '38px', maxHeight: '120px' }}
                    />
                    <button
                      onClick={handleChatSubmit}
                      disabled={isChatting || !chatInput.trim()}
                      className={`px-4 py-2 rounded-lg font-bold text-sm transition-all self-end ${
                        isChatting || !chatInput.trim()
                          ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                          : 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:shadow-lg'
                      }`}
                    >
                      {isChatting ? '⏳' : '전송'}
                    </button>
                  </div>
                  <p className={`text-xs mt-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    💡 Enter: 전송 | Shift+Enter: 줄바꿈
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* 오른쪽: 수정된 콘텐츠 */}
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
                복사
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
                <div 
                  className="prose prose-sm max-w-none" 
                  dangerouslySetInnerHTML={{ 
                    __html: (() => {
                      // 🔥 HTML 엔티티 디코딩 (네모 문자 방지)
                      const parser = new DOMParser();
                      const doc = parser.parseFromString(refinedContent, 'text/html');
                      return doc.body.innerHTML;
                    })()
                  }} 
                />
                
                {factCheck && mode === 'auto' && (
                  <div className={`mt-4 p-4 rounded-lg ${darkMode ? 'bg-slate-800' : 'bg-white'}`}>
                    <h3 className={`text-sm font-bold mb-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                      📊 검사 결과
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className={darkMode ? 'text-slate-400' : 'text-slate-600'}>팩트 정확성:</span>
                        <span className={`ml-2 font-bold ${factCheck.fact_score >= 80 ? 'text-green-500' : 'text-yellow-500'}`}>
                          {factCheck.fact_score || 0}점
                        </span>
                      </div>
                      <div>
                        <span className={darkMode ? 'text-slate-400' : 'text-slate-600'}>의료법 안전성:</span>
                        <span className={`ml-2 font-bold ${factCheck.safety_score >= 80 ? 'text-green-500' : 'text-yellow-500'}`}>
                          {factCheck.safety_score || 0}점
                        </span>
                      </div>
                      <div>
                        <span className={darkMode ? 'text-slate-400' : 'text-slate-600'}>AI 냄새:</span>
                        <span className={`ml-2 font-bold ${factCheck.ai_smell_score <= 20 ? 'text-green-500' : 'text-yellow-500'}`}>
                          {factCheck.ai_smell_score || 0}점
                        </span>
                      </div>
                      <div>
                        <span className={darkMode ? 'text-slate-400' : 'text-slate-600'}>전환력:</span>
                        <span className={`ml-2 font-bold ${factCheck.conversion_score >= 70 ? 'text-green-500' : 'text-yellow-500'}`}>
                          {factCheck.conversion_score || 0}점
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
