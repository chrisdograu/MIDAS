import { useEffect, useState } from 'react';
import { Zap, Users, ShoppingBag, TrendingUp, Monitor } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { toast } from 'sonner';
import XPList from './XPList';

const WEB_ACTIONS = ['purchase', 'review'];

export default function XPWeb() {
  const [stats, setStats] = useState({
    total_xp: 0,
    total_users: 0,
    top_action: '',
    top_action_count: 0,
    total_purchases: 0,
    total_reviews: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      try {
        // Buscar total de XP web
        const { data: xpData, error } = await supabase
          .from('user_xp_log')
          .select('xp, action, user_id')
          .in('action', WEB_ACTIONS)
          .limit(50000);
        if (error) throw error;

        const totalXp = (xpData || []).reduce((acc, curr) => acc + (curr.xp || 0), 0);
        const uniqueUsers = new Set((xpData || []).map(r => r.user_id)).size;

        // Contagem por ação
        const purchases = (xpData || []).filter(r => r.action === 'purchase').length;
        const reviews = (xpData || []).filter(r => r.action === 'review').length;

        // Ação mais comum
        const actionCount = new Map<string, number>();
        (xpData || []).forEach(r => {
          actionCount.set(r.action, (actionCount.get(r.action) || 0) + 1);
        });
        let topAction = '';
        let topCount = 0;
        actionCount.forEach((count, action) => {
          if (count > topCount) {
            topCount = count;
            topAction = action;
          }
        });

        setStats({
          total_xp: totalXp,
          total_users: uniqueUsers,
          top_action: topAction,
          top_action_count: topCount,
          total_purchases: purchases,
          total_reviews: reviews,
        });
      } catch (error) {
        console.warn('[XPWeb] erro:', error);
        toast.error('Erro ao carregar estatísticas do Web');
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  const actionLabels: Record<string, string> = {
    purchase: '🛒 Compras',
    review: '⭐ Reviews',
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader 
        icon={Monitor} 
        title="XP Web" 
        subtitle="Pontuação da loja — compras e reviews"
      />

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/50">
          <CardContent className="py-4 px-4 flex items-center gap-3" role="status" aria-label="XP total web">
            <div className="p-2 rounded-lg bg-primary/10"><Zap className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-2xl font-bold">{loading ? '...' : stats.total_xp}</p>
              <p className="text-xs text-muted-foreground">XP Total</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="py-4 px-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10"><Users className="h-5 w-5 text-success" /></div>
            <div>
              <p className="text-2xl font-bold">{loading ? '...' : stats.total_users}</p>
              <p className="text-xs text-muted-foreground">Usuários</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="py-4 px-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10"><ShoppingBag className="h-5 w-5 text-accent" /></div>
            <div>
              <p className="text-2xl font-bold">{loading ? '...' : stats.total_purchases}</p>
              <p className="text-xs text-muted-foreground">Compras</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="py-4 px-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10"><TrendingUp className="h-5 w-5 text-warning" /></div>
            <div>
              <p className="text-2xl font-bold">{loading ? '...' : stats.total_reviews}</p>
              <p className="text-xs text-muted-foreground">Reviews</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detalhe da ação principal */}
      {!loading && stats.top_action && (
        <Card className="border-border/50 bg-muted/20">
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <span className="text-2xl">{actionLabels[stats.top_action]?.split(' ')[0] || '🎯'}</span>
            <div>
              <p className="text-sm font-medium">
                Ação principal: <span className="text-primary">{actionLabels[stats.top_action] || stats.top_action}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {stats.top_action_count} ocorrência(s) — é a forma mais comum de ganhar XP na plataforma Web
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de XP */}
      <XPList platform="web" />
    </div>
  );
}