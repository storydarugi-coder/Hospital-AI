import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, reinitializeSupabase, isSupabaseConfigured, getUserIP, hashIP } from '../lib/supabase';
import { PLANS, PlanType } from '../lib/database.types';

interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

interface Subscription {
  plan_type: PlanType;
  credits_total: number;
  credits_used: number;
  credits_remaining: number;
  expires_at: string | null;
  is_expired: boolean;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  subscription: Subscription | null;
  loading: boolean;
  configured: boolean;
  ipHash: string | null;
  freeUsesRemaining: number;
  
  // Auth methods
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithProvider: (provider: 'google' | 'kakao' | 'naver') => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  
  // Usage methods
  canGenerate: () => boolean;
  useCredit: () => Promise<boolean>;
  refreshSubscription: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [ipHash, setIpHash] = useState<string | null>(null);
  const [freeUsesRemaining, setFreeUsesRemaining] = useState(3);
  const [client, setClient] = useState(supabase);

  // IP 해시 초기화
  useEffect(() => {
    const initIP = async () => {
      const ip = await getUserIP();
      const hash = await hashIP(ip);
      setIpHash(hash);
    };
    initIP();
  }, []);

  // Supabase 설정 확인 및 인증 상태 로드
  useEffect(() => {
    const init = async () => {
      const isConfigured = isSupabaseConfigured();
      setConfigured(isConfigured);

      if (!isConfigured) {
        setLoading(false);
        return;
      }

      const newClient = reinitializeSupabase();
      setClient(newClient);

      // 현재 세션 확인
      const { data: { session } } = await newClient.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        
        // 사용자 정보 추출
        const userEmail = session.user.email;
        const userName = session.user.user_metadata?.full_name || 
                        session.user.user_metadata?.name ||
                        session.user.email?.split('@')[0] || null;
        
        await loadProfile(session.user.id, newClient, userEmail, userName);
        await loadSubscription(session.user.id, newClient);
      }

      // IP 기반 무료 사용량 확인
      if (ipHash) {
        await loadFreeUses(ipHash, newClient);
      }

      setLoading(false);

      // Auth 상태 변경 리스너
      const { data: { subscription: authSub } } = newClient.auth.onAuthStateChange(async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        
        if (session?.user) {
          setUser(session.user);
          
          // OAuth 로그인 시 사용자 정보 추출
          const userEmail = session.user.email;
          const userName = session.user.user_metadata?.full_name || 
                          session.user.user_metadata?.name ||
                          session.user.email?.split('@')[0] || null;
          
          await loadProfile(session.user.id, newClient, userEmail, userName);
          await loadSubscription(session.user.id, newClient);
        } else {
          setUser(null);
          setProfile(null);
          setSubscription(null);
        }
      });

      return () => {
        authSub.unsubscribe();
      };
    };

    init();
  }, [ipHash]);

  const loadProfile = async (userId: string, supabaseClient: typeof supabase, userEmail?: string, userName?: string) => {
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (data) {
      setProfile(data as UserProfile);
    } else if (error?.code === 'PGRST116') {
      // 프로필이 없으면 생성 (OAuth 로그인 시)
      const newProfile = {
        id: userId,
        email: userEmail || null,
        full_name: userName || null,
        avatar_url: null
      };
      
      const { error: insertError } = await supabaseClient
        .from('profiles')
        .insert(newProfile);
      
      if (!insertError) {
        setProfile(newProfile);
      }
    }
  };

  const loadSubscription = async (userId: string, supabaseClient: typeof supabase) => {
    const { data, error } = await supabaseClient
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (data) {
      const isExpired = data.expires_at ? new Date(data.expires_at) < new Date() : false;
      const creditsRemaining = data.credits_total === -1 
        ? Infinity 
        : data.credits_total - data.credits_used;

      setSubscription({
        plan_type: data.plan_type as PlanType,
        credits_total: data.credits_total,
        credits_used: data.credits_used,
        credits_remaining: creditsRemaining,
        expires_at: data.expires_at,
        is_expired: isExpired
      });
    } else if (error?.code === 'PGRST116') {
      // 구독이 없으면 무료 플랜 생성 (OAuth 로그인 시)
      const newSubscription = {
        user_id: userId,
        plan_type: 'free' as PlanType,
        credits_total: 3,
        credits_used: 0,
        expires_at: null
      };
      
      const { error: insertError } = await supabaseClient
        .from('subscriptions')
        .insert(newSubscription);
      
      if (!insertError) {
        setSubscription({
          plan_type: 'free',
          credits_total: 3,
          credits_used: 0,
          credits_remaining: 3,
          expires_at: null,
          is_expired: false
        });
      }
    }
  };

  const loadFreeUses = async (hash: string, supabaseClient: typeof supabase) => {
    const { data } = await supabaseClient
      .from('ip_limits')
      .select('free_uses')
      .eq('ip_hash', hash)
      .single();

    if (data) {
      setFreeUsesRemaining(Math.max(0, 3 - data.free_uses));
    } else {
      setFreeUsesRemaining(3);
    }
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    if (!configured) return { error: new Error('Supabase not configured') };

    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName }
      }
    });

    if (error) return { error };

    // 프로필 생성
    if (data.user) {
      await client.from('profiles').insert({
        id: data.user.id,
        email: email,
        full_name: fullName || null
      });

      // 무료 구독 생성
      await client.from('subscriptions').insert({
        user_id: data.user.id,
        plan_type: 'free',
        credits_total: 3,
        credits_used: 0
      });
    }

    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    if (!configured) return { error: new Error('Supabase not configured') };

    const { error } = await client.auth.signInWithPassword({ email, password });
    return { error: error || null };
  };

  const signInWithProvider = async (provider: 'google' | 'kakao' | 'naver') => {
    if (!configured) return { error: new Error('Supabase not configured') };

    const { error } = await client.auth.signInWithOAuth({
      provider: provider as any,
      options: {
        redirectTo: window.location.origin + '/#app'
      }
    });
    return { error: error || null };
  };

  const signOut = async () => {
    await client.auth.signOut();
    setUser(null);
    setProfile(null);
    setSubscription(null);
  };

  const canGenerate = useCallback((): boolean => {
    // 로그인한 유저
    if (user && subscription) {
      if (subscription.is_expired) return false;
      if (subscription.credits_total === -1) return true; // 무제한
      return subscription.credits_remaining > 0;
    }

    // 비로그인 - IP 기반 무료 사용
    return freeUsesRemaining > 0;
  }, [user, subscription, freeUsesRemaining]);

  const useCredit = async (): Promise<boolean> => {
    if (!canGenerate()) return false;

    if (user && subscription) {
      // 로그인 유저 - 크레딧 차감
      if (subscription.credits_total !== -1) {
        const { error } = await client
          .from('subscriptions')
          .update({ credits_used: subscription.credits_used + 1 })
          .eq('user_id', user.id);

        if (error) return false;

        setSubscription(prev => prev ? {
          ...prev,
          credits_used: prev.credits_used + 1,
          credits_remaining: prev.credits_remaining - 1
        } : null);
      }

      // 사용 로그 기록
      await client.from('usage_logs').insert({
        user_id: user.id,
        ip_hash: ipHash || 'unknown',
        action_type: 'generate_blog'
      });

    } else if (ipHash) {
      // 비로그인 - IP 기반 무료 사용량 차감
      const { data: existing } = await client
        .from('ip_limits')
        .select('*')
        .eq('ip_hash', ipHash)
        .single();

      if (existing) {
        await client
          .from('ip_limits')
          .update({ free_uses: existing.free_uses + 1 })
          .eq('ip_hash', ipHash);
      } else {
        await client.from('ip_limits').insert({
          ip_hash: ipHash,
          free_uses: 1
        });
      }

      setFreeUsesRemaining(prev => Math.max(0, prev - 1));

      // 사용 로그 기록
      await client.from('usage_logs').insert({
        user_id: null,
        ip_hash: ipHash,
        action_type: 'generate_blog'
      });
    }

    return true;
  };

  const refreshSubscription = async () => {
    if (user) {
      await loadSubscription(user.id, client);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      subscription,
      loading,
      configured,
      ipHash,
      freeUsesRemaining,
      signUp,
      signIn,
      signInWithProvider,
      signOut,
      canGenerate,
      useCredit,
      refreshSubscription
    }}>
      {children}
    </AuthContext.Provider>
  );
};
