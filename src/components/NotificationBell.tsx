import { useEffect, useMemo, useState, useCallback } from 'react';
import { Bell, Clock, X, Settings, Check, ChevronRight, Volume2, VolumeX } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { formatDateTime } from '@/lib/format';
import { dbWrite } from '@/lib/dbWrite';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

interface Notif {
  id: string; title: string; body: string | null; type: string;
  is_read: boolean; created_at: string; reference_type: string | null; reference_id: string | null;
  kind?: string | null; cta_label?: string | null; cta_url?: string | null;
  href?: string;
}

// GAP-NB01: Agrupamento de notificações
interface GroupedNotif {
  groupId: string;
  type: string;
  title: string;
  count: number;
  items: Notif[];
  lastCreatedAt: string;
}

// GAP-NB04: Preferências de notificação
interface NotificationPreferences {
  sound: boolean;
  grouped: boolean;
  types: {
    messages: boolean;
    marketplace: boolean;
    tournaments: boolean;
    social: boolean;
    system: boolean;
  };
}

const isMobileCtx = () => typeof window !== 'undefined' && window.location.pathname.startsWith('/m');

function linkFor(n: Notif): string {
  const isMobile = isMobileCtx();
  const t = n.reference_type;
  const id = n.reference_id;
  if (t === 'produto' && id) return isMobile ? `/m/review/${id}` : `/jogo/${id}`;
  if (t === 'pedido') return isMobile ? '/m/perfil' : '/pedidos';
  if (t === 'anuncio' && id) return isMobile ? `/m/marketplace/${id}` : '/perfil';
  if (t === 'proposta') return isMobile ? '/m/perfil' : '/perfil';
  if (t === 'forum_post' && id) return isMobile ? `/m/forum/post/${id}` : '/perfil';
  if (t === 'tournament') return isMobile ? '/m/perfil' : '/torneios';
  if (t === 'certificado') return isMobile ? '/m/perfil' : '/perfil';
  if (t === 'review_comment' || t === 'avaliacao')
    return isMobile ? (id ? `/m/review/${id}` : '/m/perfil') : (id ? `/jogo/${id}` : '/perfil');
  if (t === 'profile' && id) return isMobile ? `/m/perfil/${id}` : `/perfil/${id}`;
  if (t === 'game_suggestion' && id) return isMobile ? `/m/forum/jogo/${id}` : `/jogo/${id}`;
  return isMobile ? '/m/perfil' : '/perfil';
}

function nextDayAt8(daysAhead: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(8, 0, 0, 0);
  return d;
}

function nextMondayAt8(): Date {
  const d = new Date();
  const day = d.getDay();
  let diff = (8 - day) % 7;
  if (diff === 0) diff = 7;
  d.setDate(d.getDate() + diff);
  d.setHours(8, 0, 0, 0);
  return d;
}

// GAP-NB01: Agrupar notificações
function groupNotifications(items: Notif[]): GroupedNotif[] {
  const groups: Record<string, GroupedNotif> = {};
  
  items.forEach(item => {
    const key = `${item.type}_${item.reference_type || 'none'}`;
    if (!groups[key]) {
      groups[key] = {
        groupId: key,
        type: item.type,
        title: item.title,
        count: 0,
        items: [],
        lastCreatedAt: item.created_at,
      };
    }
    groups[key].count += 1;
    groups[key].items.push(item);
    if (new Date(item.created_at) > new Date(groups[key].lastCreatedAt)) {
      groups[key].lastCreatedAt = item.created_at;
    }
  });
  
  return Object.values(groups).sort(
    (a, b) => new Date(b.lastCreatedAt).getTime() - new Date(a.lastCreatedAt).getTime()
  );
}

// GAP-NB02: Som de notificação
const playNotificationSound = () => {
  try {
    const audio = new Audio('/notification.mp3');
    audio.volume = 0.3;
    audio.play().catch(() => {});
  } catch {
    // Silently fail if audio not available
  }
};

// GAP-NB04: Modal de preferências
function PreferencesModal({ 
  open, 
  onClose, 
  prefs, 
  onSave 
}: { 
  open: boolean; 
  onClose: () => void; 
  prefs: NotificationPreferences; 
  onSave: (prefs: NotificationPreferences) => void;
}) {
  const [localPrefs, setLocalPrefs] = useState(prefs);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl p-6 max-w-sm w-full border border-border shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-semibold">Preferências de Notificações</h4>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        
        <div className="space-y-4">
          {/* GAP-NB02: Som */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {localPrefs.sound ? <Volume2 className="h-4 w-4 text-primary" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
              <span className="text-sm">Som de notificação</span>
            </div>
            <button
              onClick={() => setLocalPrefs({ ...localPrefs, sound: !localPrefs.sound })}
              className={cn(
                "w-10 h-5 rounded-full transition-colors",
                localPrefs.sound ? "bg-primary" : "bg-muted"
              )}
            >
              <div className={cn(
                "w-4 h-4 rounded-full bg-white transition-transform",
                localPrefs.sound ? "translate-x-5" : "translate-x-0.5"
              )} />
            </button>
          </div>
          
          {/* GAP-NB01: Agrupamento */}
          <div className="flex items-center justify-between">
            <span className="text-sm">Agrupar notificações</span>
            <button
              onClick={() => setLocalPrefs({ ...localPrefs, grouped: !localPrefs.grouped })}
              className={cn(
                "w-10 h-5 rounded-full transition-colors",
                localPrefs.grouped ? "bg-primary" : "bg-muted"
              )}
            >
              <div className={cn(
                "w-4 h-4 rounded-full bg-white transition-transform",
                localPrefs.grouped ? "translate-x-5" : "translate-x-0.5"
              )} />
            </button>
          </div>
          
          <Separator />
          
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tipos</p>
          {Object.entries(localPrefs.types).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm capitalize">{key}</span>
              <button
                onClick={() => setLocalPrefs({
                  ...localPrefs,
                  types: { ...localPrefs.types, [key]: !value }
                })}
                className={cn(
                  "w-10 h-5 rounded-full transition-colors",
                  value ? "bg-primary" : "bg-muted"
                )}
              >
                <div className={cn(
                  "w-4 h-4 rounded-full bg-white transition-transform",
                  value ? "translate-x-5" : "translate-x-0.5"
                )} />
              </button>
            </div>
          ))}
        </div>
        
        <div className="flex gap-2 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg bg-secondary text-sm font-semibold"
          >
            Cancelar
          </button>
          <button
            onClick={() => onSave(localPrefs)}
            className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [snoozedUntil, setSnoozedUntil] = useState<string | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [prefOpen, setPrefOpen] = useState(false);
  const [, forceTick] = useState(0);
  
  // GAP-NB04: Preferências
  const [preferences, setPreferences] = useState<NotificationPreferences>(() => {
    try {
      const saved = localStorage.getItem('notif_preferences');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      sound: true,
      grouped: true,
      types: { messages: true, marketplace: true, tournaments: true, social: true, system: true },
    };
  });

  const load = async () => {
    if (!user) return;
    const isMobile = isMobileCtx();
    const { data } = await supabase.from('notifications')
      .select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(50);
    const rows = ((data as any) || []) as Notif[];

    const messageIds = rows
      .filter((item) => item.reference_type === 'mensagem' && item.reference_id)
      .map((item) => item.reference_id as string);

    const messageHrefMap = new Map<string, string>();

    if (messageIds.length) {
      const { data: messages } = await supabase
        .from('mensagens')
        .select('id, sender_id, receiver_id')
        .in('id', messageIds);

      await Promise.all(
        (messages || []).map(async (message) => {
          const { data: conversation } = await supabase
            .from('conversas')
            .select('id')
            .or(`and(participant_1.eq.${message.sender_id},participant_2.eq.${message.receiver_id}),and(participant_1.eq.${message.receiver_id},participant_2.eq.${message.sender_id})`)
            .order('last_message_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (conversation?.id) {
            messageHrefMap.set(message.id, isMobile ? `/m/chat/${conversation.id}` : '/perfil');
          }
        })
      );
    }

    const filteredRows = rows.filter(item => {
      if (!preferences.types[item.type as keyof typeof preferences.types]) return false;
      return true;
    });

    setItems(filteredRows.map((item) => ({
      ...item,
      href: item.reference_type === 'mensagem' && item.reference_id
        ? messageHrefMap.get(item.reference_id) || (isMobile ? '/m/chat' : '/perfil')
        : linkFor(item),
    })));
  };

  const loadSnooze = async () => {
    if (!user) return;
    const { data } = await supabase.from('profiles').select('notifications_snoozed_until').eq('id', user.id).maybeSingle();
    setSnoozedUntil((data as any)?.notifications_snoozed_until || null);
  };

  // GAP-NB02: Efeito sonoro para novas notificações
  useEffect(() => {
    if (!user || !preferences.sound) return;
    
    const channel = supabase
      .channel('notif-sound')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notifications', 
        filter: `user_id=eq.${user.id}` 
      }, () => {
        playNotificationSound();
      })
      .subscribe();
      
    return () => { supabase.removeChannel(channel); };
  }, [user, preferences.sound]);

  useEffect(() => {
    if (!user) return;
    load();
    loadSnooze();
    const ch = supabase.channel('notif-bell')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => load())
      .subscribe();
    const chProfile = supabase.channel('notif-bell-profile')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` }, () => loadSnooze())
      .subscribe();
    return () => { supabase.removeChannel(ch); supabase.removeChannel(chProfile); };
  }, [user?.id]);

  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const isSnoozed = useMemo(() => {
    if (!snoozedUntil) return false;
    return new Date(snoozedUntil).getTime() > Date.now();
  }, [snoozedUntil]);

  // GAP-NB01: Agrupar notificações
  const groupedNotifs = useMemo(() => {
    if (!preferences.grouped) return items.map(i => ({ ...i, groupKey: i.id }));
    return groupNotifications(items);
  }, [items, preferences.grouped]);

  const unread = items.filter(i => !i.is_read).length;

  const markAllRead = async () => {
    if (!user || unread === 0) return;
    await dbWrite(supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false));
    load();
  };

  const markGroupRead = async (group: GroupedNotif) => {
    const ids = group.items.map(i => i.id);
    await dbWrite(supabase.from('notifications').update({ is_read: true }).in('id', ids).eq('user_id', user?.id || ''));
    load();
  };

  const markOneRead = async (id: string, alreadyRead: boolean) => {
    if (!alreadyRead) {
      await dbWrite(supabase.from('notifications').update({ is_read: true }).eq('id', id).eq('user_id', user?.id || ''));
    }
    setOpen(false);
    load();
  };

  const setSnooze = async (date: Date | null) => {
    if (!user) return;
    const iso = date ? date.toISOString() : null;
    const { error } = await supabase.from('profiles').update({ notifications_snoozed_until: iso } as any).eq('id', user.id);
    if (error) { toast.error('Erro ao atualizar soneca'); return; }
    setSnoozedUntil(iso);
    toast.success(iso ? `Notificações silenciadas até ${formatDateTime(date!)}` : 'Soneca cancelada');
  };

  const applyCustom = () => {
    if (!customValue) return;
    const d = new Date(customValue);
    if (isNaN(d.getTime())) { toast.error('Horário inválido'); return; }
    setSnooze(d);
    setCustomOpen(false);
  };

  // GAP-NB04: Salvar preferências
  const savePreferences = (newPrefs: NotificationPreferences) => {
    setPreferences(newPrefs);
    localStorage.setItem('notif_preferences', JSON.stringify(newPrefs));
    toast.success('Preferências salvas');
    setPrefOpen(false);
    load();
  };

  if (!user) return null;

  return (
    <div className="relative flex items-center">
      <div className="relative">
        <button 
          onClick={() => setOpen(!open)} 
          className="relative p-2 rounded-lg hover:bg-secondary transition-colors" 
          aria-label="Notificações"
        >
          <Bell className="h-5 w-5 text-foreground" />
          {!isSnoozed && unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
          {isSnoozed && (
            <span className="absolute -bottom-0.5 -right-0.5 bg-card rounded-full">
              <Clock className="h-3 w-3 text-primary" />
            </span>
          )}
        </button>
        
        <AnimatePresence>
          {open && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
              <motion.div 
                initial={{ opacity: 0, y: -8 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -8 }}
                className="absolute right-0 top-full mt-1 z-50 w-[min(22rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] bg-card border border-border rounded-lg shadow-xl overflow-hidden"
              >
                <div className="p-3 border-b border-border flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-sm">Notificações</h3>
                  <div className="flex items-center gap-2">
                    {/* GAP-NB04: Botão de preferências */}
                    <button
                      onClick={() => setPrefOpen(true)}
                      className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                      aria-label="Preferências de notificação"
                    >
                      <Settings className="h-4 w-4" />
                    </button>
                    
                    {unread > 0 && (
                      <button onClick={markAllRead} className="text-xs text-primary hover:underline whitespace-nowrap">
                        Marcar todas
                      </button>
                    )}
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className={`p-1.5 rounded-md hover:bg-secondary transition-colors ${isSnoozed ? 'text-primary' : 'text-muted-foreground'}`}
                          aria-label="Silenciar notificações"
                          title={isSnoozed ? `Silenciado até ${formatDateTime(snoozedUntil!)}` : 'Silenciar notificações'}
                        >
                          <Clock className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="z-[60]">
                        <DropdownMenuItem onClick={() => setSnooze(new Date(Date.now() + 60 * 60 * 1000))}>1 hora</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setSnooze(nextDayAt8(1))}>Até amanhã</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setSnooze(nextMondayAt8())}>Até segunda</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <Popover open={customOpen} onOpenChange={setCustomOpen}>
                          <PopoverTrigger asChild>
                            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setCustomOpen(true); }}>
                              Escolher horário
                            </DropdownMenuItem>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 space-y-2 z-[60]" align="end">
                            <Input type="datetime-local" value={customValue} onChange={(e) => setCustomValue(e.target.value)} />
                            <Button size="sm" className="w-full" onClick={applyCustom}>Confirmar</Button>
                          </PopoverContent>
                        </Popover>
                        {isSnoozed && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setSnooze(null)}>Cancelar soneca</DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {isSnoozed && (
                  <div className="px-3 py-2 border-b border-border bg-secondary/40 flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      Silenciado até {formatDateTime(snoozedUntil!)}
                    </span>
                    <button onClick={() => setSnooze(null)} className="text-primary hover:underline flex items-center gap-0.5">
                      <X className="h-3 w-3" /> Cancelar
                    </button>
                  </div>
                )}
                
                <div className="max-h-[60vh] overflow-y-auto divide-y divide-border">
                  {items.length === 0 && (
                    <div className="p-8 text-center">
                      <Bell className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Nenhuma notificação</p>
                      <p className="text-xs text-muted-foreground/70">Aqui aparecerão atualizações sobre seus jogos e interações</p>
                    </div>
                  )}
                  
                  {preferences.grouped ? (
                    (groupedNotifs as GroupedNotif[]).map(group => {
                      const hasUnread = group.items.some(i => !i.is_read);
                      return (
                        <div key={group.groupId} className="p-3 hover:bg-secondary/50 transition-colors border-b border-border/50 last:border-0">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm font-medium text-foreground truncate">{group.title}</span>
                              <span className="text-xs bg-secondary px-1.5 rounded-full text-muted-foreground">
                                {group.count}
                              </span>
                            </div>
                            {hasUnread && (
                              <button
                                onClick={() => markGroupRead(group)}
                                className="text-[10px] text-primary hover:underline"
                              >
                                Marcar lidas
                              </button>
                            )}
                          </div>
                          <div className="mt-1 space-y-1">
                            {group.items.slice(0, 3).map(item => (
                              <Link
                                key={item.id}
                                to={item.href || '#'}
                                onClick={() => markOneRead(item.id, item.is_read)}
                                className={`block text-xs ${!item.is_read ? 'text-foreground font-medium' : 'text-muted-foreground'} hover:text-primary transition-colors`}
                              >
                                • {item.body || item.title}
                              </Link>
                            ))}
                            {group.count > 3 && (
                              <span className="text-[10px] text-muted-foreground">
                                +{group.count - 3} mais
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    items.map(n => {
                      const isMobile = isMobileCtx();
                      const ctaHref = n.cta_url
                        ? (isMobile && n.cta_url.startsWith('/perfil') ? n.cta_url.replace('/perfil', '/m/perfil') : n.cta_url)
                        : null;
                      const mainHref = n.href || linkFor(n);
                      return (
                        <div key={n.id} className={`p-3 hover:bg-secondary/50 transition-colors ${!n.is_read ? 'bg-primary/5' : ''} ${n.kind === 'destacada' ? 'border-l-2 border-primary' : ''}`}>
                          <Link to={mainHref} onClick={() => markOneRead(n.id, n.is_read)} className="block">
                            <div className="flex items-start gap-2">
                              {!n.is_read && <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground break-words">{n.title}</p>
                                {n.body && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</p>}
                                <p className="text-[10px] text-muted-foreground mt-1">{formatDateTime(n.created_at)}</p>
                              </div>
                            </div>
                          </Link>
                          {ctaHref && n.cta_label && (
                            <Link
                              to={ctaHref}
                              onClick={() => markOneRead(n.id, n.is_read)}
                              className="mt-2 ml-4 inline-flex items-center px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90"
                            >
                              {n.cta_label}
                            </Link>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* GAP-NB04: Modal de preferências */}
      <PreferencesModal
        open={prefOpen}
        onClose={() => setPrefOpen(false)}
        prefs={preferences}
        onSave={savePreferences}
      />
    </div>
  );
}