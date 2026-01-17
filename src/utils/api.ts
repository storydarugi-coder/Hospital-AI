/**
 * API 유틸리티 함수들
 * - 재시도 로직
 * - 에러 핸들링
 * - 타임아웃 관리
 */

export interface FetchWithRetryOptions extends RequestInit {
  retries?: number;
  retryDelay?: number;
  timeout?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * 재시도 로직이 포함된 fetch 함수
 */
export const fetchWithRetry = async (
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<Response> => {
  const {
    retries = 3,
    retryDelay = 1000,
    timeout = 30000,
    onRetry,
    ...fetchOptions
  } = options;

  let lastError: Error;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // 타임아웃 적용
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // 성공 응답
      if (response.ok) {
        return response;
      }

      // HTTP 에러 (4xx, 5xx)
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(
        `HTTP ${response.status}: ${response.statusText}. ${errorText}`
      );
    } catch (error) {
      lastError = error as Error;

      // AbortError (타임아웃)
      if (lastError.name === 'AbortError') {
        lastError = new Error(`Request timeout after ${timeout}ms`);
      }

      // 마지막 시도가 아니면 재시도
      if (attempt < retries - 1) {
        console.warn(
          `🔄 Retry attempt ${attempt + 1}/${retries - 1} after error:`,
          lastError.message
        );

        // 재시도 콜백 호출
        if (onRetry) {
          onRetry(attempt + 1, lastError);
        }

        // 지수 백오프로 대기
        const delay = retryDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // 마지막 시도였으면 에러 throw
      console.error(`❌ All ${retries} attempts failed:`, lastError.message);
      throw lastError;
    }
  }

  // 여기에 도달하지 않지만 TypeScript를 위해
  throw lastError!;
};

/**
 * JSON API 호출 헬퍼
 */
export const fetchJSON = async <T = any>(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<T> => {
  const response = await fetchWithRetry(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const text = await response.text();
  
  try {
    return JSON.parse(text) as T;
  } catch {
    console.error('❌ JSON 파싱 실패:', text.substring(0, 200));
    throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`);
  }
};

/**
 * POST 요청 헬퍼
 */
export const postJSON = async <T = any>(
  url: string,
  data: any,
  options: FetchWithRetryOptions = {}
): Promise<T> => {
  return fetchJSON<T>(url, {
    ...options,
    method: 'POST',
    body: JSON.stringify(data),
  });
};

/**
 * 에러 메시지 추출 (다양한 에러 형식 지원)
 */
export const extractErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object') {
    // API 에러 응답 형식
    const apiError = error as any;
    
    if (apiError.message) {
      return apiError.message;
    }
    
    if (apiError.error?.message) {
      return apiError.error.message;
    }
    
    if (apiError.errors && Array.isArray(apiError.errors)) {
      return apiError.errors.map((e: any) => e.message || e).join(', ');
    }
  }

  return '알 수 없는 오류가 발생했습니다';
};

/**
 * Rate Limiting 헬퍼 (429 에러 대응)
 */
export class RateLimiter {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private requestsPerSecond: number;

  constructor(requestsPerSecond = 10) {
    this.requestsPerSecond = requestsPerSecond;
  }

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      if (!this.processing) {
        this.process();
      }
    });
  }

  private async process() {
    this.processing = true;

    while (this.queue.length > 0) {
      const fn = this.queue.shift();
      if (fn) {
        await fn();
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 / this.requestsPerSecond)
        );
      }
    }

    this.processing = false;
  }
}

// 기본 Rate Limiter 인스턴스
export const defaultRateLimiter = new RateLimiter(10);
