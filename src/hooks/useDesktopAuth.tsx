import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export type EmployeePosition = 'admin' | 'gerente' | 'moderador' | 'atendente_marketplace' | 'estoquista' | 'atendente';

/**
 * Rodada 16 — RBAC completo por cargo.
 * Chaves de rota canônicas do backoffice. Cada cargo só enxerga (e só acessa)
 * as chaves listadas abaixo. 'admin' é o único com acesso a configuração sensível.
 */
export const SENSITIVE_ROUTES = ['configuracoes', 'integracoes', 'funcionarios', 'parametros'] as const;
export const DIRECAO_ROUTES = ['eca'] as const;

export const POSITION_PERMISSIONS: Record<EmployeePosition, string[]> = {
  admin: ['*'],
  gerente: [
    'produtos', 'clientes', 'fornecedores', 'categorias', 'cupons', 'promocoes', 'bundles',
    'jogos', 'sugestoes', 'anuncios', 'vendedores', 'propostas', 'trocas-arquivadas',
    'avaliacoes-usuario', 'avaliacoes-jogos', 'biblioteca-social', 'torneios', 'disputas-partidas',
    'moderacao', 'denuncias', 'eca', 'tickets', 'notificacoes', 'mensagens', 'forum',
    'relatorios', 'analytics', 'logs', 'xp', 'badges', 'certificados', 'estoque', 'pedidos',
  ],
  moderador: [
    'moderacao', 'denuncias', 'forum', 'avaliacoes-usuario', 'avaliacoes-jogos',
    'torneios', 'disputas-partidas',
  ],
  atendente_marketplace: [
    'anuncios', 'vendedores', 'propostas', 'trocas-arquivadas', 'denuncias',
  ],
  estoquista: [
    'estoque', 'produtos', 'fornecedores', 'categorias',
  ],
  atendente: [
    'pedidos', 'mensagens', 'clientes', 'tickets', 'certificados',
  ],
};

/** Converte um pathname do backoffice na chave canônica de permissão. */
export function routeKeyFromPath(pathname: string): string {
  const rest = pathname.replace(/^\/desktop\/?/, '').split('?')[0];
  if (!rest) return '';
  const [first, second] = rest.split('/');
  if (first === 'notificacoes' && second === 'especiais') return 'notificacoes';
  if (first === 'recompensas') return 'badges';
  if (first === 'titulos') return 'badges';
  return first;
}

export const POSITION_LABELS: Record<EmployeePosition, string> = {
  admin: 'Administrador',
  gerente: 'Gerente',
  moderador: 'Moderador',
  atendente_marketplace: 'Atendente Marketplace',
  estoquista: 'Estoquista',
  atendente: 'Atendente',
};

// GAP-DA03: Timeout de inatividade (30 minutos)
const INACTIVITY_TIMEOUT = 30 * 60 * 1000;

interface DesktopAuthContextType {
  user: User | null;
  profile: { display_name: string | null; avatar_url: string | null } | null;
  position: EmployeePosition | null;
  isStaff: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  canAccess: (route: string) => boolean;
  refreshPermissions: () => Promise<void>;
}

const DesktopAuthContext = createContext<DesktopAuthContextType>({
  user: null,
  profile: null,
  position: null,
  isStaff: false,
  loading: true,
  signIn: async () => ({ error: null }),
  signOut: async () => {},
  canAccess: () => false,
  refreshPermissions: async () => {},
});

export function DesktopAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<{ display_name: string | null; avatar_url: string | null } | null>(null);
  const [position, setPosition] = useState<EmployeePosition | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  const inactivityTimer = useRef<NodeJS.Timeout | null>(null);
  const lastActivity = useRef<number>(Date.now());

  // GAP-DA01: Cache de permissões
  const { data: permissionsData, refetch: refreshPermissions } = useQuery({
    queryKey: ['desktop-permissions', user?.id],
    queryFn: async () => {
      if (!user) return { position: null, isStaff: false };
      
      // GAP-DA04: Registrar acesso
      try {
        await supabase.rpc('record_admin_login' as any, {
          _user_id: user.id,
          _user_agent: navigator.userAgent,
        });
      } catch {
        // Silencioso
      }

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role, position')
        .eq('user_id', user.id)
        .in('role', ['admin', 'atendente'])
        .maybeSingle();

      if (roleData) {
        const pos = (roleData.position as EmployeePosition) || (roleData.role === 'admin' ? 'admin' : 'atendente');
        return { position: pos, isStaff: true };
      }
      
      return { position: null, isStaff: false };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // GAP-DA02: 5 minutos
  });

  // GAP-DA02: Refresh periódico de permissões
  useEffect(() => {
    const interval = setInterval(() => {
      if (user) {
        refreshPermissions();
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user, refreshPermissions]);

  // GAP-DA03: Inatividade
  const resetInactivityTimer = useCallback(() => {
    lastActivity.current = Date.now();
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }
    if (user && position) {
      inactivityTimer.current = setTimeout(() => {
        // Logout automático por inatividade
        toast.warning('Sessão expirada por inatividade');
        signOut();
      }, INACTIVITY_TIMEOUT);
    }
  }, [user, position]);

  useEffect(() => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    const handleActivity = () => resetInactivityTimer();
    
    events.forEach(event => {
      document.addEventListener(event, handleActivity);
    });
    
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
      }
    };
  }, [resetInactivityTimer]);

  // Atualizar estado do cargo
  useEffect(() => {
    if (permissionsData) {
      setPosition(permissionsData.position);
      if (permissionsData.isStaff) {
        resetInactivityTimer();
      }
    }
  }, [permissionsData, resetInactivityTimer]);

  const fetchStaffData = async (userId: string) => {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('id', userId)
      .single();
    
    setProfile(profileData);
    await refreshPermissions();
    return true;
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        setTimeout(() => {
          fetchStaffData(session.user.id).then(() => {
            setLoading(false);
          });
        }, 0);
      } else {
        setUser(null);
        setProfile(null);
        setPosition(null);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        fetchStaffData(session.user.id).then(() => {
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    
    if (data.user) {
      const isStaff = await fetchStaffData(data.user.id);
      if (!isStaff) {
        await supabase.auth.signOut();
        return { error: 'Acesso restrito. Conta não autorizada para o backoffice.' };
      }
    }
    return { error: null };
  };

  const signOut = async () => {
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setPosition(null);
    queryClient.clear();
  };

  const canAccess = (route: string) => {
    if (!position) return false;
    const key = route.startsWith('/desktop') ? routeKeyFromPath(route) : route.split('/')[0];
    if (key === '') return true;
    const perms = POSITION_PERMISSIONS[position];
    if (perms.includes('*')) return true;
    return perms.includes(key);
  };

  const isStaff = !!position;

  return (
    <DesktopAuthContext.Provider value={{ 
      user, 
      profile, 
      position, 
      isStaff, 
      loading, 
      signIn, 
      signOut, 
      canAccess,
      refreshPermissions,
    }}>
      {children}
    </DesktopAuthContext.Provider>
  );
}

export const useDesktopAuth = () => useContext(DesktopAuthContext);