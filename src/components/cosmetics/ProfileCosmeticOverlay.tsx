// Aplica banner e accent do loadout global de um perfil de usuário.
// Mostra um botão flutuante para alternar entre versão customizada e padrão.
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useUserLoadout } from '@/hooks/useCosmetics';
import { Sparkles, EyeOff, User, Loader2, Sliders, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';

// GAP-PCO01: Validações
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

// GAP-PCO02: Chave para localStorage
const getVisibilityKey = (ownerId?: string | null) =>
  `profile-cosmetic-${ownerId || 'self'}`;

// GAP-PCO09: Chave para intensidade
const getIntensityKey = (ownerId?: string | null) =>
  `profile-cosmetic-intensity-${ownerId || 'self'}`;

interface Props {
  ownerId: string | null | undefined;
  hideToggle?: boolean;
  forceDefault?: boolean;
  /** GAP-PCO05: Nome do dono para exibir */
  ownerName?: string | null;
  /** GAP-PCO05: Se é o próprio perfil */
  isOwnProfile?: boolean;
}

export function ProfileCosmeticOverlay({
  ownerId,
  hideToggle,
  forceDefault,
  ownerName,
  isOwnProfile = false,
}: Props) {
  const { rows, loading } = useUserLoadout(ownerId);
  const [fadeState, setFadeState] = useState<'in' | 'out'>('in');

  // GAP-PCO02: Persistência da preferência
  const [visible, setVisible] = useState(() => {
    if (forceDefault) return false;
    if (typeof window === 'undefined') return true;
    try {
      const saved = localStorage.getItem(getVisibilityKey(ownerId));
      return saved !== null ? saved === 'true' : true;
    } catch { return true; }
  });

  // GAP-PCO09: Intensidade do overlay
  const [intensity, setIntensity] = useState(() => {
    if (typeof window === 'undefined') return 60;
    try {
      const saved = localStorage.getItem(getIntensityKey(ownerId));
      return saved !== null ? parseInt(saved, 10) : 60;
    } catch { return 60; }
  });

  // GAP-PCO06: Múltiplos loadouts salvos
  const [savedLoadouts, setSavedLoadouts] = useState<Record<string, any>>({});
  const [currentLoadoutIndex, setCurrentLoadoutIndex] = useState(0);

  const banner = rows.find(r => r.slot === 'profile_banner')?.reward;
  const accent = rows.find(r => r.slot === 'profile_accent')?.reward;
  const stickers = rows.filter(r => r.slot.startsWith('sticker_')).map(r => r.reward).filter(Boolean);

  // GAP-PCO03: Fallback para cor inválida
  const accentColor = useMemo(() => {
    const color = accent?.payload?.color;
    return isValidHex(color) ? color : '#A855F7';
  }, [accent]);

  // GAP-PCO01: Sanitização do style injection
  const styleContent = useMemo(() => {
    if (!visible || !accent?.payload?.color) return '';
    const color = isValidHex(accent.payload.color) ? hexToHsl(accent.payload.color) : '174 72% 41%';
    return `[data-profile-cosmetic="${ownerId}"] { --primary: ${color}; }`;
  }, [visible, accent, ownerId]);

  // GAP-PCO04: Toggle com animação
  const toggleVisibility = useCallback(() => {
    setFadeState('out');
    setTimeout(() => {
      setVisible(v => {
        const next = !v;
        localStorage.setItem(getVisibilityKey(ownerId), String(next));
        return next;
      });
      setFadeState('in');
    }, 200);
  }, [ownerId]);

  // GAP-PCO09: Salvar intensidade
  const handleIntensityChange = useCallback((value: number[]) => {
    const newValue = value[0];
    setIntensity(newValue);
    localStorage.setItem(getIntensityKey(ownerId), String(newValue));
  }, [ownerId]);

  // GAP-PCO07: Loading state
  if (loading) {
    return (
      <div className="fixed inset-x-0 top-0 h-40 z-0 pointer-events-none bg-muted/20 animate-pulse" />
    );
  }

  if (!banner && !accent && stickers.length === 0) return null;

  const hasCosmetics = !!(banner || accent || stickers.length > 0);
  const showOwner = ownerName && !isOwnProfile;

  return (
    <>
      {/* GAP-PCO05: Indicador de dono */}
      {showOwner && visible && (
        <div className="fixed left-4 top-4 z-40 flex items-center gap-1.5 text-[10px] text-muted-foreground bg-card/80 backdrop-blur px-2.5 py-1 rounded-full border border-border">
          <User className="h-3 w-3" />
          Perfil de <span className="font-semibold text-foreground">{ownerName}</span>
        </div>
      )}

      {/* GAP-PCO09: Controle de intensidade */}
      {visible && hasCosmetics && !hideToggle && (
        <div className="fixed left-4 bottom-28 sm:bottom-16 z-40 flex items-center gap-2 bg-card/80 backdrop-blur border border-border rounded-full px-3 py-1.5 shadow-lg">
          <Sliders className="h-3.5 w-3.5 text-muted-foreground" />
          <Slider
            value={[intensity]}
            onValueChange={handleIntensityChange}
            min={10}
            max={90}
            step={5}
            className="w-20 h-1.5"
          />
          <span className="text-[9px] text-muted-foreground w-6">{intensity}%</span>
        </div>
      )}

      {/* Botão toggle — com GAP-PCO04: animação */}
      {hasCosmetics && !hideToggle && (
        <button
          onClick={toggleVisibility}
          className={cn(
            "fixed left-3 bottom-20 sm:bottom-4 z-50 px-3 py-2 rounded-full",
            "bg-card/95 backdrop-blur border border-border shadow-lg",
            "text-xs font-semibold flex items-center gap-1.5 hover:border-primary transition-all duration-200"
          )}
          title={visible ? 'Ver perfil sem customização' : 'Ver customização'}
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
        </button>
      )}

      {/* GAP-PCO04: Fade transition nos elementos visuais */}
      <div className={cn(
        "transition-opacity duration-300",
        fadeState === 'in' ? "opacity-100" : "opacity-0"
      )}>
        {visible && banner && (
          <div
            className="fixed inset-x-0 top-0 h-40 z-0 pointer-events-none"
            style={{
              opacity: intensity / 100,
              background: banner.asset_url
                ? `center/cover url(${banner.asset_url})`
                : `linear-gradient(135deg, ${accentColor}, transparent)`,
              maskImage: 'linear-gradient(to bottom, black, transparent)',
              WebkitMaskImage: 'linear-gradient(to bottom, black, transparent)',
            }}
          />
        )}

        {/* GAP-PCO01: Sanitização antes de injetar */}
        {visible && isValidHex(accent?.payload?.color) && isValidUuid(ownerId) && (
          <style dangerouslySetInnerHTML={{ __html: styleContent }} />
        )}

        {visible && stickers.length > 0 && (
          <div className="fixed right-3 top-24 z-30 space-y-2 pointer-events-none">
            {stickers.slice(0, 3).map((s, i) => (
              <div
                key={s!.id}
                className="w-12 h-12 rounded-xl bg-card/80 backdrop-blur border border-border flex items-center justify-center text-2xl shadow"
                style={{ transform: `rotate(${(i - 1) * 6}deg)` }}
              >
                {s!.asset_url ? (
                  <img
                    src={s!.asset_url}
                    alt=""
                    className="w-full h-full object-cover rounded-xl"
                    loading="lazy"
                    onError={(e) => {
                      // GAP-PCO08: Fallback silencioso para asset quebrado
                      (e.target as HTMLImageElement).style.display = 'none';
                      const parent = (e.target as HTMLImageElement).parentElement;
                      if (parent) {
                        const fallback = document.createElement('span');
                        fallback.textContent = s!.payload?.emoji || '✨';
                        fallback.className = 'text-2xl';
                        parent.appendChild(fallback);
                      }
                    }}
                  />
                ) : (
                  s!.payload?.emoji || '✨'
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* GAP-PCO10: Mini-preview (hover) */}
      {visible && hasCosmetics && !hideToggle && (
        <div className="fixed right-4 bottom-4 z-40 opacity-40 hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-1 text-[8px] text-muted-foreground bg-card/60 backdrop-blur px-2 py-1 rounded-full border border-border">
            <span className="w-2 h-2 rounded-full" style={{ background: accentColor }} />
            <span>Personalizado</span>
          </div>
        </div>
      )}
    </>
  );
}