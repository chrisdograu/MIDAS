import { Search, X, History, Loader2 } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

// GAP-BI02: Item de sugestão
interface Suggestion {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

interface BuscaInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  label?: string;
  /** GAP-BI01: Delay do debounce em ms */
  debounce?: number;
  /** GAP-BI02: Sugestões para autocomplete */
  suggestions?: Suggestion[];
  /** GAP-BI02: Loading de sugestões */
  suggestionsLoading?: boolean;
  /** GAP-BI02: Callback ao selecionar sugestão */
  onSuggestionSelect?: (suggestion: Suggestion) => void;
  /** GAP-BI03: Atalho de teclado para focar */
  shortcut?: string;
  /** GAP-BI04: Salvar histórico de buscas */
  saveHistory?: boolean;
  /** GAP-BI04: Histórico de buscas */
  searchHistory?: string[];
  /** GAP-BI04: Callback para limpar histórico */
  onClearHistory?: () => void;
  /** GAP-BI01: Callback após debounce */
  onDebouncedChange?: (value: string) => void;
  /** GAP-BI03: Callback para comando rápido */
  onCommand?: (command: string) => void;
  /** GAP-BI02: Placeholder quando não há sugestões */
  noSuggestionsMessage?: string;
  /** GAP-BI02: Número máximo de sugestões */
  maxSuggestions?: number;
}

export default function BuscaInput({
  value,
  onChange,
  placeholder = 'Buscar...',
  className = '',
  label,
  debounce = 0,
  suggestions = [],
  suggestionsLoading = false,
  onSuggestionSelect,
  shortcut = '/',
  saveHistory = false,
  searchHistory = [],
  onClearHistory,
  onDebouncedChange,
  onCommand,
  noSuggestionsMessage = 'Nenhuma sugestão encontrada',
  maxSuggestions = 8,
}: BuscaInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [debouncedValue, setDebouncedValue] = useState(value);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // GAP-BI01: Debounce
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    if (debounce > 0) {
      debounceTimerRef.current = setTimeout(() => {
        setDebouncedValue(value);
        onDebouncedChange?.(value);
      }, debounce);
    } else {
      setDebouncedValue(value);
      onDebouncedChange?.(value);
    }
    
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [value, debounce, onDebouncedChange]);

  // GAP-BI03: Atalhos de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K ou / para focar
      if ((e.ctrlKey && e.key === 'k') || e.key === shortcut) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      
      // Escape para limpar ou perder foco
      if (e.key === 'Escape') {
        if (isFocused) {
          inputRef.current?.blur();
          setShowHistory(false);
        }
        if (value) {
          onChange('');
        }
      }
      
      // Enter para executar busca ou comando
      if (e.key === 'Enter' && isFocused) {
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          onSuggestionSelect?.(suggestions[selectedIndex]);
        } else if (value.startsWith('/') && onCommand) {
          onCommand(value.slice(1));
        } else {
          onDebouncedChange?.(value);
        }
      }
      
      // Navegação por setas
      if (e.key === 'ArrowDown' && isFocused) {
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
      }
      if (e.key === 'ArrowUp' && isFocused) {
        e.preventDefault();
        setSelectedIndex(prev => prev > -1 ? prev - 1 : -1);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFocused, suggestions, selectedIndex, value, onChange, onCommand, onDebouncedChange, onSuggestionSelect, shortcut]);

  // GAP-BI02: Click fora para fechar sugestões
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
        setShowHistory(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // GAP-BI04: Salvar histórico
  const handleSubmit = useCallback((val: string) => {
    if (saveHistory && val.trim()) {
      // TODO: Salvar no localStorage ou backend
      const history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
      const newHistory = [val, ...history.filter((h: string) => h !== val)].slice(0, 10);
      localStorage.setItem('searchHistory', JSON.stringify(newHistory));
    }
    onDebouncedChange?.(val);
  }, [saveHistory, onDebouncedChange]);

  // GAP-BI02: Sugestões filtradas
  const filteredSuggestions = value.length > 0
    ? suggestions.filter(s => 
        s.label.toLowerCase().includes(value.toLowerCase()) ||
        s.description?.toLowerCase().includes(value.toLowerCase())
      ).slice(0, maxSuggestions)
    : [];

  // GAP-BI04: Histórico
  const displayHistory = searchHistory.length > 0 && !value && isFocused;

  const hasSuggestions = filteredSuggestions.length > 0 || suggestionsLoading;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        
        <input
          ref={inputRef}
          type="search"
          role="searchbox"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (e.target.value) {
              setShowHistory(false);
            }
          }}
          onFocus={() => {
            setIsFocused(true);
            if (!value && saveHistory && searchHistory.length > 0) {
              setShowHistory(true);
            }
          }}
          onBlur={() => {
            setTimeout(() => {
              setIsFocused(false);
              setShowHistory(false);
            }, 200);
          }}
          placeholder={placeholder}
          aria-label={label || placeholder}
          className="w-full pl-10 pr-9 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Limpar busca"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        
        {/* GAP-BI03: Atalho de teclado */}
        {!value && !isFocused && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-muted-foreground">
            <kbd className="px-1.5 py-0.5 bg-secondary/50 rounded text-[10px] font-mono border border-border">
              {shortcut === '/' ? '/' : '⌘K'}
            </kbd>
          </div>
        )}
      </div>
      
      {/* GAP-BI02: Sugestões */}
      {(hasSuggestions || displayHistory) && (
        <div className={cn(
          "absolute top-full left-0 right-0 mt-1.5 bg-card border border-border rounded-lg shadow-lg z-50 max-h-72 overflow-y-auto",
          "transition-all duration-150",
          isFocused ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1 pointer-events-none"
        )}>
          {suggestionsLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : displayHistory ? (
            // GAP-BI04: Histórico
            <>
              <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5" />
                  Buscas Recentes
                </span>
                {onClearHistory && (
                  <button
                    onClick={onClearHistory}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Limpar
                  </button>
                )}
              </div>
              {searchHistory.slice(0, 8).map((item) => (
                <button
                  key={item}
                  onClick={() => {
                    onChange(item);
                    handleSubmit(item);
                    setShowHistory(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-secondary/50 transition-colors flex items-center gap-2"
                >
                  <History className="h-3.5 w-3.5 text-muted-foreground" />
                  {item}
                </button>
              ))}
            </>
          ) : filteredSuggestions.length > 0 ? (
            // Sugestões
            filteredSuggestions.map((suggestion, index) => (
              <button
                key={suggestion.id}
                onClick={() => {
                  onSuggestionSelect?.(suggestion);
                  setIsFocused(false);
                }}
                className={cn(
                  "w-full px-3 py-2 text-left text-sm hover:bg-secondary/50 transition-colors flex items-center gap-2",
                  selectedIndex === index && "bg-secondary/50"
                )}
              >
                {suggestion.icon && <span className="shrink-0">{suggestion.icon}</span>}
                <div className="min-w-0">
                  <div className="font-medium">{suggestion.label}</div>
                  {suggestion.description && (
                    <div className="text-xs text-muted-foreground truncate">
                      {suggestion.description}
                    </div>
                  )}
                </div>
              </button>
            ))
          ) : value.length > 0 ? (
            // GAP-BI02: Nenhum resultado
            <div className="px-3 py-4 text-sm text-muted-foreground text-center">
              {noSuggestionsMessage}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}