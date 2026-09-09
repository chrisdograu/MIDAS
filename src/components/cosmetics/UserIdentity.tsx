// Versão "leve" do cosmético: moldura no avatar + indicador
// de cor do accent ao lado do nome. Usada em chat, fórum e reviews.
import { Link } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { useUserLoadout } from '@/hooks/useCosmetics';
import { AvatarWithFrame } from './AvatarWithFrame';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';

const HEX = /^#[0-9a-fA-F]{6}$/;

// ─── HOOKS ────────────────────────────────────────────────────────────────────

// GAP-UI01: Validação de cor com loading state
export function useLightAccentColor(userId?: string | null) {
  const { rows, loading } = useUserLoadout(userId || null);
  const color = rows.find(r => r.slot === 'profile_accent')?.reward?.payload?.color;
  const isValid = typeof color === 'string' && HEX.test(color);
  return { color: isValid ? color : null, loading };
}

// GAP-UI04: Verificar se tem cosmético equipado
export function useHasCosmetics(userId?: string | null) {
  const { rows, loading } = useUserLoadout(userId || null);
  const hasBanner = rows.some(r => r.slot === 'profile_banner' && r.reward_id);
  const hasAccent = rows.some(r => r.slot === 'profile_accent' && r.reward_id);
  const hasStickers = rows.some(r => r.slot.startsWith('sticker_') && r.reward_id);
  return { hasCosmetics: hasBanner || hasAccent || hasStickers, loading };
}

// GAP-UI10: Verificar se o vendedor é visível publicamente
export function useSellerVisibility(userId?: string | null) {
  const [isVisible, setIsVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const checkSellerVisibility = async () => {
      try {
        const { data, error } = await supabase
          .from('seller_profiles')
          .select('is_public')
          .eq('user_id', userId)
          .maybeSingle();

        // Só mostra o selo se o perfil de vendedor existe E é público
        setIsVisible(data?.is_public === true && !error);
      } catch {
        setIsVisible(false);
      } finally {
        setLoading(false);
      }
    };

    checkSellerVisibility();
  }, [userId]);

  return { isVisible, loading };
}

// GAP-UI06: Tamanhos de dot
type DotSize = 'sm' | 'md' | 'lg';

const DOT_SIZES: Record<DotSize, string> = {
  sm: 'h-1.5 w-1.5',
  md: 'h-2 w-2',
  lg: 'h-2.5 w-2.5',
};

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

interface Props {
  userId?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
  size?: number;
  to?: string;
  className?: string;
  nameClassName?: string;
  subtitle?: React.ReactNode;
  /** GAP-UI06: Tamanho do dot de cor */
  dotSize?: DotSize;
  /** GAP-UI09: Mostrar status online */
  showOnline?: boolean;
  /** GAP-UI10: Mostrar badge de vendedor (controlado por visibilidade) */
  showSellerBadge?: boolean; // ← agora é controlado pelo hook, não por prop manual
  /** GAP-UI04: Mostrar badge de cosmético */
  showCosmeticBadge?: boolean;
}

export function UserIdentity({
  userId,
  name,
  avatarUrl,
  size = 32,
  to,
  className,
  nameClassName,
  subtitle,
  dotSize = 'md',
  showOnline = false,
  showCosmeticBadge = false,
}: Props) {
  const { color, loading: accentLoading } = useLightAccentColor(userId);
  const { hasCosmetics, loading: cosmeticLoading } = useHasCosmetics(userId);
  const { isVisible: showSeller, loading: sellerLoading } = useSellerVisibility(userId);
  const [avatarError, setAvatarError] = useState(false);
  const [mounted, setMounted] = useState(false);

  const label = name || 'Usuário';
  const isLoading = accentLoading || cosmeticLoading || sellerLoading;

  // GAP-UI05: Animação de entrada
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // GAP-UI08: IntersectionObserver para lazy loading do avatar
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  // ─── Conteúdo ──────────────────────────────────────────────────────────────

  const content = (
    <span
      ref={ref}
      className={cn(
        'flex items-center gap-2 min-w-0 transition-opacity duration-300',
        mounted ? 'opacity-100' : 'opacity-0',
        className
      )}
    >
      {/* Avatar com frame */}
      <AvatarWithFrame
        userId={userId}
        src={avatarError ? null : avatarUrl}
        fallback={label.charAt(0).toUpperCase()}
        size={size}
        showOnline={showOnline}
      />

      <span className="min-w-0">
        <span className="flex items-center gap-1.5 min-w-0">
          {/* Nome */}
          {isLoading ? (
            <Skeleton className="h-4 w-20" />
          ) : (
            <span className={cn('truncate text-sm font-medium text-foreground', nameClassName)}>
              {label}
            </span>
          )}

          {/* GAP-UI10: Indicador de vendedor — só aparece se o perfil de vendedor for público */}
          {!isLoading && showSeller && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded cursor-help">
                    $
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Este usuário também é vendedor</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* GAP-UI03: Dot de cor com tooltip */}
          {!isLoading && color && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    aria-hidden
                    className={cn(
                      'rounded-full shrink-0 transition-all duration-300',
                      DOT_SIZES[dotSize]
                    )}
                    style={{
                      background: color,
                      boxShadow: `0 0 8px ${color}66`,
                    }}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Accent personalizado</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* GAP-UI04: Badge de cosmético */}
          {showCosmeticBadge && !isLoading && hasCosmetics && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-[8px] bg-primary/10 text-primary px-1 py-0.5 rounded-full cursor-help">
                    ✨
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Este perfil tem cosméticos equipados</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </span>

        {/* Subtitle */}
        {subtitle && (
          <span className="block text-[11px] text-muted-foreground truncate">
            {subtitle}
          </span>
        )}
      </span>
    </span>
  );

  // GAP-UI07: Fallback para avatar quebrado
  const handleAvatarError = () => setAvatarError(true);

  if (to) {
    return (
      <Link to={to} className="inline-flex min-w-0 hover:opacity-90 transition-opacity">
        {content}
      </Link>
    );
  }

  return content;
}

export default UserIdentity;