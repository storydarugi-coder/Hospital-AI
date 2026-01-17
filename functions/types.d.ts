// Cloudflare Pages Functions 타입 정의
interface Env {
  API_KEYS: KVNamespace;
  CONTENT_KV: KVNamespace;
  APP_PASSWORD: string;
}

type PagesFunction<Env = any> = (context: {
  request: Request;
  env: Env;
  params: Record<string, string>;
  waitUntil: (promise: Promise<any>) => void;
  next: () => Promise<Response>;
  data: Record<string, any>;
}) => Response | Promise<Response>;
