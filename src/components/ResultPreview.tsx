import React, { useState, useEffect, useRef } from 'react';
import { GeneratedContent, ImageStyle, CssTheme } from '../types';
import { modifyPostWithAI, generateSingleImage, recommendImagePrompt, regenerateCardSlide } from '../services/geminiService';
import { CSS_THEMES, applyThemeToHtml } from '../utils/cssThemes';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';

interface ResultPreviewProps {
  content: GeneratedContent;
  darkMode?: boolean;
}

// AI 수정 프롬프트 템플릿
const AI_PROMPT_TEMPLATES = [
  { label: '친근하게', prompt: '전체적으로 더 친근하고 따뜻한 톤으로 수정해줘', icon: '💗' },
  { label: 'CTA 강화', prompt: '마지막 부분의 CTA를 더 강력하게 수정해줘. 독자가 행동하고 싶게 만들어줘', icon: '🎯' },
  { label: '전문적으로', prompt: '더 전문적이고 신뢰감 있는 톤으로 수정해줘. 의학 용어도 적절히 사용해줘', icon: '👨‍⚕️' },
  { label: '짧게 요약', prompt: '전체 내용을 20% 정도 줄여서 핵심만 간결하게 정리해줘', icon: '✂️' },
  { label: '예시 추가', prompt: '각 섹션에 독자가 공감할 수 있는 구체적인 예시나 상황을 추가해줘', icon: '📝' },
  { label: 'SEO 강화', prompt: '키워드 밀도를 높이고 소제목을 SEO에 최적화된 형태로 수정해줘', icon: '🔍' },
];

// 임시저장 키
const AUTOSAVE_KEY = 'hospitalai_autosave';
const AUTOSAVE_HISTORY_KEY = 'hospitalai_autosave_history'; // 여러 저장본 관리
const CARD_PROMPT_HISTORY_KEY = 'hospitalai_card_prompt_history';
const CARD_REF_IMAGE_KEY = 'hospitalai_card_ref_image'; // 카드뉴스 참고 이미지 고정용

// 자동저장 히스토리 타입
interface AutoSaveHistoryItem {
  html: string;
  theme: string;
  postType: string;
  imageStyle?: string;
  savedAt: string;
  title: string; // 첫 번째 제목 추출
}

// 카드 프롬프트 히스토리 타입
interface CardPromptHistoryItem {
  subtitle: string;
  mainTitle: string;
  description: string;
  imagePrompt: string;
  savedAt: string;
}

const ResultPreview: React.FC<ResultPreviewProps> = ({ content, darkMode = false }) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'html'>('preview');
  const [localHtml, setLocalHtml] = useState(content.fullHtml);
  const [currentTheme, setCurrentTheme] = useState<CssTheme>(content.cssTheme || 'modern');
  const [editorInput, setEditorInput] = useState('');
  const [isEditingAi, setIsEditingAi] = useState(false);
  const [editProgress, setEditProgress] = useState('');
  const [charCount, setCharCount] = useState(0);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  
  // 자동저장 히스토리 (여러 저장본 관리)
  const [autoSaveHistory, setAutoSaveHistory] = useState<AutoSaveHistoryItem[]>([]);
  const [showAutoSaveDropdown, setShowAutoSaveDropdown] = useState(false);
  
  // Undo 기능을 위한 히스토리
  const [htmlHistory, setHtmlHistory] = useState<string[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  
  // 이미지 다운로드 모달
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);
  const [downloadImgSrc, setDownloadImgSrc] = useState('');
  const [downloadImgIndex, setDownloadImgIndex] = useState(0);
  
  // 카드뉴스 다운로드 모달
  const [cardDownloadModalOpen, setCardDownloadModalOpen] = useState(false);
  const [downloadingCard, setDownloadingCard] = useState(false);
  const [cardDownloadProgress, setCardDownloadProgress] = useState('');
  
  // 카드 재생성 모달
  const [cardRegenModalOpen, setCardRegenModalOpen] = useState(false);
  const [cardRegenIndex, setCardRegenIndex] = useState(0);
  const [cardRegenInstruction, setCardRegenInstruction] = useState('');
  const [isRegeneratingCard, setIsRegeneratingCard] = useState(false);
  const [cardRegenProgress, setCardRegenProgress] = useState('');
  
  // 카드 재생성 시 편집 가능한 프롬프트
  const [editSubtitle, setEditSubtitle] = useState('');
  const [editMainTitle, setEditMainTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editImagePrompt, setEditImagePrompt] = useState('');
  const [cardRegenRefImage, setCardRegenRefImage] = useState(''); // 참고 이미지
  const [refImageMode, setRefImageMode] = useState<'inspire' | 'copy'>('copy'); // 참고 이미지 적용 방식
  const [currentCardImage, setCurrentCardImage] = useState(''); // 현재 카드의 이미지 URL
  const [promptHistory, setPromptHistory] = useState<CardPromptHistoryItem[]>([]); // 저장된 프롬프트 히스토리
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);
  const [isRefImageLocked, setIsRefImageLocked] = useState(false); // 참고 이미지 고정 여부
  
  // 프롬프트 히스토리 및 참고 이미지 불러오기
  useEffect(() => {
    const saved = localStorage.getItem(CARD_PROMPT_HISTORY_KEY);
    if (saved) {
      try {
        setPromptHistory(JSON.parse(saved));
      } catch (e) {
        console.error('히스토리 로드 실패:', e);
      }
    }
    
    // 저장된 참고 이미지 불러오기
    const savedRefImage = localStorage.getItem(CARD_REF_IMAGE_KEY);
    if (savedRefImage) {
      try {
        const parsed = JSON.parse(savedRefImage);
        if (parsed.image) {
          setCardRegenRefImage(parsed.image);
          setRefImageMode(parsed.mode || 'copy');
          setIsRefImageLocked(true);
        }
      } catch (e) {
        console.error('참고 이미지 로드 실패:', e);
      }
    }
  }, []);
  
  // 참고 이미지 저장/삭제 함수
  const saveRefImageToStorage = (image: string, mode: 'inspire' | 'copy') => {
    try {
      localStorage.setItem(CARD_REF_IMAGE_KEY, JSON.stringify({ image, mode }));
      setIsRefImageLocked(true);
    } catch (e) {
      console.error('참고 이미지 저장 실패 (용량 초과):', e);
      alert('참고 이미지가 너무 큽니다. 더 작은 이미지를 사용해주세요.');
    }
  };
  
  const clearRefImageFromStorage = () => {
    localStorage.removeItem(CARD_REF_IMAGE_KEY);
    setIsRefImageLocked(false);
  };
  
  // 프롬프트 저장 함수
  const savePromptToHistory = () => {
    if (!editSubtitle && !editMainTitle && !editDescription) return;
    
    const newItem: CardPromptHistoryItem = {
      subtitle: editSubtitle,
      mainTitle: editMainTitle,
      description: editDescription,
      imagePrompt: editImagePrompt,
      savedAt: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    };
    
    // 최근 3개만 유지 (중복 제거)
    const filtered = promptHistory.filter(h => 
      h.subtitle !== newItem.subtitle || h.mainTitle !== newItem.mainTitle
    );
    const newHistory = [newItem, ...filtered].slice(0, 3);
    
    setPromptHistory(newHistory);
    localStorage.setItem(CARD_PROMPT_HISTORY_KEY, JSON.stringify(newHistory));
    alert('✅ 프롬프트가 저장되었습니다!');
  };
  
  // 히스토리에서 불러오기
  const loadFromHistory = (item: CardPromptHistoryItem) => {
    setEditSubtitle(item.subtitle);
    setEditMainTitle(item.mainTitle);
    setEditDescription(item.description);
    setEditImagePrompt(item.imagePrompt);
    setShowHistoryDropdown(false);
  };
  
  // 텍스트 변경 시 이미지 프롬프트 자동 연동
  useEffect(() => {
    // 텍스트 내용이 하나라도 있으면 이미지 프롬프트 자동 생성
    if (editSubtitle || editMainTitle || editDescription) {
      const style = content.imageStyle || 'illustration';
      const styleText = style === 'illustration' ? '3D 일러스트, 아이소메트릭, 클레이 렌더' 
        : style === 'medical' ? '의학 3D 해부학 일러스트' 
        : '실사 사진, 전문적인 의료 분위기';
      
      const newImagePrompt = `1:1 정사각형 카드뉴스, ${editSubtitle ? `"${editSubtitle}"` : ''} ${editMainTitle ? `"${editMainTitle}"` : ''} ${editDescription ? `"${editDescription}"` : ''}, ${styleText}, 밝고 친근한 분위기`.trim();
      
      setEditImagePrompt(newImagePrompt);
    }
  }, [editSubtitle, editMainTitle, editDescription, content.imageStyle]);
  
  // 카드 수 (localHtml 변경 시 업데이트)
  const [cardCount, setCardCount] = useState(0);
  
  const [regenOpen, setRegenOpen] = useState(false);
  const [regenIndex, setRegenIndex] = useState<number>(1);
  const [regenPrompt, setRegenPrompt] = useState<string>('');
  const [regenRefDataUrl, setRegenRefDataUrl] = useState<string | undefined>(undefined);
  const [regenRefName, setRegenRefName] = useState<string>('');
  const [isRecommendingPrompt, setIsRecommendingPrompt] = useState(false);
  
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalChange = useRef(false);

  useEffect(() => {
    setLocalHtml(content.fullHtml);
  }, [content.fullHtml]);

  // 글자 수 계산 (실제 보이는 텍스트만) + 카드 수 업데이트
  useEffect(() => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = localHtml;
    
    // 카드 수 계산
    const cards = tempDiv.querySelectorAll('.card-slide');
    setCardCount(cards.length);
    
    // 숨겨진 요소 제거
    const hiddenElements = tempDiv.querySelectorAll('.hidden-title, [style*="display: none"], [style*="display:none"]');
    hiddenElements.forEach(el => el.remove());
    
    // 카드뉴스의 경우 실제 내용만 계산 (태그/해시태그/메타정보 제외)
    if (content.postType === 'card_news') {
      // pill-tag, footer, legal-box 등 메타정보 제거
      const metaElements = tempDiv.querySelectorAll('.pill-tag, .card-footer-row, .legal-box-card, .brand-text, .arrow-icon');
      metaElements.forEach(el => el.remove());
      
      // 실제 콘텐츠 텍스트만 추출 (subtitle, main-title, desc)
      let contentText = '';
      tempDiv.querySelectorAll('.card-subtitle, .card-main-title, .card-desc').forEach(el => {
        contentText += (el.textContent || '') + ' ';
      });
      
      const text = contentText.replace(/\s+/g, ' ').trim();
      setCharCount(text.length);
    } else {
      // 블로그 포스트의 경우 전체 텍스트 계산
      const text = (tempDiv.textContent || '')
        .replace(/\s+/g, ' ')  // 연속 공백 제거
        .trim();
      
      setCharCount(text.length);
    }
  }, [localHtml, content.postType]);

  // 카드뉴스 카드에 오버레이 추가
  useEffect(() => {
    if (content.postType !== 'card_news') return;
    
    const addOverlaysToCards = () => {
      const cards = document.querySelectorAll('.naver-preview .card-slide');
      cards.forEach((card, index) => {
        // 이미 오버레이가 있으면 스킵
        if (card.querySelector('.card-overlay')) return;
        
        // 카드 번호 배지
        const badge = document.createElement('div');
        badge.className = 'card-number-badge';
        badge.textContent = index === 0 ? '표지' : `${index + 1}`;
        card.appendChild(badge);
        
        // 오버레이 생성
        const overlay = document.createElement('div');
        overlay.className = 'card-overlay';
        overlay.innerHTML = `
          <button class="card-overlay-btn regen" data-index="${index}">
            🔄 재생성
          </button>
          <button class="card-overlay-btn download" data-index="${index}">
            💾 다운로드
          </button>
        `;
        card.appendChild(overlay);
        
        // 버튼 클릭 이벤트
        overlay.querySelector('.regen')?.addEventListener('click', (e) => {
          e.stopPropagation();
          openCardRegenModal(index);
        });
        
        overlay.querySelector('.download')?.addEventListener('click', (e) => {
          e.stopPropagation();
          handleSingleCardDownload(index);
        });
      });
    };
    
    // DOM 업데이트 후 실행
    const timer = setTimeout(addOverlaysToCards, 100);
    return () => clearTimeout(timer);
  }, [localHtml, content.postType]);

  // 단일 카드 다운로드
  const handleSingleCardDownload = async (cardIndex: number) => {
    const cards = document.querySelectorAll('.naver-preview .card-slide');
    const card = cards[cardIndex] as HTMLElement;
    if (!card) return;
    
    try {
      // 오버레이 임시 숨김
      const overlay = card.querySelector('.card-overlay') as HTMLElement;
      const badge = card.querySelector('.card-number-badge') as HTMLElement;
      if (overlay) overlay.style.display = 'none';
      if (badge) badge.style.display = 'none';
      
      const canvas = await html2canvas(card, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null
      });
      
      // 오버레이 복구
      if (overlay) overlay.style.display = '';
      if (badge) badge.style.display = '';
      
      canvas.toBlob((blob) => {
        if (blob) {
          saveAs(blob, `card_${cardIndex + 1}.png`);
        }
      }, 'image/png');
    } catch (error) {
      console.error('카드 다운로드 실패:', error);
      alert('카드 다운로드에 실패했습니다.');
    }
  };

  // HTML에서 제목 추출하는 함수
  const extractTitle = (html: string): string => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // 카드뉴스: .card-main-title 또는 .hidden-title
    const cardTitle = tempDiv.querySelector('.card-main-title, .hidden-title');
    if (cardTitle) return (cardTitle.textContent || '').slice(0, 30) || '카드뉴스';
    
    // 블로그: h1, h2, .blog-title
    const blogTitle = tempDiv.querySelector('h1, h2, .blog-title');
    if (blogTitle) return (blogTitle.textContent || '').slice(0, 30) || '블로그 글';
    
    return '저장된 글';
  };

  // 자동저장 히스토리 불러오기
  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUTOSAVE_HISTORY_KEY);
      if (saved) {
        setAutoSaveHistory(JSON.parse(saved));
      }
    } catch (e) {
      console.error('자동저장 히스토리 로드 실패:', e);
    }
  }, []);

  // localStorage 안전 저장 함수 (용량 초과 방지)
  const safeLocalStorageSet = (key: string, value: string): boolean => {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      // QuotaExceededError 처리
      console.warn('localStorage 용량 초과, 오래된 데이터 정리 중...');
      return false;
    }
  };

  // 수동 저장 함수 (사용자가 버튼 클릭 시 저장)
  const saveManually = () => {
    if (!localHtml || !localHtml.trim()) {
      alert('저장할 내용이 없습니다.');
      return;
    }
    
    const now = new Date();
    const title = extractTitle(localHtml);
    
    const saveData = {
      html: localHtml,
      theme: currentTheme,
      postType: content.postType,
      imageStyle: content.imageStyle,
      savedAt: now.toISOString(),
      title: title
    };
    
    // 현재 저장 (단일 저장은 항상 시도)
    const saveDataStr = JSON.stringify(saveData);
    if (!safeLocalStorageSet(AUTOSAVE_KEY, saveDataStr)) {
      // 용량 초과 시 히스토리 전체 삭제 후 재시도
      localStorage.removeItem(AUTOSAVE_HISTORY_KEY);
      setAutoSaveHistory([]);
      safeLocalStorageSet(AUTOSAVE_KEY, saveDataStr);
    }
    setLastSaved(now);
    
    // 히스토리에 추가 (최근 3개만 유지 - 용량 절약)
    setAutoSaveHistory(prev => {
      const filtered = prev.filter(item => item.title !== title);
      let newHistory = [saveData, ...filtered].slice(0, 3);
      
      // 저장 시도
      let historyStr = JSON.stringify(newHistory);
      if (!safeLocalStorageSet(AUTOSAVE_HISTORY_KEY, historyStr)) {
        // 용량 초과 시 2개로 줄여서 재시도
        newHistory = newHistory.slice(0, 2);
        historyStr = JSON.stringify(newHistory);
        if (!safeLocalStorageSet(AUTOSAVE_HISTORY_KEY, historyStr)) {
          // 그래도 안 되면 1개만
          newHistory = newHistory.slice(0, 1);
          safeLocalStorageSet(AUTOSAVE_HISTORY_KEY, JSON.stringify(newHistory));
        }
      }
      return newHistory;
    });
    
    alert(`"${title}" 저장되었습니다!`);
  };

  // 특정 저장본 불러오기
  const loadFromAutoSaveHistory = (item: AutoSaveHistoryItem) => {
    setLocalHtml(item.html);
    if (item.theme) setCurrentTheme(item.theme as any);
    setShowAutoSaveDropdown(false);
    alert(`"${item.title}" 불러왔습니다!`);
  };

  // 임시저장 삭제
  const clearAutoSave = () => {
    localStorage.removeItem(AUTOSAVE_KEY);
    localStorage.removeItem(AUTOSAVE_HISTORY_KEY);
    setAutoSaveHistory([]);
    setLastSaved(null);
    alert('임시저장이 삭제되었습니다.');
  };

  // 임시저장 데이터 있는지 확인
  const hasAutoSave = () => {
    try {
      return autoSaveHistory.length > 0;
    } catch {
      return false;
    }
  };

  // Undo: 이전 상태로 되돌리기
  const handleUndo = () => {
    if (htmlHistory.length > 0) {
      const prevHtml = htmlHistory[htmlHistory.length - 1];
      setHtmlHistory(prev => prev.slice(0, -1));
      setLocalHtml(prevHtml);
      setCanUndo(htmlHistory.length > 1);
    }
  };

  // 히스토리에 현재 상태 저장 (AI 수정 전에 호출)
  const saveToHistory = () => {
    setHtmlHistory(prev => [...prev.slice(-9), localHtml]); // 최대 10개 유지
    setCanUndo(true);
  };

  // 이미지 다운로드 함수
  const downloadImage = (imgSrc: string, index: number) => {
    const link = document.createElement('a');
    link.href = imgSrc;
    link.download = `hospital-ai-image-${index}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // 카드뉴스 1장씩 전체 다운로드 (html2canvas 사용)
  const downloadCardAsImage = async (cardIndex: number) => {
    const cardSlides = getCardElements();
    if (!cardSlides || !cardSlides[cardIndex]) {
      alert('카드를 찾을 수 없습니다. 카드뉴스를 먼저 생성해주세요.');
      return;
    }
    
    setDownloadingCard(true);
    setCardDownloadProgress(`${cardIndex + 1}번 카드 이미지 생성 중...`);
    
    try {
      const card = cardSlides[cardIndex] as HTMLElement;
      const canvas = await html2canvas(card, {
        scale: 2, // 고화질
        backgroundColor: null,
        useCORS: true,
        allowTaint: true,
        logging: false,
      });
      
      const link = document.createElement('a');
      link.download = `card-news-${cardIndex + 1}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      
      setCardDownloadProgress('');
    } catch (error) {
      console.error('카드 다운로드 실패:', error);
      alert('카드 다운로드 중 오류가 발생했습니다.');
    } finally {
      setDownloadingCard(false);
    }
  };
  
  // 카드 슬라이드 재생성
  const handleCardRegenerate = async () => {
    // 편집된 프롬프트가 있는지 확인
    const hasEditedPrompt = editSubtitle || editMainTitle || editDescription || editImagePrompt || cardRegenRefImage;
    
    if (!hasEditedPrompt) {
      alert('프롬프트를 수정하거나 참고 이미지를 업로드해주세요.');
      return;
    }
    
    setIsRegeneratingCard(true);
    setCardRegenProgress(cardRegenRefImage ? '참고 이미지 스타일 분석 중...' : '편집된 프롬프트로 이미지 생성 중...');
    
    try {
      // 편집된 이미지 프롬프트 구성
      const style = content.imageStyle || 'illustration';
      // 커스텀 스타일인 경우 저장된 커스텀 프롬프트 사용
      const customStylePrompt = style === 'custom' ? content.customImagePrompt : undefined;
      
      let imagePromptToUse = editImagePrompt || 
        `1:1 정사각형 카드뉴스, "${editSubtitle}", "${editMainTitle}", "${editDescription}", ${style === 'illustration' ? '3D 일러스트' : style === 'medical' ? '의학 3D' : style === 'custom' ? '커스텀 스타일' : '실사 사진'}`;
      
      // 참고 이미지 모드에 따라 진행 메시지 설정
      if (cardRegenRefImage) {
        if (refImageMode === 'copy') {
          setCardRegenProgress('📋 레이아웃 복제 중... (참고 이미지 분석)');
        } else {
          setCardRegenProgress('✨ 스타일 참고하여 생성 중...');
        }
      } else if (customStylePrompt) {
        setCardRegenProgress('🎨 커스텀 스타일로 이미지 생성 중...');
      }
      
      // 참고 이미지와 모드를 generateSingleImage에 전달 (inspire/copy 모두 지원)
      // customStylePrompt를 4번째 파라미터로 전달 (커스텀 스타일 유지)
      const newImage = await generateSingleImage(
        imagePromptToUse, 
        style, 
        '1:1', 
        customStylePrompt,  // 커스텀 스타일 프롬프트 전달!
        cardRegenRefImage || undefined,  // 참고 이미지가 있으면 항상 전달
        refImageMode === 'copy'  // copy 모드인지 여부
      );
      
      if (newImage) {
        // DOM 업데이트 - 이미지 교체
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = localHtml;
        const cardsInHtml = tempDiv.querySelectorAll('.card-slide');
        
        if (cardsInHtml[cardRegenIndex]) {
          // 새 이미지로 교체 (완성형 카드이므로 전체 이미지 교체)
          const newCardHtml = `
            <div class="card-slide" style="border-radius: 24px; overflow: hidden; aspect-ratio: 1/1; box-shadow: 0 4px 16px rgba(0,0,0,0.08);">
              <img src="${newImage}" alt="${imagePromptToUse}" data-index="${cardRegenIndex + 1}" class="card-full-img" style="width: 100%; height: 100%; object-fit: cover;" />
            </div>`;
          
          const newCardElement = document.createElement('div');
          newCardElement.innerHTML = newCardHtml;
          const newCard = newCardElement.firstElementChild;
          
          if (newCard) {
            cardsInHtml[cardRegenIndex].replaceWith(newCard);
            setLocalHtml(tempDiv.innerHTML);
          }
        }
      }
      
      setCardRegenModalOpen(false);
      setCardRegenInstruction('');
      setCardRegenProgress('');
      alert(`✅ ${cardRegenIndex + 1}번 카드가 재생성되었습니다!`);
      
    } catch (error) {
      console.error('카드 재생성 실패:', error);
      alert('카드 재생성 중 오류가 발생했습니다.');
    } finally {
      setIsRegeneratingCard(false);
      setCardRegenProgress('');
    }
  };
  
  // 카드 재생성 모달 열기
  const openCardRegenModal = (cardIndex: number) => {
    setCardRegenIndex(cardIndex);
    setCardRegenInstruction('');
    // 참고 이미지가 고정되어 있지 않으면 초기화, 고정되어 있으면 유지
    if (!isRefImageLocked) {
      setCardRegenRefImage('');
    }
    
    // 현재 카드의 이미지 URL 가져오기
    const cards = getCardElements();
    if (cards && cards[cardIndex]) {
      const img = cards[cardIndex].querySelector('img');
      if (img) {
        setCurrentCardImage(img.src);
      } else {
        setCurrentCardImage('');
      }
    } else {
      setCurrentCardImage('');
    }
    
    // 기존 프롬프트 값으로 편집 state 초기화
    const cardPrompt = content.cardPrompts?.[cardIndex];
    if (cardPrompt) {
      setEditSubtitle(cardPrompt.textPrompt.subtitle || '');
      setEditMainTitle(cardPrompt.textPrompt.mainTitle || '');
      setEditDescription(cardPrompt.textPrompt.description || '');
      setEditTags(cardPrompt.textPrompt.tags?.join(', ') || '');
      setEditImagePrompt(cardPrompt.imagePrompt || '');
    } else {
      setEditSubtitle('');
      setEditMainTitle('');
      setEditDescription('');
      setEditTags('');
      setEditImagePrompt('');
    }
    
    setCardRegenModalOpen(true);
  };

  // 카드 요소들 가져오기 (여러 방법 시도)
  const getCardElements = (): NodeListOf<Element> | null => {
    // 1. editorRef에서 찾기
    let cards = editorRef.current?.querySelectorAll('.card-slide');
    if (cards && cards.length > 0) return cards;
    
    // 2. naver-preview 영역에서 찾기
    cards = document.querySelector('.naver-preview')?.querySelectorAll('.card-slide');
    if (cards && cards.length > 0) return cards;
    
    // 3. 전체 document에서 찾기
    cards = document.querySelectorAll('.card-slide');
    if (cards && cards.length > 0) return cards;
    
    return null;
  };
  
  // 카드 수 가져오기
  const getCardCount = () => {
    return getCardElements()?.length || 0;
  };
  
  // 모든 카드뉴스 일괄 다운로드
  const downloadAllCards = async () => {
    const cardSlides = getCardElements();
    if (!cardSlides || cardSlides.length === 0) {
      alert('다운로드할 카드가 없습니다. 카드뉴스를 먼저 생성해주세요.');
      return;
    }
    
    setDownloadingCard(true);
    
    try {
      for (let i = 0; i < cardSlides.length; i++) {
        setCardDownloadProgress(`${i + 1}/${cardSlides.length}장 다운로드 중...`);
        
        const card = cardSlides[i] as HTMLElement;
        const canvas = await html2canvas(card, {
          scale: 2,
          backgroundColor: null,
          useCORS: true,
          allowTaint: true,
          logging: false,
        });
        
        const link = document.createElement('a');
        link.download = `card-news-${i + 1}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        // 각 다운로드 사이 짧은 딜레이
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      setCardDownloadProgress('✅ 모든 카드 다운로드 완료!');
      setTimeout(() => setCardDownloadProgress(''), 2000);
    } catch (error) {
      console.error('카드 다운로드 실패:', error);
      alert('카드 다운로드 중 오류가 발생했습니다.');
    } finally {
      setDownloadingCard(false);
    }
  };

  // 이미지 클릭 핸들러 (다운로드 or 재생성 선택 모달)
  const handleImageClick = (imgSrc: string, imgAlt: string, index: number) => {
    setDownloadImgSrc(imgSrc);
    setDownloadImgIndex(index);
    setRegenIndex(index);
    setRegenPrompt(imgAlt || '전문적인 의료 일러스트');
    setDownloadModalOpen(true);
  };

  // localHtml이 외부에서 변경될 때만 에디터 내용 업데이트
  useEffect(() => {
    if (editorRef.current && !isInternalChange.current) {
      const styledHtml = applyInlineStylesForNaver(localHtml, currentTheme);
      if (editorRef.current.innerHTML !== styledHtml) {
        editorRef.current.innerHTML = styledHtml;
      }
    }
    isInternalChange.current = false;
  }, [localHtml, currentTheme]);

  const handleHtmlChange = () => {
    if (editorRef.current) {
      isInternalChange.current = true;
      setLocalHtml(editorRef.current.innerHTML);
    }
  };

  const openRegenModal = (imgIndex: number, currentPrompt: string) => {
    setRegenIndex(imgIndex);
    setRegenPrompt(currentPrompt || '전문적인 의료 일러스트');
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
      
      // 현재 이미지 스타일을 전달하여 스타일에 맞는 프롬프트 추천
      const currentStyle = content.imageStyle || 'illustration';
      const recommendedPrompt = await recommendImagePrompt(textContent, regenPrompt, currentStyle);
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
      // 커스텀 스타일인 경우 저장된 커스텀 프롬프트 사용
      const customStylePrompt = style === 'custom' ? content.customImagePrompt : undefined;
      const newImageData = await generateSingleImage(regenPrompt.trim(), style, imgRatio, customStylePrompt);
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

  // 이미지 URL을 ArrayBuffer로 변환하는 함수
  const fetchImageAsArrayBuffer = async (url: string): Promise<ArrayBuffer | null> => {
    try {
      // base64 데이터인 경우
      if (url.startsWith('data:')) {
        const base64Data = url.split(',')[1];
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
      }
      // 일반 URL인 경우
      const response = await fetch(url);
      return await response.arrayBuffer();
    } catch (e) {
      console.error('이미지 로드 실패:', e);
      return null;
    }
  };

  // HTML에서 깨끗한 텍스트 추출 (태그 제거, 정리)
  const cleanText = (text: string | null): string => {
    if (!text) return '';
    return text
      .replace(/\s+/g, ' ')  // 연속 공백을 하나로
      .replace(/\n+/g, ' ')  // 줄바꿈을 공백으로
      .trim();
  };

  // 워드 다운로드 함수 - 실제 .docx 생성 (개선된 정렬)
  const handleDownloadWord = async () => {
    setEditProgress('Word 문서 생성 중...');
    
    try {
      // HTML을 파싱해서 텍스트와 이미지 추출
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = localHtml;
      
      const docChildren: any[] = [];
      const processedTexts = new Set<string>(); // 중복 방지
      
      // 제목 추출
      const mainTitle = tempDiv.querySelector('.main-title, h2');
      if (mainTitle) {
        const titleText = cleanText(mainTitle.textContent);
        if (titleText) {
          processedTexts.add(titleText);
          docChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: titleText,
                  bold: true,
                  size: 48, // 24pt
                  font: '맑은 고딕',
                  color: '1a1a1a',
                }),
              ],
              heading: HeadingLevel.HEADING_1,
              spacing: { after: 400, line: 360 },
              alignment: AlignmentType.LEFT,
            })
          );
          // 제목 아래 구분선 효과
          docChildren.push(
            new Paragraph({
              spacing: { after: 300 },
              border: {
                bottom: { style: BorderStyle.SINGLE, size: 12, color: '10b981' }
              }
            })
          );
        }
      }
      
      // 순서대로 모든 요소 처리 (깊이 우선 탐색 대신 순차 처리)
      const processElements = async (container: Element) => {
        const elements = container.querySelectorAll('h3, p, li, img, ul, div.cta-box, div.content-image-wrapper');
        
        for (const element of Array.from(elements)) {
          const tagName = element.tagName?.toLowerCase();
          const classList = element.classList;
          
          // 이미 처리된 제목은 스킵
          if (classList?.contains('main-title') || (tagName === 'h2')) continue;
          
          // CTA 박스 처리
          if (classList?.contains('cta-box')) {
            const ctaText = cleanText(element.textContent);
            if (ctaText && !processedTexts.has(ctaText)) {
              processedTexts.add(ctaText);
              docChildren.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: '💡 ' + ctaText,
                      size: 24,
                      font: '맑은 고딕',
                      italics: true,
                      color: '059669',
                    }),
                  ],
                  spacing: { before: 300, after: 300, line: 360 },
                  indent: { left: 400, right: 400 },
                  shading: { fill: 'f0fdf4' },
                })
              );
            }
            continue;
          }
          
          // 이미지 wrapper 처리
          if (classList?.contains('content-image-wrapper')) {
            const img = element.querySelector('img');
            if (img) {
              const src = img.src;
              if (src) {
                const imageData = await fetchImageAsArrayBuffer(src);
                if (imageData) {
                  docChildren.push(
                    new Paragraph({
                      children: [
                        new ImageRun({
                          data: imageData,
                          transformation: {
                            width: 450,
                            height: 253, // 16:9 비율 유지
                          },
                          type: 'png',
                        }),
                      ],
                      spacing: { before: 400, after: 400 },
                      alignment: AlignmentType.CENTER,
                    })
                  );
                }
              }
            }
            continue;
          }
          
          // h3 제목 처리
          if (tagName === 'h3') {
            const text = cleanText(element.textContent);
            if (text && !processedTexts.has(text)) {
              processedTexts.add(text);
              docChildren.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: text,
                      bold: true,
                      size: 32, // 16pt
                      font: '맑은 고딕',
                      color: '1e40af',
                    }),
                  ],
                  heading: HeadingLevel.HEADING_2,
                  spacing: { before: 500, after: 200, line: 360 },
                })
              );
            }
          }
          
          // 단락 처리
          else if (tagName === 'p') {
            // 부모가 CTA 박스면 스킵 (이미 처리됨)
            if (element.closest('.cta-box')) continue;
            
            const text = cleanText(element.textContent);
            if (text && text.length > 2 && !processedTexts.has(text)) {
              processedTexts.add(text);
              docChildren.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: text,
                      size: 24, // 12pt
                      font: '맑은 고딕',
                    }),
                  ],
                  spacing: { after: 240, line: 400 }, // 1.5배 줄간격
                  alignment: AlignmentType.BOTH, // 양쪽 정렬
                })
              );
            }
          }
          
          // 리스트 아이템 처리
          else if (tagName === 'li') {
            const text = cleanText(element.textContent);
            if (text && !processedTexts.has(text)) {
              processedTexts.add(text);
              docChildren.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: '• ' + text,
                      size: 24,
                      font: '맑은 고딕',
                    }),
                  ],
                  spacing: { after: 150, line: 360 },
                  indent: { left: 500 },
                })
              );
            }
          }
          
          // 단독 이미지 처리
          else if (tagName === 'img') {
            // 이미 wrapper로 처리된 이미지는 스킵
            if (element.closest('.content-image-wrapper')) continue;
            
            const src = (element as HTMLImageElement).src;
            if (src) {
              const imageData = await fetchImageAsArrayBuffer(src);
              if (imageData) {
                docChildren.push(
                  new Paragraph({
                    children: [
                      new ImageRun({
                        data: imageData,
                        transformation: {
                          width: 450,
                          height: 253,
                        },
                        type: 'png',
                      }),
                    ],
                    spacing: { before: 400, after: 400 },
                    alignment: AlignmentType.CENTER,
                  })
                );
              }
            }
          }
        }
      };
      
      // 컨테이너 안의 모든 요소 처리
      const container = tempDiv.querySelector('.naver-post-container') || tempDiv;
      await processElements(container);
      
      // 문서 생성 - 페이지 설정 포함
      const doc = new Document({
        sections: [{
          properties: {
            page: {
              margin: {
                top: 1440,    // 1 inch = 1440 twips
                right: 1440,
                bottom: 1440,
                left: 1440,
              },
            },
          },
          children: docChildren.length > 0 ? docChildren : [
            new Paragraph({
              children: [new TextRun({ text: tempDiv.textContent || '', font: '맑은 고딕' })],
            }),
          ],
        }],
      });
      
      // .docx 파일로 저장
      const blob = await Packer.toBlob(doc);
      saveAs(blob, `hospital-ai-content-${Date.now()}.docx`);
      
    } catch (e) {
      console.error('Word 생성 오류:', e);
      alert('Word 문서 생성 중 오류가 발생했습니다.');
    } finally {
      setEditProgress('');
    }
  };

  // PDF 다운로드 함수 (개선된 정렬)
  const handleDownloadPDF = async () => {
    setEditProgress('PDF 생성 중...');
    
    try {
      const styledHtml = applyInlineStylesForNaver(localHtml, currentTheme);
      
      // 새 창에서 프린트 다이얼로그 열기 (PDF로 저장 가능)
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('팝업이 차단되었습니다. 팝업을 허용해주세요.');
        return;
      }
      
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Hospital AI Content - PDF</title>
          <style>
            @page {
              size: A4;
              margin: 2cm;
            }
            @media print {
              body { 
                -webkit-print-color-adjust: exact; 
                print-color-adjust: exact;
              }
              /* 페이지 나눔 방지 */
              h3, p, li, img {
                page-break-inside: avoid;
              }
              /* 제목 뒤에서 페이지 나눔 방지 */
              h2, h3 {
                page-break-after: avoid;
              }
              /* 이미지 전후 페이지 나눔 설정 */
              .content-image-wrapper, img {
                page-break-inside: avoid;
                page-break-before: auto;
                page-break-after: auto;
              }
            }
            * {
              box-sizing: border-box;
            }
            body { 
              font-family: '맑은 고딕', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; 
              line-height: 1.9; 
              padding: 0;
              margin: 0;
              max-width: 100%;
              color: #333;
              font-size: 14px;
              word-break: keep-all;
              overflow-wrap: break-word;
            }
            /* 메인 제목 */
            h2, .main-title { 
              font-size: 24px; 
              font-weight: 900; 
              margin: 0 0 20px 0;
              padding-bottom: 15px;
              color: #1a1a1a; 
              border-bottom: 3px solid #10b981;
              line-height: 1.4;
            }
            /* 소제목 */
            h3 { 
              font-size: 18px; 
              font-weight: 700; 
              margin: 35px 0 15px 0;
              padding: 12px 16px;
              color: #1e40af;
              background: linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%);
              border-left: 4px solid #3b82f6;
              border-radius: 0 8px 8px 0;
            }
            /* 본문 */
            p { 
              font-size: 14px; 
              margin: 0 0 18px 0;
              color: #333;
              text-align: justify;
              line-height: 1.9;
            }
            /* 리스트 */
            ul { 
              margin: 15px 0 20px 0;
              padding-left: 0;
              list-style: none;
            }
            li { 
              font-size: 14px; 
              margin-bottom: 12px;
              padding: 10px 15px 10px 30px;
              background: #f8fafc;
              border-radius: 8px;
              position: relative;
              line-height: 1.7;
            }
            li::before {
              content: '•';
              position: absolute;
              left: 12px;
              color: #10b981;
              font-weight: bold;
              font-size: 18px;
            }
            /* 이미지 */
            img { 
              max-width: 100%; 
              height: auto; 
              margin: 25px auto;
              display: block;
              border-radius: 12px;
              box-shadow: 0 4px 20px rgba(0,0,0,0.08);
            }
            .content-image-wrapper {
              margin: 30px 0;
              text-align: center;
            }
            .content-image-wrapper img {
              margin: 0 auto;
            }
            /* CTA 박스 */
            .cta-box, [class*="cta"] { 
              background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
              border: 2px solid #10b981;
              padding: 25px;
              margin: 30px 0;
              border-radius: 16px;
              page-break-inside: avoid;
            }
            /* 해시태그 */
            .hashtags, [class*="hashtag"] {
              margin-top: 30px;
              padding: 15px;
              background: #f8fafc;
              border-radius: 12px;
              color: #64748b;
              font-size: 13px;
            }
            /* 숨김 요소 */
            .hidden-title { display: none; }
          </style>
        </head>
        <body>
          ${styledHtml}
          <script>
            window.onload = function() {
              // 이미지 로드 완료 후 프린트
              var images = document.querySelectorAll('img');
              var loadedCount = 0;
              var totalImages = images.length;
              
              function tryPrint() {
                setTimeout(function() { window.print(); }, 500);
              }
              
              if (totalImages === 0) {
                tryPrint();
                return;
              }
              
              for (var i = 0; i < images.length; i++) {
                var img = images[i];
                if (img.complete) {
                  loadedCount++;
                } else {
                  img.onload = img.onerror = function() {
                    loadedCount++;
                    if (loadedCount >= totalImages) {
                      tryPrint();
                    }
                  };
                }
              }
              
              if (loadedCount >= totalImages) {
                tryPrint();
              }
              
              // 안전장치: 5초 후 강제 프린트
              setTimeout(function() { window.print(); }, 5000);
            };
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();
    } catch (e) {
      alert('PDF 생성 중 오류가 발생했습니다.');
    } finally {
      setEditProgress('');
    }
  };

  const applyInlineStylesForNaver = (html: string, theme: CssTheme = currentTheme) => {
    let styled = html;
    
    if (content.postType === 'card_news') {
        // 카드뉴스: 클래스를 유지하면서 인라인 스타일 추가 (다운로드/재생성 기능 위해 클래스 필수)
        styled = styled
            .replace(/<div class="card-news-container"/g, '<div class="card-news-container" style="max-width: 480px; margin: 0 auto; padding: 16px;"')
            .replace(/<div class="card-grid-wrapper"/g, '<div class="card-grid-wrapper" style="display: flex; flex-direction: column; gap: 24px;"')
            .replace(/<div class="card-slide"/g, '<div class="card-slide" style="background: linear-gradient(180deg, #E8F4FD 0%, #F0F9FF 100%); border-radius: 24px; box-shadow: 0 8px 32px rgba(0,0,0,0.06); overflow: hidden; width: 100%; aspect-ratio: 1/1;"')
            .replace(/<div class="card-border-box"/g, '<div class="card-border-box" style="border: 3px solid #1e293b; border-radius: 20px; margin: 16px; height: calc(100% - 32px); display: flex; flex-direction: column; background: #fff; overflow: hidden;"')
            .replace(/<div class="card-header-row"/g, '<div class="card-header-row" style="padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9;"')
            .replace(/class="brand-text"/g, 'class="brand-text" style="font-size: 10px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; color: #1e293b;"')
            .replace(/class="arrow-icon"/g, 'class="arrow-icon" style="font-size: 16px; border: 2px solid #1e293b; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; color: #1e293b;"')
            .replace(/<div class="card-content-area"/g, '<div class="card-content-area" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 20px 24px; gap: 8px;"')
            .replace(/class="card-subtitle"/g, 'class="card-subtitle" style="font-size: 13px; font-weight: 700; color: #3b82f6; margin-bottom: 4px;"')
            .replace(/class="card-divider-dotted"/g, 'class="card-divider-dotted" style="width: 60%; border-bottom: 2px dotted #cbd5e1; margin: 8px 0 12px 0;"')
            .replace(/class="card-main-title"/g, 'class="card-main-title" style="font-size: 26px; font-weight: 900; color: #0f172a; line-height: 1.3; margin: 0; word-break: keep-all; letter-spacing: -0.5px; display: block; text-align: center; max-width: 100%; padding: 0 8px;"')
            .replace(/<h1([^>]*)>/g, '<p$1>')
            .replace(/<\/h1>/g, '</p>')
            .replace(/class="card-highlight"/g, 'class="card-highlight" style="color: #3b82f6;"')
            .replace(/<div class="card-img-container"/g, '<div class="card-img-container" style="width: 100%; display: flex; justify-content: center; align-items: center; padding: 12px 0;"')
            .replace(/class="card-inner-img"/g, 'class="card-inner-img" style="width: 85%; max-height: 220px; object-fit: cover; object-position: center top; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.08);"')
            .replace(/class="card-desc"/g, 'class="card-desc" style="font-size: 15px; color: #475569; margin-top: 12px; font-weight: 500; line-height: 1.7; word-break: keep-all; max-width: 90%;"')
            .replace(/<div class="card-footer-row"/g, '<div class="card-footer-row" style="padding: 12px 20px 16px; display: flex; justify-content: center; gap: 8px; border-top: 1px solid #f1f5f9;"')
            .replace(/class="pill-tag"/g, 'class="pill-tag" style="background: #f1f5f9; padding: 6px 12px; border-radius: 16px; font-size: 11px; font-weight: 700; color: #475569;"')
            .replace(/class="hidden-title"/g, 'class="hidden-title" style="display: none;"')
            .replace(/class="legal-box-card"/g, 'class="legal-box-card" style="font-size: 10px; color: #94a3b8; text-align: center; margin-top: 16px; line-height: 1.5;"');
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
      
      // Undo를 위해 현재 상태 저장
      saveToHistory();
      
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
                  // 커스텀 스타일인 경우 저장된 커스텀 프롬프트 사용
                  const customStylePrompt = style === 'custom' ? content.customImagePrompt : undefined;
                  newImageMap[targetIdx] = await generateSingleImage(prompt, style, '16:9', customStylePrompt);
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
    <div className={`rounded-[48px] shadow-2xl border h-full flex flex-col overflow-hidden relative transition-colors duration-300 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
      <style>{`
        .naver-preview .main-title { font-size: 32px; font-weight: 900; margin-bottom: 30px; color: #000; line-height: 1.4; border-bottom: 3px solid #10b981; padding-bottom: 20px; }
        .naver-preview h3 { font-size: 24px; font-weight: bold; margin-top: 50px; margin-bottom: 20px; color: #000; }
        .naver-preview p { font-size: 16px; margin-bottom: 20px; color: #333; line-height: 1.8; }
        .naver-preview .content-image-wrapper { position: relative; margin: 90px 0; }
        .naver-preview .content-image-wrapper img { width: 100%; border-radius: 48px; display: block; box-shadow: 0 30px 70px rgba(0,0,0,0.12); cursor: pointer; transition: filter 0.3s; }
        .naver-preview .content-image-wrapper:hover img { filter: brightness(0.8); }
        .naver-preview .content-image-wrapper::after { content: '✨ 이미지 재생성'; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(79, 70, 229, 0.9); color: white; padding: 12px 24px; border-radius: 20px; font-weight: 900; font-size: 14px; opacity: 0; pointer-events: none; transition: opacity 0.3s; }
        .naver-preview .content-image-wrapper:hover::after { opacity: 1; }

        .card-news-container { max-width: 480px; margin: 0 auto; }
        .card-grid-wrapper { display: flex; flex-direction: column; gap: 24px; }
        
        .card-slide { 
           background: linear-gradient(180deg, #E8F4FD 0%, #F0F9FF 100%); 
           border-radius: 24px; 
           box-shadow: 0 8px 32px rgba(0,0,0,0.06); 
           overflow: hidden; 
           position: relative; 
           width: 100%; 
           aspect-ratio: 1/1;
           cursor: pointer;
           transition: transform 0.2s, box-shadow 0.2s;
        }
        .card-slide:hover {
           transform: translateY(-4px);
           box-shadow: 0 12px 40px rgba(0,0,0,0.12);
        }
        .card-slide:hover .card-overlay {
           opacity: 1;
        }
        .card-overlay {
           position: absolute;
           inset: 0;
           background: rgba(0,0,0,0.5);
           display: flex;
           flex-direction: column;
           justify-content: center;
           align-items: center;
           gap: 12px;
           opacity: 0;
           transition: opacity 0.2s;
           z-index: 10;
        }
        .card-overlay-btn {
           padding: 12px 24px;
           border-radius: 12px;
           font-weight: 700;
           font-size: 14px;
           border: none;
           cursor: pointer;
           transition: transform 0.1s;
           display: flex;
           align-items: center;
           gap: 8px;
        }
        .card-overlay-btn:hover {
           transform: scale(1.05);
        }
        .card-overlay-btn.regen {
           background: linear-gradient(135deg, #8B5CF6, #6366F1);
           color: white;
        }
        .card-overlay-btn.download {
           background: white;
           color: #1e293b;
        }
        .card-number-badge {
           position: absolute;
           top: 12px;
           left: 12px;
           background: rgba(0,0,0,0.6);
           color: white;
           padding: 4px 10px;
           border-radius: 8px;
           font-size: 12px;
           font-weight: 700;
           z-index: 5;
        }

        .card-border-box {
           border: 3px solid #1e293b;
           border-radius: 20px;
           margin: 16px;
           height: calc(100% - 32px);
           display: flex;
           flex-direction: column;
           background: #fff;
           overflow: hidden;
        }

        .card-header-row {
           padding: 16px 20px;
           display: flex;
           justify-content: space-between;
           align-items: center;
           border-bottom: 1px solid #f1f5f9;
        }
        
        .brand-text {
           font-size: 10px;
           font-weight: 900;
           letter-spacing: 2px;
           text-transform: uppercase;
           color: #1e293b;
        }

        .arrow-icon {
           font-size: 16px;
           border: 2px solid #1e293b;
           border-radius: 50%;
           width: 28px;
           height: 28px;
           display: flex;
           align-items: center;
           justify-content: center;
           color: #1e293b;
        }

        .card-content-area {
           flex: 1;
           display: flex;
           flex-direction: column;
           align-items: center;
           justify-content: center;
           text-align: center;
           padding: 20px 24px;
           gap: 8px;
        }

        .card-subtitle {
           font-size: 13px;
           font-weight: 700;
           color: #3b82f6;
           margin-bottom: 4px;
           letter-spacing: -0.3px;
        }

        .card-divider-dotted {
           width: 60%;
           border-bottom: 2px dotted #cbd5e1;
           margin: 8px 0 12px 0;
        }

        .card-main-title,
        .card-content-area h1.card-main-title,
        .card-content-area p.card-main-title {
           font-size: 26px !important;
           font-weight: 900 !important;
           color: #0f172a !important;
           line-height: 1.3 !important;
           margin: 0 !important;
           word-break: keep-all !important;
           letter-spacing: -0.5px !important;
           white-space: pre-line !important;
           display: block !important;
           text-align: center !important;
           max-width: 100% !important;
           padding: 0 8px !important;
        }

        .card-highlight {
           color: #3b82f6;
        }
        
        .card-img-container {
           width: 100%;
           display: flex;
           justify-content: center;
           align-items: center;
           padding: 12px 0;
        }
        
        .card-inner-img {
            width: 85%;
            max-height: 220px;
            object-fit: cover;
            object-position: center top;
            border-radius: 12px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.08);
        }
        
        .card-desc {
            font-size: 15px;
            color: #475569;
            margin-top: 12px;
            font-weight: 500;
            line-height: 1.7;
            word-break: keep-all;
            max-width: 90%;
            min-height: 40px;
        }

        .card-footer-row {
           padding: 12px 20px 16px;
           display: flex;
           justify-content: center;
           gap: 8px;
           border-top: 1px solid #f1f5f9;
        }

        .pill-tag {
           background: #f1f5f9;
           padding: 6px 12px;
           border-radius: 16px;
           font-size: 11px;
           font-weight: 700;
           color: #475569;
        }

        .hidden-title { display: none; }
        .legal-box-card { font-size: 10px; color: #94a3b8; text-align: center; margin-top: 16px; line-height: 1.5; }
      `}</style>

      {/* 이미지 클릭 시 선택 모달 (다운로드 or 재생성) */}
      {downloadModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-6">
          <div className={`w-full max-w-md rounded-[28px] shadow-2xl overflow-hidden ${darkMode ? 'bg-slate-800' : 'bg-white'}`}>
            <div className={`px-6 py-4 border-b flex items-center justify-between ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
              <div className={`text-sm font-black ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>🖼️ {downloadImgIndex}번 이미지</div>
              <button
                type="button"
                onClick={() => setDownloadModalOpen(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black ${darkMode ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' : 'bg-slate-100 hover:bg-slate-200'}`}
              >
                ✕
              </button>
            </div>
            
            {/* 이미지 미리보기 */}
            <div className="p-4">
              <img 
                src={downloadImgSrc} 
                alt={`이미지 ${downloadImgIndex}`}
                className="w-full h-48 object-cover rounded-xl"
              />
            </div>
            
            {/* 버튼들 */}
            <div className="px-6 pb-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  downloadImage(downloadImgSrc, downloadImgIndex);
                  setDownloadModalOpen(false);
                }}
                className="flex-1 py-3 bg-blue-500 text-white font-bold rounded-xl hover:bg-blue-600 transition-all flex items-center justify-center gap-2"
              >
                📥 다운로드
              </button>
              <button
                type="button"
                onClick={() => {
                  setDownloadModalOpen(false);
                  setRegenOpen(true);
                }}
                className="flex-1 py-3 bg-purple-500 text-white font-bold rounded-xl hover:bg-purple-600 transition-all flex items-center justify-center gap-2"
              >
                ✨ 재생성
              </button>
            </div>
          </div>
        </div>
      )}

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
                {/* 영어 프롬프트인 경우 안내 메시지 */}
                {regenPrompt && /^[a-zA-Z\s,.\-:;'"!?()]+$/.test(regenPrompt.trim()) && (
                  <div className="mb-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <div className="text-xs text-amber-700 font-bold">
                      ⚠️ 현재 영어 프롬프트입니다. 한글로 수정하거나 "AI 프롬프트 추천" 버튼을 눌러 새 프롬프트를 받아보세요!
                    </div>
                  </div>
                )}
                <textarea
                  value={regenPrompt}
                  onChange={(e) => setRegenPrompt(e.target.value)}
                  className="w-full h-32 p-4 rounded-2xl border border-slate-200 bg-slate-50 outline-none font-mono text-sm"
                  placeholder="예: 병원에서 의사가 환자와 상담하는 따뜻한 장면, 밝은 조명..."
                  disabled={isRecommendingPrompt}
                />
                <div className="text-[11px] text-slate-500 mt-2">
                  💡 팁: 한글로 원하는 이미지를 설명하세요! "AI 프롬프트 추천" 버튼을 누르면 글 내용에 맞는 최적의 프롬프트를 자동 생성합니다.
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
          <div className="flex items-center gap-6">
            {/* 전환 점수 (Conversion Score) - 상단에 배치 */}
            <div className="flex flex-col">
              <span className="text-[10px] font-black opacity-50 uppercase tracking-[0.1em] mb-1">🎯 전환력 점수</span>
              <div className="flex items-center gap-2">
                 <span className={`text-3xl font-black ${(content.factCheck.conversion_score || 0) >= 80 ? 'text-emerald-400' : (content.factCheck.conversion_score || 0) >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                   {content.factCheck.conversion_score || 0}점
                 </span>
                 <span className="text-[10px] opacity-70 leading-tight">
                   {(content.factCheck.conversion_score || 0) >= 80 ? '🔥 강력' : (content.factCheck.conversion_score || 0) >= 60 ? '👍 적당' : '💡 보완 필요'}
                 </span>
              </div>
            </div>
            
            {/* 구분선 */}
            <div className="w-px h-12 bg-slate-700"></div>
            
            {/* 안전성 점수 (Safety Score) */}
            <div className="flex flex-col">
              <span className="text-[10px] font-black opacity-50 uppercase tracking-[0.1em] mb-1">⚖️ 의료법 준수</span>
              <div className="flex items-center gap-2">
                 <span className={`text-3xl font-black ${content.factCheck.safety_score > 80 ? 'text-green-400' : 'text-amber-400'}`}>
                   {content.factCheck.safety_score}점
                 </span>
                 <span className="text-[10px] opacity-70">{content.factCheck.safety_score > 80 ? '✅ 안전' : '⚠️ 검토 필요'}</span>
              </div>
            </div>
            
            {content.postType === 'card_news' && (
                <div className="hidden lg:block ml-4">
                   <span className="text-xs font-bold text-blue-400 border border-blue-400 px-2 py-1 rounded-lg">카드뉴스 모드</span>
                </div>
            )}
          </div>
          <div className="flex items-center gap-2">
             <span className="text-[10px] font-black uppercase text-slate-400 mr-2 hidden lg:inline">다운로드</span>
             {content.postType === 'card_news' ? (
               <>
                 <button 
                   onClick={() => setCardDownloadModalOpen(true)} 
                   disabled={downloadingCard} 
                   className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2"
                 >
                   📥 다운로드
                 </button>
               </>
             ) : (
               <>
                 <button onClick={handleDownloadWord} disabled={isEditingAi} className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2">
                    📄 Word
                 </button>
                 <button onClick={handleDownloadPDF} disabled={isEditingAi} className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2">
                    📑 PDF
                 </button>
               </>
             )}
          </div>
        </div>
      )}
      
      {/* 카드 재생성 모달 */}
      {cardRegenModalOpen && content.postType === 'card_news' && (
        <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-6" onClick={() => setShowHistoryDropdown(false)}>
          <div className={`w-full max-w-lg rounded-[28px] shadow-2xl overflow-hidden ${darkMode ? 'bg-slate-800' : 'bg-white'}`} onClick={(e) => e.stopPropagation()}>
            <div className={`px-6 py-4 border-b flex items-center justify-between ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
              <div>
                <div className={`text-lg font-black ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>🔄 {cardRegenIndex + 1}번 카드 재생성</div>
                <div className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {cardRegenIndex === 0 ? '표지' : `${cardRegenIndex + 1}번째 슬라이드`}를 새롭게 만듭니다
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCardRegenModalOpen(false)}
                disabled={isRegeneratingCard}
                className={`px-3 py-1.5 rounded-lg text-xs font-black ${darkMode ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' : 'bg-slate-100 hover:bg-slate-200'}`}
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {cardRegenProgress && (
                <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm font-bold text-blue-700">{cardRegenProgress}</span>
                </div>
              )}
              
              {/* 실시간 미리보기 - 실제 이미지 위에 텍스트 오버레이 */}
              <div className={`rounded-xl border overflow-hidden ${darkMode ? 'border-blue-600 bg-blue-900/30' : 'border-blue-200 bg-blue-50'}`}>
                <div className={`px-4 py-2 text-xs font-black ${darkMode ? 'bg-blue-800 text-blue-200' : 'bg-blue-100 text-blue-700'}`}>
                  👁️ 실시간 미리보기
                </div>
                <div className="p-4">
                  <div className="relative aspect-square max-w-[220px] mx-auto rounded-xl overflow-hidden shadow-lg">
                    {/* 배경 이미지 */}
                    {currentCardImage ? (
                      <img 
                        src={currentCardImage} 
                        alt="현재 카드" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-100 to-blue-200" />
                    )}
                    
                    {/* 텍스트 오버레이 */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 bg-black/20">
                      {editSubtitle && (
                        <p className="text-[10px] text-white font-bold drop-shadow-lg bg-blue-500/80 px-2 py-0.5 rounded mb-1">
                          {editSubtitle}
                        </p>
                      )}
                      {editMainTitle && (
                        <p className="text-sm font-black text-white leading-tight drop-shadow-lg bg-black/40 px-3 py-1.5 rounded-lg max-w-[90%]">
                          {editMainTitle}
                        </p>
                      )}
                      {editDescription && (
                        <p className="text-[9px] text-white/90 leading-tight drop-shadow mt-2 max-w-[85%] bg-black/30 px-2 py-1 rounded">
                          {editDescription}
                        </p>
                      )}
                    </div>
                  </div>
                  <p className={`text-center text-[9px] mt-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    ※ 실제 카드와 다를 수 있습니다
                  </p>
                </div>
              </div>
              
              {/* 📝 카드 프롬프트 편집 */}
              <div className={`rounded-xl border overflow-hidden ${darkMode ? 'border-slate-600 bg-slate-700/50' : 'border-slate-200 bg-slate-50'}`}>
                <div className={`px-4 py-2 text-xs font-black flex items-center justify-between ${darkMode ? 'bg-slate-600 text-slate-300' : 'bg-slate-200 text-slate-600'}`}>
                  <span>✏️ 카드 프롬프트 편집</span>
                  <div className="flex items-center gap-2 relative">
                    {/* 불러오기 버튼 */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowHistoryDropdown(!showHistoryDropdown)}
                        disabled={promptHistory.length === 0}
                        className={`px-2 py-1 rounded text-[10px] font-bold transition-all disabled:opacity-40 ${
                          darkMode 
                            ? 'bg-amber-600 text-white hover:bg-amber-500' 
                            : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                        }`}
                      >
                        📂 불러오기
                      </button>
                      
                      {/* 히스토리 드롭다운 */}
                      {showHistoryDropdown && promptHistory.length > 0 && (
                        <div 
                          className={`absolute top-full right-0 mt-2 w-72 rounded-xl shadow-2xl z-[10000] overflow-hidden border-2 ${
                            darkMode ? 'bg-slate-800 border-amber-500' : 'bg-white border-amber-300'
                          }`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className={`px-3 py-2 text-[10px] font-bold ${darkMode ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800'}`}>
                            📂 저장된 프롬프트 ({promptHistory.length}개)
                          </div>
                          {promptHistory.map((item, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => loadFromHistory(item)}
                              className={`w-full px-4 py-3 text-left text-xs transition-all border-b last:border-b-0 ${
                                darkMode 
                                  ? 'hover:bg-amber-900/50 text-slate-200 border-slate-700' 
                                  : 'hover:bg-amber-50 text-slate-700 border-slate-100'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-black text-sm truncate flex-1">{item.mainTitle || '(제목 없음)'}</span>
                                <span className={`text-[9px] ml-2 px-2 py-0.5 rounded-full ${darkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                                  {item.savedAt}
                                </span>
                              </div>
                              {item.subtitle && (
                                <div className={`text-[10px] truncate ${darkMode ? 'text-amber-400' : 'text-amber-600'}`}>
                                  📌 {item.subtitle}
                                </div>
                              )}
                              {item.description && (
                                <div className={`text-[9px] truncate mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                  {item.description.slice(0, 50)}...
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* 저장 버튼 */}
                    <button
                      type="button"
                      onClick={savePromptToHistory}
                      disabled={!editSubtitle && !editMainTitle && !editDescription}
                      className={`px-2 py-1 rounded text-[10px] font-bold transition-all disabled:opacity-40 ${
                        darkMode 
                          ? 'bg-emerald-600 text-white hover:bg-emerald-500' 
                          : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      }`}
                    >
                      💾 저장
                    </button>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  {/* 텍스트 프롬프트 편집 */}
                  <div className="space-y-2">
                    <div className={`text-xs font-bold ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>📝 텍스트 내용</div>
                    
                    <div>
                      <label className={`text-xs font-bold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>부제</label>
                      <input
                        type="text"
                        value={editSubtitle}
                        onChange={(e) => setEditSubtitle(e.target.value)}
                        disabled={isRegeneratingCard}
                        placeholder="예: 놓치기 쉬운 신호"
                        className={`w-full mt-1 px-3 py-2 rounded-lg text-xs border outline-none ${
                          darkMode 
                            ? 'bg-slate-600 border-slate-500 text-slate-100 placeholder-slate-400'
                            : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
                        }`}
                      />
                    </div>
                    
                    <div>
                      <label className={`text-xs font-bold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>메인 제목</label>
                      <input
                        type="text"
                        value={editMainTitle}
                        onChange={(e) => setEditMainTitle(e.target.value)}
                        disabled={isRegeneratingCard}
                        placeholder="예: 심장이 보내는 경고"
                        className={`w-full mt-1 px-3 py-2 rounded-lg text-xs border outline-none ${
                          darkMode 
                            ? 'bg-slate-600 border-slate-500 text-slate-100 placeholder-slate-400'
                            : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
                        }`}
                      />
                    </div>
                    
                    <div>
                      <label className={`text-xs font-bold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>설명</label>
                      <textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        disabled={isRegeneratingCard}
                        placeholder="예: 이런 증상이 나타나면 주의가 필요해요"
                        rows={2}
                        className={`w-full mt-1 px-3 py-2 rounded-lg text-xs border outline-none resize-none ${
                          darkMode 
                            ? 'bg-slate-600 border-slate-500 text-slate-100 placeholder-slate-400'
                            : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
                        }`}
                      />
                    </div>
                    
                  </div>
                  
                  {/* 이미지 프롬프트 편집 */}
                  <div>
                    <div className={`text-xs font-bold mb-1 flex items-center justify-between ${darkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                      <span>🎨 이미지 프롬프트</span>
                      <span className={`text-[9px] font-normal ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        텍스트 변경 시 자동 연동됨
                      </span>
                    </div>
                    <textarea
                      value={editImagePrompt}
                      onChange={(e) => setEditImagePrompt(e.target.value)}
                      disabled={isRegeneratingCard}
                      placeholder="예: 1:1 정사각형 카드뉴스, 파란 배경, 심장 3D 일러스트..."
                      rows={5}
                      className={`w-full px-3 py-2 rounded-lg text-xs border outline-none resize-y min-h-[80px] ${
                        darkMode 
                          ? 'bg-slate-600 border-slate-500 text-slate-100 placeholder-slate-400'
                          : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
                      }`}
                    />
                    <div className={`text-[9px] mt-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      💡 위의 부제/메인제목/설명을 수정하면 이 프롬프트도 자동으로 업데이트됩니다
                    </div>
                  </div>
                  
                  {/* 🖼️ 참고 이미지 업로드 */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className={`text-xs font-bold ${darkMode ? 'text-orange-400' : 'text-orange-600'}`}>
                        🖼️ 참고 이미지 {isRefImageLocked && <span className="text-emerald-500">🔒 고정됨</span>}
                      </div>
                      {cardRegenRefImage && (
                        <button
                          type="button"
                          onClick={() => {
                            if (isRefImageLocked) {
                              clearRefImageFromStorage();
                            } else {
                              saveRefImageToStorage(cardRegenRefImage, refImageMode);
                            }
                          }}
                          className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${
                            isRefImageLocked
                              ? (darkMode ? 'bg-emerald-600 text-white hover:bg-red-500' : 'bg-emerald-100 text-emerald-700 hover:bg-red-100 hover:text-red-700')
                              : (darkMode ? 'bg-slate-600 text-slate-300 hover:bg-emerald-600' : 'bg-slate-100 text-slate-600 hover:bg-emerald-100 hover:text-emerald-700')
                          }`}
                        >
                          {isRefImageLocked ? '🔓 고정 해제' : '🔒 이 이미지 고정'}
                        </button>
                      )}
                    </div>
                    <div className={`text-[10px] mb-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      {isRefImageLocked 
                        ? '✅ 다음 재생성에도 이 참고 이미지가 자동 적용됩니다!'
                        : '원하는 스타일의 이미지를 업로드하면 비슷하게 만들어드려요!'}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            const newImage = ev.target?.result as string;
                            setCardRegenRefImage(newImage);
                            // 새 이미지 업로드 시 고정 해제
                            if (isRefImageLocked) {
                              clearRefImageFromStorage();
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      disabled={isRegeneratingCard}
                      className={`w-full text-xs file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold transition-all ${
                        darkMode 
                          ? 'file:bg-slate-600 file:text-slate-200 hover:file:bg-slate-500'
                          : 'file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200'
                      }`}
                    />
                    {cardRegenRefImage && (
                      <>
                        <div className="mt-2 relative">
                          <img src={cardRegenRefImage} alt="참고 이미지" className="max-h-24 rounded-lg border border-slate-300" />
                          <button
                            type="button"
                            onClick={() => {
                              setCardRegenRefImage('');
                              if (isRefImageLocked) {
                                clearRefImageFromStorage();
                              }
                            }}
                            className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs font-bold"
                          >
                            ✕
                          </button>
                          {isRefImageLocked && (
                            <div className="absolute -top-2 -left-2 w-5 h-5 bg-emerald-500 text-white rounded-full text-xs font-bold flex items-center justify-center">
                              🔒
                            </div>
                          )}
                        </div>
                        
                        {/* 적용 방식 선택 */}
                        <div className={`mt-3 p-3 rounded-lg ${darkMode ? 'bg-slate-600' : 'bg-orange-50'}`}>
                          <div className={`text-[10px] font-bold mb-2 ${darkMode ? 'text-orange-300' : 'text-orange-700'}`}>
                            🎨 스타일 적용 방식
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setRefImageMode('inspire');
                                if (isRefImageLocked) {
                                  saveRefImageToStorage(cardRegenRefImage, 'inspire');
                                }
                              }}
                              className={`flex-1 px-3 py-2 rounded-lg text-[11px] font-bold transition-all ${
                                refImageMode === 'inspire'
                                  ? 'bg-orange-500 text-white'
                                  : darkMode 
                                    ? 'bg-slate-700 text-slate-300 hover:bg-slate-500' 
                                    : 'bg-white text-slate-600 hover:bg-orange-100'
                              }`}
                            >
                              ✨ 느낌만 참고
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRefImageMode('copy');
                                if (isRefImageLocked) {
                                  saveRefImageToStorage(cardRegenRefImage, 'copy');
                                }
                              }}
                              className={`flex-1 px-3 py-2 rounded-lg text-[11px] font-bold transition-all ${
                                refImageMode === 'copy'
                                  ? 'bg-orange-500 text-white'
                                  : darkMode 
                                    ? 'bg-slate-700 text-slate-300 hover:bg-slate-500' 
                                    : 'bg-white text-slate-600 hover:bg-orange-100'
                              }`}
                            >
                              📋 레이아웃 복제
                            </button>
                          </div>
                          <div className={`text-[9px] mt-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            {refImageMode === 'inspire' 
                              ? '색상, 분위기만 참고하고 레이아웃은 자유롭게' 
                              : '텍스트 위치, 구도까지 최대한 동일하게'}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
              
            </div>
            
            <div className={`px-6 py-4 border-t flex justify-end gap-3 ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
              <button
                type="button"
                onClick={() => setCardRegenModalOpen(false)}
                disabled={isRegeneratingCard}
                className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  darkMode 
                    ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleCardRegenerate}
                disabled={isRegeneratingCard || (!editSubtitle && !editMainTitle && !editDescription && !editImagePrompt && !cardRegenRefImage)}
                className="px-6 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {isRegeneratingCard ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    재생성 중...
                  </>
                ) : (
                  cardRegenRefImage 
                    ? (refImageMode === 'copy' ? '📋 레이아웃 복제' : '✨ 느낌 참고 재생성')
                    : '🎨 이 카드 재생성'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 카드뉴스 다운로드 모달 */}
      {cardDownloadModalOpen && content.postType === 'card_news' && (
        <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-6">
          <div className={`w-full max-w-lg rounded-[28px] shadow-2xl overflow-hidden ${darkMode ? 'bg-slate-800' : 'bg-white'}`}>
            <div className={`px-6 py-4 border-b flex items-center justify-between ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
              <div className={`text-lg font-black ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>🖼️ 카드뉴스 다운로드</div>
              <button
                type="button"
                onClick={() => setCardDownloadModalOpen(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black ${darkMode ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' : 'bg-slate-100 hover:bg-slate-200'}`}
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {cardDownloadProgress && (
                <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm font-bold text-blue-700">{cardDownloadProgress}</span>
                </div>
              )}
              
              <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                <p className={`text-sm mb-3 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  📌 카드뉴스 전체를 이미지로 다운로드합니다.<br/>
                  각 카드가 PNG 이미지로 저장됩니다.
                </p>
                
                {/* 개별 카드 다운로드 & 재생성 */}
                <div className="space-y-2 mb-4">
                  <div className={`text-xs font-bold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>개별 카드 다운로드</div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {Array.from({ length: cardCount || 6 }, (_, i) => (
                      <div key={i} className="flex">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadCardAsImage(i);
                          }}
                          disabled={downloadingCard}
                          className={`flex-1 px-3 py-2.5 rounded-l-lg text-xs font-bold transition-all disabled:opacity-50 ${darkMode ? 'bg-slate-600 hover:bg-slate-500 text-white' : 'bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50 text-slate-700'}`}
                        >
                          📥 {i + 1}장
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCardDownloadModalOpen(false);
                            setTimeout(() => openCardRegenModal(i), 100);
                          }}
                          disabled={downloadingCard}
                          className={`px-3 py-2.5 rounded-r-lg text-xs font-bold transition-all disabled:opacity-50 ${darkMode ? 'bg-purple-600 hover:bg-purple-500 text-white' : 'bg-purple-100 border border-purple-200 hover:border-purple-400 hover:bg-purple-200 text-purple-700'}`}
                          title="이 카드 재생성"
                        >
                          🔄
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* 전체 다운로드 버튼 */}
              <button
                type="button"
                onClick={downloadAllCards}
                disabled={downloadingCard}
                className="w-full py-4 bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-bold rounded-xl hover:from-purple-600 hover:to-indigo-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                📥 모든 카드 일괄 다운로드
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={`p-6 border-b flex-none transition-colors duration-300 ${darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-100 bg-white'}`}>
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-4">
            <div className={`flex p-1.5 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
                <button onClick={() => setActiveTab('preview')} className={`px-8 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'preview' ? (darkMode ? 'bg-slate-600 text-emerald-400 shadow-sm' : 'bg-white text-green-600 shadow-sm') : 'text-slate-400'}`}>미리보기</button>
                <button onClick={() => setActiveTab('html')} className={`px-8 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'html' ? (darkMode ? 'bg-slate-600 text-emerald-400 shadow-sm' : 'bg-white text-green-600 shadow-sm') : 'text-slate-400'}`}>HTML</button>
            </div>
            
            {/* 글자 수 표시 */}
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
              <span className={`text-xs font-bold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>📊 글자 수:</span>
              <span className={`text-sm font-black ${charCount < 1500 ? 'text-amber-500' : charCount > 4000 ? 'text-blue-500' : 'text-emerald-500'}`}>
                {charCount.toLocaleString()}자
              </span>
              <span className={`text-[10px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                {charCount < 1500 ? '(짧음)' : charCount < 2500 ? '(적당)' : charCount < 4000 ? '(길음)' : '(매우 길음)'}
              </span>
            </div>
            
            {/* Undo 버튼 */}
            {canUndo && (
              <button
                type="button"
                onClick={handleUndo}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${darkMode ? 'bg-orange-900/50 text-orange-400 hover:bg-orange-900' : 'bg-orange-100 text-orange-700 hover:bg-orange-200'}`}
                title="이전 상태로 되돌리기"
              >
                ↩️ 되돌리기
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* 저장 버튼 */}
            <div className="flex items-center gap-1 relative">
              {/* 수동 저장 버튼 */}
              <button 
                onClick={saveManually}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${darkMode ? 'bg-blue-900/50 text-blue-400 hover:bg-blue-900' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
                title="현재 내용 저장"
              >
                💾 저장
              </button>
              
              {hasAutoSave() && (
                <div className="relative">
                  <button 
                    onClick={() => setShowAutoSaveDropdown(!showAutoSaveDropdown)}
                    className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${darkMode ? 'bg-amber-900/50 text-amber-400 hover:bg-amber-900' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}
                    title="저장된 글 불러오기"
                  >
                    📂 불러오기
                  </button>
                  
                  {/* 자동저장 히스토리 드롭다운 */}
                  {showAutoSaveDropdown && autoSaveHistory.length > 0 && (
                    <div 
                      className={`absolute bottom-full right-0 mb-2 w-72 rounded-xl shadow-2xl z-[10000] overflow-hidden border-2 ${
                        darkMode ? 'bg-slate-800 border-amber-500' : 'bg-white border-amber-300'
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className={`px-3 py-2 text-[10px] font-bold flex items-center justify-between ${darkMode ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800'}`}>
                        <span>📂 저장된 글 ({autoSaveHistory.length}개)</span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setShowAutoSaveDropdown(false); }}
                          className="text-xs hover:opacity-70"
                        >✕</button>
                      </div>
                      {autoSaveHistory.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => loadFromAutoSaveHistory(item)}
                          className={`w-full px-4 py-3 text-left text-xs transition-all border-b last:border-b-0 ${
                            darkMode 
                              ? 'hover:bg-amber-900/50 text-slate-200 border-slate-700' 
                              : 'hover:bg-amber-50 text-slate-700 border-slate-100'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-black text-sm truncate flex-1">{item.title}</span>
                            <span className={`text-[9px] ml-2 px-2 py-0.5 rounded-full ${
                              item.postType === 'card_news' 
                                ? 'bg-purple-100 text-purple-600' 
                                : 'bg-blue-100 text-blue-600'
                            }`}>
                              {item.postType === 'card_news' ? '카드뉴스' : '블로그'}
                            </span>
                          </div>
                          <div className={`text-[9px] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            🕐 {new Date(item.savedAt).toLocaleString('ko-KR', { 
                              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                            })}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {lastSaved && (
                <span className={`text-[10px] hidden lg:inline ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  💾 {lastSaved.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 저장됨
                </span>
              )}
            </div>
            
            <button onClick={handleCopy} className={`px-10 py-3 rounded-xl text-md font-bold text-white shadow-xl transition-all active:scale-95 ${copied ? 'bg-emerald-500' : 'bg-green-500 hover:bg-green-600'}`}>
                {copied ? '✅ 복사 완료' : '블로그로 복사'}
            </button>
          </div>
        </div>
        
        {/* 블로그 레이아웃 스타일 (블로그만 표시) */}
        {content.postType !== 'card_news' && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs font-black ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>🎨 블로그 레이아웃 스타일:</span>
              <span className={`text-[10px] font-medium ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{CSS_THEMES[currentTheme].description}</span>
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
                        : darkMode 
                          ? 'bg-slate-700 text-slate-300 border-slate-600 hover:border-slate-500'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    {themeInfo.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className={`flex-1 overflow-y-auto p-8 lg:p-16 custom-scrollbar transition-colors duration-300 ${darkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
        {activeTab === 'preview' ? (
          <div className={`mx-auto bg-white shadow-lg border border-slate-100 p-12 naver-preview min-h-[800px] ${content.postType === 'card_news' ? 'max-w-xl' : 'max-w-3xl'}`}>
              <div 
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleHtmlChange}
                onClick={(e) => {
                   const target = e.target as HTMLElement;
                   if (target.tagName === 'IMG') {
                      const imgElement = target as HTMLImageElement;
                      const allImgs = Array.from(editorRef.current?.querySelectorAll('img') || []);
                      const index = allImgs.indexOf(imgElement) + 1;
                      handleImageClick(imgElement.src, imgElement.alt, index);
                   }
                }}
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
      
      <div className={`p-6 border-t flex-none transition-colors duration-300 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
         <div className="max-w-4xl mx-auto">
            {isEditingAi && (
                <div className="mb-3 flex items-center gap-3 animate-pulse">
                    <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm font-bold text-green-600">{editProgress}</span>
                </div>
            )}
            
            {/* AI 프롬프트 템플릿 버튼들 */}
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setShowTemplates(!showTemplates)}
                  className={`text-xs font-bold flex items-center gap-1 ${darkMode ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <span>🎯 빠른 수정</span>
                  <span className={`transition-transform ${showTemplates ? 'rotate-180' : ''}`}>▼</span>
                </button>
                {!showTemplates && (
                  <span className={`text-[10px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>클릭하면 자주 쓰는 AI 수정 명령어가 나타납니다</span>
                )}
              </div>
              
              {showTemplates && (
                <div className={`flex flex-wrap gap-2 p-3 rounded-xl border animate-in fade-in duration-200 ${darkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                  {AI_PROMPT_TEMPLATES.map((template, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setEditorInput(template.prompt);
                        setShowTemplates(false);
                      }}
                      disabled={isEditingAi}
                      className={`px-3 py-2 border rounded-lg text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 ${darkMode ? 'bg-slate-600 border-slate-500 text-slate-300 hover:border-emerald-500 hover:text-emerald-400' : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
                    >
                      <span>{template.icon}</span>
                      <span>{template.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <form onSubmit={handleAiEditSubmit} className="flex gap-3">
                <input 
                    type="text" 
                    value={editorInput} 
                    onChange={(e) => setEditorInput(e.target.value)}
                    placeholder="예: '3번째 문단을 더 부드럽게 고치고 전체 그림을 현대적인 스타일로 바꿔줘'"
                    className={`flex-1 px-6 py-4 border rounded-xl focus:border-green-500 outline-none font-bold text-sm transition-colors ${darkMode ? 'bg-slate-700 border-slate-600 text-slate-100 placeholder-slate-400' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                    disabled={isEditingAi}
                />
                <button type="submit" disabled={isEditingAi} className={`px-8 py-4 font-bold rounded-xl transition-all text-sm ${darkMode ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-slate-900 text-white hover:bg-black'}`}>
                    {isEditingAi ? 'AI 작동중' : 'AI 정밀보정'}
                </button>
            </form>
         </div>
      </div>
    </div>
  );
};

export default ResultPreview;
