import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { 
  Loader2, ArrowLeft, Calendar, Globe, Building2, Gamepad2, MapPin, 
  Users, Twitter, Youtube, Instagram, Facebook, ExternalLink, 
  Star, BookOpen
} from 'lucide-react';
import EstadoVazio from '@/components/EstadoVazio';
import { Game, mapProdutoToGame } from '@/lib/gameData';
import ErroCarregamento from '@/components/ErroCarregamento';
import { buttonVariants } from '@/components/ui/button';
import DeveloperUpdates from '@/components/developer/DeveloperUpdates';
import DeveloperGameCatalog from '@/components/developer/DeveloperGameCatalog';
import { releaseYear } from '@/lib/developerCatalog';

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
  social_links: { twitter?: string; youtube?: string; instagram?: string; facebook?: string; discord?: string } | null;
}

export default function DeveloperProfile() {
  const { id } = useParams();
  const [developer, setDeveloper] = useState<Developer | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);

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

  const ratedGames = games.filter(game => game.rating > 0);
  const averageRating = ratedGames.length ? ratedGames.reduce((sum, game) => sum + game.rating, 0) / ratedGames.length : null;
  const platforms = [...new Set(games.flatMap(game => game.platform))].sort();
  const categories = [...new Set(games.map(game => game.category))].sort();
  const years = games.map(releaseYear).filter(Boolean).sort();
  const discountedGames = games.filter(game => game.originalPrice > game.price).length;

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
      <div className="relative rounded-lg overflow-hidden mb-6 h-48 md:h-64 bg-secondary">
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
        <div className="w-24 h-24 rounded-lg bg-card border-4 border-background overflow-hidden flex items-center justify-center shrink-0">
          {developer.logo_url ? (
            <img src={developer.logo_url} alt={developer.name} className="w-full h-full object-contain" loading="lazy" />
          ) : (
            <Building2 className="h-10 w-10 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-display font-bold break-words">{developer.name}</h1>
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
            <a href={socialLinks.twitter} aria-label="X / Twitter" title="X / Twitter" target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-secondary hover:bg-primary/20 transition-colors">
              <Twitter className="h-4 w-4" />
            </a>
          )}
          {socialLinks.youtube && (
            <a href={socialLinks.youtube} aria-label="YouTube" title="YouTube" target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-secondary hover:bg-primary/20 transition-colors">
              <Youtube className="h-4 w-4" />
            </a>
          )}
          {socialLinks.instagram && (
            <a href={socialLinks.instagram} aria-label="Instagram" title="Instagram" target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-secondary hover:bg-primary/20 transition-colors">
              <Instagram className="h-4 w-4" />
            </a>
          )}
          {socialLinks.facebook && <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="p-2 rounded-lg bg-secondary"><Facebook className="h-4 w-4" /></a>}
          {socialLinks.discord && <a href={socialLinks.discord} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-secondary text-sm">Discord</a>}
          {developer.wikipedia_url && (
            <a href={developer.wikipedia_url} aria-label="Wikipédia" title="Wikipédia" target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-secondary hover:bg-primary/20 transition-colors">
              <BookOpen className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>

      <nav aria-label="Seções do desenvolvedor" className="flex flex-wrap gap-2 mt-6 border-b border-border pb-4">
        <a className={buttonVariants({ variant: 'ghost', size: 'sm' })} href="#sobre">Sobre o estúdio</a>
        <a className={buttonVariants({ variant: 'ghost', size: 'sm' })} href="#jogos">Jogos ({games.length})</a>
        <a className={buttonVariants({ variant: 'ghost', size: 'sm' })} href="#publicacoes">Publicações oficiais</a>
      </nav>

      <section id="sobre" className="scroll-mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 mt-6">
        <div className="md:col-span-2 min-w-0 space-y-5">
          <h2 className="text-xl font-bold">Sobre {developer.name}</h2>
          {developer.bio && <p className="text-foreground leading-relaxed whitespace-pre-wrap break-words">{developer.bio}</p>}
          {developer.description && <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed break-words">{developer.description}</p>}
          {!developer.bio && !developer.description && <p className="text-sm text-muted-foreground">O estúdio ainda não adicionou uma descrição.</p>}
          {developer.notable_games && developer.notable_games.length > 0 && <div>
            <h3 className="text-sm font-semibold mb-2">Jogos de destaque</h3>
            <div className="flex flex-wrap gap-2">{developer.notable_games.map((title, index) => {
              const game = games.find(item => item.title.toLocaleLowerCase() === title.toLocaleLowerCase());
              return game ? <Link key={index} className={buttonVariants({ variant: 'secondary', size: 'sm' })} to={`/jogo/${game.id}`}>{title}</Link> : <span key={index} className="px-3 py-1.5 rounded-md bg-secondary text-xs break-words">{title}</span>;
            })}</div>
          </div>}
          {categories.length > 0 && <div><h3 className="text-sm font-semibold mb-2">Categorias no catálogo</h3><p className="text-sm text-muted-foreground">{categories.join(' · ')}</p></div>}
        </div>
        <aside className="border-t md:border-t-0 md:border-l border-border pt-5 md:pt-0 md:pl-6 min-w-0 space-y-5">
          <div><h3 className="text-sm font-semibold mb-3">Informações do estúdio</h3><dl className="space-y-3 text-sm">
            {developer.founded_year && <div><dt className="text-xs text-muted-foreground">Fundação</dt><dd>{developer.founded_year}</dd></div>}
            {developer.country && <div><dt className="text-xs text-muted-foreground">País</dt><dd>{developer.country}</dd></div>}
            {developer.headquarters && <div><dt className="text-xs text-muted-foreground">Sede</dt><dd className="break-words">{developer.headquarters}</dd></div>}
            {developer.employees != null && <div><dt className="text-xs text-muted-foreground">Equipe do estúdio</dt><dd>{developer.employees.toLocaleString('pt-BR')} funcionários</dd></div>}
            {developer.parent_company && <div><dt className="text-xs text-muted-foreground">Empresa controladora</dt><dd className="break-words">{developer.parent_company}</dd></div>}
            {!developer.founded_year && !developer.country && !developer.headquarters && developer.employees == null && !developer.parent_company && <div><dd className="text-muted-foreground">Informações ainda não adicionadas.</dd></div>}
          </dl></div>
          <div className="border-t border-border pt-4"><h3 className="text-sm font-semibold mb-3">Catálogo na MIDIAS</h3>
            <dl className="grid grid-cols-2 gap-4">
              <div><dt className="text-xs text-muted-foreground">Jogos</dt><dd className="text-xl font-semibold">{games.length}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Avaliação média</dt><dd className="text-xl font-semibold flex items-center gap-1"><Star className="h-4 w-4 text-warning" />{averageRating?.toFixed(1) || '—'}</dd>{ratedGames.length > 0 && <p className="text-xs text-muted-foreground">{ratedGames.length} jogos avaliados</p>}</div>
              <div><dt className="text-xs text-muted-foreground">Em oferta</dt><dd className="text-xl font-semibold">{discountedGames}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Lançamentos</dt><dd className="text-sm font-medium mt-1">{years.length ? years[0] === years[years.length - 1] ? years[0] : `${years[0]}–${years[years.length - 1]}` : '—'}</dd></div>
            </dl>
            {platforms.length > 0 && <div className="mt-4"><p className="text-xs text-muted-foreground mb-1">Plataformas</p><p className="text-sm break-words">{platforms.join(' · ')}</p></div>}
          </div>
        </aside>
      </section>
      <DeveloperGameCatalog key={developer.id} games={games} />
      <div id="publicacoes" className="scroll-mt-24"><DeveloperUpdates key={developer.id} developerId={developer.id} name={developer.name} logo={developer.logo_url} /></div>
    </div>
  );
}
