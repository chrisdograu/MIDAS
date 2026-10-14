// Grid do inventário de cosméticos do usuário, agrupado por jogo de origem.
// Permite equipar/desequipar nos slots do loadout global de perfil.
import { useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  useMyCosmeticInventory, useUserLoadout, equipGlobalSlot,
  RARITY_COLOR, KIND_LABEL, RewardKind, RARITY_ORDER,
} from '@/hooks/useCosmetics';
import { CosmeticPreview } from './CosmeticPreview';
import { Loader2, CheckCircle2, X, Search, Filter, ArrowUpDown, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import ErroCarregamento from '@/components/ErroCarregamento';

const SLOT_FOR_KIND: Partial<Record<RewardKind, string>> = {
  avatar_frame: 'avatar_frame',
  profile_banner: 'profile_banner',
  profile_accent: 'profile_accent',
};

const RARITY_FILTERS = ['all', 'common', 'rare', 'epic', 'legendary', 'mythic'] as const;

export function CosmeticInventoryGrid() {
  const { user } = useAuth();
  const { rows, loading, reload, loadError } = useMyCosmeticInventory();
  const { rows: loadout, reload: reloadLoadout } = useUserLoadout(user?.id);
  
  // GAP-M033: Busca
  const [search, setSearch] = useState('');
  // GAP-M034: Ordenação
  const [sortBy, setSortBy] = useState<'rarity' | 'name' | 'recent'>('recent');
  // GAP-M035: Filtro por raridade
  const [rarityFilter, setRarityFilter] = useState<'all' | 'common' | 'rare' | 'epic' | 'legendary' | 'mythic'>('all');
  const [kindFilter, setKindFilter] = useState<RewardKind | 'all'>('all');
  // GAP-M036: Preview
  const [previewItem, setPreviewItem] = useState<any | null>(null);
  const [equipping, setEquipping] = useState(false);

  // GAP-M033 + GAP-M034 + GAP-M035: Filtros e ordenação
  const filteredAndSorted = useMemo(() => {
    let result = rows;
    
    // Filtro de busca
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r => 
        r.reward.name.toLowerCase().includes(q) ||
        (r.product_title || '').toLowerCase().includes(q) ||
        KIND_LABEL[r.reward.kind].toLowerCase().includes(q)
      );
    }
    
    // Filtro de raridade
    if (rarityFilter !== 'all') {
      result = result.filter(r => r.reward.rarity === rarityFilter);
    }
    
    // Filtro de tipo
    if (kindFilter !== 'all') {
      result = result.filter(r => r.reward.kind === kindFilter);
    }
    
    // Ordenação
    if (sortBy === 'rarity') {
      result = [...result].sort((a, b) => 
        RARITY_ORDER[b.reward.rarity] - RARITY_ORDER[a.reward.rarity]
      );
    } else if (sortBy === 'name') {
      result = [...result].sort((a, b) => 
        a.reward.name.localeCompare(b.reward.name)
      );
    } else {
      // recent - já vem ordenado por unlocked_at
      result = [...result];
    }
    
    return result;
  }, [rows, search, rarityFilter, kindFilter, sortBy]);

  const grouped = useMemo(() => {
    const map: Record<string, typeof filteredAndSorted> = {};
    filteredAndSorted.forEach(r => {
      const k = r.product_title || 'Outros';
      (map[k] ||= []).push(r);
    });
    return map;
  }, [filteredAndSorted]);

  const equippedId = (slot: string) => loadout.find(l => l.slot === slot)?.reward_id;

  const handleEquip = async (rewardId: string, kind: RewardKind) => {
    if (!user || equipping) return;
    if (kind === 'game_card_skin' || kind === 'game_page_theme') {
      toast.info('Este cosmético é aplicado na personalização da página de um jogo da sua biblioteca.');
      return;
    }
    const slot = SLOT_FOR_KIND[kind];
    setEquipping(true);
    let result;
    if (!slot) {
      const stickerSlots = ['sticker_1', 'sticker_2', 'sticker_3'];
      const existing = loadout.find(l => l.reward_id === rewardId);
      const free = existing?.slot || stickerSlots.find(s => !loadout.find(l => l.slot === s)?.reward_id) || 'sticker_1';
      result = await equipGlobalSlot(user.id, free, existing ? null : rewardId);
    } else {
      const current = equippedId(slot);
      result = await equipGlobalSlot(user.id, slot, current === rewardId ? null : rewardId);
    }
    setEquipping(false);
    if (result.error) { toast.error('Não foi possível aplicar o cosmético. Tente novamente.'); return; }
    await reloadLoadout();
    toast.success('Cosmético atualizado');
  };

  // GAP-M036: Abrir preview
  const openPreview = (item: any) => {
    setPreviewItem(item);
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  if (loadError) return <ErroCarregamento onRetry={reload} />;

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Ainda nenhum cosmético desbloqueado. Jogue, escreva reviews e participe dos fóruns dos seus jogos para liberar recompensas exclusivas 🎁
      </div>
    );
  }

  const filters: (RewardKind | 'all')[] = ['all','avatar_frame','profile_banner','profile_accent','sticker','character_icon','game_page_theme','game_card_skin'];

  return (
    <div className="space-y-4">
      {/* GAP-M033: Busca */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar cosmético..." 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        
        {/* GAP-M035: Filtro de raridade */}
        <Select value={rarityFilter} onValueChange={(v: any) => setRarityFilter(v)}>
          <SelectTrigger className="w-32 h-9 text-xs">
            <Filter className="h-3 w-3 mr-1" />
            <SelectValue placeholder="Raridade" />
          </SelectTrigger>
          <SelectContent>
            {RARITY_FILTERS.map(r => (
              <SelectItem key={r} value={r}>
                {r === 'all' ? 'Todas' : r.charAt(0).toUpperCase() + r.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {/* GAP-M034: Ordenação */}
        <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
          <SelectTrigger className="w-28 h-9 text-xs">
            <ArrowUpDown className="h-3 w-3 mr-1" />
            <SelectValue placeholder="Ordenar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Recentes</SelectItem>
            <SelectItem value="rarity">Raridade</SelectItem>
            <SelectItem value="name">Nome</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Filtros de tipo */}
      <div className="flex flex-wrap gap-1.5 pb-1">
        {filters.map(f => (
          <button key={f} onClick={() => setKindFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap border transition ${
              kindFilter === f ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/50'
            }`}>
            {f === 'all' ? 'Todos' : KIND_LABEL[f]}
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        {filteredAndSorted.length} cosmético(s) encontrado(s)
      </p>

      {Object.entries(grouped).map(([game, items]) => (
        <section key={game}>
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">🎮 {game}</h4>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {items.map(({ reward }) => {
              const slot = SLOT_FOR_KIND[reward.kind];
              const isEquipped = slot ? equippedId(slot) === reward.id : loadout.some(l => l.reward_id === reward.id);
              const rarityClass = RARITY_COLOR[reward.rarity]?.split(' ')[1] || '';
              
              return (
                <div
                  key={reward.id}
                  className={`relative p-2 rounded-xl border bg-card flex flex-col items-center gap-1 transition hover:border-primary/60 ${isEquipped ? 'ring-2 ring-primary' : 'border-border'}`}
                >
                  <button
                    onClick={() => openPreview({ reward, game })}
                    className="relative group"
                  >
                    <CosmeticPreview reward={reward} size={56} />
                    <div className="absolute inset-0 bg-overlay/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                      <Eye className="h-4 w-4 text-on-media" />
                    </div>
                  </button>
                  <p className={`text-[10px] font-semibold line-clamp-1 ${rarityClass}`}>{reward.name}</p>
                  <p className="text-[9px] text-muted-foreground">{KIND_LABEL[reward.kind]}</p>
                  
                  {/* GAP-M035: Badge de raridade */}
                  <Badge variant="outline" className={`text-[8px] px-1.5 py-0 ${rarityClass}`}>
                    {reward.rarity}
                  </Badge>
                  
                  <Button
                    onClick={() => handleEquip(reward.id, reward.kind)}
                    disabled={equipping}
                    variant="secondary"
                    className={`w-full min-h-11 h-auto mt-1 px-1 rounded text-[11px] font-semibold transition ${
                      isEquipped 
                        ? 'bg-primary/20 text-primary' 
                        : 'bg-secondary text-muted-foreground hover:bg-primary/10 hover:text-primary'
                    }`}
                  >
                    {isEquipped ? (
                      <span className="flex items-center justify-center gap-0.5">
                        <CheckCircle2 className="h-3 w-3" /> Equipado
                      </span>
                    ) : (
                      reward.kind === 'game_card_skin' || reward.kind === 'game_page_theme' ? 'Usar no jogo' : 'Equipar'
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {/* GAP-M036: Modal de preview */}
      <Dialog open={!!previewItem} onOpenChange={() => setPreviewItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className={RARITY_COLOR[previewItem?.reward?.rarity]?.split(' ')[1] || ''}>
                {previewItem?.reward?.name}
              </span>
            </DialogTitle>
          </DialogHeader>
          {previewItem && (
            <div className="flex flex-col items-center gap-4 py-4">
              <CosmeticPreview reward={previewItem.reward} size={128} />
              <div className="text-center space-y-1">
                <p className="text-sm font-medium">{previewItem.reward.name}</p>
                <p className="text-xs text-muted-foreground">
                  {KIND_LABEL[previewItem.reward.kind]} · {previewItem.game || 'Jogo'}
                </p>
                <Badge className={RARITY_COLOR[previewItem.reward.rarity]}>
                  {previewItem.reward.rarity}
                </Badge>
                {previewItem.reward.description && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {previewItem.reward.description}
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}