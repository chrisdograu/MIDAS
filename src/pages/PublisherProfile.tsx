import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ArrowLeft, Globe, Building2, Gamepad2 } from 'lucide-react';
import EstadoVazio from '@/components/EstadoVazio';
import GameCard from '@/components/GameCard';

export default function PublisherProfile() {
  const { id } = useParams();
  const [publisher, setPublisher] = useState(null);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      
      const { data: pub } = await supabase
        .from('publishers')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (!pub) {
        setLoading(false);
        return;
      }
      
      setPublisher(pub);
      
      const { data: prods } = await supabase
        .from('produtos')
        .select('*')
        .eq('publisher_id', id)
        .eq('is_active', true)
        .order('release_date', { ascending: false });
      
      setGames(prods || []);
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-20 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!publisher) {
    return (
      <div className="container mx-auto px-4 py-20">
        <EstadoVazio
          icone={Building2}
          titulo="Publicadora não encontrada"
          descricao="A publicadora que você procura pode não estar cadastrada."
          acao={{ label: 'Voltar ao catálogo', to: '/catalogo' }}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <Link to="/catalogo" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-6">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <div className="bg-card border border-border rounded-2xl p-6 mb-8">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
          <div className="w-24 h-24 rounded-2xl bg-secondary overflow-hidden flex items-center justify-center shrink-0">
            {publisher.logo_url ? (
              <img src={publisher.logo_url} alt={publisher.name} className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <Building2 className="h-10 w-10 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-display font-bold">{publisher.name}</h1>
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
              {publisher.website && (
                <a href={publisher.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                  <Globe className="h-4 w-4" /> Site oficial
                </a>
              )}
              <span className="flex items-center gap-1">
                <Gamepad2 className="h-4 w-4" /> {games.length} {games.length === 1 ? 'jogo' : 'jogos'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {games.length === 0 ? (
        <EstadoVazio
          icone={Gamepad2}
          titulo="Nenhum jogo cadastrado"
          descricao="Esta publicadora ainda não tem jogos na plataforma."
        />
      ) : (
        <>
          <h2 className="text-xl font-bold mb-4">Jogos Publicados</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {games.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}