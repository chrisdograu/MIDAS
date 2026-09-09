// Painel de Estatísticas do Torneio.
// Inclui: ranking ao vivo, histórico de eventos, filtros (período, busca, ordenação),
// export CSV de ranking + timeline.
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Activity, Swords, Trophy, Zap, AlertCircle, Loader2, Download, Search, BarChart3, Clock, Users, TrendingUp, Target } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/format';
import SelectSimples from '@/components/SelectSimples';
import { cn } from '@/lib/utils';

type EventRow = { id: string; match_id: string | null; kind: string; payload: any; created_at: string };
type Stat = { user_id: string; wins: number; losses: number; matches: number };
type Period = 'all' | '7d' | '30d';
type SortBy = 'wins' | 'matches' | 'winrate';

const ICONS: Record<string, any> = {
  match_start: Swords, match_end: Trophy, goal: Zap, penalty: AlertCircle, default: Activity,
};

const PERIODS: { v: Period; label: string }[] = [
  { v: 'all', label: 'Todo período' }, { v: '30d', label: 'Últimos 30 dias' }, { v: '7d', label: 'Últimos 7 dias' },
];
const SORTS: { v: SortBy; label: string }[] = [
  { v: 'wins', label: 'Vitórias' }, { v: 'matches', label: 'Partidas' }, { v: 'winrate', label: 'Winrate' },
];

function periodSince(p: Period): Date | null {
  if (p === 'all') return null;
  const d = new Date();
  d.setDate(d.getDate() - (p === '7d' ? 7 : 30));
  return d;
}

function downloadCSV(filename: string, rows: (string | number)[][]) {
  const csv = rows.map(r => r.map(c => {
    const s = String(c ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// GAP-TS01: Componente de gráfico simples
function WinRateBar({ wins, losses, label }: { wins: number; losses: number; label?: string }) {
  const total = wins + losses;
  const pct = total > 0 ? Math.round((wins / total) * 100) : 0;
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{label || 'Winrate'}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-success to-primary rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// GAP-TS03: Comparação entre jogadores
function PlayerComparison({ players, profiles }: { players: Stat[]; profiles: Record<string, any> }) {
  if (players.length < 2) return null;
  return (
    <div className="rounded-xl border border-border bg-card/40 p-3">
      <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
        <Users className="h-3.5 w-3.5" /> Comparação
      </h4>
      <div className="space-y-2">
        {players.map((p, i) => {
          const profile = profiles[p.user_id];
          return (
            <div key={p.user_id} className={cn(
              "flex items-center gap-3 p-2 rounded-lg",
              i === 0 ? "bg-primary/5 border border-primary/20" : "bg-secondary/40"
            )}>
              <span className="text-xs font-bold w-6 text-center">{i === 0 ? '🏆' : i + 1}</span>
              <span className="text-sm flex-1 truncate">{profile?.display_name || 'Jogador'}</span>
              <span className="text-xs text-success">{p.wins}V</span>
              <span className="text-xs text-destructive">{p.losses}D</span>
              <span className="text-xs font-bold tabular-nums w-12 text-right">
                {p.matches ? Math.round((p.wins / p.matches) * 100) : 0}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TournamentStatsPanel({
  tournamentId, matches, profiles,
}: { tournamentId: string; matches: any[]; profiles: Record<string, any> }) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('wins');
  // GAP-TS02: Heatmap de horários
  const [hourlyData, setHourlyData] = useState<Record<number, number>>({});

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.from('tournament_match_events' as any)
        .select('*').eq('tournament_id', tournamentId)
        .order('created_at', { ascending: false }).limit(200);
      if (active) { setEvents((data as any) || []); setLoading(false); }
    })();
    const ch = supabase.channel(`tme-${tournamentId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'tournament_match_events', filter: `tournament_id=eq.${tournamentId}` },
        (p) => setEvents(prev => [p.new as EventRow, ...prev].slice(0, 200)))
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [tournamentId]);

  // GAP-TS02: Calcular heatmap de horários
  useEffect(() => {
    const hours: Record<number, number> = {};
    matches.forEach((m: any) => {
      if (m.ended_at) {
        const hour = new Date(m.ended_at).getHours();
        hours[hour] = (hours[hour] || 0) + 1;
      }
    });
    setHourlyData(hours);
  }, [matches]);

  const filteredMatches = useMemo(() => {
    const since = periodSince(period);
    if (!since) return matches;
    return matches.filter((m: any) => m.ended_at && new Date(m.ended_at) >= since);
  }, [matches, period]);

  const ranking = useMemo(() => {
    const statMap = new Map<string, Stat>();
    const bump = (uid: string | null, k: keyof Omit<Stat, 'user_id'>) => {
      if (!uid) return;
      const cur = statMap.get(uid) || { user_id: uid, wins: 0, losses: 0, matches: 0 };
      cur[k] += 1; statMap.set(uid, cur);
    };
    filteredMatches.forEach((m: any) => {
      if (m.ended_at && m.winner_id) {
        bump(m.player_a, 'matches');
        bump(m.player_b, 'matches');
        bump(m.winner_id, 'wins');
        const loser = m.winner_id === m.player_a ? m.player_b : m.player_a;
        bump(loser, 'losses');
      }
    });
    let arr = [...statMap.values()];
    const q = search.trim().toLowerCase();
    if (q) arr = arr.filter(s => (profiles[s.user_id]?.display_name || '').toLowerCase().includes(q));
    arr.sort((a, b) => {
      if (sortBy === 'wins') return b.wins - a.wins || a.losses - b.losses;
      if (sortBy === 'matches') return b.matches - a.matches;
      const wrA = a.matches ? a.wins / a.matches : 0;
      const wrB = b.matches ? b.wins / b.matches : 0;
      return wrB - wrA;
    });
    return arr.slice(0, 30);
  }, [filteredMatches, profiles, search, sortBy]);

  // GAP-TS01: Top 3 para gráfico
  const top3 = ranking.slice(0, 3);

  // GAP-TS04: Previsão simples (jogador com maior winrate)
  const topPlayer = ranking.length > 0 ? ranking.reduce((a, b) => {
    const wrA = a.matches ? a.wins / a.matches : 0;
    const wrB = b.matches ? b.wins / b.matches : 0;
    return wrA > wrB ? a : b;
  }) : null;

  const filteredEvents = useMemo(() => {
    const since = periodSince(period);
    return events.filter(e => !since || new Date(e.created_at) >= since);
  }, [events, period]);

  const exportRankingCSV = () => {
    const rows: (string | number)[][] = [
      ['Posição', 'Jogador', 'Vitórias', 'Derrotas', 'Partidas', 'Winrate %'],
      ...ranking.map((s, i) => [
        i + 1,
        profiles[s.user_id]?.display_name || s.user_id,
        s.wins, s.losses, s.matches,
        s.matches ? ((s.wins / s.matches) * 100).toFixed(1) : '0.0',
      ]),
    ];
    downloadCSV(`ranking-torneio-${tournamentId}.csv`, rows);
  };

  const exportTimelineCSV = () => {
    const rows: (string | number)[][] = [
      ['Data', 'Tipo', 'Match ID', 'Descrição'],
      ...filteredEvents.map(e => [
        formatDateTime(e.created_at),
        e.kind, e.match_id || '',
        e.payload?.label || e.payload?.text || '',
      ]),
    ];
    downloadCSV(`timeline-torneio-${tournamentId}.csv`, rows);
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-card border border-border rounded-xl">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar participante..." className="pl-8 h-8 text-xs" />
        </div>
        <SelectSimples
          value={period}
          onChange={v => setPeriod(v as Period)}
          size="sm"
          label="Período"
          className="w-auto min-w-[8rem]"
          options={PERIODS.map(p => ({ value: p.v, label: p.label }))}
        />
        <SelectSimples
          value={sortBy}
          onChange={v => setSortBy(v as SortBy)}
          size="sm"
          label="Ordenar ranking"
          className="w-auto min-w-[10rem]"
          options={SORTS.map(s => ({ value: s.v, label: `Ordenar: ${s.label}` }))}
        />

        <Button size="sm" variant="outline" onClick={exportRankingCSV} className="h-8 text-xs">
          <Download className="h-3 w-3 mr-1" /> Ranking CSV
        </Button>
        <Button size="sm" variant="outline" onClick={exportTimelineCSV} className="h-8 text-xs">
          <Download className="h-3 w-3 mr-1" /> Timeline CSV
        </Button>
      </div>

      {/* GAP-TS04: Previsão */}
      {topPlayer && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Favorito: <strong>{profiles[topPlayer.user_id]?.display_name || 'Jogador'}</strong></span>
            <span className="text-xs text-muted-foreground">
              {topPlayer.matches ? Math.round((topPlayer.wins / topPlayer.matches) * 100) : 0}% winrate
            </span>
          </div>
          <TrendingUp className="h-4 w-4 text-success" />
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <section>
          <h3 className="text-xs font-bold tracking-[0.25em] uppercase text-muted-foreground mb-3 flex items-center gap-2">
            <Trophy className="h-3.5 w-3.5" /> Ranking ao vivo
          </h3>
          
          {/* GAP-TS01: Gráfico de winrate dos top 3 */}
          {top3.length > 0 && (
            <div className="mb-3 space-y-1.5">
              {top3.map((s, i) => (
                <WinRateBar 
                  key={s.user_id} 
                  wins={s.wins} 
                  losses={s.losses} 
                  label={`#${i + 1} ${profiles[s.user_id]?.display_name || 'Jogador'}`}
                />
              ))}
            </div>
          )}

          {/* GAP-TS03: Comparação */}
          {ranking.length >= 2 && (
            <PlayerComparison players={ranking.slice(0, 3)} profiles={profiles} />
          )}

          {ranking.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {search ? 'Nenhum participante encontrado.' : 'Sem partidas finalizadas no período.'}
            </p>
          ) : (
            <ol className="space-y-1.5 mt-3 max-h-[400px] overflow-y-auto">
              {ranking.map((s, i) => {
                const p = profiles[s.user_id];
                const wr = s.matches ? ((s.wins / s.matches) * 100).toFixed(0) : '0';
                return (
                  <li key={s.user_id} className="flex items-center gap-3 p-2.5 rounded-lg bg-card border border-border/60">
                    <span className={`text-xs font-bold w-6 text-center ${i < 3 ? 'text-primary' : 'text-muted-foreground'}`}>#{i + 1}</span>
                    {p?.avatar_url ? <img src={p.avatar_url} className="w-8 h-8 rounded-full object-cover" alt="" loading="lazy" />
                      : <div className="w-8 h-8 rounded-full bg-muted" />}
                    <span className="flex-1 text-sm truncate">{p?.display_name || 'Jogador'}</span>
                    <span className="text-xs tabular-nums text-success">{s.wins}V</span>
                    <span className="text-xs tabular-nums text-destructive">{s.losses}D</span>
                    <span className="text-[10px] tabular-nums text-muted-foreground w-10 text-right">{wr}%</span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section>
          <h3 className="text-xs font-bold tracking-[0.25em] uppercase text-muted-foreground mb-3 flex items-center gap-2">
            <Activity className="h-3.5 w-3.5" /> Histórico de eventos
          </h3>
          
          {/* GAP-TS02: Heatmap de horários */}
          {Object.keys(hourlyData).length > 0 && (
            <div className="mb-3 p-2 rounded-lg bg-secondary/40 border border-border">
              <p className="text-[10px] text-muted-foreground mb-1.5 flex items-center gap-1">
                <Clock className="h-3 w-3" /> Horários de pico
              </p>
              <div className="flex gap-0.5">
                {Array.from({ length: 24 }).map((_, h) => {
                  const count = hourlyData[h] || 0;
                  const max = Math.max(...Object.values(hourlyData));
                  const intensity = max > 0 ? (count / max) * 100 : 0;
                  return (
                    <div key={h} className="flex-1 flex flex-col items-center">
                      <div 
                        className="w-full rounded-sm transition-all" 
                        style={{ 
                          height: `${Math.max(2, intensity * 0.8)}px`,
                          background: intensity > 50 ? 'hsl(var(--primary))' : intensity > 25 ? 'hsl(var(--primary)/0.6)' : 'hsl(var(--primary)/0.2)'
                        }} 
                      />
                      {h % 4 === 0 && <span className="text-[6px] text-muted-foreground mt-0.5">{h}h</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : filteredEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhum evento no período.</p>
          ) : (
            <ul className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
              {filteredEvents.map(e => {
                const Icon = ICONS[e.kind] || ICONS.default;
                const label = e.payload?.label || e.payload?.text || e.kind.replace(/_/g, ' ');
                return (
                  <li key={e.id} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-card border border-border/60 text-xs">
                    <Icon className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="leading-snug">{label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(e.created_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}