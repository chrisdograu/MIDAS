// Renderiza a "casca cosmética" de uma página de jogo, baseada no loadout do dono.
// Mostra um botão flutuante à esquerda para alternar entre VISUAL PERSONALIZADO e PADRÃO.
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useGamePageLoadout } from '@/hooks/useCosmetics';
import { Sparkles, EyeOff, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface Props {
  ownerId?: string | null;
  productId: string;
  forceDefault?: boolean;
  /** GAP-O005: Nome do dono para exibir */
  ownerName?: string | null;
}

// GAP-O001: Validações
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function isValidHex(v: unknown): v is string {
  return typeof v === 'string' && HEX_RE.test(v);
}
function isValidUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

function hexToHsl(hex: string): string {
  const m = hex.replace('#', '').match(/.{2}/g);
  if (!m) return '174 72% 41%';
  const [r, g, b] = m.map(x => parseInt(x, 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// GAP-O004: Chave para localStorage
const getVisibilityKey = (productId: string, ownerId?: string | null) =>
  `cosmetic-overlay-${productId}-${ownerId || 'self'}`;

export function GamePageCosmeticOverlay({
  ownerId,
  productId,
  forceDefault,
  ownerName,
}: Props) {
  const { rows, loading } = useGamePageLoadout(ownerId || null, productId);

  // GAP-O004: Persistência da preferência do usuário
  const [visible, setVisible] = useState(() => {
    if (forceDefault) return false;
    if (typeof window === 'undefined') return true;
    try {
      const saved = localStorage.getItem(getVisibilityKey(productId, ownerId));
      return saved !== null ? saved === 'true' : true;
    } catch { return true; }
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(getVisibilityKey(productId, ownerId));
      setVisible(!forceDefault && (saved === null || saved === 'true'));
    } catch { setVisible(!forceDefault); }
  }, [productId, ownerId, forceDefault]);

  const banner = rows.find(r => r.slot === 'banner')?.reward;
  const theme = rows.find(r => r.slot === 'theme')?.reward;
  const stickers = rows.flatMap(r => r.slot.startsWith('sticker_') && r.reward ? [r.reward] : []);

  // GAP-O002: Fade transition
  const [fadeState, setFadeState] = useState<'in' | 'out'>('in');

  const toggleVisibility = useCallback(() => {
    setFadeState('out');
    setTimeout(() => {
      setVisible(v => {
        const next = !v;
        try { localStorage.setItem(getVisibilityKey(productId, ownerId), String(next)); } catch { /* Preference storage may be unavailable. */ }
        return next;
      });
      setFadeState('in');
    }, 200);
  }, [productId, ownerId]);

  // GAP-O003: Fallback para cor inválida
  const themeColor = useMemo(() => {
    const color = theme?.payload?.color;
    return isValidHex(color) ? color : '#14B8A6';
  }, [theme]);

  // GAP-O005: Indicador de dono
  const showOwner = ownerId && ownerName;

  // GAP-O001: Sanitização do style injection
  const styleContent = useMemo(() => {
    if (!visible || !theme?.payload?.color) return '';
    const color = isValidHex(theme.payload.color) ? hexToHsl(theme.payload.color) : '174 72% 41%';
    return `[data-game-cosmetic="${productId}"] { --primary: ${color}; }`;
  }, [visible, theme, productId]);

  if (!banner && !theme && stickers.length === 0 && !loading) return null;

  const hasCosmetics = !!(banner || theme || stickers.length > 0);

  return (
    <>
      {/* GAP-O005: Indicador de dono */}
      {showOwner && visible && (
        <div className="fixed left-4 top-4 z-40 flex items-center gap-1.5 text-[10px] text-muted-foreground bg-card/80 backdrop-blur px-2.5 py-1 rounded-full border border-border">
          <User className="h-3 w-3" />
          Personalizado por <span className="font-semibold text-foreground">{ownerName}</span>
        </div>
      )}

      {/* Botão toggle — com GAP-O002: fade */}
      {hasCosmetics && !forceDefault && (
        <Button variant="ghost"
          onClick={toggleVisibility}
          className={cn(
            "fixed left-3 bottom-20 sm:bottom-4 z-40 px-3 py-2 rounded-full",
            "bg-card/95 backdrop-blur border border-border shadow-lg",
            "text-xs font-semibold flex items-center gap-1.5 hover:border-primary transition",
            "duration-200"
          )}
          title={visible ? 'Ver página sem customização' : 'Ver customização do dono'}
        >
          {visible ? (
            <>
              <EyeOff className="h-3.5 w-3.5" />
              Versão padrão
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Customização
            </>
          )}
        </Button>
      )}

      {/* GAP-O002: Fade transition nos elementos visuais */}
      <div className={cn(
        "transition-opacity duration-300",
        fadeState === 'in' ? "opacity-100" : "opacity-0"
      )}>
        {visible && banner && (
          <div
            className="fixed inset-x-0 top-0 h-40 z-0 pointer-events-none opacity-60"
            style={{
              background: banner.asset_url
                ? `center/cover url(${banner.asset_url})`
                : `linear-gradient(135deg, ${themeColor}, transparent)`,
              maskImage: 'linear-gradient(to bottom, black, transparent)',
              WebkitMaskImage: 'linear-gradient(to bottom, black, transparent)',
            }}
          />
        )}

        {/* GAP-O001: Sanitização antes de injetar */}
        {visible && isValidHex(theme?.payload?.color) && isValidUuid(productId) && (
          <style dangerouslySetInnerHTML={{ __html: styleContent }} />
        )}

        {visible && stickers.length > 0 && (
          <div className="fixed right-3 top-24 z-30 space-y-2 pointer-events-none">
            {stickers.slice(0, 3).map((s, i) => (
              <div
                key={s.id}
                className="w-12 h-12 rounded-xl bg-card/80 backdrop-blur border border-border flex items-center justify-center text-2xl shadow"
                style={{ transform: `rotate(${(i - 1) * 6}deg)` }}
              >
                {s.asset_url ? (
                  <img
                    src={s.asset_url}
                    alt=""
                    className="w-full h-full object-cover rounded-xl"
                    loading="lazy"
                    onError={(e) => {
                      // GAP-O009: Fallback silencioso para asset quebrado
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  s.payload?.emoji || '✨'
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}