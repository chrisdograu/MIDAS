import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Star, Trash2, MessageSquareOff, Pencil, Filter, ArrowUpDown } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface MyReview {
  id: string;
  product_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string | null;
  product_title: string;
  product_image: string | null;
}

type SortOption = 'recent' | 'rating_high' | 'rating_low';
type FilterOption = 'all' | 5 | 4 | 3 | 2 | 1;

export default function MyReviewsTab() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<MyReview[]>([]);
  const [loading, setLoading] = useState(true);
  // GAP-MR01: Ordenação
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  // GAP-MR02: Filtro por nota
  const [filterRating, setFilterRating] = useState<FilterOption>('all');
  // GAP-MR03: Edição
  const [editing, setEditing] = useState<MyReview | null>(null);
  const [editRating, setEditRating] = useState(5);
  const [editComment, setEditComment] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('avaliacoes')
      .select('id, product_id, rating, comment, created_at, updated_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!data || data.length === 0) { setReviews([]); setLoading(false); return; }

    const prodIds = [...new Set(data.map(r => r.product_id))];
    const { data: prods } = await supabase
      .from('produtos')
      .select('id, title, image_url')
      .in('id', prodIds);
    const map = new Map(prods?.map(p => [p.id, p]) || []);

    setReviews(data.map(r => ({
      ...r,
      product_title: map.get(r.product_id)?.title || 'Produto',
      product_image: map.get(r.product_id)?.image_url || null,
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  // GAP-MR01 + GAP-MR02: Filtrar e ordenar
  const filteredReviews = useMemo(() => {
    let result = [...reviews];
    
    if (filterRating !== 'all') {
      result = result.filter(r => r.rating >= filterRating && r.rating < filterRating + 1);
    }
    
    result.sort((a, b) => {
      if (sortBy === 'rating_high') return b.rating - a.rating;
      if (sortBy === 'rating_low') return a.rating - b.rating;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    
    return result;
  }, [reviews, sortBy, filterRating]);

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta avaliação?')) return;
    const { error } = await supabase.from('avaliacoes').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir'); return; }
    toast.success('Avaliação excluída');
    load();
  };

  // GAP-MR03: Editar review
  const handleEdit = (review: MyReview) => {
    setEditing(review);
    setEditRating(review.rating);
    setEditComment(review.comment || '');
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSavingEdit(true);
    const { error } = await supabase
      .from('avaliacoes')
      .update({ rating: editRating, comment: editComment.trim() || null })
      .eq('id', editing.id);
    setSavingEdit(false);
    if (error) { toast.error('Erro ao salvar'); return; }
    toast.success('Avaliação atualizada');
    setEditing(null);
    load();
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  if (reviews.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <MessageSquareOff className="h-12 w-12 mx-auto mb-3 opacity-40" />
        <p className="text-sm">Você ainda não fez nenhuma avaliação</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* GAP-MR01 + GAP-MR02: Controles de ordenação e filtro */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <select
            value={filterRating}
            onChange={e => setFilterRating(Number(e.target.value) as FilterOption)}
            className="text-xs bg-secondary border border-border rounded px-2 py-1"
          >
            <option value="all">Todas notas</option>
            <option value="5">5 ★</option>
            <option value="4">4+ ★</option>
            <option value="3">3+ ★</option>
            <option value="2">2+ ★</option>
            <option value="1">1+ ★</option>
          </select>
        </div>
        <div className="flex items-center gap-1">
          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortOption)}
            className="text-xs bg-secondary border border-border rounded px-2 py-1"
          >
            <option value="recent">Mais recentes</option>
            <option value="rating_high">Melhor nota</option>
            <option value="rating_low">Pior nota</option>
          </select>
        </div>
        <span className="text-[10px] text-muted-foreground ml-auto">
          {filteredReviews.length} de {reviews.length} avaliações
        </span>
      </div>

      <div className="space-y-3">
        {filteredReviews.map(r => (
          <div key={r.id} className="flex gap-3 p-3 rounded-lg border border-border bg-secondary/40 group">
            <img src={r.product_image || '/placeholder.svg'} alt="" className="w-12 h-12 rounded object-cover" loading="lazy" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{r.product_title}</p>
              <div className="flex items-center gap-1 mt-1">
                {[1, 2, 3, 4, 5].map(i => (
                  <Star key={i} className={`h-3.5 w-3.5 ${i <= r.rating ? 'fill-warning text-warning' : 'text-muted-foreground/30'}`} />
                ))}
                <span className="text-xs text-muted-foreground ml-1">{Number(r.rating).toFixed(1)}</span>
              </div>
              {r.comment && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.comment}</p>}
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1">
                <span>{formatDate(r.created_at)}</span>
                {/* GAP-MR04: Indicador de última edição */}
                {r.updated_at && r.updated_at !== r.created_at && (
                  <span className="text-muted-foreground/60">· editado {formatDate(r.updated_at)}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
              <button onClick={() => handleEdit(r)} className="text-muted-foreground hover:text-primary p-2 rounded-lg h-fit transition-colors" title="Editar">
                <Pencil className="h-4 w-4" />
              </button>
              <button onClick={() => handleDelete(r.id)} className="text-destructive hover:bg-destructive/10 p-2 rounded-lg h-fit transition-colors" title="Excluir">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* GAP-MR03: Dialog de edição */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar avaliação</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4 py-2">
              <p className="text-sm font-medium">{editing.product_title}</p>
              
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(i => (
                  <button key={i} onClick={() => setEditRating(i)}>
                    <Star className={cn(
                      "h-6 w-6 transition",
                      i <= editRating ? 'fill-warning text-warning' : 'text-muted-foreground/30'
                    )} />
                  </button>
                ))}
              </div>
              
              <Textarea
                value={editComment}
                onChange={e => setEditComment(e.target.value)}
                placeholder="O que você achou do jogo?"
                rows={3}
              />
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
                <Button onClick={saveEdit} disabled={savingEdit}>
                  {savingEdit ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Salvar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}