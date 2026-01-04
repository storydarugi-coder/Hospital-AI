import React, { useState, useEffect, useRef } from 'react';
import { GeneratedContent, ImageStyle, CssTheme } from '../types';
import { modifyPostWithAI, generateSingleImage, recommendImagePrompt } from '../services/geminiService';
import { CSS_THEMES, applyThemeToHtml } from '../utils/cssThemes';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

interface ResultPreviewProps {
  content: GeneratedContent;
}

const ResultPreview: React.FC<ResultPreviewProps> = ({ content }) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'html'>('preview');
  const [localHtml, setLocalHtml] = useState(content.fullHtml);
  const [currentTheme, setCurrentTheme] = useState<CssTheme>(content.cssTheme || 'modern');
  const [editorInput, setEditorInput] = useState('');
  const [isEditingAi, setIsEditingAi] = useState(false);
  const [editProgress, setEditProgress] = useState('');
  
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
    setRegenPrompt(currentPrompt || 'professional illustration');
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
      
      const recommendedPrompt = await recommendImagePrompt(textContent, regenPrompt);
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
      const newImageData = await generateSingleImage(regenPrompt.trim(), style, imgRatio);
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
              const images = document.querySelectorAll('img');
              let loadedCount = 0;
              const totalImages = images.length;
              
              if (totalImages === 0) {
                setTimeout(() => window.print(), 300);
                return;
              }
              
              images.forEach(img => {
                if (img.complete) {
                  loadedCount++;
                } else {
                  img.onload = img.onerror = () => {
                    loadedCount++;
                    if (loadedCount >= totalImages) {
                      setTimeout(() => window.print(), 300);
                    }
                  };
                }
              });
              
              if (loadedCount >= totalImages) {
                setTimeout(() => window.print(), 300);
              }
              
              // 안전장치: 5초 후 강제 프린트
              setTimeout(() => window.print(), 5000);
            };
            }
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
        styled = styled
            .replace(/<div class="card-news-container"/g, '<div style="max-width: 480px; margin: 0 auto; padding: 16px;"')
            .replace(/<div class="card-grid-wrapper"/g, '<div style="display: flex; flex-direction: column; gap: 24px;"')
            .replace(/<div class="card-slide"/g, '<div style="background: #f8fafc; border-radius: 24px; box-shadow: 0 8px 32px rgba(0,0,0,0.06); overflow: hidden; width: 100%; aspect-ratio: 1/1;"')
            .replace(/<div class="card-border-box"/g, '<div style="border: 3px solid #1e293b; border-radius: 20px; margin: 16px; height: calc(100% - 32px); display: flex; flex-direction: column; background: #fff; overflow: hidden;"')
            .replace(/<div class="card-header-row"/g, '<div style="padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9;"')
            .replace(/class="brand-text"/g, 'style="font-size: 10px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; color: #1e293b;"')
            .replace(/class="arrow-icon"/g, 'style="font-size: 16px; border: 2px solid #1e293b; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; color: #1e293b;"')
            .replace(/<div class="card-content-area"/g, '<div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 20px 24px; gap: 8px;"')
            .replace(/class="card-subtitle"/g, 'style="font-size: 13px; font-weight: 700; color: #3b82f6; margin-bottom: 4px;"')
            .replace(/class="card-divider-dotted"/g, 'style="width: 60%; border-bottom: 2px dotted #cbd5e1; margin: 8px 0 12px 0;"')
            .replace(/class="card-main-title"/g, 'style="font-size: 26px; font-weight: 900; color: #0f172a; line-height: 1.3; margin: 0; word-break: keep-all; letter-spacing: -0.5px; display: block; text-align: center; max-width: 100%; padding: 0 8px;"')
            .replace(/<h1([^>]*)>/g, '<p$1>')
            .replace(/<\/h1>/g, '</p>')
            .replace(/class="card-highlight"/g, 'style="color: #3b82f6;"')
            .replace(/<div class="card-img-container"/g, '<div style="width: 100%; display: flex; justify-content: center; align-items: center; padding: 12px 0;"')
            .replace(/class="card-inner-img"/g, 'style="width: 85%; max-height: 160px; object-fit: cover; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.08);"')
            .replace(/class="card-desc"/g, 'style="font-size: 13px; color: #475569; margin-top: 8px; font-weight: 600; line-height: 1.6; word-break: keep-all; max-width: 90%;"')
            .replace(/<div class="card-footer-row"/g, '<div style="padding: 12px 20px 16px; display: flex; justify-content: center; gap: 8px; border-top: 1px solid #f1f5f9;"')
            .replace(/class="pill-tag"/g, 'style="background: #f1f5f9; padding: 6px 12px; border-radius: 16px; font-size: 11px; font-weight: 700; color: #475569;"')
            .replace(/class="hidden-title"/g, 'style="display: none;"')
            .replace(/class="legal-box-card"/g, 'style="font-size: 10px; color: #94a3b8; text-align: center; margin-top: 16px; line-height: 1.5;"');
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
                  newImageMap[targetIdx] = await generateSingleImage(prompt, style);
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
    <div className="bg-white rounded-[48px] shadow-2xl border border-slate-200 h-full flex flex-col overflow-hidden relative">
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
           background: #f8fafc; 
           border-radius: 24px; 
           box-shadow: 0 8px 32px rgba(0,0,0,0.06); 
           overflow: hidden; 
           position: relative; 
           width: 100%; 
           aspect-ratio: 1/1; 
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
            max-height: 160px;
            object-fit: cover;
            border-radius: 12px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.08);
        }
        
        .card-desc {
            font-size: 13px;
            color: #475569;
            margin-top: 8px;
            font-weight: 600;
            line-height: 1.6;
            word-break: keep-all;
            max-width: 90%;
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
                <textarea
                  value={regenPrompt}
                  onChange={(e) => setRegenPrompt(e.target.value)}
                  className="w-full h-32 p-4 rounded-2xl border border-slate-200 bg-slate-50 outline-none font-mono text-sm"
                  placeholder="예: Korean professional doctor consultation scene..."
                  disabled={isRecommendingPrompt}
                />
                <div className="text-[11px] text-slate-500 mt-2">
                  💡 팁: "프롬프트 추천" 버튼을 누르면 AI가 글 내용을 분석해서 최적의 이미지 프롬프트를 자동으로 생성해줍니다!
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
          <div className="flex items-center gap-8">
            <div className="flex flex-col">
              <span className="text-[10px] font-black opacity-50 uppercase tracking-[0.1em] mb-1">Naver Logic Score</span>
              <div className="flex items-center gap-3">
                 <span className={`text-3xl font-black ${content.factCheck.safety_score > 80 ? 'text-green-400' : 'text-amber-400'}`}>
                   {content.factCheck.safety_score}점
                 </span>
                 <span className="text-xs opacity-70">안전성 확보</span>
              </div>
            </div>
            {content.postType === 'card_news' && (
                <div className="hidden lg:block">
                   <span className="text-xs font-bold text-blue-400 border border-blue-400 px-2 py-1 rounded-lg">카드뉴스 모드</span>
                </div>
            )}
          </div>
          <div className="flex items-center gap-2">
             <span className="text-[10px] font-black uppercase text-slate-400 mr-2 hidden lg:inline">다운로드</span>
             <button onClick={handleDownloadWord} disabled={isEditingAi} className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2">
                📄 Word
             </button>
             <button onClick={handleDownloadPDF} disabled={isEditingAi} className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2">
                📑 PDF
             </button>
          </div>
        </div>
      )}

      <div className="p-6 border-b border-slate-100 bg-white flex-none">
        <div className="flex justify-between items-center mb-4">
          <div className="flex bg-slate-100 p-1.5 rounded-xl">
              <button onClick={() => setActiveTab('preview')} className={`px-8 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'preview' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-400'}`}>미리보기</button>
              <button onClick={() => setActiveTab('html')} className={`px-8 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'html' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-400'}`}>HTML</button>
          </div>
          <button onClick={handleCopy} className={`px-10 py-3 rounded-xl text-md font-bold text-white shadow-xl transition-all active:scale-95 ${copied ? 'bg-emerald-500' : 'bg-green-500 hover:bg-green-600'}`}>
              {copied ? '✅ 복사 완료' : '블로그로 복사'}
          </button>
        </div>
        
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-black text-slate-400">🎨 블로그 레이아웃 스타일:</span>
            <span className="text-[10px] text-slate-500 font-medium">{CSS_THEMES[currentTheme].description}</span>
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
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  {themeInfo.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 lg:p-16 bg-slate-50 custom-scrollbar">
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
                      const allImgs = Array.from(editorRef.current?.querySelectorAll('img') || []);
                      const index = allImgs.indexOf(target as HTMLImageElement) + 1;
                      openRegenModal(index, (target as HTMLImageElement).alt || 'professional illustration');
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
      
      <div className="p-6 bg-white border-t border-slate-100 flex-none">
         <div className="max-w-4xl mx-auto">
            {isEditingAi && (
                <div className="mb-3 flex items-center gap-3 animate-pulse">
                    <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm font-bold text-green-600">{editProgress}</span>
                </div>
            )}
            <form onSubmit={handleAiEditSubmit} className="flex gap-3">
                <input 
                    type="text" 
                    value={editorInput} 
                    onChange={(e) => setEditorInput(e.target.value)}
                    placeholder="예: '3번째 문단을 더 부드럽게 고치고 전체 그림을 현대적인 스타일로 바꿔줘'"
                    className="flex-1 px-6 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:border-green-500 outline-none font-bold text-sm"
                    disabled={isEditingAi}
                />
                <button type="submit" disabled={isEditingAi} className="px-8 py-4 bg-slate-900 text-white font-bold rounded-xl hover:bg-black transition-all text-sm">
                    {isEditingAi ? 'AI 작동중' : 'AI 정밀보정'}
                </button>
            </form>
         </div>
      </div>
    </div>
  );
};

export default ResultPreview;
