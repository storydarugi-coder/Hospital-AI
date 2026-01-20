/**
 * Google Custom Search JSON API
 * https://developers.google.com/custom-search/v1/overview
 */

interface Env {
  GOOGLE_API_KEY: string;
  GOOGLE_SEARCH_ENGINE_ID: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { q, num = 10, start = 1 } = await context.request.json() as { 
      q: string; 
      num?: number;
      start?: number;
    };

    if (!q) {
      return new Response(JSON.stringify({ error: 'Query is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const API_KEY = context.env.GOOGLE_API_KEY;
    const CX = context.env.GOOGLE_SEARCH_ENGINE_ID;

    if (!API_KEY || !CX) {
      return new Response(
        JSON.stringify({ error: 'Google API credentials not configured' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Google Custom Search API 호출
    const searchUrl = new URL('https://www.googleapis.com/customsearch/v1');
    searchUrl.searchParams.append('key', API_KEY);
    searchUrl.searchParams.append('cx', CX);
    searchUrl.searchParams.append('q', q);
    searchUrl.searchParams.append('num', Math.min(num, 10).toString());
    searchUrl.searchParams.append('start', start.toString()); // 페이지네이션 지원

    const response = await fetch(searchUrl.toString());

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Google Search API Error:', errorData);
      return new Response(
        JSON.stringify({
          error: 'Google Search API failed',
          details: errorData,
        }),
        {
          status: response.status,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Google Search Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error.message,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
