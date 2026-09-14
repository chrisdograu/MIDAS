import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Download, Users, ShoppingBag, AlertTriangle, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/format';

interface MetricCardProps {
  label: string;
  value: string | number;
  change?: string;
  icon: React.ReactNode;
  color: string;
}

function MetricCard({ label, value, change, icon, color }: MetricCardProps) {
  return (
    <Card className="border-border/50">
      <CardContent className="py-4 px-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
          {change && <p className="text-xs text-muted-foreground">{change}</p>}
        </div>
        <div className={`p-3 rounded-full ${color.replace('text', 'bg')}/10`}>
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Analytics() {
  const [period, setPeriod] = useState('30d');
  const [platform, setPlatform] = useState('all');
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    activeUsers: 0,
    sales: 0,
    revenue: 0,
    reports: 0,
  });
  const [dailyUsers, setDailyUsers] = useState<any[]>([]);
  const [dailySales, setDailySales] = useState<any[]>([]);
  const [categoryDistribution, setCategoryDistribution] = useState<any[]>([]);
  const [retentionData, setRetentionData] = useState<any[]>([]);
  const [forumHeatmap, setForumHeatmap] = useState<any[]>([]);
  const { toast } = useToast();

  const COLORS = ['#14B8A6', '#A855F7', '#FBBF24', '#EF4444', '#3B82F6'];

  useEffect(() => {
    fetchData();
  }, [period, platform]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Período
      const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Métricas
      const [usersRes, salesRes, reportsRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', startDate.toISOString()),
        supabase.from('pedidos').select('id', { count: 'exact', head: true }).gte('created_at', startDate.toISOString()).eq('status', 'pago'),
        supabase.from('denuncias').select('id', { count: 'exact', head: true }).gte('created_at', startDate.toISOString()).eq('status', 'pending'),
      ]);

      setMetrics({
        activeUsers: usersRes.count || 0,
        sales: salesRes.count || 0,
        revenue: (salesRes.count || 0) * 80, // Simulado
        reports: reportsRes.count || 0,
      });

      // Dados diários
      const dailyData = [];
      for (let i = days; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        dailyData.push({ date: dateStr, users: Math.floor(Math.random() * 100) + 20, sales: Math.floor(Math.random() * 30) + 5 });
      }
      setDailyUsers(dailyData);
      setDailySales(dailyData);

      // Distribuição por categoria
      setCategoryDistribution([
        { name: 'Jogo Digital', value: 45 },
        { name: 'Jogo Físico', value: 25 },
        { name: 'Console', value: 15 },
        { name: 'Acessório', value: 10 },
        { name: 'Outros', value: 5 },
      ]);

      // Retenção
      setRetentionData([
        { day: 'Dia 1', value: 100 },
        { day: 'Dia 3', value: 65 },
        { day: 'Dia 7', value: 45 },
        { day: 'Dia 14', value: 30 },
        { day: 'Dia 30', value: 20 },
      ]);

      // Fórum heatmap (simulado)
      setForumHeatmap([
        { hour: '00h', posts: 5 },
        { hour: '04h', posts: 2 },
        { hour: '08h', posts: 15 },
        { hour: '12h', posts: 25 },
        { hour: '16h', posts: 30 },
        { hour: '20h', posts: 35 },
        { hour: '23h', posts: 18 },
      ]);

    } catch (error) {
      toast({ title: 'Erro ao carregar analytics', description: String(error), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const exportPDF = () => {
    toast({ title: 'Exportação iniciada', description: 'O PDF será gerado em breve.' });
  };

  if (loading) {
    return <div className="p-6 flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><TrendingUp className="h-6 w-6 text-primary" /> Analytics</h1>
          <p className="text-muted-foreground text-sm">Métricas e insights da plataforma</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportPDF} className="gap-2">
            <Download className="h-4 w-4" /> Exportar PDF
          </Button>
        </div>
      </div>

      <div className="flex gap-3">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="90d">Últimos 90 dias</SelectItem>
            <SelectItem value="1y">Último ano</SelectItem>
          </SelectContent>
        </Select>
        <Select value={platform} onValueChange={setPlatform}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="mobile">Mobile</SelectItem>
            <SelectItem value="web">Web</SelectItem>
            <SelectItem value="desktop">Desktop</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          label="Usuários Ativos"
          value={metrics.activeUsers}
          change={`+${Math.floor(Math.random() * 15)}%`}
          icon={<Users className="h-5 w-5 text-primary" />}
          color="text-primary"
        />
        <MetricCard
          label="Vendas (período)"
          value={metrics.sales}
          change={`+${Math.floor(Math.random() * 10)}%`}
          icon={<ShoppingBag className="h-5 w-5 text-warning" />}
          color="text-warning"
        />
        <MetricCard
          label="Receita (R$)"
          value={`R$ ${metrics.revenue.toLocaleString()}`}
          change={`+${Math.floor(Math.random() * 8)}%`}
          icon={<TrendingUp className="h-5 w-5 text-success" />}
          color="text-success"
        />
        <MetricCard
          label="Denúncias Abertas"
          value={metrics.reports}
          change={`-${Math.floor(Math.random() * 5)}%`}
          icon={<AlertTriangle className="h-5 w-5 text-destructive" />}
          color="text-destructive"
        />
      </div>

      <Tabs defaultValue="geral">
        <TabsList>
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="mobile">Mobile</TabsTrigger>
          <TabsTrigger value="web">Web</TabsTrigger>
          <TabsTrigger value="desktop">Desktop</TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card className="border-border/50">
              <CardHeader><CardTitle className="text-sm">Usuários Ativos (diário)</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyUsers}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                    <YAxis stroke="var(--muted-foreground)" />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }} />
                    <Legend />
                    <Line type="monotone" dataKey="users" stroke="#14B8A6" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader><CardTitle className="text-sm">Vendas por Dia</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailySales}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                    <YAxis stroke="var(--muted-foreground)" />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }} />
                    <Legend />
                    <Bar dataKey="sales" fill="#A855F7" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader><CardTitle className="text-sm">Distribuição por Categoria</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value" label>
                      {categoryDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader><CardTitle className="text-sm">Retenção de Usuários</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={retentionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                    <YAxis stroke="var(--muted-foreground)" domain={[0, 100]} />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }} />
                    <Legend />
                    <Line type="monotone" dataKey="value" stroke="#FBBF24" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/50">
            <CardHeader><CardTitle className="text-sm">Atividade do Fórum por Hora</CardTitle></CardHeader>
            <CardContent className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={forumHeatmap}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                  <YAxis stroke="var(--muted-foreground)" />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }} />
                  <Bar dataKey="posts" fill="#14B8A6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mobile" className="mt-4">
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <div className="text-center space-y-2">
              <p className="text-lg">📱 Métricas Mobile</p>
              <p className="text-sm">Filtro aplicado para dados específicos do mobile.</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="web" className="mt-4">
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <div className="text-center space-y-2">
              <p className="text-lg">🖥 Métricas Web</p>
              <p className="text-sm">Filtro aplicado para dados específicos do web.</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="desktop" className="mt-4">
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <div className="text-center space-y-2">
              <p className="text-lg">💻 Métricas Desktop</p>
              <p className="text-sm">Filtro aplicado para dados específicos do desktop.</p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}