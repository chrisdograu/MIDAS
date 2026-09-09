import { LucideIcon, Inbox } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

// GAP-EV01: Tamanhos
type Size = 'sm' | 'md' | 'lg';

// GAP-EV02: Ação
interface Action {
  label: string;
  onClick?: () => void;
  to?: string;
  variant?: 'primary' | 'secondary' | 'outline';
}

interface EstadoVazioProps {
  /** GAP-EV01: Tamanho do componente */
  size?: Size;
  icone?: LucideIcon;
  titulo: string;
  descricao?: string;
  /** GAP-EV02: Múltiplas ações */
  actions?: Action[];
  /** GAP-EV03: Ilustração customizada */
  illustration?: React.ReactNode;
  /** Ação principal (deprecated, use actions) */
  acao?: Action;
}

const sizeConfigs: Record<Size, { icon: number; title: string; desc: string; gap: string }> = {
  sm: { icon: 12, title: 'text-sm', desc: 'text-xs', gap: 'gap-2' },
  md: { icon: 16, title: 'text-base', desc: 'text-sm', gap: 'gap-4' },
  lg: { icon: 24, title: 'text-xl', desc: 'text-base', gap: 'gap-6' },
};

export default function EstadoVazio({ 
  size = 'md',
  icone: Icone = Inbox, 
  titulo, 
  descricao, 
  actions,
  acao,
  illustration,
}: EstadoVazioProps) {
  const config = sizeConfigs[size];
  
  // GAP-EV02: Combinar ações
  const allActions = actions || (acao ? [acao] : []);

  // GAP-EV03: Renderizar ilustração
  const renderIllustration = () => {
    if (illustration) return illustration;
    
    return (
      <div className={cn(
        "rounded-full bg-secondary/60 flex items-center justify-center",
        size === 'sm' ? 'w-12 h-12' : size === 'lg' ? 'w-20 h-20' : 'w-16 h-16'
      )}>
        <Icone className={cn(
          "text-muted-foreground",
          size === 'sm' ? 'h-5 w-5' : size === 'lg' ? 'h-9 w-9' : 'h-7 w-7'
        )} />
      </div>
    );
  };

  // GAP-EV02: Renderizar ações
  const renderActions = () => {
    if (allActions.length === 0) return null;

    const variantClasses = {
      primary: 'bg-primary text-primary-foreground hover:opacity-90',
      secondary: 'bg-secondary text-foreground hover:bg-secondary/70',
      outline: 'border border-border hover:border-primary/40 hover:bg-secondary/30',
    };

    return (
      <div className={cn(
        "flex flex-wrap items-center justify-center gap-2",
        size === 'sm' ? 'mt-3' : size === 'lg' ? 'mt-6' : 'mt-4'
      )}>
        {allActions.map((action, index) => {
          const variant = action.variant || 'primary';
          const baseClass = cn(
            "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors",
            variantClasses[variant]
          );

          if (action.to) {
            return (
              <Link key={index} to={action.to} className={baseClass}>
                {action.label}
              </Link>
            );
          }

          return (
            <button key={index} onClick={action.onClick} className={baseClass}>
              {action.label}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className={cn(
      "flex flex-col items-center justify-center text-center px-4",
      size === 'sm' ? 'py-8' : size === 'lg' ? 'py-24' : 'py-16'
    )}>
      {renderIllustration()}
      
      <p className={cn(
        "font-semibold text-foreground mt-3",
        config.title
      )}>
        {titulo}
      </p>
      
      {descricao && (
        <p className={cn(
          "text-muted-foreground max-w-sm",
          config.desc,
          "mt-1.5"
        )}>
          {descricao}
        </p>
      )}
      
      {renderActions()}
    </div>
  );
}