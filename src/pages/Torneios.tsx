import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { 
  Trophy, Loader2, Users, Calendar, Award, Zap, Star, Crown, 
  ShieldCheck, MessageCircle, Share2, Bell, Clock, UserPlus, 
  UserMinus, Calendar as CalendarIcon 
} from 'lucide-react';
import EstadoVazio from '@/components/EstadoVazio';
import BuscaInput from '@/components/BuscaInput';
import { toast } from 'sonner';
import TournamentBracket from '@/components/TournamentBracket';
import CreateTournamentDialog from '@/components/tournaments/CreateTournamentDialog';
import { formatDate, formatDateTime } from '@/lib/format';
import { dbWrite } from '@/lib/dbWrite';

interface Tournament {
  id: string; title: string; description: string | null; type: string; status: string;
  prize: string | null; max_participants: number; starts_at: string | null; ends_at: string | null;
  xp_signup?: number | null; xp_match_win?: number | null; xp_champion?: number | null;
  verified?: boolean | null; prize_types?: string[] | null;
  is_community?: boolean | null; unlisted?: boolean | null;
  product_id?: string | null; stream_url?: string | null;
}
interface GameOpt { id: string; title: string; image_url: string | null }
interface WaitlistEntry { user_id: string; created_at: string; }

// GAP-615: Contar participantes
async function getParticipantCount(tournamentId: string): Promise<number> {
  const { count } = await supabase
    .from('tournament_participants' as any)
    .select('*', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId);
  return count || 0;
}

// GAP-617: Funções de lista de espera
async function getWaitlist(tournamentId: string): Promise<WaitlistEntry[]> {
  const { data } = await supabase
    .from('tournament_waitlist' as any)
    .select('user_id, created_at')
    .eq('tournament_id', tournamentId)
    .order('created_at', { ascending: true });
  return (data || []) as WaitlistEntry[];
}

async function joinWaitlist(tournamentId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('tournament_waitlist' as any)
    .insert({ tournament_id: tournamentId, user_id: userId });
  if (error) {
    if (error.message?.includes('duplicate')) {
      toast.info('Você já está na lista de espera');
      return false;
    }
    toast.error(error.message);
    return false;
  }
  toast.success('Adicionado à lista de espera!');
  return true;
}

async function leaveWaitlist(tournamentId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('tournament_waitlist' as any)
    .delete()
    .eq('tournament_id', tournamentId)
    .eq('user_id', userId);
  if (error) {
    toast.error(error.message);
    return false;
  }
  toast.success('Removido da lista de espera');
  return true;
}

// GAP-618: Compartilhar torneio
async function shareTournament(tournament: Tournament) {
  const url = `${window.location.origin}/torneios/${tournament.id}`;
  try {
    if (navigator.share) {
      await navigator.share({
        title: `${tournament.title} - MIDIAS`,
        text: `Confira o torneio "${tournament.title}" na MIDIAS!`,
        url: url,
      });
    } else {
      await navigator.clipboard.writeText(url);
      toast.success('Link do torneio copiado!');
    }
  } catch {
    // Usuário cancelou
  }
}

// GAP-620: Adicionar ao calendário
function addToCalendar(tournament: Tournament) {
  if (!tournament.starts_at) {
    toast.error('Este torneio não tem data definida');
    return;
  }
  
  const startDate = new Date(tournament.starts_at);
  const endDate = tournament.ends_at ? new Date(tournament.ends_at) : new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
  
  const formatGoogleDate = (date: Date) => {
    return date.toISOString().replace(/-|:|\.\d+/g, '');
  };
  
  const googleUrl = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(tournament.title)}&dates=${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}&details=${encodeURIComponent(tournament.description || 'Torneio MIDIAS')}&location=${encodeURIComponent('MIDIAS Platform')}`;
  
  window.open(googleUrl, '_blank');
  toast.success('Abrindo Google Calendar...');
}

// GAP-616: Notificação de início
async function notifyStart(tournamentId: string, tournamentTitle: string) {
  // Buscar participantes
  const { data: participants } = await supabase
    .from('tournament_participants' as any)
    .select('user_id')
    .eq('tournament_id', tournamentId);
  
  if (!participants || participants.length === 0) {
    toast.info('Nenhum participante para notificar');
    return;
  }
  
  // Buscar admins do torneio
  const { data: admins } = await supabase
    .from('tournament_moderators' as any)
    .select('user_id')
    .eq('tournament_id', tournamentId);
  
  const adminIds = new Set((admins || []).map((a: any) => a.user_id));
  
  // Inserir notificações
  const notifications = participants
    .filter((p: any) => !adminIds.has(p.user_id))
    .map((p: any) => ({
      user_id: p.user_id,
      type: 'tournament_start',
      title: `🏆 ${tournamentTitle} está começando!`,
      body: `O torneio "${tournamentTitle}" vai começar em breve. Prepare-se!`,
      reference_type: 'tournament',
      reference_id: tournamentId,
    }));
  
  if (notifications.length === 0) {
    toast.info('Todos os participantes já são moderadores');
    return;
  }
  
  const { error } = await supabase
    .from('notifications')
    .insert(notifications);
  
  if (error) {
    toast.error('Erro ao enviar notificações');
    return;
  }
  
  toast.success(`${notifications.length} participantes notificados!`);
}

function fingerprint() {
  try {
    const raw = `${navigator.userAgent}|${screen.width}x${screen.height}|${screen.colorDepth}|${navigator.language}|${new Date().getTimezoneOffset()}`;
    let h = 0; for (let i = 0; i < raw.length; i++) { h = (h << 5) - h + raw.charCodeAt(i); h |= 0; }
    return String(h);
  } catch { return null; }
}

export default function Torneios() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [list, setList] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Tournament | null>(null);
  const [myIds, setMyIds] = useState<Set<string>>(new Set());
  const [gameFilter, setGameFilter] = useState<string>('all');
  const [onlyPcd, setOnlyPcd] = useState(false);
  const [busca, setBusca] = useState('');
  const [games, setGames] = useState<GameOpt[]>([]);
  
  // GAP-617: Estado de lista de espera
  const [waitlist, setWaitlist] = useState<Record<string, WaitlistEntry[]>>({});
  const [waitlistLoading, setWaitlistLoading] = useState<Record<string, boolean>>({});

  // GAP-615: Contagem de participantes
  const [participantCounts, setParticipantCounts] = useState<Record<string, number>>({});

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('tournaments' as any).select('*').order('created_at', { ascending: false });
    let items = ((data as any) || []) as Tournament[];
    let meusIds = new Set<string>();
    if (user) {
      const { data: parts } = await supabase.from('tournament_participants' as any).select('tournament_id').eq('user_id', user.id);
      meusIds = new Set(((parts as any) || []).map((p: any) => p.tournament_id));
    }
    items = items.filter(t => !t.unlisted || meusIds.has(t.id) || (t as any).created_by === user?.id);
    setList(items);
    
    const pids = [...new Set(items.map(t => t.product_id).filter(Boolean) as string[])];
    if (pids.length) {
      const { data: ps } = await supabase.from('produtos').select('id,title,image_url').in('id', pids);
      setGames((ps as any) || []);
    } else setGames([]);
    setMyIds(meusIds);
    
    // GAP-615: Carregar contagem de participantes
    const counts: Record<string, number> = {};
    for (const t of items) {
      counts[t.id] = await getParticipantCount(t.id);
    }
    setParticipantCounts(counts);
    
    // GAP-617: Carregar lista de espera
    const waitlistData: Record<string, WaitlistEntry[]> = {};
    for (const t of items) {
      if (counts[t.id] >= t.max_participants) {
        waitlistData[t.id] = await getWaitlist(t.id);
      }
    }
    setWaitlist(waitlistData);
    
    setLoading(false);
  };
  
  useEffect(() => { load(); }, [user]);

  // Realtime
  useEffect(() => {
    const ch = supabase.channel('tournaments-public')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_participants' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_matches' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  const join = async (t: Tournament) => {
    if (!user) { toast.error('Entre para participar'); return; }
    if (!user.email_confirmed_at) { toast.error('Confirme seu e-mail antes de se inscrever em torneios'); return; }
    if (t.verified) {
      const { data: rpcProf } = await (supabase as any).rpc('get_my_profile');
      const prof = Array.isArray(rpcProf) ? rpcProf[0] : rpcProf;
      if (!prof?.phone) { toast.error('Este torneio exige telefone cadastrado no perfil'); return; }
    }
    const { error } = await supabase.from('tournament_participants' as any).insert({
      tournament_id: t.id, user_id: user.id,
      device_fingerprint: fingerprint(),
    });
    if (error) {
      if (error.message?.includes('banido')) return toast.error('Você foi banido deste torneio pelo moderador');
      return toast.error(error.message);
    }
    toast.success('Inscrito!');
    load();
  };

  const leave = async (t: Tournament) => {
    if (!user) return;
    const { error } = await supabase.from('tournament_participants' as any).delete().eq('tournament_id', t.id).eq('user_id', user.id);
    if (error) return toast.error(error.message);
    toast.success('Inscrição cancelada');
    load();
  };

  const talkToAdmin = async (t: Tournament) => {
    if (!user) { toast.error('Entre para falar com o admin'); return; }
    const { data: admins } = await supabase.from('user_roles').select('user_id').eq('role', 'admin').limit(1);
    const adminId = (admins as any)?.[0]?.user_id;
    if (!adminId) { toast.error('Nenhum admin disponível'); return; }
    const { data: existing } = await supabase.from('conversas').select('id')
      .or(`and(participant_1.eq.${user.id},participant_2.eq.${adminId}),and(participant_1.eq.${adminId},participant_2.eq.${user.id})`)
      .limit(1).maybeSingle();
    let convId = existing?.id;
    if (!convId) {
      const { data: created, error } = await supabase.from('conversas').insert({
        participant_1: user.id, participant_2: adminId, status: 'accepted',
      } as any).select('id').single();
      if (error) return toast.error(error.message);
      convId = created.id;
    }
    const ok = await dbWrite(supabase.from('mensagens').insert({
      sender_id: user.id, receiver_id: adminId,
      content: `🏆 Sobre o torneio "${t.title}":`,
      tournament_id: t.id, is_admin_chat: true,
    } as any), 'Não foi possível enviar a mensagem');
    if (!ok) return;
    toast.success('Mensagem enviada ao admin. A resposta chega no chat do app mobile.');
  };

  const Card = ({ t }: { t: Tournament }) => {
    const inIt = myIds.has(t.id);
    const participantCount = participantCounts[t.id] || 0;
    const isFull = participantCount >= t.max_participants;
    const availableSpots = t.max_participants - participantCount;
    const spotsText = isFull ? 'Lotado' : `${availableSpots} ${availableSpots === 1 ? 'vaga' : 'vagas'}`;
    
    const waitlistData = waitlist[t.id] || [];
    const waitlistCount = waitlistData.length;
    const inWaitlist = waitlistData.some(w => w.user_id === user?.id);
    const isAdmin = user && (t as any).created_by === user.id;

    return (
      <div className="bg-card border border-border rounded-xl p-5 hover:border-primary/50 transition-colors relative">
        {/* GAP-618: Botão de compartilhar */}
        <button
          onClick={() => shareTournament(t)}
          className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-secondary transition-colors"
          title="Compartilhar torneio"
        >
          <Share2 className="h-4 w-4 text-muted-foreground hover:text-primary" />
        </button>

        {/* GAP-620: Botão de calendário */}
        {t.starts_at && (
          <button
            onClick={() => addToCalendar(t)}
            className="absolute top-3 right-10 p-1.5 rounded-lg hover:bg-secondary transition-colors"
            title="Adicionar ao calendário"
          >
            <CalendarIcon className="h-4 w-4 text-muted-foreground hover:text-primary" />
          </button>
        )}

        <div className="flex items-start justify-between mb-3 pr-16">
          <div>
            <h3 className="font-bold text-lg flex items-center gap-1.5">
              {t.title}
              {t.verified && <ShieldCheck className="h-4 w-4 text-success" aria-label="Verificado" />}
            </h3>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{t.type}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={`text-xs px-2 py-1 rounded ${t.status === 'open' ? 'bg-success/20 text-success' : t.status === 'running' ? 'bg-warning/20 text-warning' : 'bg-muted text-muted-foreground'}`}>
              {t.status === 'open' ? 'Aberto' : t.status === 'running' ? 'Em andamento' : 'Encerrado'}
            </span>
            {/* GAP-615: Vagas restantes */}
            {t.status === 'open' && (
              <span className={`text-[10px] font-medium ${isFull ? 'text-destructive' : 'text-success'}`}>
                {isFull ? '🔴 Lotado' : `🟢 ${spotsText}`}
              </span>
            )}
            {t.stream_url && t.status === 'running' && (
              <a href={t.stream_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-destructive/90 text-destructive-foreground animate-pulse">
                🔴 AO VIVO
              </a>
            )}
          </div>
        </div>
        {t.description && <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{t.description}</p>}

        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-secondary/40 rounded-lg p-2 text-center">
            <Zap className="h-3.5 w-3.5 text-primary mx-auto mb-0.5" />
            <div className="text-sm font-bold">+{t.xp_signup ?? 30}</div>
            <div className="text-[9px] text-muted-foreground uppercase">Inscrição</div>
          </div>
          <div className="bg-secondary/40 rounded-lg p-2 text-center">
            <Star className="h-3.5 w-3.5 text-accent mx-auto mb-0.5" />
            <div className="text-sm font-bold">+{t.xp_match_win ?? 100}</div>
            <div className="text-[9px] text-muted-foreground uppercase">Por vitória</div>
          </div>
          <div className="bg-secondary/40 rounded-lg p-2 text-center">
            <Crown className="h-3.5 w-3.5 text-warning mx-auto mb-0.5" />
            <div className="text-sm font-bold">+{t.xp_champion ?? 500}</div>
            <div className="text-[9px] text-muted-foreground uppercase">Campeão</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-4">
          {t.prize_types?.length ? (
            <div className="flex items-center gap-1 col-span-2"><Award className="h-3.5 w-3.5" /> {t.prize_types.join(' + ')}</div>
          ) : t.prize ? <div className="flex items-center gap-1 col-span-2"><Award className="h-3.5 w-3.5" /> {t.prize}</div> : null}
          <div className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {participantCount}/{t.max_participants}</div>
          {/* GAP-617: Lista de espera */}
          {isFull && waitlistCount > 0 && (
            <div className="flex items-center gap-1 text-warning">
              <Clock className="h-3.5 w-3.5" /> +{waitlistCount} na espera
            </div>
          )}
          {t.starts_at && <div className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {formatDate(t.starts_at)}</div>}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="flex-1 min-w-[100px]" onClick={() => navigate(`/torneios/${t.id}`)}>Abrir</Button>
          {inIt && (
            <Button variant="secondary" size="sm" onClick={() => navigate(`/torneios/${t.id}/grupo`)} title="Grupo de participantes">
              <MessageCircle className="h-3.5 w-3.5 mr-1" /> Grupo
            </Button>
          )}
          {t.status === 'open' && (inIt
            ? <Button size="sm" variant="ghost" onClick={() => leave(t)}>Sair</Button>
            : isFull ? (
              // GAP-617: Botão de lista de espera
              inWaitlist ? (
                <Button size="sm" variant="ghost" onClick={() => { if (user) leaveWaitlist(t.id, user.id).then(load); else toast.error('Entre para participar'); }}>
                  <UserMinus className="h-3.5 w-3.5 mr-1" /> Sair da espera
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => { if (user) joinWaitlist(t.id, user.id).then(load); else toast.error('Entre para participar'); }}>
                  <UserPlus className="h-3.5 w-3.5 mr-1" /> Entrar na espera
                </Button>
              )
            ) : (
              <Button size="sm" onClick={() => join(t)}>Inscrever</Button>
            ))}
          {user && (
            <>
              <Button size="sm" variant="ghost" onClick={() => talkToAdmin(t)} title="Falar com o admin">
                <MessageCircle className="h-3.5 w-3.5" />
              </Button>
              {/* GAP-616: Botão de notificação (só admin/participantes) */}
              {(inIt || isAdmin) && (
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => notifyStart(t.id, t.title)} 
                  title="Notificar participantes sobre o início"
                >
                  <Bell className="h-3.5 w-3.5" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  const filterByGame = (l: Tournament[]) => {
    let out = gameFilter === 'all' ? l : l.filter(t => t.product_id === gameFilter);
    if (onlyPcd) out = out.filter(t => (t as any).adaptado_pcd === true);
    const termo = busca.trim().toLowerCase();
    if (termo) out = out.filter(t => `${t.title || ''} ${(t as any).description || ''}`.toLowerCase().includes(termo));
    return out;
  };
  
  const tabs = {
    open: filterByGame(list.filter(t => t.status === 'open')),
    running: filterByGame(list.filter(t => t.status === 'running')),
    closed: filterByGame(list.filter(t => t.status === 'closed')),
    mine: filterByGame(list.filter(t => myIds.has(t.id))),
  };

  const grid = (l: Tournament[]) => l.length === 0
    ? <EstadoVazio icone={Trophy} titulo="Nenhum torneio aqui" descricao="Volte mais tarde ou confira outras abas." />
    : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{l.map(t => <Card key={t.id} t={t} />)}</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <Trophy className="h-7 w-7 text-warning" />
          <div>
            <h1 className="text-3xl font-display font-bold">Torneios</h1>
            <p className="text-muted-foreground text-sm">Compita, suba no ranking e ganhe badges exclusivos</p>
          </div>
        </div>
        {/* GAP-619: Já existe — CreateTournamentDialog */}
        {user && <CreateTournamentDialog onCreated={load} />}
      </div>

      <BuscaInput value={busca} onChange={setBusca} placeholder="Buscar torneio por nome..." className="mb-4 max-w-md" />

      {games.length > 0 && (
        <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs text-muted-foreground shrink-0">Filtrar por jogo:</span>
          <button onClick={() => setGameFilter('all')} className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 ${gameFilter==='all'?'bg-primary text-primary-foreground':'bg-secondary'}`}>
            Todos ({list.length})
          </button>
          {games.map(g => {
            const count = list.filter(t => t.product_id === g.id).length;
            return (
              <button key={g.id} onClick={() => setGameFilter(g.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 inline-flex items-center gap-1.5 ${gameFilter===g.id?'bg-primary text-primary-foreground':'bg-secondary'}`}>
                {g.image_url && <img src={g.image_url} alt="" className="w-4 h-4 rounded object-cover" loading="lazy" />}
                {g.title} ({count})
              </button>
            );
          })}
          <button
            onClick={() => setOnlyPcd(v => !v)}
            className={`ml-2 px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 inline-flex items-center gap-1.5 ${onlyPcd ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}
            aria-pressed={onlyPcd}
            title="Somente torneios adaptados / PcD"
          >
            ♿ Adaptado / PcD
          </button>
        </div>
      )}
      {loading ? <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
        <Tabs defaultValue="open">
          <TabsList>
            <TabsTrigger value="open">Abertos ({tabs.open.length})</TabsTrigger>
            <TabsTrigger value="running">Em andamento ({tabs.running.length})</TabsTrigger>
            <TabsTrigger value="closed">Encerrados ({tabs.closed.length})</TabsTrigger>
            <TabsTrigger value="mine">Meus ({tabs.mine.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="open" className="mt-6">{grid(tabs.open)}</TabsContent>
          <TabsContent value="running" className="mt-6">{grid(tabs.running)}</TabsContent>
          <TabsContent value="closed" className="mt-6">{grid(tabs.closed)}</TabsContent>
          <TabsContent value="mine" className="mt-6">{grid(tabs.mine)}</TabsContent>
        </Tabs>
      )}
      {selected && <TournamentBracket tournament={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}