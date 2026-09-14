import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Trophy, Users, Calendar, Radio, ArrowLeft, Loader2, Award, MessageSquare, Sparkles, Crown, ShieldCheck, Share2, Clock, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import HypeMeter from '@/components/tournaments/HypeMeter';
import StorylinesPanel from '@/components/tournaments/StorylinesPanel';
import CinematicBracket from '@/components/tournaments/CinematicBracket';
import LiveTournamentChat from '@/components/tournaments/LiveTournamentChat';
import TournamentRegistration from '@/components/tournaments/TournamentRegistration';
import TournamentStatsPanel from '@/components/tournaments/TournamentStatsPanel';
import TournamentLivePanel from '@/components/tournaments/TournamentLivePanel';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { formatCurrency, formatDateTime } from '@/lib/format';

// GAP-646: Adicionar ao calendário
function addToCalendar(tournament: any) {
  if (!tournament.starts_at) {
    toast.error('Este torneio não tem data definida');
    return;
  }
  const startDate = new Date(tournament.starts_at);
  const endDate = tournament.ends_at ? new Date(tournament.ends_at) : new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
  const formatGoogleDate = (date: Date) => date.toISOString().replace(/-|:|\.\d+/g, '');
  const googleUrl = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(tournament.title)}&dates=${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}&details=${encodeURIComponent(tournament.description || 'Torneio MIDIAS')}&location=${encodeURIComponent('MIDIAS Platform')}`;
  window.open(googleUrl, '_blank');
  toast.success('Abrindo Google Calendar...');
}

// GAP-647: Regras do torneio (expansível)
function RulesSection({ rules }: { rules: string | null }) {
  const [expanded, setExpanded] = useState(false);
  if (!rules) return null;
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <button onClick={() => setExpanded(!expanded)} className="flex items-center justify-between w-full text-left">
        <span className="font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" /> Regras do Torneio
        </span>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {expanded && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-3 pt-3 border-t border-border">
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{rules}</p>
        </motion.div>
      )}
    </div>
  );
}

export default function TournamentEvent() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [t, setT] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [storylines, setStorylines] = useState<any[]>([]);
  const [highlights, setHighlights] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [joined, setJoined] = useState(false);
  const [waitlisted, setWaitlisted] = useState(false);
  const [regOpen, setRegOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [now, setNow] = useState(Date.now());

  // GAP-644: Contagem regressiva
  useEffect(() => {
    if (!t?.starts_at) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [t?.starts_at]);

  const load = async () => {
    if (!id) return;
    const [tRes, mRes, sRes, hRes, pRes] = await Promise.all([
      supabase.from('tournaments' as any).select('*').eq('id', id).maybeSingle(),
      supabase.from('tournament_matches' as any).select('*').eq('tournament_id', id).order('round'),
      supabase.from('tournament_storylines' as any).select('*').eq('tournament_id', id).order('created_at', { ascending: false }).limit(8),
      supabase.from('tournament_highlights' as any).select('*').eq('tournament_id', id).order('created_at', { ascending: false }),
      supabase.from('tournament_participants' as any).select('user_id').eq('tournament_id', id),
    ]);
    setT(tRes.data);
    setMatches(((mRes.data as any) || []));
    setStorylines((sRes.data as any) || []);
    setHighlights((hRes.data as any) || []);
    const parts = ((pRes.data as any) || []);
    setParticipants(parts);
    const uids = new Set<string>();
    parts.forEach((p: any) => uids.add(p.user_id));
    ((mRes.data as any) || []).forEach((m: any) => { if (m.player_a) uids.add(m.player_a); if (m.player_b) uids.add(m.player_b); });
    if (uids.size) {
      const { data: profs } = await supabase.from('profiles').select('id, display_name, avatar_url').in('id', [...uids]);
      setProfiles(Object.fromEntries((profs || []).map(p => [p.id, p])));
    }
    if (user) {
      setJoined(parts.some((p: any) => p.user_id === user.id));
      const { data: wl } = await supabase.from('tournament_waitlist' as any).select('id').eq('tournament_id', id).eq('user_id', user.id).maybeSingle();
      setWaitlisted(!!wl);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id, user?.id]);

  useEffect(() => {
    if (!id) return;
    const ch = supabase.channel(`tournament-event-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_matches', filter: `tournament_id=eq.${id}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments', filter: `id=eq.${id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  useDocumentMeta({
    title: t?.title ? `${t.title} · Torneio · MIDIAS` : 'Torneio · MIDIAS',
    description: t ? (t.description || `Torneio ${t.title} na MIDIAS — inscrições, chaveamento e cobertura ao vivo.`).slice(0, 160) : undefined,
    image: t?.banner_url || undefined,
    type: 'article',
  });

  // GAP-645: Compartilhar
  const handleShare = async () => {
    setSharing(true);
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${t?.title} - MIDIAS`,
          text: `Confira o torneio "${t?.title}" na MIDIAS!`,
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

  if (loading) return <div className="flex justify-center py-32"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  if (!t) return <div className="text-center py-32 text-muted-foreground">Torneio não encontrado.</div>;

  const isFull = participants.length >= (t.max_participants || 0);
  const isLive = t.event_state === 'live' || t.status === 'running';
  const isFinished = t.event_state === 'finished' || t.status === 'closed';
  const stateLabel: any = { registration: 'Inscrições abertas', confirmation: 'Confirmação', live: 'AO VIVO', finished: 'Finalizado', archived: 'Arquivado' };

  // GAP-644: Tempo restante
  const getTimeRemaining = () => {
    if (!t?.starts_at) return null;
    const diff = new Date(t.starts_at).getTime() - now;
    if (diff <= 0) return 'Iniciado!';
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}min`;
    return `${mins}min`;
  };

  const openRegistration = () => {
    if (!user) { toast.error('Entre para participar'); return; }
    setRegOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Cinematic header */}
      <div className="relative overflow-hidden border-b border-border/60">
        {t.banner_url ? (
          <div className="absolute inset-0">
            <img src={t.banner_url} alt="" className="w-full h-full object-cover" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/90 to-background/40" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-accent/10 to-warning/20" />
        )}
        <div className="relative container mx-auto px-4 py-10">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <button onClick={() => nav('/torneios')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Todos os torneios
            </button>
            {/* GAP-645: Compartilhar */}
            <button onClick={handleShare} disabled={sharing} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm font-medium hover:border-primary/40 transition-colors disabled:opacity-50">
              <Share2 className="h-4 w-4" /> Compartilhar
            </button>
          </div>
          
          <div className="grid md:grid-cols-[1fr_auto] gap-6 items-end mt-4">
            <div>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                {isLive && (
                  <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold tracking-[0.2em]">
                    <Radio className="h-3 w-3" /> AO VIVO
                  </motion.span>
                )}
                {!isLive && (
                  <span className="px-3 py-1 rounded-full bg-secondary text-xs font-bold tracking-widest uppercase">{stateLabel[t.event_state] || t.status}</span>
                )}
                {t.verified && <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-success/20 text-success text-[10px] font-bold"><ShieldCheck className="h-3 w-3" /> VERIFICADO</span>}
                <span className="text-[10px] tracking-widest uppercase text-muted-foreground">{t.type}</span>
                {/* GAP-644: Hora de início */}
                {t.starts_at && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-medium">
                    <Clock className="h-3 w-3" /> Início: {getTimeRemaining()}
                  </span>
                )}
                {/* GAP-646: Adicionar ao calendário */}
                {t.starts_at && (
                  <button onClick={() => addToCalendar(t)} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-secondary hover:bg-secondary/80 text-[10px] font-medium transition-colors">
                    <Calendar className="h-3 w-3" /> Calendário
                  </button>
                )}
              </div>
              <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="text-4xl md:text-6xl font-display font-bold mb-3 bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent">
                {t.title}
              </motion.h1>
              {t.narrative && <p className="text-base text-muted-foreground max-w-2xl leading-relaxed">{t.narrative}</p>}
              {t.description && !t.narrative && <p className="text-sm text-muted-foreground max-w-2xl">{t.description}</p>}
            </div>
            <div className="md:w-80 space-y-3">
              <HypeMeter value={t.hype_score || 0} max={Math.max(1000, (t.hype_score || 0) + 200)} />
              <div className="grid grid-cols-3 gap-2">
                <Stat icon={<Users className="h-3.5 w-3.5" />} label="Inscritos" value={`${participants.length}/${t.max_participants}`} />
                <Stat icon={<Award className="h-3.5 w-3.5" />} label="Prêmio" value={t.prize_pool_amount ? formatCurrency(Number(t.prize_pool_amount)) : (t.prize || '—')} />
                <Stat icon={<Trophy className="h-3.5 w-3.5" />} label="XP Campeão" value={`+${t.xp_champion || 500}`} />
              </div>
              {(t.prize_pool_amount || (t.prize && t.prize !== '—')) && (
                <div className={`text-[11px] rounded-md px-2.5 py-1.5 border ${(t as any).prize_confirmed ? 'bg-success/10 border-success/30 text-success' : 'bg-warning/10 border-warning/30 text-warning'}`}>
                  {(t as any).prize_confirmed
                    ? '✓ Prêmio confirmado pela organização'
                    : '⚠ Prêmio ainda não confirmado — sujeito aos Termos de Uso do torneio.'}
                </div>
              )}
              {t.event_state === 'registration' && !joined && !waitlisted && (
                <Button onClick={openRegistration} size="lg" className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90">
                  <Sparkles className="h-4 w-4 mr-2" />
                  {isFull ? 'Entrar na fila' : Number(t.entry_price || 0) > 0 ? `Inscrever — ${formatCurrency(Number(t.entry_price))}` : 'Inscreva-se agora'}
                </Button>
              )}
              {joined && (
                <div className="text-center text-sm text-primary font-bold py-2 border border-primary/30 rounded-lg bg-primary/10">
                  ✓ Você está inscrito
                </div>
              )}
              {waitlisted && !joined && (
                <div className="text-center text-sm text-warning font-bold py-2 border border-warning/30 rounded-lg bg-warning/10">
                  ⏳ Você está na fila de espera
                </div>
              )}
              {isFinished && t.forum_thread_id && (
                <Button asChild variant="outline" size="lg" className="w-full">
                  <Link to={`/m/forum/post/${t.forum_thread_id}`}>
                    <MessageSquare className="h-4 w-4 mr-2" /> Discussão no fórum
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* GAP-647: Regras do torneio */}
      {(t.rules || t.regulations) && (
        <div className="container mx-auto px-4 pt-6">
          <RulesSection rules={t.rules || t.regulations} />
        </div>
      )}

      {/* Storylines e conteúdo */}
      <div className="container mx-auto px-4 py-8 space-y-10">
        <TournamentLivePanel
          tournamentId={t.id}
          liveState={t.live_state || 'idle'}
          streamUrl={t.stream_url}
          streamPlatform={t.live_stream_platform}
          currentTopic={t.live_current_topic}
          liveStartedAt={t.live_started_at}
          onChange={load}
        />
        <StorylinesPanel items={storylines} />

        <Tabs defaultValue="bracket">
          <TabsList>
            <TabsTrigger value="bracket">Chaveamento</TabsTrigger>
            <TabsTrigger value="stats">Estatísticas</TabsTrigger>
            {isLive && <TabsTrigger value="chat">Chat ao vivo</TabsTrigger>}
            <TabsTrigger value="highlights">Highlights</TabsTrigger>
            <TabsTrigger value="participants">Participantes ({participants.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="stats" className="mt-6">
            <TournamentStatsPanel tournamentId={t.id} matches={matches} profiles={profiles} />
          </TabsContent>

          <TabsContent value="bracket" className="mt-6">
            {matches.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <Trophy className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Chaveamento ainda não foi gerado.</p>
              </div>
            ) : (
              <CinematicBracket matches={matches as any} profiles={profiles} bracketType={t.bracket_type as any} />
            )}
          </TabsContent>

          {isLive && (
            <TabsContent value="chat" className="mt-6 max-w-3xl mx-auto">
              <LiveTournamentChat tournamentId={t.id} />
            </TabsContent>
          )}

          <TabsContent value="highlights" className="mt-6">
            {highlights.length === 0 ? (
              <p className="text-center py-16 text-muted-foreground">Nenhum highlight ainda.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {highlights.map((h: any) => (
                  <div key={h.id} className="bg-card border border-border rounded-xl overflow-hidden">
                    {h.image_url && <img src={h.image_url} alt={h.title} className="w-full aspect-video object-cover" loading="lazy" />}
                    <div className="p-3">
                      <h4 className="font-bold text-sm">{h.title}</h4>
                      {h.description && <p className="text-xs text-muted-foreground mt-1">{h.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="participants" className="mt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {participants.map((p: any) => {
                const pf = profiles[p.user_id];
                return (
                  <Link key={p.user_id} to={`/perfil/${p.user_id}`} className="bg-card border border-border rounded-xl p-3 text-center hover:border-primary/60 transition-colors">
                    {pf?.avatar_url ? <img src={pf.avatar_url} alt="" className="w-12 h-12 rounded-full mx-auto mb-2 object-cover" loading="lazy" /> : <div className="w-12 h-12 rounded-full bg-muted mx-auto mb-2" />}
                    <p className="text-xs truncate">{pf?.display_name || 'Jogador'}</p>
                    {t.winner_id === p.user_id && <Crown className="h-3 w-3 mx-auto mt-1 text-warning" />}
                  </Link>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>

        {isFinished && (t.winner_id || t.runner_up_id || t.third_place_id) && (
          <section>
            <h2 className="text-sm font-bold tracking-[0.25em] uppercase text-muted-foreground mb-4">🏆 Pódio</h2>
            <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
              {[
                { id: t.runner_up_id, rank: 2, color: 'from-muted to-muted-foreground/60', icon: '🥈' },
                { id: t.winner_id, rank: 1, color: 'from-gold to-warning', icon: '🥇' },
                { id: t.third_place_id, rank: 3, color: 'from-warning/70 to-warning/40', icon: '🥉' },
              ].map(slot => {
                const pf = slot.id ? profiles[slot.id] : null;
                return (
                  <motion.div key={slot.rank} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: slot.rank * 0.1 }}
                    className={`text-center p-4 rounded-xl bg-gradient-to-br ${slot.color} ${slot.rank === 1 ? 'scale-110' : 'opacity-80'}`}>
                    <div className="text-3xl mb-2">{slot.icon}</div>
                    {pf?.avatar_url ? <img src={pf.avatar_url} className="w-14 h-14 rounded-full mx-auto border-2 border-on-media object-cover" loading="lazy" /> : <div className="w-14 h-14 rounded-full bg-overlay/20 mx-auto" />}
                    <p className="text-xs font-bold text-on-media-soft mt-2 truncate">{pf?.display_name || 'TBD'}</p>
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      <TournamentRegistration
        open={regOpen}
        onOpenChange={setRegOpen}
        tournament={t}
        isFull={isFull}
        onSuccess={load}
      />
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-card/60 backdrop-blur-sm border border-border/60 rounded-lg p-2 text-center">
      <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">{icon}<span className="text-[9px] uppercase tracking-widest">{label}</span></div>
      <div className="text-sm font-bold tabular-nums">{value}</div>
    </div>
  );
}