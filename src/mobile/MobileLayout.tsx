import type { ReactNode } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Home, ShoppingBag, MessagesSquare, Send, User, Settings, Bell, BellDot } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { CosmeticUnlocksCenter } from '@/components/cosmetics/CosmeticUnlocksCenter';
import { usePrefetchRoute } from '@/hooks/usePrefetchRoute';
import { toast } from 'sonner';


const tabs = [
  { to: '/m', icon: Home, label: 'Início', end: true },
  { to: '/m/marketplace', icon: ShoppingBag, label: 'Market' },
  { to: '/m/forum', icon: MessagesSquare, label: 'Fórum' },
  { to: '/m/chat', icon: Send, label: 'Chat', badgeKey: 'chat' as const },
  { to: '/m/perfil', icon: User, label: 'Perfil' },
  { to: '/m/config', icon: Settings, label: 'Config' },
];

type MobileLayoutProps = {
  children?: ReactNode;
};

export default function MobileLayout({ children }: MobileLayoutProps) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [unreadChat, setUnreadChat] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const prefetch = usePrefetchRoute();
  const initialLoad = useRef(true);

  // GAP-M001: Contador de notificações
  useEffect(() => {
    if (!user) { setUnreadChat(0); setUnreadNotifications(0); return; }
    let mounted = true;

    const load = async () => {
      const [{ count: chatCount }, { count: notifCount }] = await Promise.all([
        supabase
          .from('mensagens')
          .select('id', { count: 'exact', head: true })
          .eq('receiver_id', user.id)
          .eq('is_read', false)
          .is('group_id', null)
          .is('tournament_id', null),
        supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_read', false),
      ]);
      if (mounted) {
        setUnreadChat(chatCount || 0);
        setUnreadNotifications(notifCount || 0);
      }
    };
    load();

    const ch1 = supabase
      .channel('mobile-unread-chat')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mensagens', filter: `receiver_id=eq.${user.id}` }, load)
      .subscribe();

    const ch2 = supabase
      .channel('mobile-unread-notif')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, load)
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
    };
  }, [user]);

  // GAP-M004: Deep links
  useEffect(() => {
    if (!initialLoad.current) return;
    initialLoad.current = false;

    // Verificar se veio de um deep link
    const handleDeepLink = () => {
      const url = new URL(window.location.href);
      const params = new URLSearchParams(url.search);
      
      // Parâmetros de deep link
      const gameId = params.get('game');
      const userId = params.get('user');
      const tournamentId = params.get('tournament');
      const chatId = params.get('chat');
      const notificationId = params.get('notification');

      if (gameId) {
        navigate(`/m/jogo/${gameId}`);
        return true;
      }
      if (userId) {
        navigate(`/m/perfil/${userId}`);
        return true;
      }
      if (tournamentId) {
        navigate(`/m/torneio/${tournamentId}`);
        return true;
      }
      if (chatId) {
        navigate(`/m/chat/${chatId}`);
        return true;
      }
      if (notificationId) {
        navigate(`/m/notificacoes/${notificationId}`);
        return true;
      }
      return false;
    };

    handleDeepLink();

    // Listener para deep links via service worker
    const handleDeepLinkEvent = (event: CustomEvent) => {
      const { path, params } = event.detail || {};
      if (path) {
        navigate(path);
      }
    };

    window.addEventListener('deep-link' as any, handleDeepLinkEvent);
    return () => window.removeEventListener('deep-link' as any, handleDeepLinkEvent);
  }, [navigate]);

  // GAP-M003: Animações de transição
  const pageVariants = {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -12 },
  };

  const pageTransition = {
    type: 'spring',
    stiffness: 380,
    damping: 30,
  };

  // GAP-M001: Badge combinado para notificações
  const totalUnread = unreadChat + unreadNotifications;

  return (
    <div className="h-[100dvh] overflow-hidden bg-background text-foreground flex flex-col">
      {/* Top brand bar */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/70 border-b border-border/50">
        <div className="px-4 py-3 flex items-center justify-between">
          <NavLink to="/m" className="font-display text-xl font-bold gradient-text tracking-wider">
            MIDIAS
          </NavLink>
          <div className="flex items-center gap-2">
            {(
              // GAP-M001: Indicador de notificações não lidas em outras telas
              <NavLink to="/m/notificacoes" aria-label="Notificações" title="Notificações" className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-muted/50 transition-colors">
                {totalUnread > 0 ? (
                  <BellDot className="h-5 w-5 text-primary" />
                ) : (
                  <Bell className="h-5 w-5 text-muted-foreground" />
                )}
                {totalUnread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                    {totalUnread > 99 ? '99+' : totalUnread}
                  </span>
                )}
              </NavLink>
            )}
            <CosmeticUnlocksCenter customizationHref="/m/perfil?tab=customizacao" />
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-display">mobile</span>
          </div>
        </div>
      </header>

      {/* Page content com animação */}
      <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial="initial"
            animate="animate"
            exit="exit"
            variants={pageVariants}
            transition={pageTransition as any}
            className="min-h-full"
          >
            {children ?? <Outlet />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom nav */}
      <nav
        className="fixed bottom-0 inset-x-0 z-40 backdrop-blur-xl bg-background/80 border-t border-border/60"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="relative grid grid-cols-6 max-w-screen-sm mx-auto">
          {/* Indicador LED deslizante */}
          {(() => {
            const activeIdx = tabs.findIndex(t => t.end ? location.pathname === t.to : location.pathname.startsWith(t.to));
            if (activeIdx < 0) return null;
            return (
              <motion.div
                aria-hidden
                className="pointer-events-none absolute top-0 flex justify-center"
                style={{ width: `${100 / 6}%` }}
                animate={{ left: `${activeIdx * (100 / 6)}%` }}
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              >
                <span className="block w-8 h-[3px] rounded-b-full bg-gradient-to-r from-primary to-accent shadow-[0_0_10px_hsl(var(--primary)/0.9)]" />
              </motion.div>
            );
          })()}
          {tabs.map(t => {
            const badge = t.badgeKey === 'chat' ? unreadChat : 0;
            return (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                onTouchStart={() => prefetch(t.to)}
                onMouseEnter={() => prefetch(t.to)}
                className={({ isActive }) =>
                  `nav-item flex flex-col items-center justify-center min-h-[44px] py-2.5 gap-0.5 text-[10px] font-medium ${
                    isActive ? 'nav-item-active bg-transparent' : 'nav-item-idle'
                  }`
                }
              >
                <div className="relative">
                  <t.icon className="h-5 w-5" />
                  {badge > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </div>
                <span>{t.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}