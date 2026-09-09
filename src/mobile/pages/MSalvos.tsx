import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BookmarkCheck, Loader2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import EstadoVazio from '@/components/EstadoVazio';
import { timeAgo } from '@/lib/format';

interface SavedPost {
  id: string;
  post_id: string;
  created_at: string;
  post: {
    id: string;
    content: string;
    created_at: string;
    user_id: string;
    product_id: string;
    profiles: {
      display_name: string | null;
    };
    produtos: {
      title: string;
    };
  };
}

export default function MSalvos() {
  const { user } = useAuth();
  const [savedPosts, setSavedPosts] = useState<SavedPost[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('saved_posts')
      .select(`
        id,
        post_id,
        created_at,
        post:forum_posts(
          id,
          content,
          created_at,
          user_id,
          product_id,
          profiles:user_id(display_name),
          produtos:product_id(title)
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Erro ao carregar salvos:', error);
      setSavedPosts([]);
    } else {
      setSavedPosts(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user]);

  const removeSaved = async (postId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from('saved_posts')
      .delete()
      .eq('user_id', user.id)
      .eq('post_id', postId);
    if (error) {
      toast.error('Erro ao remover dos salvos');
      return;
    }
    setSavedPosts(prev => prev.filter(sp => sp.post_id !== postId));
    toast.success('Post removido dos salvos');
  };

  if (!user) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-muted-foreground mb-4">Entre para ver seus posts salvos.</p>
        <Link to="/m/auth" className="inline-block px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold">Entrar</Link>
      </div>
    );
  }

  return (
    <div className="px-4 py-5 space-y-4 pb-24">
      <Link to="/m" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <div className="flex items-center gap-2">
        <BookmarkCheck className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold">Posts salvos</h1>
        <span className="text-xs text-muted-foreground">({savedPosts.length})</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : savedPosts.length === 0 ? (
        <EstadoVazio
          icone={BookmarkCheck}
          titulo="Nenhum post salvo"
          descricao="Salve posts do fórum para vê-los aqui."
          acao={{ label: 'Explorar fórum', to: '/m/forum' }}
        />
      ) : (
        <div className="space-y-2">
          {savedPosts.map((sp) => {
            const post = sp.post;
            const productTitle = (post as any)?.produtos?.title || 'Jogo';
            const authorName = (post as any)?.profiles?.display_name || 'Usuário';
            
            return (
              <div key={sp.id} className="flex items-start gap-3 p-3 bg-card border border-border rounded-xl">
                <Link
                  to={"/m/forum/post/" + post.id}
                  className="flex-1 min-w-0"
                >
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{authorName}</span>
                    <span>em</span>
                    <span className="text-primary">{productTitle}</span>
                    <span>·</span>
                    <span>{timeAgo(post.created_at)}</span>
                  </div>
                  <p className="text-sm text-foreground line-clamp-2 mt-1">{post.content}</p>
                </Link>
                <button
                  onClick={() => removeSaved(post.id)}
                  className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  title="Remover dos salvos"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}