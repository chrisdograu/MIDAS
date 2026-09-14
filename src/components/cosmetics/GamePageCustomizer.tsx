// Modal lateral para o dono da biblioteca personalizar a página de um jogo.
// Permite escolher banner/theme/skin/stickers a partir de QUALQUER reward desbloqueado.
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  useMyCosmeticInventory,
  useGamePageLoadout,
  equipGamePageSlot,
  RARITY_COLOR,
  RARITY_ORDER,
  RewardKind,
  GameReward,
} from '@/hooks/useCosmetics';
import { CosmeticPreview } from './CosmeticPreview';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { toast } from 'sonner';
import { X, Sparkles, Loader2, CheckCircle2, RotateCcw, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

const PAGE_SLOTS: { slot: string; label: string; kinds: RewardKind[]; icon: string }[] = [
  { slot: 'banner', label: 'Banner da página', kinds: ['profile_banner', 'game_page_theme'], icon: '🖼️' },
  { slot: 'theme', label: 'Tema visual', kinds: ['game_page_theme', 'profile_accent'], icon: '🎨' },
  { slot: 'card_skin', label: 'Skin do card', kinds: ['game_card_skin'], icon: '💳' },
  { slot: 'sticker_1', label: 'Adesivo 1', kinds: ['sticker', 'character_icon'], icon: '📍' },
  { slot: 'sticker_2', label: 'Adesivo 2', kinds: ['sticker', 'character_icon'], icon: '📍' },
  { slot: 'sticker_3', label: 'Adesivo 3', kinds: ['sticker', 'character_icon'], icon: '📍' },
];

// GAP-C006: Contador de slots ocupados
const getOccupiedCount = (loadout: any[]) => loadout.filter(l => l.reward_id).length;
const TOTAL_SLOTS = PAGE_SLOTS.length;

// GAP-C007: Historico de ações para undo
interface HistoryEntry {
  slot: string;
  previousId: string | null;
  newId: string | null;
}

export function GamePageCustomizer({
  productId,
  open,
  onOpenChange,
}: { productId: string; open: boolean; onOpenChange: (b: boolean) => void }) {
  const { user } = useAuth();
  const { rows: inventory, loading: inventoryLoading } = useMyCosmeticInventory();
  const { rows: loadout, reload, loading: loadoutLoading } = useGamePageLoadout(user?.id, productId);
  
  // GAP-C003: Persistência do slot ativo
  const [activeSlot, setActiveSlot] = useState<string>('banner');
  const [equipping, setEquipping] = useState<string | null>(null);
  // GAP-C007: Histórico para undo
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  // GAP-C008: Sincronização em tempo real
  const [realtimeVersion, setRealtimeVersion] = useState(0);

  // GAP-C008: Realtime subscription
  useEffect(() => {
    if (!user || !productId || !open) return;

    const channel = supabase
      .channel(`gamepage-custom-${productId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_page_loadout',
          filter: `product_id=eq.${productId}`,
        },
        () => {
          setRealtimeVersion(v => v + 1);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, productId, open]);

  // Recarregar quando mudar em tempo real
  useEffect(() => {
    if (realtimeVersion > 0) reload();
  }, [realtimeVersion]);

  const slotMeta = useMemo(() => PAGE_SLOTS.find(s => s.slot === activeSlot)!, [activeSlot]);

  // GAP-C005: Ordenação por raridade e recência
  const eligible = useMemo(() => {
    const items = inventory.filter(r => slotMeta.kinds.includes(r.reward.kind));
    return [...items].sort((a, b) => {
      // Primeiro por raridade (legendary > epic > rare > ...)
      const rarityDiff = (RARITY_ORDER[b.reward.rarity] || 0) - (RARITY_ORDER[a.reward.rarity] || 0);
      if (rarityDiff !== 0) return rarityDiff;
      // Depois por nome
      return a.reward.name.localeCompare(b.reward.name);
    });
  }, [inventory, slotMeta.kinds]);

  const equippedId = (slot: string) => loadout.find(l => l.slot === slot)?.reward_id;

  // GAP-C002: Verificar se um cosmético está equipado em outro slot
  const isEquippedElsewhere = (rewardId: string, currentSlot: string) => {
    return loadout.some(l => l.reward_id === rewardId && l.slot !== currentSlot);
  };

  // GAP-C004: Loading state
  const isLoading = inventoryLoading || loadoutLoading || equipping !== null;

  const equip = useCallback(async (rewardId: string | null) => {
    if (!user || equipping) return;

    const cur = equippedId(activeSlot);
    const next = rewardId === cur ? null : rewardId;

    // GAP-C007: Salvar no histórico antes de alterar
    setHistory(prev => [...prev, { slot: activeSlot, previousId: cur, newId: next }]);

    setEquipping(activeSlot);
    const { error } = await equipGamePageSlot(user.id, productId, activeSlot, next);
    setEquipping(null);

    if (error) {
      toast.error('Você precisa ter este jogo na sua biblioteca para personalizar.');
      // GAP-C007: Desfazer em caso de erro
      setHistory(prev => prev.slice(0, -1));
      return;
    }
    reload();
    toast.success(next ? `✅ ${slotMeta.label} equipado!` : '🗑️ Removido');
  }, [user, activeSlot, equippedId, productId, slotMeta.label, equipping]);

  // GAP-C007: Desfazer última alteração
  const undoLast = useCallback(async () => {
    if (history.length === 0 || !user) return;
    const last = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));

    setEquipping(last.slot);
    const { error } = await equipGamePageSlot(user.id, productId, last.slot, last.previousId);
    setEquipping(null);

    if (error) {
      toast.error('Erro ao desfazer');
      return;
    }
    reload();
    setActiveSlot(last.slot);
    toast.info('↩️ Alteração desfeita');
  }, [history, user, productId, reload]);

  const occupiedCount = getOccupiedCount(loadout);

  // GAP-C001: Preview do slot ativo
  const activeEquipped = equippedId(activeSlot);
  const activeReward = inventory.find(r => r.reward.id === activeEquipped)?.reward;

  return (
    <Sheet open={open} onOpenChange={(val) => {
      if (!val) {
        // Resetar histórico ao fechar
        setHistory([]);
      }
      onOpenChange(val);
    }}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Personalizar esta página
          </SheetTitle>
          <SheetDescription>
            Escolha cosméticos desbloqueados em <strong>qualquer jogo</strong> para decorar esta página.
          </SheetDescription>
        </SheetHeader>

        {/* GAP-C006: Barra de progresso */}
        <div className="mt-4 mb-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Personalização</span>
            <span>{occupiedCount}/{TOTAL_SLOTS} slots ocupados</span>
          </div>
          <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500"
              style={{ width: `${(occupiedCount / TOTAL_SLOTS) * 100}%` }}
            />
          </div>
        </div>

        {/* GAP-C007: Botão Undo */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={undoLast}
            disabled={history.length === 0 || !!equipping}
            className={cn(
              "flex items-center gap-1.5 text-xs font-medium transition",
              history.length > 0 && !equipping
                ? "text-primary hover:text-primary/80"
                : "text-muted-foreground/40 cursor-not-allowed"
            )}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Desfazer ({history.length})
          </button>
          <span className="text-[10px] text-muted-foreground">
            {equipping && <Loader2 className="h-3 w-3 animate-spin inline" />}
          </span>
        </div>

        {/* Slots */}
        <div className="flex gap-1.5 overflow-x-auto py-2 -mx-1 px-1">
          {PAGE_SLOTS.map(s => {
            const isEq = !!equippedId(s.slot);
            return (
              <button
                key={s.slot}
                onClick={() => setActiveSlot(s.slot)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap border transition flex items-center gap-1",
                  activeSlot === s.slot
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:border-primary/50"
                )}
              >
                <span>{s.icon}</span>
                {s.label}
                {isEq && <CheckCircle2 className="h-3 w-3 ml-0.5" />}
              </button>
            );
          })}
        </div>

        {/* GAP-C001: Preview do slot atual */}
        {activeReward && (
          <div className="mb-3 p-3 rounded-lg border border-primary/20 bg-primary/5 flex items-center gap-3">
            <CosmeticPreview reward={activeReward} size={48} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{activeReward.name}</p>
              <p className="text-[10px] text-muted-foreground">
                {slotMeta.label} · {activeReward.rarity}
              </p>
            </div>
            <Badge variant="outline" className="text-primary border-primary/30">Equipado</Badge>
          </div>
        )}

        {eligible.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            Você ainda não tem cosméticos compatíveis com este slot.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {eligible.map(({ reward, product_title }) => {
              const isEq = equippedId(activeSlot) === reward.id;
              const equippedElsewhere = isEquippedElsewhere(reward.id, activeSlot);
              const rarityClass = RARITY_COLOR[reward.rarity]?.split(' ')[1] || '';

              return (
                <button
                  key={reward.id}
                  onClick={() => equip(reward.id)}
                  disabled={isLoading}
                  className={cn(
                    "p-2 rounded-xl border bg-card flex flex-col items-center gap-1 transition hover:border-primary/60 relative",
                    isEq ? "ring-2 ring-primary" : "border-border",
                    equippedElsewhere && !isEq && "opacity-60"
                  )}
                >
                  <CosmeticPreview reward={reward} size={64} />
                  <p className={cn("text-[11px] font-semibold line-clamp-1", rarityClass)}>
                    {reward.name}
                  </p>
                  <p className="text-[9px] text-muted-foreground line-clamp-1">de {product_title}</p>

                  {/* GAP-C002: Indicador de equipado em outra página */}
                  {equippedElsewhere && !isEq && (
                    <div className="absolute top-1 right-1">
                      <Badge variant="outline" className="text-[8px] px-1 py-0 bg-muted/80">
                        em uso
                      </Badge>
                    </div>
                  )}

                  {isEq && (
                    <Badge className="text-[8px] px-1.5 py-0 bg-primary/20 text-primary border-primary/30">
                      ✓ Ativo
                    </Badge>
                  )}

                  {/* GAP-C004: Loading overlay */}
                  {equipping === activeSlot && isEq && (
                    <div className="absolute inset-0 rounded-xl bg-background/60 flex items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {equippedId(activeSlot) && (
          <button
            onClick={() => equip(null)}
            disabled={isLoading}
            className="mt-3 w-full py-2 rounded-lg border border-destructive/50 text-destructive text-xs font-semibold flex items-center justify-center gap-1 hover:bg-destructive/10 transition"
          >
            <X className="h-3 w-3" /> Remover deste slot
          </button>
        )}

        {/* GAP-C008: Indicador de sincronização */}
        {realtimeVersion > 0 && (
          <div className="mt-2 text-[9px] text-muted-foreground flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Sincronizado em tempo real
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}