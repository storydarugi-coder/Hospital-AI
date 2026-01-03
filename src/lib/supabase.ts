import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Supabase 클라이언트 생성
const supabaseUrl = localStorage.getItem('SUPABASE_URL') || '';
const supabaseAnonKey = localStorage.getItem('SUPABASE_ANON_KEY') || '';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Supabase 설정 여부 확인
export const isSupabaseConfigured = () => {
  const url = localStorage.getItem('SUPABASE_URL');
  const key = localStorage.getItem('SUPABASE_ANON_KEY');
  return !!(url && key);
};

// Supabase 클라이언트 재생성 (설정 변경 시)
export const reinitializeSupabase = () => {
  const url = localStorage.getItem('SUPABASE_URL') || '';
  const key = localStorage.getItem('SUPABASE_ANON_KEY') || '';
  return createClient<Database>(url, key);
};

// 사용자 IP 가져오기 (간단한 방법)
export const getUserIP = async (): Promise<string> => {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch {
    // IP 가져오기 실패 시 랜덤 해시 사용
    return 'unknown_' + Math.random().toString(36).substring(7);
  }
};

// IP 해시 생성 (프라이버시 보호)
export const hashIP = async (ip: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + '_hospitalai_salt_2025');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
};
