// Rodada 24 · item 2 — campos compartilhados de produto.
// Plataforma e categoria existiam só na tela de EDITAR (Produtos.tsx); os dois
// caminhos de CRIAÇÃO (CriarJogo e aprovação de SugestoesJogos) gravavam sem
// eles, e o jogo nascia invisível para o filtro do catálogo (platform vazio).
import { useEffect, useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const PLATAFORMAS = ["PC", "PS5", "PS4", "Xbox Series", "Xbox One", "Nintendo Switch", "Mobile"];

export interface ProdutoBasicValue {
  platform: string[];
  category_id: string;
  /** GAP-D391: Múltiplas categorias */
  category_ids?: string[];
}

export function useCategorias() {
  const [categorias, setCategorias] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    supabase
      .from("categorias")
      .select("id, name")
      .order("name")
      .then(({ data }) => {
        setCategorias(data || []);
        setLoading(false);
      });
  }, []);
  
  return { categorias, loading };
}

interface Props {
  value: ProdutoBasicValue;
  onChange: (v: ProdutoBasicValue) => void;
  /** Nome da categoria também é gravado em produtos.category (denormalizado). */
  onCategoryName?: (name: string | null) => void;
  /** GAP-D391: Suporte a múltiplas categorias */
  multipleCategories?: boolean;
  /** GAP-D393: Validação em tempo real */
  showValidation?: boolean;
  onBlur?: () => void;
}

export function ProdutoFormFields({ 
  value, 
  onChange, 
  onCategoryName,
  multipleCategories = false,
  showValidation = true,
}: Props) {
  const { categorias, loading } = useCategorias();
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [customPlatforms, setCustomPlatforms] = useState('');

  // GAP-D393: Validação em tempo real
  const validation = useMemo(() => {
    const errors: string[] = [];
    if (value.platform.length === 0) {
      errors.push('Selecione pelo menos uma plataforma');
    }
    if (!value.category_id && !multipleCategories) {
      errors.push('Selecione uma categoria');
    }
    if (multipleCategories && (!value.category_ids || value.category_ids.length === 0)) {
      errors.push('Selecione pelo menos uma categoria');
    }
    return errors;
  }, [value, multipleCategories]);

  const hasError = showValidation && validation.length > 0;

  // GAP-D392: Busca de categorias
  const filteredCategories = useMemo(() => {
    if (!searchTerm) return categorias;
    return categorias.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [categorias, searchTerm]);

  const togglePlatform = (p: string) => {
    const next = value.platform.includes(p)
      ? value.platform.filter(x => x !== p)
      : [...value.platform, p];
    onChange({ ...value, platform: next });
  };

  // GAP-D391: Toggle categoria múltipla
  const toggleCategory = (categoryId: string) => {
    if (!multipleCategories) {
      onChange({ ...value, category_id: categoryId });
      const cat = categorias.find(c => c.id === categoryId);
      onCategoryName?.(cat?.name || null);
      setShowDropdown(false);
      return;
    }

    const current = value.category_ids || [];
    const next = current.includes(categoryId)
      ? current.filter(id => id !== categoryId)
      : [...current, categoryId];
    onChange({ ...value, category_ids: next });
  };

  // GAP-D394: Plataformas customizadas
  const handleCustomPlatforms = (input: string) => {
    setCustomPlatforms(input);
    const extras = input.split(',').map(s => s.trim()).filter(Boolean);
    const known = value.platform.filter(p => PLATAFORMAS.includes(p));
    onChange({ ...value, platform: [...known, ...extras] });
  };

  // Verifica se uma categoria está selecionada
  const isCategorySelected = (id: string) => {
    if (multipleCategories) {
      return (value.category_ids || []).includes(id);
    }
    return value.category_id === id;
  };

  return (
    <div className="space-y-4">
      {/* GAP-D393: Validação em tempo real */}
      {showValidation && hasError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 space-y-0.5">
          {validation.map((err, i) => (
            <p key={i} className="text-xs text-destructive flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-destructive" />
              {err}
            </p>
          ))}
        </div>
      )}

      {/* Plataformas */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          Plataformas
          {showValidation && value.platform.length === 0 && (
            <span className="text-[10px] text-destructive">* obrigatório</span>
          )}
        </Label>
        <div className="flex flex-wrap gap-2">
          {PLATAFORMAS.map(p => {
            const active = value.platform.includes(p);
            return (
              <Badge
                key={p}
                onClick={() => togglePlatform(p)}
                className={cn(
                  'cursor-pointer select-none px-3 py-1 text-xs transition-all',
                  active 
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                )}
              >
                {active && <Check className="h-3 w-3 mr-1" />}
                {p}
              </Badge>
            );
          })}
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              placeholder="Outras plataformas (separadas por vírgula)"
              value={customPlatforms}
              onChange={e => handleCustomPlatforms(e.target.value)}
              className="text-xs"
            />
          </div>
          {customPlatforms && (
            <Badge 
              variant="secondary" 
              className="cursor-pointer hover:bg-destructive/20 transition-colors"
              onClick={() => {
                setCustomPlatforms('');
                onChange({ ...value, platform: value.platform.filter(p => PLATAFORMAS.includes(p)) });
              }}
            >
              <X className="h-3 w-3" />
            </Badge>
          )}
        </div>
        {value.platform.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Sem plataforma o jogo não aparece em nenhum filtro do catálogo.
          </p>
        )}
        {value.platform.some(p => !PLATAFORMAS.includes(p)) && (
          <div className="flex flex-wrap gap-1">
            {value.platform.filter(p => !PLATAFORMAS.includes(p)).map(p => (
              <Badge key={p} variant="outline" className="text-xs bg-primary/5">
                {p}
                <X 
                  className="h-3 w-3 ml-1 cursor-pointer hover:text-destructive" 
                  onClick={() => togglePlatform(p)}
                />
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Categorias */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          {multipleCategories ? 'Categorias' : 'Categoria'}
          {showValidation && !multipleCategories && !value.category_id && (
            <span className="text-[10px] text-destructive">* obrigatório</span>
          )}
          {showValidation && multipleCategories && (!value.category_ids || value.category_ids.length === 0) && (
            <span className="text-[10px] text-destructive">* obrigatório</span>
          )}
        </Label>

        {multipleCategories ? (
          // GAP-D391: Múltiplas categorias
          <div className="flex flex-wrap gap-2">
            {categorias.map(c => {
              const active = (value.category_ids || []).includes(c.id);
              return (
                <Badge
                  key={c.id}
                  onClick={() => toggleCategory(c.id)}
                  className={cn(
                    'cursor-pointer select-none px-3 py-1 text-xs transition-all',
                    active 
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                      : 'bg-muted text-muted-foreground hover:bg-muted/70'
                  )}
                >
                  {active && <Check className="h-3 w-3 mr-1" />}
                  {c.name}
                </Badge>
              );
            })}
          </div>
        ) : (
          // Select com busca (GAP-D392)
          <div className="relative">
            <div 
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setShowDropdown(!showDropdown)}
            >
              <Search className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-sm">
                {value.category_id 
                  ? categorias.find(c => c.id === value.category_id)?.name || 'Selecionar categoria'
                  : 'Selecionar categoria...'}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
            
            {showDropdown && (
              <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg max-h-60 overflow-y-auto">
                <div className="p-2 sticky top-0 bg-popover border-b border-border">
                  <Input
                    placeholder="Buscar categoria..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="h-8 text-sm"
                    autoFocus
                  />
                </div>
                <div className="p-1">
                  {filteredCategories.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {searchTerm ? `Nenhuma categoria para "${searchTerm}"` : 'Nenhuma categoria cadastrada'}
                    </p>
                  ) : (
                    filteredCategories.map(c => {
                      const active = value.category_id === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          className={cn(
                            'w-full text-left px-3 py-2 text-sm rounded transition-colors flex items-center gap-2',
                            active 
                              ? 'bg-primary/10 text-primary' 
                              : 'hover:bg-muted/50'
                          )}
                          onClick={() => {
                            onChange({ ...value, category_id: c.id });
                            onCategoryName?.(c.name);
                            setShowDropdown(false);
                            setSearchTerm('');
                          }}
                        >
                          {active && <Check className="h-4 w-4 text-primary" />}
                          <span className={active ? 'font-medium' : ''}>{c.name}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {value.category_id && onCategoryName && (
          <p className="text-xs text-muted-foreground">
            Categoria selecionada: <span className="font-medium">
              {categorias.find(c => c.id === value.category_id)?.name}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}

// Componente auxiliar para usar no lugar do ChevronRight (que não foi importado)
const ChevronRight = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="16" 
    height="16" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    className={className}
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

export default ProdutoFormFields;