import { createContext, useContext, useEffect, useRef, useState, FC, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import { checkRateLimit, RL } from '@/lib/clientRateLimit';
import { authRedirectBase } from '@/lib/appUrl';
import { toast } from 'sonner';

// GAP-UA03: Status de verificação de email
interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  profile: { display_name: string | null; avatar_url: string | null; banned_until: string | null } | null;
  isEmailVerified: boolean;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  resendVerification: (email: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// GAP-UA01: Auto-refresh token
const TOKEN_REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutos

export const AuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ display_name: string | null; avatar_url: string | null; banned_until: string | null } | null>(null);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const loadedProfileFor = useRef<string | null>(null);
  const lastUserId = useRef<string | null>(null);
  const refreshTimer = useRef<NodeJS.Timeout | null>(null);

  // GAP-UA02: Persistência de sessão
  const SESSION_KEY = 'midias-session';

  const saveSession = (session: Session | null) => {
    try {
      if (session) {
        localStorage.setItem(SESSION_KEY, JSON.stringify({
          user: session.user,
          expires_at: session.expires_at,
        }));
      } else {
        localStorage.removeItem(SESSION_KEY);
      }
    } catch {
      // Silently fail
    }
  };

  const loadSession = (): Session | null => {
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      if (parsed.expires_at && parsed.expires_at * 1000 < Date.now()) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return parsed as Session;
    } catch {
      return null;
    }
  };

  const applySession = useCallback((session: Session | null) => {
    const nextUserId = session?.user?.id ?? null;
    setSession(session);
    setIsEmailVerified(Boolean(session?.user?.email_confirmed_at));
    setUser(session?.user ?? null);
    
    // GAP-UA02: Persistir sessão
    saveSession(session);
    
    if (nextUserId !== lastUserId.current) {
      lastUserId.current = nextUserId;
      setUser(session?.user ?? null);
      if (session?.user) {
        void fetchProfile(session.user.id);
        // GAP-UA03: Verificar email
      } else {
        loadedProfileFor.current = null;
        setProfile(null);
        setIsEmailVerified(false);
      }
    }
    setLoading(false);
  }, []);

  // GAP-UA01: Auto-refresh token
  const setupTokenRefresh = useCallback((session: Session) => {
    if (refreshTimer.current) {
      clearInterval(refreshTimer.current);
      refreshTimer.current = null;
    }

    if (session?.expires_at) {
      const expiresIn = session.expires_at * 1000 - Date.now();
      const refreshIn = Math.max(TOKEN_REFRESH_INTERVAL, expiresIn * 0.5);

      refreshTimer.current = setTimeout(async () => {
        try {
          const { data, error } = await supabase.auth.refreshSession();
          if (!error && data.session) {
            applySession(data.session);
          }
        } catch {
          // Silently fail, token will be refreshed on next request
        }
      }, refreshIn);
    }
  }, [applySession]);

  useEffect(() => {
    // GAP-UA02: Tentar restaurar sessão
    const savedSession = loadSession();
    if (savedSession) {
      applySession(savedSession);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
      if (session) {
        setupTokenRefresh(session);
      } else if (refreshTimer.current) {
        clearInterval(refreshTimer.current);
        refreshTimer.current = null;
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session);
      if (session) {
        setupTokenRefresh(session);
      }
    });

    return () => {
      subscription.unsubscribe();
      if (refreshTimer.current) {
        clearInterval(refreshTimer.current);
      }
    };
  }, [applySession, setupTokenRefresh]);

  const fetchProfile = async (userId: string) => {
    if (loadedProfileFor.current === userId) return;
    loadedProfileFor.current = userId;
    const { data } = await supabase
      .from('profiles')
      .select('display_name, avatar_url, banned_until')
      .eq('id', userId)
      .single();
    if (data) {
      setProfile(data);
    }
    // Rodada 22: login reativa conta pausada e registra o acesso no histórico.
    void (async () => {
      try {
        await supabase.rpc('resume_my_account' as any);
        await supabase.rpc('record_login' as any, { _user_agent: navigator.userAgent });
      } catch { /* não bloqueia o login */ }
    })();
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: authRedirectBase(),
        data: { display_name: displayName },
      },
    });
    if (!error) {
      toast.success('Cadastro realizado! Verifique seu email para confirmar.');
    }
    return { error: error?.message ?? null };
  };

  const signIn = async (email: string, password: string) => {
    const rl = checkRateLimit(RL.LOGIN);
    if (rl.ok === false) return { error: `Muitas tentativas de login. Tente novamente em ${rl.retryInSec}s.` };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    loadedProfileFor.current = null;
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsEmailVerified(false);
    localStorage.removeItem(SESSION_KEY);
    if (refreshTimer.current) {
      clearInterval(refreshTimer.current);
      refreshTimer.current = null;
    }
  };

  const resetPassword = async (email: string) => {
    const rl = checkRateLimit(RL.RESET);
    if (rl.ok === false) return { error: `Muitos pedidos de redefinição. Tente novamente em ${Math.ceil(rl.retryInSec / 60)}min.` };
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${authRedirectBase()}/reset-password`,
    });
    if (!error) {
      toast.success('Email de recuperação enviado! Verifique sua caixa de entrada.');
    }
    return { error: error?.message ?? null };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (!error) {
      toast.success('Senha atualizada com sucesso!');
    }
    return { error: error?.message ?? null };
  };

  // GAP-UA03: Reenviar verificação de email
  const resendVerification = async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    });
    if (!error) {
      toast.success('Email de verificação reenviado!');
    }
    return { error: error?.message ?? null };
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      loading, 
      profile, 
      isEmailVerified,
      signUp, 
      signIn, 
      signOut, 
      resetPassword, 
      updatePassword,
      resendVerification,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}