import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Sparkles, Check, GraduationCap, X, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

// GAP-M010: Categorias padrão para fallback
const DEFAULT_CATEGORIES = [
  'Ação', 'Aventura', 'RPG', 'Estratégia', 'Simulação',
  'Esportes', 'Corrida', 'Luta', 'Terror', 'Puzzle',
  'Plataforma', 'Mundo Aberto', 'Indie', 'Multiplayer',
];

/**
 * Onboarding mobile — bottom-sheet equivalente ao OnboardingDialog web.
 * Passo 1: gêneros (mín. 3, sem máx). Passo 2: convite pro tour → /m/tutoriais.
 * Grava `profiles.onboarded_at` — só aparece uma vez.
 */
export default function MOnboardingSheet() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'genres' | 'tutorial'>('genres');
  const [checked, setChecked] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // GAP-M012: Retry com fallback
  useEffect(() => {
    if (!user || checked) return;
    let cancelled = false;

    (async () => {
      try {
        setError(null);
        const [{ data: prof }, { data: cats, error: catsError }] = await Promise.all([
          (supabase as any).rpc('get_my_profile'),
          supabase.from('categorias').select('name').order('name'),
        ]);

        if (cancelled) return;

        // GAP-M010: Fallback para categorias vazias
        let categoryNames = (cats || []).map((c: { name: string }) => c.name);
        if (categoryNames.length === 0) {
          categoryNames = DEFAULT_CATEGORIES;
          console.warn('Nenhuma categoria encontrada, usando fallback.');
        }

        const row = Array.isArray(prof) ? prof[0] : prof;
        setChecked(true);
        setCategories(categoryNames);

        if (row && !row.onboarded_at) {
          setPicked(row.favorite_genres || []);
          setOpen(true);
        }
      } catch (err) {
        setError('Erro ao carregar preferências. Tente novamente.');
        console.error('Onboarding error:', err);
      }
    })();

    return () => { cancelled = true; };
  }, [user, checked, retryCount]);

  // GAP-M012: Retry manual
  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    setChecked(false);
    setError(null);
  };

  const toggle = (name: string) =>
    setPicked(p => p.includes(name) ? p.filter(x => x !== name) : [...p, name]);

  // GAP-M009: Persistir progresso
  const persist = async (savePrefs: boolean): Promise<boolean> => {
    if (!user) return false;
    setSaving(true);
    setError(null);
    try {
      const patch: Record<string, unknown> = { onboarded_at: new Date().toISOString() };
      if (savePrefs) patch.favorite_genres = picked;
      
      const { error } = await (supabase as any).from('profiles').update(patch).eq('id', user.id);
      if (error) throw error;
      
      if (savePrefs) toast.success('Preferências salvas ✨');
      return true;
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar preferências');
      toast.error('Não deu pra salvar agora — ajuste depois em Configurações.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveAndAdvance = async () => {
    if (picked.length < 3) { 
      toast.error('Escolha pelo menos 3 gêneros.');
      return;
    }
    if (await persist(true)) setStep('tutorial');
  };

  const skipToTutorial = async () => { 
    if (await persist(false)) setStep('tutorial'); 
  };

  const closeSheet = (goTutorial: boolean) => {
    setOpen(false);
    if (goTutorial) navigate('/m/tutoriais');
  };

  // GAP-M011: Animações
  const variants = {
    enter: { opacity: 0, y: 20 },
    center: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  };

  if (!user || !open) return null;
  const canSave = picked.length >= 3;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overlay-scrim backdrop-blur-sm">
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="w-full max-w-md bg-background border-t border-border rounded-t-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold flex items-center gap-2">
            {step === 'genres' ? (
              <><Sparkles className="h-5 w-5 text-primary" /> Seus gêneros favoritos</>
            ) : (
              <><GraduationCap className="h-5 w-5 text-accent" /> Tour rápido?</>
            )}
          </h2>
          <button onClick={() => closeSheet(false)} className="text-muted-foreground p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-2.5">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-destructive">{error}</p>
              <button
                onClick={handleRetry}
                className="text-xs text-primary hover:underline mt-1"
              >
                Tentar novamente
              </button>
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {step === 'genres' ? (
            <motion.div
              key="genres"
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25 }}
              className="space-y-3"
            >
              <p className="text-xs text-muted-foreground">
                Selecione <strong className="text-foreground">no mínimo 3</strong> — sem limite máximo.
                Ajustável depois em <strong className="text-foreground">Configurações → Preferências</strong>.
              </p>
              <div className="flex flex-wrap gap-2 py-1">
                {categories.map(name => {
                  const active = picked.includes(name);
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => toggle(name)}
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs border transition-colors ${
                        active
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-secondary text-foreground border-border'
                      }`}
                    >
                      {active && <Check className="h-3 w-3" />} {name}
                    </button>
                  );
                })}
              </div>
              <p className={`text-[11px] ${canSave ? 'text-muted-foreground' : 'text-warning'}`}>
                {picked.length} selecionados {canSave ? '✓' : `— faltam ${3 - picked.length}`}
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={skipToTutorial}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold disabled:opacity-50"
                >
                  Pular
                </button>
                <button
                  onClick={saveAndAdvance}
                  disabled={saving || !canSave}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground text-sm font-semibold flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar e continuar
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="tutorial"
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25 }}
              className="space-y-3"
            >
              <p className="text-xs text-muted-foreground">
                Tutoriais interativos curtinhos sobre feed, marketplace, chat, anúncios e perfil.
                Pode ver agora ou abrir depois em <strong className="text-foreground">Configurações → Tutoriais</strong>.
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => closeSheet(false)}
                  className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold"
                >
                  Agora não
                </button>
                <button
                  onClick={() => closeSheet(true)}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground text-sm font-semibold flex items-center justify-center gap-1"
                >
                  <GraduationCap className="h-4 w-4" /> Sim, me mostrar
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}