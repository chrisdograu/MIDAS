import { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Clock, Star, Trophy, Library, MessageSquare, Camera, Award, Pencil, Check, X, Filter, Share2, MoreVertical, ChevronDown } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { TimelineSkeleton } from '@/components/skeletons';
import { formatDateTime, formatRelativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Event = {
  id: string;
  product_id: string;
  kind: string;
  payload: any;
  created_at: string;
  updated_at?: string;
  user_note?: string | null;
  product?: { title: string; image_url: string | null } | null;
};

// GAP-GT02: Filtros
type FilterType = 'all' | 'status' | 'review' | 'review_completa' | 'opinion' | 'screenshot' | 'achievement';

const FILTER_OPTIONS: { value: FilterType; label: string; icon: any }[] = [
  { value: 'all', label: 'Todos', icon: Clock },
  { value: 'status', label: 'Status', icon: Library },
  { value: 'review', label: 'Reviews', icon: Star },
  { value: 'screenshot', label: 'Screenshots', icon: Camera },
  { value: 'achievement', label: 'Conquistas', icon: Trophy },
];

const ICON: Record<string, any> = {
  status_change: Library,
  review: Star,
  review_completa: Star,
  opinion: MessageSquare,
  screenshot: Camera,
  achievement: Trophy,
  platinum: Award,
};

const LABEL: Record<string, (p: any) => string> = {
  status_change: p => `mudou status para ${p?.status || '—'}`,
  review: p => `avaliou (${p?.rating ?? '—'}/5)`,
  review_completa: () => 'publicou uma review completa',
  opinion: () => 'compartilhou uma opinião',
  screenshot: () => 'postou screenshots',
  achievement: p => `desbloqueou: ${p?.name || 'conquista'}`,
  platinum: () => 'platinou o jogo',
};

export default function GameTimeline({ userId, productId, limit = 20 }: { userId: string; productId?: string; limit?: number }) {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [page, setPage] = useState(0);
  const observerRef = useRef<HTMLDivElement>(null);
  const isOwner = user?.id === userId;

  const loadEvents = useCallback(async (reset = true) => {
    if (!userId) return;
    setLoading(true);
    try {
      let q = supabase
        .from('game_timeline_events')
        .select('id, product_id, kind, payload, created_at, updated_at, user_note')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(reset ? 0 : events.length, (reset ? 0 : events.length) + limit - 1);

      if (productId) q = q.eq('product_id', productId);
      if (filter !== 'all') q = q.eq('kind', filter);

      const { data } = await q;
      const list = (data || []) as Event[];
      
      const pids = [...new Set(list.map(e => e.product_id))];
      if (pids.length) {
        const { data: prods } = await supabase.from('produtos').select('id, title, image_url').in('id', pids);
        const map = new Map((prods || []).map(p => [p.id, p]));
        list.forEach(e => { e.product = (map.get(e.product_id) as any) || null; });
      }
      
      if (reset) {
        setEvents(list);
        setPage(1);
      } else {
        setEvents(prev => [...prev, ...list]);
        setPage(prev => prev + 1);
      }
      setHasMore(list.length === limit);
    } catch (e) {
      console.error('Error loading timeline:', e);
    } finally {
      setLoading(false);
    }
  }, [userId, productId, filter, limit, events.length]);

  // GAP-GT01: Intersection Observer para paginação
  useEffect(() => {
    if (!observerRef.current || !hasMore || loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadEvents(false);
        }
      },
      { rootMargin: '100px' }
    );
    observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, loadEvents]);

  useEffect(() => {
    loadEvents(true);
  }, [userId, productId, filter]);

  const startEdit = (ev: Event) => {
    setEditingId(ev.id);
    setDraft(ev.user_note || '');
  };

  const saveNote = async (id: string) => {
    const value = draft.trim();
    await supabase
      .from('game_timeline_events')
      .update({ user_note: value || null })
      .eq('id', id);
    setEvents(prev => prev.map(e => e.id === id ? { ...e, user_note: value || null, updated_at: new Date().toISOString() } : e));
    setEditingId(null);
    toast.success('Memória salva!');
  };

  // GAP-GT03: Compartilhar evento
  const shareEvent = (ev: Event) => {
    const text = `🎮 ${ev.product?.title || 'Jogo'} — ${LABEL[ev.kind]?.(ev.payload) || ev.kind}`;
    if (navigator.share) {
      navigator.share({ title: 'MIDIAS Timeline', text });
    } else {
      navigator.clipboard.writeText(text);
      toast.success('Copiado para a área de transferência!');
    }
  };

  if (loading && events.length === 0) return <TimelineSkeleton count={4} />;
  if (!events.length) {
    return <p className="text-sm text-muted-foreground py-4">Sem eventos na timeline ainda.</p>;
  }

  const filteredEvents = events;

  return (
    <div className="space-y-4">
      {/* GAP-GT02: Filtros */}
      <div className="flex items-center gap-1 flex-wrap">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        {FILTER_OPTIONS.map(opt => {
          const Icon = opt.icon;
          const active = filter === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={cn(
                "text-[10px] px-2 py-0.5 rounded-full transition flex items-center gap-1",
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-2.5 w-2.5" />
              {opt.label}
            </button>
          );
        })}
        <span className="text-[10px] text-muted-foreground ml-auto">
          {filteredEvents.length} eventos
        </span>
      </div>

      <ol className="relative border-l border-border ml-3 space-y-4 py-2">
        {filteredEvents.map(ev => {
          const Icon = ICON[ev.kind] || Clock;
          const label = (LABEL[ev.kind] || (() => ev.kind))(ev.payload);
          const editing = editingId === ev.id;
          const isEdited = ev.updated_at && ev.updated_at !== ev.created_at;
          
          return (
            <li key={ev.id} className="ml-4 group">
              <span className="absolute -left-2 flex items-center justify-center w-4 h-4 rounded-full bg-primary/20 ring-4 ring-background">
                <Icon className="h-2.5 w-2.5 text-primary" />
              </span>
              <div className="bg-card border border-border rounded-lg px-3 py-2">
                <div className="flex items-center gap-3">
                  {ev.product?.image_url && (
                    <img src={ev.product.image_url} alt="" className="w-10 h-10 rounded object-cover shrink-0" loading="lazy" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">
                      {ev.product ? (
                        <Link to={`/jogo/${ev.product_id}`} className="font-medium hover:text-primary">{ev.product.title}</Link>
                      ) : 'Jogo'}{' '}
                      <span className="text-muted-foreground">— {label}</span>
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatRelativeTime(ev.created_at)}</span>
                      {/* GAP-GT04: Indicador de editado */}
                      {isEdited && (
                        <span className="text-[9px] text-muted-foreground/60">· editado</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    {isOwner && !editing && (
                      <button
                        onClick={() => startEdit(ev)}
                        className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-primary transition-colors"
                        title={ev.user_note ? 'Editar memória' : 'Adicionar memória'}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {/* GAP-GT03: Compartilhar */}
                    <button
                      onClick={() => shareEvent(ev)}
                      className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-primary transition-colors"
                      title="Compartilhar"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {editing ? (
                  <div className="mt-2 flex items-start gap-2">
                    <textarea
                      value={draft}
                      onChange={e => setDraft(e.target.value)}
                      maxLength={500}
                      rows={2}
                      autoFocus
                      placeholder="Como foi esse dia? Deixe uma memória..."
                      className="flex-1 text-xs bg-background border border-border rounded px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <div className="flex flex-col gap-1">
                      <button onClick={() => saveNote(ev.id)} className="p-1.5 rounded bg-primary/20 text-primary hover:bg-primary/30">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setEditingId(null)} className="p-1.5 rounded bg-secondary text-muted-foreground hover:bg-secondary/80">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ) : ev.user_note ? (
                  <div className="mt-2 pl-2 border-l-2 border-accent/40 flex items-start gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-accent font-bold shrink-0 mt-0.5">📝 memória</span>
                    <p className="text-xs text-foreground/90 italic">{ev.user_note}</p>
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      {/* GAP-GT01: Intersection Observer target */}
      {hasMore && (
        <div ref={observerRef} className="flex justify-center py-4">
          <div className="h-6 w-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        </div>
      )}
    </div>
  );
}