import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { 
  Loader2, ArrowLeft, Calendar, Globe, Building2, Gamepad2, MapPin, 
  Users, Twitter, Youtube, Instagram, Facebook, ExternalLink, 
  TrendingUp, Star, Award, Clock, Filter, X, BookOpen
} from 'lucide-react';
import EstadoVazio from '@/components/EstadoVazio';
import GameCard from '@/components/GameCard';
import { Game, mapProdutoToGame } from '@/lib/gameData';
import ErroCarregamento from '@/components/ErroCarregamento';
import { Button } from '@/components/ui/button';

interface Developer {
  id: string;
  name: string;
  banner_url: string | null;
  logo_url: string | null;
  founded_year: number | null;
  country: string | null;
  headquarters: string | null;
  employees: number | null;
  parent_company: string | null;
  website: string | null;
  wikipedia_url: string | null;
  bio: string | null;
  description: string | null;
  notable_games: string[] | null;
  social_links: { twitter?: string; youtube?: string; instagram?: string } | null;
}

export default function DeveloperProfile() {
  const { id } = useParams();
  const [developer, setDeveloper] = useState<Developer | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const [platformFilter, setPlatformFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recent');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(false);
      setDeveloper(null);
      setGames([]);
      if (!id) { setLoading(false); return; }
      try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      const { data: dev, error: devError } = await supabase
        .from('developers')
        .select('*')
        .eq(isUuid ? 'id' : 'slug', id)
        .maybeSingle();
      if (cancelled) return;
      if (devError) throw devError;
      if (!dev) {
        return;
      }
      
      setDeveloper(dev);
      
      const { data: prods, error: productsError } = await supabase
        .from('produtos')
        .select('*')
        .eq('developer_id', dev.id)
        .eq('is_active', true)
        .order('release_date', { ascending: false });
      
      if (cancelled) return;
      if (productsError) throw productsError;
      setGames((prods || []).map(mapProdutoToGame));
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, retry]);

  const getPlatforms = () => {
    const platforms = new Set<string>();
    games.forEach(g => {
      if (g.platform) {
        g.platform.forEach(p => platforms.add(p));
      }
    });
    return ['all', ...Array.from(platforms).sort()];
  };

  const filteredGames = games
    .filter(g => platformFilter === 'all' || (g.platform && g.platform.includes(platformFilter)))
    .sort((a, b) => {
      if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
      if (sortBy === 'price') return a.price - b.price;
      return new Date(b.releaseDate || 0).getTime() - new Date(a.releaseDate || 0).getTime();
    });

  const platforms = getPlatforms();
  const ratedGames = games.filter(game => game.rating > 0);
  const averageRating = ratedGames.length ? ratedGames.reduce((sum, game) => sum + game.rating, 0) / ratedGames.length : null;
  const platformCounts = new Map<string, number>();
  games.forEach(game => game.platform.forEach(platform => platformCounts.set(platform, (platformCounts.get(platform) ?? 0) + 1)));
  const mostCommonPlatform = [...platformCounts].sort((a, b) => b[1] - a[1])[0]?.[0];

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-20 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return <div className="container mx-auto px-4 py-20"><ErroCarregamento titulo="Não foi possível carregar o desenvolvedor" onRetry={() => setRetry(value => value + 1)} /></div>;
  }

  if (!developer) {
    return (
      <div className="container mx-auto px-4 py-20">
        <EstadoVazio
          icone={Building2}
          titulo="Desenvolvedor não encontrado"
          descricao="O estúdio que você procura pode não estar cadastrado."
          acao={{ label: 'Ver desenvolvedores', to: '/desenvolvedores' }}
        />
      </div>
    );
  }

  const socialLinks = developer.social_links || {};

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <Link to="/desenvolvedores" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-6">
        <ArrowLeft className="h-4 w-4" /> Voltar aos desenvolvedores
      </Link>

      {/* Banner */}
      <div className="relative rounded-2xl overflow-hidden mb-6 h-48 md:h-64 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20">
        {developer.banner_url ? (
          <img src={developer.banner_url} alt={developer.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Building2 className="h-16 w-16 text-muted-foreground/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-6 -mt-12 relative z-10">
        <div className="w-24 h-24 rounded-2xl bg-card border-4 border-background overflow-hidden flex items-center justify-center shrink-0">
          {developer.logo_url ? (
            <img src={developer.logo_url} alt={developer.name} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <Building2 className="h-10 w-10 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-display font-bold">{developer.name}</h1>
          <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
            {developer.founded_year && (
              <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> Fundado em {developer.founded_year}</span>
            )}
            {developer.country && (
              <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {developer.country}</span>
            )}
            {developer.headquarters && (
              <span className="flex items-center gap-1"><Building2 className="h-4 w-4" /> {developer.headquarters}</span>
            )}
            {developer.employees && (
              <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {developer.employees} funcionários</span>
            )}
            {developer.parent_company && (
              <span className="flex items-center gap-1"><Building2 className="h-4 w-4" /> {developer.parent_company}</span>
            )}
          </div>
          {developer.website && (
            <a href={developer.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline text-sm mt-2">
              <Globe className="h-4 w-4" /> Site oficial <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {socialLinks.twitter && (
            <a href={socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-secondary hover:bg-primary/20 transition-colors">
              <Twitter className="h-4 w-4" />
            </a>
          )}
          {socialLinks.youtube && (
            <a href={socialLinks.youtube} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-secondary hover:bg-primary/20 transition-colors">
              <Youtube className="h-4 w-4" />
            </a>
          )}
          {socialLinks.instagram && (
            <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-secondary hover:bg-primary/20 transition-colors">
              <Instagram className="h-4 w-4" />
            </a>
          )}
          {developer.wikipedia_url && (
            <a href={developer.wikipedia_url} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-secondary hover:bg-primary/20 transition-colors">
              <BookOpen className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>

      {/* Bio e Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <div className="md:col-span-2">
          {developer.bio && (
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-muted-foreground">{developer.bio}</p>
            </div>
          )}
          {developer.description && (
            <div className="bg-card border border-border rounded-xl p-4 mt-4">
              <h3 className="text-sm font-semibold text-foreground mb-2">Sobre</h3>
              <div className="text-muted-foreground whitespace-pre-wrap text-sm leading-relaxed">
                {developer.description}
              </div>
            </div>
          )}
          {developer.notable_games && developer.notable_games.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4 mt-4">
              <h3 className="text-sm font-semibold text-foreground mb-2">Jogos de destaque</h3>
              <div className="flex flex-wrap gap-2">
                {developer.notable_games.map((game, i) => (
                  <span key={i} className="px-3 py-1 rounded-full bg-secondary text-xs text-foreground">
                    {game}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        <div>
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Estatísticas</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 bg-secondary/40 rounded-lg">
                <Gamepad2 className="h-5 w-5 text-primary mx-auto mb-1" />
                <p className="text-xl font-bold">{games.length}</p>
                <p className="text-[10px] text-muted-foreground">Jogos</p>
              </div>
              <div className="text-center p-3 bg-secondary/40 rounded-lg">
                <Star className="h-5 w-5 text-warning mx-auto mb-1" />
                <p className="text-xl font-bold">{averageRating?.toFixed(1) || '—'}</p>
                <p className="text-[10px] text-muted-foreground">Média</p>
              </div>
              <div className="text-center p-3 bg-secondary/40 rounded-lg">
                <Award className="h-5 w-5 text-price mx-auto mb-1" />
                <p className="text-xl font-bold">{mostCommonPlatform || '—'}</p>
                <p className="text-[10px] text-muted-foreground">Plataforma</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Jogos */}
      {games.length > 0 ? (
        <div className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Gamepad2 className="h-5 w-5 text-primary" /> Jogos ({games.length})
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              {platforms.length > 1 && (
                <div className="flex items-center gap-1 bg-secondary/40 rounded-lg p-1">
                  {platforms.map(p => (
                    <Button
                      key={p}
                      variant={platformFilter === p ? 'default' : 'ghost'}
                      size="sm"
                      aria-pressed={platformFilter === p}
                      onClick={() => setPlatformFilter(p)}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${platformFilter === p ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      {p === 'all' ? 'Todos' : p}
                    </Button>
                  ))}
                </div>
              )}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-1.5 bg-card border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="recent">Lançamento</option>
                <option value="rating">Avaliação</option>
                <option value="price">Preço</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredGames.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
          {filteredGames.length === 0 && (
            <p className="text-center text-muted-foreground py-8">Nenhum jogo encontrado com estes filtros.</p>
          )}
        </div>
      ) : (
        <div className="mt-8">
          <EstadoVazio
            icone={Gamepad2}
            titulo="Nenhum jogo cadastrado"
            descricao="Este desenvolvedor ainda não tem jogos na plataforma."
          />
        </div>
      )}
    </div>
  );
}