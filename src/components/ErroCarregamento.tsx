import { AlertTriangle, RotateCw, Info, AlertCircle, LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

// GAP-EC01: Níveis de severidade
type Severity = 'info' | 'warning' | 'error';

// GAP-EC01: Mapeamento de ícones por severidade
const severityIcons: Record<Severity, LucideIcon> = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
};

// GAP-EC01: Cores por severidade
const severityColors: Record<Severity, { bg: string; icon: string; border: string }> = {
  info: { bg: 'bg-blue-500/10', icon: 'text-blue-500', border: 'border-blue-500/20' },
  warning: { bg: 'bg-yellow-500/10', icon: 'text-yellow-500', border: 'border-yellow-500/20' },
  error: { bg: 'bg-destructive/10', icon: 'text-destructive', border: 'border-destructive/20' },
};

interface ErroCarregamentoProps {
  titulo?: string;
  descricao?: string;
  onRetry?: () => void;
  retrying?: boolean;
  /** GAP-EC01: Nível de severidade */
  severity?: Severity;
  /** GAP-EC02: Ícone customizado */
  icon?: LucideIcon;
  /** GAP-EC03: Ação secundária */
  secondaryAction?: { label: string; onClick: () => void };
  /** GAP-EC04: Detalhes adicionais do erro */
  details?: string;
  /** GAP-EC04: Label para mostrar detalhes */
  showDetailsLabel?: string;
  /** GAP-EC04: Label para esconder detalhes */
  hideDetailsLabel?: string;
}

export default function ErroCarregamento({
  titulo = 'Não foi possível carregar',
  descricao,
  onRetry,
  retrying = false,
  severity = 'error',
  icon: customIcon,
  secondaryAction,
  details,
  showDetailsLabel = 'Ver detalhes',
  hideDetailsLabel = 'Ocultar detalhes',
}: ErroCarregamentoProps) {
  // GAP-EC04: Estado para mostrar detalhes
  const [showDetails, setShowDetails] = useState(false);
  const IconComponent = customIcon || severityIcons[severity];
  const colors = severityColors[severity];

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        "flex flex-col items-center justify-center text-center py-16 px-4",
        "rounded-lg border border-border"
      )}
    >
      <div className={cn(
        "w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors",
        colors.bg
      )}>
        <IconComponent aria-hidden className={cn("h-7 w-7", colors.icon)} />
      </div>
      
      <p className="text-base font-semibold text-foreground">{titulo}</p>
      
      {descricao && (
        <p className="text-sm text-muted-foreground mt-1.5 max-w-sm">{descricao}</p>
      )}
      
      {/* GAP-EC04: Detalhes expansíveis */}
      {details && (
        <div className="mt-2 max-w-sm w-full">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showDetails ? hideDetailsLabel : showDetailsLabel}
          </button>
          {showDetails && (
            <div className="mt-2 p-3 bg-secondary/50 rounded-lg text-left">
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-all font-mono">
                {details}
              </pre>
            </div>
          )}
        </div>
      )}
      
      <div className="flex flex-col sm:flex-row items-center gap-2 mt-4">
        {/* GAP-EC03: Ação primária (Retry) */}
        {onRetry && (
          <button
            onClick={onRetry}
            disabled={retrying}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-secondary text-foreground text-sm font-semibold hover:bg-secondary/70 transition-colors disabled:opacity-50"
          >
            <RotateCw className={cn("h-4 w-4", retrying && "animate-spin")} />
            Tentar de novo
          </button>
        )}
        
        {/* GAP-EC03: Ação secundária */}
        {secondaryAction && (
          <button
            onClick={secondaryAction.onClick}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
          >
            {secondaryAction.label}
          </button>
        )}
      </div>
    </div>
  );
}