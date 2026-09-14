import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useBiblioteca } from '@/hooks/useBiblioteca';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Library, Gamepad2, Camera, Tag, Pencil, ListPlus, Eye, EyeOff, Clock, Filter, BookOpen } from 'lucide-react';
import EstadoVazio from '@/components/EstadoVazio';
import BuscaInput from '@/components/BuscaInput';
import { GameCardGridSkeleton } from '@/components/skeletons';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import CustomCoverEditor from '@/components/biblioteca/CustomCoverEditor';
import ListaVisibilidadePanel from '@/components/biblioteca/ListaVisibilidadePanel';
import { useListas } from '@/components/biblioteca/ListasDoJogo';
import VisibilityQuickToggle from '@/components/social/VisibilityQuickToggle';
import SelectSimples from '@/components/SelectSimples';
import { CosmeticUnlocksCenter } from '@/components/cosmetics/CosmeticUnlocksCenter';

type StatusFilter = 'todos' | 'ja_joguei' | 'quero_jogar';
type SortKey = 'recent' | 'title' | 'status' | 'playtime';

// GAP-039, GAP-125, GAP-398: Paginação
const ITEMS_PER_PAGE = 24;

const LIMPA_KEY = 'biblioteca-modo-limpo';

export default function Biblioteca() {
  const { biblioteca, updateStatus, updateListaCustom, isLoading } = useBiblioteca();
  const { user } = useAuth();
  const [filter, setFilter] = useState<StatusFilter>('todos');
  const [sort, setSort] = useState<SortKey>('recent');
  const [platform, setPlatform] = useState<string>('todas');
  const [listaFilter, setListaFilter] = useState<string>('todas');
  const [listaIdFilter, setListaIdFilter] = useState<string>('todas');
  const [busca, setBusca] = useState('');
  const [editingLista, setEditingLista] = useState<{ id: string; current: string } | null>(null);
  // GAP-039, GAP-125, GAP-398: Estado de paginação
  const [page, setPage] = useState(1);

  // GAP-127, GAP-400: Filtro por gênero (categoria)
  const [genreFilter, setGenreFilter] = useState<string>('todos');

  // GAP-128, GAP-401: Horas totais
  const [totalHours, setTotalHours] = useState(0);

  // Modo limpo
  const [modoLimpo, setModoLimpo] = useState(false);
  useEffect(() => {
    if (typeof localStorage !== 'undefined') setModoLimpo(localStorage.getItem(LIMPA_KEY) === '1');
  }, []);
  const toggleModoLimpo = () => {
    setModoLimpo(v => {
      const next = !v;
      try { localStorage.setItem(LIMPA_KEY, next ? '1' : '0'); } catch { /* storage bloqueado */ }
      return next;
    });
  };

  // GAP-128, GAP-401: Calcular horas totais da biblioteca
  useEffect(() => {
    const total = biblioteca.reduce((acc, item) => {
      // Usar hours_played do item ou valor padrão
      return acc + ((item as any).hours_played || 0);
    }, 0);
    setTotalHours(Math.round(total * 10) / 10);
  }, [biblioteca]);

  const stats = {
    total: biblioteca.length,
    completed: biblioteca.filter(b => (b as any).badge_completed).length,
    platinum: biblioteca.filter(b => (b as any).badge_platinum).length,
    playing: biblioteca.filter(b => b.status === 'jogando').length,
  };

  const [editingCover, setEditingCover] = useState<{ id: string; title: string; image: string | null } | null>(null);

  const { data: customCovers = {}, refetch: refetchCovers } = useQuery({
    queryKey: ['library-custom-covers', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('library_custom_covers' as any).select('product_id, cover_url').eq('user_id', user!.id);
      const map: Record<string, string> = {};
      ((data as any[]) || []).forEach(r => { map[r.product_id] = r.cover_url; });
      return map;
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  // GAP-127, GAP-400: Extrair todos os gêneros da biblioteca
  const allGenres = useMemo(() => {
    const genres = new Set<string>();
    biblioteca.forEach(item => {
      if (item.produto?.category) {
        genres.add(item.produto.category);
      }
    });
    return Array.from(genres).sort();
  }, [biblioteca]);

  const JA_JOGUEI_STATUSES = ['ja_joguei', 'zerado', 'platinado', 'jogando', 'rejogando', 'pausado', 'abandonado'];
  const allPlatforms = Array.from(new Set(biblioteca.flatMap(b => b.produto?.platform || []))).sort();

  const allListas = useMemo(
    () => Array.from(new Set(biblioteca.map(b => (b as any).lista_custom).filter((v): v is string => !!v))).sort(),
    [biblioteca]
  );

  const { data: listas = [] } = useListas();
  const { data: itensPorProduto = {} } = useQuery({
    queryKey: ['biblioteca-listas-mapa', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('biblioteca_lista_itens')
        .select('product_id, lista_id')
        .eq('user_id', user!.id);
      if (error) throw error;
      const map: Record<string, string[]> = {};
      (data ?? []).forEach((r: any) => {
        map[r.product_id] = [...(map[r.product_id] || []), r.lista_id];
      });
      return map;
    },
    staleTime: 30_000,
  });

  const listaNome = useMemo(
    () => new Map(listas.map(l => [l.id, l.nome] as const)),
    [listas]
  );

  // GAP-127, GAP-400: Filtrar por gênero
  const base = filter === 'todos'
    ? biblioteca
    : filter === 'ja_joguei'
      ? biblioteca.filter(b => JA_JOGUEI_STATUSES.includes(b.status))
      : biblioteca.filter(b => b.status === filter);

  const genreFiltered = genreFilter === 'todos'
    ? base
    : base.filter(b => b.produto?.category === genreFilter);

  const platformFiltered = platform === 'todas' ? genreFiltered : genreFiltered.filter(b => (b.produto?.platform || []).includes(platform));
  const listaIdFiltered = listaIdFilter === 'todas'
    ? platformFiltered
    : listaIdFilter === '__sem'
      ? platformFiltered.filter(b => !(itensPorProduto[b.product_id]?.length))
      : platformFiltered.filter(b => (itensPorProduto[b.product_id] || []).includes(listaIdFilter));
  const listaFiltered = listaFilter === 'todas'
    ? listaIdFiltered
    : listaFilter === '__sem'
      ? listaIdFiltered.filter(b => !(b as any).lista_custom)
      : listaIdFiltered.filter(b => (b as any).lista_custom === listaFilter);

  const termo = busca.trim().toLowerCase();
  const searched = termo
    ? listaFiltered.filter(b =>
        (b.produto?.title || '').toLowerCase().includes(termo) ||
        ((b as any).lista_custom || '').toLowerCase().includes(termo))
    : listaFiltered;

  // GAP-126, GAP-399: Ordenação por "mais jogadas" (playtime)
  const filtered = [...searched].sort((a, b) => {
    if (sort === 'title') return (a.produto?.title || '').localeCompare(b.produto?.title || '');
    if (sort === 'status') return (a.status || '').localeCompare(b.status || '');
    if (sort === 'playtime') {
      const hoursA = (a as any).hours_played || 0;
      const hoursB = (b as any).hours_played || 0;
      return hoursB - hoursA;
    }
    return new Date(b.acquired_at).getTime() - new Date(a.acquired_at).getTime();
  });

  // GAP-039, GAP-125, GAP-398: Paginação
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedItems = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [filter, sort, platform, listaFilter, listaIdFilter, busca, genreFilter]);

  const completionPct = stats.total ? Math.round((stats.completed / stats.total) * 100) : 0;

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await updateStatus.mutateAsync({ id, status: newStatus });
      toast.success('Status atualizado!');
    } catch {
      toast.error('Erro ao atualizar status');
    }
  };

  const handleSaveLista = async (id: string, value: string) => {
    try {
      await updateListaCustom.mutateAsync({ id, lista: value.trim() ? value : null });
      toast.success(value.trim() ? 'Etiqueta salva' : 'Etiqueta removida');
      setEditingLista(null);
    } catch {
      toast.error('Erro ao salvar etiqueta');
    }
  };
  const savingLista = updateListaCustom.isPending;

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <GameCardGridSkeleton count={12} />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <Library className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Minha biblioteca</h1>
        {/* GAP-128, GAP-401: Horas totais no header */}
        {totalHours > 0 && (
          <span className="text-sm text-muted-foreground ml-2 flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {totalHours}h jogadas
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={toggleModoLimpo}
            aria-pressed={modoLimpo}
            className={`nav-item px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-border ${modoLimpo ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
            title={modoLimpo ? 'Mostrar controles de configuração' : 'Biblioteca limpa: só as capas'}
          >
            {modoLimpo ? <><Eye className="h-3.5 w-3.5" /> Mostrar controles</> : <><EyeOff className="h-3.5 w-3.5" /> Biblioteca limpa</>}
          </button>
          <CosmeticUnlocksCenter customizationHref="/perfil" variant="compact" />
          <VisibilityQuickToggle
            column="library_visibility"
            title="Quem vê sua biblioteca"
            description="Mesmo controle da Central de Privacidade."
          />
        </div>
      </div>

      {/* Stats */}
      {stats.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-3">
          {[
            { l: 'Total', v: stats.total, c: 'text-primary' },
            { l: 'Jogando', v: stats.playing, c: 'text-accent' },
            { l: 'Completados', v: stats.completed, c: 'text-accent' },
            { l: 'Platinados', v: stats.platinum, c: 'text-primary' },
            // GAP-128, GAP-401: Horas totais nos stats
            { l: 'Horas', v: `${Math.round(totalHours)}h`, c: 'text-muted-foreground' },
          ].map(s => (
            <div key={s.l} className="bg-card border border-border rounded-lg p-3">
              <p className="text-[10px] uppercase text-muted-foreground tracking-wide">{s.l}</p>
              <p className={`text-2xl font-bold mt-0.5 ${s.c}`}>{s.v}</p>
            </div>
          ))}
        </div>
      )}

      {/* Progress summary */}
      {stats.total > 0 && (
        <div className="bg-card border border-border rounded-lg p-3 mb-5">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-muted-foreground">Progresso da coleção</span>
            <span className="font-semibold text-foreground">{stats.completed}/{stats.total} concluídos ({completionPct}%)</span>
          </div>
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary via-accent to-accent transition-all" style={{ width: `${completionPct}%` }} />
          </div>
        </div>
      )}

      {/* Busca */}
      {biblioteca.length > 0 && (
        <BuscaInput
          value={busca}
          onChange={setBusca}
          placeholder="Buscar na sua biblioteca por título, gênero ou etiqueta..."
          className="mb-3"
        />
      )}

      {/* Filters + sort */}
      <div className="flex flex-wrap gap-2 mb-3 items-center">
        {([
          { key: 'todos' as const, label: 'Todos' },
          { key: 'quero_jogar' as const, label: 'Quero jogar' },
          { key: 'ja_joguei' as const, label: 'Já joguei' },
        ]).map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === f.key ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
            {f.label}
          </button>
        ))}
        <SelectSimples
          value={sort}
          onChange={v => setSort(v as SortKey)}
          size="sm"
          label="Ordenar biblioteca"
          className="ml-auto w-auto min-w-[9.5rem]"
          options={[
            { value: 'recent', label: 'Mais recentes' },
            { value: 'title', label: 'Título A-Z' },
            { value: 'status', label: 'Status' },
            // GAP-126, GAP-399: Ordenação por "mais jogadas"
            { value: 'playtime', label: 'Mais jogadas' },
          ]}
        />
      </div>

      {/* GAP-127, GAP-400: Filtro por gênero */}
      {!modoLimpo && allGenres.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-6 items-center">
          <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] uppercase text-muted-foreground tracking-wide mr-1">Gênero</span>
          <button onClick={() => setGenreFilter('todos')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${genreFilter === 'todos' ? 'bg-accent text-accent-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
            Todos
          </button>
          {allGenres.map(g => (
            <button key={g} onClick={() => setGenreFilter(g)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${genreFilter === g ? 'bg-accent text-accent-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
              {g}
            </button>
          ))}
        </div>
      )}

      {!modoLimpo && allPlatforms.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-6">
          <button onClick={() => setPlatform('todas')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${platform === 'todas' ? 'bg-accent text-accent-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
            Todas as plataformas
          </button>
          {allPlatforms.map(p => (
            <button key={p} onClick={() => setPlatform(p)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${platform === p ? 'bg-accent text-accent-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Listas personalizadas */}
      {!modoLimpo && listas.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-6 items-center">
          <ListPlus className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] uppercase text-muted-foreground tracking-wide mr-1">Listas</span>
          <button onClick={() => setListaIdFilter('todas')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${listaIdFilter === 'todas' ? 'bg-accent/80 text-accent-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
            Todas
          </button>
          {listas.map(l => (
            <button key={l.id} onClick={() => setListaIdFilter(l.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${listaIdFilter === l.id ? 'bg-accent/80 text-accent-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
              {l.nome}
            </button>
          ))}
          <button onClick={() => setListaIdFilter('__sem')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${listaIdFilter === '__sem' ? 'bg-accent/80 text-accent-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
            Fora de listas
          </button>
        </div>
      )}

      {!modoLimpo && allListas.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-6 items-center">
          <Tag className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] uppercase text-muted-foreground tracking-wide mr-1">Etiquetas</span>
          <button onClick={() => setListaFilter('todas')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${listaFilter === 'todas' ? 'bg-primary/80 text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
            Todas
          </button>
          {allListas.map(l => (
            <button key={l} onClick={() => setListaFilter(l)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${listaFilter === l ? 'bg-primary/80 text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
              {l}
            </button>
          ))}
          <button onClick={() => setListaFilter('__sem')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${listaFilter === '__sem' ? 'bg-primary/80 text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
            Sem etiqueta
          </button>
        </div>
      )}

      {!modoLimpo && <ListaVisibilidadePanel listas={allListas} />}

      {filtered.length === 0 ? (
        <EstadoVazio
          icone={Gamepad2}
          titulo={termo ? 'Nenhum jogo encontrado' : filter === 'todos' ? 'Sua biblioteca está vazia' : 'Nenhum jogo nesta categoria'}
          descricao={termo ? `Nada corresponde a "${busca.trim()}". Tente outro termo ou limpe a busca.` : filter === 'todos' ? 'Compre jogos para adicioná-los aqui.' : undefined}
          acao={!termo && filter === 'todos' ? { label: 'Explorar catálogo', to: '/catalogo' } : undefined}
        />
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">
              {filtered.length} jogos {page > 1 && `— Página ${page} de ${totalPages}`}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {paginatedItems.map((item, i) => {
              const platinum = (item as any).badge_platinum;
              const completed = (item as any).badge_completed;
              // GAP-129, GAP-402: Verificar se o jogo está emprestado
              const isLoaned = (item as any).is_loaned || false;
              return (
                <motion.div key={item.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="bg-card border border-border rounded-lg overflow-hidden hover:border-primary/50 transition-colors group">
                  <Link to={`/biblioteca/${item.product_id}`}>
                    <div className="aspect-[3/4] overflow-hidden relative">
                      <img src={customCovers[item.product_id] || item.produto?.image_url || '/placeholder.svg'} alt={item.produto?.title || ''} className="w-full h-full object-cover hover:scale-105 transition-transform" loading="lazy" />
                      {customCovers[item.product_id] && (
                        <span className="absolute bottom-1.5 left-1.5 text-[9px] px-1.5 py-0.5 rounded bg-primary/80 text-primary-foreground font-semibold">CUSTOM</span>
                      )}
                      {/* GAP-129, GAP-402: Badge de jogo emprestado */}
                      {isLoaned && (
                        <span className="absolute top-1.5 left-1.5 text-[10px] font-bold bg-amber-500/90 text-white px-1.5 py-0.5 rounded-full shadow-lg">
                          📤 Emprestado
                        </span>
                      )}
                      {(platinum || completed) && (
                        <div className="absolute top-1.5 right-1.5 flex flex-col gap-1">
                          {platinum && (
                            <span title="Platinado" className="text-[10px] font-bold bg-gradient-to-br from-primary to-primary/70 text-primary-foreground px-1.5 py-0.5 rounded-full shadow-lg">💎 PLAT</span>
                          )}
                          {completed && !platinum && (
                            <span title="Completado" className="text-[10px] font-bold bg-gradient-to-br from-accent to-accent/70 text-accent-foreground px-1.5 py-0.5 rounded-full shadow-lg">✓ 100%</span>
                          )}
                        </div>
                      )}
                    </div>
                  </Link>
                  <div className="p-3 space-y-2">
                    <Link to={`/biblioteca/${item.product_id}`}>
                      <h3 className="text-sm font-semibold text-foreground line-clamp-2 leading-tight hover:text-primary">{item.produto?.title}</h3>
                    </Link>
                    <div className="flex flex-wrap gap-1">
                      {(item.produto?.platform || []).map(p => (
                        <span key={p} className="text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded">{p}</span>
                      ))}
                    </div>
                    {/* GAP-126, GAP-399: Exibir horas jogadas no card */}
                    {(item as any).hours_played > 0 && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {(item as any).hours_played}h
                      </span>
                    )}
                    {/* Listas N:N */}
                    {(itensPorProduto[item.product_id] || []).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {(itensPorProduto[item.product_id] || []).map(lid => (
                          <button
                            key={lid}
                            onClick={() => setListaIdFilter(lid)}
                            title={`Filtrar por "${listaNome.get(lid) || 'lista'}"`}
                            className="text-[10px] px-1.5 py-0.5 rounded-full border border-accent/40 bg-accent/10 text-accent max-w-full truncate"
                          >
                            {listaNome.get(lid) || 'lista'}
                          </button>
                        ))}
                      </div>
                    )}
                    {!modoLimpo && (
                      <SelectSimples
                        value={item.status}
                        onChange={v => handleStatusChange(item.id, v)}
                        size="sm"
                        label="Status do jogo na biblioteca"
                        className="w-full"
                        options={[
                          { value: 'quero_jogar', label: 'Quero jogar' },
                          { value: 'jogando', label: 'Jogando' },
                          { value: 'pausado', label: 'Pausado' },
                          { value: 'zerado', label: 'Completado' },
                          { value: 'platinado', label: 'Platinado' },
                          { value: 'rejogando', label: 'Rejogando' },
                          { value: 'abandonado', label: 'Abandonado' },
                        ]}
                      />
                    )}
                    {!modoLimpo && (
                      <>
                        <button onClick={() => setEditingCover({ id: item.product_id, title: item.produto?.title || '', image: item.produto?.image_url || null })}
                          className="w-full px-2 py-1 bg-secondary hover:bg-primary/20 border border-border rounded text-[10px] font-medium flex items-center justify-center gap-1">
                          <Camera className="h-3 w-3" /> {customCovers[item.product_id] ? 'Editar capa' : 'Capa custom'}
                        </button>
                        <button onClick={() => setEditingLista({ id: item.id, current: (item as any).lista_custom || '' })}
                          className="w-full px-2 py-1 bg-secondary hover:bg-primary/20 border border-border rounded text-[10px] font-medium flex items-center justify-center gap-1 truncate"
                          title={(item as any).lista_custom || 'Adicionar etiqueta'}>
                          {(item as any).lista_custom
                            ? (<><Tag className="h-3 w-3 flex-shrink-0 text-primary" /><span className="truncate">{(item as any).lista_custom}</span><Pencil className="h-2.5 w-2.5 flex-shrink-0 opacity-60" /></>)
                            : (<><Tag className="h-3 w-3" /> Adicionar etiqueta</>)}
                        </button>
                      </>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* GAP-039, GAP-125, GAP-398: Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded border border-border bg-card text-sm disabled:opacity-50 hover:bg-secondary transition"
              >
                Anterior
              </button>
              <span className="text-sm text-muted-foreground">
                Página {page} de {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 rounded border border-border bg-card text-sm disabled:opacity-50 hover:bg-secondary transition"
              >
                Próxima
              </button>
            </div>
          )}
        </>
      )}

      {editingCover && (
        <CustomCoverEditor
          productId={editingCover.id}
          productTitle={editingCover.title}
          defaultImage={editingCover.image}
          open
          onClose={() => setEditingCover(null)}
          onSaved={() => refetchCovers()}
        />
      )}
      {editingLista && (
        <ListaCustomEditor
          initial={editingLista.current}
          suggestions={allListas}
          saving={savingLista}
          onCancel={() => setEditingLista(null)}
          onSave={(v) => handleSaveLista(editingLista.id, v)}
        />
      )}
    </div>
  );
}

function ListaCustomEditor({
  initial,
  suggestions,
  saving,
  onCancel,
  onSave,
}: {
  initial: string;
  suggestions: string[];
  saving?: boolean;
  onCancel: () => void;
  onSave: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <div className="fixed inset-0 z-[70] bg-overlay/60 flex items-end sm:items-center justify-center p-4" onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-card border border-border rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-primary" />
          <h3 className="font-bold">Etiqueta do jogo</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Uma nota curta que fica em cima do status — "presente pra irmão", "quando trocar de PC", "esperando promoção". Máximo 40 caracteres.
        </p>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, 40))}
          maxLength={40}
          placeholder="Ex.: quando trocar de PC"
          className="w-full p-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          autoFocus
        />
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {suggestions.slice(0, 8).map((s) => (
              <button key={s} type="button" onClick={() => setValue(s)}
                className="px-2 py-1 rounded-full text-[11px] bg-secondary hover:bg-primary/20 text-muted-foreground">
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2 pt-1">
          <button onClick={onCancel} disabled={saving} className="flex-1 py-2.5 rounded-lg bg-secondary text-sm font-semibold disabled:opacity-50">
            Cancelar
          </button>
          {initial && (
            <button onClick={() => onSave('')} disabled={saving} className="flex-1 py-2.5 rounded-lg bg-destructive/80 text-destructive-foreground text-sm font-semibold disabled:opacity-50">
              Remover
            </button>
          )}
          <button onClick={() => onSave(value)} disabled={saving} className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}