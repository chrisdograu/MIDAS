import { useState, useEffect } from 'react';
import { Sparkles, Award, Trophy, Ticket, TrendingUp, Users, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Stats {
  badges: number;
  titulos: number;
  cupons: number;
  xp_total: number;
  usuarios_com_xp: number;
}

/**
 * Hub das recompensas — atalhos para Badges, Títulos, Cupons e XP.
 * GAP-D240: Com estatísticas agregadas
 * GAP-D241: Com indicadores de atividade
 */
export default function RecompensasAdmin() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({ badges: 0, titulos: 0, cupons: 0, xp_total: 0, usuarios_com_xp: 0 });
  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    setLoading(true);
    try {
      const [badgesRes, titulosRes, cuponsRes, xpRes] = await Promise.all([
        supabase.from('badge_catalog').select('*', { count: 'exact', head: true }),
        supabase.from('user_titles').select('*', { count: 'exact', head: true }),
        supabase.from('cupons').select('*', { count: 'exact', head: true }),
        supabase.from('user_xp_log').select('xp, user_id'),
      ]);

      // Supabase não lança erro — precisa checar explicitamente.
      if (badgesRes.error || titulosRes.error || cuponsRes.error || xpRes.error) {
        console.warn('[RecompensasAdmin] erro nas queries:', {
          badges: badgesRes.error,
          titulos: titulosRes.error,
          cupons: cuponsRes.error,
          xp: xpRes.error,
        });
        toast.error('Erro ao carregar estatísticas');
        setLoading(false);
        return;
      }

      const xpData = xpRes.data;
      const totalXp = (xpData || []).reduce((acc, curr) => acc + (curr.xp || 0), 0);
      const usuariosComXp = new Set((xpData || []).map(u => u.user_id)).size;

      const badges = badgesRes.count;
      const titulos = titulosRes.count;
      const cupons = cuponsRes.count;

      setStats({
        badges: badges || 0,
        titulos: titulos || 0,
        cupons: cupons || 0,
        xp_total: totalXp,
        usuarios_com_xp: usuariosComXp,
      });
    } catch (error) {
      // TODO: as queries usam supabase.from() que retorna { data, error } — o error
      // não é lançado. Precisamos checar data/error explicitamente pra mostrar
      // números reais em vez de 0.
      console.warn('[RecompensasAdmin] erro:', error);
      toast.error('Erro ao carregar estatísticas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStats(); }, []);

  // GAP-D241: Indicadores de atividade
  const sections = [
    { 
      label: 'Badges', 
      desc: 'Conquistas visuais', 
      to: '/desktop/badges',
      icon: Award,
      count: stats.badges,
      active: stats.badges > 0,
    },
    { 
      label: 'Títulos', 
      desc: 'Títulos exclusivos', 
      to: '/desktop/titulos',
      icon: Trophy,
      count: stats.titulos,
      active: stats.titulos > 0,
    },
    { 
      label: 'Cupons', 
      desc: 'Códigos promocionais', 
      to: '/desktop/cupons',
      icon: Ticket,
      count: stats.cupons,
      active: stats.cupons > 0,
    },
    { 
      label: 'XP Mobile', 
      desc: 'Pontuação social', 
      to: '/desktop/xp/mobile',
      icon: TrendingUp,
      count: stats.usuarios_com_xp,
      active: stats.usuarios_com_xp > 0,
    },
    { 
      label: 'XP Web', 
      desc: 'Pontuação loja/reviews', 
      to: '/desktop/xp/web',
      icon: TrendingUp,
      count: stats.usuarios_com_xp,
      active: stats.usuarios_com_xp > 0,
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <AdminPageHeader icon={Sparkles} title="Recompensas" subtitle="Central de bonificações para usuários" />

      {/* GAP-D240: Cards de estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-border/50">
          <CardContent className="py-4 px-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Award className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-2xl font-bold">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : stats.badges}</p>
              <p className="text-xs text-muted-foreground">Badges</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="py-4 px-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-secondary/10"><Trophy className="h-5 w-5 text-secondary" /></div>
            <div>
              <p className="text-2xl font-bold">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : stats.titulos}</p>
              <p className="text-xs text-muted-foreground">Títulos</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="py-4 px-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10"><Ticket className="h-5 w-5 text-warning" /></div>
            <div>
              <p className="text-2xl font-bold">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : stats.cupons}</p>
              <p className="text-xs text-muted-foreground">Cupons</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="py-4 px-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10"><Users className="h-5 w-5 text-success" /></div>
            <div>
              <p className="text-2xl font-bold">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : stats.usuarios_com_xp}</p>
              <p className="text-xs text-muted-foreground">Usuários com XP</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="py-4 px-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10"><TrendingUp className="h-5 w-5 text-accent" /></div>
            <div>
              <p className="text-2xl font-bold">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : stats.xp_total.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">XP Total</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grid de seções */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {sections.map(s => (
          <Card 
            key={s.to} 
            className={`border-border/50 hover:border-primary/50 transition-colors cursor-pointer ${!s.active ? 'opacity-60' : ''}`} 
            onClick={() => navigate(s.to)}
          >
            <CardContent className="p-5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <s.icon className="h-5 w-5 text-primary" />
                  <h3 className="font-bold text-lg">{s.label}</h3>
                </div>
                {s.active ? (
                  <Badge className="bg-success/20 text-success">Ativo</Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">Vazio</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm font-medium">{s.count} {s.label === 'Badges' ? 'badges' : s.label === 'Títulos' ? 'títulos' : s.label === 'Cupons' ? 'cupons' : 'usuários'}</span>
                <Button variant="outline" size="sm">Abrir</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}