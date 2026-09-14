// Rodada 19 — painel de métricas administrativas: catálogo, compras simuladas e fórum.
import { useEffect, useMemo, useState, useRef } from 'react';
import {
  Activity, BarChart3, Download, FileText, Gamepad2, Loader2, MessageCircle, ShoppingCart,
  Smartphone, Monitor, ChevronDown, Image
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import EstadoVazio from '@/components/EstadoVazio';
import { formatCurrency, formatDateTime } from '@/lib/format';

const PERIODOS: Record<string, { dias: number; label: string }> = {
  semana: { dias: 7, label: 'Últimos 7 dias' },
  mes: { dias: 30, label: 'Últimos 30 dias' },
  trimestre: { dias: 90, label: 'Últimos 90 dias' },
  ano: { dias: 365, label: 'Últimos 12 meses' },
};

type Serie = { data: string; pedidos: number; receita: number; posts: number };
type LinhaCatalogo = { title: string; categoria: string; preco: number; estoque: number; ativo: boolean };
type LinhaForum = { jogo: string; posts: number; respostas: number; curtidas: number };

const brl = (v: number) => formatCurrency(v);

export default function MetricasPlataforma() {
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState('mes');
  // GAP-D153: Filtro por plataforma
  const [platformFilter, setPlatformFilter] = useState('all');

  const [catalogo, setCatalogo] = useState({ total: 0, ativos: 0, semEstoque: 0, precoMedio: 0, categorias: 0 });
  const [compras, setCompras] = useState({ pedidos: 0, receita: 0, ticket: 0, itens: 0, compradores: 0 });
  const [forum, setForum] = useState({ posts: 0, respostas: 0, curtidas: 0, autores: 0 });
  const [serie, setSerie] = useState<Serie[]>([]);
  const [linhasCatalogo, setLinhasCatalogo] = useState<LinhaCatalogo[]>([]);
  const [linhasForum, setLinhasForum] = useState<LinhaForum[]>([]);
  // GAP-D154: Referência para captura de gráficos
  const chartRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  useEffect(() => {
    const carregar = async () => {
      setLoading(true);
      const dias = PERIODOS[periodo]?.dias ?? 30;
      const desde = new Date(Date.now() - dias * 86400000).toISOString();

      // GAP-D153: Filtrar por plataforma
      let platformQuery = '';
      if (platformFilter !== 'all') {
        // Simulado: em produção, filtraria por plataforma nos pedidos/produtos
        platformQuery = platformFilter;
      }

      const [{ data: produtos }, { data: categorias }, { data: pedidos }, { data: posts }, { data: respostas }] =
        await Promise.all([
          supabase.from('produtos').select('id, title, price, stock, is_active, category_id, platform'),
          supabase.from('categorias').select('id, name'),
          supabase.from('pedidos').select('id, total, status, user_id, created_at').gte('created_at', desde),
          supabase.from('forum_posts').select('id, user_id, product_id, likes_count, created_at').gte('created_at', desde),
          supabase.from('forum_replies').select('id, post_id, created_at').gte('created_at', desde),
        ]);

      // GAP-D153: Filtrar produtos por plataforma
      let prods = produtos || [];
      if (platformFilter !== 'all') {
        prods = prods.filter(p => {
          const platforms = p.platform || [];
          return platforms.some((plat: string) => plat.toLowerCase().includes(platformFilter.toLowerCase()));
        });
      }

      const catMap = new Map<string, string>((categorias || []).map(c => [c.id, c.name] as [string, string]));
      const ativos = prods.filter(p => p.is_active);
      setCatalogo({
        total: prods.length,
        ativos: ativos.length,
        semEstoque: prods.filter(p => (p.stock ?? 0) <= 0).length,
        precoMedio: prods.length ? prods.reduce((s, p) => s + Number(p.price || 0), 0) / prods.length : 0,
        categorias: (categorias || []).length,
      });
      setLinhasCatalogo(
        [...prods]
          .sort((a, b) => Number(b.price || 0) - Number(a.price || 0))
          .slice(0, 25)
          .map(p => ({
            title: p.title,
            categoria: catMap.get(p.category_id as string) || '—',
            preco: Number(p.price || 0),
            estoque: Number(p.stock ?? 0),
            ativo: !!p.is_active,
          })),
      );

      const todos = pedidos || [];
      const validos = todos.filter(p => ['confirmed', 'processing', 'shipped', 'delivered'].includes(p.status));
      const receita = validos.reduce((s, p) => s + Number(p.total || 0), 0);
      const ids = validos.map(p => p.id);
      const { data: itens } = ids.length
        ? await supabase.from('itens_pedido').select('quantity').in('order_id', ids)
        : { data: [] as { quantity: number }[] };
      setCompras({
        pedidos: validos.length,
        receita,
        ticket: validos.length ? receita / validos.length : 0,
        itens: (itens || []).reduce((s, i) => s + Number(i.quantity || 0), 0),
        compradores: new Set(validos.map(p => p.user_id).filter(Boolean)).size,
      });

      const ps = posts || [];
      const rs = respostas || [];
      setForum({
        posts: ps.length,
        respostas: rs.length,
        curtidas: ps.reduce((s, p) => s + Number(p.likes_count || 0), 0),
        autores: new Set(ps.map(p => p.user_id)).size,
      });

      const pidsForum = [...new Set(ps.map(p => p.product_id).filter(Boolean))] as string[];
      const nomeJogo = new Map<string, string>(prods.map(p => [p.id, p.title] as [string, string]));
      const respostasPorPost = new Map<string, number>();
      rs.forEach(r => respostasPorPost.set(r.post_id, (respostasPorPost.get(r.post_id) || 0) + 1));
      setLinhasForum(
        pidsForum
          .map(pid => {
            const doJogo = ps.filter(p => p.product_id === pid);
            return {
              jogo: nomeJogo.get(pid) || 'Jogo removido',
              posts: doJogo.length,
              respostas: doJogo.reduce((s, p) => s + (respostasPorPost.get(p.id) || 0), 0),
              curtidas: doJogo.reduce((s, p) => s + Number(p.likes_count || 0), 0),
            };
          })
          .sort((a, b) => b.posts + b.respostas - (a.posts + a.respostas))
          .slice(0, 25),
      );

      const baldes = new Map<string, Serie>();
      for (let i = dias - 1; i >= 0; i--) {
        const chave = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
        baldes.set(chave, { data: chave, pedidos: 0, receita: 0, posts: 0 });
      }
      validos.forEach(p => {
        const b = baldes.get(String(p.created_at).slice(0, 10));
        if (b) { b.pedidos += 1; b.receita += Number(p.total || 0); }
      });
      ps.forEach(p => {
        const b = baldes.get(String(p.created_at).slice(0, 10));
        if (b) b.posts += 1;
      });
      setSerie([...baldes.values()].map(b => ({ ...b, receita: Number(b.receita.toFixed(2)) })));

      setLoading(false);
    };
    void carregar();
  }, [periodo, platformFilter]);

  const chartConfig = useMemo(() => ({
    receita: { label: 'Receita simulada', color: 'hsl(var(--primary))' },
    pedidos: { label: 'Compras', color: 'hsl(var(--accent))' },
    posts: { label: 'Posts no fórum', color: 'hsl(var(--chart-3))' },
  }), []);

  const baixar = (nome: string, conteudo: string, tipo: string) => {
    const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    a.click();
    URL.revokeObjectURL(url);
  };

  // GAP-D154: Exportar gráfico como imagem
  const exportChartImage = async (chartId: string, title: string) => {
    const element = chartRefs.current[chartId];
    if (!element) {
      toast.error('Gráfico não encontrado');
      return;
    }
    
    try {
      const canvas = await html2canvas(element, {
        backgroundColor: '#0A0E1A',
        scale: 2,
        useCORS: true,
        logging: false,
      });
      
      const link = document.createElement('a');
      link.download = `grafico-${title}-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('Gráfico exportado como PNG');
    } catch (error) {
      toast.error('Erro ao exportar gráfico');
      console.error(error);
    }
  };

  const exportarCSV = () => {
    if (loading) return;
    const linhas: string[] = [];
    linhas.push('Bloco;Métrica;Valor');
    linhas.push(`Catálogo;Produtos cadastrados;${catalogo.total}`);
    linhas.push(`Catálogo;Produtos ativos;${catalogo.ativos}`);
    linhas.push(`Catálogo;Sem estoque;${catalogo.semEstoque}`);
    linhas.push(`Catálogo;Preço médio;${catalogo.precoMedio.toFixed(2)}`);
    linhas.push(`Compras simuladas;Pedidos;${compras.pedidos}`);
    linhas.push(`Compras simuladas;Receita;${compras.receita.toFixed(2)}`);
    linhas.push(`Compras simuladas;Ticket médio;${compras.ticket.toFixed(2)}`);
    linhas.push(`Compras simuladas;Itens vendidos;${compras.itens}`);
    linhas.push(`Fórum;Posts;${forum.posts}`);
    linhas.push(`Fórum;Respostas;${forum.respostas}`);
    linhas.push(`Fórum;Curtidas;${forum.curtidas}`);
    linhas.push('');
    linhas.push('Série diária;Data;Compras;Receita;Posts');
    serie.forEach(s => linhas.push(`;${s.data};${s.pedidos};${s.receita.toFixed(2)};${s.posts}`));
    linhas.push('');
    linhas.push('Catálogo;Produto;Categoria;Preço;Estoque;Ativo');
    linhasCatalogo.forEach(l => linhas.push(`;${l.title};${l.categoria};${l.preco.toFixed(2)};${l.estoque};${l.ativo ? 'Sim' : 'Não'}`));
    linhas.push('');
    linhas.push('Fórum;Jogo;Posts;Respostas;Curtidas');
    linhasForum.forEach(l => linhas.push(`;${l.jogo};${l.posts};${l.respostas};${l.curtidas}`));
    baixar(`metricas-${periodo}-${platformFilter}-${new Date().toISOString().slice(0, 10)}.csv`, `\uFEFF${linhas.join('\n')}`, 'text/csv;charset=utf-8');
    toast.success('CSV exportado');
  };

  const exportarPDF = () => {
    if (loading) return;
    const doc = new jsPDF('landscape');
    doc.setFillColor(20, 184, 166);
    doc.rect(0, 0, 297, 26, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15);
    doc.text('MIDIAS — Métricas da Plataforma', 14, 12);
    doc.setFontSize(9);
    doc.text(`${PERIODOS[periodo].label} · ${platformFilter !== 'all' ? `Plataforma: ${platformFilter}` : 'Geral'} · gerado em ${formatDateTime(Date.now())}`, 14, 19);
    doc.setTextColor(0, 0, 0);

    // Resumo
    autoTable(doc, {
      startY: 32,
      head: [['Indicador', 'Valor']],
      body: [
        ['Produtos cadastrados', String(catalogo.total)],
        ['Produtos ativos', String(catalogo.ativos)],
        ['Produtos sem estoque', String(catalogo.semEstoque)],
        ['Preço médio', brl(catalogo.precoMedio)],
        ['Compras simuladas', String(compras.pedidos)],
        ['Receita simulada', brl(compras.receita)],
        ['Ticket médio', brl(compras.ticket)],
        ['Itens vendidos', String(compras.itens)],
        ['Posts no fórum', String(forum.posts)],
        ['Respostas no fórum', String(forum.respostas)],
        ['Curtidas no fórum', String(forum.curtidas)],
      ],
      headStyles: { fillColor: [20, 184, 166] },
      styles: { fontSize: 9 },
    });

    // Catálogo
    autoTable(doc, {
      head: [['Produto', 'Categoria', 'Preço', 'Estoque', 'Ativo']],
      body: linhasCatalogo.map(l => [l.title, l.categoria, brl(l.preco), String(l.estoque), l.ativo ? 'Sim' : 'Não']),
      headStyles: { fillColor: [168, 85, 247] },
      styles: { fontSize: 8 },
    });

    // Fórum
    autoTable(doc, {
      head: [['Jogo', 'Posts', 'Respostas', 'Curtidas']],
      body: linhasForum.map(l => [l.jogo, String(l.posts), String(l.respostas), String(l.curtidas)]),
      headStyles: { fillColor: [20, 184, 166] },
      styles: { fontSize: 8 },
    });

    const total = doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(`Página ${i} de ${total}`, 280, 195);
    }
    doc.save(`metricas-${periodo}-${platformFilter}-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success('PDF exportado');
  };

  if (loading) {
    return <div className="p-6 flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const kpis = [
    { label: 'Produtos ativos', valor: `${catalogo.ativos}/${catalogo.total}`, sub: `${catalogo.semEstoque} sem estoque`, icon: Gamepad2 },
    { label: 'Compras simuladas', valor: String(compras.pedidos), sub: `${compras.compradores} clientes`, icon: ShoppingCart },
    { label: 'Receita simulada', valor: brl(compras.receita), sub: `Ticket ${brl(compras.ticket)}`, icon: BarChart3 },
    { label: 'Atividade no fórum', valor: String(forum.posts + forum.respostas), sub: `${forum.autores} autores`, icon: MessageCircle },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" /> Métricas da Plataforma
          </h1>
          <p className="text-muted-foreground text-sm">Catálogo, compras simuladas e atividade do fórum em um só lugar</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* GAP-D153: Filtro por plataforma */}
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Plataforma" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">🌐 Todas</SelectItem>
              <SelectItem value="mobile">📱 Mobile</SelectItem>
              <SelectItem value="web">🖥 Web</SelectItem>
              <SelectItem value="desktop">💻 Desktop</SelectItem>
            </SelectContent>
          </Select>
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(PERIODOS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportarCSV}><Download className="h-4 w-4 mr-1" /> CSV</Button>
          <Button size="sm" onClick={exportarPDF}><FileText className="h-4 w-4 mr-1" /> PDF</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(k => (
          <Card key={k.label} className="border-border/50">
            <CardContent className="py-4 px-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><k.icon className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-xl font-bold">{k.valor}</p>
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className="text-[11px] text-muted-foreground/80">{k.sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* GAP-D153: Badge de plataforma ativa */}
      {platformFilter !== 'all' && (
        <Badge className="bg-primary/10 text-primary px-3 py-1">
          {platformFilter === 'mobile' && <Smartphone className="h-3 w-3 mr-1" />}
          {platformFilter === 'web' && <Monitor className="h-3 w-3 mr-1" />}
          {platformFilter === 'desktop' && <Monitor className="h-3 w-3 mr-1" />}
          Filtrando por: {platformFilter}
        </Badge>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/50">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Receita simulada por dia</CardTitle>
            {/* GAP-D154: Exportar gráfico */}
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 text-xs"
              onClick={() => exportChartImage('chart-receita', 'receita')}
            >
              <Image className="h-3 w-3 mr-1" /> PNG
            </Button>
          </CardHeader>
          <CardContent>
            <div ref={(el) => chartRefs.current['chart-receita'] = el}>
              <ChartContainer config={chartConfig} className="h-[260px] w-full">
                <AreaChart data={serie}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis dataKey="data" tickFormatter={v => String(v).slice(5)} fontSize={11} />
                  <YAxis fontSize={11} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area type="monotone" dataKey="receita" stroke="var(--color-receita)" fill="var(--color-receita)" fillOpacity={0.2} />
                </AreaChart>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Compras x posts no fórum</CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 text-xs"
              onClick={() => exportChartImage('chart-compras', 'compras-posts')}
            >
              <Image className="h-3 w-3 mr-1" /> PNG
            </Button>
          </CardHeader>
          <CardContent>
            <div ref={(el) => chartRefs.current['chart-compras'] = el}>
              <ChartContainer config={chartConfig} className="h-[240px] w-full">
                <BarChart data={serie}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis dataKey="data" tickFormatter={v => String(v).slice(5)} fontSize={11} />
                  <YAxis fontSize={11} allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="pedidos" fill="var(--color-pedidos)" radius={3} />
                  <Bar dataKey="posts" fill="var(--color-posts)" radius={3} />
                </BarChart>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="catalogo">
        <TabsList>
          <TabsTrigger value="catalogo">Catálogo</TabsTrigger>
          <TabsTrigger value="forum">Fórum por jogo</TabsTrigger>
        </TabsList>

        <TabsContent value="catalogo">
          <Card className="border-border/50">
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow className="border-border">
                  <TableHead>Produto</TableHead><TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                  <TableHead className="text-center">Estoque</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {linhasCatalogo.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="p-0"><EstadoVazio titulo="Nenhum produto cadastrado" /></TableCell></TableRow>
                  ) : linhasCatalogo.map(l => (
                    <TableRow key={l.title} className="border-border">
                      <TableCell className="font-medium">{l.title}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{l.categoria}</TableCell>
                      <TableCell className="text-right">{brl(l.preco)}</TableCell>
                      <TableCell className="text-center">{l.estoque}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={l.ativo ? 'secondary' : 'outline'}>{l.ativo ? 'Ativo' : 'Inativo'}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="forum">
          <Card className="border-border/50">
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow className="border-border">
                  <TableHead>Jogo</TableHead>
                  <TableHead className="text-center">Posts</TableHead>
                  <TableHead className="text-center">Respostas</TableHead>
                  <TableHead className="text-center">Curtidas</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {linhasForum.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="p-0"><EstadoVazio titulo="Sem atividade no período" /></TableCell></TableRow>
                  ) : linhasForum.map(l => (
                    <TableRow key={l.jogo} className="border-border">
                      <TableCell className="font-medium">{l.jogo}</TableCell>
                      <TableCell className="text-center">{l.posts}</TableCell>
                      <TableCell className="text-center">{l.respostas}</TableCell>
                      <TableCell className="text-center">{l.curtidas}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground">
        {platformFilter !== 'all' ? `📊 Dados filtrados por: ${platformFilter}` : '📊 Dados gerais da plataforma'}
        · Período: {PERIODOS[periodo].label}
      </p>
    </div>
  );
}