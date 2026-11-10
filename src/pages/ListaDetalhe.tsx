import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, ArrowLeft, List, Users, EyeOff, Share2, Bookmark, BookmarkCheck } from 'lucide-react';
import EstadoVazio from '@/components/EstadoVazio';
import GameCard from '@/components/GameCard';
import { toast } from 'sonner';
import { formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { mapProdutoToGame } from '@/lib/gameData';
import { loadListPreferences, setListPreference } from '@/lib/listPreferences';

export default function ListaDetalhe() {
  const { id } = useParams();
  const { user } = useAuth();
  const [list, setList] = useState(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savingPreference, setSavingPreference] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setList(null);
    setFollowing(false);
    setSaved(false);
    (async () => {
      setLoading(true);
      
      const { data, error } = await supabase
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
      if (cancelled) return;
      if (error) { toast.error('Não foi possível carregar a lista'); setLoading(false); return; }
      
      if (data) {
        setList({
          ...data,
          creator_name: data.creator?.display_name || 'Usuário',
          items: (data.items || []).filter(item => item.game).sort((a, b) => a.sort_order - b.sort_order),
        });
        
        if (user) {
          try {
            const preferences = await loadListPreferences(id, user.id);
            if (!cancelled) { setFollowing(preferences.following); setSaved(preferences.saved); }
          } catch { if (!cancelled) toast.error('Não foi possível carregar suas listas salvas e seguidas'); }
        }
      }
      
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id, user]);

  const toggleFollow = async () => {
    if (!user) {
      toast.error('Faça login para seguir listas');
      return;
    }
    if (!list || savingPreference) return;
    setSavingPreference(true);
    try {
      const next = await setListPreference('curated_list_follows', list.id, user.id, !following);
      setFollowing(next);
      toast.success(next ? 'Seguindo a lista!' : 'Deixou de seguir a lista');
    } catch { toast.error('Não foi possível atualizar as listas seguidas'); }
    finally { setSavingPreference(false); }
  };

  const toggleSave = async () => {
    if (!user) {
      toast.error('Faça login para salvar listas');
      return;
    }
    if (!list || savingPreference) return;
    setSavingPreference(true);
    try {
      const next = await setListPreference('saved_lists', list.id, user.id, !saved);
      setSaved(next);
      toast.success(next ? 'Lista salva!' : 'Removido dos salvos');
    } catch { toast.error('Não foi possível atualizar as listas salvas'); }
    finally { setSavingPreference(false); }
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
            <Button disabled={savingPreference}
              onClick={toggleFollow}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${following ? 'bg-secondary text-foreground border border-border' : 'bg-primary text-primary-foreground'}`}
            >
              <Users className="h-4 w-4" />
              {following ? 'Seguindo' : 'Seguir'}
            </Button>
            <Button disabled={savingPreference}
              onClick={toggleSave}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${saved ? 'bg-primary/10 text-primary border border-primary/40' : 'bg-secondary text-muted-foreground border border-border hover:text-foreground'}`}
            >
              {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
              {saved ? 'Salva' : 'Salvar'}
            </Button>
            <Button
              onClick={shareList}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-secondary text-muted-foreground border border-border hover:text-foreground transition-colors"
            >
              <Share2 className="h-4 w-4" /> Compartilhar
            </Button>
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
              <GameCard game={mapProdutoToGame(item.game)} />
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