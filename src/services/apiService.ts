// API 서버에 콘텐츠 저장하는 서비스

// 개발 환경에서는 로컬 서버, 프로덕션에서는 같은 도메인의 /api 사용
// 프로덕션: /api (Cloudflare Pages Functions)
// 개발: VITE_API_URL 환경 변수로 오버라이드 가능
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export interface SaveContentRequest {
  title: string;
  content: string;
  category: string;
  postType: 'blog' | 'card_news' | 'press_release';
  metadata?: {
    keywords?: string;
    imageUrls?: string[];
    seoScore?: number;
    aiSmellScore?: number;
  };
}

export interface SaveContentResponse {
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * 생성된 콘텐츠를 API 서버에 저장
 */
export const saveContentToServer = async (data: SaveContentRequest): Promise<SaveContentResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/content/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`서버 응답 오류: ${response.status}`);
    }

    const result = await response.json();
    return {
      success: true,
      id: result.id,
    };
  } catch (error: any) {
    console.error('콘텐츠 저장 실패:', error);
    return {
      success: false,
      error: error.message || '저장 중 오류가 발생했습니다.',
    };
  }
};

/**
 * 저장된 콘텐츠 목록 가져오기
 */
export const getContentList = async (): Promise<any[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/content/list`);
    
    if (!response.ok) {
      throw new Error(`서버 응답 오류: ${response.status}`);
    }

    const result = await response.json();
    return result.data || [];
  } catch (error) {
    console.error('콘텐츠 목록 가져오기 실패:', error);
    return [];
  }
};

/**
 * API 키를 localStorage에 저장 (서버 저장 제거)
 */
export const saveApiKeys = async (geminiKey?: string, openaiKey?: string): Promise<SaveContentResponse> => {
  try {
    if (geminiKey) {
      localStorage.setItem('GEMINI_API_KEY', geminiKey);
    }
    if (openaiKey) {
      localStorage.setItem('OPENAI_API_KEY', openaiKey);
    }
    return { success: true };
  } catch (error: any) {
    console.error('API 키 저장 실패:', error);
    return {
      success: false,
      error: error.message || 'API 키 저장 중 오류가 발생했습니다.',
    };
  }
};

/**
 * localStorage에서 API 키 가져오기 (서버 호출 제거)
 */
export const getApiKeys = async (): Promise<{ gemini: string | null; openai: string | null }> => {
  try {
    const gemini = localStorage.getItem('GEMINI_API_KEY');
    const openai = localStorage.getItem('OPENAI_API_KEY');
    return { gemini, openai };
  } catch (error) {
    console.error('API 키 가져오기 실패:', error);
    return { gemini: null, openai: null };
  }
};

/**
 * localStorage에서 API 키 삭제 (서버 호출 제거)
 */
export const deleteApiKeys = async (type?: 'gemini' | 'openai'): Promise<SaveContentResponse> => {
  try {
    if (type === 'gemini') {
      localStorage.removeItem('GEMINI_API_KEY');
    } else if (type === 'openai') {
      localStorage.removeItem('OPENAI_API_KEY');
    } else {
      // type이 없으면 둘 다 삭제
      localStorage.removeItem('GEMINI_API_KEY');
      localStorage.removeItem('OPENAI_API_KEY');
    }
    return { success: true };
  } catch (error: any) {
    console.error('API 키 삭제 실패:', error);
    return {
      success: false,
      error: error.message || 'API 키 삭제 중 오류가 발생했습니다.',
    };
  }
};
