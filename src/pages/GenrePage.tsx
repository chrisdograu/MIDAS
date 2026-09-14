import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ArrowLeft, Tag, Gamepad2 } from 'lucide-react';
import EstadoVazio from '@/components/EstadoVazio';
import GameCard from '@/components/GameCard';

export default function GenrePage() {
  const { slug } = useParams();
  const [genre, setGenre] = useState('');
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      setLoading(true);
      const genreName = decodeURIComponent(slug);
      setGenre(genreName);

      const { data } = await supabase
        .from('produtos')
        .select('*')
        .eq('category', genreName)
        .eq('is_active', true)
        .order('rating', { ascending: false })
        .limit(50);

      setGames(data || []);
      setLoading(false);
    })();
  }, [slug]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-20 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <Link to="/catalogo" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-6">
        <ArrowLeft className="h-4 w-4" /> Voltar ao catálogo
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <Tag className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">{genre}</h1>
        <span className="text-sm text-muted-foreground">({games.length} jogos)</span>
      </div>

      {games.length === 0 ? (
        <EstadoVazio
          icone={Gamepad2}
          titulo="Nenhum jogo neste gênero"
          descricao="Volte em breve, novos jogos estão chegando."
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {games.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      )}
    </div>
  );
}