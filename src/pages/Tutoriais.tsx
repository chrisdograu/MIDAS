import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { CheckCircle2, Circle, GraduationCap, Monitor, Smartphone, Filter, Clock, AlertCircle, Sparkles, ArrowRight, X } from 'lucide-react';
import { TUTORIALS, useTutorial } from '@/components/tutorial/TutorialContext';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

// GAP-624: Duração estimada por tutorial (em minutos)
const TUTORIAL_DURATION: Record<string, number> = {
  web_perfil: 5,
  web_biblioteca: 4,
  web_review_completa: 6,
  web_torneios: 5,
  web_busca_global: 4,
  web_conversas_opinioes: 3,
  web_destaques: 3,
  mobile_feed: 4,
  mobile_marketplace: 5,
  mobile_forum: 4,
  mobile_chat: 3,
  mobile_anunciar: 6,
  mobile_perfil: 4,
};

// GAP-623: Tutorial recomendado para novos usuários
const RECOMMENDED_TUTORIAL = 'web_perfil';

function getDuration(key: string): number {
  return TUTORIAL_DURATION[key] || 4;
}

function formatDuration(minutes: number): string {
  if (minutes < 1) return '< 1 min';
  if (minutes === 1) return '1 min';
  return `${minutes} min`;
}

export default function Tutoriais() {
  const { seen, isLoading } = useTutorial();
  
  // GAP-622: Filtro por área
  const [filter, setFilter] = useState<'all' | 'web' | 'mobile'>('all');
  
  // GAP-623: Banner de onboarding
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [hasCompletedRecommended, setHasCompletedRecommended] = useState(false);

  // GAP-623: Verificar se o tutorial recomendado já foi concluído
  useEffect(() => {
    if (!isLoading) {
      setHasCompletedRecommended(seen.has(RECOMMENDED_TUTORIAL));
    }
  }, [seen, isLoading]);

  const web = TUTORIALS.filter(t => t.area === 'web');
  const mobile = TUTORIALS.filter(t => t.area === 'mobile');
  
  // GAP-622: Filtrar por área
  const getFilteredTutorials = () => {
    if (filter === 'all') return [...web, ...mobile];
    if (filter === 'web') return web;
    return mobile;
  };

  const filtered = getFilteredTutorials();
  const total = filtered.length;
  const done = filtered.filter(t => seen.has(t.key)).length;

  // GAP-623: Fechar banner de onboarding
  const dismissOnboarding = () => {
    setShowOnboarding(false);
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 text-primary text-xs mb-3">
          <GraduationCap className="h-3 w-3" /> Aprenda na prática
        </div>
        <h1 className="font-display text-3xl font-bold gradient-text">Tutoriais MIDIAS</h1>
        <p className="text-muted-foreground mt-2">
          Cada tutorial abre uma página réplica com conteúdo de exemplo. Aprenda sem medo de quebrar nada.
        </p>
        {!isLoading && (
          <p className="text-sm text-muted-foreground mt-3">
            Progresso: <b className="text-primary">{done}/{total}</b> concluídos
          </p>
        )}
      </div>

      {/* GAP-623: Banner de onboarding */}
      {showOnboarding && !hasCompletedRecommended && !isLoading && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 rounded-xl border border-primary/30 bg-primary/5 relative"
        >
          <button
            onClick={dismissOnboarding}
            className="absolute top-2 right-2 p-1 rounded hover:bg-secondary transition-colors"
            aria-label="Fechar"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">
                🎯 Comece pelo tutorial recomendado!
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                O tutorial <b>"{TUTORIALS.find(t => t.key === RECOMMENDED_TUTORIAL)?.title}"</b> é o melhor ponto de partida para conhecer a plataforma.
              </p>
              <Link
                to={TUTORIALS.find(t => t.key === RECOMMENDED_TUTORIAL)?.replicaRoute || '#'}
                className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-primary hover:underline"
              >
                Começar agora <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </motion.div>
      )}

      {/* GAP-622: Filtros por área */}
      <div className="flex items-center gap-2 mb-6">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground font-medium">Filtrar:</span>
        <div className="flex gap-1.5">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            Todos ({web.length + mobile.length})
          </button>
          <button
            onClick={() => setFilter('web')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors inline-flex items-center gap-1 ${
              filter === 'web'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            <Monitor className="h-3 w-3" /> Web ({web.length})
          </button>
          <button
            onClick={() => setFilter('mobile')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors inline-flex items-center gap-1 ${
              filter === 'mobile'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            <Smartphone className="h-3 w-3" /> Mobile ({mobile.length})
          </button>
        </div>
      </div>

      {/* Lista de tutoriais filtrados */}
      <AnimatePresence mode="wait">
        <motion.div
          key={filter}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Nenhum tutorial nesta categoria.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {filtered.map(t => {
                const isDone = seen.has(t.key);
                const duration = getDuration(t.key);
                const isRecommended = t.key === RECOMMENDED_TUTORIAL && !isDone;

                return (
                  <Link
                    key={t.key}
                    to={t.replicaRoute}
                    className={`glass rounded-xl p-4 flex items-start gap-3 hover:border-primary/40 transition-colors ${
                      isDone ? 'opacity-70' : ''
                    } ${isRecommended ? 'border-primary/30 bg-primary/5' : ''}`}
                  >
                    {isDone ? (
                      <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{t.title}</p>
                        {/* GAP-624: Badge de duração */}
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" /> {formatDuration(duration)}
                        </span>
                        {isRecommended && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-medium flex items-center gap-0.5">
                            <Sparkles className="h-2.5 w-2.5" /> Recomendado
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* GAP-623: Progresso detalhado */}
      {!isLoading && filtered.length > 0 && (
        <div className="mt-6 p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progresso nos tutoriais filtrados</span>
            <span className="font-semibold">{done}/{total} concluídos</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
              style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}