import { useState, useEffect, useMemo } from 'react';
import { Megaphone, Eye, Ban, Search, Filter, Loader2, Settings, Check, X, EyeOff, Download, ChevronLeft, ChevronRight, Edit, ExternalLink, ShieldCheck, AlertCircle, Square, CheckSquare } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { anuncioStatusLabels, anuncioStatusColors } from '../mockData';
import EstadoVazio from '@/components/EstadoVazio';
import { formatCurrency, formatDate } from '@/lib/format';
import { adminLog } from '../lib/adminLog';

interface Anuncio {
  id: string; title: string; game_title: string; platform: string; price: number;
  ad_type: string; status: string; created_at: string; seller_name: string; fotos: number;
  is_certified?: boolean; is_denunciado?: boolean;
}

const PAGE_SIZE = 50;

export default function AnunciosAdmin() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [search, setSearch] = useState('');
  const [anuncios, setAnuncios] = useState<Anuncio[]>([]);
  const [loading, setLoading] = useState(true);
  const [adLimit, setAdLimit] = useState<number>(5);
  const [savingLimit, setSavingLimit] = useState(false);
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Anuncio | null>(null);
  const [editForm, setEditForm] = useState({ title: '', price: '', description: '' });
  const [pendingAction, setPendingAction] = useState<{ id: string; action: 'hide' | 'approve' | 'flag' | 'delete'; label: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchAction, setBatchAction] = useState<'hide' | 'flag' | 'delete' | null>(null);
  const [viewingAd, setViewingAd] = useState<Anuncio | null>(null);
  const [denunciasMap, setDenunciasMap] = useState<Map<string, number>>(new Map());
  const [certifiedMap, setCertifiedMap] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const fetchAnuncios = async () => {
    setLoading(true);
    
    // Config
    const { data: setting } = await supabase.from('site_settings').select('value').eq('key', 'max_active_ads_uncertified').maybeSingle();
    if (setting?.value !== undefined && setting?.value !== null) setAdLimit(Number(setting.value) || 5);
    
    // Anúncios
    const { data } = await supabase.from('anuncios').select('*').order('created_at', { ascending: false }).limit(2000);
    if (!data) { setLoading(false); return; }

    const sellerIds = [...new Set(data.map(a => a.seller_id))];
    const adIds = data.map(a => a.id);

    // Profiles
    const { data: profiles } = await supabase.from('profiles').select('id, display_name').in('id', sellerIds);
    const profileMap = new Map<string, string>(profiles?.map(p => [p.id, p.display_name || 'Vendedor']) || []);

    // Fotos
    const { data: fotos } = await supabase.from('fotos_anuncio').select('anuncio_id').in('anuncio_id', adIds);
    const fotoCount = new Map<string, number>();
    fotos?.forEach(f => fotoCount.set(f.anuncio_id, (fotoCount.get(f.anuncio_id) || 0) + 1));

    // GAP-D26: Certificados
    const { data: certs } = await supabase.from('certificados').select('user_id').eq('status', 'active').in('user_id', sellerIds);
    const certifiedSet = new Set(certs?.map(c => c.user_id) || []);
    setCertifiedMap(certifiedSet);

    // GAP-D24: Denúncias
    const { data: denuncias } = adIds.length
      ? await supabase.from('denuncias').select('entity_id').eq('entity_type', 'anuncio').in('entity_id', adIds)
      : { data: [] as any[] };
    const denMap = new Map<string, number>();
    denuncias?.forEach(d => denMap.set(d.entity_id, (denMap.get(d.entity_id) || 0) + 1));
    setDenunciasMap(denMap);

    setAnuncios(data.map(a => ({
      id: a.id, title: a.title, game_title: a.game_title, platform: a.platform,
      price: Number(a.price), ad_type: a.ad_type, status: a.status, created_at: a.created_at,
      seller_name: profileMap.get(a.seller_id) || 'Vendedor',
      fotos: fotoCount.get(a.id) || 0,
      is_certified: certifiedSet.has(a.seller_id),
      is_denunciado: (denMap.get(a.id) || 0) > 0,
    })));
    setLoading(false);
    setPage(0);
    setSelectedIds(new Set());
  };

  useEffect(() => { fetchAnuncios(); }, []);

  // GAP-D19: Paginação
  const filteredAnuncios = useMemo(() => {
    const q = search.trim().toLowerCase();
    return anuncios.filter(a => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (typeFilter !== 'all' && a.ad_type !== typeFilter) return false;
      if (q && ![
        a.title, a.game_title, a.seller_name, a.platform,
      ].some(value => (value || '').toLowerCase().includes(q))) return false;
      return true;
    }).sort((a, b) => {
      if (sortBy === 'recent') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === 'price_high') return b.price - a.price;
      if (sortBy === 'price_low') return a.price - b.price;
      return 0;
    });
  }, [anuncios, search, statusFilter, typeFilter, sortBy]);

  const paginatedAnuncios = filteredAnuncios.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filteredAnuncios.length / PAGE_SIZE);

  // GAP-D20: adminLog + ações
  const updateStatus = async (id: string, newStatus: string, reason?: string) => {
    const ad = anuncios.find(a => a.id === id);
    if (!ad) return;
    
    setLoading(true);
    const { error } = await supabase.from('anuncios').update({ status: newStatus }).eq('id', id);
    setLoading(false);
    
    if (error) {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
      return;
    }
    
    await adminLog({
      action: `anuncio_${newStatus}`,
      entity: 'anuncios',
      entity_id: id,
      reason,
      payload: { status_anterior: ad.status, status_novo: newStatus, titulo: ad.title },
    });
    
    toast({ title: `Anúncio ${newStatus === 'active' ? 'aprovado' : newStatus === 'hidden' ? 'ocultado' : newStatus === 'flagged' ? 'sinalizado' : 'removido'}` });
    fetchAnuncios();
  };

  // GAP-D18: Edição
  const handleEdit = async () => {
    if (!editing) return;
    setLoading(true);
    const { error } = await supabase
      .from('anuncios')
      .update({
        title: editForm.title,
        price: Number(editForm.price),
        description: editForm.description || null,
      })
      .eq('id', editing.id);
    setLoading(false);
    
    if (error) {
      toast({ title: 'Erro ao editar', description: error.message, variant: 'destructive' });
      return;
    }
    
    await adminLog({
      action: 'editar_anuncio',
      entity: 'anuncios',
      entity_id: editing.id,
      payload: { antes: { title: editing.title, price: editing.price }, depois: { title: editForm.title, price: editForm.price } },
    });
    
    toast({ title: 'Anúncio atualizado' });
    setEditing(null);
    fetchAnuncios();
  };

  // GAP-D25: Ação em massa
  const handleBatchAction = async () => {
    if (!batchAction || selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const statusMap: Record<string, string> = { hide: 'hidden', flag: 'flagged', delete: 'removed' };
    const newStatus = statusMap[batchAction];
    
    setLoading(true);
    const { error } = await supabase.from('anuncios').update({ status: newStatus }).in('id', ids);
    setLoading(false);
    
    if (error) {
      toast({ title: 'Erro na ação em massa', description: error.message, variant: 'destructive' });
      return;
    }
    
    await adminLog({
      action: `batch_${batchAction}_anuncios`,
      entity: 'anuncios',
      entity_id: ids.join(','),
      payload: { quantidade: ids.length, status_novo: newStatus },
    });
    
    toast({ title: `${ids.length} anúncios ${batchAction === 'hide' ? 'ocultados' : batchAction === 'flag' ? 'sinalizados' : 'removidos'}` });
    setBatchAction(null);
    setSelectedIds(new Set());
    fetchAnuncios();
  };

  // GAP-D23: Exportar CSV
  const exportCSV = () => {
    const headers = ['Título', 'Jogo', 'Vendedor', 'Plataforma', 'Preço', 'Tipo', 'Status', 'Data'];
    const rows = filteredAnuncios.map(a => [
      a.title,
      a.game_title,
      a.seller_name,
      a.platform,
      String(a.price),
      a.ad_type === 'venda' ? 'Venda' : 'Troca',
      anuncioStatusLabels[a.status] || a.status,
      formatDate(a.created_at),
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    // BOM UTF-8 para Excel brasileiro reconhecer acentos
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `anuncios_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'CSV exportado' });
  };

  const saveAdLimit = async () => {
    setSavingLimit(true);
    const { error } = await supabase.from('site_settings').upsert({
      key: 'max_active_ads_uncertified', value: adLimit as any,
    }, { onConflict: 'key' });
    setSavingLimit(false);
    if (error) toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    else toast({ title: `Limite atualizado para ${adLimit} anúncios` });
  };

  const counts = {
    active: anuncios.filter(a => a.status === 'active').length,
    flagged: anuncios.filter(a => a.status === 'flagged').length,
    removed: anuncios.filter(a => a.status === 'removed').length,
    sold: anuncios.filter(a => a.status === 'sold' || a.status === 'traded').length,
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedAnuncios.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedAnuncios.map(a => a.id)));
    }
  };

  if (loading && anuncios.length === 0) {
    return <div className="p-6 flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Megaphone className="h-6 w-6 text-primary" /> Anúncios do Marketplace</h1>
          <p className="text-muted-foreground text-sm">Gestão dos anúncios criados por usuários</p>
        </div>
        <Button variant="outline" onClick={exportCSV} className="gap-2">
          <Download className="h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      <Card className="border-border/50">
        <CardContent className="py-4 px-4 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            <div>
              <p className="font-semibold text-sm">Limite de anúncios ativos (vendedor sem certificação)</p>
              <p className="text-xs text-muted-foreground">Vendedores com certificação aprovada não têm limite.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Label className="text-xs">Máx</Label>
            <Input type="number" min={1} max={100} value={adLimit} onChange={e => setAdLimit(Number(e.target.value) || 1)} className="w-20" />
            <Button size="sm" onClick={saveAdLimit} disabled={savingLimit}>
              {savingLimit ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Salvar'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Ativos', value: counts.active, color: 'text-success' },
          { label: 'Sinalizados', value: counts.flagged, color: 'text-warning' },
          { label: 'Removidos', value: counts.removed, color: 'text-destructive' },
          { label: 'Vendidos/Trocados', value: counts.sold, color: 'text-primary' },
        ].map(s => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="py-4 px-4"><p className={`text-2xl font-bold ${s.color}`}>{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[260px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por título, jogo, vendedor ou plataforma..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><Filter className="h-4 w-4 mr-2" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="flagged">Sinalizados</SelectItem>
            <SelectItem value="hidden">Ocultos</SelectItem>
            <SelectItem value="removed">Removidos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="venda">Venda</SelectItem>
            <SelectItem value="troca">Troca</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Mais recentes</SelectItem>
            <SelectItem value="price_high">Maior preço</SelectItem>
            <SelectItem value="price_low">Menor preço</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* GAP-D25: Ações em massa */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
          <span className="text-sm font-semibold">{selectedIds.size} selecionados</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => setBatchAction('hide')}>Ocultar</Button>
            <Button variant="outline" size="sm" onClick={() => setBatchAction('flag')}>Sinalizar</Button>
            <Button variant="destructive" size="sm" onClick={() => setBatchAction('delete')}>Remover</Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>Limpar</Button>
          </div>
        </div>
      )}

      <Card className="border-border/50">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="w-8">
                  <button onClick={toggleSelectAll} className="text-muted-foreground">
                    {selectedIds.size === paginatedAnuncios.length && paginatedAnuncios.length > 0 ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                  </button>
                </TableHead>
                <TableHead>Anúncio</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Plataforma</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-center w-48">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedAnuncios.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="p-0"><EstadoVazio titulo="Nenhum anúncio" /></TableCell></TableRow>
              ) : paginatedAnuncios.map(a => (
                <TableRow key={a.id} className="border-border hover:bg-muted/30">
                  <TableCell>
                    <button onClick={() => toggleSelect(a.id)} className="text-muted-foreground">
                      {selectedIds.has(a.id) ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
                    </button>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm font-medium truncate max-w-[220px]">{a.title}</p>
                    <p className="text-xs text-muted-foreground">{a.game_title}</p>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {a.is_denunciado && <Badge className="bg-warning/15 text-warning text-[10px]">⚠️ Denunciado</Badge>}
                      {a.fotos > 0 && <Badge variant="outline" className="text-[10px]">{a.fotos} 📸</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {a.seller_name}
                    {a.is_certified && <Badge className="bg-success/15 text-success ml-1 text-[10px]">✅ Certificado</Badge>}
                  </TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{a.ad_type === 'venda' ? 'Venda' : 'Troca'}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.platform}</TableCell>
                  <TableCell className="text-right text-sm font-medium">{a.price > 0 ? formatCurrency(a.price) : '—'}</TableCell>
                  <TableCell className="text-center"><Badge className={anuncioStatusColors[a.status] || ''}>{anuncioStatusLabels[a.status] || a.status}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(a.created_at)}</TableCell>
                  <TableCell className="text-center whitespace-nowrap">
                    {a.status === 'active' && (
                      <>
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => updateStatus(a.id, 'hidden')}>
                          <EyeOff className="h-3 w-3 mr-1" />Ocultar
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-warning" onClick={() => updateStatus(a.id, 'flagged')}>
                          <AlertCircle className="h-3 w-3 mr-1" />Sinalizar
                        </Button>
                      </>
                    )}
                    {a.status === 'hidden' && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-success" onClick={() => updateStatus(a.id, 'active')}>
                        <Check className="h-3 w-3 mr-1" />Aprovar
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setEditing(a); setEditForm({ title: a.title, price: String(a.price), description: '' }); }}>
                      <Edit className="h-3 w-3 mr-1" />Editar
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => updateStatus(a.id, 'removed', 'Removido pelo admin')}>
                      <Ban className="h-3 w-3 mr-1" />Remover
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* GAP-D19: Paginação */}
          <div className="flex items-center justify-between p-4 border-t border-border">
            <span className="text-xs text-muted-foreground">
              {filteredAnuncios.length > 0 ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, filteredAnuncios.length)} de ${filteredAnuncios.length}` : '0 resultados'}
            </span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs flex items-center px-2">
                {page + 1} / {totalPages || 1}
              </span>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* GAP-D18: Modal de edição */}
      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Anúncio</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Título</Label>
              <Input value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} />
            </div>
            <div>
              <Label>Preço (R$)</Label>
              <Input type="number" step="0.01" value={editForm.price} onChange={e => setEditForm({ ...editForm, price: e.target.value })} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} rows={3} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleEdit} disabled={loading} className="flex-1">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar alterações'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* GAP-D25: Ação em massa */}
      <AlertDialog open={!!batchAction} onOpenChange={o => !o && setBatchAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar ação em massa</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a {batchAction === 'hide' ? 'ocultar' : batchAction === 'flag' ? 'sinalizar' : 'remover'} <b>{selectedIds.size}</b> anúncios.
              Esta ação afetará todos os anúncios selecionados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBatchAction} className={batchAction === 'delete' ? 'bg-destructive' : ''}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}