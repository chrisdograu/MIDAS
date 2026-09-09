
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useAdminUnreadCount } from '@/hooks/useAdminNotifications';

export function AdminNotificationBell() {
  const unreadCount = useAdminUnreadCount();

  return (
    <Link to="/desktop/notificacoes" className="relative p-2 rounded-lg hover:bg-secondary transition-colors">
      <Bell className="h-5 w-5 text-muted-foreground" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Link>
  );
}