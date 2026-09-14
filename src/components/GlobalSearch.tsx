
import { useState, useEffect, useRef } from 'react';
import { Search, Loader2, X, Command, Gamepad2, User, ShoppingBag, Building2, BookOpen } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';
import { useNavigate } from 'react-router-dom';

const TYPE_ICONS: Record<string, any> = {
  product: Gamepad2,
  user: User,
  order: ShoppingBag,
  developer: Building2,
  publisher: BookOpen,
};

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { results, loading } = useGlobalSearch(query);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
        setQuery('');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (link: string) => {
    navigate(link);
    setIsOpen(false);
    setQuery('');
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => {
          setIsOpen(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/50 border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Buscar...</span>
        <kbd className="hidden sm:inline text-xs bg-background px-1.5 py-0.5 rounded border border-border">⌘K</kbd>
      </button>
    );
  }

  return (
    <div ref={containerRef} className="relative z-50">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" />
      <div className="fixed inset-x-0 top-[20%] mx-auto max-w-2xl">
        <div className="bg-card border border-border rounded-xl shadow-lg overflow-hidden">
          <div className="flex items-center gap-2 p-3 border-b border-border">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar produtos, usuários, pedidos..."
              className="border-0 shadow-none focus-visible:ring-0 text-sm"
            />
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : query && (
              <button onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="max-h-[400px] overflow-y-auto p-2">
            {query.length < 2 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Digite pelo menos 2 caracteres para buscar
              </div>
            ) : loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Nenhum resultado encontrado
              </div>
            ) : (
              results.map((result) => {
                const Icon = TYPE_ICONS[result.type] || Search;
                return (
                  <button
                    key={`${result.id}-${result.type}`}
                    onClick={() => handleSelect(result.link)}
                    className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-secondary transition-colors text-left"
                  >
                    {result.image ? (
                      <img src={result.image} alt="" className="w-8 h-8 rounded object-cover" loading="lazy" />
                    ) : (
                      <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{result.title}</p>
                      <p className="text-xs text-muted-foreground capitalize">{result.type}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">→</span>
                  </button>
                );
              })
            )}
          </div>
          <div className="border-t border-border p-2 text-xs text-muted-foreground text-center">
            <kbd className="px-1.5 py-0.5 bg-secondary rounded border border-border">↑↓</kbd> navegar
            <kbd className="ml-2 px-1.5 py-0.5 bg-secondary rounded border border-border">Enter</kbd> selecionar
            <kbd className="ml-2 px-1.5 py-0.5 bg-secondary rounded border border-border">Esc</kbd> fechar
          </div>
        </div>
      </div>
    </div>
  );
}