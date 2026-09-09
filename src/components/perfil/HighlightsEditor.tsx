import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Trash2, Sparkles, Plus, Search, GripVertical, Eye } from 'lucide-react';
import { toast } from 'sonner';
import SelectSimples from '@/components/SelectSimples';
import { cn } from '@/lib/utils';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type HighlightType = 'game' | 'review' | 'review_completa' | 'screenshot' | 'opinion';

type Highlight = {
  id: string;
  type: HighlightType;
  ref_id: string;
  position: number;
  label?: string;
};

const TYPE_LABEL: Record<HighlightType, string> = {
  game: '🎮 Jogo',
  review: '⭐ Review',
  review_completa: '📝 Review Completa',
  screenshot: '📸 Screenshot',
  opinion: '💬 Opinião',
};

const MAX_HIGHLIGHTS = 6;

// GAP-HE01: Hook de busca
function useSearchItems(type: HighlightType, query: string) {
  const [results, setResults] = useState<{ id: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const fetchItems = async () => {
      try {
        let data = [];
        if (type === 'game') {
          const { data: games } = await supabase
            .from('produtos')
            .select('id, title')
            .ilike('title', `%${query}%`)
            .limit(10);
          data = (games || []).map((g: any) => ({ id: g.id, label: g.title }));
        } else {
          // Para outros tipos, buscar de tabelas específicas
          const tables: Record<string, string> = {
            review: 'avaliacoes',
            review_completa: 'reviews_completas',
            screenshot: 'screenshots',
            opinion: 'opinions',
          };
          const table = tables[type];
          if (table) {
            const { data: items } = await supabase
              .from(table)
              .select('id')
              .eq('user_id', (await supabase.auth.getUser()).data.user?.id || '')
              .limit(10);
            data = (items || []).map((i: any) => ({ id: i.id, label: `${type} ${i.id.slice(0, 8)}` }));
          }
        }
        setResults(data);
      } catch {
        setResults([]);
      }
      setLoading(false);
    };
    const timer = setTimeout(fetchItems, 300);
    return () => clearTimeout(timer);
  }, [type, query]);

  return { results, loading };
}

// GAP-HE02: SortableItem
function SortableItem({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="relative cursor-grab active:cursor-grabbing">
      <GripVertical className="absolute -left-1 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/40" />
      {children}
    </div>
  );
}

export default function HighlightsEditor() {
  const { user } = useAuth();
  const [items, setItems] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newType, setNewType] = useState<HighlightType>('game');
  const [newRefId, setNewRefId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  
  const { results, loading: searchLoading } = useSearchItems(newType, searchQuery);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('profile_highlights')
      .select('id, type, ref_id, position')
      .eq('user_id', user.id)
      .order('position', { ascending: true });
    const rows = ((data as any[]) || []) as Highlight[];
    const gameIds = rows.filter(r => r.type === 'game').map(r => r.ref_id);
    if (gameIds.length) {
      const { data: prods } = await supabase.from('produtos').select('id, title').in('id', gameIds);
      const map = new Map((prods || []).map((p: any) => [p.id, p.title]));
      rows.forEach(r => { if (r.type === 'game') r.label = map.get(r.ref_id) || r.ref_id; });
    }
    setItems(rows);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  // GAP-HE04: Slots restantes
  const remainingSlots = MAX_HIGHLIGHTS - items.length;

  const handleAdd = async (id: string) => {
    if (!user || !id) return;
    if (items.length >= MAX_HIGHLIGHTS) {
      toast.error(`Máximo de ${MAX_HIGHLIGHTS} destaques`);
      return;
    }
    if (items.some(i => i.type === newType && i.ref_id === id)) {
      toast.warning('Este item já está nos destaques');
      return;
    }
    setAdding(true);
    const { error } = await supabase.from('profile_highlights').insert({
      user_id: user.id,
      type: newType,
      ref_id: id,
      position: items.length,
    });
    setAdding(false);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success('Destaque adicionado');
    setNewRefId('');
    setSearchQuery('');
    setShowSearch(false);
    load();
  };

  const handleRemove = async (id: string) => {
    const { error } = await supabase.from('profile_highlights').delete().eq('id', id);
    if (error) { toast.error('Erro ao remover'); return; }
    setItems(prev => prev.filter(i => i.id !== id));
  };

  // GAP-HE02: Reordenar
  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = items.findIndex(i => i.id === active.id);
      const newIndex = items.findIndex(i => i.id === over.id);
      const reordered = arrayMove(items, oldIndex, newIndex);
      setItems(reordered);
      // Salvar nova ordem
      supabase.from('profile_highlights').update({ position: newIndex }).eq('id', reordered[newIndex].id);
    }
  };

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Fixe até {MAX_HIGHLIGHTS} itens no topo do seu perfil público.
        </p>
        {/* GAP-HE04: Indicador de slots */}
        <span className={cn(
          "text-[10px] font-semibold px-2 py-0.5 rounded-full",
          remainingSlots > 0 ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
        )}>
          {remainingSlots} slots restantes
        </span>
      </div>

      {/* GAP-HE03: Preview */}
      <button
        onClick={() => setPreviewMode(!previewMode)}
        className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1 transition"
      >
        <Eye className="h-3 w-3" />
        {previewMode ? 'Ocultar preview' : 'Preview do perfil'}
      </button>

      {previewMode && (
        <div className="p-3 rounded-lg border border-primary/20 bg-primary/5">
          <p className="text-xs font-medium">Destaques no perfil:</p>
          <div className="flex flex-wrap gap-2 mt-1">
            {items.length === 0 ? (
              <span className="text-[10px] text-muted-foreground">Nenhum destaque ainda</span>
            ) : (
              items.map(i => (
                <span key={i.id} className="text-[10px] bg-secondary px-2 py-0.5 rounded-full">
                  {TYPE_LABEL[i.type]} {i.label || i.ref_id}
                </span>
              ))
            )}
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="text-center py-6 border border-dashed border-border rounded-lg">
          <Sparkles className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum destaque ainda</p>
        </div>
      ) : (
        // GAP-HE02: Drag-and-drop
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">
              {items.map(it => (
                <SortableItem key={it.id} id={it.id}>
                  <li className="flex items-center justify-between gap-2 bg-secondary border border-border rounded-lg px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">{TYPE_LABEL[it.type]}</p>
                      <p className="text-sm text-foreground truncate">{it.label || it.ref_id}</p>
                    </div>
                    <button onClick={() => handleRemove(it.id)} className="p-2 text-destructive hover:bg-destructive/10 rounded-md">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                </SortableItem>
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {/* GAP-HE01: Adicionar com busca */}
      <div className="border-t border-border pt-4 space-y-2">
        <p className="text-xs font-semibold text-foreground">Adicionar destaque</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <SelectSimples
            value={newType}
            onChange={v => { setNewType(v as HighlightType); setSearchQuery(''); setResults([]); }}
            label="Tipo do destaque"
            className="sm:w-44"
            options={Object.entries(TYPE_LABEL).map(([k, v]) => ({ value: k, label: v }))}
          />

          <div className="flex-1 relative">
            <input
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setShowSearch(true); }}
              placeholder="Buscar item por nome..."
              className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm text-foreground"
              onFocus={() => setShowSearch(true)}
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            
            {showSearch && searchQuery.length >= 2 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                {searchLoading ? (
                  <div className="p-2 text-center text-xs text-muted-foreground">Buscando...</div>
                ) : results.length === 0 ? (
                  <div className="p-2 text-center text-xs text-muted-foreground">Nenhum resultado</div>
                ) : (
                  results.map(r => (
                    <button
                      key={r.id}
                      onClick={() => handleAdd(r.id)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-secondary transition border-b border-border last:border-0"
                    >
                      {r.label}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Digite o nome do jogo ou ID do item para buscar.
        </p>
      </div>
    </div>
  );
}