// Controles compartilhados pro composer: spoiler manual + spoiler vinculado a conquista.
// Quando productId existe, busca conquistas únicas (achievement_name) já registradas em
// user_achievements pra esse jogo e oferece como dropdown.
import { useEffect, useState } from 'react';
import { AlertTriangle, Trophy, ChevronDown, X, Loader2, Sparkles, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import SelectSimples from '@/components/SelectSimples';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface Props {
  isSpoiler: boolean;
  onIsSpoilerChange: (v: boolean) => void;
  achievementName: string | null;
  onAchievementNameChange: (v: string | null) => void;
  productId?: string | null;
  className?: string;
}

export default function SpoilerComposerControls({
  isSpoiler,
  onIsSpoilerChange,
  achievementName,
  onAchievementNameChange,
  productId,
  className = '',
}: Props) {
  const [achievements, setAchievements] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState('');
  // GAP-SC03: Preview
  const [showPreview, setShowPreview] = useState(false);

  // GAP-SC02: Contagem
  const [totalAchievements, setTotalAchievements] = useState(0);

  useEffect(() => {
    if (!productId) { setAchievements([]); setTotalAchievements(0); return; }
    let cancel = false;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from('user_achievements')
        .select('achievement_name')
        .eq('product_id', productId)
        .limit(200);
      if (cancel) return;
      const uniq = Array.from(new Set((data || []).map((r: any) => r.achievement_name).filter(Boolean))).sort();
      setAchievements(uniq);
      setTotalAchievements(uniq.length);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [productId]);

  const setName = (v: string | null) => {
    onAchievementNameChange(v);
    if (v) onIsSpoilerChange(false);
  };

  // GAP-SC03: Preview do spoiler
  const previewText = isSpoiler 
    ? '🔒 Este conteúdo está marcado como spoiler. Todos precisam clicar para revelar.'
    : achievementName 
      ? `🔒 Vinculado à conquista "${achievementName}". Quem tem a conquista vê direto.`
      : 'Sem spoiler configurado.';

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Spoiler manual */}
      <button
        type="button"
        onClick={() => { onIsSpoilerChange(!isSpoiler); if (!isSpoiler) onAchievementNameChange(null); }}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${
          isSpoiler
            ? 'bg-warning/15 border-warning/60 text-warning'
            : 'bg-card border-border text-muted-foreground hover:border-warning/40'
        }`}
      >
        <span className="flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" />
          Marcar como spoiler (todos precisam revelar)
        </span>
        <span className={`h-4 w-7 rounded-full transition-colors ${isSpoiler ? 'bg-warning' : 'bg-muted'}`}>
          <span className={`block h-4 w-4 rounded-full bg-background border border-border transition-transform ${isSpoiler ? 'translate-x-3' : ''}`} />
        </span>
      </button>

      {/* GAP-SC03: Preview do spoiler */}
      <button
        type="button"
        onClick={() => setShowPreview(!showPreview)}
        className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1 transition"
      >
        <Eye className="h-3 w-3" />
        {showPreview ? 'Ocultar' : 'Ver'} preview do spoiler
      </button>

      {showPreview && (
        <div className="p-2 rounded-lg border border-warning/20 bg-warning/5 text-[10px] text-muted-foreground">
          <span className="font-medium text-foreground">Preview:</span> {previewText}
        </div>
      )}

      {/* Spoiler por conquista */}
      {productId && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Trophy className="h-3 w-3 text-warning" />
              Spoiler de conquista (opcional)
            </label>
            {/* GAP-SC02: Contagem de conquistas */}
            {!loading && totalAchievements > 0 && (
              <span className="text-[9px] text-muted-foreground">
                {totalAchievements} conquista{totalAchievements !== 1 ? 's' : ''} disponívei{totalAchievements !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* GAP-SC01: Loading state */}
          {loading ? (
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 flex-1 rounded-lg" />
              <Skeleton className="h-8 w-16 rounded-lg" />
            </div>
          ) : !customMode ? (
            <div className="relative">
              <SelectSimples
                value={achievementName || '__nenhuma__'}
                onChange={v => setName(v === '__nenhuma__' ? null : v)}
                size="sm"
                label="Conquista relacionada"
                className={`w-full ${achievementName ? 'border-destructive/60 bg-destructive/15' : ''}`}
                options={[
                  { value: '__nenhuma__', label: '— Nenhuma —' },
                  ...achievements.map(n => ({ value: n, label: n })),
                ]}
              />
              {/* GAP-SC04: Sugestão automática */}
              {achievements.length > 0 && !achievementName && (
                <div className="mt-1 flex gap-1 flex-wrap">
                  <span className="text-[8px] text-muted-foreground">Sugestões:</span>
                  {achievements.slice(0, 3).map(ach => (
                    <button
                      key={ach}
                      onClick={() => setName(ach)}
                      className="text-[8px] text-primary hover:underline"
                    >
                      {ach}
                    </button>
                  ))}
                  {achievements.length > 3 && (
                    <span className="text-[8px] text-muted-foreground">+{achievements.length - 3}</span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex gap-1.5">
              <input
                value={customValue}
                onChange={e => setCustomValue(e.target.value)}
                placeholder="Nome da conquista"
                className="flex-1 px-3 py-2 rounded-lg border border-border bg-card text-xs"
                maxLength={120}
              />
              <button
                type="button"
                onClick={() => { if (customValue.trim()) setName(customValue.trim()); setCustomMode(false); }}
                className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold"
              >
                <Sparkles className="h-3 w-3" />
              </button>
              <button 
                type="button" 
                onClick={() => setCustomMode(false)} 
                className="p-2 rounded-lg bg-secondary text-muted-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setCustomMode(m => !m)}
            className="text-[10px] text-primary hover:underline"
          >
            {customMode ? 'Usar lista de conquistas' : 'Digitar nome de outra conquista'}
          </button>
          
          {achievementName && (
            <p className="text-[10px] text-muted-foreground">
              Quem já tiver "<b className="text-foreground">{achievementName}</b>" verá o conteúdo direto, com badge dourado. Quem não tiver vê alerta intenso.
            </p>
          )}
        </div>
      )}
    </div>
  );
}