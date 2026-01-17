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
  
  // 회원가입 성공 시 프로필과 구독 정보 생성
  // ⚠️ data.user만 있으면 생성 (이메일 확인 여부와 관계없이)
  if (data.user) {
    try {
      // profiles 테이블에 사용자 정보 생성
      await supabase.from('profiles').upsert({
        id: data.user.id,
        email: email,
        full_name: name,
        avatar_url: null,
        created_at: new Date().toISOString()
      } as any, { onConflict: 'id' });
      
      // subscriptions 테이블에 무료 플랜 생성
      await supabase.from('subscriptions').upsert({
        user_id: data.user.id,
        plan_type: 'free',
        credits_total: 3,
        credits_used: 0,
        expires_at: null
      } as any, { onConflict: 'user_id' });
      
      console.log('✅ 프로필 및 구독 정보 생성 완료:', data.user.email);
    } catch (profileError) {
      console.error('프로필 생성 실패 (무시):', profileError);
      // 프로필 생성 실패해도 회원가입은 성공으로 처리
    }
  }
  
  return { data, error };
};

export const signInWithEmail = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  
  // 🔧 로그인 성공 시 profiles 없으면 자동 생성 (기존 유저 호환)
  if (data.user && !error) {
    try {
      // profiles 존재 여부 확인
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', data.user.id)
        .single();
      
      // profiles 없으면 생성
      if (!profile) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          email: data.user.email,
          full_name: data.user.user_metadata?.name || data.user.email?.split('@')[0] || '사용자',
          avatar_url: data.user.user_metadata?.avatar_url || null,
          created_at: new Date().toISOString()
        } as any, { onConflict: 'id' });
        
        // subscriptions도 없으면 생성
        await supabase.from('subscriptions').upsert({
          user_id: data.user.id,
          plan_type: 'free',
          credits_total: 3,
          credits_used: 0,
          expires_at: null
        } as any, { onConflict: 'user_id' });
        
        console.log('✅ 기존 유저 프로필 자동 생성:', data.user.email);
      }
    } catch (profileError) {
      console.error('프로필 확인/생성 실패 (무시):', profileError);
    }
  }
  
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

// 회원 탈퇴 (계정 삭제)
export const deleteAccount = async (userId: string) => {
  console.log('[Delete Account] Starting account deletion for:', userId);
  
  const errors: string[] = [];
  
  try {
    // 1. 사용 로그 삭제
    const { error: logsError } = await supabase
      .from('usage_logs')
      .delete()
      .eq('user_id', userId);
    if (logsError) {
      console.warn('[Delete Account] usage_logs 삭제 실패:', logsError.message);
      errors.push(`usage_logs: ${logsError.message}`);
    } else {
      console.log('[Delete Account] usage_logs 삭제 성공');
    }
    
    // 2. 구독 정보 삭제
    const { error: subError } = await supabase
      .from('subscriptions')
      .delete()
      .eq('user_id', userId);
    if (subError) {
      console.warn('[Delete Account] subscriptions 삭제 실패:', subError.message);
      errors.push(`subscriptions: ${subError.message}`);
    } else {
      console.log('[Delete Account] subscriptions 삭제 성공');
    }
    
    // 3. 프로필 삭제 (가장 중요!)
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);
    if (profileError) {
      console.error('[Delete Account] profiles 삭제 실패:', profileError.message);
      errors.push(`profiles: ${profileError.message}`);
      
      // RLS 정책 문제일 가능성 안내
      if (profileError.message?.includes('policy') || profileError.code === '42501') {
        return { 
          success: false, 
          error: 'DELETE 권한이 없습니다. Supabase RLS 정책을 확인해주세요.\n\n' +
                 'SQL Editor에서 실행:\n' +
                 'CREATE POLICY "Users can delete own profile" ON profiles\n' +
                 'FOR DELETE USING (auth.uid() = id);'
        };
      }
    } else {
      console.log('[Delete Account] profiles 삭제 성공');
    }
    
    // 4. 로컬 스토리지 정리
    localStorage.removeItem(`user_credits_${userId}`);
    localStorage.removeItem('used_coupons');
    console.log('[Delete Account] localStorage 정리 완료');
    
    // 5. 로그아웃 (세션 종료)
    await supabase.auth.signOut();
    console.log('[Delete Account] 로그아웃 완료');
    
    // 에러가 있었어도 프로필은 삭제됐으면 성공으로 처리
    if (errors.length > 0 && errors.some(e => e.startsWith('profiles:'))) {
      return { success: false, error: errors.join('\n') };
    }
    
    return { success: true, error: null };
  } catch (err: any) {
    console.error('[Delete Account] 예외 발생:', err);
    return { success: false, error: err.message || '탈퇴 처리 중 오류가 발생했습니다.' };
  }
};
