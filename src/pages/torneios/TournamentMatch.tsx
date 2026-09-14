import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Radio, Loader2, Trophy, Sparkles, Target, Crown, Share2, Bell, Clock, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import LiveTournamentChat from '@/components/tournaments/LiveTournamentChat';
import { formatDate, formatTime } from '@/lib/format';
import { dbWrite } from '@/lib/dbWrite';

export default function TournamentMatch() {
  const { id, matchId } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [t, setT] = useState<any>(null);
  const [m, setM] = useState<any>(null);
  const [pa, setPa] = useState<any>(null);
  const [pb, setPb] = useState<any>(null);
  const [predA, setPredA] = useState(0);
  const [predB, setPredB] = useState(0);
  const [myPred, setMyPred] = useState<string | null>(null);
  const [mvpA, setMvpA] = useState(0);
  const [mvpB, setMvpB] = useState(0);
  const [myMvp, setMyMvp] = useState<string | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [h2h, setH2h] = useState<{ a: number; b: number; total: number; last?: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);

  // GAP-660: Estado para replay
  const [replayIndex, setReplayIndex] = useState(0);
  const [isReplaying, setIsReplaying] = useState(false);

  // GAP-659: Notificação de início
  useEffect(() => {
    if (m?.is_live && user) {
      // Verificar se já notificou
      const key = `match_start_notified_${matchId}_${user.id}`;
      if (!localStorage.getItem(key)) {
        toast.info(`🔴 Partida ${pa?.display_name || 'A'} vs ${pb?.display_name || 'B'} começou!`, {
          duration: 8000,
          action: {
            label: 'Assistir',
            onClick: () => window.location.reload(),
          }
        });
        localStorage.setItem(key, 'true');
      }
    }
  }, [m?.is_live, matchId, user?.id, pa, pb]);

  const load = async () => {
    if (!matchId || !id) return;
    const { data: match } = await supabase.from('tournament_matches' as any).select('*').eq('id', matchId).maybeSingle();
    setM(match);
    const { data: tour } = await supabase.from('tournaments' as any).select('*').eq('id', id).maybeSingle();
    setT(tour);
    if (match) {
      const mm = match as any;
      const uids = [mm.player_a, mm.player_b].filter(Boolean);
      if (uids.length) {
        const { data: profs } = await supabase.from('profiles').select('id, display_name, avatar_url').in('id', uids);
        const map = Object.fromEntries((profs || []).map(p => [p.id, p]));
        setPa(map[mm.player_a]); setPb(map[mm.player_b]);
      }
      const [pRes, vRes, eRes] = await Promise.all([
        supabase.from('tournament_predictions' as any).select('predicted_winner_id, user_id').eq('match_id', matchId),
        supabase.from('tournament_mvp_votes' as any).select('voted_for_id, voter_id').eq('match_id', matchId),
        supabase.from('tournament_match_events' as any).select('*').eq('match_id', matchId).order('created_at', { ascending: false }).limit(20),
      ]);
      const preds = (pRes.data as any) || [];
      setPredA(preds.filter((p: any) => p.predicted_winner_id === mm.player_a).length);
      setPredB(preds.filter((p: any) => p.predicted_winner_id === mm.player_b).length);
      if (user) {
        const mine = preds.find((p: any) => p.user_id === user.id);
        setMyPred(mine?.predicted_winner_id || null);
      }
      const votes = (vRes.data as any) || [];
      setMvpA(votes.filter((v: any) => v.voted_for_id === mm.player_a).length);
      setMvpB(votes.filter((v: any) => v.voted_for_id === mm.player_b).length);
      if (user) {
        const mineV = votes.find((v: any) => v.voter_id === user.id);
        setMyMvp(mineV?.voted_for_id || null);
      }
      setEvents((eRes.data as any) || []);

      // H2H
      if (mm.player_a && mm.player_b) {
        const { data: history } = await supabase.from('tournament_matches' as any)
          .select('id, winner_id, score_a, score_b, ended_at, player_a, player_b, tournament_id')
          .or(`and(player_a.eq.${mm.player_a},player_b.eq.${mm.player_b}),and(player_a.eq.${mm.player_b},player_b.eq.${mm.player_a})`)
          .neq('id', matchId).not('ended_at', 'is', null).order('ended_at', { ascending: false });
        const list = (history as any) || [];
        setH2h({
          a: list.filter((x: any) => x.winner_id === mm.player_a).length,
          b: list.filter((x: any) => x.winner_id === mm.player_b).length,
          total: list.length,
          last: list[0],
        });
      }
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [matchId, user?.id]);

  useEffect(() => {
    if (!matchId) return;
    const ch = supabase.channel(`match-${matchId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_matches', filter: `id=eq.${matchId}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_predictions', filter: `match_id=eq.${matchId}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_mvp_votes', filter: `match_id=eq.${matchId}` }, () => load())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tournament_match_events', filter: `match_id=eq.${matchId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [matchId]);

  // GAP-660: Reproduzir timeline
  const replayTimeline = () => {
    if (events.length === 0) return;
    setIsReplaying(true);
    setReplayIndex(0);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setReplayIndex(i);
      if (i >= events.length) {
        clearInterval(interval);
        setIsReplaying(false);
      }
    }, 1500);
  };

  // GAP-661: Compartilhar
  const handleShare = async () => {
    setSharing(true);
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Partida - ${t?.title || 'Torneio'} MIDIAS`,
          text: `Confira a partida ${pa?.display_name || 'A'} vs ${pb?.display_name || 'B'} no torneio ${t?.title || ''}!`,
          url: url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('Link copiado!');
      }
    } catch {
      // Usuário cancelou
    } finally {
      setSharing(false);
    }
  };

  const predict = async (winnerId: string) => {
    if (!user) { toast.error('Entre para prever'); return; }
    if (m?.winner_id) return;
    const ok = await dbWrite(supabase.from('tournament_predictions' as any).upsert({
      tournament_id: id, match_id: matchId, user_id: user.id, predicted_winner_id: winnerId,
    } as any, { onConflict: 'match_id,user_id' }), 'Não foi possível registrar sua previsão');
    if (!ok) return;
    setMyPred(winnerId);
    load();
  };

  const voteMvp = async (forId: string) => {
    if (!user) { toast.error('Entre para votar'); return; }
    if (!m?.winner_id) { toast.error('Aguarde a partida acabar'); return; }
    const ok = await dbWrite(supabase.from('tournament_mvp_votes' as any).upsert({
      tournament_id: id, match_id: matchId, voter_id: user.id, voted_for_id: forId,
    } as any, { onConflict: 'match_id,voter_id' }), 'Não foi possível registrar seu voto');
    if (!ok) return;
    setMyMvp(forId);
    load();
  };

  if (loading) return <div className="flex justify-center py-32"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  if (!m || !t) return <div className="text-center py-32 text-muted-foreground">Partida não encontrada.</div>;

  const totalPred = predA + predB || 1;
  const totalMvp = mvpA + mvpB || 1;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => nav(`/torneios/${id}`)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Voltar para o torneio
          </button>
          {/* GAP-661: Compartilhar */}
          <button
            onClick={handleShare}
            disabled={sharing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm font-medium hover:border-primary/40 transition-colors disabled:opacity-50"
          >
            <Share2 className="h-4 w-4" /> Compartilhar
          </button>
        </div>

        {/* ESPORTS HUD */}
        <div className="relative bg-gradient-to-b from-card/80 to-background border border-border/60 rounded-2xl overflow-hidden backdrop-blur-md">
          {m.is_live && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
              <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold tracking-[0.25em]">
                <Radio className="h-3 w-3" /> AO VIVO
              </motion.span>
            </div>
          )}
          <div className="text-center pt-4 pb-2 text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
            {m.round_label || `Rodada ${m.round}`} · {t.title}
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center px-6 py-8">
            <PlayerCard profile={pa} score={m.score_a} isWinner={m.winner_id === m.player_a} side="left" />
            <div className="text-center">
              <div className="text-6xl md:text-7xl font-bold font-display tabular-nums text-foreground/30">VS</div>
              {m.ended_at && <div className="text-[10px] tracking-widest text-muted-foreground mt-2">FINALIZADA</div>}
            </div>
            <PlayerCard profile={pb} score={m.score_b} isWinner={m.winner_id === m.player_b} side="right" />
          </div>

          {/* GAP-658: Momentum bar com scoreboard em tempo real */}
          {m.is_live && (
            <div className="px-6 pb-4">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span className="text-primary font-bold">{pa?.display_name || 'A'} {m.score_a}</span>
                <span className="tracking-[0.2em] uppercase">Momentum</span>
                <span className="text-accent font-bold">{m.score_b} {pb?.display_name || 'B'}</span>
              </div>
              <div className="relative h-3 bg-secondary/40 rounded-full overflow-hidden">
                <div className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-primary/40 to-primary/10" />
                <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-accent/40 to-accent/10" />
                <motion.div
                  initial={false}
                  animate={{ left: `${50 + (m.momentum / 2)}%` }}
                  transition={{ type: 'spring' }}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-1 h-5 bg-foreground rounded-full shadow-[0_0_8px] shadow-foreground"
                />
              </div>
              <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
                <span>{pa?.display_name || 'A'}</span>
                <span>{(m.momentum || 0) > 0 ? '🔥' : '❄️'}</span>
                <span>{pb?.display_name || 'B'}</span>
              </div>
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-[1fr_380px] gap-6 mt-6">
          <div className="space-y-6">
            {/* Predictions */}
            <Section title="Previsões dos espectadores" icon={<Target className="h-4 w-4" />}>
              <div className="space-y-2">
                <PredBar name={pa?.display_name || 'A'} count={predA} pct={(predA / totalPred) * 100} mine={myPred === m.player_a} onClick={() => predict(m.player_a)} disabled={!!m.winner_id} side="left" />
                <PredBar name={pb?.display_name || 'B'} count={predB} pct={(predB / totalPred) * 100} mine={myPred === m.player_b} onClick={() => predict(m.player_b)} disabled={!!m.winner_id} side="right" />
              </div>
            </Section>

            {/* Head-to-Head */}
            {h2h && h2h.total > 0 && (
              <Section title="Histórico entre os jogadores" icon={<Trophy className="h-4 w-4" />}>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-secondary/40 rounded-lg p-3">
                    <div className="text-2xl font-bold text-primary">{h2h.a}</div>
                    <div className="text-[10px] text-muted-foreground uppercase truncate">{pa?.display_name || 'A'}</div>
                  </div>
                  <div className="bg-secondary/40 rounded-lg p-3">
                    <div className="text-2xl font-bold text-muted-foreground">{h2h.total}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">Confrontos</div>
                  </div>
                  <div className="bg-secondary/40 rounded-lg p-3">
                    <div className="text-2xl font-bold text-accent">{h2h.b}</div>
                    <div className="text-[10px] text-muted-foreground uppercase truncate">{pb?.display_name || 'B'}</div>
                  </div>
                </div>
                {h2h.last && (
                  <p className="text-[11px] text-muted-foreground mt-2 text-center">
                    Última partida: {h2h.last.score_a} × {h2h.last.score_b} · {formatDate(h2h.last.ended_at)}
                  </p>
                )}
              </Section>
            )}

            {/* GAP-660: Timeline com replay */}
            {events.length > 0 && (
              <Section title="Timeline" icon={<Sparkles className="h-4 w-4" />}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-muted-foreground">{events.length} eventos</span>
                  <button
                    onClick={replayTimeline}
                    disabled={isReplaying}
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline disabled:opacity-50"
                  >
                    {isReplaying ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    {isReplaying ? 'Reproduzindo...' : 'Replay'}
                  </button>
                </div>
                <ol className="space-y-2 max-h-48 overflow-y-auto">
                  <AnimatePresence>
                    {events.slice(0, isReplaying ? replayIndex + 1 : undefined).map((e: any, idx: number) => (
                      <motion.li
                        key={e.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className={`flex gap-3 items-start text-sm p-2 rounded-lg ${idx === replayIndex && isReplaying ? 'bg-primary/10 border border-primary/30' : ''}`}
                      >
                        <span className="text-[10px] text-muted-foreground tabular-nums mt-0.5 shrink-0">{formatTime(e.created_at)}</span>
                        <span className="text-foreground/90">{e.payload?.text || e.kind}</span>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ol>
              </Section>
            )}

            {/* MVP voting */}
            {m.winner_id && (
              <Section title="Vote no MVP" icon={<Crown className="h-4 w-4" />}>
                <div className="grid grid-cols-2 gap-3">
                  <MvpCard profile={pa} count={mvpA} pct={(mvpA / totalMvp) * 100} mine={myMvp === m.player_a} onClick={() => voteMvp(m.player_a)} />
                  <MvpCard profile={pb} count={mvpB} pct={(mvpB / totalMvp) * 100} mine={myMvp === m.player_b} onClick={() => voteMvp(m.player_b)} />
                </div>
              </Section>
            )}
          </div>

          <div>
            <LiveTournamentChat tournamentId={id!} matchId={matchId} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: any) {
  return (
    <section className="bg-card/40 backdrop-blur-sm border border-border/60 rounded-xl p-4">
      <h3 className="flex items-center gap-2 text-xs font-bold tracking-[0.2em] uppercase text-muted-foreground mb-3">{icon}{title}</h3>
      {children}
    </section>
  );
}

function PlayerCard({ profile, score, isWinner, side }: any) {
  return (
    <motion.div initial={{ opacity: 0, x: side === 'left' ? -20 : 20 }} animate={{ opacity: 1, x: 0 }}
      className={`text-center ${isWinner ? 'scale-105' : ''}`}>
      <div className="relative inline-block">
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="" className={`w-20 h-20 md:w-28 md:h-28 rounded-full object-cover border-4 ${isWinner ? 'border-warning shadow-[0_0_30px] shadow-warning/40' : 'border-border'}`} loading="lazy" />
        ) : (
          <div className="w-20 h-20 md:w-28 md:h-28 rounded-full bg-muted border-4 border-border" />
        )}
        {isWinner && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -top-2 -right-2 bg-warning rounded-full p-1.5">
            <Crown className="h-4 w-4 text-on-media" />
          </motion.div>
        )}
      </div>
      <h2 className="font-bold text-lg md:text-xl mt-3 truncate">{profile?.display_name || 'TBD'}</h2>
      <div className={`text-5xl md:text-6xl font-bold tabular-nums mt-2 ${isWinner ? 'text-warning' : 'text-foreground/70'}`}>{score}</div>
    </motion.div>
  );
}

function PredBar({ name, count, pct, mine, onClick, disabled, side }: any) {
  return (
    <button onClick={onClick} disabled={disabled} className={`relative w-full bg-secondary/40 rounded-lg overflow-hidden h-10 ${disabled ? 'cursor-default' : 'hover:bg-secondary/60'} transition-colors`}>
      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }}
        className={`absolute inset-y-0 ${side === 'left' ? 'left-0 bg-gradient-to-r from-primary/60 to-primary/30' : 'right-0 bg-gradient-to-l from-accent/60 to-accent/30'}`} />
      <div className="relative flex items-center justify-between px-4 h-full">
        <span className={`text-sm font-bold ${mine ? 'text-primary' : ''}`}>{name} {mine && '✓'}</span>
        <span className="text-xs tabular-nums">{count} voto(s) · {Math.round(pct)}%</span>
      </div>
    </button>
  );
}

function MvpCard({ profile, count, pct, mine, onClick }: any) {
  return (
    <button onClick={onClick} className={`p-3 rounded-xl border-2 transition-all text-center ${mine ? 'border-primary bg-primary/10 glow-primary' : 'border-border hover:border-primary/50'}`}>
      {profile?.avatar_url ? <img src={profile.avatar_url} className="w-12 h-12 rounded-full mx-auto mb-2 object-cover" loading="lazy" /> : <div className="w-12 h-12 rounded-full bg-muted mx-auto mb-2" />}
      <p className="text-xs font-bold truncate">{profile?.display_name || 'TBD'}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{count} voto(s) · {Math.round(pct)}%</p>
    </button>
  );
}