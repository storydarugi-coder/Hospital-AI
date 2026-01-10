/**
 * 이미지 최적화 유틸리티
 * - WebP 변환 지원
 * - Lazy loading 적용
 * - 이미지 압축
 * - 반응형 이미지 처리
 */

// 이미지 최적화 설정
export interface ImageOptimizationOptions {
  quality?: number;           // 압축 품질 (0-1, 기본 0.8)
  maxWidth?: number;          // 최대 너비
  maxHeight?: number;         // 최대 높이
  format?: 'webp' | 'jpeg' | 'png';  // 출력 포맷
  enableLazyLoad?: boolean;   // Lazy loading 적용 여부
}

// 기본 설정
const DEFAULT_OPTIONS: ImageOptimizationOptions = {
  quality: 0.8,
  maxWidth: 1200,
  maxHeight: 1200,
  format: 'webp',
  enableLazyLoad: true,
};

/**
 * 브라우저가 WebP를 지원하는지 확인
 */
export const supportsWebP = (): Promise<boolean> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.width > 0 && img.height > 0);
    img.onerror = () => resolve(false);
    img.src = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';
  });
};

/**
 * Base64 데이터 URL을 WebP로 변환
 */
export const convertToWebP = async (
  dataUrl: string,
  options: ImageOptimizationOptions = {}
): Promise<string> => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // WebP 지원 확인
  const webpSupported = await supportsWebP();
  const targetFormat = webpSupported && opts.format === 'webp' ? 'webp' : 'jpeg';
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }
        
        // 크기 계산 (비율 유지)
        let { width, height } = img;
        const maxW = opts.maxWidth || width;
        const maxH = opts.maxHeight || height;
        
        if (width > maxW || height > maxH) {
          const ratio = Math.min(maxW / width, maxH / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // 이미지 그리기
        ctx.drawImage(img, 0, 0, width, height);
        
        // WebP/JPEG로 변환
        const mimeType = targetFormat === 'webp' ? 'image/webp' : 'image/jpeg';
        const optimizedDataUrl = canvas.toDataURL(mimeType, opts.quality);
        
        resolve(optimizedDataUrl);
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    img.src = dataUrl;
  });
};

/**
 * HTML 내 img 태그에 lazy loading 속성 추가
 */
export const applyLazyLoading = (html: string): string => {
  // loading="lazy" 속성이 없는 img 태그에 추가
  return html.replace(
    /<img\s+(?!.*loading=["']lazy["'])([^>]*?)>/gi,
    (match, attributes) => {
      // 이미 loading 속성이 있으면 스킵
      if (/loading\s*=/i.test(attributes)) {
        return match;
      }
      return `<img loading="lazy" ${attributes}>`;
    }
  );
};

/**
 * HTML 내 img 태그에 decoding="async" 속성 추가
 */
export const applyAsyncDecoding = (html: string): string => {
  return html.replace(
    /<img\s+(?!.*decoding=["']async["'])([^>]*?)>/gi,
    (match, attributes) => {
      if (/decoding\s*=/i.test(attributes)) {
        return match;
      }
      return `<img decoding="async" ${attributes}>`;
    }
  );
};

/**
 * HTML 내 이미지 최적화 (lazy loading + async decoding)
 */
export const optimizeHtmlImages = (html: string): string => {
  let optimized = html;
  
  // Lazy loading 적용
  optimized = applyLazyLoading(optimized);
  
  // Async decoding 적용
  optimized = applyAsyncDecoding(optimized);
  
  return optimized;
};

/**
 * 이미지 파일 크기 추정 (Base64)
 */
export const estimateImageSize = (dataUrl: string): number => {
  // Base64 데이터 부분만 추출
  const base64Data = dataUrl.split(',')[1] || dataUrl;
  // Base64는 원본 대비 약 1.37배 크기
  return Math.round((base64Data.length * 3) / 4);
};

/**
 * 이미지 크기를 읽기 쉬운 형식으로 변환
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * 이미지 최적화 결과
 */
export interface OptimizationResult {
  original: string;
  optimized: string;
  originalSize: number;
  optimizedSize: number;
  savings: number;
  savingsPercent: number;
}

/**
 * 이미지 최적화 및 결과 반환
 */
export const optimizeImage = async (
  dataUrl: string,
  options: ImageOptimizationOptions = {}
): Promise<OptimizationResult> => {
  const originalSize = estimateImageSize(dataUrl);
  const optimized = await convertToWebP(dataUrl, options);
  const optimizedSize = estimateImageSize(optimized);
  const savings = originalSize - optimizedSize;
  
  return {
    original: dataUrl,
    optimized,
    originalSize,
    optimizedSize,
    savings,
    savingsPercent: Math.round((savings / originalSize) * 100),
  };
};

/**
 * 여러 이미지 일괄 최적화
 */
export const optimizeImages = async (
  dataUrls: string[],
  options: ImageOptimizationOptions = {},
  onProgress?: (index: number, total: number) => void
): Promise<OptimizationResult[]> => {
  const results: OptimizationResult[] = [];
  
  for (let i = 0; i < dataUrls.length; i++) {
    const result = await optimizeImage(dataUrls[i], options);
    results.push(result);
    onProgress?.(i + 1, dataUrls.length);
  }
  
  return results;
};

/**
 * HTML에서 이미지 URL 추출
 */
export const extractImagesFromHtml = (html: string): string[] => {
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  const images: string[] = [];
  let match;
  
  while ((match = imgRegex.exec(html)) !== null) {
    images.push(match[1]);
  }
  
  return images;
};

/**
 * HTML 내 이미지를 최적화된 버전으로 교체
 */
export const replaceImagesInHtml = (
  html: string,
  imageMap: Map<string, string>
): string => {
  let result = html;
  
  imageMap.forEach((optimized, original) => {
    result = result.replace(
      new RegExp(original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
      optimized
    );
  });
  
  return result;
};

/**
 * 전체 HTML 이미지 최적화 파이프라인
 */
export const optimizeAllImagesInHtml = async (
  html: string,
  options: ImageOptimizationOptions = {},
  onProgress?: (message: string) => void
): Promise<{ html: string; stats: { totalSaved: number; imageCount: number } }> => {
  onProgress?.('이미지 추출 중...');
  
  // 이미지 추출 (Base64 데이터 URL만)
  const images = extractImagesFromHtml(html).filter(
    src => src.startsWith('data:image/')
  );
  
  if (images.length === 0) {
    // 이미지가 없어도 lazy loading 적용
    return {
      html: optimizeHtmlImages(html),
      stats: { totalSaved: 0, imageCount: 0 },
    };
  }
  
  onProgress?.(`${images.length}개 이미지 최적화 중...`);
  
  // 이미지 최적화
  const imageMap = new Map<string, string>();
  let totalSaved = 0;
  
  for (let i = 0; i < images.length; i++) {
    try {
      onProgress?.(`이미지 ${i + 1}/${images.length} 최적화 중...`);
      const result = await optimizeImage(images[i], options);
      imageMap.set(images[i], result.optimized);
      totalSaved += result.savings;
    } catch (error) {
      console.warn(`이미지 ${i + 1} 최적화 실패:`, error);
      // 실패한 이미지는 원본 유지
    }
  }
  
  // HTML 업데이트
  let optimizedHtml = replaceImagesInHtml(html, imageMap);
  optimizedHtml = optimizeHtmlImages(optimizedHtml);
  
  onProgress?.(`완료! ${formatFileSize(totalSaved)} 절약`);
  
  return {
    html: optimizedHtml,
    stats: {
      totalSaved,
      imageCount: images.length,
    },
  };
};

/**
 * IntersectionObserver를 사용한 고급 Lazy Loading 초기화
 * (런타임에서 사용)
 */
export const initAdvancedLazyLoading = (rootElement?: HTMLElement): IntersectionObserver | null => {
  if (typeof IntersectionObserver === 'undefined') {
    console.warn('IntersectionObserver not supported');
    return null;
  }
  
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          const dataSrc = img.dataset.src;
          
          if (dataSrc) {
            img.src = dataSrc;
            img.removeAttribute('data-src');
            img.classList.add('loaded');
            observer.unobserve(img);
          }
        }
      });
    },
    {
      rootMargin: '100px',
      threshold: 0.1,
    }
  );
  
  // data-src 속성이 있는 이미지 관찰
  const root = rootElement || document;
  const lazyImages = root.querySelectorAll<HTMLImageElement>('img[data-src]');
  lazyImages.forEach((img) => observer.observe(img));
  
  return observer;
};

/**
 * 이미지 프리로드 (LCP 최적화)
 */
export const preloadImage = (src: string, priority: 'high' | 'low' = 'high'): void => {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = src;
  if (priority === 'high') {
    link.setAttribute('fetchpriority', 'high');
  }
  document.head.appendChild(link);
};

/**
 * 첫 번째 뷰포트 내 이미지를 프리로드 (LCP 최적화)
 */
export const preloadAboveFoldImages = (html: string, count: number = 1): void => {
  const images = extractImagesFromHtml(html);
  images.slice(0, count).forEach((src) => {
    preloadImage(src, 'high');
  });
};

export default {
  supportsWebP,
  convertToWebP,
  applyLazyLoading,
  applyAsyncDecoding,
  optimizeHtmlImages,
  estimateImageSize,
  formatFileSize,
  optimizeImage,
  optimizeImages,
  extractImagesFromHtml,
  replaceImagesInHtml,
  optimizeAllImagesInHtml,
  initAdvancedLazyLoading,
  preloadImage,
  preloadAboveFoldImages,
};
