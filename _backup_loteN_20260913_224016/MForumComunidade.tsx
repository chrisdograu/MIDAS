// Mobile community forum — listagem por categoria (geral, novidades, off-topic, sugestoes, apresentacoes).
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, MessageSquare, ThumbsUp, Plus, X, ChevronDown } from 'lucide-react';
import EstadoVazio from '@/components/EstadoVazio';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { timeAgo } from '@/mobile/lib/time';
import SpoilerGuard from '@/components/spoiler/SpoilerGuard';
import SpoilerComposerControls from '@/components/spoiler/SpoilerComposerControls';

interface Cat { slug: string; name: string; description: string | null }
interface Post { id: string; title: string | null; content: string; created_at: string; likes_count: number; user_id: string; author: string; is_spoiler: boolean }

const ICONS: Record<string, string> = {
  novidades: '📰', 'off-topic': '☕', sugestoes: '💡', apresentacoes: '👋', comunidade: '🌐',
};

// GAP-1041: Constante de limite
const LIMIT = 20;

export default function MForumComunidade() {
  const { slug } = useParams<{ slug?: string }>();
  const { user } = useAuth();
  const [cats, setCats] = useState<Cat[]>([]);
  const [cat, setCat] = useState<Cat | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [composeOpen, setComposeOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [composeSpoiler, setComposeSpoiler] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = async (reset: boolean = true, nextPageArg?: number) => {
    if (reset) {
      setLoading(true);
      setPage(0);
      setHasMore(true);
    }
    
    const currentPage = reset ? 0 : (nextPageArg ?? page + 1);
    const offset = currentPage * LIMIT;
    
    if (slug) {
      const found = subcats.find(c => c.slug === slug) || null;
      setCat(found);
      const { data: ps } = await supabase.from('forum_posts')
        .select('id,title,content,created_at,likes_count,user_id,is_spoiler')
        .eq('category_slug', slug).order('created_at', { ascending: false })
        .range(offset, offset + LIMIT - 1);
      
      const uids = [...new Set((ps || []).map(p => p.user_id))];
      const { data: profs } = uids.length
        ? await supabase.from('profiles').select('id,display_name').in('id', uids)
        : { data: [] as any };
      const map = new Map((profs || []).map((p: any) => [p.id, p.display_name || 'Usuário']));
      const newPosts = (ps || []).map((p: any) => ({ ...p, is_spoiler: !!p.is_spoiler, author: (map.get(p.user_id) || 'Usuário') as string }));
      
      if (reset) {
        setPosts(newPosts);
      } else {
        setPosts(prev => [...prev, ...newPosts]);
      }
      setHasMore((ps?.length || 0) >= LIMIT);
      setPage(currentPage + 1);
    } else {
      setCat(null); 
      if (reset) setPosts([]);
    }
    setLoading(false);
    setLoadingMore(false);
  };
  
  useEffect(() => { load(true); }, [slug]);

  // Categorias: carrega 1x, não em cada página
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: cs } = await supabase
        .from('forum_categories')
        .select('slug,name,description,parent_slug')
        .eq('is_community', true)
        .order('display_order');
      if (cancelled) return;
      const subcats = (cs || []).filter((c: any) => c.parent_slug) as Cat[];
      setCats(subcats);
      const found = subcats.find(c => c.slug === slug) || null;
      setCat(found);
    })();
    return () => { cancelled = true; };
  }, [slug]);

  // GAP-1041: Carregar mais
  const loadMore = () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    load(false, page + 1);
  };

  const submit = async () => {
    if (!user) { toast.error('Entre para postar'); return; }
    if (!cat) return;
    if (content.trim().length < 5) { toast.error('Escreva mais um pouco'); return; }
    setSubmitting(true);
    const { error } = await supabase.from('forum_posts').insert({
      user_id: user.id, category_slug: cat.slug,
      title: title.trim() || null, content: content.trim(),
      is_spoiler: composeSpoiler,
    } as any);
    setSubmitting(false);
    if (error) { toast.error('Erro ao publicar'); return; }
    toast.success('Postado! 🎉');
    setTitle(''); setContent(''); setComposeSpoiler(false); setComposeOpen(false);
    load(true);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  // Listagem geral (sem slug)
  if (!cat) {
    return (
      <div className="px-4 py-5 space-y-4 pb-24">
        <Link to="/m/forum" className="inline-flex items-center gap-1 text-xs text-muted-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Fórum</Link>
        <div>
          <h1 className="font-display text-xl font-bold">🌐 Comunidade geral</h1>
          <p className="text-xs text-muted-foreground">Tópicos que não pertencem a um jogo específico.</p>
        </div>
        <div className="space-y-2">
          {cats.map(c => (
            <Link key={c.slug} to={`/m/forum-comunidade/${c.slug}`}
              className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/40 transition-colors">
              <span className="text-2xl">{ICONS[c.slug] || '💬'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{c.name}</p>
                {c.description && <p className="text-[11px] text-muted-foreground line-clamp-1">{c.description}</p>}
              </div>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-5 space-y-4 pb-24">
      <Link to="/m/forum-comunidade" className="inline-flex items-center gap-1 text-xs text-muted-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Comunidade</Link>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="font-display text-xl font-bold">{ICONS[cat.slug] || '💬'} {cat.name}</h1>
          {cat.description && <p className="text-xs text-muted-foreground">{cat.description}</p>}
        </div>
        {user && (
          <button onClick={() => setComposeOpen(true)} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold inline-flex items-center gap-1">
            <Plus className="h-3 w-3" /> Novo
          </button>
        )}
      </div>

      {posts.length === 0 ? (
        <EstadoVazio
          icone={MessageSquare}
          titulo="Nenhum post ainda"
          descricao="Seja o primeiro a começar a conversa nesta comunidade."
        />
      ) : (
        <>
          <div className="space-y-2">
            {posts.map(p => (
              <Link key={p.id} to={`/m/forum/post/${p.id}`}
                className="block p-3 rounded-xl bg-card border border-border hover:border-primary/40 transition-colors">
                {p.title && <p className="text-sm font-semibold">{p.title}</p>}
                <SpoilerGuard isSpoiler={p.is_spoiler}>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{p.content}</p>
                </SpoilerGuard>
                <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                  <span>{p.author}</span>
                  <span>·</span>
                  <span>{timeAgo(p.created_at)}</span>
                  <span className="ml-auto inline-flex items-center gap-0.5"><ThumbsUp className="h-3 w-3" />{p.likes_count}</span>
                </div>
              </Link>
            ))}
          </div>
          
          {/* GAP-1041: Carregar mais */}
          {hasMore && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full py-2.5 rounded-xl border border-border bg-card text-sm font-medium hover:border-primary/40 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronDown className="h-4 w-4" />}
              {loadingMore ? 'Carregando...' : 'Carregar mais posts'}
            </button>
          )}
        </>
      )}

      {composeOpen && (
        <div className="fixed inset-0 overlay-scrim z-50 flex items-end" onClick={() => setComposeOpen(false)}>
          <div className="w-full bg-card rounded-t-2xl p-4 space-y-3 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-bold text-sm">Novo post em {cat.name}</p>
              <button onClick={() => setComposeOpen(false)}><X className="h-4 w-4" /></button>
            </div>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título (opcional)" maxLength={150}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
            <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Conteúdo..." rows={4} maxLength={2000}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm resize-none" />
            <SpoilerComposerControls
              isSpoiler={composeSpoiler} onIsSpoilerChange={setComposeSpoiler}
              achievementName={null} onAchievementNameChange={() => {}}
            />
            <button onClick={submit} disabled={submitting}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground text-sm font-semibold disabled:opacity-50">
              {submitting ? 'Publicando...' : 'Publicar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}