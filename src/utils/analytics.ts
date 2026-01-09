/**
 * 실시간 모니터링 & Analytics
 */

export class Analytics {
  private static isProduction = process.env.NODE_ENV === 'production';

  static trackPageView(page: string) {
    if (!this.isProduction) return;
    
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('config', 'GA_MEASUREMENT_ID', {
        page_path: page,
      });
    }
  }

  static trackEvent(
    category: string,
    action: string,
    label?: string,
    value?: number
  ) {
    if (!this.isProduction) {
      console.log('[Analytics]', { category, action, label, value });
      return;
    }

    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', action, {
        event_category: category,
        event_label: label,
        value: value,
      });
    }
  }

  static trackPerformance(metric: string, value: number) {
    this.trackEvent('Performance', metric, undefined, value);
  }

  static trackError(error: Error, context?: any) {
    this.trackEvent('Error', error.message, JSON.stringify(context));
  }
}

export const track = Analytics.trackEvent.bind(Analytics);
