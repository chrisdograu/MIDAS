import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Ban, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/format";

// Bypass só existe em builds de desenvolvimento — em produção Vite garante
// import.meta.env.DEV = false, então esse ramo é morto no build final e não pode
// ser ativado por commit acidental de um booleano solto.
const DEV_BYPASS = false && import.meta.env.DEV;

// GAP-PR03: Roles permitidas
type Role = 'user' | 'admin' | 'moderator' | 'seller';

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
  /** GAP-PR02: Estado para redirecionamento */
  state?: any;
  /** GAP-PR03: Role necessária para acessar */
  requiredRole?: Role;
  /** GAP-PR04: Fallback UI customizada */
  fallback?: React.ReactNode;
}

export default function ProtectedRoute({
  children,
  redirectTo = "/auth",
  state,
  requiredRole,
  fallback,
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [isBanned, setIsBanned] = useState(false);
  const [bannedUntil, setBannedUntil] = useState<string | null>(null);
  const [roleCheckLoading, setRoleCheckLoading] = useState(true);
  const [userRole, setUserRole] = useState<Role>('user');

  if (DEV_BYPASS) return <>{children}</>;

  // GAP-PR01: Verificação de banimento
  useEffect(() => {
    if (!user) {
      setRoleCheckLoading(false);
      return;
    }

    const checkBanAndRole = async () => {
      setRoleCheckLoading(true);
      setIsBanned(false);
      setBannedUntil(null);
      setUserRole('user');
      const { data: profile } = await supabase
        .from('profiles')
        .select('banned_until')
        .eq('id', user.id)
        .maybeSingle();

      if (profile) {
        if (profile.banned_until && new Date(profile.banned_until) > new Date()) {
          setIsBanned(true);
          setBannedUntil(profile.banned_until);
        }
      }
      if (requiredRole) {
        const { data: roles } = await supabase.from('user_roles').select('role, position').eq('user_id', user.id);
        if (roles?.some(r => r.role === requiredRole || (requiredRole === 'moderator' && r.position === 'moderador'))) setUserRole(requiredRole);
      }
      setRoleCheckLoading(false);
    };

    checkBanAndRole();
  }, [user, requiredRole]);

  if (loading || roleCheckLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  // GAP-PR01: Usuário banido
  if (isBanned) {
    return fallback || (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
          <Ban className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Conta Suspensa</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-md">
          Sua conta está suspensa até {bannedUntil ? formatDate(bannedUntil) : 'nova avaliação'}.
          Durante este período, você não pode acessar esta área.
        </p>
        <button
          onClick={() => window.location.href = '/'}
          className="mt-4 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90"
        >
          Voltar para o início
        </button>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={redirectTo} replace state={{ from: location, ...state }} />;
  }

  // GAP-PR03: Verificação de role
  if (requiredRole && userRole !== requiredRole) {
    return fallback || (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
          <Ban className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Acesso Negado</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-md">
          Você não tem permissão para acessar esta página. Esta área requer permissões de {requiredRole}.
        </p>
        <button
          onClick={() => window.location.href = '/'}
          className="mt-4 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90"
        >
          Voltar para o início
        </button>
      </div>
    );
  }

  return <>{children}</>;
}

// GAP-PR03: Conveniência para rotas de admin
export function AdminRoute({ children, ...props }: Omit<ProtectedRouteProps, 'requiredRole'>) {
  return <ProtectedRoute {...props} requiredRole="admin">{children}</ProtectedRoute>;
}

// GAP-PR03: Conveniência para rotas de moderador
export function ModeratorRoute({ children, ...props }: Omit<ProtectedRouteProps, 'requiredRole'>) {
  return <ProtectedRoute {...props} requiredRole="moderator">{children}</ProtectedRoute>;
}

// GAP-PR03: Conveniência para rotas de vendedor
export function SellerRoute({ children, ...props }: Omit<ProtectedRouteProps, 'requiredRole'>) {
  return <ProtectedRoute {...props} requiredRole="seller">{children}</ProtectedRoute>;
}