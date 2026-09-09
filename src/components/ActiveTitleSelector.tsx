import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Sparkles, Lock, Trophy, Star, Check, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface TitleRow {
  id: string;
  name: string;
  source: string;
  unlock_rule: any | null;
  awarded_at?: string;
  category?: string;
}

interface Particle { id: number; px: number; py: number; left: number; top: number }

// GAP-AT01: Ordenação
type SortBy = 'recent' | 'name' | 'category' | 'rarity';

// GAP-AT02: Filtro
type FilterBy = 'all' | 'achievement' | 'xp' | 'tournament';

function ruleLabel(rule: any): string {
  if (!rule || rule.type === 'none') return 'Liberado';
  if (rule.type === 'achievement') return `Conquista "${rule.achievement_name}" necessária`;
  if (rule.type === 'achievement_id') return 'Conquista específica necessária';
  if (rule.type === 'playtime') return `${rule.min_hours ?? 0}h jogadas necessárias`;
  if (rule.type === 'xp') return `${rule.min_xp ?? 0} XP necessários`;
  if (rule.type === 'tournament') return `Torneio "${rule.tournament_name}" necessário`;
  return 'Bloqueado';
}

// GAP-AT02: Categorias
const categoryLabels: Record<string, { label: string; icon: typeof Trophy }> = {
  achievement: { label: 'Conquistas', icon: Star },
  xp: { label: 'XP', icon: Sparkles },
  tournament: { label: 'Torneios', icon: Trophy },
};

interface ActiveTitleSelectorProps {
  userId: string;
  /** GAP-AT01: Ordenação dos títulos */
  sortBy?: SortBy;
  /** GAP-AT02: Filtro por categoria */
  filterBy?: FilterBy;
  /** GAP-AT03: Mostrar preview */
  showPreview?: boolean;
  /** GAP-AT04: Habilitar seleção múltipla */
  allowMultiple?: boolean;
  /** GAP-AT03: Tamanho do preview */
  previewSize?: 'sm' | 'md' | 'lg';
}

export default function ActiveTitleSelector({ 
  userId, 
  sortBy = 'recent',
  filterBy = 'all',
  showPreview = true,
  allowMultiple = false,
  previewSize = 'md',
}: ActiveTitleSelectorProps) {
  const [titles, setTitles] = useState<TitleRow[]>([]);
  const [allowed, setAllowed] = useState<Record<string, boolean>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [burstKey, setBurstKey] = useState<string | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: ts }, { data: p }] = await Promise.all([
        supabase.from('user_titles' as any)
          .select('id, name, source, unlock_rule, awarded_at')
          .eq('user_id', userId)
          .order('awarded_at', { ascending: false }),
        supabase.from('profiles').select('active_title_id').eq('id', userId).maybeSingle(),
      ]);
      const list = ((ts as any) || []) as TitleRow[];
      setTitles(list);
      setActiveId((p as any)?.active_title_id || null);

      const checks = await Promise.all(
        list.map(async t => {
          try {
            const { data, error } = await supabase.rpc('can_equip_title' as any, { _user: userId, _title: t.id });
            return [t.id, error ? !t.unlock_rule : Boolean(data)] as const;
          } catch {
            return [t.id, !t.unlock_rule] as const;
          }
        }),
      );
      setAllowed(Object.fromEntries(checks));
      setLoading(false);
    })();
  }, [userId]);

  // GAP-AT01: Ordenação
  const sortedTitles = useMemo(() => {
    const sorted = [...titles];
    switch (sortBy) {
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'category':
        sorted.sort((a, b) => (a.source || '').localeCompare(b.source || ''));
        break;
      case 'rarity':
        sorted.sort((a, b) => {
          const aLocked = allowed[a.id] === false ? 1 : 0;
          const bLocked = allowed[b.id] === false ? 1 : 0;
          return aLocked - bLocked;
        });
        break;
      case 'recent':
      default:
        sorted.sort((a, b) => (a.awarded_at || '').localeCompare(b.awarded_at || ''));
        break;
    }
    return sorted;
  }, [titles, allowed, sortBy]);

  // GAP-AT02: Filtro
  const filteredTitles = useMemo(() => {
    if (filterBy === 'all') return sortedTitles;
    return sortedTitles.filter(t => t.source === filterBy);
  }, [sortedTitles, filterBy]);

  const triggerBurst = (key: string) => {
    setBurstKey(key);
    const parts: Particle[] = Array.from({ length: 5 }).map((_, i) => {
      const angle = (i / 5) * Math.PI * 2 + Math.random() * 0.6;
      const dist = 40 + Math.random() * 30;
      return {
        id: Date.now() + i,
        px: Math.cos(angle) * dist,
        py: Math.sin(angle) * dist,
        left: 50 + (Math.random() * 20 - 10),
        top: 50,
      };
    });
    setParticles(parts);
    window.setTimeout(() => { setParticles([]); setBurstKey(null); }, 750);
  };

  const updateTitle = async (newId: string | null) => {
    if (newId && allowed[newId] === false) {
      toast.error('Título bloqueado — complete os requisitos para desbloquear');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ active_title_id: newId } as any).eq('id', userId);
    setSaving(false);
    if (error) { toast.error('Erro ao salvar título'); return; }
    setActiveId(newId);
    triggerBurst(newId ?? '__none__');
    toast.success(newId ? 'Título atualizado!' : 'Título removido');
  };

  // GAP-AT04: Remoção em massa
  const handleBulkRemove = async () => {
    if (selectedIds.size === 0) return;
    setSaving(true);
    const { error } = await supabase
      .from('user_titles' as any)
      .delete()
      .in('id', Array.from(selectedIds))
      .eq('user_id', userId);
    setSaving(false);
    if (error) { toast.error('Erro ao remover títulos'); return; }
    setTitles(titles.filter(t => !selectedIds.has(t.id)));
    setSelectedIds(new Set());
    toast.success(`${selectedIds.size} títulos removidos`);
  };

  // GAP-AT03: Preview do título equipado
  const renderPreview = () => {
    const activeTitle = titles.find(t => t.id === activeId);
    if (!activeTitle) return null;
    const sizeClasses = {
      sm: 'text-sm px-2 py-1',
      md: 'text-base px-3 py-1.5',
      lg: 'text-lg px-4 py-2',
    };

    return (
      <div className={cn(
        "inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5",
        sizeClasses[previewSize]
      )}>
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="font-semibold gradient-text">{activeTitle.name}</span>
        <span className="text-xs text-muted-foreground">• equipado</span>
      </div>
    );
  };

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;

  const renderParticles = (key: string) => {
    if (burstKey !== key) return null;
    return (
      <>
        {particles.map(p => (
          <span
            key={p.id}
            className="particle-burst absolute w-1.5 h-1.5 rounded-full pointer-events-none"
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              background: 'hsl(var(--primary))',
              boxShadow: '0 0 8px hsl(var(--primary)), 0 0 16px hsl(var(--accent))',
              ['--px' as any]: `${p.px}px`,
              ['--py' as any]: `${p.py}px`,
            }}
          />
        ))}
      </>
    );
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            Título de conquista exibido
          </div>
          
          {/* GAP-AT03: Preview */}
          {showPreview && renderPreview()}
          
          {/* GAP-AT04: Remoção em massa */}
          {allowMultiple && selectedIds.size > 0 && (
            <button
              onClick={handleBulkRemove}
              disabled={saving}
              className="flex items-center gap-1.5 text-xs text-destructive hover:text-destructive/80 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remover selecionados ({selectedIds.size})
            </button>
          )}
        </div>

        {/* GAP-AT02: Filtros */}
        <div className="flex gap-1.5 flex-wrap">
          {Object.entries(categoryLabels).map(([key, { label, icon: Icon }]) => (
            <button
              key={key}
              onClick={() => {/* TODO: Implementar filtro */}}
              className={cn(
                "px-2 py-1 rounded-md text-xs font-medium transition-colors",
                filterBy === key
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
            >
              <Icon className="h-3 w-3 inline mr-1" />
              {label}
            </button>
          ))}
        </div>

        {titles.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Você ainda não conquistou nenhum título. Vença torneios ou acumule XP para desbloquear.</p>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            <button
              disabled={saving}
              onClick={() => updateTitle(null)}
              className={`relative overflow-visible w-full text-left px-3 py-2 rounded-lg border text-sm transition-all ${
                activeId === null 
                  ? 'border-primary bg-primary/10 text-foreground' 
                  : 'border-border bg-secondary/30 text-muted-foreground hover:border-primary/40'
              }`}
            >
              <span className={activeId === null && burstKey === '__none__' ? 'chromatic-pulse inline-block' : ''}>
                Nenhum título
              </span>
              {renderParticles('__none__')}
            </button>
            
            {filteredTitles.map(t => {
              const isLocked = allowed[t.id] === false;
              const isSelected = selectedIds.has(t.id);
              const categoryInfo = categoryLabels[t.source] || { label: t.source, icon: Sparkles };
              
              const inner = (
                <div
                  className={`relative overflow-visible w-full text-left px-3 py-2 rounded-lg border text-sm transition-all ${
                    isLocked
                      ? 'border-border bg-secondary/20 opacity-60'
                      : activeId === t.id
                        ? 'border-primary bg-gradient-to-r from-primary/15 to-accent/15 text-foreground'
                        : 'border-border bg-secondary/30 hover:border-primary/40'
                  } ${allowMultiple && isSelected ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {allowMultiple && (
                        <div className={cn(
                          "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                          isSelected ? 'bg-primary border-primary' : 'border-border'
                        )}>
                          {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                        </div>
                      )}
                      {isLocked && <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                      <span className={`font-medium truncate ${isLocked ? 'text-muted-foreground' : 'gradient-text'} ${
                        activeId === t.id && burstKey === t.id ? 'chromatic-pulse inline-block' : ''
                      }`}>
                        {t.name}
                      </span>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0 ml-2 flex items-center gap-1">
                      <categoryInfo.icon className="h-3 w-3" />
                      {categoryInfo.label}
                    </span>
                  </div>
                  {renderParticles(t.id)}
                </div>
              );

              const handleClick = () => {
                if (allowMultiple) {
                  const newSet = new Set(selectedIds);
                  if (isSelected) newSet.delete(t.id);
                  else newSet.add(t.id);
                  setSelectedIds(newSet);
                } else if (!isLocked) {
                  updateTitle(t.id);
                }
              };

              if (isLocked) {
                return (
                  <Tooltip key={t.id}>
                    <TooltipTrigger asChild>
                      <div onClick={handleClick} className="cursor-not-allowed">
                        {inner}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="text-xs">
                      🔒 {ruleLabel(t.unlock_rule)}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return (
                <div key={t.id} onClick={handleClick} className="cursor-pointer">
                  {inner}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}