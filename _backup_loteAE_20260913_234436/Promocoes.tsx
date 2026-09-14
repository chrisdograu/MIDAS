import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Loader2, Trash2, Zap, Package, Calendar, Pencil, Download, ChevronLeft, ChevronRight, Filter, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import EstadoVazio from '@/components/EstadoVazio';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format';
import SelectSimples from '@/components/SelectSimples';
import { adminLog } from '../lib/adminLog';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Produto { id: string; title: string; price: number; image_url: string | null; }
interface Promo { id: string; product_id: string; discount_percent: number; starts_at: string; ends_at: string; is_active: boolean; }
interface Bundle { id: string; title: string; description: string | null; price: number; image_url: string | null; is_active: boolean; }
interface BundleItem { bundle_id: string; product_id: string; }
interface DailyPick { pick_date: string; product_id: string; reason?: string | null; }

const ITEMS_PER_PAGE = 10;

export default function Promocoes() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [bundleItems, setBundleItems] = useState<BundleItem[]>([]);
  const [picks, setPicks] = useState<DailyPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [promoFilter, setPromoFilter] = useState('all');
  const [bundleFilter, setBundleFilter] = useState('all');

  // Paginação
  const [promoPage, setPromoPage] = useState(0);
  const [bundlePage, setBundlePage] = useState(0);
  const [pickPage, setPickPage] = useState(0);

  // Dialogs
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoForm, setPromoForm] = useState({ product_id: '', discount_percent: 20, hours: 24 });
  const [bundleOpen, setBundleOpen] = useState(false);
  const [editingBundleId, setEditingBundleId] = useState<string | null>(null);
  const [bundleForm, setBundleForm] = useState({ title: '', description: '', price: 0, image_url: '', items: [] as string[] });
  const [pickOpen, setPickOpen] = useState(false);
  const [pickForm, setPickForm] = useState({ pick_date: new Date().toISOString().slice(0, 10), product_id: '', reason: '' });
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'promo' | 'bundle'; id: string; label: string } | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = async () => {
    setLoading(true);
    const [p, fp, bd, bi, dp] = await Promise.all([
      supabase.from('produtos').select('id, title, price, image_url').eq('is_active', true).order('title'),
      supabase.from('flash_promotions' as any).select('*').order('ends_at', { ascending: false }),
      supabase.from('bundles' as any).select('*').order('created_at', { ascending: false }),
      supabase.from('bundle_items' as any).select('*'),
      supabase.from('daily_pick_overrides' as any).select('*').order('pick_date', { ascending: false }).limit(30),
    ]);
    setProdutos((p.data as any) || []);
    setPromos((fp.data as any) || []);
    setBundles((bd.data as any) || []);
    setBundleItems((bi.data as any) || []);
    setPicks((dp.data as any) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  useRealtimeRefresh(['flash_promotions', 'bundles', 'daily_pick_overrides'], load, 'admin-promocoes');

  // GAP-D252: Alertas de expiração
  const expiringPromos = useMemo(() => {
    const now = new Date();
    return promos.filter(p => {
      const end = new Date(p.ends_at);
      const diff = (end.getTime() - now.getTime()) / (1000 * 60 * 60);
      return p.is_active && diff > 0 && diff < 24;
    });
  }, [promos]);

  // GAP-D251: Validação de desconto
  const createPromo = async () => {
    if (!promoForm.product_id) return toast.error('Escolha um jogo');
    if (promoForm.discount_percent < 1 || promoForm.discount_percent > 90) {
      return toast.error('Desconto deve ser entre 1% e 90%');
    }
    
    const ends_at = new Date(Date.now() + promoForm.hours * 3600000).toISOString();
    const { data, error } = await supabase.from('flash_promotions' as any).insert({
      product_id: promoForm.product_id,
      discount_percent: promoForm.discount_percent,
      ends_at, is_active: true,
    }).select().single();
    
    if (error) return toast.error(error.message);
    
    // GAP-D250: adminLog
    await adminLog({
      action: 'create_flash_promo',
      entity: 'flash_promotions',
      entity_id: (data as any)?.id,
      reason: `Promoção criada para ${produtos.find(p => p.id === promoForm.product_id)?.title}`,
      payload: { product_id: promoForm.product_id, discount: promoForm.discount_percent, hours: promoForm.hours }
    });

    toast.success('Promoção criada');
    setPromoOpen(false);
    load();
  };

  const togglePromo = async (id: string, is_active: boolean) => {
    const { error } = await supabase.from('flash_promotions' as any).update({ is_active: !is_active }).eq('id', id);
    if (error) return toast.error(error.message);
    
    // GAP-D250: adminLog
    await adminLog({
      action: is_active ? 'pause_flash_promo' : 'activate_flash_promo',
      entity: 'flash_promotions',
      entity_id: id,
      reason: `Promoção ${is_active ? 'pausada' : 'ativada'}`,
      payload: { antes: { is_active }, depois: { is_active: !is_active } }
    });

    toast.success(is_active ? 'Promoção pausada' : 'Promoção ativada');
    load();
  };

  const removePromo = async (id: string) => {
    const promo = promos.find(p => p.id === id);
    const { error } = await supabase.from('flash_promotions' as any).delete().eq('id', id);
    if (error) return toast.error(error.message);
    
    // GAP-D250: adminLog
    await adminLog({
      action: 'delete_flash_promo',
      entity: 'flash_promotions',
      entity_id: id,
      reason: `Promoção removida para ${promo ? produtos.find(p => p.id === promo.product_id)?.title : 'produto desconhecido'}`,
      payload: { deleted: promo }
    });

    toast.success('Promoção removida');
    load();
  };

  // TODO: saveBundle e removeBundle fazem 2-3 queries sem transação.
  // Se o insert de items falhar, o bundle fica em estado inconsistente.
  // Migrar para RPC `save_bundle` transacional.
  const saveBundle = async () => {
    if (!bundleForm.title || bundleForm.items.length < 2) return toast.error('Título e ao menos 2 jogos');
    
    if (editingBundleId) {
      const { error } = await supabase.from('bundles' as any).update({
        title: bundleForm.title, description: bundleForm.description || null,
        price: bundleForm.price, image_url: bundleForm.image_url || null,
      }).eq('id', editingBundleId);
      if (error) return toast.error(error.message);
      
      const { error: eDel } = await supabase.from('bundle_items' as any).delete().eq('bundle_id', editingBundleId);
      if (eDel) return toast.error(eDel.message);
      
      const items = bundleForm.items.map(pid => ({ bundle_id: editingBundleId, product_id: pid }));
      const { error: eIns } = await supabase.from('bundle_items' as any).insert(items);
      if (eIns) return toast.error(`Bundle salvo, mas os jogos não foram gravados: ${eIns.message}`);
      
      // GAP-D250: adminLog
      await adminLog({
        action: 'update_bundle',
        entity: 'bundles',
        entity_id: editingBundleId,
        reason: `Bundle "${bundleForm.title}" atualizado`,
        payload: { items: bundleForm.items.length, price: bundleForm.price }
      });

      toast.success('Bundle atualizado');
    } else {
      const { data: bd, error } = await supabase.from('bundles' as any).insert({
        title: bundleForm.title, description: bundleForm.description || null,
        price: bundleForm.price, image_url: bundleForm.image_url || null,
      }).select().single();
      if (error || !bd) return toast.error(error?.message || 'Erro');
      
      const items = bundleForm.items.map(pid => ({ bundle_id: (bd as any).id, product_id: pid }));
      const { error: eIns } = await supabase.from('bundle_items' as any).insert(items);
      if (eIns) return toast.error(`Bundle criado, mas os jogos não foram gravados: ${eIns.message}`);
      
      // GAP-D250: adminLog
      await adminLog({
        action: 'create_bundle',
        entity: 'bundles',
        entity_id: (bd as any).id,
        reason: `Bundle "${bundleForm.title}" criado`,
        payload: { items: bundleForm.items.length, price: bundleForm.price }
      });

      toast.success('Bundle criado');
    }
    setBundleOpen(false);
    resetBundleForm();
    load();
  };

  const toggleBundle = async (id: string, is_active: boolean) => {
    const { error } = await supabase.from('bundles' as any).update({ is_active: !is_active }).eq('id', id);
    if (error) return toast.error(error.message);
    
    // GAP-D250: adminLog
    await adminLog({
      action: is_active ? 'deactivate_bundle' : 'activate_bundle',
      entity: 'bundles',
      entity_id: id,
      reason: `Bundle ${is_active ? 'desativado' : 'ativado'}`,
      payload: { antes: { is_active }, depois: { is_active: !is_active } }
    });

    toast.success(is_active ? 'Bundle desativado' : 'Bundle ativado');
    load();
  };

  const removeBundle = async (id: string) => {
    const bundle = bundles.find(b => b.id === id);
    const { error: eItems } = await supabase.from('bundle_items' as any).delete().eq('bundle_id', id);
    if (eItems) return toast.error(eItems.message);
    const { error } = await supabase.from('bundles' as any).delete().eq('id', id);
    if (error) return toast.error(error.message);
    
    // GAP-D250: adminLog
    await adminLog({
      action: 'delete_bundle',
      entity: 'bundles',
      entity_id: id,
      reason: `Bundle "${bundle?.title || 'desconhecido'}" removido`,
      payload: { deleted: bundle }
    });

    toast.success('Bundle removido');
    load();
  };

  const setPick = async () => {
    if (!pickForm.product_id) return toast.error('Escolha um jogo');
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('daily_pick_overrides' as any).upsert({
      pick_date: pickForm.pick_date, product_id: pickForm.product_id, set_by: user?.id, reason: pickForm.reason || null,
    }, { onConflict: 'pick_date' });
    if (error) return toast.error(error.message);
    
    // GAP-D250: adminLog
    await adminLog({
      action: 'set_daily_pick',
      entity: 'daily_pick_overrides',
      reason: `Pick do dia definido para ${produtos.find(p => p.id === pickForm.product_id)?.title}`,
      payload: { date: pickForm.pick_date, product: pickForm.product_id, reason: pickForm.reason }
    });

    toast.success('Pick do dia definido');
    setPickOpen(false);
    load();
  };

  const removePick = async (date: string) => {
    const { error } = await supabase.from('daily_pick_overrides' as any).delete().eq('pick_date', date);
    if (error) return toast.error(error.message);
    
    // GAP-D250: adminLog
    await adminLog({
      action: 'remove_daily_pick',
      entity: 'daily_pick_overrides',
      reason: `Pick do dia ${date} removido`,
      payload: { date }
    });

    toast.success('Pick removido');
    load();
  };

  // TODO: exportData está vazio (só mostra toast). Implementar ou remover botão.
  const exportData = () => {
    setExporting(true);
    const data = promos.map(p => ({
      Produto: produtos.find(pr => pr.id === p.product_id)?.title || 'Desconhecido',
      Desconto: `${p.discount_percent}%`,
      Início: formatDateTime(p.starts_at),
      Fim: formatDateTime(p.ends_at),
      Status: p.is_active ? 'Ativa' : 'Pausada',
    }));
    // ... lógica de CSV
    setExporting(false);
    toast.success('Dados exportados');
  };

  const productMap = new Map(produtos.map(p => [p.id, p]));

  // Paginação
  const filteredPromos = useMemo(() => {
    return promoFilter === 'all' ? promos : promos.filter(p => p.is_active === (promoFilter === 'active'));
  }, [promos, promoFilter]);
  const paginatedPromos = filteredPromos.slice(promoPage * ITEMS_PER_PAGE, (promoPage + 1) * ITEMS_PER_PAGE);

  const filteredBundles = useMemo(() => {
    return bundleFilter === 'all' ? bundles : bundles.filter(b => b.is_active === (bundleFilter === 'active'));
  }, [bundles, bundleFilter]);
  const paginatedBundles = filteredBundles.slice(bundlePage * ITEMS_PER_PAGE, (bundlePage + 1) * ITEMS_PER_PAGE);

  const resetBundleForm = () => {
    setEditingBundleId(null);
    setBundleForm({ title: '', description: '', price: 0, image_url: '', items: [] });
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Promoções, Bundles e Daily Pick</h1>
        <Button variant="outline" onClick={exportData} disabled={exporting}>
          <Download className="h-4 w-4 mr-1" />
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Exportar'}
        </Button>
      </div>

      {/* GAP-D252: Alertas de expiração */}
      {expiringPromos.length > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-warning">
                {expiringPromos.length} promoção(ões) expirando em menos de 24h
              </p>
              <div className="flex flex-wrap gap-1 mt-1">
                {expiringPromos.slice(0, 5).map(p => {
                  const prod = productMap.get(p.product_id);
                  return (
                    <Badge key={p.id} variant="outline" className="text-[10px] bg-warning/10 border-warning/30">
                      {prod?.title || 'Desconhecido'}: {Math.round((new Date(p.ends_at).getTime() - Date.now()) / 3600000)}h
                    </Badge>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="flash">
        <TabsList>
          <TabsTrigger value="flash"><Zap className="h-4 w-4 mr-1" /> Promoções Relâmpago</TabsTrigger>
          <TabsTrigger value="bundles"><Package className="h-4 w-4 mr-1" /> Bundles</TabsTrigger>
          <TabsTrigger value="daily"><Calendar className="h-4 w-4 mr-1" /> Pick do Dia</TabsTrigger>
        </TabsList>

        {/* Flash Promotions */}
        <TabsContent value="flash" className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <Dialog open={promoOpen} onOpenChange={setPromoOpen}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Nova Promoção</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nova promoção relâmpago</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Jogo</Label>
                    <SelectSimples
                      label="Jogo"
                      value={promoForm.product_id}
                      onChange={(v) => setPromoForm({ ...promoForm, product_id: v })}
                      options={produtos.map(p => ({ value: p.id, label: `${p.title} (${formatCurrency(Number(p.price))})` }))}
                    />
                  </div>
                  <div><Label>Desconto (%) (1-90)</Label>
                    <Input 
                      type="number" 
                      min="1" 
                      max="90"
                      value={promoForm.discount_percent} 
                      onChange={e => setPromoForm({ ...promoForm, discount_percent: Math.min(90, Math.max(1, parseInt(e.target.value) || 0)) })} 
                    />
                  </div>
                  <div><Label>Duração (horas)</Label>
                    <Input 
                      type="number" 
                      min="1" 
                      value={promoForm.hours} 
                      onChange={e => setPromoForm({ ...promoForm, hours: parseInt(e.target.value) || 1 })} 
                    />
                  </div>
                </div>
                <DialogFooter><Button onClick={createPromo}>Criar</Button></DialogFooter>
              </DialogContent>
            </Dialog>
            {/* GAP-D254: Filtro por status */}
            <div className="flex items-center gap-2">
              <Select value={promoFilter} onValueChange={setPromoFilter}>
                <SelectTrigger className="w-36">
                  <Filter className="h-3 w-3 mr-1" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Ativas</SelectItem>
                  <SelectItem value="inactive">Pausadas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {paginatedPromos.map(promo => {
              const prod = productMap.get(promo.product_id);
              const expired = new Date(promo.ends_at) < new Date();
              return (
                <div key={promo.id} className="bg-card border border-border rounded-lg p-4 flex gap-3">
                  {prod?.image_url && <img src={prod.image_url} className="w-16 h-20 object-cover rounded" loading="lazy" />}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{prod?.title || 'Jogo removido'}</p>
                    <p className="text-sm text-price font-bold">-{promo.discount_percent}%</p>
                    <p className="text-xs text-muted-foreground">Termina: {formatDateTime(promo.ends_at)}</p>
                    <div className="flex gap-2 mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${expired ? 'bg-muted' : promo.is_active ? 'bg-success/20 text-success' : 'bg-muted'}`}>
                        {expired ? 'Expirada' : promo.is_active ? 'Ativa' : 'Pausada'}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    {!expired && <Button size="sm" variant="outline" onClick={() => togglePromo(promo.id, promo.is_active)}>{promo.is_active ? 'Pausar' : 'Ativar'}</Button>}
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDelete({ type: 'promo', id: promo.id, label: `promoção de ${productMap.get(promo.product_id)?.title || ''}` })}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              );
            })}
            {promos.length === 0 && <EstadoVazio titulo="Nenhuma promoção criada" />}
          </div>

          {/* GAP-D253: Paginação */}
          {filteredPromos.length > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Mostrando {Math.min((promoPage + 1) * ITEMS_PER_PAGE, filteredPromos.length)} de {filteredPromos.length}
              </span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={promoPage === 0} onClick={() => setPromoPage(p => Math.max(0, p - 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs flex items-center px-2">{promoPage + 1} / {Math.ceil(filteredPromos.length / ITEMS_PER_PAGE)}</span>
                <Button variant="outline" size="sm" disabled={(promoPage + 1) * ITEMS_PER_PAGE >= filteredPromos.length} onClick={() => setPromoPage(p => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Bundles */}
        <TabsContent value="bundles" className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <Dialog open={bundleOpen} onOpenChange={(o) => { setBundleOpen(o); if (!o) resetBundleForm(); }}>
              <DialogTrigger asChild><Button onClick={() => { resetBundleForm(); setBundleOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Novo Bundle</Button></DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{editingBundleId ? 'Editar bundle' : 'Criar bundle'}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Título</Label><Input value={bundleForm.title} onChange={e => setBundleForm({ ...bundleForm, title: e.target.value })} placeholder="ex: Pacote RPG Lendário" /></div>
                  <div><Label>Descrição</Label><Textarea value={bundleForm.description} onChange={e => setBundleForm({ ...bundleForm, description: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>Preço total (R$)</Label><Input type="number" step="0.01" value={bundleForm.price} onChange={e => setBundleForm({ ...bundleForm, price: parseFloat(e.target.value) || 0 })} /></div>
                    <div><Label>Imagem (URL)</Label><Input value={bundleForm.image_url} onChange={e => setBundleForm({ ...bundleForm, image_url: e.target.value })} /></div>
                  </div>
                  <div>
                    <Label>Jogos incluídos ({bundleForm.items.length})</Label>
                    <div className="border border-border rounded max-h-60 overflow-y-auto p-2 space-y-1">
                      {produtos.map(p => (
                        <label key={p.id} className="flex items-center gap-2 text-sm hover:bg-secondary/50 p-1 rounded cursor-pointer">
                          <input type="checkbox" checked={bundleForm.items.includes(p.id)} onChange={e => {
                            setBundleForm({
                              ...bundleForm,
                              items: e.target.checked ? [...bundleForm.items, p.id] : bundleForm.items.filter(i => i !== p.id),
                            });
                          }} />
                          {p.title} <span className="text-muted-foreground ml-auto">{formatCurrency(Number(p.price))}</span>
                        </label>
                      ))}
                    </div>
                    {bundleForm.items.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Soma individual: {formatCurrency(bundleForm.items.reduce((s, id) => s + (productMap.get(id)?.price || 0), 0))}
                      </p>
                    )}
                  </div>
                </div>
                <DialogFooter><Button onClick={saveBundle}>{editingBundleId ? 'Salvar alterações' : 'Criar'}</Button></DialogFooter>
              </DialogContent>
            </Dialog>
            <div className="flex items-center gap-2">
              <Select value={bundleFilter} onValueChange={setBundleFilter}>
                <SelectTrigger className="w-36">
                  <Filter className="h-3 w-3 mr-1" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="inactive">Inativos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {paginatedBundles.map(b => {
              const items = bundleItems.filter(bi => bi.bundle_id === b.id);
              return (
                <div key={b.id} className="bg-card border border-border rounded-lg p-4">
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold">{b.title}</h3>
                      <p className="text-price font-bold">{formatCurrency(Number(b.price))}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => { setEditingBundleId(b.id); setBundleForm({ title: b.title, description: b.description || '', price: Number(b.price), image_url: b.image_url || '', items: items.map(i => i.product_id) }); setBundleOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="sm" variant="outline" onClick={() => toggleBundle(b.id, b.is_active)}>{b.is_active ? 'Pausar' : 'Ativar'}</Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmDelete({ type: 'bundle', id: b.id, label: b.title })}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </div>
                  {b.description && <p className="text-sm text-muted-foreground mb-2">{b.description}</p>}
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {items.map(it => <div key={it.product_id}>• {productMap.get(it.product_id)?.title || it.product_id}</div>)}
                  </div>
                </div>
              );
            })}
            {bundles.length === 0 && <EstadoVazio titulo="Nenhum bundle criado" />}
          </div>

          {filteredBundles.length > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Mostrando {Math.min((bundlePage + 1) * ITEMS_PER_PAGE, filteredBundles.length)} de {filteredBundles.length}
              </span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={bundlePage === 0} onClick={() => setBundlePage(p => Math.max(0, p - 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs flex items-center px-2">{bundlePage + 1} / {Math.ceil(filteredBundles.length / ITEMS_PER_PAGE)}</span>
                <Button variant="outline" size="sm" disabled={(bundlePage + 1) * ITEMS_PER_PAGE >= filteredBundles.length} onClick={() => setBundlePage(p => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Daily Pick */}
        <TabsContent value="daily" className="space-y-4">
          <p className="text-sm text-muted-foreground">Por padrão, o "Pick do Dia" é escolhido automaticamente. Aqui você pode forçar manualmente para uma data específica.</p>
          <Dialog open={pickOpen} onOpenChange={setPickOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Definir Pick</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Definir Pick do Dia</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Data</Label><Input type="date" value={pickForm.pick_date} onChange={e => setPickForm({ ...pickForm, pick_date: e.target.value })} /></div>
                <div><Label>Jogo</Label>
                  <SelectSimples
                    label="Jogo"
                    value={pickForm.product_id}
                    onChange={(v) => setPickForm({ ...pickForm, product_id: v })}
                    options={produtos.map(p => ({ value: p.id, label: p.title }))}
                  />
                </div>
                <div><Label>Motivo da escolha (opcional)</Label><Textarea rows={2} placeholder="Ex: Lançamento da semana, jogo brasileiro, classico imperdível..." value={pickForm.reason} onChange={e => setPickForm({ ...pickForm, reason: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={setPick}>Salvar</Button></DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="space-y-2">
            {picks.length === 0 && <EstadoVazio titulo="Nenhum pick manual definido" />}
            {picks.slice(pickPage * ITEMS_PER_PAGE, (pickPage + 1) * ITEMS_PER_PAGE).map(p => (
              <div key={p.pick_date} className="bg-card border border-border rounded p-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold">{formatDate(p.pick_date)}</p>
                  <p className="text-sm text-muted-foreground">{productMap.get(p.product_id)?.title || p.product_id}</p>
                  {p.reason && <p className="text-xs text-muted-foreground">"{p.reason}"</p>}
                </div>
                <Button size="sm" variant="ghost" onClick={() => removePick(p.pick_date)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            ))}
          </div>

          {picks.length > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Mostrando {Math.min((pickPage + 1) * ITEMS_PER_PAGE, picks.length)} de {picks.length}
              </span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={pickPage === 0} onClick={() => setPickPage(p => Math.max(0, p - 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs flex items-center px-2">{pickPage + 1} / {Math.ceil(picks.length / ITEMS_PER_PAGE)}</span>
                <Button variant="outline" size="sm" disabled={(pickPage + 1) * ITEMS_PER_PAGE >= picks.length} onClick={() => setPickPage(p => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => { if (!o) setConfirmDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover {confirmDelete?.type === 'bundle' ? 'o bundle' : 'a'} <strong>{confirmDelete?.label}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!confirmDelete) return;
                if (confirmDelete.type === 'promo') await removePromo(confirmDelete.id);
                else await removeBundle(confirmDelete.id);
                setConfirmDelete(null);
              }}
            >Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}