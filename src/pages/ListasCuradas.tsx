import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, List, Plus, Users, Eye } from 'lucide-react';
import EstadoVazio from '@/components/EstadoVazio';
import { useAuth } from '@/hooks/useAuth';

export default function ListasCuradas() {
  const { user } = useAuth();
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('curated_lists')
        .select(`
          *,
          creator:profiles!created_by(display_name),
          items:curated_list_items(count)
        `)
        .eq('is_public', true)
        .order('created_at', { ascending: false });
      
      setLists((data || []).map((item) => ({
        ...item,
        item_count: item.items?.[0]?.count || 0,
        creator_name: item.creator?.display_name || 'Usuário',
      })));
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-20 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const visible = showAll ? lists : lists.slice(0, 6);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-3">
          <List className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Listas Curadas</h1>
          <span className="text-sm text-muted-foreground">({lists.length})</span>
        </div>
        {user && (
          <Link
            to="/lista/novo"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" /> Criar lista
          </Link>
        )}
      </div>

      <p className="text-sm text-muted-foreground mb-6">
        Listas criadas pela comunidade e pela equipe MIDIAS para ajudar você a descobrir novos jogos.
      </p>

      {lists.length === 0 ? (
        <EstadoVazio
          icone={List}
          titulo="Nenhuma lista disponível"
          descricao="Seja o primeiro a criar uma lista curada!"
        />
      ) : visible.length === 0 ? (
        <EstadoVazio
          icone={List}
          titulo="Nenhuma lista pública"
          descricao="Volte em breve para ver novas listas."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visible.map((list) => (
              <Link
                key={list.id}
                to={`/lista/${list.id}`}
                className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/50 transition-all group"
              >
                <div className="aspect-video bg-secondary relative">
                  {list.cover_image ? (
                    <img src={list.cover_image} alt={list.title} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <List className="h-12 w-12" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2 text-[10px] font-semibold bg-background/80 backdrop-blur px-2 py-1 rounded-full">
                    {list.item_count} jogos
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold group-hover:text-primary transition-colors">{list.title}</h3>
                  {list.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{list.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>por {list.creator_name}</span>
                    {!list.is_public && (
                      <span className="flex items-center gap-0.5"><Eye className="h-3 w-3" /> Privada</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
          
          {lists.length > 6 && (
            <div className="text-center mt-6">
              <button
                onClick={() => setShowAll(!showAll)}
                className="text-sm text-primary hover:underline"
              >
                {showAll ? 'Ver menos' : `Ver todas (${lists.length})`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}