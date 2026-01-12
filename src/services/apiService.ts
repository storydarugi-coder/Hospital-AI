// API 서버에 콘텐츠 저장하는 서비스

const API_BASE_URL = 'https://api.genspark.ai'; // 실제 API 서버 URL로 변경 필요

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
