import { useState, useEffect, useMemo } from 'react';
import { Lightbulb, Check, X, Loader2, ExternalLink, Search, Download, ChevronLeft, ChevronRight, Calendar, Filter } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useDesktopAuth } from '@/hooks/useDesktopAuth';
import { ProdutoFormFields } from '../components/ProdutoFormFields';
import EstadoVazio from '@/components/EstadoVazio';
import { formatDate, formatDateTime } from '@/lib/format';
import { adminLog } from '../lib/adminLog';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';

type Status = 'pendente' | 'aprovado' | 'rejeitado';

interface Suggestion {
  id: string;
  title: string;
  cover_url: string | null;
  description: string | null;
  status: Status;
  admin_notes: string | null;
  created_product_id: string | null;
  created_at: string;
  requested_by: string;
  author_name: string;
}

const ITEMS_PER_PAGE = 20;

export default function SugestoesJogos() {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'todas' | Status>('pendente');
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [approveOpen, setApproveOpen] = useState<Suggestion | null>(null);
  const [rejectOpen, setRejectOpen] = useState<Suggestion | null>(null);
  const [form, setForm] = useState({ title: '', cover_url: '', description: '', price: '0', publisher: '', admin_notes: '' });
  const [adminNotes, setAdminNotes] = useState('');
  const [basics, setBasics] = useState({ platform: [] as string[], category_id: '' });
  const [categoryName, setCategoryName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();
  const { user } = useDesktopAuth();

  const fetchAll = async (reset: boolean = true) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);

    const currentPage = reset ? 0 : page;
    const from = currentPage * ITEMS_PER_PAGE;

    try {
      let query = supabase
        .from('game_suggestions')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (filter !== 'todas') {
        query = query.eq('status', filter);
      }

      if (dateFilter === 'today') {
        const today = new Date().toISOString().slice(0, 10);
        query = query.gte('created_at', today);
      } else if (dateFilter === 'week') {
        const week = new Date();
        week.setDate(week.getDate() - 7);
        query = query.gte('created_at', week.toISOString());
      } else if (dateFilter === 'month') {
        const month = new Date();
        month.setDate(month.getDate() - 30);
        query = query.gte('created_at', month.toISOString());
      }

      const { data, error, count } = await query.range(from, from + ITEMS_PER_PAGE - 1);
      if (error) throw error;
      if (!data) {
        if (reset) setLoading(false);
        else setLoadingMore(false);
        return;
      }

      const userIds = [...new Set(data.map(s => s.requested_by))];
      const { data: profiles } = await supabase.from('profiles').select('id, display_name').in('id', userIds);
      const pm = new Map((profiles || []).map(p => [p.id, p.display_name || 'Usuário']));

      const processed = data.map(s => ({ 
        ...s, 
        author_name: pm.get(s.requested_by) || 'Usuário' 
      } as Suggestion));

      if (reset) {
        setItems(processed);
        setHasMore((data || []).length === ITEMS_PER_PAGE);
        setPage(1);
      } else {
        setItems(prev => [...prev, ...processed]);
        setHasMore((data || []).length === ITEMS_PER_PAGE);
        setPage(currentPage + 1);
      }
    } catch (error) {
      toast({ title: 'Erro ao carregar sugestões', variant: 'destructive' });
    } finally {
      if (reset) setLoading(false);
      else setLoadingMore(false);
    }
  };

  useEffect(() => { fetchAll(true); }, [filter, dateFilter]);

  // GAP-D261: Realtime
  useRealtimeRefresh(['game_suggestions'], () => fetchAll(true), 'admin-sugestoes');

  // GAP-D262: Notificação ao usuário
  const notifyUser = async (userId: string, title: string, body: string, refType: string, refId: string) => {
    if (!userId) return;
    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'system',
      title,
      body,
      reference_type: refType,
      reference_id: refId,
    });
  };

  const openApprove = (s: Suggestion) => {
    setApproveOpen(s);
    setBasics({ platform: [], category_id: '' });
    setCategoryName(null);
    setForm({
      title: s.title,
      cover_url: s.cover_url || '',
      description: s.description || '',
      price: '0',
      publisher: '',
      admin_notes: '',
    });
  };

  // GAP-D261: adminLog e GAP-D262: Notificação
  const handleApprove = async () => {
    if (!approveOpen || !user) return;
    if (!form.title.trim()) { toast({ title: 'Título obrigatório', variant: 'destructive' }); return; }
    if (basics.platform.length === 0) { toast({ title: 'Plataforma obrigatória', description: 'Sem plataforma o jogo não aparece nos filtros da loja.', variant: 'destructive' }); return; }
    setSaving(true);
    
    const { data: prod, error: prodError } = await supabase.from('produtos').insert({
      title: form.title.trim(),
      description: form.description.trim() || null,
      image_url: form.cover_url.trim() || null,
      publisher: form.publisher.trim() || null,
      price: Number(form.price) || 0,
      original_price: Number(form.price) || 0,
      stock: 0,
      is_active: true,
      awaiting_first_stock: true,
      featured: false,
      product_type: 'digital',
      platform: basics.platform,
      category_id: basics.category_id || null,
      category: categoryName,
    }).select('id').single();
    
    if (prodError || !prod) {
      setSaving(false);
      toast({ title: 'Erro ao criar produto', description: prodError?.message, variant: 'destructive' });
      return;
    }

    const { error } = await supabase.from('game_suggestions').update({
      status: 'aprovado',
      created_product_id: prod.id,
      admin_notes: form.admin_notes.trim() || null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', approveOpen.id);
    
    setSaving(false);
    if (error) { toast({ title: 'Erro ao aprovar', description: error.message, variant: 'destructive' }); return; }

    // GAP-D261: adminLog
    await adminLog({
      action: 'approve_game_suggestion',
      entity: 'game_suggestions',
      entity_id: approveOpen.id,
      reason: `Sugestão "${approveOpen.title}" aprovada e produto criado`,
      payload: { 
        suggestion: approveOpen.title, 
        product_id: prod.id,
        platform: basics.platform,
        category: categoryName
      }
    });

    // GAP-D262: Notificar usuário
    await notifyUser(
      approveOpen.requested_by,
      '✅ Sua sugestão foi aprovada!',
      `O jogo "${approveOpen.title}" que você sugeriu foi adicionado ao catálogo MIDIAS!`,
      'produto',
      prod.id
    );

    toast({ title: '✅ Sugestão aprovada', description: 'Produto criado e usuário notificado.' });
    setApproveOpen(null);
    fetchAll(true);
  };

  // GAP-D261: adminLog e GAP-D262: Notificação
  const handleReject = async () => {
    if (!rejectOpen || !user) return;
    setSaving(true);
    
    const { error } = await supabase.from('game_suggestions').update({
      status: 'rejeitado',
      admin_notes: adminNotes.trim() || null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', rejectOpen.id);
    
    setSaving(false);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }

    // GAP-D261: adminLog
    await adminLog({
      action: 'reject_game_suggestion',
      entity: 'game_suggestions',
      entity_id: rejectOpen.id,
      reason: `Sugestão "${rejectOpen.title}" rejeitada`,
      payload: { suggestion: rejectOpen.title, reason: adminNotes.trim() || 'Sem motivo informado' }
    });

    // GAP-D262: Notificar usuário
    await notifyUser(
      rejectOpen.requested_by,
      '❌ Sua sugestão foi rejeitada',
      `Infelizmente a sugestão "${rejectOpen.title}" não foi aprovada. ${adminNotes.trim() ? `Motivo: ${adminNotes.trim()}` : ''}`,
      'game_suggestion',
      rejectOpen.id
    );

    toast({ title: 'Sugestão rejeitada', description: 'Usuário notificado.' });
    setRejectOpen(null); setAdminNotes('');
    fetchAll(true);
  };

  // GAP-D264: Exportar CSV
  const exportCSV = () => {
    setExporting(true);
    const data = visible.map(s => ({
      Título: s.title,
      Autor: s.author_name,
      Descrição: s.description || '',
      Status: s.status,
      'Notas do Admin': s.admin_notes || '',
      Data: formatDateTime(s.created_at),
      'Produto Criado': s.created_product_id || 'Não',
    }));

    const headers = Object.keys(data[0] || {});
    const csvRows = [
      headers.join(','),
      ...data.map(row => headers.map(h => {
        const val = (row as any)[h] || '';
        return typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val;
      }).join(','))
    ];

    const csv = csvRows.join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sugestoes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
    toast({ title: 'CSV exportado com sucesso' });
  };

  const visible = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter(i => {
      const matchSearch = i.title.toLowerCase().includes(q) || 
                          i.author_name.toLowerCase().includes(q) ||
                          (i.description || '').toLowerCase().includes(q);
      const matchFilter = filter === 'todas' || i.status === filter;
      return matchSearch && matchFilter;
    });
  }, [items, search, filter]);

  const stats = {
    pendente: items.filter(i => i.status === 'pendente').length,
    aprovado: items.filter(i => i.status === 'aprovado').length,
    rejeitado: items.filter(i => i.status === 'rejeitado').length,
  };

  const totalPages = Math.ceil(visible.length / ITEMS_PER_PAGE);
  const paginated = visible.slice(0, (page + 1) * ITEMS_PER_PAGE);

  if (loading) return <div className="p-6 flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Lightbulb className="h-6 w-6 text-primary" /> Sugestões da Comunidade</h1>
          <p className="text-muted-foreground text-sm">Jogos sugeridos pelos usuários para serem adicionados ao catálogo</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV} disabled={exporting}>
            <Download className="h-4 w-4 mr-1" />
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Exportar CSV'}
          </Button>
        </div>
      </div>

      {/* Cards de status */}
      <div className="grid grid-cols-3 gap-4">
        {([
          { key: 'pendente', label: 'Pendentes', value: stats.pendente, color: 'text-warning', bg: 'bg-warning/10' },
          { key: 'aprovado', label: 'Aprovadas', value: stats.aprovado, color: 'text-success', bg: 'bg-success/10' },
          { key: 'rejeitado', label: 'Rejeitadas', value: stats.rejeitado, color: 'text-destructive', bg: 'bg-destructive/10' },
        ] as const).map(s => (
          <Card key={s.key} className={`border-border/50 cursor-pointer hover:border-primary/30 transition-colors ${filter === s.key ? 'border-primary/50 bg-primary/5' : ''}`} onClick={() => setFilter(s.key)}>
            <CardContent className="py-4 px-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${s.bg}`}><Lightbulb className={`h-5 w-5 ${s.color}`} /></div>
              <div><p className="text-2xl font-bold">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <Card className="border-border/50">
        <CardContent className="py-3 px-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar título ou autor..." 
              className="pl-9" 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
          </div>
          <div className="flex items-center gap-2">
            {(['pendente', 'aprovado', 'rejeitado', 'todas'] as const).map(f => (
              <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f)}>
                {f === 'todas' ? 'Todas' : f.charAt(0).toUpperCase() + f.slice(1) + 's'}
              </Button>
            ))}
          </div>
          {/* GAP-D265: Filtro por data */}
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-36">
              <Calendar className="h-3 w-3 mr-1" />
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="week">Última semana</SelectItem>
              <SelectItem value="month">Último mês</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setFilter('todas'); setDateFilter('all'); }}>
            Limpar
          </Button>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card className="border-border/50">
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow className="border-border">
              <TableHead>Capa</TableHead><TableHead>Título</TableHead><TableHead>Autor</TableHead>
              <TableHead className="max-w-[200px]">Descrição</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data</TableHead>
              {/* GAP-D266: admin_notes visível */}
              <TableHead className="max-w-[150px]">Notas do Admin</TableHead>
              <TableHead className="text-center w-32">Ações</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="p-0"><EstadoVazio titulo="Nenhuma sugestão encontrada" /></TableCell></TableRow>
              ) : paginated.map(s => (
                <TableRow key={s.id} className="border-border hover:bg-muted/30">
                  <TableCell>
                    {s.cover_url ? (
                      <img src={s.cover_url} alt="" className="w-12 h-16 object-cover rounded" loading="lazy" />
                    ) : <div className="w-12 h-16 bg-muted rounded" />}
                  </TableCell>
                  <TableCell className="font-medium">{s.title}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.author_name}</TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate">{s.description || '—'}</TableCell>
                  <TableCell>
                    <Badge variant={s.status === 'pendente' ? 'secondary' : s.status === 'aprovado' ? 'default' : 'destructive'}>
                      {s.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(s.created_at)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                    {s.admin_notes || '—'}
                  </TableCell>
                  <TableCell className="text-center">
                    {s.status === 'pendente' ? (
                      <div className="flex gap-1 justify-center">
                        <Button size="sm" variant="default" className="h-7 px-2" onClick={() => openApprove(s)}>
                          <Check className="h-3 w-3 mr-1" />Aprovar
                        </Button>
                        <Button size="sm" variant="destructive" className="h-7 px-2" onClick={() => setRejectOpen(s)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : s.status === 'aprovado' && s.created_product_id ? (
                      <a href={`/jogo/${s.created_product_id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                        Ver produto <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* GAP-D260: Paginação */}
      {visible.length > ITEMS_PER_PAGE && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Mostrando {Math.min((page + 1) * ITEMS_PER_PAGE, visible.length)} de {visible.length}
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs flex items-center px-2">{page + 1} / {totalPages || 1}</span>
            <Button variant="outline" size="sm" disabled={!hasMore || (page + 1) * ITEMS_PER_PAGE >= visible.length} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Approve dialog */}
      <Dialog open={!!approveOpen} onOpenChange={(o) => !o && setApproveOpen(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Aprovar e criar produto</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>URL da capa</Label><Input value={form.cover_url} onChange={e => setForm({ ...form, cover_url: e.target.value })} placeholder="https://..." /></div>
            <div><Label>Publisher</Label><Input value={form.publisher} onChange={e => setForm({ ...form, publisher: e.target.value })} /></div>
            <div><Label>Preço inicial (R$)</Label><Input type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /></div>
            <div><Label>Descrição</Label><Textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <ProdutoFormFields value={basics} onChange={setBasics} onCategoryName={setCategoryName} />
            <div>
              <Label>Motivo da aprovação (opcional, será mostrado ao usuário)</Label>
              <Textarea rows={2} value={form.admin_notes} onChange={e => setForm({ ...form, admin_notes: e.target.value })} placeholder="Ex.: ótima sugestão, já adicionado!" />
            </div>
            <p className="text-xs text-muted-foreground">O produto será criado oculto da loja até receber o primeiro estoque. Ajuste em Estoque/Produtos.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(null)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleApprove} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Aprovar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={!!rejectOpen} onOpenChange={(o) => !o && setRejectOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rejeitar sugestão</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">"{rejectOpen?.title}"</p>
            <div>
              <Label>Motivo (opcional, será mostrado ao usuário)</Label>
              <Textarea rows={3} value={adminNotes} onChange={e => setAdminNotes(e.target.value)} placeholder="Ex.: já existe no catálogo, título inválido..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(null)} disabled={saving}>Cancelar</Button>
            <Button variant="destructive" onClick={handleReject} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Rejeitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}