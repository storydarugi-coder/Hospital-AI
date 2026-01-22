/**
 * 환경 변수 검증 유틸리티
 * 안전한 환경 변수 접근 및 검증 제공
 */

interface EnvConfig {
  VITE_GEMINI_API_KEY?: string;
  VITE_OPENAI_API_KEY?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}

/**
 * 환경 변수 안전하게 가져오기
 */
export function getEnvVar(key: keyof EnvConfig, fallback?: string): string | undefined {
  try {
    // Vite 환경 변수
    const viteValue = import.meta.env[key];
    if (viteValue) return viteValue;

    // LocalStorage 폴백 (브라우저 환경)
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const storageKey = key.replace('VITE_', '');
      const stored = localStorage.getItem(storageKey);
      if (stored) return stored;
    }

    return fallback;
  } catch (error) {
    console.warn(`환경 변수 ${key} 읽기 실패:`, error);
    return fallback;
  }
}

/**
 * 필수 환경 변수 검증
 */
export function validateRequiredEnv(keys: (keyof EnvConfig)[]): boolean {
  const missing: string[] = [];

  for (const key of keys) {
    const value = getEnvVar(key);
    if (!value || value.trim() === '') {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    console.warn('누락된 환경 변수:', missing.join(', '));
    return false;
  }

  return true;
}

/**
 * API 키 유효성 검사 (기본적인 형식 검증)
 */
export function validateApiKey(key: string, type: 'gemini' | 'openai'): boolean {
  if (!key || typeof key !== 'string') return false;

  const trimmed = key.trim();
  
  switch (type) {
    case 'gemini':
      // Gemini API 키는 보통 AIza로 시작
      return trimmed.startsWith('AIza') && trimmed.length > 30;
    
    case 'openai':
      // OpenAI API 키는 sk-로 시작하거나 sk-proj-로 시작
      return (trimmed.startsWith('sk-') || trimmed.startsWith('sk-proj-')) && trimmed.length > 40;
    
    default:
      return trimmed.length > 20;
  }
}

/**
 * 환경 변수 상태 확인
 */
export function checkEnvStatus(): {
  geminiReady: boolean;
  openaiReady: boolean;
  supabaseReady: boolean;
} {
  const geminiKey = getEnvVar('VITE_GEMINI_API_KEY');
  const openaiKey = getEnvVar('VITE_OPENAI_API_KEY');
  const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
  const supabaseKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

  return {
    geminiReady: !!geminiKey && validateApiKey(geminiKey, 'gemini'),
    openaiReady: !!openaiKey && validateApiKey(openaiKey, 'openai'),
    supabaseReady: !!supabaseUrl && !!supabaseKey
  };
}

/**
 * 에러 메시지 생성
 */
export function getEnvErrorMessage(type: 'gemini' | 'openai' | 'supabase'): string {
  const messages = {
    gemini: 'Gemini API 키가 설정되지 않았거나 올바르지 않습니다. 설정에서 API 키를 확인해주세요.',
    openai: 'OpenAI API 키가 설정되지 않았거나 올바르지 않습니다. 설정에서 API 키를 확인해주세요.',
    supabase: 'Supabase 설정이 올바르지 않습니다. 관리자에게 문의해주세요.'
  };

  return messages[type];
}
