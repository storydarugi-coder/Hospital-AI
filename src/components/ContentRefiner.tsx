import React, { useState, useRef, useEffect } from 'react';
import { refineContentByMedicalLaw } from '../services/geminiService';
import { getAiClient } from '../services/geminiService';
import { SYSTEM_PROMPT, getStage2_AiRemovalAndCompliance, getDynamicSystemPrompt } from '../lib/gpt52-prompts-staged';
import { applyThemeToHtml } from '../utils/cssThemes';
import type { CssTheme } from '../types';

// 🚨🚨🚨 AI 금지어 후처리 함수 - "양상/양태" 등 AI스러운 표현 제거 🚨🚨🚨
const BANNED_WORDS_REPLACEMENTS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /다양한\s*양상/g, replacement: '여러 모습' },
  { pattern: /복잡한\s*양상/g, replacement: '복잡한 모습' },
  { pattern: /특이한\s*양상/g, replacement: '독특한 모습' },
  { pattern: /비슷한\s*양상/g, replacement: '비슷한 모습' },
  { pattern: /다른\s*양상/g, replacement: '다른 모습' },
  { pattern: /새로운\s*양상/g, replacement: '새로운 모습' },
  { pattern: /이러한\s*양상/g, replacement: '이런 모습' },
  { pattern: /그러한\s*양상/g, replacement: '그런 모습' },
  { pattern: /양상을\s*보이/g, replacement: '모습을 보이' },
  { pattern: /양상이\s*나타나/g, replacement: '모습이 나타나' },
  { pattern: /양상으로\s*나타나/g, replacement: '형태로 나타나' },
  { pattern: /양상을\s*띠/g, replacement: '모습을 띠' },
  { pattern: /양상이\s*있/g, replacement: '모습이 있' },
  { pattern: /양상에\s*따라/g, replacement: '상태에 따라' },
  { pattern: /양상의\s*변화/g, replacement: '모습의 변화' },
  { pattern: /양상과\s*/g, replacement: '모습과 ' },
  { pattern: /양태를\s*보이/g, replacement: '모습을 보이' },
  { pattern: /양태가\s*/g, replacement: '모습이 ' },
  { pattern: /(\s)양상(\s)/g, replacement: '$1모습$2' },
  { pattern: /(\s)양상([을를이가])/g, replacement: '$1모습$2' },
  { pattern: /(\s)양태(\s)/g, replacement: '$1모습$2' },
  { pattern: /(\s)양태([을를이가])/g, replacement: '$1모습$2' },
  { pattern: /양상/g, replacement: '모습' },
  { pattern: /양태/g, replacement: '형태' },
];

function removeBannedWords(content: string): string {
  if (!content) return content;
  let result = content;
  let count = 0;
  for (const { pattern, replacement } of BANNED_WORDS_REPLACEMENTS) {
    const before = result;
    result = result.replace(pattern, replacement);
    if (before !== result) count++;
  }
  if (count > 0) console.log(`🚨 채팅 보정 금지어 후처리: ${count}개 패턴 교체됨`);
  return result;
}

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
      
      // 동적 시스템 프롬프트 + Stage 2 프롬프트 사용 (v6.7 업데이트 - 최신 의료광고법 자동 반영)
      // 보정 시 글자 수 변경 없이 품질 개선에 집중
      const dynamicSystemPrompt = await getDynamicSystemPrompt();
      const stage2Prompt = getStage2_AiRemovalAndCompliance();
      
      // 콘텐츠를 섹션별로 분리하여 수정 대상 명확히 표시
      const sections = refinedContent.split(/(<h[23][^>]*>.*?<\/h[23]>)/gi);
      const numberedContent = sections.map((section, idx) => {
        if (section.match(/<h[23]/i)) {
          return `\n[섹션 ${Math.floor(idx/2) + 1}] ${section}`;
        }
        return section;
      }).join('');
      
      // 사용자 요청 의도 분석
      const wantsExpand = /자세히|자세하게|더 쓰|길게|확장|추가|더 설명|상세|구체적|늘려/.test(chatInput);
      const wantsShorter = /짧게|줄여|간결|요약|압축/.test(chatInput);
      const wantsRephrase = /다시|다르게|바꿔|고쳐|수정/.test(chatInput);
      const wantsHumanize = /사람|자연|AI|인공|딱딱|부드럽/.test(chatInput);
      const targetIntro = /도입|첫|서두|시작/.test(chatInput);
      const targetEnd = /마무리|끝|마지막|결론/.test(chatInput);
      const targetSection = chatInput.match(/(\d+)번째|([일이삼사오])\s*번째/);
      
      // 현재 글자 수 계산
      const tempDiv2 = document.createElement('div');
      tempDiv2.innerHTML = refinedContent;
      const currentLength = (tempDiv2.textContent || '').length;
      
      const prompt = `당신은 **스마트 글 보정 AI**입니다.
사용자 요청을 정확히 이해하고, 요청한 부분만 수정합니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 사용자 요청 분석
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[원본 요청] ${chatInput}

[의도 파악]
• 확장 요청: ${wantsExpand ? '✅ 예 (내용 추가/자세히)' : '❌ 아니오'}
• 축소 요청: ${wantsShorter ? '✅ 예 (줄이기/요약)' : '❌ 아니오'}
• 표현 변경: ${wantsRephrase ? '✅ 예 (다르게 쓰기)' : '❌ 아니오'}
• 자연스럽게: ${wantsHumanize ? '✅ 예 (AI냄새 제거)' : '❌ 아니오'}
• 수정 위치: ${targetIntro ? '도입부' : targetEnd ? '마무리' : targetSection ? `${targetSection[0]}` : '전체 또는 지정된 부분'}

현재 글자 수: ${currentLength}자
${crawledContent ? `\n[참고 자료]\n${crawledContent}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 현재 콘텐츠 (섹션별 구분)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${numberedContent}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔴 P0 - 절대 준수 사항
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1️⃣ "~요/~죠" 종결어미 완전 금지!
   ❌ "아프시죠", "힘드시죠", "좋아요", "있거든요", "~잖아요"
   ✅ "아픕니다", "힘듭니다", "좋습니다", "있습니다"

2️⃣ 요청한 부분만 수정! (나머지는 원본 그대로!)
   • 도입부 요청 → 첫 <h2> 전까지만 수정
   • N번째 소제목 → [섹션 N]만 수정
   • 마무리 요청 → 마지막 <h2> 이후만 수정
   • 전체 요청 → 모든 섹션 수정 가능

3️⃣ 의료광고법 준수
   ❌ "치료", "완치", "효과" 단정 금지
   ❌ "~하세요" 행동유도 금지
   ✅ "~일 수 있습니다" 가능성 표현

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🟡 스마트 수정 가이드
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${wantsExpand ? `
📈 [확장 모드]
• Google Search로 정확한 정보 확인 후 추가
• 구체적인 상황/예시 추가
• 단, 의료광고법 준수! 의학적 설명 금지!
• 목표: 현재의 130~150%
` : ''}
${wantsShorter ? `
📉 [축소 모드]
• 핵심만 남기고 부연설명 제거
• 반복되는 내용 통합
• 목표: 현재의 60~80%
` : ''}
${wantsRephrase ? `
🔄 [표현 변경 모드]
• 같은 의미, 다른 표현으로
• 더 자연스럽고 읽기 좋게
` : ''}
${wantsHumanize ? `
🗣️ [자연스럽게 모드]
• AI 문체 → 사람 말맛으로!
• "해당 증상" → "이런 느낌"
• "불편감이 발생" → "뻐근해집니다"
• 감각 표현: 찌릿, 욱신, 뻐근, 묵직
` : ''}

❌ AI 문체 → ✅ 사람 말맛:
• "해당/상기/동일한" → 삭제 또는 "이런/이"
• "~하시는 것이 좋습니다" → "~하면 좋습니다"
• "불편감이 발생" → "뻐근해집니다"
• "적절한 관리" → "신경 쓰기"

✅ 상황 묘사 (구체적으로!):
• ❌ "아침에 증상이 심합니다"
• ✅ "아침에 눈 뜨자마자 손가락이 뻣뻣합니다"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ 응답 전 체크리스트
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
□ "~요/~죠" 사용하지 않았나?
□ 요청한 부분만 수정했나?
□ 요청 안 한 부분은 원본과 100% 동일한가?
□ [섹션 N] 표시는 제거했나?
□ 의료광고법 위반 없나?

🚨 응답 형식 🚨
✅ 순수 HTML만! (<p>, <h2>, <h3> 태그)
❌ JSON 금지! ❌ 코드블록 금지! ❌ 설명 금지!
❌ "수정했습니다" 같은 메타 설명 금지!`;

      const result = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }] // Google Search 활성화
        }
      });

      let response = result.text || '';
      
      // 🔧 JSON 형식으로 응답한 경우 처리 (Gemini가 지시를 무시하고 JSON으로 응답할 때)
      if (response.trim().startsWith('{') || response.trim().startsWith('```json')) {
        console.warn('⚠️ Gemini가 JSON 형식으로 응답함 - HTML 추출 시도');
        try {
          // 코드블록 제거
          const cleanJson = response.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
          const parsed = JSON.parse(cleanJson);
          
          // 가능한 키들에서 HTML 추출
          if (parsed.content) {
            response = parsed.content;
          } else if (parsed.c) {
            response = parsed.t ? `<h1>${parsed.t}</h1>\n${parsed.c}` : parsed.c;
          } else if (parsed.html) {
            response = parsed.html;
          } else if (parsed.text) {
            response = parsed.text;
          } else {
            // 가장 긴 문자열 값 추출
            const values = Object.values(parsed).filter(v => typeof v === 'string') as string[];
            if (values.length > 0) {
              response = values.reduce((a, b) => a.length > b.length ? a : b);
            }
          }
          console.log('✅ JSON에서 HTML 추출 성공:', response.substring(0, 100));
        } catch (parseError) {
          console.error('❌ JSON 파싱 실패, 원본 사용:', parseError);
        }
      }
      
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
      
      // 🚨🚨🚨 금지어 후처리 - "양상/양태" 등 AI스러운 표현 제거
      const cleanedResponse = removeBannedWords(response);
      setRefinedContent(cleanedResponse);
      
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
