import { useState } from 'react';
import { ChevronDown, ChevronUp, Filter, Gamepad2, RotateCcw, X } from 'lucide-react';
import type { Game } from '@/lib/gameData';
import { defaultDeveloperFilters, filterDeveloperGames, releaseYear, type DeveloperGameFilters } from '@/lib/developerCatalog';
import BuscaInput from '@/components/BuscaInput';
import SelectSimples from '@/components/SelectSimples';
import GameCard from '@/components/GameCard';
import EstadoVazio from '@/components/EstadoVazio';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

const pageSize = 15;
const allOption = (label: string) => ({ value: 'all', label });

export default function DeveloperGameCatalog({ games }: { games: Game[] }) {
  const [filters, setFilters] = useState<DeveloperGameFilters>({ ...defaultDeveloperFilters });
  const [expanded, setExpanded] = useState(false);
  const [visible, setVisible] = useState(pageSize);
  const update = <K extends keyof DeveloperGameFilters>(key: K, value: DeveloperGameFilters[K]) => {
    setFilters(previous => ({ ...previous, [key]: value }));
    setVisible(pageSize);
  };
  const clear = () => { setFilters({ ...defaultDeveloperFilters }); setVisible(pageSize); };
  const platforms = [...new Set(games.flatMap(game => game.platform))].sort();
  const categories = [...new Set(games.map(game => game.category))].sort();
  const years = [...new Set(games.map(releaseYear).filter(Boolean))].sort().reverse();
  const filtered = filterDeveloperGames(games, filters);
  const active = [filters.platform, filters.category, filters.year, filters.price, filters.rating].filter(value => value !== 'all').length + Number(filters.onSale) + Number(filters.inStock);
  const chips: { key: keyof DeveloperGameFilters; label: string }[] = [
    ...(filters.platform !== 'all' ? [{ key: 'platform' as const, label: filters.platform }] : []),
    ...(filters.category !== 'all' ? [{ key: 'category' as const, label: filters.category }] : []),
    ...(filters.year !== 'all' ? [{ key: 'year' as const, label: filters.year }] : []),
    ...(filters.price !== 'all' ? [{ key: 'price' as const, label: filters.price === 'free' ? 'Gratuitos' : `Até R$ ${filters.price}` }] : []),
    ...(filters.rating !== 'all' ? [{ key: 'rating' as const, label: `${filters.rating}+ estrelas` }] : []),
    ...(filters.onSale ? [{ key: 'onSale' as const, label: 'Em oferta' }] : []),
    ...(filters.inStock ? [{ key: 'inStock' as const, label: 'Em estoque' }] : []),
  ];

  return (
    <section id="jogos" className="scroll-mt-24 mt-8 border-t border-border pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2"><Gamepad2 className="h-5 w-5 text-primary" /> Jogos <span className="text-sm font-normal text-muted-foreground">({games.length})</span></h2>
      </div>
      {games.length === 0 ? <EstadoVazio icone={Gamepad2} titulo="Nenhum jogo cadastrado" descricao="Este desenvolvedor ainda não tem jogos na plataforma." /> : <>
        <div className="flex flex-col sm:flex-row gap-2">
          <BuscaInput value={filters.search} onChange={value => update('search', value)} label="Buscar jogos deste desenvolvedor" placeholder="Buscar jogo ou tag..." className="flex-1 min-w-0" shortcut="" />
          <Button variant={expanded || active ? 'secondary' : 'outline'} onClick={() => setExpanded(value => !value)} aria-expanded={expanded} aria-controls="filtros-desenvolvedor" className="shrink-0"><Filter className="h-4 w-4 mr-2" /> Filtros {active > 0 && `(${active})`}{expanded ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}</Button>
          <SelectSimples value={filters.sort} onChange={value => update('sort', value)} label="Ordenar jogos" className="sm:w-48" options={[{ value: 'recent', label: 'Mais recentes' }, { value: 'oldest', label: 'Mais antigos' }, { value: 'rating', label: 'Melhor avaliação' }, { value: 'price', label: 'Menor preço' }, { value: 'price-desc', label: 'Maior preço' }, { value: 'discount', label: 'Maior desconto' }, { value: 'name', label: 'Nome: A–Z' }]} />
        </div>
        {expanded && <div id="filtros-desenvolvedor" className="py-4 border-b border-border space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {([
              { key: 'platform', label: 'Plataforma', options: [allOption('Todas as plataformas'), ...platforms.map(value => ({ value, label: value }))] },
              { key: 'category', label: 'Categoria', options: [allOption('Todas as categorias'), ...categories.map(value => ({ value, label: value }))] },
              { key: 'year', label: 'Ano de lançamento', options: [allOption('Todos os anos'), ...years.map(value => ({ value, label: value }))] },
              { key: 'price', label: 'Preço', options: [allOption('Qualquer preço'), { value: 'free', label: 'Gratuitos' }, { value: '50', label: 'Até R$ 50' }, { value: '100', label: 'Até R$ 100' }, { value: '200', label: 'Até R$ 200' }] },
              { key: 'rating', label: 'Avaliação mínima', options: [allOption('Todas as avaliações'), { value: '3', label: '3+ estrelas' }, { value: '4', label: '4+ estrelas' }, { value: '4.5', label: '4,5+ estrelas' }] },
            ] as const).map(item => <div key={item.key} className="min-w-0 space-y-1.5"><span className="text-xs text-muted-foreground">{item.label}</span><SelectSimples value={filters[item.key]} onChange={value => update(item.key, value)} label={item.label} options={[...item.options]} /></div>)}
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <label className="flex items-center gap-2 text-sm cursor-pointer"><Checkbox checked={filters.onSale} onCheckedChange={value => update('onSale', value === true)} /> Em oferta</label>
            <label className="flex items-center gap-2 text-sm cursor-pointer"><Checkbox checked={filters.inStock} onCheckedChange={value => update('inStock', value === true)} /> Em estoque</label>
          </div>
        </div>}
        <div className="flex flex-wrap items-center gap-2 py-4">
          <p role="status" aria-live="polite" className="text-xs text-muted-foreground mr-auto">{filtered.length} de {games.length} jogos</p>
          {chips.map(chip => <Button key={chip.key} variant="secondary" size="sm" className="h-7 text-xs gap-1" aria-label={`Remover filtro: ${chip.label}`} onClick={() => update(chip.key, chip.key === 'onSale' || chip.key === 'inStock' ? false : 'all')}>{chip.label}<X className="h-3 w-3" /></Button>)}
          {(active > 0 || filters.search) && <Button variant="ghost" size="sm" onClick={clear}><RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Limpar filtros</Button>}
        </div>
        {filtered.length ? <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">{filtered.slice(0, visible).map(game => <GameCard key={game.id} game={game} />)}</div> : <div className="py-8 text-center"><p className="text-muted-foreground mb-3">Nenhum jogo encontrado com estes filtros.</p><Button variant="outline" onClick={clear}>Limpar filtros</Button></div>}
        {visible < filtered.length && <div className="flex justify-center mt-6"><Button variant="outline" onClick={() => setVisible(value => value + pageSize)}>Mostrar mais jogos ({filtered.length - visible})<ChevronDown className="h-4 w-4 ml-2" /></Button></div>}
      </>}
    </section>
  );
}
