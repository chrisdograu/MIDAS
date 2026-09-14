import { useState, useEffect, useRef, useMemo } from 'react';
import { Package, Plus, Search, Filter, Edit, Trash2, MoreHorizontal, Loader2, Upload, Eye, EyeOff, Download, ChevronLeft, ChevronRight, AlertTriangle, Building2, BookOpen } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';
import ProductGalleryAdmin from '@/components/ProductGalleryAdmin';
import EstadoVazio from '@/components/EstadoVazio';
import { formatCurrency } from '@/lib/format';
import { adminLog } from '../lib/adminLog';

type Produto = Tables<'produtos'>;

const ITEMS_PER_PAGE = 15;

export default function Produtos() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [activeFilter, setActiveFilter] = useState('all');
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<{ id: string; name: string }[]>([]);
  const [fornecedores, setFornecedores] = useState<{ id: string; name: string }[]>([]);
  const [developers, setDevelopers] = useState<{ id: string; name: string }[]>([]);
  const [publishers, setPublishers] = useState<{ id: string; name: string }[]>([]);
  // TODO: fDeveloperId e fPublisherId são declarados mas não entram no payload de save.
  // Mover pra payload ou remover os estados + selects.
  const [fDeveloperId, setFDeveloperId] = useState('');
  const [fPublisherId, setFPublisherId] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<Produto | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  // Form
  const [fTitle, setFTitle] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [fCost, setFCost] = useState('');
  const [fPrice, setFPrice] = useState('');
  const [fOriginalPrice, setFOriginalPrice] = useState('');
  const [fType, setFType] = useState<'digital' | 'physical' | 'subscription'>('digital');
  const [fPlatform, setFPlatform] = useState('');
  const [fStock, setFStock] = useState('');
  const [fAlert, setFAlert] = useState('5');
  const [fCatId, setFCatId] = useState('');
  const [fSuppId, setFSuppId] = useState('');
  const [fImage, setFImage] = useState('');
  const [fFeatured, setFFeatured] = useState(false);
  const [fClass, setFClass] = useState<'L' | '10' | '12' | '14' | '16' | '18'>('L');
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // GAP-D211: Paginação
  const fetchAll = async (reset: boolean = true) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);

    const currentPage = reset ? 0 : page;
    const from = currentPage * ITEMS_PER_PAGE;

    try {
      let query = supabase.from('produtos').select('*', { count: 'exact' }).order('title');

      // GAP-D212: Filtro por status
      if (activeFilter === 'active') {
        query = query.eq('is_active', true);
      } else if (activeFilter === 'inactive') {
        query = query.eq('is_active', false);
      }

      const { data: prods, error, count } = await query.range(from, from + ITEMS_PER_PAGE - 1);
      if (error) throw error;

      if (reset) {
        setProdutos(prods || []);
        setHasMore((prods || []).length === ITEMS_PER_PAGE);
        setPage(1);
      } else {
        setProdutos(prev => [...prev, ...(prods || [])]);
        setHasMore((prods || []).length === ITEMS_PER_PAGE);
        setPage(currentPage + 1);
      }
    } catch (error) {
      toast({ title: 'Erro ao carregar produtos', variant: 'destructive' });
    } finally {
      if (reset) setLoading(false);
      else setLoadingMore(false);
    }
  };

  // Carregar categorias e fornecedores
  const loadMetadata = async () => {
    const [{ data: cats }, { data: forns }] = await Promise.all([
      supabase.from('categorias').select('id, name').order('name'),
      supabase.from('fornecedores').select('id, name').order('name'),
    ]);
    setCategorias(cats || []);
    setFornecedores(forns || []);
  };

  const loadDevelopersAndPublishers = async () => {
    const [{ data: devs }, { data: pubs }] = await Promise.all([
      supabase.from('developers').select('id, name').order('name'),
      supabase.from('publishers').select('id, name').order('name'),
    ]);
    setDevelopers(devs || []);
    setPublishers(pubs || []);
  };

  useEffect(() => {
    fetchAll(true);
    loadMetadata();
    loadDevelopersAndPublishers();
  }, [activeFilter]);

  const resetForm = () => {
    setFTitle(''); setFDesc(''); setFCost(''); setFPrice(''); setFOriginalPrice(''); setFType('digital');
    setFPlatform(''); setFStock(''); setFAlert('5'); setFCatId(''); setFSuppId(''); setFImage(''); setFFeatured(false);
    setFClass('L');
    setSelected(null);
  };

  const openCreate = () => { resetForm(); setDialogOpen(true); };
  const openEdit = (p: Produto) => {
    setSelected(p); setFTitle(p.title); setFDesc(p.description || ''); setFCost(String(p.cost_price || 0));
    setFPrice(String(p.price));
    setFOriginalPrice(String((p as any).original_price ?? p.price));
    setFType(p.product_type); setFPlatform((p.platform || []).join(', '));
    setFStock(String(p.stock)); setFAlert(String(p.stock_alert_threshold)); setFCatId(p.category_id || '');
    setFSuppId(p.supplier_id || ''); setFImage(p.image_url || '');
    setFFeatured(!!(p as any).featured);
    setFClass(((p as any).classificacao_indicativa as any) || 'L');
    setDialogOpen(true);
  };

  // GAP-D213: Validação de desconto
  const handleSave = async () => {
    if (!fTitle.trim()) { toast({ title: 'Nome obrigatório', variant: 'destructive' }); return; }
    setSaving(true);
    const catName = categorias.find(c => c.id === fCatId)?.name || null;
    const priceNum = Number(fPrice) || 0;
    const originalPriceNum = fOriginalPrice.trim() === '' ? priceNum : Number(fOriginalPrice) || 0;

    // Validação de desconto
    if (selected && originalPriceNum > priceNum) {
      try {
        const { data: check } = await supabase.rpc('validate_discount_price' as any, {
          _product_id: selected.id,
          _new_price: priceNum,
          _new_original_price: originalPriceNum,
        });
        const suspicious = Array.isArray(check) ? (check[0] as any)?.suspicious : (check as any)?.suspicious;
        if (suspicious) {
          const ok = window.confirm('O desconto declarado é maior que o desconto real contra o menor preço dos últimos 30 dias. Confirmar mesmo assim?');
          if (!ok) { setSaving(false); return; }
        }
      } catch { /* falha aberta */ }
    }

    // GAP-D214: Verificar estoque baixo
    const stockNum = Number(fStock) || 0;
    const alertNum = Number(fAlert) || 5;
    const isLowStock = stockNum <= alertNum;

    const payload: any = {
      title: fTitle, description: fDesc || null, cost_price: Number(fCost) || 0,
      price: priceNum,
      original_price: originalPriceNum,
      product_type: fType as any,
      platform: fPlatform.split(',').map(s => s.trim()).filter(Boolean),
      stock: stockNum, stock_alert_threshold: alertNum,
      category_id: fCatId || null, category: catName, supplier_id: fSuppId || null,
      image_url: fImage || null,
      featured: fFeatured,
      classificacao_indicativa: fClass,
    };

    if (selected) {
      const { error } = await supabase.from('produtos').update(payload).eq('id', selected.id);
      setSaving(false);
      if (error) { toast({ title: 'Não foi possível salvar', description: error.message, variant: 'destructive' }); return; }

      // GAP-D210: adminLog
      await adminLog({
        action: 'update_product',
        entity: 'produtos',
        entity_id: selected.id,
        reason: `Produto ${payload.title} atualizado`,
        payload: { before: { price: selected.price, stock: selected.stock }, after: { price: payload.price, stock: payload.stock } }
      });

      // GAP-D214: Notificar estoque baixo
      if (isLowStock && selected.stock > stockNum) {
        await supabase.from('notifications').insert({
          user_id: (await supabase.auth.getUser()).data.user?.id,
          type: 'system',
          title: `⚠️ Estoque baixo: ${payload.title}`,
          body: `O produto "${payload.title}" está com apenas ${stockNum} unidade(s) em estoque. Mínimo: ${alertNum}`,
          reference_type: 'produto',
          reference_id: selected.id,
        });
      }

      toast({ title: 'Produto atualizado!' });
      setDialogOpen(false); resetForm(); fetchAll(true);
      return;
    }

    const { data: created, error } = await supabase.from('produtos').insert(payload).select('*').single();
    setSaving(false);
    if (error) { toast({ title: 'Não foi possível cadastrar', description: error.message, variant: 'destructive' }); return; }

    // GAP-D210: adminLog
    await adminLog({
      action: 'create_product',
      entity: 'produtos',
      entity_id: created.id,
      reason: `Produto ${payload.title} criado`,
      payload: { ...payload }
    });

    // GAP-D214: Notificar estoque baixo no cadastro
    if (isLowStock) {
      await supabase.from('notifications').insert({
        user_id: (await supabase.auth.getUser()).data.user?.id,
        type: 'system',
        title: `⚠️ Estoque baixo: ${payload.title}`,
        body: `O produto "${payload.title}" foi cadastrado com apenas ${stockNum} unidade(s) em estoque. Mínimo: ${alertNum}`,
        reference_type: 'produto',
        reference_id: created.id,
      });
    }

    toast({ title: 'Produto criado!' });
    setSelected(created as Produto);
    fetchAll(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast({ title: 'Imagem deve ter no máximo 5MB', variant: 'destructive' }); return; }
    setUploadingImage(true);
    const ext = file.name.split('.').pop();
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('product-images').upload(path, file, { upsert: true });
    if (error) { toast({ title: 'Erro ao enviar imagem', variant: 'destructive' }); setUploadingImage(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(path);
    setFImage(publicUrl);
    setUploadingImage(false);
    toast({ title: 'Imagem enviada!' });
  };

  // GAP-D210: adminLog
  const handleDelete = async () => {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase.from('produtos').delete().eq('id', selected.id);
    setSaving(false);
    if (error) {
      toast({
        title: 'Não foi possível excluir',
        description: error.message.includes('foreign key') || error.code === '23503'
          ? 'Este produto tem pedidos, avaliações ou referências vinculadas. Use "Desativar" em vez de excluir.'
          : error.message,
        variant: 'destructive',
      });
      return;
    }

    await adminLog({
      action: 'delete_product',
      entity: 'produtos',
      entity_id: selected.id,
      reason: `Produto ${selected.title} excluído`,
      payload: { deleted_product: selected.title }
    });

    toast({ title: 'Produto excluído' });
    setDeleteOpen(false); setSelected(null); fetchAll(true);
  };

  // GAP-D210: adminLog
  const handleToggle = async (p: Produto) => {
    const newStatus = !p.is_active;
    const { error: err } = await supabase.from('produtos').update({ is_active: newStatus }).eq('id', p.id);
    if (err) { toast({ title: 'Erro na operação', description: err.message, variant: 'destructive' }); return; }

    await adminLog({
      action: newStatus ? 'activate_product' : 'deactivate_product',
      entity: 'produtos',
      entity_id: p.id,
      reason: `Produto ${p.title} ${newStatus ? 'ativado' : 'desativado'}`,
      payload: { before: { is_active: p.is_active }, after: { is_active: newStatus } }
    });

    toast({ title: newStatus ? 'Produto ativado' : 'Produto desativado' });
    fetchAll(true);
  };

  // GAP-D215: Exportação detalhada
  const exportarCSV = () => {
    if (filtered.length === 0) { toast({ title: 'Nada para exportar', variant: 'destructive' }); return; }
    setExporting(true);
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const headers = ['ID', 'Título', 'Descrição', 'Categoria', 'Plataforma', 'Custo', 'Preço', 'Preço Original', 'Estoque', 'Alerta Mín.', 'Status', 'Tipo', 'Destaque'];
    const rows = filtered.map(p => [
      p.id, p.title, p.description || '', p.category || '', (p.platform || []).join(' / '),
      p.cost_price ?? 0, p.price, (p as any).original_price ?? p.price,
      p.stock, p.stock_alert_threshold, p.is_active ? 'Ativo' : 'Inativo',
      p.product_type, (p as any).featured ? 'Sim' : 'Não'
    ]);
    const csv = '\uFEFF' + [headers, ...rows].map(r => r.map(esc).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `produtos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
    toast({ title: `${filtered.length} produto(s) exportado(s)` });
  };

  const uniqueCats = [...new Set(produtos.map(p => p.category).filter(Boolean))] as string[];
  // TODO: busca é client-side sobre produtos já paginados.
  const filtered = produtos.filter(p => {
    const matchSearch = p.title.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === 'all' || p.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Package className="h-6 w-6 text-primary" /> Produtos</h1>
          <p className="text-muted-foreground text-sm">{produtos.length} produtos cadastrados</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportarCSV} disabled={exporting}>
            <Download className="h-4 w-4 mr-2" />
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Exportar CSV'}
          </Button>
          <Button className="bg-primary text-primary-foreground" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />Novo Produto
          </Button>
        </div>
            {/* TODO: BUG — este bloco de selects de Desenvolvedor/Publicadora está fora
                 do Dialog de edição e não tem campo correspondente no payload de save.
                 Mover pra dentro do Dialog (ao lado de Categoria/Fornecedor) ou remover. */}
            <div className="space-y-2">
              <Label>Desenvolvedor</Label>
              <Select value={fDeveloperId} onValueChange={setFDeveloperId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  {developers.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Publicadora</Label>
              <Select value={fPublisherId} onValueChange={setFPublisherId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  {publishers.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
      </div>

      {/* GAP-D214: Alertas de estoque baixo */}
      {produtos.filter(p => p.stock <= p.stock_alert_threshold && p.is_active).length > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-warning">
                {produtos.filter(p => p.stock <= p.stock_alert_threshold && p.is_active).length} produto(s) com estoque baixo
              </p>
              <div className="flex flex-wrap gap-1 mt-1">
                {produtos.filter(p => p.stock <= p.stock_alert_threshold && p.is_active).slice(0, 5).map(p => (
                  <Badge key={p.id} variant="outline" className="text-[10px] bg-warning/10 border-warning/30">
                    {p.title}: {p.stock} un.
                  </Badge>
                ))}
                {produtos.filter(p => p.stock <= p.stock_alert_threshold && p.is_active).length > 5 && (
                  <Badge variant="outline" className="text-[10px]">
                    +{produtos.filter(p => p.stock <= p.stock_alert_threshold && p.is_active).length - 5} mais
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/50">
        <CardContent className="py-3 px-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar produto..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-44"><Filter className="h-4 w-4 mr-2 text-muted-foreground" /><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Categorias</SelectItem>
              {uniqueCats.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          {/* GAP-D212: Filtro por status */}
          <Select value={activeFilter} onValueChange={setActiveFilter}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="inactive">Inativos</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setCategoryFilter('all'); setActiveFilter('all'); }}>
            Limpar
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardContent className="p-0">
          {loading && (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Carregando produtos" />
            </div>
          )}
          {!loading && (!produtos || produtos.length === 0) && (
            <EstadoVazio titulo="Nenhum produto cadastrado" descricao="Cadastre seu primeiro produto para começar a vender." />
          )}
          {!loading && produtos && produtos.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="w-12"></TableHead><TableHead>Produto</TableHead><TableHead>Categoria</TableHead>
                  <TableHead>Plataforma</TableHead><TableHead className="text-right">Custo</TableHead>
                  <TableHead className="text-right">Venda</TableHead><TableHead className="text-center">Estoque</TableHead>
                  <TableHead className="text-center">Status</TableHead><TableHead className="text-center w-16">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="p-0"><EstadoVazio titulo="Nenhum produto encontrado" /></TableCell></TableRow>
                ) : filtered.map(p => {
                  const isLow = p.stock <= p.stock_alert_threshold;
                  return (
                    <TableRow key={p.id} className="border-border hover:bg-muted/30">
                      <TableCell>{p.image_url ? <img src={p.image_url} alt="" className="w-10 h-10 rounded object-cover" loading="lazy" /> : <div className="w-10 h-10 rounded bg-muted" />}</TableCell>
                      <TableCell><p className="font-medium text-sm">{p.title}</p></TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{p.category || '—'}</Badge></TableCell>
                      <TableCell className="text-sm">{(p.platform || []).join(', ') || '—'}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">{formatCurrency((p.cost_price || 0))}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{formatCurrency(p.price)}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={p.stock === 0 ? 'bg-destructive/20 text-destructive' : isLow ? 'bg-warning/20 text-warning' : 'bg-success/20 text-success'}>
                          {p.stock}
                          {isLow && ' ⚠️'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={p.is_active ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'}>
                          {p.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Mais ações"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(p)}><Edit className="h-4 w-4 mr-2" />Editar</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggle(p)}>
                              {p.is_active ? <><EyeOff className="h-4 w-4 mr-2" />Desativar</> : <><Eye className="h-4 w-4 mr-2" />Ativar</>}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => { setSelected(p); setDeleteOpen(true); }}><Trash2 className="h-4 w-4 mr-2" />Excluir</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* GAP-D211: Paginação */}
      {filtered.length > ITEMS_PER_PAGE && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Mostrando {Math.min((page + 1) * ITEMS_PER_PAGE, filtered.length)} de {filtered.length}
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs flex items-center px-2">{page + 1} / {totalPages || 1}</span>
            <Button variant="outline" size="sm" disabled={!hasMore || (page + 1) * ITEMS_PER_PAGE >= filtered.length} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Dialog de criação/edição */}
      <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{selected ? 'Editar Produto' : 'Cadastrar Produto'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="col-span-2 space-y-2"><Label>Nome</Label><Input placeholder="Nome do produto" value={fTitle} onChange={e => setFTitle(e.target.value)} /></div>
            <div className="col-span-2 space-y-2"><Label>Descrição</Label><Textarea placeholder="Descrição" rows={3} value={fDesc} onChange={e => setFDesc(e.target.value)} /></div>
            <div className="space-y-2"><Label>Preço de Custo</Label><Input type="number" placeholder="0.00" value={fCost} onChange={e => setFCost(e.target.value)} /></div>
            <div className="space-y-2"><Label>Preço de Venda</Label><Input type="number" placeholder="0.00" value={fPrice} onChange={e => setFPrice(e.target.value)} /></div>
            <div className="col-span-2 space-y-2">
              <Label>Preço original (para exibir desconto)</Label>
              <Input type="number" placeholder="Deixe vazio se não há desconto" value={fOriginalPrice} onChange={e => setFOriginalPrice(e.target.value)} />
              <p className="text-xs text-muted-foreground">Se preenchido e maior que o preço de venda, exibe % de desconto.</p>
            </div>
            <div className="col-span-2 flex items-center gap-3 rounded-lg border border-border p-3">
              <Switch checked={fFeatured} onCheckedChange={setFFeatured} />
              <div>
                <Label className="cursor-pointer">Destacar na Home</Label>
                <p className="text-xs text-muted-foreground">Aparece na prateleira de destaques quando ativo.</p>
              </div>
            </div>
            <div className="space-y-2"><Label>Tipo</Label>
              <Select value={fType} onValueChange={v => setFType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="digital">Jogo Digital</SelectItem>
                  <SelectItem value="physical">Jogo Físico</SelectItem>
                  <SelectItem value="subscription">Assinatura</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Plataforma</Label><Input placeholder="PS5, Xbox, PC..." value={fPlatform} onChange={e => setFPlatform(e.target.value)} /></div>
            <div className="space-y-2"><Label>Estoque</Label><Input type="number" placeholder="0" value={fStock} onChange={e => setFStock(e.target.value)} /></div>
            <div className="space-y-2"><Label>Alerta Mín.</Label><Input type="number" placeholder="5" value={fAlert} onChange={e => setFAlert(e.target.value)} /></div>
            <div className="space-y-2"><Label>Categoria</Label>
              <Select value={fCatId} onValueChange={setFCatId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{categorias.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Fornecedor</Label>
              <Select value={fSuppId} onValueChange={setFSuppId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{fornecedores.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Classificação indicativa</Label>
              <Select value={fClass} onValueChange={(v: any) => setFClass(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="L">Livre</SelectItem>
                  <SelectItem value="10">10 anos</SelectItem>
                  <SelectItem value="12">12 anos</SelectItem>
                  <SelectItem value="14">14 anos</SelectItem>
                  <SelectItem value="16">16 anos</SelectItem>
                  <SelectItem value="18">18 anos</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Obrigatória para publicar (Lei 15.211/2025).</p>
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Imagem do Produto</Label>
              <div className="flex items-center gap-3">
                {fImage && <img src={fImage} alt="" className="w-16 h-16 rounded object-cover border border-border" loading="lazy" />}
                <div className="flex-1 flex gap-2">
                  <Input placeholder="URL ou envie um arquivo..." value={fImage} onChange={e => setFImage(e.target.value)} className="flex-1" />
                  <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploadingImage}>
                    {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  </Button>
                  <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </div>
              </div>
            </div>
            {selected ? (
              <div className="col-span-2 pt-2 border-t border-border">
                <ProductGalleryAdmin productId={selected.id} />
              </div>
            ) : (
              <p className="col-span-2 text-xs text-muted-foreground pt-2 border-t border-border">
                Salve o produto para liberar a galeria adicional.
              </p>
            )}
            <div className="col-span-2 flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancelar</Button>
              <Button className="bg-primary text-primary-foreground" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir produto?</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir "{selected?.title}"?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground" disabled={saving}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}