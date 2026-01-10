/**
 * 성능 프로파일링 & Web Vitals 측정
 * - Core Web Vitals (LCP, FID, CLS, TTFB)
 * - 컴포넌트 렌더링 시간
 * - API 호출 시간
 * - 번들 로딩 시간
 */

import { log } from './logger';

export interface PerformanceMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  timestamp: number;
}

export class PerformanceMonitor {
  private static metrics: PerformanceMetric[] = [];

  /**
   * Web Vitals 측정 (web-vitals 라이브러리 사용)
   */
  static initWebVitals() {
    if (typeof window === 'undefined') return;

    // LCP (Largest Contentful Paint)
    this.observeLCP();

    // FID (First Input Delay)
    this.observeFID();

    // CLS (Cumulative Layout Shift)
    this.observeCLS();

    // TTFB (Time to First Byte)
    this.observeTTFB();

    // FCP (First Contentful Paint)
    this.observeFCP();
  }

  /**
   * LCP 측정 (목표: 2.5초 이하)
   */
  private static observeLCP() {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1] as any;
      
      const value = lastEntry.renderTime || lastEntry.loadTime;
      const rating = value <= 2500 ? 'good' : value <= 4000 ? 'needs-improvement' : 'poor';
      
      this.recordMetric('LCP', value, rating);
      log.perf('LCP', value);
    });

    observer.observe({ entryTypes: ['largest-contentful-paint'] });
  }

  /**
   * FID 측정 (목표: 100ms 이하)
   */
  private static observeFID() {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry: any) => {
        const value = entry.processingStart - entry.startTime;
        const rating = value <= 100 ? 'good' : value <= 300 ? 'needs-improvement' : 'poor';
        
        this.recordMetric('FID', value, rating);
        log.perf('FID', value);
      });
    });

    observer.observe({ entryTypes: ['first-input'] });
  }

  /**
   * CLS 측정 (목표: 0.1 이하)
   */
  private static observeCLS() {
    let clsValue = 0;
    let clsEntries: any[] = [];

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      
      entries.forEach((entry: any) => {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
          clsEntries.push(entry);
        }
      });

      const rating = clsValue <= 0.1 ? 'good' : clsValue <= 0.25 ? 'needs-improvement' : 'poor';
      this.recordMetric('CLS', clsValue, rating);
    });

    observer.observe({ entryTypes: ['layout-shift'] });

    // 페이지 언로드 시 최종 CLS 기록
    window.addEventListener('beforeunload', () => {
      const rating = clsValue <= 0.1 ? 'good' : clsValue <= 0.25 ? 'needs-improvement' : 'poor';
      this.recordMetric('CLS', clsValue, rating);
      log.perf('CLS', clsValue);
    });
  }

  /**
   * TTFB 측정 (목표: 600ms 이하)
   */
  private static observeTTFB() {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry: any) => {
        const value = entry.responseStart - entry.requestStart;
        const rating = value <= 600 ? 'good' : value <= 1500 ? 'needs-improvement' : 'poor';
        
        this.recordMetric('TTFB', value, rating);
        log.perf('TTFB', value);
      });
    });

    observer.observe({ entryTypes: ['navigation'] });
  }

  /**
   * FCP 측정 (목표: 1.8초 이하)
   */
  private static observeFCP() {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry: any) => {
        const value = entry.startTime;
        const rating = value <= 1800 ? 'good' : value <= 3000 ? 'needs-improvement' : 'poor';
        
        this.recordMetric('FCP', value, rating);
        log.perf('FCP', value);
      });
    });

    observer.observe({ entryTypes: ['paint'] });
  }

  /**
   * 컴포넌트 렌더링 시간 측정
   */
  static measureRender(componentName: string): () => void {
    const start = performance.now();
    
    return () => {
      const duration = performance.now() - start;
      this.recordMetric(`Render_${componentName}`, duration, this.getRating(duration, 16, 50));
      log.perf(`Render_${componentName}`, duration);
      
      // 16ms (60fps) 이상이면 경고
      if (duration > 16) {
        log.warn(`Slow render: ${componentName}`, { duration });
      }
    };
  }

  /**
   * API 호출 시간 측정
   */
  static measureAPI(endpoint: string): { end: (success: boolean) => void } {
    const start = performance.now();
    
    return {
      end: (success: boolean) => {
        const duration = performance.now() - start;
        this.recordMetric(`API_${endpoint}`, duration, this.getRating(duration, 500, 2000));
        log.perf(`API_${endpoint}`, duration);
        
        if (success) {
          log.info(`API success: ${endpoint}`, { duration });
        } else {
          log.error(`API failed: ${endpoint}`, { duration });
        }
      }
    };
  }

  /**
   * 번들 로딩 시간 측정
   */
  static measureBundleLoad() {
    if (typeof window === 'undefined') return;

    window.addEventListener('load', () => {
      const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      
      if (perfData) {
        const metrics = {
          dns: perfData.domainLookupEnd - perfData.domainLookupStart,
          tcp: perfData.connectEnd - perfData.connectStart,
          request: perfData.responseStart - perfData.requestStart,
          response: perfData.responseEnd - perfData.responseStart,
          dom: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
          load: perfData.loadEventEnd - perfData.loadEventStart,
          total: perfData.loadEventEnd - perfData.fetchStart,
        };

        Object.entries(metrics).forEach(([name, value]) => {
          log.perf(`Bundle_${name}`, value);
        });

        log.info('Bundle load complete', metrics);
      }
    });
  }

  /**
   * 메트릭 기록
   */
  private static recordMetric(name: string, value: number, rating: 'good' | 'needs-improvement' | 'poor') {
    const metric: PerformanceMetric = {
      name,
      value,
      rating,
      timestamp: Date.now(),
    };

    this.metrics.push(metric);

    // 최근 100개만 유지
    if (this.metrics.length > 100) {
      this.metrics.shift();
    }
  }

  /**
   * Rating 계산
   */
  private static getRating(value: number, goodThreshold: number, poorThreshold: number): 'good' | 'needs-improvement' | 'poor' {
    if (value <= goodThreshold) return 'good';
    if (value <= poorThreshold) return 'needs-improvement';
    return 'poor';
  }

  /**
   * 모든 메트릭 가져오기
   */
  static getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * 성능 리포트 생성
   */
  static generateReport(): {
    summary: { [key: string]: { avg: number; min: number; max: number; count: number } };
    ratings: { good: number; needsImprovement: number; poor: number };
  } {
    const summary: any = {};
    const ratings = { good: 0, needsImprovement: 0, poor: 0 };

    this.metrics.forEach((metric) => {
      if (!summary[metric.name]) {
        summary[metric.name] = { total: 0, min: Infinity, max: 0, count: 0 };
      }

      summary[metric.name].total += metric.value;
      summary[metric.name].min = Math.min(summary[metric.name].min, metric.value);
      summary[metric.name].max = Math.max(summary[metric.name].max, metric.value);
      summary[metric.name].count++;

      if (metric.rating === 'good') ratings.good++;
      else if (metric.rating === 'needs-improvement') ratings.needsImprovement++;
      else ratings.poor++;
    });

    Object.keys(summary).forEach((key) => {
      summary[key].avg = summary[key].total / summary[key].count;
      delete summary[key].total;
    });

    return { summary, ratings };
  }

  /**
   * 메트릭 초기화
   */
  static clear() {
    this.metrics = [];
  }
}

// 페이지 로드 시 자동 초기화
if (typeof window !== 'undefined') {
  PerformanceMonitor.initWebVitals();
  PerformanceMonitor.measureBundleLoad();
}

// 편의 함수
export const measureRender = PerformanceMonitor.measureRender.bind(PerformanceMonitor);
export const measureAPI = PerformanceMonitor.measureAPI.bind(PerformanceMonitor);
