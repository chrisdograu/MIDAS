import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, ArrowLeft, List, Users, EyeOff, Share2, Bookmark, BookmarkCheck } from 'lucide-react';
import EstadoVazio from '@/components/EstadoVazio';
import GameCard from '@/components/GameCard';
import { toast } from 'sonner';
import { formatDate } from '@/lib/format';

export default function ListaDetalhe() {
  const { id } = useParams();
  const { user } = useAuth();
  const [list, setList] = useState(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      
      const { data } = await supabase
        .from('curated_lists')
        .select(`
          *,
          creator:profiles!created_by(display_name),
          items:curated_list_items(
            *,
            game:produtos(*)
          )
        `)
        .eq('id', id)
        .maybeSingle();
      
      if (data) {
        setList({
          ...data,
          creator_name: data.creator?.display_name || 'Usuário',
          items: data.items || [],
        });
        
        if (user) {
          const { data: follow } = await supabase
            .from('curated_list_follows')
            .select('id')
            .eq('list_id', id)
            .eq('user_id', user.id)
            .maybeSingle();
          setFollowing(!!follow);
        }
      }
      
      setLoading(false);
    })();
  }, [id, user]);

  const toggleFollow = async () => {
    if (!user) {
      toast.error('Faça login para seguir listas');
      return;
    }
    if (!list) return;
    
    if (following) {
      const { error } = await supabase
        .from('curated_list_follows')
        .delete()
        .eq('list_id', list.id)
        .eq('user_id', user.id);
      if (error) {
        toast.error('Erro ao deixar de seguir');
        return;
      }
      setFollowing(false);
      toast.success('Deixou de seguir a lista');
    } else {
      const { error } = await supabase
        .from('curated_list_follows')
        .insert({ list_id: list.id, user_id: user.id });
      if (error) {
        toast.error('Erro ao seguir lista');
        return;
      }
      setFollowing(true);
      toast.success('Seguindo a lista!');
    }
  };

  const toggleSave = async () => {
    if (!user) {
      toast.error('Faça login para salvar listas');
      return;
    }
    if (!list) return;
    
    if (saved) {
      const { error } = await supabase
        .from('saved_lists')
        .delete()
        .eq('list_id', list.id)
        .eq('user_id', user.id);
      if (error) {
        toast.error('Erro ao remover dos salvos');
        return;
      }
      setSaved(false);
      toast.success('Removido dos salvos');
    } else {
      const { error } = await supabase
        .from('saved_lists')
        .insert({ list_id: list.id, user_id: user.id });
      if (error) {
        toast.error('Erro ao salvar lista');
        return;
      }
      setSaved(true);
      toast.success('Lista salva!');
    }
  };

  const shareList = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${list?.title} - MIDIAS`,
          text: `Confira a lista "${list?.title}" na MIDIAS!`,
          url: url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('Link copiado!');
      }
    } catch {
      // Usuário cancelou
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-20 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!list) {
    return (
      <div className="container mx-auto px-4 py-20">
        <EstadoVazio
          icone={List}
          titulo="Lista não encontrada"
          descricao="A lista pode ter sido removida ou tornada privada."
          acao={{ label: 'Ver listas', to: '/listas' }}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <Link to="/listas" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-6">
        <ArrowLeft className="h-4 w-4" /> Voltar às listas
      </Link>

      <div className="bg-card border border-border rounded-2xl p-6 mb-8">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
          <div className="w-32 h-32 rounded-2xl bg-secondary overflow-hidden flex items-center justify-center shrink-0">
            {list.cover_image ? (
              <img src={list.cover_image} alt={list.title} className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <List className="h-12 w-12 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-display font-bold">{list.title}</h1>
              {!list.is_public && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground flex items-center gap-1">
                  <EyeOff className="h-3 w-3" /> Privada
                </span>
              )}
            </div>
            {list.description && (
              <p className="text-muted-foreground mt-2">{list.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-muted-foreground">
              <span>por <span className="text-foreground font-medium">{list.creator_name}</span></span>
              <span>• {formatDate(list.created_at)}</span>
              <span>• {list.items.length} jogos</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={toggleFollow}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${following ? 'bg-secondary text-foreground border border-border' : 'bg-primary text-primary-foreground'}`}
            >
              <Users className="h-4 w-4" />
              {following ? 'Seguindo' : 'Seguir'}
            </button>
            <button
              onClick={toggleSave}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${saved ? 'bg-primary/10 text-primary border border-primary/40' : 'bg-secondary text-muted-foreground border border-border hover:text-foreground'}`}
            >
              {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
              {saved ? 'Salva' : 'Salvar'}
            </button>
            <button
              onClick={shareList}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-secondary text-muted-foreground border border-border hover:text-foreground transition-colors"
            >
              <Share2 className="h-4 w-4" /> Compartilhar
            </button>
          </div>
        </div>
      </div>

      {list.items.length === 0 ? (
        <EstadoVazio
          icone={List}
          titulo="Lista vazia"
          descricao="Esta lista ainda não tem jogos adicionados."
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {list.items.map((item) => (
            <div key={item.id} className="relative">
              <GameCard game={item.game} />
              {item.notes && (
                <div className="absolute bottom-2 left-2 right-2 bg-background/80 backdrop-blur text-xs p-1.5 rounded-lg border border-border/50">
                  {item.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}