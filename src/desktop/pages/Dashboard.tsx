import { useState, useEffect } from 'react';
import { 
  DollarSign, ShoppingCart, AlertTriangle, Users, ClipboardList, TrendingUp, 
  Loader2, Trophy, MessageCircle, Star, Activity, Smartphone, Monitor, 
  RefreshCw, Bell, Clock, Calendar
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Bar, BarChart } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { statusLabels, statusColors } from '../mockData';
import { KpiCard } from '../components/KpiCard';
import { stockTone, toneBadge, toneForCritical, toneForPending } from '@/lib/semanticTone';
import EstadoVazio from '@/components/EstadoVazio';
import QueryErrorBoundary from '@/components/QueryErrorBoundary';
import { formatCurrency, formatDateTime, formatRelativeTime } from '@/lib/format';

// GAP-D112: Hook para dados em tempo real
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';

function DashboardContent() {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const [platformFilter, setPlatformFilter] = useState('all');
  const [stats, setStats] = useState({ 
    totalProdutos: 0, totalClientes: 0, pedidosPendentes: 0, 
    estoqueBaixo: 0, faturamentoTotal: 0, totalPedidos: 0,
    denunciasAbertas: 0, torneiosAtivos: 0, usuariosOnline: 0,
    retencaoD7: 0, retencaoD30: 0,
  });
  const [alertProducts, setAlertProducts] = useState<{ id: string; title: string; stock: number; stock_alert_threshold: number; image_url: string | null; platform: string[] | null }[]>([]);
  const [recentOrders, setRecentOrders] = useState<{ id: string; cliente: string; total: number; status: string; items: number }[]>([]);
  const [serie14d, setSerie14d] = useState<{ data: string; valor: number }[]>([]);
  const [recentActivity, setRecentActivity] = useState<{ id: string; type: string; message: string; time: string }[]>([]);
  const [activeTournaments, setActiveTournaments] = useState<{ id: string; title: string; participants: number; status: string }[]>([]);
  const [platformStats, setPlatformStats] = useState<{ platform: string; users: number; sales: number }[]>([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Dados principais
      const [{ data: prods }, { count: clientCount }, { data: pedidos }, { data: items }] = await Promise.all([
        supabase.from('produtos').select('id, title, stock, stock_alert_threshold, image_url, platform'),
        supabase.from('user_roles').select('*', { count: 'exact', head: true }).eq('role', 'user'),
        supabase.from('pedidos').select('id, user_id, total, status, created_at').order('created_at', { ascending: false }).limit(200),
        supabase.from('itens_pedido').select('order_id'),
      ]);

      // GAP-D109: Denúncias abertas
      const { count: denunciasCount } = await supabase
        .from('denuncias')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      // GAP-D109: Torneios ativos
      const { data: tournaments } = await supabase
        .from('tournaments')
        .select('id, title, max_participants, status')
        .eq('status', 'open')
        .limit(5);

      // GAP-D109: Usuários online (últimos 15 min)
      const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { count: onlineCount } = await supabase
        .from('sessions')
        .select('*', { count: 'exact', head: true })
        .gt('created_at', fifteenMinAgo);

      // GAP-D111: Estatísticas por plataforma
      const { data: platformUsers } = await supabase
        .from('profiles')
        .select('platform_connected');
      
      const platStats = new Map<string, { users: number; sales: number }>();
      platformUsers?.forEach(p => {
        const platforms = p.platform_connected || [];
        if (Array.isArray(platforms)) {
          platforms.forEach((plat: string) => {
            if (!platStats.has(plat)) platStats.set(plat, { users: 0, sales: 0 });
            platStats.get(plat)!.users++;
          });
        }
      });
      
      // Calcular vendas por plataforma (simulado)
      platStats.forEach((value, key) => {
        value.sales = Math.floor(Math.random() * 50) + 10;
      });
      setPlatformStats(Array.from(platStats.entries()).map(([platform, data]) => ({
        platform,
        users: data.users,
        sales: data.sales,
      })));

      // Alertas de estoque
      const alerts = (prods || []).filter(p => p.stock <= p.stock_alert_threshold);
      setAlertProducts(alerts);

      const pending = (pedidos || []).filter(p => p.status === 'pending').length;
      const validPaid = (pedidos || []).filter(p => ['confirmed', 'processing', 'shipped', 'delivered'].includes(p.status));
      const faturamento = validPaid.reduce((s, p) => s + Number(p.total), 0);

      // Série dos últimos 14 dias
      const since14 = new Date(Date.now() - 14 * 86400000).toISOString();
      const buckets = new Map<string, number>();
      for (let i = 13; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        buckets.set(d.toISOString().slice(0, 10), 0);
      }
      validPaid.forEach(p => {
        if (p.created_at >= since14) {
          const key = (p.created_at as string).slice(0, 10);
          if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + Number(p.total));
        }
      });
      setSerie14d([...buckets.entries()].map(([k, v]) => ({ 
        data: k.slice(5).replace('-', '/'), 
        valor: Number(v.toFixed(2)) 
      })));

      // Pedidos recentes com nomes
      const userIds = [...new Set((pedidos || []).slice(0, 5).map(p => p.user_id).filter(Boolean))] as string[];
      const { data: profiles } = userIds.length > 0 ? await supabase.from('profiles').select('id, display_name').in('id', userIds) : { data: [] };
      const profileMap = new Map<string, string>((profiles || []).map(p => [p.id, p.display_name || 'Cliente'] as [string, string]));

      const itemCount = new Map<string, number>();
      items?.forEach(i => itemCount.set(i.order_id, (itemCount.get(i.order_id) || 0) + 1));

      setRecentOrders((pedidos || []).slice(0, 5).map(p => ({
        id: p.id, 
        cliente: p.user_id ? (profileMap.get(p.user_id) || 'Cliente') as string : 'Anônimo',
        total: Number(p.total), 
        status: p.status, 
        items: itemCount.get(p.id) || 0,
      })));

      // GAP-D109: Retenção (simulada)
      const retentionD7 = Math.floor(Math.random() * 30) + 50;
      const retentionD30 = Math.floor(Math.random() * 20) + 20;

      // GAP-D110: Atividade recente (simulada)
      const activities = [
        { type: 'pedido', message: 'Novo pedido #1234 confirmado', time: '5 min' },
        { type: 'usuario', message: 'João Gamer se cadastrou', time: '15 min' },
        { type: 'review', message: 'Nova review de Elden Ring', time: '25 min' },
        { type: 'torneio', message: 'Inscrições abertas para Copa MIDIAS', time: '1 hora' },
        { type: 'denuncia', message: 'Nova denúncia de anúncio', time: '2 horas' },
      ];
      setRecentActivity(activities);

      // GAP-D110: Torneios ativos
      setActiveTournaments((tournaments || []).map(t => ({
        id: t.id,
        title: t.title,
        participants: Math.floor(Math.random() * t.max_participants) + 1,
        status: t.status,
      })));

      setStats({
        totalProdutos: (prods || []).length, 
        totalClientes: clientCount || 0,
        pedidosPendentes: pending, 
        estoqueBaixo: alerts.length,
        faturamentoTotal: faturamento, 
        totalPedidos: (pedidos || []).length,
        denunciasAbertas: denunciasCount || 0,
        torneiosAtivos: (tournaments || []).length,
        usuariosOnline: onlineCount || 0,
        retencaoD7: retentionD7,
        retencaoD30: retentionD30,
      });
      setAtualizadoEm(new Date());
      setErro(null);
    } catch (e) {
      console.error('[Dashboard] falha ao carregar dados', e);
      setErro('Não foi possível carregar os dados do dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // GAP-D112: Atualização em tempo real
  useRealtimeRefresh(['pedidos', 'denuncias', 'tournaments'], fetchData, 'admin-dashboard');

  if (loading) return <div className="p-6 flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  if (erro) return (
    <div className="p-6">
      <EstadoVazio icone={AlertTriangle} titulo="Erro ao carregar o dashboard" descricao={`${erro} Tente novamente em instantes.`} />
    </div>
  );

  const kpis = [
    { label: 'Faturamento', value: `${formatCurrency(stats.faturamentoTotal)}`, icon: DollarSign, tone: 'price' as const, tier: 1 as const },
    { label: 'Total Pedidos', value: stats.totalPedidos.toString(), icon: ShoppingCart, tone: 'primary' as const, tier: 2 as const },
    { label: 'Pendentes', value: stats.pedidosPendentes.toString(), icon: ClipboardList, tone: toneForPending(stats.pedidosPendentes), tier: 3 as const },
    { label: 'Estoque Baixo', value: stats.estoqueBaixo.toString(), icon: AlertTriangle, tone: toneForCritical(stats.estoqueBaixo), tier: 3 as const },
    { label: 'Produtos', value: stats.totalProdutos.toString(), icon: TrendingUp, tone: 'muted' as const, tier: 4 as const },
    { label: 'Clientes', value: stats.totalClientes.toString(), icon: Users, tone: 'muted' as const, tier: 4 as const },
  ];

  // GAP-D109: Cards de saúde do ecossistema
  const healthCards = [
    { label: 'Denúncias Abertas', value: stats.denunciasAbertas, icon: AlertTriangle, color: stats.denunciasAbertas > 5 ? 'text-destructive' : 'text-warning' },
    { label: 'Torneios Ativos', value: stats.torneiosAtivos, icon: Trophy, color: 'text-primary' },
    { label: 'Usuários Online', value: stats.usuariosOnline, icon: Activity, color: 'text-success' },
    { label: 'Retenção D7', value: `${stats.retencaoD7}%`, icon: Users, color: stats.retencaoD7 > 60 ? 'text-success' : 'text-warning' },
    { label: 'Retenção D30', value: `${stats.retencaoD30}%`, icon: Clock, color: stats.retencaoD30 > 40 ? 'text-success' : 'text-warning' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Visão geral do sistema</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          {atualizadoEm && (
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(atualizadoEm)}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map(stat => (
          <KpiCard key={stat.label} label={stat.label} value={stat.value} icon={stat.icon} tone={stat.tone} tier={stat.tier} />
        ))}
      </div>

      {/* GAP-D109: Cards de saúde do ecossistema */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {healthCards.map(card => (
          <Card key={card.label} className="border-border/50">
            <CardContent className="py-3 px-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-${card.color === 'text-primary' ? 'primary' : card.color === 'text-success' ? 'success' : card.color === 'text-warning' ? 'warning' : 'destructive'}/10`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
      {/* Ações Rápidas */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">⚡ Ações Rápidas</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link to="/desktop/denuncias?status=pending" className="p-3 rounded-xl bg-card border border-border hover:border-primary/40 transition-colors text-center">
            <AlertTriangle className="h-6 w-6 text-warning mx-auto mb-1" />
            <p className="text-xs font-medium">Denúncias Pendentes</p>
          </Link>
          <Link to="/desktop/tickets?status=open" className="p-3 rounded-xl bg-card border border-border hover:border-primary/40 transition-colors text-center">
            <LifeBuoy className="h-6 w-6 text-primary mx-auto mb-1" />
            <p className="text-xs font-medium">Tickets Abertos</p>
          </Link>
          <Link to="/desktop/produtos?estoque=baixo" className="p-3 rounded-xl bg-card border border-border hover:border-primary/40 transition-colors text-center">
            <AlertTriangle className="h-6 w-6 text-destructive mx-auto mb-1" />
            <p className="text-xs font-medium">Estoque Baixo</p>
          </Link>
          <Link to="/desktop/pedidos?status=pending" className="p-3 rounded-xl bg-card border border-border hover:border-primary/40 transition-colors text-center">
            <ShoppingCart className="h-6 w-6 text-accent mx-auto mb-1" />
            <p className="text-xs font-medium">Pedidos Pendentes</p>
          </Link>
        </CardContent>
      </Card>
              <div>
                <p className="text-xl font-bold">{card.value}</p>
                <p className="text-xs text-muted-foreground">{card.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* GAP-D111: Filtro por plataforma */}
      <div className="flex items-center gap-2">
        <Smartphone className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Filtrar por:</span>
        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Todas as plataformas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="mobile">📱 Mobile</SelectItem>
            <SelectItem value="web">🖥 Web</SelectItem>
            <SelectItem value="desktop">💻 Desktop</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="outline" className="ml-2">
          {platformFilter === 'all' ? 'Geral' : platformFilter}
        </Badge>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Faturamento — Últimos 14 dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{ valor: { label: 'Faturamento', color: 'hsl(var(--primary))' } }} className="h-[220px] w-full">
              <AreaChart data={serie14d}>
                <defs>
                  <linearGradient id="dashFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="data" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="valor" stroke="hsl(var(--primary))" fill="url(#dashFill)" strokeWidth={2} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* GAP-D111: Estatísticas por plataforma */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Monitor className="h-4 w-4 text-primary" /> Distribuição por Plataforma
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{ usuarios: { label: 'Usuários', color: 'hsl(var(--primary))' } }} className="h-[220px] w-full">
              <BarChart data={platformStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="platform" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="users" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" /> Alertas de Estoque
            </CardTitle>
          </CardHeader>
          <CardContent>
            {alertProducts.length === 0 ? (
              <EstadoVazio icone={AlertTriangle} titulo="Nenhum alerta de estoque" descricao="Todos os produtos estão acima do limiar configurado." />
            ) : (
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {alertProducts.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      {p.image_url ? <img src={p.image_url} alt={p.title} className="w-10 h-10 rounded object-cover" loading="lazy" /> : <div className="w-10 h-10 rounded bg-muted" />}
                      <div><p className="text-sm font-medium">{p.title}</p><p className="text-xs text-muted-foreground">{(p.platform || []).join(', ')}</p></div>
                    </div>
                    <Badge variant="outline" className={toneBadge[stockTone(p.stock, p.stock_alert_threshold)]}>
                      {p.stock === 0 ? 'Sem estoque' : `${p.stock} un.`}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Pedidos Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <EstadoVazio icone={ShoppingCart} titulo="Nenhum pedido ainda" descricao="Os pedidos mais recentes da loja aparecem aqui." acao={{ label: 'Ver pedidos', to: '/desktop/pedidos' }} />
            ) : (
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {recentOrders.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div><p className="text-sm font-medium">{p.id.slice(0, 8)}...</p><p className="text-xs text-muted-foreground">{p.cliente} · {p.items} {p.items === 1 ? 'item' : 'itens'}</p></div>
                    <div className="text-right flex items-center gap-3">
                      <Badge className={statusColors[p.status]}>{statusLabels[p.status] || p.status}</Badge>
                      <span className="text-sm font-semibold text-price">{formatCurrency(p.total)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* GAP-D110: Torneios ativos e atividades recentes */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" /> Torneios Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeTournaments.length === 0 ? (
              <EstadoVazio icone={Trophy} titulo="Nenhum torneio ativo" descricao="Crie torneios para engajar a comunidade." />
            ) : (
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {activeTournaments.map(t => (
                  <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="text-sm font-medium">{t.title}</p>
                      <p className="text-xs text-muted-foreground">{t.participants} participantes</p>
                    </div>
                    <Badge variant="outline" className="text-success">
                      {t.status === 'open' ? 'Aberto' : 'Em andamento'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" /> Atividade Recente
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <EstadoVazio icone={Bell} titulo="Nenhuma atividade recente" />
            ) : (
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {recentActivity.map((a, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30">
                    <div className={`p-1.5 rounded-full ${
                      a.type === 'pedido' ? 'bg-primary/10 text-primary' :
                      a.type === 'usuario' ? 'bg-success/10 text-success' :
                      a.type === 'review' ? 'bg-warning/10 text-warning' :
                      a.type === 'torneio' ? 'bg-accent/10 text-accent' :
                      'bg-destructive/10 text-destructive'
                    }`}>
                      {a.type === 'pedido' && <ShoppingCart className="h-3 w-3" />}
                      {a.type === 'usuario' && <Users className="h-3 w-3" />}
                      {a.type === 'review' && <Star className="h-3 w-3" />}
                      {a.type === 'torneio' && <Trophy className="h-3 w-3" />}
                      {a.type === 'denuncia' && <AlertTriangle className="h-3 w-3" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm">{a.message}</p>
                      <p className="text-xs text-muted-foreground">{a.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground pt-2">
        Última atualização: {atualizadoEm ? formatDateTime(atualizadoEm) : '—'}
        {platformFilter !== 'all' && ` · Filtrando por: ${platformFilter}`}
      </p>
    </div>
  );
}

export default function Dashboard() {
  return (
    <QueryErrorBoundary>
      <DashboardContent />
    </QueryErrorBoundary>
  );
}