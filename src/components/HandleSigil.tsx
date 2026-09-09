/**
 * Sigilos de identidade do MIDIAS.
 *
 * O produto usa dois prefixos, como em qualquer rede: `@` para o perfil
 * pessoal e `$` para o perfil de vendedor do marketplace. Em texto corrido
 * esses prefixos soltos ("perfil $vendedor") parecem variável de template,
 * então o sigilo SEMPRE é renderizado por estes componentes — estilo de
 * handle, nunca prosa.
 *
 * Regra de escrita:
 *  - prosa e mensagens (toast, aria-label): "perfil de vendedor", em PT-BR;
 *  - referência ao sigilo/convenção: <SellerSigil /> ou <UserSigil />.
 */
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// GAP-HSg01: Tamanhos
type SigilSize = 'sm' | 'md' | 'lg';

const sizeClasses: Record<SigilSize, string> = {
  sm: 'text-xs',
  md: 'text-[0.9em]',
  lg: 'text-base',
};

// GAP-HSg02: Cores customizadas
interface SigilProps {
  handle?: string;
  /** GAP-HSg01: Tamanho do sigilo */
  size?: SigilSize;
  /** GAP-HSg02: Cor customizada (classe Tailwind) */
  color?: string;
  /** GAP-HSg02: Cor do símbolo (classe Tailwind) */
  symbolColor?: string;
  /** GAP-HSg03: Tooltip de descrição */
  tooltip?: string;
  /** GAP-HSg04: Callback ao clicar */
  onClick?: () => void;
  className?: string;
}

const base =
  'inline-flex items-center font-display font-bold tracking-wide align-baseline cursor-default';

export function SellerSigil({ 
  handle = 'vendedor',
  size = 'md',
  color = 'text-accent',
  symbolColor,
  tooltip,
  onClick,
  className,
}: SigilProps) {
  const symbolClass = symbolColor || color;
  const content = (
    <span 
      className={cn(
        base,
        sizeClasses[size],
        color,
        onClick && 'cursor-pointer hover:opacity-80 transition-opacity',
        className
      )}
      onClick={onClick}
    >
      <span className={symbolClass} aria-hidden>$</span>
      <span className="sr-only">perfil de vendedor </span>
      {handle}
    </span>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {content}
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return content;
}

export function UserSigil({ 
  handle = 'usuario',
  size = 'md',
  color = 'text-primary',
  symbolColor,
  tooltip,
  onClick,
  className,
}: SigilProps) {
  const symbolClass = symbolColor || color;
  const content = (
    <span 
      className={cn(
        base,
        sizeClasses[size],
        color,
        onClick && 'cursor-pointer hover:opacity-80 transition-opacity',
        className
      )}
      onClick={onClick}
    >
      <span className={symbolClass} aria-hidden>@</span>
      <span className="sr-only">perfil pessoal </span>
      {handle}
    </span>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {content}
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return content;
}

// GAP-HSg03: Sigilo com tooltip integrado
interface SigilWithTooltipProps extends SigilProps {
  type: 'user' | 'seller';
}

export function Sigil({ type, ...props }: SigilWithTooltipProps) {
  const tooltipText = type === 'user' 
    ? 'Perfil pessoal' 
    : 'Perfil de vendedor';
  
  const Component = type === 'user' ? UserSigil : SellerSigil;
  
  return (
    <Component 
      {...props} 
      tooltip={props.tooltip || tooltipText} 
    />
  );
}

// GAP-HSg03: Sigilo com badge de verificação
interface VerifiedSigilProps extends SigilProps {
  type: 'user' | 'seller';
  verified?: boolean;
}

export function VerifiedSigil({ type, verified = false, ...props }: VerifiedSigilProps) {
  const Component = type === 'user' ? UserSigil : SellerSigil;
  
  return (
    <div className="inline-flex items-center gap-1">
      <Component {...props} />
      {verified && (
        <span 
          className="text-primary text-xs" 
          aria-label="Verificado"
          title="Perfil verificado"
        >
          ✓
        </span>
      )}
    </div>
  );
}