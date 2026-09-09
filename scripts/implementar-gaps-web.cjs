#!/usr/bin/env node

/**
 * Script para implementar todos os gaps estruturais do WEB
 * 
 * Como usar:
 *   node scripts/implementar-gaps-web.cjs
 */

const fs = require('fs');
const path = require('path');

// ============================================
// CONFIGURAÇÃO
// ============================================

const PATHS = {
  src: path.join(__dirname, '..', 'src'),
  pages: path.join(__dirname, '..', 'src', 'pages'),
  hooks: path.join(__dirname, '..', 'src', 'hooks'),
  components: path.join(__dirname, '..', 'src', 'components'),
  lib: path.join(__dirname, '..', 'src', 'lib'),
  supabase: path.join(__dirname, '..', 'supabase', 'migrations'),
};

// ============================================
// UTILITÁRIOS
// ============================================

function writeFile(filePath, content) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`✅ Criado: ${filePath}`);
}

function readFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf-8');
}

// ============================================
// 1. CRIAÇÃO DAS PÁGINAS
// ============================================

function createPages() {
  console.log('\n📄 Criando páginas...\n');

  // 1.1 DeveloperProfile.tsx
  writeFile(
    path.join(PATHS.pages, 'DeveloperProfile.tsx'),
    `import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ArrowLeft, Calendar, Globe, Building2, Gamepad2, MapPin } from 'lucide-react';
import EstadoVazio from '@/components/EstadoVazio';
import GameCard from '@/components/GameCard';

export default function DeveloperProfile() {
  const { id } = useParams();
  const [developer, setDeveloper] = useState(null);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      
      const { data: dev } = await supabase
        .from('developers')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (!dev) {
        setLoading(false);
        return;
      }
      
      setDeveloper(dev);
      
      const { data: prods } = await supabase
        .from('produtos')
        .select('*')
        .eq('developer_id', id)
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

  if (!developer) {
    return (
      <div className="container mx-auto px-4 py-20">
        <EstadoVazio
          icone={Building2}
          titulo="Desenvolvedor não encontrado"
          descricao="O estúdio que você procura pode não estar cadastrado."
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
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" /> Fundado em {developer.founded_year}
                </span>
              )}
              {developer.country && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" /> {developer.country}
                </span>
              )}
              {developer.website && (
                <a href={developer.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                  <Globe className="h-4 w-4" /> Site oficial
                </a>
              )}
              <span className="flex items-center gap-1">
                <Gamepad2 className="h-4 w-4" /> {games.length} {games.length === 1 ? 'jogo' : 'jogos'}
              </span>
            </div>
            {developer.bio && (
              <p className="mt-4 text-muted-foreground text-sm leading-relaxed max-w-2xl">{developer.bio}</p>
            )}
          </div>
        </div>
      </div>

      {games.length === 0 ? (
        <EstadoVazio
          icone={Gamepad2}
          titulo="Nenhum jogo cadastrado"
          descricao="Este desenvolvedor ainda não tem jogos na plataforma."
        />
      ) : (
        <>
          <h2 className="text-xl font-bold mb-4">Jogos</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {games.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}`
  );

  // 1.2 DevelopersList.tsx
  writeFile(
    path.join(PATHS.pages, 'DevelopersList.tsx'),
    `import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Building2, Search } from 'lucide-react';
import EstadoVazio from '@/components/EstadoVazio';
import BuscaInput from '@/components/BuscaInput';

export default function DevelopersList() {
  const [developers, setDevelopers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('developers')
        .select('id, name, logo_url, country')
        .order('name');
      
      if (data) {
        const devIds = data.map(d => d.id);
        const { data: games } = await supabase
          .from('produtos')
          .select('developer_id')
          .in('developer_id', devIds);
        
        const counts = new Map();
        games?.forEach(g => {
          counts.set(g.developer_id, (counts.get(g.developer_id) || 0) + 1);
        });
        
        setDevelopers(data.map(d => ({
          ...d,
          game_count: counts.get(d.id) || 0,
        })));
      }
      setLoading(false);
    })();
  }, []);

  const filtered = busca.trim()
    ? developers.filter(d => d.name.toLowerCase().includes(busca.toLowerCase()))
    : developers;

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-20 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-center gap-3 mb-6">
        <Building2 className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Desenvolvedores</h1>
        <span className="text-sm text-muted-foreground">({developers.length})</span>
      </div>

      <BuscaInput
        value={busca}
        onChange={setBusca}
        placeholder="Buscar desenvolvedor..."
        className="mb-6 max-w-md"
      />

      {filtered.length === 0 ? (
        <EstadoVazio
          icone={Building2}
          titulo="Nenhum desenvolvedor encontrado"
          descricao={busca ? 'Tente outro termo de busca.' : 'Ainda não há desenvolvedores cadastrados.'}
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.map((dev) => (
            <Link
              key={dev.id}
              to={\`/desenvolvedor/\${dev.id}\`}
              className="bg-card border border-border rounded-xl p-4 hover:border-primary/50 transition-all text-center group"
            >
              <div className="w-20 h-20 mx-auto rounded-full bg-secondary overflow-hidden flex items-center justify-center">
                {dev.logo_url ? (
                  <img src={dev.logo_url} alt={dev.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <Building2 className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <h3 className="text-sm font-semibold mt-3 group-hover:text-primary transition-colors">{dev.name}</h3>
              <p className="text-xs text-muted-foreground">{dev.game_count} {dev.game_count === 1 ? 'jogo' : 'jogos'}</p>
              {dev.country && <p className="text-[10px] text-muted-foreground mt-0.5">{dev.country}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}`
  );

  // 1.3 GenrePage.tsx
  writeFile(
    path.join(PATHS.pages, 'GenrePage.tsx'),
    `import { useEffect, useState } from 'react';
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
}`
  );

  // 1.4 PublisherProfile.tsx
  writeFile(
    path.join(PATHS.pages, 'PublisherProfile.tsx'),
    `import { useEffect, useState } from 'react';
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
}`
  );

  // 1.5 ListasCuradas.tsx
  writeFile(
    path.join(PATHS.pages, 'ListasCuradas.tsx'),
    `import { useEffect, useState } from 'react';
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
        .select(\`
          *,
          creator:profiles!created_by(display_name),
          items:curated_list_items(count)
        \`)
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
                to={\`/lista/\${list.id}\`}
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
                {showAll ? 'Ver menos' : \`Ver todas (\${lists.length})\`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}`
  );

  // 1.6 ListaDetalhe.tsx
  writeFile(
    path.join(PATHS.pages, 'ListaDetalhe.tsx'),
    `import { useEffect, useState } from 'react';
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
        .select(\`
          *,
          creator:profiles!created_by(display_name),
          items:curated_list_items(
            *,
            game:produtos(*)
          )
        \`)
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
          title: \`\${list?.title} - MIDIAS\`,
          text: \`Confira a lista "\${list?.title}" na MIDIAS!\`,
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
              className={\`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors \${following ? 'bg-secondary text-foreground border border-border' : 'bg-primary text-primary-foreground'}\`}
            >
              <Users className="h-4 w-4" />
              {following ? 'Seguindo' : 'Seguir'}
            </button>
            <button
              onClick={toggleSave}
              className={\`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors \${saved ? 'bg-primary/10 text-primary border border-primary/40' : 'bg-secondary text-muted-foreground border border-border hover:text-foreground'}\`}
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
}`
  );

  // 1.7 Comparador.tsx
  writeFile(
    path.join(PATHS.pages, 'Comparador.tsx'),
    `import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useProdutos } from '@/hooks/useProdutos';
import { Loader2, X, Plus, ArrowLeft, Scale } from 'lucide-react';
import EstadoVazio from '@/components/EstadoVazio';
import { toast } from 'sonner';
import { GameComparisonTable } from '@/components/comparador/GameComparisonTable';

const MAX_COMPARE = 4;

export default function Comparador() {
  const { data: allGames = [], isLoading } = useProdutos();
  const [selectedIds, setSelectedIds] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedGames = allGames.filter(g => selectedIds.includes(g.id));
  const availableGames = allGames.filter(g => !selectedIds.includes(g.id));

  const addGame = (id) => {
    if (selectedIds.length >= MAX_COMPARE) {
      toast.error(\`Máximo de \${MAX_COMPARE} jogos para comparar\`);
      return;
    }
    setSelectedIds([...selectedIds, id]);
    setShowSearch(false);
    setSearchQuery('');
  };

  const removeGame = (id) => {
    setSelectedIds(selectedIds.filter(sid => sid !== id));
  };

  const clearAll = () => {
    setSelectedIds([]);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-20 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const filteredAvailable = availableGames.filter(g => 
    g.title.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 8);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <Link to="/catalogo" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-6">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Scale className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Comparador de Jogos</h1>
          <span className="text-sm text-muted-foreground">({selectedIds.length}/{MAX_COMPARE})</span>
        </div>
        <div className="flex gap-2">
          {selectedIds.length > 0 && (
            <button
              onClick={clearAll}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
            >
              Limpar todos
            </button>
          )}
          <button
            onClick={() => setShowSearch(!showSearch)}
            disabled={selectedIds.length >= MAX_COMPARE}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-colors"
          >
            <Plus className="h-4 w-4" /> Adicionar jogo
          </button>
        </div>
      </div>

      {showSearch && (
        <div className="mb-6 p-4 bg-card border border-border rounded-xl">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar jogos para adicionar..."
            className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <div className="mt-3 max-h-48 overflow-y-auto space-y-1">
            {filteredAvailable.length > 0 ? (
              filteredAvailable.map(game => (
                <button
                  key={game.id}
                  onClick={() => addGame(game.id)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-secondary transition-colors text-left"
                >
                  <img src={game.image} alt={game.title} className="w-10 h-10 rounded object-cover" loading="lazy" />
                  <span className="text-sm font-medium">{game.title}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{game.price}</span>
                </button>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                {searchQuery ? 'Nenhum jogo encontrado' : 'Digite para buscar jogos'}
              </p>
            )}
          </div>
        </div>
      )}

      {selectedIds.length === 0 ? (
        <EstadoVazio
          icone={Scale}
          titulo="Nenhum jogo selecionado"
          descricao="Adicione 2 a 4 jogos para comparar lado a lado."
          acao={{ label: 'Adicionar jogos', onClick: () => setShowSearch(true) }}
        />
      ) : (
        <GameComparisonTable games={selectedGames} onRemove={removeGame} />
      )}
    </div>
  );
}`
  );

  // 1.8 Backlog.tsx
  writeFile(
    path.join(PATHS.pages, 'Backlog.tsx'),
    `import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, ArrowLeft, BookOpen, CheckCircle2, Clock, TrendingUp, ListChecks } from 'lucide-react';
import EstadoVazio from '@/components/EstadoVazio';
import GameCard from '@/components/GameCard';

export default function Backlog() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, completed: 0, playing: 0, completionRate: 0 });

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      
      const { data } = await supabase
        .from('biblioteca_usuario')
        .select(\`
          id,
          product_id,
          status,
          acquired_at,
          game:produtos(*)
        \`)
        .eq('user_id', user.id)
        .in('status', ['quero_jogar', 'jogando', 'pausado', 'zerado', 'platinado', 'abandonado'])
        .order('acquired_at', { ascending: false });
      
      const backlogItems = (data || []).map((item) => ({
        ...item,
        game: item.game,
      }));
      
      setItems(backlogItems);
      
      const total = backlogItems.length;
      const completed = backlogItems.filter(i => i.status === 'zerado' || i.status === 'platinado').length;
      const playing = backlogItems.filter(i => i.status === 'jogando').length;
      
      setStats({
        total,
        completed,
        playing,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      });
      
      setLoading(false);
    })();
  }, [user]);

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <BookOpen className="h-12 w-12 text-primary mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Meu Backlog</h1>
        <p className="text-muted-foreground mb-4">Entre para gerenciar seus jogos pendentes.</p>
        <Link to="/auth" className="text-primary hover:underline">Entrar</Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-20 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const pending = items.filter(i => i.status === 'quero_jogar' || i.status === 'pausado');
  const inProgress = items.filter(i => i.status === 'jogando');
  const completed = items.filter(i => i.status === 'zerado' || i.status === 'platinado');

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <Link to="/biblioteca" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-6">
        <ArrowLeft className="h-4 w-4" /> Voltar à biblioteca
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <ListChecks className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Meu Backlog</h1>
        <span className="text-sm text-muted-foreground">({stats.total} jogos)</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <BookOpen className="h-5 w-5 text-primary mx-auto mb-1" />
          <p className="text-2xl font-bold text-foreground">{stats.total}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <Clock className="h-5 w-5 text-warning mx-auto mb-1" />
          <p className="text-2xl font-bold text-foreground">{inProgress.length}</p>
          <p className="text-xs text-muted-foreground">Jogando</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <CheckCircle2 className="h-5 w-5 text-success mx-auto mb-1" />
          <p className="text-2xl font-bold text-foreground">{stats.completed}</p>
          <p className="text-xs text-muted-foreground">Completados</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <TrendingUp className="h-5 w-5 text-accent mx-auto mb-1" />
          <p className="text-2xl font-bold text-foreground">{stats.completionRate}%</p>
          <p className="text-xs text-muted-foreground">Progresso</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 mb-8">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-muted-foreground">Progresso do backlog</span>
          <span className="font-semibold">{stats.completionRate}%</span>
        </div>
        <div className="h-2 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
            style={{ width: \`\${stats.completionRate}%\` }}
          />
        </div>
      </div>

      {pending.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-warning" /> Pendentes ({pending.length})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {pending.map((item) => (
              <div key={item.id} className="relative">
                <GameCard game={item.game} />
                <span className="absolute top-2 left-2 text-[10px] font-bold bg-warning/90 text-warning-foreground px-1.5 py-0.5 rounded">
                  {item.status === 'quero_jogar' ? 'Quero jogar' : 'Pausado'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {inProgress.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" /> Em andamento ({inProgress.length})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {inProgress.map((item) => (
              <div key={item.id} className="relative">
                <GameCard game={item.game} />
                <span className="absolute top-2 left-2 text-[10px] font-bold bg-primary/90 text-primary-foreground px-1.5 py-0.5 rounded">
                  Jogando
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {completed.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" /> Completados ({completed.length})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {completed.map((item) => (
              <div key={item.id} className="relative">
                <GameCard game={item.game} />
                <span className="absolute top-2 left-2 text-[10px] font-bold bg-success/90 text-success-foreground px-1.5 py-0.5 rounded">
                  {item.status === 'platinado' ? '💎 PLAT' : '✓ Zerado'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {items.length === 0 && (
        <EstadoVazio
          icone={BookOpen}
          titulo="Seu backlog está vazio"
          descricao="Adicione jogos à sua biblioteca e marque-os como 'Quero jogar' para começar."
          acao={{ label: 'Explorar catálogo', to: '/catalogo' }}
        />
      )}
    </div>
  );
}`
  );

  // 1.9 PoliticaPrivacidade.tsx
  writeFile(
    path.join(PATHS.pages, 'PoliticaPrivacidade.tsx'),
    `import { Link } from 'react-router-dom';
import { Shield, ArrowLeft, Mail, Lock, Database, UserCheck, FileText, Trash2 } from 'lucide-react';

export default function PoliticaPrivacidade() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-6">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <div className="text-center mb-8">
        <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
        <h1 className="text-3xl font-bold text-foreground">Política de Privacidade</h1>
        <p className="text-muted-foreground mt-2">Última atualização: 16 de julho de 2026</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 space-y-6">
        <section>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" /> 1. Dados que coletamos
          </h2>
          <p className="text-muted-foreground mt-2">
            A MIDIAS coleta os seguintes dados para fornecer seus serviços:
          </p>
          <ul className="list-disc pl-5 mt-2 text-muted-foreground space-y-1">
            <li><strong>Dados de cadastro:</strong> Nome, e-mail, data de nascimento, telefone, CPF (apenas para vendedores)</li>
            <li><strong>Dados de uso:</strong> Biblioteca de jogos, avaliações, posts, participações em torneios</li>
            <li><strong>Dados de compra:</strong> Histórico de pedidos, chaves de ativação</li>
            <li><strong>Dados técnicos:</strong> Endereço IP, tipo de dispositivo, navegador</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" /> 2. Como usamos seus dados
          </h2>
          <ul className="list-disc pl-5 mt-2 text-muted-foreground space-y-1">
            <li>Entregar jogos e chaves de ativação</li>
            <li>Personalizar sua experiência (recomendações, radar)</li>
            <li>Processar pagamentos e reembolsos</li>
            <li>Enviar notificações sobre pedidos, torneios e novidades</li>
            <li>Melhorar a plataforma com análises de uso</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" /> 3. Compartilhamento de dados
          </h2>
          <p className="text-muted-foreground mt-2">
            A MIDIAS <strong>não vende</strong> seus dados pessoais. Compartilhamos dados apenas:
          </p>
          <ul className="list-disc pl-5 mt-2 text-muted-foreground space-y-1">
            <li>Com prestadores de serviço (pagamentos, e-mail) para operar a plataforma</li>
            <li>Quando exigido por lei ou ordem judicial</li>
            <li>Com seu consentimento explícito</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-primary" /> 4. Seus direitos (LGPD, Art. 18)
          </h2>
          <p className="text-muted-foreground mt-2">
            Você tem direito a:
          </p>
          <ul className="list-disc pl-5 mt-2 text-muted-foreground space-y-1">
            <li><strong>Acesso:</strong> Saber quais dados temos sobre você</li>
            <li><strong>Correção:</strong> Atualizar dados incompletos ou incorretos</li>
            <li><strong>Portabilidade:</strong> Baixar seus dados em formatos JSON/CSV</li>
            <li><strong>Exclusão:</strong> Anonimizar sua conta (exceto dados fiscais obrigatórios)</li>
            <li><strong>Esquecimento:</strong> Solicitar a remoção completa de seus dados</li>
          </ul>
          <p className="text-sm text-muted-foreground mt-3 bg-secondary/30 p-3 rounded-lg">
            <strong>Exercer seus direitos:</strong> Acesse a <Link to="/privacidade" className="text-primary hover:underline">Central de Privacidade</Link> ou entre em contato com nosso Encarregado de Dados.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" /> 5. Encarregado de proteção de dados (DPO)
          </h2>
          <p className="text-muted-foreground mt-2">
            <strong>E-mail:</strong> <a href="mailto:suporte@midias.com.br" className="text-primary hover:underline">suporte@midias.com.br</a>
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            Canal para solicitações de titulares de dados: acesso, correção, portabilidade, anonimização e exclusão.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> 6. Cookies e rastreamento
          </h2>
          <p className="text-muted-foreground mt-2">
            Usamos cookies para:
          </p>
          <ul className="list-disc pl-5 mt-2 text-muted-foreground space-y-1">
            <li>Manter sua sessão ativa</li>
            <li>Lembrar suas preferências (tema, filtros)</li>
            <li>Analisar o uso da plataforma</li>
          </ul>
          <p className="text-sm text-muted-foreground mt-2">
            Você pode desativar cookies nas configurações do seu navegador, mas isso pode afetar algumas funcionalidades.
          </p>
        </section>

        <div className="border-t border-border pt-4 text-xs text-muted-foreground">
          <p>Esta política de privacidade é parte integrante dos <Link to="/termos" className="text-primary hover:underline">Termos de Uso</Link> da MIDIAS.</p>
          <p className="mt-1">Em caso de dúvidas, entre em contato pelo e-mail acima ou pela página de <Link to="/contato" className="text-primary hover:underline">Contato</Link>.</p>
        </div>
      </div>
    </div>
  );
}`
  );

  // 1.10 Equipe.tsx
  writeFile(
    path.join(PATHS.pages, 'Equipe.tsx'),
    `import { Link } from 'react-router-dom';
import { ArrowLeft, Github, Linkedin, Mail, Users } from 'lucide-react';

const teamMembers = [
  {
    id: '1',
    name: 'Christopher',
    role: 'Desenvolvedor Full Stack',
    photo: null,
    bio: 'Responsável pela arquitetura da plataforma, desenvolvimento web e mobile, e integrações com Supabase.',
    github: 'https://github.com',
    linkedin: 'https://linkedin.com',
    email: 'chris@midias.com.br',
  },
];

export default function Equipe() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-6">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 text-primary text-xs mb-3">
          <Users className="h-3 w-3" /> Projeto Acadêmico
        </div>
        <h1 className="text-3xl font-bold text-foreground">Equipe MIDIAS</h1>
        <p className="text-muted-foreground mt-2 max-w-xl mx-auto">
          Conheça as pessoas por trás da plataforma. Este é um projeto de Trabalho de Conclusão de Curso.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {teamMembers.map((member) => (
          <div key={member.id} className="bg-card border border-border rounded-2xl p-6 text-center hover:border-primary/40 transition-colors">
            <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-3xl font-bold text-primary-foreground mb-4">
              {member.photo ? (
                <img src={member.photo} alt={member.name} className="w-full h-full object-cover rounded-full" loading="lazy" />
              ) : (
                member.name[0]
              )}
            </div>
            <h3 className="text-lg font-bold text-foreground">{member.name}</h3>
            <p className="text-sm text-primary font-medium">{member.role}</p>
            {member.bio && (
              <p className="text-sm text-muted-foreground mt-2">{member.bio}</p>
            )}
            <div className="flex items-center justify-center gap-3 mt-4">
              {member.github && (
                <a href={member.github} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-secondary hover:bg-primary/20 transition-colors">
                  <Github className="h-4 w-4" />
                </a>
              )}
              {member.linkedin && (
                <a href={member.linkedin} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-secondary hover:bg-primary/20 transition-colors">
                  <Linkedin className="h-4 w-4" />
                </a>
              )}
              {member.email && (
                <a href={\`mailto:\${member.email}\`} className="p-2 rounded-lg bg-secondary hover:bg-primary/20 transition-colors">
                  <Mail className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 p-6 bg-card border border-border rounded-2xl text-center">
        <p className="text-sm text-muted-foreground">
          Este é um projeto acadêmico desenvolvido como Trabalho de Conclusão de Curso.
          <br />
          A MIDIAS é uma plataforma de jogos digitais com comunidade, marketplace e torneios.
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          © 2026 MIDIAS - Todos os direitos reservados (projeto acadêmico)
        </p>
      </div>
    </div>
  );
}`
  );

  console.log('✅ Páginas criadas com sucesso!\n');
}

// ============================================
// 2. CRIAÇÃO DOS HOOKS
// ============================================

function createHooks() {
  console.log('\n🔗 Criando hooks...\n');

  writeFile(
    path.join(PATHS.hooks, 'useDeveloper.ts'),
    `import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useDeveloper(developerId: string) {
  return useQuery({
    queryKey: ['developer', developerId],
    queryFn: async () => {
      const { data } = await supabase
        .from('developers')
        .select('*, produtos(*)')
        .eq('id', developerId)
        .maybeSingle();
      return data;
    },
    enabled: !!developerId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useDevelopers() {
  return useQuery({
    queryKey: ['developers'],
    queryFn: async () => {
      const { data } = await supabase
        .from('developers')
        .select('*')
        .order('name');
      return data || [];
    },
    staleTime: 10 * 60 * 1000,
  });
}`
  );

  writeFile(
    path.join(PATHS.hooks, 'useCuratedLists.ts'),
    `import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useCuratedLists() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['curated-lists', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('curated_lists')
        .select(\`
          *,
          creator:profiles!created_by(display_name),
          items:curated_list_items(count),
          follows:curated_list_follows(count)
        \`)
        .eq('is_public', true)
        .order('created_at', { ascending: false });
      
      return (data || []).map((item) => ({
        ...item,
        item_count: item.items?.[0]?.count || 0,
        follow_count: item.follows?.[0]?.count || 0,
        creator_name: item.creator?.display_name || 'Usuário',
        is_following: user ? item.follows?.some((f) => f.user_id === user.id) : false,
      }));
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCuratedList(listId: string) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['curated-list', listId, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('curated_lists')
        .select(\`
          *,
          creator:profiles!created_by(display_name),
          items:curated_list_items(
            *,
            game:produtos(*)
          ),
          follows:curated_list_follows(count)
        \`)
        .eq('id', listId)
        .maybeSingle();
      
      if (!data) return null;
      
      return {
        ...data,
        item_count: data.items?.length || 0,
        follow_count: data.follows?.[0]?.count || 0,
        creator_name: data.creator?.display_name || 'Usuário',
        is_following: user ? data.follows?.some((f) => f.user_id === user.id) : false,
        items: data.items || [],
      };
    },
    enabled: !!listId,
    staleTime: 2 * 60 * 1000,
  });
}`
  );

  writeFile(
    path.join(PATHS.hooks, 'useBacklog.ts'),
    `import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useBacklog() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['backlog', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data } = await supabase
        .from('biblioteca_usuario')
        .select(\`
          id,
          product_id,
          status,
          acquired_at,
          game:produtos(*)
        \`)
        .eq('user_id', user.id)
        .in('status', ['quero_jogar', 'jogando', 'pausado', 'zerado', 'platinado', 'abandonado'])
        .order('acquired_at', { ascending: false });
      
      return (data || []).map((item) => ({
        ...item,
        game: item.game,
      }));
    },
    enabled: !!user,
    staleTime: 30 * 1000,
  });
}

export function useBacklogStats() {
  const { data: items } = useBacklog();
  
  if (!items) return { total: 0, completed: 0, playing: 0, pending: 0, completionRate: 0 };
  
  const total = items.length;
  const completed = items.filter(i => i.status === 'zerado' || i.status === 'platinado').length;
  const playing = items.filter(i => i.status === 'jogando').length;
  const pending = items.filter(i => i.status === 'quero_jogar' || i.status === 'pausado').length;
  
  return {
    total,
    completed,
    playing,
    pending,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}`
  );

  console.log('✅ Hooks criados com sucesso!\n');
}

// ============================================
// 3. CRIAÇÃO DOS COMPONENTES
// ============================================

function createComponents() {
  console.log('\n🧩 Criando componentes...\n');

  writeFile(
    path.join(PATHS.components, 'developer', 'DeveloperCard.tsx'),
    `import { Link } from 'react-router-dom';
import { Building2 } from 'lucide-react';

export function DeveloperCard({ id, name, logo_url, game_count }) {
  return (
    <Link
      to={\`/desenvolvedor/\${id}\`}
      className="bg-card border border-border rounded-xl p-4 hover:border-primary/50 transition-all text-center group"
    >
      <div className="w-20 h-20 mx-auto rounded-full bg-secondary overflow-hidden flex items-center justify-center">
        {logo_url ? (
          <img src={logo_url} alt={name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <Building2 className="h-8 w-8 text-muted-foreground" />
        )}
      </div>
      <h3 className="text-sm font-semibold mt-3 group-hover:text-primary transition-colors">{name}</h3>
      <p className="text-xs text-muted-foreground">{game_count} {game_count === 1 ? 'jogo' : 'jogos'}</p>
    </Link>
  );
}`
  );

  writeFile(
    path.join(PATHS.components, 'lists', 'CuratedListCard.tsx'),
    `import { Link } from 'react-router-dom';
import { List, Users } from 'lucide-react';

export function CuratedListCard({ id, title, description, cover_image, item_count, creator_name, follow_count }) {
  return (
    <Link
      to={\`/lista/\${id}\`}
      className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/50 transition-all group"
    >
      <div className="aspect-video bg-secondary relative">
        {cover_image ? (
          <img src={cover_image} alt={title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <List className="h-12 w-12" />
          </div>
        )}
        <div className="absolute top-2 right-2 text-[10px] font-semibold bg-background/80 backdrop-blur px-2 py-1 rounded-full">
          {item_count} jogos
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-semibold group-hover:text-primary transition-colors">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{description}</p>
        )}
        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          <span>por {creator_name}</span>
          <span className="flex items-center gap-0.5"><Users className="h-3 w-3" /> {follow_count}</span>
        </div>
      </div>
    </Link>
  );
}`
  );

  writeFile(
    path.join(PATHS.components, 'comparador', 'GameComparisonTable.tsx'),
    `import { Link } from 'react-router-dom';
import { formatCurrency } from '@/lib/format';
import { HalfStarDisplay } from '@/components/HalfStarRating';
import { X } from 'lucide-react';

export function GameComparisonTable({ games, onRemove }) {
  if (games.length < 2) return null;

  const attributes = [
    { key: 'price', label: 'Preço', render: (g) => (
      <span className="font-bold text-price">{formatCurrency(g.price)}</span>
    )},
    { key: 'rating', label: 'Avaliação', render: (g) => (
      <div className="flex flex-col items-center">
        <HalfStarDisplay rating={g.rating || 0} size={16} />
        <span className="text-xs text-muted-foreground mt-1">{g.rating?.toFixed(1)}</span>
      </div>
    )},
    { key: 'category', label: 'Categoria', render: (g) => g.category },
    { key: 'platform', label: 'Plataformas', render: (g) => g.platform.join(', ') },
    { key: 'publisher', label: 'Publicadora', render: (g) => g.publisher },
    { key: 'tags', label: 'Tags', render: (g) => (
      <div className="flex flex-wrap gap-1 justify-center">
        {g.tags?.slice(0, 4).map(tag => (
          <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary">{tag}</span>
        ))}
      </div>
    )},
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th className="p-3 text-left text-muted-foreground font-medium w-32">Atributo</th>
            {games.map(game => (
              <th key={game.id} className="p-3 text-center min-w-[160px] relative">
                {onRemove && (
                  <button
                    onClick={() => onRemove(game.id)}
                    className="absolute -top-1 -right-1 p-1 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                <img src={game.image} alt={game.title} className="w-16 h-20 mx-auto rounded object-cover mb-2" loading="lazy" />
                <Link to={\`/jogo/\${game.id}\`} className="font-semibold hover:text-primary transition-colors">
                  {game.title}
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {attributes.map((attr) => (
            <tr key={attr.key} className="border-t border-border">
              <td className="p-3 text-muted-foreground font-medium">{attr.label}</td>
              {games.map(game => (
                <td key={game.id} className="p-3 text-center">
                  {attr.render(game)}
                </td>
              ))}
            </tr>
          ))}
          {games.some(g => g.stock !== undefined) && (
            <tr className="border-t border-border">
              <td className="p-3 text-muted-foreground font-medium">Estoque</td>
              {games.map(game => (
                <td key={game.id} className={\`p-3 text-center \${game.stock > 0 ? 'text-success' : 'text-destructive'}\`}>
                  {game.stock > 0 ? \`\${game.stock} un.\` : 'Esgotado'}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}`
  );

  console.log('✅ Componentes criados com sucesso!\n');
}

// ============================================
// 4. ATUALIZAR APP.TSX
// ============================================

function updateAppTsx() {
  console.log('\n📝 Atualizando App.tsx...\n');

  const appPath = path.join(PATHS.src, 'App.tsx');
  let content = readFile(appPath);
  if (!content) {
    console.log('❌ App.tsx não encontrado!');
    return;
  }

  if (content.includes('/desenvolvedor/:id')) {
    console.log('ℹ️ Rotas já existem em App.tsx');
    return;
  }

  const importLines = [
    "import DeveloperProfile from '@/pages/DeveloperProfile';",
    "import DevelopersList from '@/pages/DevelopersList';",
    "import GenrePage from '@/pages/GenrePage';",
    "import PublisherProfile from '@/pages/PublisherProfile';",
    "import ListasCuradas from '@/pages/ListasCuradas';",
    "import ListaDetalhe from '@/pages/ListaDetalhe';",
    "import Comparador from '@/pages/Comparador';",
    "import Backlog from '@/pages/Backlog';",
    "import PoliticaPrivacidade from '@/pages/PoliticaPrivacidade';",
    "import Equipe from '@/pages/Equipe';",
  ];

  const importRegex = /import\s+.*from\s+['"][^'"]+['"];/g;
  const matches = content.match(importRegex);
  if (matches && matches.length > 0) {
    const lastImport = matches[matches.length - 1];
    const lastImportIndex = content.indexOf(lastImport) + lastImport.length;
    content = content.slice(0, lastImportIndex) + '\n' + importLines.join('\n') + content.slice(lastImportIndex);
  }

  const routesBlock = `
          {/* GAPs do WEB - Desenvolvedores, Listas, Comparador, Backlog, Privacidade, Equipe */}
          <Route path="/desenvolvedor/:id" element={<DeveloperProfile />} />
          <Route path="/desenvolvedores" element={<DevelopersList />} />
          <Route path="/genero/:slug" element={<GenrePage />} />
          <Route path="/publicadora/:id" element={<PublisherProfile />} />
          <Route path="/listas" element={<ListasCuradas />} />
          <Route path="/lista/:id" element={<ListaDetalhe />} />
          <Route path="/comparar" element={<Comparador />} />
          <Route path="/backlog" element={<Backlog />} />
          <Route path="/privacidade" element={<PoliticaPrivacidade />} />
          <Route path="/equipe" element={<Equipe />} />`;

  const notFoundIndex = content.indexOf('<Route path="*"');
  if (notFoundIndex !== -1) {
    content = content.slice(0, notFoundIndex) + routesBlock + '\n          ' + content.slice(notFoundIndex);
  }

  writeFile(appPath, content);
  console.log('✅ App.tsx atualizado com sucesso!\n');
}

// ============================================
// 5. ATUALIZAR HEADER.TSX
// ============================================

function updateHeader() {
  console.log('\n📝 Atualizando Header.tsx...\n');

  const headerPath = path.join(PATHS.components, 'Header.tsx');
  let content = readFile(headerPath);
  if (!content) {
    console.log('❌ Header.tsx não encontrado!');
    return;
  }

  if (content.includes('/desenvolvedores')) {
    console.log('ℹ️ Links já existem no Header');
    return;
  }

  const newLinks = `
            <NavLink to="/desenvolvedores" className={({ isActive }) => \`nav-link \${isActive ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}\`}>
              Desenvolvedores
            </NavLink>
            <NavLink to="/listas" className={({ isActive }) => \`nav-link \${isActive ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}\`}>
              Listas
            </NavLink>
            <NavLink to="/comparar" className={({ isActive }) => \`nav-link \${isActive ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}\`}>
              Comparar
            </NavLink>`;

  const navEndRegex = /<\/div>\s*{user\s*&&\s*\(/s;
  const navEndIndex = content.search(navEndRegex);
  if (navEndIndex !== -1) {
    content = content.slice(0, navEndIndex) + newLinks + content.slice(navEndIndex);
  }

  const backlogLink = `
            <Link to="/backlog" className="dropdown-item">
              <span className="flex items-center gap-2">
                <span className="text-base">📋</span> Meu Backlog
              </span>
            </Link>`;

  const libMatch = content.match(/<Link[^>]*to="\/biblioteca"[^>]*>.*?<\/Link>/s);
  if (libMatch) {
    const libIndex = content.indexOf(libMatch[0]) + libMatch[0].length;
    content = content.slice(0, libIndex) + backlogLink + content.slice(libIndex);
  }

  writeFile(headerPath, content);
  console.log('✅ Header.tsx atualizado com sucesso!\n');
}

// ============================================
// 6. ATUALIZAR FOOTER.TSX
// ============================================

function updateFooter() {
  console.log('\n📝 Atualizando Footer.tsx...\n');

  const footerPath = path.join(PATHS.components, 'Footer.tsx');
  let content = readFile(footerPath);
  if (!content) {
    console.log('❌ Footer.tsx não encontrado!');
    return;
  }

  if (content.includes('/privacidade')) {
    console.log('ℹ️ Links já existem no Footer');
    return;
  }

  const newLinks = `
              <Link to="/privacidade" className="text-muted-foreground hover:text-primary transition-colors text-sm">
                Política de Privacidade
              </Link>
              <Link to="/equipe" className="text-muted-foreground hover:text-primary transition-colors text-sm">
                Equipe
              </Link>
              <Link to="/desenvolvedores" className="text-muted-foreground hover:text-primary transition-colors text-sm">
                Desenvolvedores
              </Link>`;

  const footerLinksRegex = /<div[^>]*className="[^"]*flex[^"]*gap[^"]*"[^>]*>[\s\S]*?<\/div>/s;
  const match = content.match(footerLinksRegex);
  if (match) {
    const endIndex = content.indexOf(match[0]) + match[0].length;
    const closeIndex = content.lastIndexOf('</div>', endIndex);
    if (closeIndex !== -1) {
      content = content.slice(0, closeIndex) + newLinks + content.slice(closeIndex);
    }
  }

  writeFile(footerPath, content);
  console.log('✅ Footer.tsx atualizado com sucesso!\n');
}

// ============================================
// 7. ATUALIZAR GAME DETAIL
// ============================================

function updateGameDetail() {
  console.log('\n📝 Atualizando GameDetail.tsx...\n');

  const filePath = path.join(PATHS.pages, 'GameDetail.tsx');
  let content = readFile(filePath);
  if (!content) {
    console.log('❌ GameDetail.tsx não encontrado!');
    return;
  }

  if (content.includes('/desenvolvedor/')) {
    console.log('ℹ️ Links já existem no GameDetail');
    return;
  }

  const publisherLink = `
                  {game.publisher && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Publicadora</span>
                      <span className="text-foreground">{game.publisher}</span>
                    </div>
                  )}`;

  const detailsRegex = /<div[^>]*className="[^"]*bg-card[^"]*border[^"]*rounded-xl[^"]*p-4[^"]*space-y-3[^"]*text-sm[^"]*"[^>]*>[\s\S]*?<\/div>/s;
  const match = content.match(detailsRegex);
  if (match) {
    const detailsContent = match[0];
    const closeIndex = detailsContent.lastIndexOf('</div>');
    if (closeIndex !== -1) {
      const newDetails = detailsContent.slice(0, closeIndex) + publisherLink + detailsContent.slice(closeIndex);
      content = content.replace(detailsRegex, newDetails);
    }
  }

  writeFile(filePath, content);
  console.log('✅ GameDetail.tsx atualizado com sucesso!\n');
}

// ============================================
// 8. ATUALIZAR CATÁLOGO
// ============================================

function updateCatalogo() {
  console.log('\n📝 Atualizando Catalogo.tsx...\n');

  const filePath = path.join(PATHS.pages, 'Catalogo.tsx');
  let content = readFile(filePath);
  if (!content) {
    console.log('❌ Catalogo.tsx não encontrado!');
    return;
  }

  if (content.includes('/desenvolvedores')) {
    console.log('ℹ️ Links já existem no Catalogo');
    return;
  }

  const filterSectionRegex = /<div[^>]*className="[^"]*flex[^>]*items-center[^>]*gap-[^"]*"[^>]*>/;
  if (filterSectionRegex.test(content)) {
    const devLink = `
          <Link to="/desenvolvedores" className="text-xs text-primary hover:underline ml-auto">
            Desenvolvedores →
          </Link>`;
    content = content.replace(filterSectionRegex, (match) => match + devLink);
  }

  writeFile(filePath, content);
  console.log('✅ Catalogo.tsx atualizado com sucesso!\n');
}

// ============================================
// 9. MIGRAÇÕES DO BANCO DE DADOS
// ============================================

function createMigrations() {
  console.log('\n🗄️ Criando migrations do banco de dados...\n');

  const timestamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 14);

  writeFile(
    path.join(PATHS.supabase, `${timestamp}_create_developers_table.sql`),
    `-- Criar tabela de desenvolvedores
CREATE TABLE IF NOT EXISTS developers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  bio TEXT,
  logo_url TEXT,
  website TEXT,
  founded_year INTEGER,
  country TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE produtos ADD COLUMN IF NOT EXISTS developer_id UUID REFERENCES developers(id);

CREATE INDEX IF NOT EXISTS idx_developers_name ON developers(name);
CREATE INDEX IF NOT EXISTS idx_produtos_developer_id ON produtos(developer_id);

ALTER TABLE developers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Developers são públicos" ON developers FOR SELECT USING (true);
CREATE POLICY "Apenas admins podem criar desenvolvedores" ON developers FOR INSERT WITH CHECK (auth.role() = 'admin');
CREATE POLICY "Apenas admins podem atualizar desenvolvedores" ON developers FOR UPDATE USING (auth.role() = 'admin');
CREATE POLICY "Apenas admins podem deletar desenvolvedores" ON developers FOR DELETE USING (auth.role() = 'admin');`
  );

  const ts2 = new Date().toISOString().replace(/[-:]/g, '').slice(0, 14);
  writeFile(
    path.join(PATHS.supabase, `${ts2}_create_publishers_table.sql`),
    `-- Criar tabela de publicadoras
CREATE TABLE IF NOT EXISTS publishers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  website TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE produtos ADD COLUMN IF NOT EXISTS publisher_id UUID REFERENCES publishers(id);

CREATE INDEX IF NOT EXISTS idx_publishers_name ON publishers(name);
CREATE INDEX IF NOT EXISTS idx_produtos_publisher_id ON produtos(publisher_id);

ALTER TABLE publishers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Publishers são públicos" ON publishers FOR SELECT USING (true);
CREATE POLICY "Apenas admins podem criar publishers" ON publishers FOR INSERT WITH CHECK (auth.role() = 'admin');
CREATE POLICY "Apenas admins podem atualizar publishers" ON publishers FOR UPDATE USING (auth.role() = 'admin');
CREATE POLICY "Apenas admins podem deletar publishers" ON publishers FOR DELETE USING (auth.role() = 'admin');`
  );

  const ts3 = new Date().toISOString().replace(/[-:]/g, '').slice(0, 14);
  writeFile(
    path.join(PATHS.supabase, `${ts3}_create_curated_lists.sql`),
    `-- Criar tabela de listas curadas
CREATE TABLE IF NOT EXISTS curated_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  cover_image TEXT,
  is_public BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS curated_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID REFERENCES curated_lists(id) ON DELETE CASCADE,
  product_id UUID REFERENCES produtos(id) ON DELETE CASCADE,
  position INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(list_id, product_id)
);

CREATE TABLE IF NOT EXISTS curated_list_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID REFERENCES curated_lists(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(list_id, user_id)
);

CREATE TABLE IF NOT EXISTS saved_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID REFERENCES curated_lists(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(list_id, user_id)
);

CREATE INDEX idx_curated_lists_created_by ON curated_lists(created_by);
CREATE INDEX idx_curated_lists_is_public ON curated_lists(is_public);
CREATE INDEX idx_curated_list_items_list_id ON curated_list_items(list_id);
CREATE INDEX idx_curated_list_follows_list_id ON curated_list_follows(list_id);
CREATE INDEX idx_curated_list_follows_user_id ON curated_list_follows(user_id);

ALTER TABLE curated_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE curated_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE curated_list_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Listas públicas são visíveis" ON curated_lists FOR SELECT USING (is_public = true OR created_by = auth.uid());
CREATE POLICY "Usuários podem criar listas" ON curated_lists FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Usuários podem editar suas listas" ON curated_lists FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Usuários podem deletar suas listas" ON curated_lists FOR DELETE USING (auth.uid() = created_by);

CREATE POLICY "Itens de listas públicas são visíveis" ON curated_list_items
  FOR SELECT USING (EXISTS (SELECT 1 FROM curated_lists WHERE id = list_id AND (is_public = true OR created_by = auth.uid())));

CREATE POLICY "Usuários podem gerenciar itens de suas listas" ON curated_list_items
  FOR ALL USING (EXISTS (SELECT 1 FROM curated_lists WHERE id = list_id AND created_by = auth.uid()));

CREATE POLICY "Usuários podem seguir listas" ON curated_list_follows FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Usuários podem ver seguidores" ON curated_list_follows FOR SELECT USING (true);
CREATE POLICY "Usuários podem deixar de seguir" ON curated_list_follows FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem gerenciar suas listas salvas" ON saved_lists FOR ALL USING (auth.uid() = user_id);`
  );

  const ts4 = new Date().toISOString().replace(/[-:]/g, '').slice(0, 14);
  writeFile(
    path.join(PATHS.supabase, `${ts4}_create_team_members.sql`),
    `-- Criar tabela de membros da equipe
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  photo_url TEXT,
  bio TEXT,
  github TEXT,
  linkedin TEXT,
  email TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros da equipe são públicos" ON team_members FOR SELECT USING (is_active = true);
CREATE POLICY "Apenas admins podem gerenciar membros" ON team_members FOR ALL USING (auth.role() = 'admin');`
  );

  console.log('✅ Migrations criadas com sucesso!\n');
}

// ============================================
// 10. EXECUÇÃO PRINCIPAL
// ============================================

function main() {
  console.log('\n🚀 Iniciando implementação dos gaps do WEB...\n');
  console.log('='.repeat(60));

  try {
    createPages();
    createHooks();
    createComponents();
    updateAppTsx();
    updateHeader();
    updateFooter();
    updateGameDetail();
    updateCatalogo();
    createMigrations();

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ Todos os gaps foram implementados com sucesso!\n');
    console.log('📋 Resumo:');
    console.log('  - 10 novas páginas');
    console.log('  - 3 novos hooks');
    console.log('  - 3 novos componentes');
    console.log('  - App.tsx atualizado');
    console.log('  - Header.tsx atualizado');
    console.log('  - Footer.tsx atualizado');
    console.log('  - GameDetail.tsx atualizado');
    console.log('  - Catalogo.tsx atualizado');
    console.log('  - 4 novas migrations');
    console.log('\n📌 Lembre-se de:');
    console.log('  1. Rodar as migrations no Supabase');
    console.log('  2. Adicionar dados de desenvolvedores e publicadoras');
    console.log('  3. Adicionar membros da equipe');
    console.log('  4. Testar as novas rotas');
    console.log('\n🎮 MIDIAS agora está mais completo!');

  } catch (error) {
    console.error('\n❌ Erro durante a execução:', error);
  }
}

main();