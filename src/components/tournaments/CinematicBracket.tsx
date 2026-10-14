import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Crown, Radio, Trophy, Users, Shield, Star, ChevronRight, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

interface Match {
  id: string; round: number; player_a: string | null; player_b: string | null;
  winner_id: string | null; score_a: number; score_b: number;
  is_live: boolean; bracket_side?: string; round_label?: string | null;
  tournament_id: string;
}
interface Profile { id: string; display_name: string | null; avatar_url: string | null }

interface Props {
  matches: Match[];
  profiles: Record<string, Profile>;
  bracketType?: 'single' | 'double';
  /** GAP-CB04: ID do jogador atual para destacar caminho */
  currentPlayerId?: string | null;
}

// GAP-CB02: Badges por rodada
const ROUND_BADGES: Record<number, { label: string; icon: any; color: string }> = {
  1: { label: 'Quartas', icon: Shield, color: 'text-info border-info/30 bg-info/10' },
  2: { label: 'Semifinal', icon: Star, color: 'text-highlight border-highlight/30 bg-highlight/10' },
  3: { label: 'Final', icon: Trophy, color: 'text-warning border-warning/30 bg-warning/10' },
  4: { label: 'Grande Final', icon: Crown, color: 'text-destructive border-destructive/30 bg-destructive/10' },
};

function PlayerSlot({ 
  id, 
  profiles, 
  score, 
  isWinner, 
  isLive, 
  isCurrentPlayer,
  isTie 
}: { 
  id: string | null; 
  profiles: Record<string, Profile>; 
  score: number; 
  isWinner: boolean; 
  isLive: boolean;
  isCurrentPlayer?: boolean;
  isTie?: boolean;
}) {
  const p = id ? profiles[id] : null;
  return (
    <div className={cn(
      "flex items-center justify-between gap-2 px-3 py-2 rounded-md transition-colors",
      isWinner ? 'bg-primary/20 text-primary font-bold' : 
      isTie ? 'bg-warning/20 text-warning font-bold' :
      isCurrentPlayer ? 'bg-primary/30 text-primary font-bold ring-2 ring-primary' :
      'bg-secondary/40 text-foreground/80'
    )}>
      <div className="flex items-center gap-2 min-w-0">
        {p?.avatar_url ? (
          <img src={p.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" loading="lazy" />
        ) : (
          <div className={cn(
            "w-6 h-6 rounded-full shrink-0",
            isCurrentPlayer ? "bg-primary" : "bg-muted"
          )} />
        )}
        <span className="text-xs truncate font-medium">
          {p?.display_name || (id ? 'Jogador' : 'TBD')}
          {isCurrentPlayer && ' ← Você'}
        </span>
        {isLive && <Radio className="h-3 w-3 text-destructive animate-pulse shrink-0" />}
      </div>
      {score > 0 && (
        <span className={cn(
          "text-sm font-bold tabular-nums",
          isWinner ? "text-primary" : isTie ? "text-warning" : "text-muted-foreground"
        )}>
          {score}
        </span>
      )}
    </div>
  );
}

export default function CinematicBracket({ 
  matches, 
  profiles, 
  bracketType = 'single',
  currentPlayerId 
}: Props) {
  const nav = useNavigate();
  const { user } = useAuth();
  const upper = matches.filter(m => m.bracket_side === 'upper' || !m.bracket_side);
  const lower = matches.filter(m => m.bracket_side === 'lower');
  const useDouble = bracketType === 'double' && lower.length > 0;

  // GAP-CB04: Verificar se o jogador atual está neste match
  const isPlayerInMatch = (match: Match) => {
    if (!currentPlayerId) return false;
    return match.player_a === currentPlayerId || match.player_b === currentPlayerId;
  };

  // GAP-CB01: Variantes de animação
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 }
  };

  // GAP-CB03: Verificar empate
  const isTie = (match: Match) => {
    return match.score_a > 0 && match.score_b > 0 && match.score_a === match.score_b && !match.winner_id;
  };

  const renderColumn = (list: Match[], title: string) => {
    const rounds = Array.from(new Set(list.map(m => m.round))).sort((a, b) => a - b);
    return (
      <div>
        <h3 className="text-xs font-bold tracking-[0.25em] uppercase text-muted-foreground mb-4 flex items-center gap-2">
          {title}
          <span className="text-[10px] text-muted-foreground/60">({list.length} partidas)</span>
        </h3>
        <motion.div 
          className="flex gap-6 overflow-x-auto pb-4"
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          {rounds.map(r => {
            const ms = list.filter(m => m.round === r);
            const badge = ROUND_BADGES[r] || { label: `Rodada ${r}`, icon: Users, color: 'text-muted-foreground border-border/40 bg-muted/20' };
            const Icon = badge.icon;
            const hasFinal = r === Math.max(...rounds);
            
            return (
              <motion.div 
                key={r} 
                className="flex flex-col gap-4 min-w-[220px]"
                variants={itemVariants}
              >
                <div className="text-[10px] tracking-widest uppercase text-muted-foreground/70 text-center flex items-center justify-center gap-1.5">
                  <Icon className={cn("h-3 w-3", badge.color.split(' ')[0])} />
                  <span className={badge.color}>{badge.label}</span>
                  {hasFinal && <Crown className="h-3 w-3 text-warning" />}
                </div>
                {ms.map((m, i) => {
                  const isCurrent = isPlayerInMatch(m);
                  const tie = isTie(m);
                  
                  return (
                    <motion.button
                      key={m.id}
                      onClick={() => nav(`/torneios/${m.tournament_id}/partida/${m.id}`)}
                      initial={{ opacity: 0, y: 8 }} 
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className={cn(
                        "relative bg-card/60 backdrop-blur-sm border rounded-xl p-2 space-y-1 text-left transition-all",
                        "hover:border-primary/60 hover:scale-[1.02]",
                        m.is_live ? 'border-destructive/60 shadow-[0_0_24px_-6px] shadow-destructive/40' : 
                        isCurrent ? 'border-primary/60 shadow-[0_0_16px_-4px] shadow-primary/40' :
                        'border-border/60'
                      )}
                    >
                      {m.is_live && (
                        <div className="absolute -top-2 left-3 px-2 py-0.5 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold tracking-widest flex items-center gap-1 z-10">
                          <Radio className="h-2.5 w-2.5 animate-pulse" /> AO VIVO
                        </div>
                      )}
                      
                      {isCurrent && !m.is_live && (
                        <div className="absolute -top-2 right-3 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[9px] font-bold tracking-widest flex items-center gap-1 z-10">
                          <Eye className="h-2.5 w-2.5" /> SUA PARTIDA
                        </div>
                      )}
                      
                      <PlayerSlot 
                        id={m.player_a} 
                        profiles={profiles} 
                        score={m.score_a} 
                        isWinner={m.winner_id === m.player_a} 
                        isLive={m.is_live}
                        isCurrentPlayer={m.player_a === currentPlayerId}
                        isTie={tie}
                      />
                      <PlayerSlot 
                        id={m.player_b} 
                        profiles={profiles} 
                        score={m.score_b} 
                        isWinner={m.winner_id === m.player_b} 
                        isLive={m.is_live}
                        isCurrentPlayer={m.player_b === currentPlayerId}
                        isTie={tie}
                      />
                      
                      {/* GAP-CB03: Indicador de empate */}
                      {tie && (
                        <div className="flex items-center gap-1 text-[10px] text-warning/80 px-2 pt-0.5">
                          ⚖️ Empate — aguardando desempate
                        </div>
                      )}
                      
                      {m.winner_id && !tie && (
                        <div className="flex items-center gap-1 text-[10px] text-primary/80 px-2 pt-0.5">
                          <Crown className="h-3 w-3" /> {profiles[m.winner_id]?.display_name || 'Vencedor'} avançou
                        </div>
                      )}
                      
                      {!m.winner_id && !m.is_live && m.player_a && m.player_b && !tie && (
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60 px-2 pt-0.5">
                          <ChevronRight className="h-3 w-3" /> Aguardando resultado
                        </div>
                      )}
                    </motion.button>
                  );
                })}
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* GAP-CB04: Indicador de "Seu caminho" */}
      {currentPlayerId && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-primary/5 border border-primary/20 rounded-lg px-3 py-1.5">
          <Eye className="h-3.5 w-3.5 text-primary" />
          <span>Suas partidas estão destacadas em <span className="text-primary font-semibold">azul</span></span>
          <span className="ml-auto text-[10px]">👤 {profiles[currentPlayerId]?.display_name || 'Você'}</span>
        </div>
      )}
      
      {renderColumn(upper, useDouble ? 'CHAVE SUPERIOR' : 'CHAVEAMENTO')}
      {useDouble && renderColumn(lower, 'CHAVE INFERIOR (REPESCAGEM)')}
      
      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/60 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-primary/20 border border-primary/40" />
          Vencedor
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-warning/20 border border-warning/40" />
          Empate
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-destructive/20 border border-destructive/40 animate-pulse" />
          Ao vivo
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-primary/30 border-2 border-primary" />
          Sua partida
        </span>
      </div>
    </div>
  );
}