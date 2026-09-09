import { LucideIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tone = 'primary' | 'accent';
// GAP-FC01: Tamanhos
type Size = 'sm' | 'md' | 'lg';

// GAP-FC01: Configurações de tamanho
const sizeConfigs: Record<Size, { height: string; padding: string; text: string; icon: string }> = {
  sm: { height: 'h-6', padding: 'px-2', text: 'text-[10px]', icon: 'h-3 w-3' },
  md: { height: 'h-8', padding: 'px-3', text: 'text-xs', icon: 'h-3.5 w-3.5' },
  lg: { height: 'h-10', padding: 'px-4', text: 'text-sm', icon: 'h-4 w-4' },
};

interface FilterChipProps {
  active?: boolean;
  onClick?: () => void;
  icon?: LucideIcon;
  tone?: Tone;
  children: React.ReactNode;
  'aria-label'?: string;
  /** GAP-FC01: Tamanho do chip */
  size?: Size;
  /** GAP-FC02: Estado de loading */
  loading?: boolean;
  /** GAP-FC03: Contador para badge */
  count?: number;
  /** GAP-FC04: Desabilitado */
  disabled?: boolean;
  className?: string;
}

/**
 * Chip único de filtro — Web, Mobile e Desktop.
 * Regra 1 (cor tem papel) + Regra 5 (ativo usa glow, não só bg/10)
 * + Regra 8 (hover/focus/active). Nada de cor crua na tela que usa.
 */
export function FilterChip({ 
  active, 
  onClick, 
  icon: Icon, 
  tone = 'primary', 
  children,
  size = 'md',
  loading = false,
  count,
  disabled = false,
  className,
  ...rest 
}: FilterChipProps) {
  const config = sizeConfigs[size];
  const isDisabled = disabled || loading;

  const activeClass =
    tone === 'accent'
      ? 'bg-accent text-accent-foreground border-accent glow-accent'
      : 'bg-primary text-primary-foreground border-primary glow-primary';

  return (
    <button
      type="button"
      onClick={isDisabled ? undefined : onClick}
      aria-pressed={!!active}
      disabled={isDisabled}
      {...rest}
      className={cn(
        "focus-ring shrink-0 inline-flex items-center gap-1.5 rounded-full border font-semibold whitespace-nowrap transition-all",
        "active:scale-95",
        config.height,
        config.padding,
        config.text,
        active
          ? activeClass
          : 'bg-secondary/60 border-border text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-secondary',
        isDisabled && 'opacity-50 cursor-not-allowed active:scale-100',
        className
      )}
    >
      {loading ? (
        <Loader2 className={cn("animate-spin", config.icon)} />
      ) : (
        <>
          {Icon && <Icon className={config.icon} />}
          {children}
          {/* GAP-FC03: Contador */}
          {count !== undefined && count > 0 && (
            <span className={cn(
              "ml-0.5 rounded-full bg-foreground/10 px-1.5 py-0.5 text-[10px] font-bold",
              active && "bg-primary-foreground/20"
            )}>
              {count > 99 ? '99+' : count}
            </span>
          )}
        </>
      )}
    </button>
  );
}

interface FilterChipGroupProps {
  label?: string;
  children: React.ReactNode;
  className?: string;
}

/** Linha rolável de chips com rótulo curto — mantém densidade sob controle (Regra 3). */
export function FilterChipGroup({ label, children, className }: FilterChipGroupProps) {
  return (
    <div className={cn("flex items-center gap-2 min-w-0", className)}>
      {label && (
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-[52px]">
          {label}
        </span>
      )}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-thin py-0.5 pr-1">
        {children}
      </div>
    </div>
  );
}

export default FilterChip;