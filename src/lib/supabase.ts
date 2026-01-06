import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Supabase 설정 - 하드코딩 (Cloudflare Pages 배포 시 환경변수로 교체 권장)
const SUPABASE_URL = 'https://giiatpxkhponcbduyzci.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpaWF0cHhraHBvbmNiZHV5emNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0MzA0MzksImV4cCI6MjA4MzAwNjQzOX0.YsjqdemCH18UcK_fIa6yTulQkw00AemZeROhTaFIpBg';

// Supabase 클라이언트 생성
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);

// 클라이언트 재초기화 (호환성을 위해 기존 클라이언트 반환)
export const reinitializeSupabase = () => supabase;

// Supabase 설정 여부 확인
export const isSupabaseConfigured = () => {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
};

// 사용자 IP 가져오기
export const getUserIP = async (): Promise<string> => {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json() as { ip: string };
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
      data: { name },
      // 이메일 확인 없이 바로 로그인 (Supabase 대시보드에서도 설정 필요)
      emailRedirectTo: window.location.origin + '/#app'
    }
  });
  
  // 회원가입 성공 & 세션이 있으면 (이메일 확인이 비활성화된 경우)
  // 프로필과 구독 정보 생성
  if (data.user && data.session) {
    // profiles 테이블에 사용자 정보 생성
    await supabase.from('profiles').upsert({
      id: data.user.id,
      email: email,
      full_name: name,
      avatar_url: null
    }, { onConflict: 'id' });
    
    // subscriptions 테이블에 무료 플랜 생성
    await supabase.from('subscriptions').upsert({
      user_id: data.user.id,
      plan_type: 'free',
      credits_total: 3,
      credits_used: 0,
      expires_at: null
    }, { onConflict: 'user_id' });
  }
  
  return { data, error };
};

export const signInWithEmail = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  return { data, error };
};

export const signInWithOAuth = async (provider: 'google') => {
  // OAuth 리다이렉트 URL - Supabase가 콜백 시 #access_token을 추가함
  // 따라서 baseURL만 지정하고, 인증 후 App.tsx에서 hash를 파싱
  const redirectUrl = window.location.origin;
  console.log('[OAuth] Starting Google login, redirectTo:', redirectUrl);
  
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
      skipBrowserRedirect: false
    }
  });
  
  if (error) {
    console.error('[OAuth] Error:', error);
  }
  
  return { data, error };
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
