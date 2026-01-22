/**
 * 에러 로깅 및 처리 유틸리티
 */

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ErrorLog {
  message: string;
  severity: ErrorSeverity;
  timestamp: string;
  context?: Record<string, unknown>;
  stack?: string;
}

/**
 * 에러를 콘솔에 로깅 (프로덕션에서는 외부 서비스로 전송 가능)
 */
export function logError(
  error: Error | string,
  severity: ErrorSeverity = ErrorSeverity.MEDIUM,
  context?: Record<string, unknown>
): void {
  const errorLog: ErrorLog = {
    message: typeof error === 'string' ? error : error.message,
    severity,
    timestamp: new Date().toISOString(),
    context,
    stack: typeof error !== 'string' ? error.stack : undefined
  };

  // 개발 환경에서는 자세한 로그
  if (process.env.NODE_ENV === 'development') {
    console.group(`🚨 Error [${severity.toUpperCase()}]`);
    console.error('Message:', errorLog.message);
    if (errorLog.stack) console.error('Stack:', errorLog.stack);
    if (errorLog.context) console.error('Context:', errorLog.context);
    console.groupEnd();
  } else {
    // 프로덕션에서는 심플한 로그
    console.error(`[${severity}]`, errorLog.message);
  }

  // TODO: 프로덕션에서는 Sentry, LogRocket 등으로 전송
  // sendToLoggingService(errorLog);
}

/**
 * API 에러를 사용자 친화적인 메시지로 변환
 */
export function getFriendlyErrorMessage(error: unknown): string {
  if (!error) return '알 수 없는 오류가 발생했습니다.';

  // Error 객체
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // 네트워크 에러
    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return '⚠️ 네트워크 연결이 불안정합니다. 인터넷 연결을 확인하고 다시 시도해주세요.';
    }

    // API 키 관련
    if (message.includes('api key') || message.includes('api 키') || message.includes('unauthorized')) {
      return '⚠️ API 키가 올바르지 않습니다. 설정에서 API 키를 확인해주세요.';
    }

    // 할당량 초과
    if (message.includes('quota') || message.includes('limit') || message.includes('rate')) {
      return '⚠️ API 사용량 한도에 도달했습니다. 잠시 후 다시 시도해주세요.';
    }

    // 타임아웃
    if (message.includes('timeout') || message.includes('time out')) {
      return '⚠️ 요청 시간이 초과되었습니다. 다시 시도해주세요.';
    }

    return `❌ 오류: ${error.message}`;
  }

  // 문자열 에러
  if (typeof error === 'string') {
    return error;
  }

  // 기타
  return '알 수 없는 오류가 발생했습니다.';
}

/**
 * 에러 발생 시 재시도 로직
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000,
  onRetry?: (attempt: number, error: Error) => void
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxRetries) {
        if (onRetry) {
          onRetry(attempt, lastError);
        }
        
        logError(
          `재시도 ${attempt}/${maxRetries}: ${lastError.message}`,
          ErrorSeverity.LOW
        );

        // 지수 백오프
        const delay = delayMs * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('재시도 실패');
}

/**
 * 안전한 JSON 파싱
 */
export function safeJSONParse<T = unknown>(json: string, fallback?: T): T | null {
  try {
    return JSON.parse(json);
  } catch (error) {
    logError(
      error instanceof Error ? error : new Error('JSON 파싱 실패'),
      ErrorSeverity.LOW,
      { json: json.substring(0, 100) }
    );
    return fallback !== undefined ? fallback : null;
  }
}

/**
 * 안전한 localStorage 작업
 */
export const safeLocalStorage = {
  getItem(key: string, fallback?: string): string | null {
    try {
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        return fallback || null;
      }
      return localStorage.getItem(key) || fallback || null;
    } catch (error) {
      logError(
        error instanceof Error ? error : new Error('localStorage 읽기 실패'),
        ErrorSeverity.LOW,
        { key }
      );
      return fallback || null;
    }
  },

  setItem(key: string, value: string): boolean {
    try {
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        return false;
      }
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      logError(
        error instanceof Error ? error : new Error('localStorage 쓰기 실패'),
        ErrorSeverity.LOW,
        { key }
      );
      return false;
    }
  },

  removeItem(key: string): boolean {
    try {
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        return false;
      }
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      logError(
        error instanceof Error ? error : new Error('localStorage 삭제 실패'),
        ErrorSeverity.LOW,
        { key }
      );
      return false;
    }
  }
};
