// Rodada 24 · item 1 — seletor de jogo (produtos) para vincular a torneios.
// A coluna tournaments.product_id já era usada pelo filtro "Filtrar por jogo"
// da tela pública, mas nenhuma tela do desktop preenchia o campo.
import { useEffect, useState } from "react";
import { Check, Search, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/useDebounce";

interface Props {
  value: string | null;
  onChange: (productId: string | null) => void;
  label?: string;
  /** Apenas produtos ativos (is_active = true) são mostrados */
  onlyActive?: boolean;
}

export function GameProductSelect({ 
  value, 
  onChange, 
  label = "Jogo vinculado",
  onlyActive = true 
}: Props) {
  const [term, setTerm] = useState("");
  const debounced = useDebounce(term, 300);
  const [results, setResults] = useState<{ id: string; title: string }[]>([]);
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mostra o título do jogo já vinculado ao abrir o formulário de edição.
  useEffect(() => {
    if (!value) { setSelectedTitle(null); return; }
    let active = true;
    supabase
      .from("produtos")
      .select("title")
      .eq("id", value)
      .maybeSingle()
      .then(({ data, error }) => {
        if (active) {
          if (error) {
            setError(error.message);
            return;
          }
          setSelectedTitle(data?.title ?? null);
          setError(null);
        }
      });
    return () => { active = false; };
  }, [value]);

  // GAP-D388: Filtrar apenas produtos ativos
  useEffect(() => {
    const q = debounced.trim();
    if (q.length < 2) { 
      setResults([]); 
      setError(null);
      return; 
    }
    setIsSearching(true);
    setError(null);
    let active = true;
    
    let query = supabase
      .from("produtos")
      .select("id, title")
      .ilike("title", `%${q.replace(/[%_]/g, "")}%`)
      .limit(8);
    
    if (onlyActive) {
      query = query.eq("is_active", true);
    }
    
    query
      .then(({ data, error }) => { 
        if (active) {
          if (error) {
            setError(error.message);
            setResults([]);
          } else {
            setResults(data || []);
            setError(null);
          }
          setIsSearching(false);
        }
      });
    
    return () => { active = false; };
  }, [debounced, onlyActive]);

  const handleSelect = (id: string, title: string) => {
    onChange(id);
    setTerm("");
    setResults([]);
    setSelectedTitle(title);
    setError(null);
  };

  const handleClear = () => {
    onChange(null);
    setTerm("");
    setSelectedTitle(null);
    setResults([]);
    setError(null);
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {value ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
          <span className="text-sm truncate flex items-center gap-2">
            <Check className="h-4 w-4 text-primary shrink-0" />
            {selectedTitle || "Jogo selecionado"}
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={handleClear}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="space-y-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              className="pl-9 pr-9" 
              placeholder="Buscar jogo do catálogo…" 
              value={term} 
              onChange={e => setTerm(e.target.value)}
              disabled={!!value}
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
          
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
          
          {/* GAP-D386: Fallback para busca vazia */}
          {term.length >= 2 && results.length === 0 && !isSearching && !error && (
            <p className="text-xs text-muted-foreground py-2 text-center">
              Nenhum jogo encontrado para "{term}".
            </p>
          )}
          
          {term.length < 2 && results.length === 0 && !isSearching && (
            <p className="text-xs text-muted-foreground py-1">
              Digite ao menos 2 caracteres para buscar.
            </p>
          )}
          
          {results.length > 0 && (
            <div className="rounded-lg border border-border divide-y divide-border max-h-48 overflow-y-auto">
              {results.map(r => (
                <button
                  key={r.id}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors flex items-center gap-2"
                  onClick={() => handleSelect(r.id, r.title)}
                >
                  <span>{r.title}</span>
                  {onlyActive && (
                    <span className="text-[10px] text-success">● ativo</span>
                  )}
                </button>
              ))}
            </div>
          )}
          
          <p className="text-xs text-muted-foreground">
            Opcional — vincular permite que o torneio apareça no filtro por jogo da tela pública.
            {onlyActive && " Mostrando apenas jogos ativos."}
          </p>
        </div>
      )}
    </div>
  );
}

export default GameProductSelect;