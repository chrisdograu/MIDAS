import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, CheckCheck, Loader2, MessageSquare, UserPlus, RefreshCw, Package, Star, Heart, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatDateTime, timeAgo } from '@/lib/format';
import { toast } from 'sonner';
import EstadoVazio from '@/components/EstadoVazio';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import ErroCarregamento from '@/components/ErroCarregamento';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  cta_url?: string | null;
  is_read: boolean;
  created_at: string;
  reference_type: string | null;
  reference_id: string | null;
}

const TYPE_ICONS: Record<string, any> = {
  forum_reply: MessageSquare,
  forum_mention: MessageSquare,
  trade_update: Package,
  follow: UserPlus,
  review_reply: Star,
  like: Heart,
  comment: MessageSquare,
  system: Bell,
};

const TYPE_COLORS: Record<string, string> = {
  forum_reply: 'text-primary bg-primary/10',
  forum_mention: 'text-primary bg-primary/10',
  trade_update: 'text-warning bg-warning/10',
  follow: 'text-success bg-success/10',
  review_reply: 'text-accent bg-accent/10',
  like: 'text-destructive bg-destructive/10',
  comment: 'text-muted-foreground bg-muted/20',
  system: 'text-muted-foreground bg-muted/20',
};

export default function MNotificacoes() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    setLoadError(false);
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      console.error('Erro ao carregar notificações:', error);
      setLoadError(true);
    } else {
      setNotifications(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (!user) return;
    const channel = supabase.channel(`mobile-notifications-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const markAllAsRead = async () => {
    if (!user) return;
    setMarkingAll(true);
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    setMarkingAll(false);
    if (error) {
      toast.error('Erro ao marcar como lidas');
      return;
    }
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    toast.success('Todas as notificações marcadas como lidas');
  };

  const handleClick = async (notif: Notification) => {
    if (!user) return;
    if (!notif.is_read) {
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id).eq('user_id', user.id);
      if (error) toast.error('Não foi possível marcar a notificação como lida');
      else setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
    }
    const destination = notif.cta_url || notif.link;
    if (destination) {
      const mobilePath = destination === '/perfil' ? '/m/perfil'
        : destination.startsWith('/perfil/') ? destination.replace('/perfil/', '/m/perfil/')
        : destination === '/forum' ? '/m/forum'
        : destination === '/torneios' ? '/torneios'
        : destination;
      navigate(mobilePath);
    }
  };

  if (!user) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-muted-foreground mb-4">Entre para ver suas notificações.</p>
        <Link to="/m/auth" className="inline-block px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold">Entrar</Link>
      </div>
    );
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const hasUnread = unreadCount > 0;

  // Agrupar por data
  const groups = notifications.reduce<Record<string, Notification[]>>((acc, n) => {
    const date = new Date(n.created_at);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    let key = 'Outros';
    if (date.toDateString() === today.toDateString()) key = 'Hoje';
    else if (date.toDateString() === yesterday.toDateString()) key = 'Ontem';
    else key = date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    
    if (!acc[key]) acc[key] = [];
    acc[key].push(n);
    return acc;
  }, {});

  return (
    <div className="w-full min-w-0 px-4 py-5 space-y-4 pb-8">
      <div className="flex items-center justify-between">
        <Link to="/m" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <div className="flex items-center gap-2">
          {hasUnread && (
            <Button
              onClick={markAllAsRead}
              disabled={markingAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              {markingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
              Marcar lidas
            </Button>
          )}
          <Button
            variant="outline" size="icon" aria-label="Atualizar notificações" title="Atualizar notificações"
            onClick={load}
            disabled={loading}
            className="p-2 rounded-lg bg-card border border-border hover:border-primary/40 transition-colors"
          >
            <RefreshCw className={"h-4 w-4 " + (loading ? 'animate-spin' : '')} />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Bell className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold">Notificações</h1>
        {unreadCount > 0 && (
          <span className="text-xs bg-destructive text-destructive-foreground px-2 py-0.5 rounded-full">
            {unreadCount} não lidas
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : loadError ? <ErroCarregamento onRetry={load} /> : notifications.length === 0 ? (
        <EstadoVazio
          icone={Bell}
          titulo="Nenhuma notificação ainda"
          descricao="Quando alguém interagir com você, aparecerá aqui."
        />
      ) : (
        <div className="space-y-4">
          {Object.entries(groups).map(([groupLabel, items]) => (
            <div key={groupLabel}>
              <p className="text-xs font-bold uppercase text-muted-foreground mb-2">{groupLabel}</p>
              <div className="space-y-2">
                {items.map((n, index) => {
                  const Icon = TYPE_ICONS[n.type] || Bell;
                  const colorClass = TYPE_COLORS[n.type] || 'text-muted-foreground bg-muted/20';
                  
                  return (
                    <Button
                      variant="ghost"
                      key={n.id}
                      onClick={() => handleClick(n)}
                      className={"flex h-auto w-full min-w-0 items-start justify-start gap-3 whitespace-normal p-3 rounded-lg text-left transition-colors " + (n.is_read ? 'bg-card border border-border' : 'bg-primary/5 border border-primary/20')}
                    >
                      <div className={"w-10 h-10 rounded-full " + colorClass + " flex items-center justify-center shrink-0"}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="break-words text-sm font-semibold text-foreground [overflow-wrap:anywhere]">{n.title}</p>
                        {n.body && <p className="break-words text-xs text-muted-foreground mt-0.5 [overflow-wrap:anywhere]">{n.body}</p>}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-muted-foreground">{timeAgo(n.created_at)}</span>
                          {!n.is_read && (
                            <span className="w-2 h-2 rounded-full bg-primary" />
                          )}
                        </div>
                      </div>
                    </Button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}