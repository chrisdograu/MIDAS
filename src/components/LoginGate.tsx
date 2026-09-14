import { useState, useCallback, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { LogIn, X, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

// GAP-LG04: Tamanhos do modal
type ModalSize = 'sm' | 'md' | 'lg';

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
};

interface UseLoginGateOptions {
  /** GAP-LG02: Título customizado do modal */
  title?: string;
  /** GAP-LG02: Descrição customizada do modal */
  description?: string;
  /** GAP-LG02: Label do botão de ação */
  actionLabel?: string;
  /** GAP-LG04: Tamanho do modal */
  size?: ModalSize;
  /** GAP-LG01: Rota de redirecionamento após login */
  redirectTo?: string;
  /** GAP-LG02: Ícone customizado */
  icon?: ReactNode;
}

/**
 * Hook que retorna `requireAuth(action)`: executa `action()` se logado,
 * caso contrário abre o modal de "precisa estar logado".
 *
 * Uso:
 *   const { requireAuth, gate } = useLoginGate();
 *   <button onClick={() => requireAuth(() => doStuff())} />
 *   {gate}
 */
export function useLoginGate(options: UseLoginGateOptions = {}) {
  const { 
    title = 'Você precisa estar logado',
    description = 'Entre na sua conta MIDIAS para continuar.',
    actionLabel = 'Ir para login',
    size = 'md',
    redirectTo,
    icon,
  } = options;

  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  // GAP-LG03: Salvar rota atual para redirecionamento
  const currentPath = location.pathname + location.search;

  const requireAuth = useCallback(
    (action?: () => void): boolean => {
      if (user) {
        action?.();
        return true;
      }
      setOpen(true);
      return false;
    },
    [user]
  );

  // GAP-LG01: Redirecionamento com salvamento de rota
  const goLogin = () => {
    setOpen(false);
    const redirect = redirectTo || currentPath;
    const baseRoute = location.pathname.startsWith('/m') ? '/m/auth' : '/auth';
    const redirectParam = redirect !== '/' && redirect !== '' 
      ? `?redirect=${encodeURIComponent(redirect)}` 
      : '';
    navigate(baseRoute + redirectParam);
  };

  const gate: ReactNode = (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-overlay/70 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "relative w-full glass rounded-2xl p-6 text-center border border-primary/30",
              sizeClasses[size]
            )}
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 p-1 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
            
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-accent mx-auto flex items-center justify-center mb-3 glow-primary">
              {icon || <LogIn className="h-6 w-6 text-primary-foreground" />}
            </div>
            
            <h3 className="font-display text-lg font-bold gradient-text">
              {title}
            </h3>
            
            <p className="text-sm text-muted-foreground mt-1.5 mb-5">
              {description}
            </p>
            
            <div className="flex gap-2">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 py-2.5 rounded-lg bg-secondary text-sm font-semibold hover:bg-secondary/70 transition-colors"
              >
                Agora não
              </button>
              <button
                onClick={goLogin}
                className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-primary to-accent text-primary-foreground text-sm font-semibold flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity"
              >
                <LogIn className="h-4 w-4" /> {actionLabel}
              </button>
            </div>

            {/* GAP-LG02: Informação de segurança */}
            <p className="text-[10px] text-muted-foreground mt-3 flex items-center justify-center gap-1">
              <Shield className="h-3 w-3" />
              Sua sessão é segura e criptografada
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return { requireAuth, gate, isAuthed: !!user };
}

// GAP-LG02: Variantes pré-configuradas
export function useProtectedAction(options: UseLoginGateOptions & { 
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const { onSuccess, onCancel, ...gateOptions } = options;
  const { requireAuth, gate, isAuthed } = useLoginGate(gateOptions);

  const execute = useCallback(async (action: () => void | Promise<void>) => {
    const authed = requireAuth(() => {
      Promise.resolve(action()).then(onSuccess);
    });
    if (!authed) {
      onCancel?.();
    }
  }, [requireAuth, onSuccess, onCancel]);

  return { execute, gate, isAuthed };
}