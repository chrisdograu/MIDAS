import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface OpcaoSelect {
  value: string;
  label: string;
  disabled?: boolean;
}

// GAP-SS02: Grupo de opções
export interface GrupoSelect {
  label: string;
  options: OpcaoSelect[];
}

interface SelectSimplesProps {
  value?: string;
  onChange: (v: string) => void;
  options?: OpcaoSelect[];
  /** GAP-SS02: Grupos de opções */
  groups?: GrupoSelect[];
  /** Rótulo acessível (usado como aria-label do gatilho) */
  label?: string;
  /** GAP-SS01: Placeholder */
  placeholder?: string;
  className?: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
  /** GAP-SS03: Estado de loading */
  loading?: boolean;
  /** GAP-SS04: Permitir limpar seleção */
  clearable?: boolean;
  /** GAP-SS04: Label do botão de limpar */
  clearLabel?: string;
}

export default function SelectSimples({
  value,
  onChange,
  options = [],
  groups,
  label,
  placeholder = 'Selecione',
  className = '',
  size = 'md',
  disabled,
  loading = false,
  clearable = false,
  clearLabel = 'Limpar',
}: SelectSimplesProps) {
  const hasValue = !!(value && value !== '' );

  // GAP-SS03: Loading state
  if (loading) {
    return (
      <div className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-muted/30 animate-pulse",
        size === 'sm' ? 'h-8 text-xs' : 'h-10 text-sm',
        className
      )}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-muted-foreground">Carregando...</span>
      </div>
    );
  }

  // GAP-SS04: Select com clear
  const triggerWithClear = (children: React.ReactNode) => (
    <>
      {children}
      {clearable && hasValue && !disabled && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onChange('');
          }}
          className="ml-1 p-1 rounded-full hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
          aria-label={clearLabel}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </>
  );

  const triggerContent = (
    <SelectTrigger
      aria-label={label || placeholder}
      className={cn(
        size === 'sm' ? 'h-8 text-xs' : 'h-10 text-sm',
        'bg-card',
        clearable && hasValue && 'pr-10',
        className
      )}
    >
      <SelectValue placeholder={placeholder} />
    </SelectTrigger>
  );

  // GAP-SS02: Renderizar grupos
  const renderOptions = () => {
    if (groups && groups.length > 0) {
      return groups.map((group) => (
        <SelectGroup key={group.label}>
          <SelectLabel className="text-xs font-semibold text-muted-foreground px-2 py-1.5">
            {group.label}
          </SelectLabel>
          {group.options.map((o) => (
            <SelectItem 
              key={o.value} 
              value={o.value} 
              disabled={o.disabled}
              className={size === 'sm' ? 'text-xs' : 'text-sm'}
            >
              {o.label}
            </SelectItem>
          ))}
        </SelectGroup>
      ));
    }

    return options.map((o) => (
      <SelectItem 
        key={o.value} 
        value={o.value} 
        disabled={o.disabled}
        className={size === 'sm' ? 'text-xs' : 'text-sm'}
      >
        {o.label}
      </SelectItem>
    ));
  };

  return (
    <div className={cn(clearable && hasValue && 'relative', className)}>
      <Select value={value ?? ''} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger
          aria-label={label || placeholder}
          className={cn(
            size === 'sm' ? 'h-8 text-xs' : 'h-10 text-sm',
            'bg-card',
            clearable && hasValue && 'pr-8',
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {renderOptions()}
        </SelectContent>
      </Select>
      {clearable && hasValue && !disabled && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onChange('');
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground z-10"
          aria-label={clearLabel}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}