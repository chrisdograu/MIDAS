import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles, Check, GraduationCap, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// GAP-OBD02: Chave para localStorage
const STORAGE_KEY = 'onboarding-picked-genres';

/**
 * Onboarding leve — só aparece 1x, é pulável, gravado em `profiles.onboarded_at`.
 * Passo 1: escolher no mínimo 3 gêneros (categorias existentes). Sem limite máximo.
 * Passo 2: convite pra ver o tour rápido (leva a /tutoriais). Também pulável.
 */
export default function OnboardingDialog() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'genres' | 'tutorial'>('genres');
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);
  const [picked, setPicked] = useState<string[]>(() => {
    // GAP-OBD02: Carregar do localStorage se existir
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? JSON.parse(saved) : [];
      } catch { return []; }
    }
    return [];
  });
  const [saving, setSaving] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);

  // GAP-OBD04: Barra de progresso
  const progress = step === 'genres' ? 50 : 100;

  useEffect(() => {
    if (!user || checked) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const [{ data: prof }, { data: cats }] = await Promise.all([
          supabase.rpc('get_my_profile') as any,
          supabase.from('categorias').select('name').order('name'),
        ]);

        if (cancelled) return;

        const row = Array.isArray(prof) ? prof[0] : prof;
        setChecked(true);
        setCategories((cats || []).map((c: { name: string }) => c.name));

        // GAP-OBD02: Verificar localStorage primeiro
        const saved = localStorage.getItem(STORAGE_KEY);
        const savedPicks = saved ? JSON.parse(saved) : [];

        if (row && !row.onboarded_at) {
          setPicked(savedPicks.length > 0 ? savedPicks : (row.favorite_genres || []));
          setOpen(true);
        }
      } catch (err) {
        console.error('Onboarding load error:', err);
      } finally {
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user, checked]);

  const toggle = useCallback((name: string) => {
    setPicked(prev => {
      const next = prev.includes(name)
        ? prev.filter(x => x !== name)
        : [...prev, name];
      // GAP-OBD02: Salvar no localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const persist = async (savePrefs: boolean) => {
    if (!user) return false;
    setSaving(true);
    const patch: Record<string, unknown> = { onboarded_at: new Date().toISOString() };
    if (savePrefs) patch.favorite_genres = picked;
    try {
      const { error } = await supabase.from('profiles').update(patch).eq('id', user.id);
      if (error) throw error;
      // GAP-OBD02: Limpar localStorage após salvar
      localStorage.removeItem(STORAGE_KEY);
      if (savePrefs) toast.success('Preferências salvas — vamos ajustar seus destaques 👀');
      return true;
    } catch (error) {
      toast.error('Não deu pra salvar agora — pode ajustar depois em Configurações.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const savePrefsAndAdvance = async () => {
    if (picked.length < 3) {
      toast.error('Escolha pelo menos 3 gêneros — ou toque em "Pular" pra decidir depois.');
      return;
    }
    const ok = await persist(true);
    if (ok) {
      // GAP-OBD05: Transição suave
      setStep('tutorial');
    }
  };

  const skipToTutorial = async () => {
    const ok = await persist(false);
    if (ok) {
      setStep('tutorial');
    }
  };

  const closeAndMaybeTutorial = (goTutorial: boolean) => {
    setOpen(false);
    if (goTutorial) navigate('/tutoriais');
  };

  const canSave = picked.length >= 3;
  const displayedCategories = showAllCategories ? categories : categories.slice(0, 12);

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (!v && step === 'genres') {
        persist(false).then(() => setOpen(false));
      } else if (!v) {
        setOpen(false);
      }
    }}>
      <DialogContent className="max-w-lg">
        {/* GAP-OBD04: Barra de progresso */}
        <div className="w-full h-1 bg-secondary rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground mt-2">Carregando...</p>
          </div>
        ) : step === 'genres' ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" /> Escolha seus gêneros favoritos
              </DialogTitle>
              <DialogDescription>
                Selecione <span className="text-foreground font-medium">no mínimo 3</span> — sem limite máximo.
                A gente usa isso pra sugerir jogos e destaques mais alinhados com você.
                Pode pular agora e ajustar depois em <span className="text-foreground">Configurações → Preferências</span>.
              </DialogDescription>
            </DialogHeader>

            {categories.length === 0 ? (
              // GAP-OBD01: Fallback para categorias vazias
              <div className="py-6 text-center">
                <p className="text-sm text-muted-foreground">Nenhuma categoria cadastrada ainda.</p>
                <p className="text-xs text-muted-foreground mt-1">Você pode pular e configurar depois.</p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 py-2 max-h-48 overflow-y-auto">
                  {displayedCategories.map(name => {
                    const active = picked.includes(name);
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => toggle(name)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm border transition-colors',
                          active
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-secondary text-foreground border-border hover:border-primary/60'
                        )}
                      >
                        {active && <Check className="h-3.5 w-3.5" />} {name}
                      </button>
                    );
                  })}
                </div>

                {/* GAP-OBD03: Botão "Ver todas" */}
                {categories.length > 12 && (
                  <button
                    onClick={() => setShowAllCategories(!showAllCategories)}
                    className="text-xs text-primary hover:underline mt-1"
                  >
                    {showAllCategories ? 'Ver menos' : `Ver todas (${categories.length})`}
                  </button>
                )}

                <p className={cn(
                  'text-xs mt-2',
                  canSave ? 'text-muted-foreground' : 'text-warning'
                )}>
                  {picked.length} selecionados {canSave ? '✓' : `— faltam ${3 - picked.length} pra atingir o mínimo`}
                </p>
              </>
            )}

            <DialogFooter className="gap-2 mt-4">
              <Button variant="ghost" onClick={skipToTutorial} disabled={saving}>
                Pular
              </Button>
              <Button onClick={savePrefsAndAdvance} disabled={saving || !canSave || categories.length === 0}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ChevronRight className="h-4 w-4 mr-1" />}
                Salvar e continuar
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-accent" /> Quer um tour rápido?
              </DialogTitle>
              <DialogDescription>
                Temos tutoriais interativos curtinhos sobre perfil, biblioteca, torneios, review completa e mais.
                Você pode ver agora ou abrir depois em <span className="text-foreground">Configurações → Tutoriais</span>.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="gap-2 mt-4">
              {/* GAP-OBD06: Botão "Pular" claro */}
              <Button variant="ghost" onClick={() => closeAndMaybeTutorial(false)}>
                Agora não
              </Button>
              <Button onClick={() => closeAndMaybeTutorial(true)}>
                <GraduationCap className="h-4 w-4 mr-1" /> Sim, me mostrar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}