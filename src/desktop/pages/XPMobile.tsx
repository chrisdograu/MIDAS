import { useEffect, useState } from 'react';
import { Zap, Users, Award, TrendingUp, Smartphone } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { toast } from 'sonner';
import XPList from './XPList';

const MOBILE_ACTIONS = ['forum_post', 'forum_reply', 'tournament_rank_1', 'tournament_rank_2', 'tournament_rank_3', 'tournament_signup'];

export default function XPMobile() {
  const [stats, setStats] = useState({
    total_xp: 0,
    total_users: 0,
    top_action: '',
    top_action_count: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      try {
        // Buscar total de XP mobile
        const { data: xpData } = await supabase
          .from('user_xp_log')
          .select('xp, action')
          .in('action', MOBILE_ACTIONS);

        const totalXp = (xpData || []).reduce((acc, curr) => acc + (curr.xp || 0), 0);
        const uniqueUsers = new Set((xpData || []).map(r => r.user_id)).size;

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
        });
      } catch (error) {
        toast.error('Erro ao carregar estatísticas do Mobile');
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  const actionLabels: Record<string, string> = {
    forum_post: '📝 Posts no fórum',
    forum_reply: '💬 Respostas no fórum',
    tournament_rank_1: '🏆 1º lugar torneio',
    tournament_rank_2: '🥈 2º lugar torneio',
    tournament_rank_3: '🥉 3º lugar torneio',
    tournament_signup: '📋 Inscrições torneio',
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader 
        icon={Smartphone} 
        title="XP Mobile" 
        subtitle="Pontuação social — comunidade, fórum e torneios"
      />

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/50">
          <CardContent className="py-4 px-4 flex items-center gap-3">
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
            <div className="p-2 rounded-lg bg-warning/10"><Award className="h-5 w-5 text-warning" /></div>
            <div>
              <p className="text-2xl font-bold">{loading ? '...' : stats.top_action_count}</p>
              <p className="text-xs text-muted-foreground">{actionLabels[stats.top_action] || 'Ação principal'}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="py-4 px-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10"><TrendingUp className="h-5 w-5 text-accent" /></div>
            <div>
              <p className="text-2xl font-bold">{loading ? '...' : 'Mobile'}</p>
              <p className="text-xs text-muted-foreground">Plataforma</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de XP */}
      <XPList platform="mobile" />
    </div>
  );
}