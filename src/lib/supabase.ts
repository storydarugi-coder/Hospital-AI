import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Supabase 설정 - 하드코딩 (Cloudflare Pages 배포 시 환경변수로 교체 권장)
const SUPABASE_URL = 'https://giiatpxkhponcbduyzci.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpaWF0cHhraHBvbmNiZHV5emNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0MzA0MzksImV4cCI6MjA4MzAwNjQzOX0.YsjqdemCH18UcK_fIa6yTulQkw00AemZeROhTaFIpBg';

// Supabase 클라이언트 생성
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);

// Supabase 설정 여부 확인
export const isSupabaseConfigured = () => {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
};

// 사용자 IP 가져오기
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

// 인증 헬퍼 함수들
export const signUpWithEmail = async (email: string, password: string, name: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name }
    }
  });
  return { data, error };
};

export const signInWithEmail = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  return { data, error };
};

export const signInWithOAuth = async (provider: 'google' | 'kakao' | 'naver') => {
  if (provider === 'google') {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/#app'
      }
    });
    return { data, error };
  }
  
  if (provider === 'kakao') {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo: window.location.origin + '/#app'
      }
    });
    return { data, error };
  }
  
  // Naver는 추후 구현
  return { data: null, error: new Error(`${provider} OAuth는 추가 설정이 필요합니다.`) };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const resetPassword = async (email: string) => {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/#auth'
  });
  return { data, error };
};

export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  return { user, error };
};

export const onAuthStateChange = (callback: (event: string, session: any) => void) => {
  return supabase.auth.onAuthStateChange(callback);
};
