// Central de desbloqueios cosméticos. Botão com sino + sheet listando últimos
// itens desbloqueados pelo usuário, com link direto para a tela de Customização.
// Emite toast com link "Ver" quando um novo cosmético é desbloqueado em realtime.
import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Gift, Sparkles, Filter, X } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { CosmeticPreview } from './CosmeticPreview';
import { GameReward, RARITY_COLOR, KIND_LABEL, RewardKind } from '@/hooks/useCosmetics';
import { toast } from 'sonner';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

interface UnlockRow { unlocked_at: string; reward: GameReward; product_title?: string | null }

interface Props {
  customizationHref?: string;
  variant?: 'compact' | 'full';
}

// GAP-M039: Filtros de tipo
const KIND_FILTERS: (RewardKind | 'all')[] = ['all', 'avatar_frame', 'profile_banner', 'profile_accent', 'sticker', 'character_icon'];

export function CosmeticUnlocksCenter({ customizationHref = '/perfil', variant = 'compact' }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<UnlockRow[]>([]);
  const [newCount, setNewCount] = useState(0);
  const [kindFilter, setKindFilter] = useState<RewardKind | 'all'>('all');
  const seenKey = user ? `cosmetic-unlocks-seen:${user.id}` : '';
  const [pendingToasts, setPendingToasts] = useState<Set<string>>(new Set());

  const reload = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_game_rewards' as any)
      .select('unlocked_at, reward:game_rewards(*, produtos(title))')
      .eq('user_id', user.id)
      .order('unlocked_at', { ascending: false })
      .limit(30);
    const list: UnlockRow[] = (data || []).map((r: any) => ({
      unlocked_at: r.unlocked_at,
      reward: r.reward as GameReward,
      product_title: r.reward?.produtos?.title ?? null,
    }));
    setRows(list);
    const lastSeen = (typeof localStorage !== 'undefined' && seenKey) ? localStorage.getItem(seenKey) : null;
    const nu = lastSeen ? list.filter(l => l.unlocked_at > lastSeen).length : list.length;
    setNewCount(nu);
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [user?.id]);

  // GAP-M040: Agrupar notificações de múltiplos unlocks
  useEffect(() => {
    if (!user) return;
    let toastTimer: NodeJS.Timeout;
    let pendingUnlocks: any[] = [];

    const ch = supabase.channel(`ugr-${user.id}-${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_game_rewards', filter: `user_id=eq.${user.id}` },
        async (payload: any) => {
          const rewardId = payload?.new?.reward_id;
          if (!rewardId) return;
          
          const { data: r } = await supabase
            .from('game_rewards' as any)
            .select('name, kind, rarity')
            .eq('id', rewardId)
            .maybeSingle();
          if (!r) return;

          pendingUnlocks.push(r);
          
          // Limpar timer anterior
          clearTimeout(toastTimer);
          
          // GAP-M040: Agrupar unlocks em uma única notificação após 500ms
          toastTimer = setTimeout(() => {
            const count = pendingUnlocks.length;
            const first = pendingUnlocks[0];
            
            if (count === 1) {
              toast.success(`🎁 Novo cosmético desbloqueado: ${first.name}`, {
                description: `Tipo: ${KIND_LABEL[first.kind] || first.kind}`,
                action: { label: 'Ver', onClick: () => navigate(customizationHref) },
              });
            } else {
              const names = pendingUnlocks.map(u => u.name).join(', ');
              toast.success(`🎁 ${count} novos cosméticos desbloqueados!`, {
                description: `${names}`,
                action: { label: 'Ver todos', onClick: () => { setOpen(true); markSeen(); } },
              });
            }
            
            pendingUnlocks = [];
            await reload();
          }, 500);
        })
      .subscribe();
      
    return () => { 
      supabase.removeChannel(ch);
      clearTimeout(toastTimer);
    };
  }, [user?.id, navigate, customizationHref]);

  const markSeen = () => {
    if (rows[0] && seenKey) { localStorage.setItem(seenKey, rows[0].unlocked_at); setNewCount(0); }
  };

  // GAP-M039: Filtrar por tipo
  const filteredRows = useMemo(() => {
    if (kindFilter === 'all') return rows;
    return rows.filter(r => r.reward.kind === kindFilter);
  }, [rows, kindFilter]);

  if (!user) return null;

  return (
    <>
      <button
        onClick={() => { setOpen(true); markSeen(); }}
        className={`relative inline-flex items-center gap-1.5 ${variant === 'full' ? 'px-3 py-2 rounded-lg bg-card border border-border text-xs font-semibold hover:border-primary' : 'p-2 rounded-full hover:bg-card/60'}`}
        aria-label="Central de cosméticos desbloqueados"
        title="Desbloqueios de cosméticos"
      >
        <Gift className="h-4 w-4 text-primary" />
        {variant === 'full' && <span>Cosméticos</span>}
        {newCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1">
            {newCount > 9 ? '9+' : newCount}
          </span>
        )}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Desbloqueios recentes
            </SheetTitle>
            <SheetDescription>Cosméticos liberados pelos seus jogos.</SheetDescription>
          </SheetHeader>

          <Link
            to={customizationHref}
            onClick={() => setOpen(false)}
            className="mt-3 mb-4 block py-2.5 rounded-lg bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold text-center text-sm"
          >
            🎨 Ir para customização
          </Link>

          {/* GAP-M039: Filtro de tipo */}
          <div className="flex flex-wrap gap-1 mb-4">
            {KIND_FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setKindFilter(f)}
                className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-medium border transition",
                  kindFilter === f 
                    ? "bg-primary text-primary-foreground border-primary" 
                    : "border-border text-muted-foreground hover:border-primary/50"
                )}
              >
                {f === 'all' ? 'Todos' : KIND_LABEL[f]}
              </button>
            ))}
          </div>

          {filteredRows.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-10">
              Ainda nenhum cosmético desbloqueado.
            </div>
          ) : (
            <ul className="space-y-2">
              {filteredRows.map((u, i) => {
                const rarityClass = RARITY_COLOR[u.reward.rarity]?.split(' ')[1] || '';
                return (
                  <li key={u.reward.id + i} className="flex items-center gap-3 p-2 rounded-lg border border-border bg-card">
                    <CosmeticPreview reward={u.reward} size={48} />
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-semibold truncate", rarityClass)}>
                        {u.reward.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {KIND_LABEL[u.reward.kind]} · de {u.product_title || 'jogo'}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">{formatDate(u.unlocked_at)}</span>
                        {/* GAP-M041: Badge de raridade */}
                        <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0", rarityClass)}>
                          {u.reward.rarity}
                        </Badge>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}