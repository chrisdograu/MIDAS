// Simulador de página de jogo para o Admin de recompensas.
// Mostra como o GameDetail ficaria com banner/theme/skin/stickers aplicados.
import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GameReward, RARITY_COLOR } from '@/hooks/useCosmetics';
import { CosmeticPreview } from './CosmeticPreview';
import SelectSimples from '@/components/SelectSimples';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { Smartphone, Monitor, Share2, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

const SLOT_OPTIONS: { slot: string; label: string; kinds: GameReward['kind'][] }[] = [
  { slot: 'banner', label: 'Banner', kinds: ['profile_banner', 'game_page_theme'] },
  { slot: 'theme', label: 'Tema', kinds: ['game_page_theme', 'profile_accent'] },
  { slot: 'card_skin', label: 'Card skin', kinds: ['game_card_skin'] },
  { slot: 'sticker_1', label: 'Adesivo 1', kinds: ['sticker', 'character_icon'] },
  { slot: 'sticker_2', label: 'Adesivo 2', kinds: ['sticker', 'character_icon'] },
];

// GAP-P002: Chave para localStorage
const STORAGE_KEY = 'gamepage-preview-state';

interface Props { productId: string; rewards: GameReward[]; }

export function GamePagePreviewSimulator({ productId, rewards }: Props) {
  const [product, setProduct] = useState<{ title: string; image_url: string | null; publisher: string | null } | null>(null);
  // GAP-P002: Estado persistido no localStorage
  const [picks, setPicks] = useState<Record<string, string>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}-${productId}`);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  // GAP-P001: View mode
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
  // GAP-P004: Comparação
  const [showComparison, setShowComparison] = useState(false);
  // GAP-P003: Copiar link
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!productId) return;
    supabase.from('produtos').select('title,image_url,publisher').eq('id', productId).maybeSingle()
      .then(({ data }) => setProduct(data as any));
  }, [productId]);

  // GAP-P002: Salvar no localStorage quando mudar
  useEffect(() => {
    if (productId && Object.keys(picks).length > 0) {
      localStorage.setItem(`${STORAGE_KEY}-${productId}`, JSON.stringify(picks));
    }
  }, [picks, productId]);

  const slotPick = (slot: string) => rewards.find(r => r.id === picks[slot]) || null;
  const banner = slotPick('banner');
  const theme = slotPick('theme');
  const stickers = ['sticker_1', 'sticker_2'].map(slotPick).filter(Boolean) as GameReward[];

  const themeColor = theme?.payload?.color || '#14B8A6';
  const optionsFor = (slot: typeof SLOT_OPTIONS[number]) =>
    rewards.filter(r => slot.kinds.includes(r.kind) && r.is_active);

  // GAP-P003: Gerar link de compartilhamento
  const generateShareLink = useCallback(() => {
    const params = new URLSearchParams();
    Object.entries(picks).forEach(([slot, id]) => {
      if (id) params.append(slot, id);
    });
    const url = `${window.location.origin}/jogo/${productId}?preview=${params.toString()}`;
    return url;
  }, [picks, productId]);

  const handleCopyLink = async () => {
    const url = generateShareLink();
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Link copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  if (!productId) return null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2">🖼️ Simulador da página do jogo</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Escolha recompensas para ver como ficaria o GameDetail.</p>
          </div>

          {/* GAP-P001: Toggle mobile/desktop */}
          <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as any)} className="h-7">
            <ToggleGroupItem value="desktop" className="h-7 px-2 text-xs">
              <Monitor className="h-3.5 w-3.5 mr-1" /> Desktop
            </ToggleGroupItem>
            <ToggleGroupItem value="mobile" className="h-7 px-2 text-xs">
              <Smartphone className="h-3.5 w-3.5 mr-1" /> Mobile
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
          {SLOT_OPTIONS.map(s => {
            const opts = optionsFor(s);
            return (
              <div key={s.slot}>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</label>
                <SelectSimples
                  value={picks[s.slot] || '__vazio__'}
                  onChange={v => setPicks(p => ({ ...p, [s.slot]: v === '__vazio__' ? '' : v }))}
                  size="sm"
                  label={s.label}
                  className="w-full mt-0.5"
                  options={[
                    { value: '__vazio__', label: '— vazio —' },
                    ...opts.map(o => ({
                      value: o.id,
                      label: `${o.name} (${o.rarity})`,
                    })),
                  ]}
                />
              </div>
            );
          })}
        </div>

        {/* GAP-P004: Botão de comparação */}
        <div className="flex gap-2 mt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowComparison(!showComparison)}
            className="text-xs h-7"
          >
            {showComparison ? 'Ocultar comparação' : 'Comparar original'}
          </Button>

          {/* GAP-P003: Botão de compartilhar */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            className="text-xs h-7"
          >
            {copied ? <Check className="h-3 w-3 mr-1" /> : <Share2 className="h-3 w-3 mr-1" />}
            {copied ? 'Copiado!' : 'Compartilhar'}
          </Button>
        </div>
      </div>

      {/* Preview */}
      <div className={cn(
        "relative transition-all duration-500",
        viewMode === 'mobile' ? "max-w-[375px] mx-auto" : "w-full"
      )} style={{ minHeight: viewMode === 'mobile' ? 500 : 280 }}>
        {showComparison && (
          <div className="absolute inset-0 opacity-30 pointer-events-none">
            {/* Versão original (sem cosméticos) — cinza */}
            <div className="w-full h-full bg-gradient-to-b from-muted/50 to-transparent" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs text-muted-foreground bg-card/80 px-3 py-1 rounded-full">
                Versão original
              </span>
            </div>
          </div>
        )}

        {/* Banner overlay com animação GAP-P005 */}
        {banner && (
          <div
            className="absolute inset-x-0 top-0 h-40 pointer-events-none transition-all duration-700"
            style={{
              background: banner.asset_url
                ? `center/cover url(${banner.asset_url})`
                : `linear-gradient(135deg, ${banner.payload?.color || themeColor}, transparent)`,
              maskImage: 'linear-gradient(to bottom, black, transparent)',
              WebkitMaskImage: 'linear-gradient(to bottom, black, transparent)',
            }}
          />
        )}

        {/* Stickers com animação GAP-P005 */}
        {stickers.length > 0 && (
          <div className={cn(
            "absolute right-3 top-3 space-y-2 z-10 pointer-events-none transition-all duration-500",
            viewMode === 'mobile' && "top-2 right-2"
          )}>
            {stickers.map((s, i) => (
              <div
                key={s.id}
                className={cn(
                  "rounded-xl bg-card/80 backdrop-blur border border-border flex items-center justify-center shadow transition-all duration-300 hover:scale-110",
                  viewMode === 'mobile' ? "w-8 h-8 text-base" : "w-10 h-10 text-xl"
                )}
                style={{ transform: `rotate(${(i - 1) * 6}deg)` }}
              >
                {s.asset_url ? (
                  <img src={s.asset_url} alt="" className="w-full h-full object-cover rounded-xl" loading="lazy" />
                ) : (
                  s.payload?.emoji || '✨'
                )}
              </div>
            ))}
          </div>
        )}

        {/* Content com GAP-P005: animação */}
        <div className={cn(
          "relative p-5 flex gap-4 items-start z-[1] transition-all duration-500",
          viewMode === 'mobile' && "flex-col items-center p-3"
        )}>
          {/* Cover */}
          <div
            className={cn(
              "relative rounded-lg overflow-hidden border-2 shrink-0 transition-all duration-500",
              viewMode === 'mobile' ? "w-24 h-34" : "w-28 h-40"
            )}
            style={{ borderColor: themeColor }}
          >
            {product?.image_url ? (
              <img src={product.image_url} alt={product.title} className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <div className="w-full h-full bg-muted" />
            )}
            {slotPick('card_skin') && (
              <div
                className="absolute inset-0 pointer-events-none mix-blend-overlay transition-opacity duration-700"
                style={{
                  background: `linear-gradient(135deg, ${slotPick('card_skin')?.payload?.color || themeColor}66, transparent 60%)`,
                }}
              />
            )}
            {/* GAP-P005: Badge de raridade animado */}
            {slotPick('card_skin') && (
              <Badge
                className={cn(
                  "absolute bottom-1 left-1 text-[8px] px-1.5 py-0 transition-all duration-500",
                  RARITY_COLOR[slotPick('card_skin')!.rarity]
                )}
              >
                {slotPick('card_skin')!.rarity}
              </Badge>
            )}
          </div>

          <div className={cn(
            "flex-1 min-w-0",
            viewMode === 'mobile' && "text-center"
          )}>
            <div
              className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-1.5 transition-colors duration-300"
              style={{ background: `${themeColor}22`, color: themeColor }}
            >
              ✨ preview ao vivo
            </div>
            <h4 className={cn("font-display font-bold truncate transition-all duration-300", viewMode === 'mobile' ? "text-base" : "text-lg")}>
              {product?.title || 'Jogo'}
            </h4>
            <p className="text-xs text-muted-foreground truncate">{product?.publisher || '—'}</p>
            <div
              className={cn(
                "mt-3 inline-flex px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-300",
                viewMode === 'mobile' && "px-2.5 py-1 text-[11px]"
              )}
              style={{ background: themeColor, color: '#fff' }}
            >
              Comprar
            </div>
          </div>
        </div>

        {/* Equipped chips com animação GAP-P005 */}
        {(banner || theme || stickers.length > 0 || slotPick('card_skin')) && (
          <div className="px-4 pb-4 flex flex-wrap gap-2 transition-all duration-500">
            {[banner, theme, slotPick('card_skin'), ...stickers].filter(Boolean).map((r, i) => (
              <div
                key={(r as GameReward).id + i}
                className="flex items-center gap-1.5 text-[10px] bg-secondary/60 px-2 py-1 rounded-full transition-all duration-300 hover:bg-secondary"
              >
                <CosmeticPreview reward={r as GameReward} size={18} />
                {(r as GameReward).name}
              </div>
            ))}
          </div>
        )}

        {/* GAP-P005: Indicador de mudança */}
        {Object.values(picks).some(v => v) && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[8px] text-muted-foreground bg-card/80 px-2 py-0.5 rounded-full">
            Preview em tempo real
          </div>
        )}
      </div>
    </div>
  );
}