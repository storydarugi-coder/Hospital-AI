// Cloudflare Pages Function - API Keys Get
export async function onRequestGet(context: any) {
  const { env } = context;
  
  return new Response(
    JSON.stringify({
      success: true,
      apiKeys: {
        gemini: env.GEMINI_API_KEY || null,
        openai: env.OPENAI_API_KEY || null
      }
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
