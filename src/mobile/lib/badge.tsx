import { ReactNode, forwardRef } from 'react';
import { statusTone, type Tone } from '@/lib/semanticTone';

const TONES: Record<Tone, string> = {
  primary: 'bg-primary/15 text-primary border-primary/30',
  accent: 'bg-accent/15 text-accent border-accent/30',
  success: 'bg-success/15 text-success border-success/30',
  warning: 'bg-warning/15 text-warning border-warning/30',
  danger: 'bg-destructive/15 text-destructive border-destructive/30',
  muted: 'bg-muted text-muted-foreground border-border',
  price: 'bg-price/15 text-price border-price/30',
};

export const MobileBadge = forwardRef<HTMLSpanElement, { children: ReactNode; tone?: Tone }>(
  ({ children, tone = 'primary' }, ref) => (
    <span ref={ref} className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${TONES[tone]}`}>
      {children}
    </span>
  )
);
MobileBadge.displayName = 'MobileBadge';

/** Badge cujo tom vem do mapa único de status (Regra 1). */
export const MobileStatusBadge = ({ status, children }: { status?: string | null; children?: ReactNode }) => (
  <MobileBadge tone={statusTone(status)}>{children ?? status}</MobileBadge>
);

export function MobileChip({ active, children, onClick }: { active?: boolean; children: ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={!!active}
      className={`shrink-0 min-h-[44px] px-3 py-1.5 rounded-full text-xs font-medium border transition-all focus-ring ${
        active
          ? 'bg-gradient-to-r from-primary to-accent text-primary-foreground border-transparent shadow-md glow-primary'
          : 'bg-card/60 text-muted-foreground border-border hover:text-foreground hover:border-primary/40'
      }`}
    >
      {children}
    </button>
  );
}

export const MForumTag = forwardRef<HTMLSpanElement, { name: string }>(({ name }, ref) => {
  return (
    <span ref={ref} className="inline-flex items-center font-display text-[11px] font-bold tracking-wide text-accent">
      M/{name}
    </span>
  );
});
MForumTag.displayName = 'MForumTag';
