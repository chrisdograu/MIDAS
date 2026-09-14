// Painel de "modo live" de um torneio. Duas facetas:
//  - Público: banner AO VIVO com embed do stream + feed de comentários/highlights em tempo real.
//  - Admin/moderador: controles estilo Twitch (iniciar/pausar/retomar/encerrar, trocar URL,
//    mudar tópico, postar comentário/highlight/anúncio).
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Radio, Play, Pause, Square, MessageCircle, Sparkles, Megaphone, Loader2, Eye, Volume2, VolumeX, History, Image, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useDataSaver } from '@/hooks/useDataSaver';
import { formatTime } from '@/lib/format';
import { Slider } from '@/components/ui/slider';

interface Props {
  tournamentId: string;
  liveState: 'idle' | 'live' | 'paused' | 'ended' | string;
  streamUrl: string | null;
  streamPlatform: string | null;
  currentTopic: string | null;
  liveStartedAt: string | null;
  onChange?: () => void;
}

interface LiveEvent {
  id: string;
  kind: string;
  payload: any;
  created_at: string;
  actor_id: string | null;
}

export default function TournamentLivePanel({
  tournamentId, liveState, streamUrl, streamPlatform, currentTopic, liveStartedAt, onChange,
}: Props) {
  const { user } = useAuth();
  const [isMod, setIsMod] = useState(false);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [urlInput, setUrlInput] = useState(streamUrl || '');
  const [topicInput, setTopicInput] = useState(currentTopic || '');
  const [msgKind, setMsgKind] = useState<'commentary'|'highlight'|'announcement'>('commentary');
  const [msgText, setMsgText] = useState('');
  // GAP-TL01: Espectadores
  const [viewers, setViewers] = useState(0);
  // GAP-TL02: Histórico de streams
  const [streamHistory, setStreamHistory] = useState<{ url: string; platform: string; used_at: string }[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  // GAP-TL03: Preview
  const [showPreview, setShowPreview] = useState(false);
  // GAP-TL04: Volume
  const [volume, setVolume] = useState(50);
  const [muted, setMuted] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => { setUrlInput(streamUrl || ''); setTopicInput(currentTopic || ''); }, [streamUrl, currentTopic]);

  // Detecta se o usuário é mod/creator/admin
  useEffect(() => {
    if (!user) { setIsMod(false); return; }
    let cancel = false;
    (async () => {
      const [modRes, adminRes, createdRes] = await Promise.all([
        supabase.from('tournament_moderators' as any).select('user_id').eq('tournament_id', tournamentId).eq('user_id', user.id).maybeSingle(),
        supabase.rpc('has_role' as any, { _user_id: user.id, _role: 'admin' }),
        supabase.from('tournaments' as any).select('created_by').eq('id', tournamentId).maybeSingle(),
      ]);
      if (cancel) return;
      const created = (createdRes.data as any)?.created_by === user.id;
      setIsMod(!!modRes.data || !!adminRes.data || created);
    })();
    return () => { cancel = true; };
  }, [user?.id, tournamentId]);

  // GAP-TL01: Simular espectadores
  useEffect(() => {
    if (liveState !== 'live') return;
    const interval = setInterval(() => {
      setViewers(prev => Math.max(1, prev + Math.floor(Math.random() * 3) - 1));
    }, 5000);
    return () => clearInterval(interval);
  }, [liveState]);

  // Feed em tempo real dos eventos ao vivo
  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await supabase.from('tournament_live_events' as any)
        .select('*').eq('tournament_id', tournamentId)
        .order('created_at', { ascending: false }).limit(50);
      if (!cancel) setEvents(((data as any) || []) as LiveEvent[]);
    })();
    const ch = supabase.channel(`live-events-${tournamentId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tournament_live_events', filter: `tournament_id=eq.${tournamentId}` },
        (payload) => {
          setEvents(prev => [payload.new as LiveEvent, ...prev].slice(0, 50));
          if (['live_started','live_paused','live_resumed','live_ended','stream_changed','topic_changed'].includes((payload.new as any).kind)) {
            onChange?.();
          }
        })
      .subscribe();
    return () => { cancel = true; supabase.removeChannel(ch); };
  }, [tournamentId, onChange]);

  // GAP-TL02: Carregar histórico de streams
  useEffect(() => {
    if (!tournamentId) return;
    (async () => {
      const { data } = await supabase
        .from('tournament_stream_history' as any)
        .select('url, platform, used_at')
        .eq('tournament_id', tournamentId)
        .order('used_at', { ascending: false })
        .limit(5);
      setStreamHistory((data as any) || []);
    })();
  }, [tournamentId]);

  const dataSaver = useDataSaver();
  const [playStream, setPlayStream] = useState(false);
  const embed = buildEmbed(urlInput, streamPlatform, dataSaver);
  const isLive = liveState === 'live';
  const isPaused = liveState === 'paused';
  const isEnded = liveState === 'ended';
  const showBanner = isLive || isPaused;

  const setState = async (state: 'live'|'paused'|'ended', extraUrl?: string) => {
    setBusy(true);
    const { error } = await supabase.rpc('tournament_set_live_state' as any, {
      _tournament_id: tournamentId, _state: state,
      _stream_url: extraUrl ?? null, _topic: null,
    });
    setBusy(false);
    if (error) toast.error('Não foi possível atualizar a live: ' + error.message);
    else { toast.success(labelForState(state)); onChange?.(); }
  };

  const updateStream = async () => {
    if (!urlInput.trim()) return;
    setBusy(true);
    const { error } = await supabase.rpc('tournament_set_live_state' as any, {
      _tournament_id: tournamentId, _state: liveState, _stream_url: urlInput.trim(), _topic: null,
    });
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success('Stream atualizado'); onChange?.(); }
  };

  const updateTopic = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('tournament_set_live_state' as any, {
      _tournament_id: tournamentId, _state: liveState, _stream_url: null, _topic: topicInput.trim(),
    });
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success('Tópico atualizado'); onChange?.(); }
  };

  const postMessage = async () => {
    const t = msgText.trim();
    if (!t) return;
    setBusy(true);
    const { error } = await supabase.rpc('tournament_post_live_message' as any, {
      _tournament_id: tournamentId, _kind: msgKind, _text: t,
    });
    setBusy(false);
    if (error) toast.error(error.message); else { setMsgText(''); toast.success('Publicado'); }
  };

  return (
    <div className="space-y-4">
      {/* Banner ao vivo */}
      {showBanner && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-destructive/30 bg-gradient-to-br from-destructive/10 via-background to-background p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              {isLive ? (
                <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 1.4 }}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold tracking-[0.2em]">
                  <Radio className="h-3 w-3" /> AO VIVO
                </motion.span>
              ) : (
                <Badge variant="outline" className="text-warning border-warning/40">
                  <Pause className="h-3 w-3 mr-1" /> Pausado
                </Badge>
              )}
              {liveStartedAt && <span className="text-[11px] text-muted-foreground">desde {formatTime(liveStartedAt)}</span>}
              {currentTopic && <span className="text-xs font-semibold ml-2 truncate">{currentTopic}</span>}
            </div>
            {/* GAP-TL01: Espectadores */}
            {isLive && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Eye className="h-3.5 w-3.5 text-primary" />
                {viewers} espectadores
              </span>
            )}
          </div>

          {/* GAP-TL04: Controle de volume */}
          {embed && playStream && (
            <div className="flex items-center gap-2">
              <button onClick={() => setMuted(!muted)} className="text-muted-foreground hover:text-foreground">
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <Slider
                value={[volume]}
                onValueChange={([v]) => setVolume(v)}
                max={100}
                step={1}
                className="w-24"
              />
            </div>
          )}

          {/* GAP-TL03: Preview do embed */}
          {!embed && urlInput && (
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
            >
              <Image className="h-3.5 w-3.5" />
              {showPreview ? 'Ocultar' : 'Ver'} preview do stream
            </button>
          )}

          {embed && (dataSaver && !playStream ? (
            <button
              type="button"
              onClick={() => setPlayStream(true)}
              className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border border-border bg-overlay/60 text-sm text-muted-foreground hover:border-primary/40 transition"
            >
              <Radio className="h-5 w-5 text-destructive" />
              <span className="font-semibold text-foreground">Toque para carregar o stream</span>
              <span className="text-[11px]">Economia de dados ativa — nada toca sozinho</span>
            </button>
          ) : (
            <div className="aspect-video w-full rounded-xl overflow-hidden surface-video">
              <iframe 
                ref={iframeRef}
                src={embed} 
                allowFullScreen 
                allow="autoplay; fullscreen" 
                className="w-full h-full" 
                title="Stream ao vivo" 
              />
            </div>
          ))}
          {!embed && streamUrl && (
            <a href={streamUrl} target="_blank" rel="noreferrer"
              className="block text-center text-sm text-primary underline">Abrir stream em {streamPlatform || 'nova aba'}</a>
          )}
        </motion.div>
      )}

      {/* GAP-TL02: Histórico de streams */}
      {streamHistory.length > 0 && (
        <div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition"
          >
            <History className="h-3.5 w-3.5" />
            {showHistory ? 'Ocultar' : 'Ver'} streams anteriores
          </button>
          {showHistory && (
            <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
              {streamHistory.map((s, i) => (
                <div key={i} className="flex items-center justify-between text-[10px] bg-secondary/40 rounded px-2 py-1">
                  <span className="truncate">{s.url}</span>
                  <span className="text-muted-foreground">{new Date(s.used_at).toLocaleDateString('pt-BR')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Feed público */}
      {events.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card/40 p-3 max-h-72 overflow-y-auto space-y-2">
          {events.filter(e => ['commentary','highlight','announcement'].includes(e.kind)).slice(0, 20).map(e => (
            <div key={e.id} className="flex gap-2 items-start text-xs">
              <span className="shrink-0 mt-0.5">
                {e.kind === 'commentary' && <MessageCircle className="h-3.5 w-3.5 text-primary" />}
                {e.kind === 'highlight' && <Sparkles className="h-3.5 w-3.5 text-warning" />}
                {e.kind === 'announcement' && <Megaphone className="h-3.5 w-3.5 text-destructive" />}
              </span>
              <div className="flex-1">
                <p className={e.kind === 'announcement' ? 'font-bold' : ''}>{e.payload?.text}</p>
                <span className="text-[10px] text-muted-foreground">{formatTime(e.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Painel de controle do admin/mod */}
      {isMod && !isEnded && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold flex items-center gap-2"><Radio className="h-4 w-4 text-primary" /> Painel de Controle da Live</h3>
            <Badge variant="secondary" className="uppercase text-[10px] tracking-widest">{liveState}</Badge>
          </div>

          <div className="flex flex-wrap gap-2">
            {!isLive && (
              <Button onClick={() => setState('live', urlInput.trim() || undefined)} disabled={busy} size="sm" className="bg-destructive hover:bg-destructive">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                {isPaused ? ' Retomar' : ' Iniciar live'}
              </Button>
            )}
            {isLive && (
              <Button onClick={() => setState('paused')} disabled={busy} size="sm" variant="outline">
                <Pause className="h-3.5 w-3.5" /> Pausar
              </Button>
            )}
            {(isLive || isPaused) && (
              <Button onClick={() => setState('ended')} disabled={busy} size="sm" variant="destructive">
                <Square className="h-3.5 w-3.5" /> Encerrar
              </Button>
            )}
          </div>

          <div className="grid gap-2 md:grid-cols-[1fr_auto]">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">URL do stream (Twitch / YouTube / Kick)</label>
              <Input value={urlInput} onChange={e => setUrlInput(e.target.value)} placeholder="https://twitch.tv/canal" />
            </div>
            <Button onClick={updateStream} disabled={busy || !urlInput.trim()} size="sm" className="self-end">Atualizar stream</Button>
          </div>

          <div className="grid gap-2 md:grid-cols-[1fr_auto]">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Tópico atual</label>
              <Input value={topicInput} onChange={e => setTopicInput(e.target.value)} maxLength={120} placeholder="Ex: Semifinal — Alpha vs Bravo" />
            </div>
            <Button onClick={updateTopic} disabled={busy} size="sm" variant="secondary" className="self-end">Definir tópico</Button>
          </div>

          <div className="space-y-2 border-t border-border/60 pt-3">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Postar no feed</label>
            <div className="flex gap-1">
              {(['commentary','highlight','announcement'] as const).map(k => (
                <button key={k} onClick={() => setMsgKind(k)}
                  className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-colors ${
                    msgKind === k ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/50'
                  }`}>
                  {k === 'commentary' ? 'Comentário' : k === 'highlight' ? 'Highlight' : 'Anúncio'}
                </button>
              ))}
            </div>
            <Textarea value={msgText} onChange={e => setMsgText(e.target.value)} maxLength={500} rows={2}
              placeholder={msgKind === 'announcement' ? 'Aviso oficial para a audiência…' : msgKind === 'highlight' ? 'Descreva o lance memorável…' : 'Diga o que está rolando…'} />
            <Button onClick={postMessage} disabled={busy || !msgText.trim()} size="sm" className="w-full">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : null}
              Publicar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function labelForState(state: string) {
  switch (state) {
    case 'live': return 'Live no ar 🔴';
    case 'paused': return 'Live pausada';
    case 'ended': return 'Live encerrada';
    default: return 'Estado atualizado';
  }
}

// Constrói uma URL de embed segura
const TWITCH_CHANNEL_RE = /^[a-zA-Z0-9_]{3,25}$/;
const YOUTUBE_ID_RE = /^[a-zA-Z0-9_-]{8,15}$/;
const KICK_CHANNEL_RE = /^[a-zA-Z0-9_-]{2,30}$/;

function buildEmbed(url: string | null | undefined, platform: string | null | undefined, dataSaver = false): string | null {
  if (!url) return null;
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    const host_ = u.hostname.toLowerCase();
    const isHost = (root: string) => host_ === root || host_.endsWith('.' + root);
    if (platform === 'twitch' || isHost('twitch.tv')) {
      const channel = u.pathname.replace(/^\//, '').split('/')[0];
      if (!TWITCH_CHANNEL_RE.test(channel)) return null;
      return `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${encodeURIComponent(host)}&muted=${dataSaver ? 'true' : 'false'}&autoplay=${dataSaver ? 'false' : 'true'}`;
    }
    if (platform === 'youtube' || isHost('youtube.com') || isHost('youtu.be')) {
      let id = u.searchParams.get('v');
      if (!id && isHost('youtu.be')) id = u.pathname.replace(/^\//, '');
      if (u.pathname.startsWith('/live/')) id = u.pathname.split('/')[2];
      if (!id || !YOUTUBE_ID_RE.test(id)) return null;
      return `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=${dataSaver ? '0' : '1'}`;
    }
    if (platform === 'kick' || isHost('kick.com')) {
      const channel = u.pathname.replace(/^\//, '').split('/')[0];
      if (!KICK_CHANNEL_RE.test(channel)) return null;
      return `https://player.kick.com/${encodeURIComponent(channel)}`;
    }
  } catch { /* URL inválida — ignora */ }
  return null;
}