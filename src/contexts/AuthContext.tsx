import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  sessionReady: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, name?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // sessionReady: true only after getSession() resolves — prevents double-load on OAuth
  const [sessionReady, setSessionReady] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    // 1. Restore session from storage FIRST (synchronous-ish) — single source of truth
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      setSessionReady(true);
      initializedRef.current = true;
    });

    // 2. Listen for subsequent changes (sign-in, sign-out, token refresh)
    //    Skip the INITIAL_SESSION event to avoid double-triggering loadInitialData
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // INITIAL_SESSION fires before getSession resolves — skip it
        if (event === 'INITIAL_SESSION') return;
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        if (!initializedRef.current) {
          setSessionReady(true);
          initializedRef.current = true;
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, name?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          name: name || email.split('@')[0],
        },
      },
    });

    // Create profile after successful signup
    if (!error && data.user) {
      await supabase.from('profiles').upsert({
        user_id: data.user.id,
        email: email,
        name: name || email.split('@')[0],
      });
    }

    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    // Always redirect to the published domain to avoid landing on preview URLs
    const productionOrigin = 'https://clinipro.lovable.app';
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${productionOrigin}/auth?reset=true`,
    });
    return { error: error as Error | null };
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, sessionReady, signIn, signUp, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
