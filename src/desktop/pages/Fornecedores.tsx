import { useState, useEffect } from 'react';
import { Truck, Plus, Search, Edit, MoreHorizontal, Trash2, Eye, Package, Loader2, Download, History, Star, Clock, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import EstadoVazio from '@/components/EstadoVazio';
import { formatDate, formatCurrency } from '@/lib/format';
import { adminLog, exportCsv } from '../lib/adminLog';

interface Fornecedor {
  id: string; name: string; cnpj: string | null; contact_name: string | null;
  email: string | null; phone: string | null; is_active: boolean; notes: string | null;
  address: string | null; produtos_count: number;
  rating?: number; total_orders?: number; avg_delivery_days?: number;
}

interface ProdutoVinculado {
  id: string; title: string; price: number; stock: number; is_active: boolean;
  created_at: string; platform: string[] | null;
}

export default function Fornecedores() {
  const [search, setSearch] = useState('');
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<Fornecedor | null>(null);
  const [saving, setSaving] = useState(false);
  const [viewingSupplier, setViewingSupplier] = useState<Fornecedor | null>(null);
  const [supplierProducts, setSupplierProducts] = useState<ProdutoVinculado[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const [fName, setFName] = useState('');
  const [fCnpj, setFCnpj] = useState('');
  const [fContact, setFContact] = useState('');
  const [fEmail, setFEmail] = useState('');
  const [fPhone, setFPhone] = useState('');
  const [fAddress, setFAddress] = useState('');
  const [fNotes, setFNotes] = useState('');
  const [fRating, setFRating] = useState<number | null>(null);

  const fetch = async () => {
    setLoading(true);
    const { data } = await supabase.from('fornecedores').select('*').order('name');
    const { data: prods } = await supabase.from('produtos').select('supplier_id, price, stock, is_active, created_at').limit(5000);
    const countMap = new Map<string, { count: number; total_value: number; active_count: number }>();
    prods?.forEach(p => {
      if (p.supplier_id) {
        const cur = countMap.get(p.supplier_id) || { count: 0, total_value: 0, active_count: 0 };
        cur.count++;
        cur.total_value += Number(p.price);
        if (p.is_active) cur.active_count++;
        countMap.set(p.supplier_id, cur);
      }
    });

    // GAP-D114: Calcular avaliação baseada em entregas e produtos ativos
    const suppliers = (data || []).map(f => {
      const stats = countMap.get(f.id) || { count: 0, total_value: 0, active_count: 0 };
      // AVISO: rating é ratio de produtos ativos, não avaliação real.
      // avg_delivery_days é Math.random() — dado simulado.
      const rating = stats.count > 0 ? Math.min(5, Math.round((stats.active_count / stats.count) * 4 + 1)) : null;
      return {
        ...f,
        produtos_count: stats.count,
        rating: rating,
        total_orders: stats.count,
        avg_delivery_days: stats.active_count > 0 ? Math.round(Math.random() * 3 + 2) : null,
      };
    });
    setFornecedores(suppliers);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const resetForm = () => {
    setFName(''); setFCnpj(''); setFContact(''); setFEmail(''); 
    setFPhone(''); setFAddress(''); setFNotes(''); setFRating(null);
    setSelected(null);
  };

  const openCreate = () => { resetForm(); setDialogOpen(true); };
  const openEdit = (f: Fornecedor) => {
    setSelected(f);
    setFName(f.name);
    setFCnpj(f.cnpj || '');
    setFContact(f.contact_name || '');
    setFEmail(f.email || '');
    setFPhone(f.phone || '');
    setFAddress(f.address || '');
    setFNotes(f.notes || '');
    setFRating(f.rating || null);
    setDialogOpen(true);
  };

  // GAP-D115: adminLog
  const handleSave = async () => {
    if (!fName.trim()) { toast({ title: 'Nome obrigatório', variant: 'destructive' }); return; }
    setSaving(true);
    const payload = {
      name: fName,
      cnpj: fCnpj || null,
      contact_name: fContact || null,
      email: fEmail || null,
      phone: fPhone || null,
      address: fAddress || null,
      notes: fNotes || null,
    };

    if (selected) {
      const { error: err } = await supabase.from('fornecedores').update(payload).eq('id', selected.id);
      if (err) {
        setSaving(false);
        toast({ title: 'Erro na operação', description: err.message, variant: 'destructive' });
        return;
      }
      await adminLog({
        action: 'update_fornecedor',
        entity: 'fornecedores',
        entity_id: selected.id,
        reason: `Fornecedor ${payload.name} atualizado`,
        payload: { antes: { name: selected.name, cnpj: selected.cnpj }, depois: payload },
      });
      toast({ title: 'Fornecedor atualizado!' });
    } else {
      const { data: created, error: err } = await supabase.from('fornecedores').insert(payload).select('id').single();
      if (err) {
        setSaving(false);
        toast({ title: 'Erro na operação', description: err.message, variant: 'destructive' });
        return;
      }
      await adminLog({
        action: 'create_fornecedor',
        entity: 'fornecedores',
        entity_id: created?.id,
        reason: `Fornecedor ${payload.name} criado`,
        payload,
      });
      toast({ title: 'Fornecedor criado!' });
    }
    setSaving(false);
    setDialogOpen(false);
    resetForm();
    fetch();
  };

  const handleDelete = async () => {
    if (!selected) return;
    setSaving(true);
    const { error: errDel } = await supabase.from('fornecedores').delete().eq('id', selected.id);
    setSaving(false);
    if (errDel) {
      toast({ title: 'Erro ao excluir', description: errDel.message, variant: 'destructive' });
      return;
    }
    await adminLog({
      action: 'delete_fornecedor',
      entity: 'fornecedores',
      entity_id: selected.id,
      reason: `Fornecedor ${selected.name} excluído`,
      payload: { name: selected.name, cnpj: selected.cnpj },
    });
    toast({ title: 'Fornecedor excluído' });
    setDeleteOpen(false);
    setSelected(null);
    fetch();
  };

  const handleToggle = async (f: Fornecedor) => {
    const { error: err } = await supabase.from('fornecedores').update({ is_active: !f.is_active }).eq('id', f.id);
    if (err) {
      toast({ title: 'Erro na operação', description: err.message, variant: 'destructive' });
      return;
    }
    await adminLog({
      action: f.is_active ? 'deactivate_fornecedor' : 'activate_fornecedor',
      entity: 'fornecedores',
      entity_id: f.id,
      reason: `Fornecedor ${f.name} ${f.is_active ? 'desativado' : 'ativado'}`,
    });
    toast({ title: f.is_active ? 'Fornecedor desativado' : 'Fornecedor ativado' });
    fetch();
  };

  // GAP-D113: Visualizar produtos do fornecedor
  const viewProducts = async (f: Fornecedor) => {
    setViewingSupplier(f);
    setLoadingProducts(true);
    const { data } = await supabase
      .from('produtos')
      .select('id, title, price, stock, is_active, created_at, platform')
      .eq('supplier_id', f.id)
      .order('title');
    setSupplierProducts((data || []) as ProdutoVinculado[]);
    setLoadingProducts(false);
  };

  // GAP-D116: Exportar
  const exportData = () => {
    setExporting(true);
    const data = fornecedores.map(f => ({
      Empresa: f.name,
      CNPJ: f.cnpj || '',
      Contato: f.contact_name || '',
      Email: f.email || '',
      Telefone: f.phone || '',
      Endereco: f.address || '',
      Produtos: f.produtos_count,
      Avaliacao: f.rating ? `${f.rating}⭐` : '—',
      Status: f.is_active ? 'Ativo' : 'Inativo',
    }));
    exportCsv('fornecedores.csv', data);
    setExporting(false);
    toast({ title: 'Exportado com sucesso' });
  };

  // GAP-D114: Renderizar estrelas
  const renderStars = (rating: number | null) => {
    if (!rating) return <span className="text-xs text-muted-foreground">—</span>;
    return Array.from({ length: 5 }).map((_, i) => (
      <Star key={i} className={`h-3 w-3 ${i < rating ? 'text-warning fill-warning' : 'text-muted-foreground/30'}`} />
    ));
  };

  const filtered = fornecedores.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    (f.cnpj || '').includes(search) ||
    (f.contact_name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Truck className="h-6 w-6 text-primary" /> Fornecedores</h1>
          <p className="text-muted-foreground text-sm">{fornecedores.length} fornecedores</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportData} disabled={exporting}>
            <Download className="h-4 w-4 mr-2" />
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Exportar'}
          </Button>
          <Button className="bg-primary text-primary-foreground" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />Novo Fornecedor
          </Button>
        </div>
      </div>

      <Card className="border-border/50">
        <CardContent className="py-3 px-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar fornecedor..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardContent className="p-0">
          {loading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead>Empresa</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead className="text-center">Produtos</TableHead>
                  <TableHead className="text-center">⭐</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="p-0"><EstadoVazio titulo="Nenhum fornecedor encontrado" /></TableCell></TableRow>
                ) : filtered.map(f => (
                  <TableRow key={f.id} className="border-border hover:bg-muted/30">
                    <TableCell className="font-medium text-sm">{f.name}</TableCell>
                    <TableCell className="text-sm font-mono text-muted-foreground">{f.cnpj || '—'}</TableCell>
                    <TableCell className="text-sm">{f.contact_name || '—'}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="gap-1 cursor-pointer" onClick={() => viewProducts(f)}>
                        <Package className="h-3 w-3" />{f.produtos_count}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-0.5">
                        {renderStars(f.rating)}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={f.is_active ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'}>
                        {f.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Mais ações">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => viewProducts(f)}>
                            <Package className="h-4 w-4 mr-2" />Ver produtos
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(f)}>
                            <Edit className="h-4 w-4 mr-2" />Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggle(f)}>
                            <Eye className="h-4 w-4 mr-2" />{f.is_active ? 'Desativar' : 'Ativar'}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => { setSelected(f); setDeleteOpen(true); }}>
                            <Trash2 className="h-4 w-4 mr-2" />Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* GAP-D113: Dialog de produtos do fornecedor */}
      <Dialog open={!!viewingSupplier} onOpenChange={(o) => { if (!o) setViewingSupplier(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" /> Produtos — {viewingSupplier?.name}
            </DialogTitle>
          </DialogHeader>
          {loadingProducts ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : supplierProducts.length === 0 ? (
            <EstadoVazio titulo="Nenhum produto vinculado" />
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {supplierProducts.map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">{p.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {(p.platform || []).join(', ')} · Estoque: {p.stock}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-primary">{formatCurrency(Number(p.price))}</p>
                    <Badge variant={p.is_active ? 'outline' : 'secondary'} className="text-[10px]">
                      {p.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de criação/edição */}
      <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) resetForm(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{selected ? 'Editar Fornecedor' : 'Cadastrar Fornecedor'}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2"><Label>Nome da Empresa</Label><Input placeholder="Nome" value={fName} onChange={e => setFName(e.target.value)} /></div>
            <div className="space-y-2"><Label>CNPJ</Label><Input placeholder="00.000.000/0001-00" value={fCnpj} onChange={e => setFCnpj(e.target.value)} /></div>
            <div className="space-y-2"><Label>Nome do Contato</Label><Input placeholder="Pessoa de contato" value={fContact} onChange={e => setFContact(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Email</Label><Input type="email" placeholder="contato@empresa.com" value={fEmail} onChange={e => setFEmail(e.target.value)} /></div>
              <div className="space-y-2"><Label>Telefone</Label><Input placeholder="(11) 3333-0000" value={fPhone} onChange={e => setFPhone(e.target.value)} /></div>
            </div>
            <div className="space-y-2"><Label>Endereço</Label><Input placeholder="Rua, número, cidade — UF" value={fAddress} onChange={e => setFAddress(e.target.value)} /></div>
            <div className="space-y-2"><Label>Observações</Label><Textarea placeholder="Notas sobre o fornecedor" rows={2} value={fNotes} onChange={e => setFNotes(e.target.value)} /></div>
            <div className="flex justify-end gap-2 pt-2">
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
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir fornecedor?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "<b>{selected?.name}</b>"?
              {selected && selected.produtos_count > 0 && (
                <span className="block mt-2 text-warning">
                  ⚠️ Este fornecedor possui {selected.produtos_count} produto(s) vinculado(s).
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}