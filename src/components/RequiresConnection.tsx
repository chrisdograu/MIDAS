// Rodada 19 — trava de ações que exigem rede (checkout não pode entrar na fila offline).
import { ReactNode, useState } from 'react';
import { CloudOff, Wifi, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import { useOnline } from '@/components/OfflineBanner';
import { cn } from '@/lib/utils';

// GAP-RC02: Variantes de cor
type Variant = 'default' | 'warning' | 'error';

const variantConfigs: Record<Variant, { bg: string; border: string; text: string; icon: string }> = {
  default: {
    bg: 'bg-muted/40',
    border: 'border-border',
    text: 'text-muted-foreground',
    icon: 'text-muted-foreground',
  },
  warning: {
    bg: 'bg-warning/10',
    border: 'border-warning/30',
    text: 'text-warning dark:text-gold',
    icon: 'text-warning',
  },
  error: {
    bg: 'bg-destructive/10',
    border: 'border-destructive/30',
    text: 'text-destructive',
    icon: 'text-destructive',
  },
};

interface RequiresConnectionProps {
  children: ReactNode;
  message?: string;
  /** GAP-RC01: Ícone customizado */
  icon?: ReactNode;
  /** GAP-RC02: Variante de cor */
  variant?: Variant;
  /** GAP-RC03: Ação de retry */
  onRetry?: () => void;
  /** GAP-RC03: Label do botão de retry */
  retryLabel?: string;
  /** GAP-RC04: Estado de verificação */
  checking?: boolean;
  /** GAP-RC04: Texto de loading */
  checkingLabel?: string;
  /** GAP-RC04: Mostrar loading state */
  showLoading?: boolean;
}

export default function RequiresConnection({ 
  children, 
  message,
  icon,
  variant = 'default',
  onRetry,
  retryLabel = 'Tentar novamente',
  checking = false,
  checkingLabel = 'Verificando conexão...',
  showLoading = true,
}: RequiresConnectionProps) {
  const online = useOnline();
  const [retrying, setRetrying] = useState(false);

  // GAP-RC03: Retry handler
  const handleRetry = async () => {
    if (!onRetry) return;
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };

  // GAP-RC04: Loading state
  if (checking && showLoading) {
    return (
      <div className="space-y-2">
        <div className="w-full py-3 rounded-lg border border-border bg-muted/40 text-sm flex items-center justify-center gap-2 animate-pulse">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">{checkingLabel}</span>
        </div>
      </div>
    );
  }

  if (online) return <>{children}</>;

  const config = variantConfigs[variant];
  const IconComponent = icon || (variant === 'error' ? AlertCircle : CloudOff);

  return (
    <div className="space-y-3">
      <div className={cn(
        "w-full py-3 px-4 rounded-lg border text-sm flex flex-col sm:flex-row items-center justify-center gap-2",
        config.bg,
        config.border,
        config.text
      )}>
        <div className="flex items-center gap-2">
          <span className={cn("shrink-0", config.icon)}>
            {typeof IconComponent === 'function' ? <IconComponent className="h-4 w-4" /> : IconComponent}
          </span>
          <span>{message || 'Sem conexão com a internet'}</span>
        </div>
        
        {/* GAP-RC03: Botão de retry */}
        {onRetry && (
          <button
            onClick={handleRetry}
            disabled={retrying}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-colors",
              "bg-primary/10 text-primary hover:bg-primary/20",
              "disabled:opacity-50"
            )}
          >
            {retrying ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            {retrying ? 'Reconectando...' : retryLabel}
          </button>
        )}
      </div>
      
      <p className="text-xs text-muted-foreground text-center">
        {message 
          ? 'Esta ação precisa de internet. Reconecte para continuar.'
          : 'Esta ação precisa de internet e não fica na fila offline. Reconecte para continuar.'
        }
      </p>
    </div>
  );
}

// GAP-RC01: Versão com ícone customizado
export function RequiresConnectionWithIcon({ 
  icon = <Wifi className="h-5 w-5" />,
  ...props 
}: RequiresConnectionProps & { icon: ReactNode }) {
  return <RequiresConnection {...props} icon={icon} />;
}

// GAP-RC02: Versão de erro (para ações críticas)
export function RequiresConnectionError(props: RequiresConnectionProps) {
  return <RequiresConnection {...props} variant="error" />;
}