import { useCallback, useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Radio, ZoomIn, ZoomOut, List, Grid, Crown, Trophy, Star, Target } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

interface Match {
  id: string; round: number; position: number;
  player_a: string | null; player_b: string | null;
  score_a: number | null; score_b: number | null;
  winner: string | null; status: string;
}

interface Profile { id: string; display_name: string | null; avatar_url: string | null; }

// GAP-TB02: Modos de visualização
type ViewMode = 'bracket' | 'list';

// GAP-TB03: Caminho do usuário no bracket
interface UserPath {
  matches: Match[];
  currentMatch: Match | null;
  nextMatch: Match | null;
}

export default function TournamentBracket({ 
  tournament, 
  onClose 
}: { 
  tournament: { id: string; title: string }; 
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('bracket');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [highlightedMatch, setHighlightedMatch] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const { data: ms } = await supabase
      .from('tournament_matches' as any)
      .select('*')
      .eq('tournament_id', tournament.id)
      .order('round')
      .order('position');
    const list = ((ms as any) || []) as Match[];
    setMatches(list);
    
    const ids = [...new Set(list.flatMap(m => [m.player_a, m.player_b]).filter(Boolean) as string[])];
    if (ids.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', ids);
      const map: Record<string, Profile> = {};
      (profs || []).forEach(p => { map[p.id] = p as any; });
      setProfiles(prev => ({ ...prev, ...map }));
    }
    setLoading(false);
  }, [tournament.id]);

  useEffect(() => {
    reload();
    const ch = supabase.channel(`bracket-${tournament.id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'tournament_matches', 
        filter: `tournament_id=eq.${tournament.id}` 
      }, reload)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'tournament_participants', 
        filter: `tournament_id=eq.${tournament.id}` 
      }, reload)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tournament.id, reload]);

  // GAP-TB03: Encontrar caminho do usuário
  const userPath = useMemo<UserPath | null>(() => {
    if (!user) return null;
    
    const userMatches = matches.filter(m => 
      m.player_a === user.id || m.player_b === user.id
    );
    
    if (userMatches.length === 0) return null;
    
    const currentMatch = userMatches.find(m => m.status === 'playing' || m.status === 'pending');
    const nextMatch = userMatches.find(m => m.status === 'upcoming');
    
    return {
      matches: userMatches,
      currentMatch: currentMatch || null,
      nextMatch: nextMatch || null,
    };
  }, [matches, user]);

  const rounds = [...new Set(matches.map(m => m.round))].sort();

  // GAP-TB01: Zoom
  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.1, 2));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.1, 0.5));

  // GAP-TB03: Destacar caminho do usuário
  const isUserMatch = (match: Match) => {
    return user && (match.player_a === user.id || match.player_b === user.id);
  };

  const isUserWinner = (match: Match) => {
    return user && match.winner === user.id;
  };

  // GAP-TB04: Animação de vitória
  const getMatchAnimation = (match: Match) => {
    if (match.winner && isUserWinner(match)) {
      return {
        className: 'ring-2 ring-yellow-400 shadow-lg shadow-yellow-400/20',
        icon: <Crown className="h-3 w-3 text-yellow-400" />,
        label: 'Vitória!',
      };
    }
    if (isUserMatch(match)) {
      return {
        className: 'ring-2 ring-primary shadow-lg shadow-primary/20',
        icon: <Target className="h-3 w-3 text-primary" />,
        label: 'Sua partida',
      };
    }
    if (match.winner) {
      return {
        className: 'border-success/30',
        icon: <Star className="h-3 w-3 text-success" />,
        label: 'Vencedor',
      };
    }
    return { className: '', icon: null, label: '' };
  };

  // GAP-TB02: Visualização em lista
  const renderListView = () => {
    const sortedMatches = [...matches].sort((a, b) => a.round - b.round || a.position - b.position);
    
    return (
      <div className="space-y-4">
        {rounds.map(r => (
          <div key={r}>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">
              Rodada {r}
            </h3>
            <div className="space-y-2">
              {sortedMatches
                .filter(m => m.round === r)
                .map(m => {
                  const a = m.player_a ? profiles[m.player_a] : null;
                  const b = m.player_b ? profiles[m.player_b] : null;
                  const matchInfo = getMatchAnimation(m);
                  
                  return (
                    <div 
                      key={m.id}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border border-border bg-card",
                        matchInfo.className,
                        highlightedMatch === m.id && "ring-2 ring-primary"
                      )}
                      onMouseEnter={() => setHighlightedMatch(m.id)}
                      onMouseLeave={() => setHighlightedMatch(null)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground font-mono">
                          #{m.position}
                        </span>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "text-sm font-medium",
                              m.winner === m.player_a && "text-success"
                            )}>
                              {a?.display_name || '—'}
                              {m.winner === m.player_a && <Trophy className="h-3 w-3 inline ml-1 text-yellow-400" />}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {m.score_a ?? '-'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "text-sm font-medium",
                              m.winner === m.player_b && "text-success"
                            )}>
                              {b?.display_name || '—'}
                              {m.winner === m.player_b && <Trophy className="h-3 w-3 inline ml-1 text-yellow-400" />}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {m.score_b ?? '-'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {matchInfo.icon}
                        <span className="text-xs text-muted-foreground">
                          {matchInfo.label}
                        </span>
                        <span className={cn(
                          "text-xs px-2 py-0.5 rounded-full",
                          m.status === 'finished' ? "bg-success/10 text-success" :
                          m.status === 'playing' ? "bg-primary/10 text-primary animate-pulse" :
                          "bg-muted text-muted-foreground"
                        )}>
                          {m.status || 'pendente'}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // GAP-TB01: Bracket com zoom
  const renderBracketView = () => (
    <div 
      className="flex gap-6 overflow-x-auto pb-4 transition-transform duration-300"
      style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top left' }}
    >
      {rounds.map(r => (
        <div key={r} className="space-y-3 min-w-[220px]">
          <h3 className="text-sm font-semibold text-center text-muted-foreground">
            Rodada {r}
          </h3>
          {matches.filter(m => m.round === r).map(m => {
            const a = m.player_a ? profiles[m.player_a] : null;
            const b = m.player_b ? profiles[m.player_b] : null;
            const matchInfo = getMatchAnimation(m);
            
            const cell = (p: Profile | null, score: number | null, isWinner: boolean) => (
              <div className={cn(
                "flex items-center justify-between px-3 py-2 rounded transition-all",
                isWinner ? 'bg-primary/15 border-l-2 border-primary' : 'bg-secondary/30'
              )}>
                <span className="text-sm truncate flex items-center gap-1.5">
                  {isWinner && <Crown className="h-3 w-3 text-yellow-400" />}
                  {p?.display_name || '—'}
                </span>
                <span className="text-xs font-mono text-muted-foreground">
                  {score ?? '-'}
                </span>
              </div>
            );
            
            return (
              <motion.div 
                key={m.id}
                initial={isUserMatch(m) ? { scale: 0.95, opacity: 0.8 } : undefined}
                animate={isUserMatch(m) ? { scale: 1, opacity: 1 } : undefined}
                transition={{ duration: 0.3 }}
                className={cn(
                  "border border-border rounded-lg overflow-hidden bg-card transition-all",
                  matchInfo.className,
                  highlightedMatch === m.id && "ring-2 ring-primary"
                )}
                onMouseEnter={() => setHighlightedMatch(m.id)}
                onMouseLeave={() => setHighlightedMatch(null)}
              >
                {cell(a, m.score_a, m.winner === m.player_a && !!m.player_a)}
                <div className="border-t border-border" />
                {cell(b, m.score_b, m.winner === m.player_b && !!m.player_b)}
                
                {/* GAP-TB03: Indicador de partida do usuário */}
                {isUserMatch(m) && (
                  <div className="absolute -top-1 -right-1">
                    <span className="flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                    </span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      ))}
    </div>
  );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {tournament.title} — Chaveamento
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-success bg-success/10 border border-success/30 rounded-full px-2 py-0.5">
                <Radio className="h-2.5 w-2.5 animate-pulse" /> AO VIVO
              </span>
            </div>
            
            {/* GAP-TB01: Controles de zoom */}
            <div className="flex items-center gap-1">
              <button
                onClick={handleZoomOut}
                disabled={zoomLevel <= 0.5}
                className="p-1.5 rounded-lg hover:bg-secondary transition-colors disabled:opacity-50"
                aria-label="Zoom out"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="text-xs text-muted-foreground min-w-[40px] text-center">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                disabled={zoomLevel >= 2}
                className="p-1.5 rounded-lg hover:bg-secondary transition-colors disabled:opacity-50"
                aria-label="Zoom in"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              
              {/* GAP-TB02: Toggle de visualização */}
              <button
                onClick={() => setViewMode(viewMode === 'bracket' ? 'list' : 'bracket')}
                className="p-1.5 rounded-lg hover:bg-secondary transition-colors ml-2"
                aria-label={viewMode === 'bracket' ? 'Ver lista' : 'Ver bracket'}
              >
                {viewMode === 'bracket' ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
              </button>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : matches.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">
            Chaves ainda não geradas.
          </p>
        ) : (
          <>
            {/* GAP-TB03: Resumo do caminho do usuário */}
            {userPath && userPath.currentMatch && (
              <div className="mb-4 p-3 rounded-lg bg-primary/5 border border-primary/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">
                    Sua partida atual
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">
                  Rodada {userPath.currentMatch.round}
                  {userPath.nextMatch && ` • Próxima: Rodada ${userPath.nextMatch.round}`}
                </span>
              </div>
            )}
            
            <AnimatePresence mode="wait">
              <motion.div
                key={viewMode}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="relative"
              >
                {viewMode === 'bracket' ? renderBracketView() : renderListView()}
              </motion.div>
            </AnimatePresence>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}