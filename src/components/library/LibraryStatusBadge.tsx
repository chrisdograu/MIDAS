// Badges visuais consistentes para status / completação / platinação.
// Usado em Biblioteca, FriendProfile, SocialLibrary e Mobile.
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// ─── GAP-LSB03: Suporte a múltiplos idiomas ──────────────────────────────────

export const STATUS_LABELS: Record<string, string> = {
  quero_jogar: 'Quero jogar',
  jogando: 'Jogando',
  pausado: 'Pausado',
  zerado: 'Completado',
  platinado: 'Platinado',
  rejogando: 'Rejogando',
  abandonado: 'Abandonado',
};

// GAP-LSB01: Fallback para status desconhecido
export const STATUS_LABELS_FALLBACK: Record<string, string> = {
  ...STATUS_LABELS,
  unknown: 'Indefinido',
};

// GAP-LSB05: Cores com suporte a tema do jogo
const STATUS_TONES: Record<string, string> = {
  quero_jogar: 'bg-primary/20 text-primary border-primary/40',
  jogando: 'bg-success/20 text-success border-success/40',
  pausado: 'bg-warning/20 text-warning border-warning/40',
  zerado: 'bg-accent/20 text-accent border-accent/40',
  platinado: 'bg-primary/20 text-primary border-primary/40',
  rejogando: 'bg-accent/20 text-accent border-accent/40',
  abandonado: 'bg-destructive/20 text-destructive border-destructive/40',
  unknown: 'bg-muted/20 text-muted-foreground border-border/40',
};

// GAP-LSB05: Cores por tema do jogo (usar a cor do jogo se disponível)
export function getStatusToneWithGameColor(
  status: string,
  gameColor?: string
): string {
  const baseTone = STATUS_TONES[status] || STATUS_TONES.unknown;
  if (!gameColor) return baseTone;
  // Se tiver cor do jogo, substitui o bg/text pelo tom do jogo
  return `bg-[${gameColor}]/20 text-[${gameColor}] border-[${gameColor}]/40`;
}

// ─── COMPONENTE STATUS PILL ──────────────────────────────────────────────────

interface StatusPillProps {
  status?: string | null;
  className?: string;
  /** GAP-LSB04: Mostrar timestamp da última atualização */
  showTimestamp?: boolean;
  lastUpdated?: string | null;
  /** GAP-LSB05: Cor personalizada do jogo */
  gameColor?: string;
  /** GAP-LSB02: Animação de entrada */
  animate?: boolean;
}

export function StatusPill({
  status,
  className,
  showTimestamp = false,
  lastUpdated,
  gameColor,
  animate = true,
}: StatusPillProps) {
  // GAP-LSB02: Animação de entrada
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (animate) {
      const timer = setTimeout(() => setMounted(true), 50);
      return () => clearTimeout(timer);
    }
    setMounted(true);
  }, [animate]);

  if (!status) return null;

  const label = STATUS_LABELS_FALLBACK[status] || STATUS_LABELS_FALLBACK.unknown;
  const tone = gameColor
    ? getStatusToneWithGameColor(status, gameColor)
    : STATUS_TONES[status] || STATUS_TONES.unknown;

  const formattedTimestamp = lastUpdated
    ? new Date(lastUpdated).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all duration-300',
              tone,
              className,
              mounted && animate ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'
            )}
          >
            {label}
            {showTimestamp && formattedTimestamp && (
              <span className="ml-1 text-[8px] opacity-60">· {formattedTimestamp}</span>
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">
            Status: {label}
            {formattedTimestamp && ` · Atualizado em ${formattedTimestamp}`}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ─── COMPLETION BADGE ────────────────────────────────────────────────────────

interface CompletionBadgeProps {
  platinum?: boolean | null;
  completed?: boolean | null;
  verifiedSource?: string | null;
  className?: string;
  /** GAP-LSB02: Animação de entrada */
  animate?: boolean;
  /** GAP-LSB04: Data da conquista */
  achievedAt?: string | null;
}

export function CompletionBadge({
  platinum,
  completed,
  verifiedSource,
  className,
  animate = true,
  achievedAt,
}: CompletionBadgeProps) {
  // GAP-LSB02: Animação de entrada
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (animate) {
      const timer = setTimeout(() => setMounted(true), 100);
      return () => clearTimeout(timer);
    }
    setMounted(true);
  }, [animate]);

  if (!platinum && !completed) return null;

  const verified = verifiedSource && verifiedSource !== 'user_declared';
  const achievedDate = achievedAt
    ? new Date(achievedAt).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : null;

  const badgeClass = cn(
    'text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-lg transition-all duration-300',
    mounted && animate ? 'opacity-100 scale-100' : 'opacity-0 scale-90',
    className
  );

  if (platinum) {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                badgeClass,
                'bg-gradient-to-br from-primary to-primary/70 text-primary-foreground'
              )}
            >
              💎 PLAT{verified ? ' ✓' : ''}
              {achievedDate && <span className="ml-0.5 text-[8px] opacity-70">· {achievedDate}</span>}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">
              Platinado {verified ? '(verificado)' : '(declarado pelo usuário)'}
              {achievedDate && ` em ${achievedDate}`}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (completed && !platinum) {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                badgeClass,
                'bg-gradient-to-br from-accent to-accent/70 text-accent-foreground'
              )}
            >
              ✓ 100%{verified ? ' ✓' : ''}
              {achievedDate && <span className="ml-0.5 text-[8px] opacity-70">· {achievedDate}</span>}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">
              Completado {verified ? '(verificado)' : '(declarado pelo usuário)'}
              {achievedDate && ` em ${achievedDate}`}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return null;
}

// ─── GAP-LSB06: CONTADOR DE STATUS ──────────────────────────────────────────

interface StatusCounterProps {
  counts: Record<string, number>;
  total?: number;
  className?: string;
}

export function StatusCounter({ counts, total, className }: StatusCounterProps) {
  const totalGames = total || Object.values(counts).reduce((acc, curr) => acc + curr, 0);

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {Object.entries(counts).map(([status, count]) => {
        if (count === 0) return null;
        const label = STATUS_LABELS_FALLBACK[status] || status;
        const tone = STATUS_TONES[status] || STATUS_TONES.unknown;
        const percentage = totalGames > 0 ? Math.round((count / totalGames) * 100) : 0;

        return (
          <span
            key={status}
            className={cn(
              'inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border',
              tone
            )}
          >
            {label}
            <span className="text-[8px] opacity-70">{count}</span>
            {percentage > 0 && (
              <span className="text-[8px] opacity-50">({percentage}%)</span>
            )}
          </span>
        );
      })}
    </div>
  );
}

// ─── EXPORTS ──────────────────────────────────────────────────────────────────

export default StatusPill;