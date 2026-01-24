// Cloudflare Pages Function - Health Check
export async function onRequestGet(context: any) {
  return new Response(
    JSON.stringify({
      status: 'ok',
      message: 'Hospital AI API Server is running',
      timestamp: new Date().toISOString(),
      apiKeys: {
        gemini: !!context.env.GEMINI_API_KEY,
        openai: !!context.env.OPENAI_API_KEY
      }
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    }
  );
}

// OPTIONS preflight
export async function onRequestOptions() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}
