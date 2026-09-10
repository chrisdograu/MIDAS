import { useEffect, useMemo, useState } from 'react';
import { Boxes, Loader2, Plus, Trash2, Edit, Search, Download, Package, Image, Eye, X, Upload, Star, AlertCircle, Percent, History } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { adminLog, exportCsv } from '../lib/adminLog';
import EstadoVazio from '@/components/EstadoVazio';
import { formatCurrency } from '@/lib/format';

// GAP-D53: Galeria de imagens
interface BundleImage {
  id: string;
  bundle_id?: string;
  image_url: string;
  is_primary: boolean;
}

export default function BundlesAdmin() {
  const [bundles, setBundles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<any | null>(null);
  const [itemsOpen, setItemsOpen] = useState<any | null>(null);
  const [imagesOpen, setImagesOpen] = useState<any | null>(null);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [bundleImages, setBundleImages] = useState<BundleImage[]>([]);
  const [form, setForm] = useState({ title: '', description: '', price: 0, image_url: '', is_active: true, discount_percent: 0 });
  const [pendingDelete, setPendingDelete] = useState<any | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [historyOpen, setHistoryOpen] = useState<any | null>(null);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [bundleAvgRating, setBundleAvgRating] = useState<{ [key: string]: number }>({});

  const load = async () => {
    setLoading(true);
    const [{ data: bundlesData }, { data: catsData }] = await Promise.all([
      supabase.from('bundles').select('*').order('created_at', { ascending: false }),
      supabase.from('categorias').select('id, name').order('name'),
    ]);
    setBundles(bundlesData || []);
    setCategories(catsData || []);

    // GAP-D54: Calcular médias de avaliações dos bundles
    const bundleIds = (bundlesData || []).map(b => b.id);
    if (bundleIds.length > 0) {
      const { data: items } = await supabase
        .from('bundle_items')
        .select('bundle_id, product_id')
        .in('bundle_id', bundleIds);
      
      const productIds = [...new Set((items || []).map(i => i.product_id))];
      if (productIds.length > 0) {
        const { data: ratings } = await supabase
          .from('avaliacoes')
          .select('product_id, rating')
          .in('product_id', productIds);
        
        const productRatings = new Map<string, number[]>();
        ratings?.forEach(r => {
          if (!productRatings.has(r.product_id)) productRatings.set(r.product_id, []);
          productRatings.get(r.product_id)?.push(r.rating);
        });

        const bundleRatings = new Map<string, number[]>();
        items?.forEach(item => {
          const ratings = productRatings.get(item.product_id) || [];
          if (ratings.length > 0) {
            if (!bundleRatings.has(item.bundle_id)) bundleRatings.set(item.bundle_id, []);
            bundleRatings.get(item.bundle_id)?.push(...ratings);
          }
        });

        const avgMap: { [key: string]: number } = {};
        bundleRatings.forEach((ratings, bundleId) => {
          avgMap[bundleId] = ratings.reduce((a, b) => a + b, 0) / ratings.length;
        });
        setBundleAvgRating(avgMap);
      }
    }

    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return bundles.filter(b => {
      const matchSearch = !search || b.title.toLowerCase().includes(search.toLowerCase());
      return matchSearch;
    });
  }, [bundles, search]);

  // GAP-D58: Calcular desconto percentual
  const calculateDiscount = async (bundleId: string) => {
    const { data: items } = await supabase
      .from('bundle_items')
      .select('product_id, produtos:product_id(price)')
      .eq('bundle_id', bundleId);
    if (!items || items.length === 0) return 0;
    const totalPrice = items.reduce((acc, item) => acc + Number((item.produtos as any)?.price || 0), 0);
    const bundle = bundles.find(b => b.id === bundleId);
    if (!bundle) return 0;
    const discount = totalPrice > 0 ? ((totalPrice - Number(bundle.price)) / totalPrice) * 100 : 0;
    return Math.round(discount);
  };

  const openCreate = () => { setEditing({}); setForm({ title: '', description: '', price: 0, image_url: '', is_active: true, discount_percent: 0 }); };
  const openEdit = (b: any) => { 
    setEditing(b); 
    setForm({ 
      title: b.title, 
      description: b.description || '', 
      price: b.price, 
      image_url: b.image_url || '', 
      is_active: b.is_active,
      discount_percent: b.discount_percent || 0,
    }); 
  };

  // GAP-D57: Validar preço do bundle
  const validateBundlePrice = async (bundleId: string, price: number) => {
    const { data: items } = await supabase
      .from('bundle_items')
      .select('product_id, produtos:product_id(price)')
      .eq('bundle_id', bundleId);
    if (!items || items.length === 0) return true;
    const totalPrice = items.reduce((acc, item) => acc + Number((item.produtos as any)?.price || 0), 0);
    if (price >= totalPrice) {
      toast.error(`O preço do bundle (${formatCurrency(price)}) deve ser menor que a soma dos itens (${formatCurrency(totalPrice)})`);
      return false;
    }
    // GAP-D58: Calcular desconto
    const discount = ((totalPrice - price) / totalPrice) * 100;
    setForm(prev => ({ ...prev, discount_percent: Math.round(discount) }));
    return true;
  };

  const save = async () => {
    if (!form.title) return toast.error('Título obrigatório');
    if (form.price <= 0) return toast.error('Preço deve ser maior que zero');
    
    const payload = { 
      title: form.title, 
      description: form.description || null, 
      price: form.price, 
      image_url: form.image_url || null, 
      is_active: form.is_active,
      discount_percent: form.discount_percent || 0,
    };

    if (editing?.id) {
      // GAP-D57: Validar preço
      const valid = await validateBundlePrice(editing.id, form.price);
      if (!valid) return;

      const { error } = await supabase.from('bundles').update(payload).eq('id', editing.id);
      if (error) return toast.error(error.message);
      await adminLog({ action: 'bundle_update', entity: 'bundle', entity_id: editing.id, payload: form });
    } else {
      const { data, error } = await supabase.from('bundles').insert(payload).select().single();
      if (error) return toast.error(error.message);
      await adminLog({ action: 'bundle_create', entity: 'bundle', entity_id: data?.id, payload: form });
    }
    toast.success('Salvo'); setEditing(null); load();
  };

  // GAP-D53: Upload de imagens
  const uploadBundleImage = async (file: File, bundleId: string, isPrimary: boolean = false) => {
    setUploadingImage(true);
    const ext = file.name.split('.').pop();
    const path = `bundles/${bundleId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: upErr } = await supabase.storage.from('product-images').upload(path, file);
    if (upErr) { toast.error('Erro ao subir imagem'); setUploadingImage(false); return null; }
    const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(path);
    const { error } = await supabase.from('bundle_images').insert({
      bundle_id: bundleId,
      image_url: publicUrl,
      is_primary: isPrimary,
    });
    setUploadingImage(false);
    if (error) { toast.error('Erro ao salvar imagem'); return null; }
    return publicUrl;
  };

  const removeBundleImage = async (imageId: string) => {
    const { error } = await supabase.from('bundle_images').delete().eq('id', imageId);
    if (error) { toast.error('Erro ao remover imagem'); return; }
    toast.success('Imagem removida');
    loadImages(bundleImages[0]?.bundle_id || '');
  };

  const loadImages = async (bundleId: string) => {
    const { data } = await supabase
      .from('bundle_images')
      .select('*')
      .eq('bundle_id', bundleId)
      .order('is_primary', { ascending: false })
      .order('created_at');
    setBundleImages(data || []);
  };

  const confirmDelete = async () => {
    const b = pendingDelete;
    if (!b) return;
    if (deleteReason.trim().length < 4) { toast.error('Justificativa muito curta'); return; }
    const { error } = await supabase.from('bundles').delete().eq('id', b.id);
    if (error) return toast.error(error.message);
    await adminLog({ action: 'bundle_delete', entity: 'bundle', entity_id: b.id, reason: deleteReason, payload: b });
    toast.success('Excluído'); setPendingDelete(null); setDeleteReason(''); load();
  };

  const toggleActive = async (b: any) => {
    const { error: err } = await supabase.from('bundles').update({ is_active: !b.is_active }).eq('id', b.id);
    if (err) return toast.error(err.message);
    await adminLog({ action: 'bundle_toggle', entity: 'bundle', entity_id: b.id, payload: { is_active: !b.is_active } });
    load();
  };

  const openItems = async (b: any) => {
    setItemsOpen(b);
    const [{ data: prods }, { data: items }] = await Promise.all([
      supabase.from('produtos').select('id, title, price, category_id, categorias:category_id(name)').order('title'),
      supabase.from('bundle_items').select('product_id').eq('bundle_id', b.id),
    ]);
    setProdutos(prods || []);
    setSelectedItems(new Set((items || []).map((i: any) => i.product_id)));
    
    // GAP-D57: Validar preço automaticamente
    await validateBundlePrice(b.id, Number(b.price));
  };

  const toggleItem = (pid: string) => {
    const s = new Set(selectedItems);
    s.has(pid) ? s.delete(pid) : s.add(pid);
    setSelectedItems(s);
  };

  const saveItems = async () => {
    if (!itemsOpen) return;
    const { error: errDel } = await supabase.from('bundle_items').delete().eq('bundle_id', itemsOpen.id);
    if (errDel) return toast.error(errDel.message);
    if (selectedItems.size > 0) {
      const rows = Array.from(selectedItems).map(pid => ({ bundle_id: itemsOpen.id, product_id: pid }));
      const { error } = await supabase.from('bundle_items').insert(rows);
      if (error) return toast.error(error.message);
    }
    await adminLog({ action: 'bundle_items_update', entity: 'bundle', entity_id: itemsOpen.id, payload: { product_ids: Array.from(selectedItems) } });
    toast.success('Itens atualizados');
    
    // GAP-D57: Revalidar preço
    await validateBundlePrice(itemsOpen.id, Number(itemsOpen.price));
    setItemsOpen(null);
    load();
  };

  // GAP-D59: Filtro por categoria
  const filteredProducts = useMemo(() => {
    if (categoryFilter === 'all') return produtos;
    return produtos.filter(p => p.category_id === categoryFilter);
  }, [produtos, categoryFilter]);

  // GAP-D55: Ver na loja
  const viewInStore = (bundleId: string) => {
    window.open(`/bundles/${bundleId}`, '_blank');
  };

  // GAP-D56: Histórico de alterações
  const openHistory = async (b: any) => {
    setHistoryOpen(b);
    setLoadingHistory(true);
    const { data } = await supabase
      .from('admin_logs')
      .select('*')
      .eq('entity', 'bundle')
      .eq('entity_id', b.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setHistoryLogs(data || []);
    setLoadingHistory(false);
  };

  // GAP-D60: Exportar com detalhes
  const exportWithDetails = () => {
    const data = filtered.map(b => ({
      titulo: b.title,
      preco: formatCurrency(Number(b.price)),
      ativo: b.is_active ? 'Sim' : 'Não',
      desconto: b.discount_percent ? `${b.discount_percent}%` : '—',
      avaliacao: bundleAvgRating[b.id] ? bundleAvgRating[b.id].toFixed(1) : '—',
      criado_em: new Date(b.created_at).toLocaleDateString('pt-BR'),
    }));
    exportCsv('bundles_completo.csv', data);
  };

  // GAP-D54: Renderizar estrelas
  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }).map((_, i) => (
      <Star key={i} className={`h-3 w-3 ${i < Math.round(rating) ? 'text-warning fill-warning' : 'text-muted-foreground/30'}`} />
    ));
  };

  return (
    <div className="p-6 space-y-6">
      <AdminPageHeader 
        icon={Boxes} 
        title="Bundles" 
        subtitle="Pacotes promocionais com múltiplos jogos"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={exportWithDetails}>
              <Download className="h-4 w-4 mr-1" />Exportar
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> Novo bundle
            </Button>
          </>
        } 
      />

      <Card className="border-border/50">
        <CardContent className="p-4 flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar bundle..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-20 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead className="text-center">Itens</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                  <TableHead className="text-center">Desconto</TableHead>
                  <TableHead className="text-center">⭐</TableHead>
                  <TableHead className="text-center">Ativo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="p-0">
                    <EstadoVazio titulo="Nenhum bundle" descricao="Crie um bundle para agrupar jogos com desconto." />
                  </TableCell></TableRow>
                ) : filtered.map(b => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium flex items-center gap-2">
                      {b.image_url && <img src={b.image_url} alt="" className="w-8 h-8 object-cover rounded" loading="lazy" />}
                      {b.title}
                      {b.discount_percent > 0 && (
                        <Badge className="bg-success/15 text-success">
                          <Percent className="h-3 w-3 mr-0.5" /> {b.discount_percent}% OFF
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">
                      {b._count?.items || 0}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(Number(b.price))}</TableCell>
                    <TableCell className="text-center">
                      {b.discount_percent > 0 ? (
                        <span className="text-success font-semibold">{b.discount_percent}%</span>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-0.5">
                        {bundleAvgRating[b.id] ? (
                          <>
                            {renderStars(bundleAvgRating[b.id])}
                            <span className="text-xs text-muted-foreground ml-1">{bundleAvgRating[b.id].toFixed(1)}</span>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch checked={b.is_active} onCheckedChange={() => toggleActive(b)} />
                    </TableCell>
                    <TableCell className="text-right space-x-1 whitespace-nowrap">
                      <Button size="sm" variant="outline" onClick={() => viewInStore(b.id)} title="Ver na loja">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openItems(b)} title="Gerenciar itens">
                        <Package className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { openEdit(b); loadImages(b.id); }} title="Editar">
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openHistory(b)} title="Histórico">
                        <History className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setPendingDelete(b); setDeleteReason(''); }} title="Excluir">
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={o => { if (!o) setEditing(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Editar bundle' : 'Novo bundle'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Título</Label>
                <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <Label>Preço (R$)</Label>
                <Input 
                  type="number" 
                  step="0.01" 
                  value={form.price} 
                  onChange={e => setForm({ ...form, price: Number(e.target.value) })} 
                />
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
            <div>
              <Label>Imagem principal (URL)</Label>
              <Input value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." />
            </div>

            {/* GAP-D53: Galeria de imagens */}
            {editing?.id && (
              <div className="border border-border rounded-lg p-4">
                <Label className="block mb-2">Galeria de imagens</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {bundleImages.map(img => (
                    <div key={img.id} className="relative w-16 h-16 rounded border border-border overflow-hidden">
                      <img src={img.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                      {img.is_primary && <Badge className="absolute top-0 right-0 text-[8px] p-0.5">Principal</Badge>}
                      <button 
                        onClick={() => removeBundleImage(img.id)}
                        className="absolute top-0 right-0 w-5 h-5 bg-destructive text-destructive-foreground rounded-bl rounded-tr flex items-center justify-center"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <label className="w-16 h-16 rounded border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary">
                    {uploadingImage ? (
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    ) : (
                      <Upload className="h-5 w-5 text-muted-foreground" />
                    )}
                    <input 
                      type="file" 
                      accept="image/*" 
                      hidden 
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file && editing?.id) {
                          await uploadBundleImage(file, editing.id, bundleImages.length === 0);
                          loadImages(editing.id);
                        }
                      }} 
                    />
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">Adicione imagens extras para o carrossel da página do bundle.</p>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>Ativo na loja</Label>
            </div>

            {form.discount_percent > 0 && (
              <div className="p-3 bg-success/10 rounded-lg border border-success/20">
                <p className="text-sm text-success font-semibold flex items-center gap-1">
                  <Percent className="h-4 w-4" /> Desconto de {form.discount_percent}% em relação aos itens separados
                </p>
              </div>
            )}

            <Button onClick={save} className="w-full">
              {editing?.id ? 'Atualizar bundle' : 'Criar bundle'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Items Dialog */}
      <Dialog open={!!itemsOpen} onOpenChange={o => { if (!o) setItemsOpen(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Itens do bundle — {itemsOpen?.title}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Preço atual: {formatCurrency(Number(itemsOpen?.price || 0))}
              {itemsOpen?.discount_percent > 0 && ` (${itemsOpen.discount_percent}% de desconto)`}
            </p>
          </DialogHeader>
          
          {/* GAP-D59: Filtro por categoria */}
          <div className="flex gap-2 mb-3">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Filtrar categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {categories.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground self-center">
              {selectedItems.size} de {produtos.length} selecionados
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1">
            {filteredProducts.map(p => (
              <label key={p.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer">
                <Checkbox checked={selectedItems.has(p.id)} onCheckedChange={() => toggleItem(p.id)} />
                <span className="flex-1 truncate text-sm">{p.title}</span>
                <span className="text-xs text-muted-foreground">{p.categorias?.name || '—'}</span>
                <span className="text-sm font-medium">{formatCurrency(Number(p.price))}</span>
              </label>
            ))}
          </div>
          
          <div className="flex gap-2 pt-3 border-t border-border">
            <Button variant="outline" className="flex-1" onClick={() => setItemsOpen(null)}>Cancelar</Button>
            <Button className="flex-1" onClick={saveItems}>
              Salvar ({selectedItems.size} selecionados)
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={!!historyOpen} onOpenChange={o => { if (!o) setHistoryOpen(null); }}>
        <DialogContent className="max-w-xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Histórico — {historyOpen?.title}</DialogTitle>
          </DialogHeader>
          {loadingHistory ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : historyLogs.length === 0 ? (
            <EstadoVazio titulo="Nenhuma alteração registrada" />
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {historyLogs.map(log => (
                <div key={log.id} className="bg-card border border-border rounded-lg p-3">
                  <p className="text-sm font-medium">{log.action?.replace(/_/g, ' ') || 'Ação'}</p>
                  <p className="text-xs text-muted-foreground">{log.reason || 'Sem motivo'}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{new Date(log.created_at).toLocaleString('pt-BR')}</p>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!pendingDelete} onOpenChange={o => { if (!o) { setPendingDelete(null); setDeleteReason(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir bundle</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a excluir <b>{pendingDelete?.title}</b>. Essa ação é registrada no log administrativo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label>Justificativa</Label>
            <Input value={deleteReason} onChange={e => setDeleteReason(e.target.value)} placeholder="Motivo da exclusão" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}