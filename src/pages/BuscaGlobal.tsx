// Busca Global Única — indexa Mobile + Web. Cada resultado marcado com 📱/🖥.
// Click inteligente: se estamos no Web e destino é Mobile (ou vice-versa), CTA "Abrir versão X".
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from '@/hooks/useDebounce';
import { Search, Loader2, Gamepad2, User, Store, MessageSquare, Star, ShoppingBag, Monitor, Smartphone, SearchX, SlidersHorizontal, ArrowDownAZ, Sparkles, X, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import EstadoVazio from '@/components/EstadoVazio';
import { FilterChip, FilterChipGroup } from '@/components/FilterChip';
import { formatCurrency } from '@/lib/format';

type Category = 'all' | 'games' | 'users' | 'sellers' | 'reviews' | 'forum' | 'marketplace';
type Platform = 'web' | 'mobile' | 'both';
type Sort = 'relevance' | 'az';
type PlatFilter = 'all' | 'web' | 'mobile';
type DateFilter = 'all' | '7d' | '30d' | '90d';

interface Result {
  id: string;
  title: string;
  subtitle?: string;
  image?: string | null;
  category: Exclude<Category, 'all'>;
  platform: Platform;
  webUrl?: string;
  mobileUrl?: string;
  createdAt?: string;
  /** metadados usados só pelos filtros avançados */
  meta?: { genre?: string | null; rating?: number | null; price?: number | null };
}

const TABS: { k: Category; label: string; icon: any }[] = [
  { k: 'all', label: 'Tudo', icon: Search },
  { k: 'games', label: 'Jogos', icon: Gamepad2 },
  { k: 'users', label: 'Usuários', icon: User },
  { k: 'sellers', label: 'Vendedores', icon: Store },
  { k: 'reviews', label: 'Reviews', icon: Star },
  { k: 'forum', label: 'Fórum', icon: MessageSquare },
  { k: 'marketplace', label: 'Marketplace', icon: ShoppingBag },
];

const PRICE_RANGES: { id: string; label: string; max: number | null; min: number }[] = [
  { id: 'all', label: 'Qualquer', min: 0, max: null },
  { id: 'lt50', label: 'até R$ 50', min: 0, max: 50 },
  { id: '50_150', label: 'R$ 50–150', min: 50, max: 150 },
  { id: 'gt150', label: 'R$ 150+', min: 150, max: null },
];

// GAP-137: Histórico de buscas
const SEARCH_HISTORY_KEY = 'midias_search_history';
const MAX_HISTORY = 20;

function getSearchHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

function addSearchHistory(term: string) {
  if (!term.trim()) return;
  const history = getSearchHistory();
  const filtered = history.filter(h => h.toLowerCase() !== term.toLowerCase());
  const newHistory = [term, ...filtered].slice(0, MAX_HISTORY);
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(newHistory));
}

function clearSearchHistory() {
  localStorage.removeItem(SEARCH_HISTORY_KEY);
}

// GAP-138: Função de highlight
function highlightText(text: string, query: string): string {
  if (!query || !text) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<mark class="bg-primary/20 text-primary font-semibold">$1</mark>');
}

// GAP-139, GAP-424: Correção ortográfica simples (Levenshtein aproximado)
function getSuggestion(query: string, candidates: string[]): string | null {
  if (!query || query.length < 3) return null;
  const words = query.toLowerCase().split(' ');
  const allWords = candidates.flatMap(c => c.toLowerCase().split(' '));
  const uniqueWords = [...new Set(allWords)];
  
  // Encontrar palavra mais próxima
  let bestMatch: string | null = null;
  let bestScore = Infinity;
  
  for (const word of words) {
    if (word.length < 3) continue;
    for (const candidate of uniqueWords) {
      if (candidate === word) continue;
      // Distância de Levenshtein simplificada
      const dist = levenshteinDistance(word, candidate);
      if (dist < bestScore && dist <= 2) {
        bestScore = dist;
        bestMatch = candidate;
      }
    }
  }
  
  if (bestMatch && bestScore <= 2) {
    // Substituir a palavra incorreta pela correta
    const newQuery = query.toLowerCase().replace(new RegExp(bestMatch, 'i'), bestMatch);
    if (newQuery !== query.toLowerCase()) {
      return newQuery;
    }
  }
  return null;
}

function levenshteinDistance(a: string, b: string): number {
  const matrix = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i-1] === b[j-1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i-1][j] + 1,
        matrix[i][j-1] + 1,
        matrix[i-1][j-1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

// GAP-140: Filtro por data
function getDateFilter(dateFilter: DateFilter): Date | null {
  const now = new Date();
  switch (dateFilter) {
    case '7d': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case '90d': return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    default: return null;
  }
}

export default function BuscaGlobal() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const [tab, setTab] = useState<Category>((params.get('cat') as Category) || 'all');
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState<Sort>('relevance');
  const [platFilter, setPlatFilter] = useState<PlatFilter>('all');
  const [genre, setGenre] = useState<string | null>(null);
  const [minRating, setMinRating] = useState(0);
  const [priceRange, setPriceRange] = useState('all');
  // GAP-140: Filtro por data
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [cursor, setCursor] = useState(-1);
  const [history, setHistory] = useState<string[]>(getSearchHistory());
  const [showHistory, setShowHistory] = useState(false);
  // GAP-139: Sugestão
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const debounced = useDebounce(q, 250);
  const isMobileApp = typeof window !== 'undefined' && window.location.pathname.startsWith('/m');

  // GAP-136, GAP-421: Paginação
  const LIMIT = 20;

  // GAP-137: Histórico — mostrar quando focar o input
  const handleFocus = () => {
    setShowHistory(true);
    setHistory(getSearchHistory());
  };

  const handleBlur = () => {
    setTimeout(() => setShowHistory(false), 200);
  };

  const handleHistoryClick = (term: string) => {
    setQ(term);
    setShowHistory(false);
    inputRef.current?.focus();
  };

  useEffect(() => {
    setParams(p => { if (debounced) p.set('q', debounced); else p.delete('q'); p.set('cat', tab); return p; }, { replace: true });
  }, [debounced, tab, setParams]);

  const parsed = (() => {
    const t = debounced.trim();
    if (t.startsWith('@')) return { prefix: '@' as const, term: t.slice(1), forceTab: 'users' as Category };
    if (t.startsWith('$')) return { prefix: '$' as const, term: t.slice(1), forceTab: 'sellers' as Category };
    return { prefix: null, term: t, forceTab: null };
  })();

  useEffect(() => {
    if (parsed.forceTab && tab !== parsed.forceTab) setTab(parsed.forceTab);
  }, [parsed.prefix]);

  // Busca principal com paginação
  useEffect(() => {
    const term = parsed.term;
    if (term.length < 2) { setResults([]); setHasMore(false); setOffset(0); return; }
    setLoading(true);
    setOffset(0);
    let cancel = false;
    (async () => {
      const like = `%${term}%`;
      const dateLimit = getDateFilter(dateFilter);
      
      const [games, profiles, sellers, reviews, posts, ads] = await Promise.all([
        supabase.from('produtos').select('id,title,image_url,category,release_date,rating').eq('is_active', true).ilike('title', like).limit(LIMIT),
        supabase.from('profiles').select('id,display_name,username,avatar_url,created_at').or(`display_name.ilike.${like},username.ilike.${like}`).not('is_paused', 'is', true).limit(LIMIT),
        supabase.from('seller_profiles').select('user_id,handle,display_name,avatar_url').or(`handle.ilike.${like},display_name.ilike.${like}`).limit(LIMIT),
        supabase.from('avaliacoes').select('id,product_id,rating,comment,user_id,created_at').not('comment', 'is', null).ilike('comment', like).limit(LIMIT),
        supabase.from('forum_posts').select('id,title,content,product_id,created_at').or(`title.ilike.${like},content.ilike.${like}`).limit(LIMIT),
        supabase.from('anuncios').select('id,title,description,price,created_at').eq('status', 'active').or(`title.ilike.${like},description.ilike.${like}`).limit(LIMIT),
      ]);

      if (cancel) return;

      const list: Result[] = [];
      
      // GAP-140: Filtrar por data
      const filterByDate = (createdAt: string | null): boolean => {
        if (!dateLimit || !createdAt) return true;
        return new Date(createdAt) >= dateLimit;
      };

      (games.data || []).forEach(g => {
        if (!filterByDate(g.release_date)) return;
        list.push({
          id: g.id, title: g.title, subtitle: g.category || 'Jogo', image: g.image_url,
          category: 'games', platform: 'both',
          webUrl: `/jogo/${g.id}`, mobileUrl: `/m/forum/${g.id}`,
          createdAt: g.release_date,
          meta: { genre: g.category, rating: g.rating },
        });
      });
      
      (profiles.data || []).forEach(p => {
        if (!filterByDate(p.created_at)) return;
        list.push({
          id: p.id, title: p.display_name || 'Usuário', subtitle: p.username ? `@${p.username}` : undefined,
          image: p.avatar_url, category: 'users', platform: 'both',
          webUrl: `/perfil/${p.id}`, mobileUrl: `/m/perfil/${p.id}`,
          createdAt: p.created_at,
        });
      });
      
      (sellers.data || []).forEach((s: any) => {
        list.push({
          id: s.user_id, title: s.display_name || s.handle, subtitle: `$${s.handle}`,
          image: s.avatar_url, category: 'sellers', platform: 'web',
          webUrl: `/vendedor/${s.handle}`,
          createdAt: null,
        });
      });
      
      (reviews.data || []).forEach((r: any) => {
        if (!filterByDate(r.created_at)) return;
        list.push({
          id: r.id, title: `Review · ${r.rating}★`, subtitle: r.comment?.slice(0, 80),
          category: 'reviews', platform: 'mobile',
          mobileUrl: `/m/review/${r.product_id}`,
          createdAt: r.created_at,
          meta: { rating: Number(r.rating) },
        });
      });
      
      (posts.data || []).forEach((p: any) => {
        if (!filterByDate(p.created_at)) return;
        list.push({
          id: p.id, title: p.title || 'Post do fórum',
          subtitle: (p.content || '').slice(0, 80), category: 'forum', platform: 'mobile',
          mobileUrl: `/m/forum/post/${p.id}`,
          createdAt: p.created_at,
        });
      });
      
      (ads.data || []).forEach((a: any) => {
        if (!filterByDate(a.created_at)) return;
        list.push({
          id: a.id, title: a.title, subtitle: a.price ? `${formatCurrency(Number(a.price))}` : a.description?.slice(0, 60),
          category: 'marketplace', platform: 'mobile',
          mobileUrl: `/m/marketplace/${a.id}`,
          createdAt: a.created_at,
          meta: { price: a.price != null ? Number(a.price) : null },
        });
      });
      
      setResults(list);
      setHasMore(list.length >= LIMIT);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [debounced, dateFilter]);

  // GAP-139: Sugestão de correção
  useEffect(() => {
    if (debounced.length < 3) { setSuggestion(null); return; }
    const candidates = results.map(r => r.title);
    const suggestion = getSuggestion(debounced, candidates);
    setSuggestion(suggestion);
  }, [debounced, results]);

  // GAP-136, GAP-421: Carregar mais
  const loadMore = async () => {
    if (loadingMore || !hasMore || !debounced) return;
    setLoadingMore(true);
    const newOffset = offset + LIMIT;
    const term = parsed.term;
    const like = `%${term}%`;
    const dateLimit = getDateFilter(dateFilter);
    
    const [games, profiles, reviews, posts, ads] = await Promise.all([
      supabase.from('produtos').select('id,title,image_url,category,release_date,rating').eq('is_active', true).ilike('title', like).range(newOffset, newOffset + LIMIT - 1),
      supabase.from('profiles').select('id,display_name,username,avatar_url,created_at').or(`display_name.ilike.${like},username.ilike.${like}`).not('is_paused', 'is', true).range(newOffset, newOffset + LIMIT - 1),
      supabase.from('avaliacoes').select('id,product_id,rating,comment,user_id,created_at').not('comment', 'is', null).ilike('comment', like).range(newOffset, newOffset + LIMIT - 1),
      supabase.from('forum_posts').select('id,title,content,product_id,created_at').or(`title.ilike.${like},content.ilike.${like}`).range(newOffset, newOffset + LIMIT - 1),
      supabase.from('anuncios').select('id,title,description,price,created_at').eq('status', 'active').or(`title.ilike.${like},description.ilike.${like}`).range(newOffset, newOffset + LIMIT - 1),
    ]);

    const filterByDate = (createdAt: string | null): boolean => {
      if (!dateLimit || !createdAt) return true;
      return new Date(createdAt) >= dateLimit;
    };

    const newResults: Result[] = [];
    
    (games.data || []).forEach(g => {
      if (!filterByDate(g.release_date)) return;
      newResults.push({
        id: g.id, title: g.title, subtitle: g.category || 'Jogo', image: g.image_url,
        category: 'games', platform: 'both',
        webUrl: `/jogo/${g.id}`, mobileUrl: `/m/forum/${g.id}`,
        createdAt: g.release_date,
        meta: { genre: g.category, rating: g.rating },
      });
    });
    
    (profiles.data || []).forEach(p => {
      if (!filterByDate(p.created_at)) return;
      newResults.push({
        id: p.id, title: p.display_name || 'Usuário', subtitle: p.username ? `@${p.username}` : undefined,
        image: p.avatar_url, category: 'users', platform: 'both',
        webUrl: `/perfil/${p.id}`, mobileUrl: `/m/perfil/${p.id}`,
        createdAt: p.created_at,
      });
    });
    
    (reviews.data || []).forEach((r: any) => {
      if (!filterByDate(r.created_at)) return;
      newResults.push({
        id: r.id, title: `Review · ${r.rating}★`, subtitle: r.comment?.slice(0, 80),
        category: 'reviews', platform: 'mobile',
        mobileUrl: `/m/review/${r.product_id}`,
        createdAt: r.created_at,
        meta: { rating: Number(r.rating) },
      });
    });
    
    (posts.data || []).forEach((p: any) => {
      if (!filterByDate(p.created_at)) return;
      newResults.push({
        id: p.id, title: p.title || 'Post do fórum',
        subtitle: (p.content || '').slice(0, 80), category: 'forum', platform: 'mobile',
        mobileUrl: `/m/forum/post/${p.id}`,
        createdAt: p.created_at,
      });
    });
    
    (ads.data || []).forEach((a: any) => {
      if (!filterByDate(a.created_at)) return;
      newResults.push({
        id: a.id, title: a.title, subtitle: a.price ? `${formatCurrency(Number(a.price))}` : a.description?.slice(0, 60),
        category: 'marketplace', platform: 'mobile',
        mobileUrl: `/m/marketplace/${a.id}`,
        createdAt: a.created_at,
        meta: { price: a.price != null ? Number(a.price) : null },
      });
    });

    setResults(prev => [...prev, ...newResults]);
    setOffset(newOffset + LIMIT);
    setHasMore(newResults.length >= LIMIT);
    setLoadingMore(false);
  };

  // GAP-137: Salvar busca no histórico
  useEffect(() => {
    if (debounced.length >= 2) {
      addSearchHistory(debounced);
    }
  }, [debounced]);

  // ── Filtros avançados (client-side) ──
  const genres = useMemo(() => {
    const set = new Set<string>();
    results.forEach(r => { if (r.category === 'games' && r.meta?.genre) set.add(r.meta.genre); });
    return Array.from(set).sort().slice(0, 12);
  }, [results]);

  const filtered = useMemo(() => {
    let list = tab === 'all' ? results : results.filter(r => r.category === tab);
    if (platFilter !== 'all') list = list.filter(r => r.platform === 'both' || r.platform === platFilter);
    if (genre) list = list.filter(r => r.category !== 'games' || r.meta?.genre === genre);
    if (minRating > 0) list = list.filter(r => r.category !== 'reviews' || (r.meta?.rating ?? 0) >= minRating);
    if (priceRange !== 'all') {
      const range = PRICE_RANGES.find(p => p.id === priceRange)!;
      list = list.filter(r => {
        if (r.category !== 'marketplace') return true;
        const price = r.meta?.price;
        if (price == null) return false;
        return price >= range.min && (range.max == null || price <= range.max);
      });
    }
    if (sort === 'az') list = [...list].sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
    return list;
  }, [results, tab, platFilter, genre, minRating, priceRange, sort]);

  const counts = useMemo(() => {
    const c: Record<Category, number> = { all: results.length, games: 0, users: 0, sellers: 0, reviews: 0, forum: 0, marketplace: 0 };
    results.forEach(r => { c[r.category]++; });
    return c;
  }, [results]);

  const activeFilters = (platFilter !== 'all' ? 1 : 0) + (genre ? 1 : 0) + (minRating > 0 ? 1 : 0) + (priceRange !== 'all' ? 1 : 0) + (sort !== 'relevance' ? 1 : 0) + (dateFilter !== 'all' ? 1 : 0);

  const clearFilters = () => { 
    setPlatFilter('all'); 
    setGenre(null); 
    setMinRating(0); 
    setPriceRange('all'); 
    setSort('relevance');
    setDateFilter('all');
  };

  // ── Navegação por teclado ──
  useEffect(() => { setCursor(-1); }, [debounced, tab, platFilter, genre, minRating, priceRange, sort, dateFilter]);

  useEffect(() => {
    if (cursor < 0) return;
    const el = document.getElementById(`search-result-${cursor}`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const urlFor = (r: Result) => (isMobileApp ? (r.mobileUrl || r.webUrl) : (r.webUrl || r.mobileUrl));

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey && cursor >= 0 && cursor < filtered.length - 1)) {
      e.preventDefault();
      setCursor(c => Math.min(c + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor(c => Math.max(c - 1, -1));
    } else if (e.key === 'Enter' && cursor >= 0 && filtered[cursor]) {
      const url = urlFor(filtered[cursor]);
      if (url) { e.preventDefault(); navigate(url); }
    } else if (e.key === 'Escape') {
      if (cursor >= 0) setCursor(-1);
      else if (q) setQ('');
      else inputRef.current?.blur();
    } else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && e.altKey) {
      e.preventDefault();
      const idx = TABS.findIndex(t => t.k === tab);
      const next = e.key === 'ArrowRight' ? (idx + 1) % TABS.length : (idx - 1 + TABS.length) % TABS.length;
      setTab(TABS[next].k);
    }
  };

  // Atalho global: "/" foca a busca
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl" onKeyDown={onKeyDown}>
      <div className="relative mb-3">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <input
          ref={inputRef}
          autoFocus
          role="combobox"
          aria-expanded={filtered.length > 0}
          aria-controls="search-results"
          aria-activedescendant={cursor >= 0 ? `search-result-${cursor}` : undefined}
          value={q} 
          onChange={e => setQ(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="Buscar em todo MIDIAS — jogos, usuários, vendedores, reviews, fórum, marketplace..."
          className="w-full pl-12 pr-28 py-3 bg-card border border-border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {q && (
            <button onClick={() => { setQ(''); inputRef.current?.focus(); }} aria-label="Limpar busca"
              className="focus-ring p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary">
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => setShowFilters(s => !s)}
            aria-expanded={showFilters}
            aria-label="Filtros avançados"
            className={`focus-ring inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-xs font-semibold transition-all ${
              showFilters || activeFilters > 0
                ? 'bg-primary text-primary-foreground border-primary glow-primary'
                : 'bg-secondary/60 border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {activeFilters > 0 && <span className="text-[10px]">{activeFilters}</span>}
          </button>
        </div>
      </div>

      {/* GAP-137: Histórico de buscas */}
      {showHistory && history.length > 0 && !q && (
        <div className="absolute z-10 mt-1 w-full max-w-4xl bg-card border border-border rounded-xl shadow-lg p-2">
          <div className="flex items-center justify-between mb-2 px-2">
            <span className="text-xs font-semibold text-muted-foreground">Buscas recentes</span>
            <button onClick={clearSearchHistory} className="text-xs text-muted-foreground hover:text-destructive">
              Limpar
            </button>
          </div>
          {history.map((term, i) => (
            <button
              key={i}
              onClick={() => handleHistoryClick(term)}
              className="w-full text-left px-3 py-1.5 text-sm rounded-lg hover:bg-secondary flex items-center gap-2"
            >
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              {term}
            </button>
          ))}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground mb-3">
        Atalhos: <kbd className="px-1 rounded bg-secondary border border-border">/</kbd> focar ·{' '}
        <kbd className="px-1 rounded bg-secondary border border-border">↑↓</kbd> navegar ·{' '}
        <kbd className="px-1 rounded bg-secondary border border-border">Enter</kbd> abrir ·{' '}
        <kbd className="px-1 rounded bg-secondary border border-border">Alt+←→</kbd> trocar aba ·{' '}
        <kbd className="px-1 rounded bg-secondary border border-border">Esc</kbd> limpar
      </p>

      <div className="flex gap-1.5 mb-3 overflow-x-auto -mx-4 px-4 pb-1 scrollbar-thin" role="tablist">
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.k;
          const count = counts[t.k];
          return (
            <button key={t.k} onClick={() => setTab(t.k)} role="tab" aria-selected={active}
              className={`focus-ring shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 ${
                active ? 'bg-primary text-primary-foreground glow-primary' : 'bg-secondary/60 border border-border text-muted-foreground hover:text-foreground'
              }`}>
              <Icon className="h-3.5 w-3.5" /> {t.label}
              {count > 0 && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? 'bg-primary-foreground/20' : 'bg-background'}`}>{count}</span>}
            </button>
          );
        })}
      </div>

      {showFilters && (
        <div className="rounded-xl border border-border bg-card/60 p-3 mb-4 space-y-2">
          <FilterChipGroup label="Ordem">
            <FilterChip icon={Sparkles} active={sort === 'relevance'} onClick={() => setSort('relevance')}>Relevância</FilterChip>
            <FilterChip icon={ArrowDownAZ} active={sort === 'az'} onClick={() => setSort('az')}>A–Z</FilterChip>
          </FilterChipGroup>

          <div className="h-px bg-border/70" />

          <FilterChipGroup label="Onde">
            {([['all', 'Tudo'], ['web', 'Web'], ['mobile', 'Mobile']] as [PlatFilter, string][]).map(([id, label]) => (
              <FilterChip key={id} active={platFilter === id} onClick={() => setPlatFilter(id)}>{label}</FilterChip>
            ))}
          </FilterChipGroup>

          {/* GAP-140: Filtro por data */}
          <div className="h-px bg-border/70" />
          <FilterChipGroup label="Período">
            {[
              ['all', 'Todos'],
              ['7d', 'Últimos 7 dias'],
              ['30d', 'Últimos 30 dias'],
              ['90d', 'Últimos 90 dias'],
            ] as [DateFilter, string][]).map(([id, label]) => (
              <FilterChip key={id} active={dateFilter === id} onClick={() => setDateFilter(id)}>{label}</FilterChip>
            ))}
          </FilterChipGroup>

          {(tab === 'all' || tab === 'games') && genres.length > 0 && (
            <>
              <div className="h-px bg-border/70" />
              <FilterChipGroup label="Gênero">
                <FilterChip tone="accent" active={!genre} onClick={() => setGenre(null)}>Todos</FilterChip>
                {genres.map(g => (
                  <FilterChip key={g} tone="accent" active={genre === g} onClick={() => setGenre(g)}>{g}</FilterChip>
                ))}
              </FilterChipGroup>
            </>
          )}

          {(tab === 'all' || tab === 'reviews') && (
            <>
              <div className="h-px bg-border/70" />
              <FilterChipGroup label="Nota">
                {[0, 3, 4, 4.5].map(v => (
                  <FilterChip key={v} tone="accent" active={minRating === v} onClick={() => setMinRating(v)}>
                    {v === 0 ? 'Todas' : `${v}★+`}
                  </FilterChip>
                ))}
              </FilterChipGroup>
            </>
          )}

          {(tab === 'all' || tab === 'marketplace') && (
            <>
              <div className="h-px bg-border/70" />
              <FilterChipGroup label="Preço">
                {PRICE_RANGES.map(p => (
                  <FilterChip key={p.id} active={priceRange === p.id} onClick={() => setPriceRange(p.id)}>{p.label}</FilterChip>
                ))}
              </FilterChipGroup>
            </>
          )}

          {activeFilters > 0 && (
            <div className="pt-1">
              <button onClick={clearFilters} className="focus-ring text-xs font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                <X className="h-3.5 w-3.5" /> Limpar filtros
              </button>
            </div>
          )}
        </div>
      )}

      {q.trim().length < 2 ? (
        <p className="text-center text-sm text-muted-foreground py-20">Digite pelo menos 2 caracteres.</p>
      ) : loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div>
          {/* GAP-139, GAP-424: Sugestão de correção */}
          {suggestion && (
            <div className="mb-4 p-3 bg-accent/10 border border-accent/30 rounded-xl">
              <p className="text-sm text-foreground">
                <Sparkles className="h-4 w-4 inline mr-1 text-accent" />
                Você quis dizer: {' '}
                <button 
                  onClick={() => setQ(suggestion)}
                  className="font-semibold text-accent hover:underline"
                >
                  {suggestion}
                </button>
                ?
              </p>
            </div>
          )}
          <EstadoVazio
            icone={SearchX}
            titulo="Nenhum resultado encontrado"
            descricao={`Não encontramos nada para "${q}". Tente outro termo, outra aba ou limpe os filtros.`}
            acao={activeFilters > 0 ? { label: 'Limpar filtros', onClick: clearFilters } : undefined}
          />
        </div>
      ) : (
        <>
          <ul className="space-y-2" id="search-results" role="listbox">
            {filtered.map((r, i) => (
              <ResultRow
                key={`${r.category}-${r.id}`}
                r={r}
                index={i}
                active={cursor === i}
                onHover={() => setCursor(i)}
                isMobileApp={isMobileApp}
                query={q}
              />
            ))}
          </ul>
          
          {/* GAP-136, GAP-421: Carregar mais */}
          {hasMore && (
            <div className="mt-4 text-center">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="px-6 py-2.5 rounded-xl border border-border bg-card hover:border-primary/50 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {loadingMore ? <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> : <ChevronDown className="h-4 w-4 inline mr-2" />}
                {loadingMore ? 'Carregando...' : 'Carregar mais resultados'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}


function ResultRow({ r, isMobileApp, index, active, onHover, query }: {
  r: Result; isMobileApp: boolean; index: number; active: boolean; onHover: () => void; query?: string;
}) {
  const Icon = TABS.find(t => t.k === r.category)?.icon || Search;
  const primaryUrl = isMobileApp ? (r.mobileUrl || r.webUrl) : (r.webUrl || r.mobileUrl);
  const isPrimaryMobile = primaryUrl === r.mobileUrl;
  const showAlt = isMobileApp ? (!r.mobileUrl && !!r.webUrl) || (!!r.mobileUrl && !!r.webUrl && r.webUrl !== r.mobileUrl)
                              : (!r.webUrl && !!r.mobileUrl) || (!!r.webUrl && !!r.mobileUrl && r.webUrl !== r.mobileUrl);

  // GAP-138: Highlight do título
  const highlightedTitle = query ? highlightText(r.title, query) : r.title;

  return (
    <li
      id={`search-result-${index}`}
      role="option"
      aria-selected={active}
      onMouseEnter={onHover}
      className={`bg-card border rounded-xl p-3 transition-colors ${
        active ? 'border-primary glow-primary' : 'border-border hover:border-primary/40'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-lg bg-secondary overflow-hidden shrink-0 flex items-center justify-center">
          {r.image ? <img src={r.image} alt="" className="w-full h-full object-cover" loading="lazy" /> :
            <Icon className="h-5 w-5 text-muted-foreground" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {primaryUrl ? (
              <Link 
                to={primaryUrl} 
                className="font-semibold text-sm hover:text-primary truncate"
                dangerouslySetInnerHTML={{ __html: highlightedTitle }}
              />
            ) : <span className="font-semibold text-sm truncate" dangerouslySetInnerHTML={{ __html: highlightedTitle }} />}
            <PlatformTag platform={r.platform} />
          </div>
          {/* GAP-138: Highlight no subtítulo também */}
          {r.subtitle && (
            <p 
              className="text-xs text-muted-foreground truncate"
              dangerouslySetInnerHTML={{ __html: query ? highlightText(r.subtitle, query) : r.subtitle }}
            />
          )}
        </div>
        {showAlt && (
          <div className="shrink-0 flex flex-col gap-1">
            {isMobileApp && r.webUrl && (
              <a href={r.webUrl} target="_blank" rel="noopener" className="text-[10px] inline-flex items-center gap-1 px-2 py-1 rounded border border-border hover:border-primary/40">
                <Monitor className="h-3 w-3" /> Abrir versão Web
              </a>
            )}
            {!isMobileApp && r.mobileUrl && r.platform !== 'web' && (
              <Link to={r.mobileUrl} className="text-[10px] inline-flex items-center gap-1 px-2 py-1 rounded border border-border hover:border-primary/40">
                <Smartphone className="h-3 w-3" /> Abrir versão Mobile
              </Link>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function PlatformTag({ platform }: { platform: Platform }) {
  if (platform === 'both') return (
    <span className="inline-flex items-center gap-0.5 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/15 text-primary">
      <Smartphone className="h-2.5 w-2.5" />+<Monitor className="h-2.5 w-2.5" />
    </span>
  );
  if (platform === 'mobile') return (
    <span className="inline-flex items-center gap-0.5 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent/15 text-accent">
      <Smartphone className="h-2.5 w-2.5" /> Mobile
    </span>
  );
  return (
    <span className="inline-flex items-center gap-0.5 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
      <Monitor className="h-2.5 w-2.5" /> Web
    </span>
  );
}