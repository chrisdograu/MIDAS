import { NavLink as RouterNavLink, NavLinkProps } from "react-router-dom";
import { forwardRef, useState, useEffect, useRef, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { usePrefetchRoute } from "@/hooks/usePrefetchRoute";

interface NavLinkCompatProps extends Omit<NavLinkProps, "className"> {
  className?: string;
  activeClassName?: string;
  pendingClassName?: string;
  /** GAP-NL01: Pré-carregar a rota no hover */
  prefetch?: boolean;
  /** GAP-NL02: Ícone à esquerda ou direita */
  icon?: ReactNode;
  /** GAP-NL02: Posição do ícone */
  iconPosition?: 'left' | 'right';
  /** GAP-NL03: Badge com contador */
  badge?: number | string;
  /** GAP-NL03: Cor do badge */
  badgeColor?: 'default' | 'primary' | 'destructive' | 'success';
  /** GAP-NL04: Match exato da rota */
  end?: boolean;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ 
    className, 
    activeClassName = 'text-primary font-semibold',
    pendingClassName = 'opacity-50',
    to, 
    prefetch = false,
    icon,
    iconPosition = 'left',
    badge,
    badgeColor = 'primary',
    end = false,
    children,
    ...props 
  }, ref) => {
    const prefetchRoute = usePrefetchRoute();
    const [isVisible, setIsVisible] = useState(false);
    const linkRef = useRef<HTMLAnchorElement>(null);

    // GAP-NL01: Prefetch no hover ou quando visível
    useEffect(() => {
      if (!prefetch || !linkRef.current) return;

      const handleMouseEnter = () => {
        if (typeof to === 'string') {
          prefetchRoute(to);
        }
      };

      const link = linkRef.current;
      link.addEventListener('mouseenter', handleMouseEnter);
      
      // GAP-NL01: IntersectionObserver para prefetch quando visível
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && !isVisible) {
            setIsVisible(true);
            if (typeof to === 'string') {
              prefetchRoute(to);
            }
          }
        },
        { rootMargin: '100px' }
      );
      
      observer.observe(link);

      return () => {
        link.removeEventListener('mouseenter', handleMouseEnter);
        observer.disconnect();
      };
    }, [prefetch, to, prefetchRoute, isVisible]);

    // GAP-NL03: Cores do badge
    const badgeColors = {
      default: 'bg-muted text-muted-foreground',
      primary: 'bg-primary text-primary-foreground',
      destructive: 'bg-destructive text-destructive-foreground',
      success: 'bg-green-500 text-white',
    };

    const renderContent = (isActive: boolean, isPending: boolean) => {
      const iconElement = icon && (
        <span className={cn(
          "shrink-0",
          isActive ? "text-primary" : "text-muted-foreground",
          iconPosition === 'left' ? "order-first" : "order-last"
        )}>
          {icon}
        </span>
      );

      const badgeElement = badge && (
        <span className={cn(
          "ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold min-w-[18px] text-center",
          badgeColors[badgeColor],
          isActive && "ring-2 ring-primary/30"
        )}>
          {badge}
        </span>
      );

      return (
        <span className="inline-flex items-center gap-1.5">
          {iconPosition === 'left' && iconElement}
          {children as React.ReactNode}
          {badgeElement}
          {iconPosition === 'right' && iconElement}
        </span>
      );
    };

    return (
      <RouterNavLink
        ref={(node) => {
          // @ts-ignore - forwardRef com node
          if (typeof ref === 'function') ref(node);
          else if (ref && 'current' in ref) ref.current = node;
          linkRef.current = node;
        }}
        to={to}
        className={({ isActive, isPending }) =>
          cn(
            className, 
            isActive && activeClassName, 
            isPending && pendingClassName
          )
        }
        end={end}
        {...props}
      >
        {({ isActive, isPending }) => renderContent(isActive, isPending)}
      </RouterNavLink>
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };

// GAP-NL01: NavLink com prefetch automático
export function NavLinkPrefetch(props: NavLinkCompatProps) {
  return <NavLink {...props} prefetch={true} />;
}

// GAP-NL03: NavLink com badge de notificação
export function NavLinkWithBadge({ badge, ...props }: NavLinkCompatProps) {
  return <NavLink {...props} badge={badge} />;
}