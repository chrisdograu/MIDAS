
import { useEffect, useState } from 'react';
import { Key, Search, Upload, Loader2, Download, Filter, Trash2, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { adminLog, exportCsv } from '../lib/adminLog';
import EstadoVazio from '@/components/EstadoVazio';
import { formatDateTime } from '@/lib/format';

const STATUS_LABELS = {
  available: 'Disponivel',
  reserved: 'Reservada',
  sold: 'Vendida',
  expired: 'Expirada',
  revoked: 'Revogada',
};

const STATUS_COLORS = {
  available: 'bg-success/15 text-success',
  reserved: 'bg-warning/15 text-warning',
  sold: 'bg-primary/15 text-primary',
  expired: 'bg-destructive/15 text-destructive',
  revoked: 'bg-destructive/15 text-destructive',
};

export default function AdminChaves() {
  const [keys, setKeys] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [productFilter, setProductFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('product_keys')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      if (productFilter !== 'all') {
        query = query.eq('product_id', productFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      const productIds = [...new Set((data || []).map((k) => k.product_id))];
      const { data: prods } = await supabase
        .from('produtos')
        .select('id, title')
        .in('id', productIds);
      const prodMap = new Map(prods?.map((p) => [p.id, p.title]) || []);

      setKeys((data || []).map((k) => ({
        ...k,
        product_title: prodMap.get(k.product_id) || 'Produto removido',
      })));
    } catch (error) {
      toast.error('Erro ao carregar chaves');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    const { data } = await supabase
      .from('produtos')
      .select('id, title')
      .order('title');
    setProducts(data || []);
  };

  useEffect(() => { load(); }, [statusFilter, productFilter]);
  useEffect(() => { loadProducts(); }, []);

  const importKeys = async () => {
    if (!csvText.trim()) {
      toast.error('Cole as chaves no campo de texto');
      return;
    }
    if (!selectedProduct) {
      toast.error('Selecione um produto');
      return;
    }

    const lines = csvText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      toast.error('Nenhuma chave valida encontrada');
      return;
    }

    setSaving(true);
    const { data: user } = await supabase.auth.getUser();
    const keysToInsert = lines.map((key) => ({
      product_id: selectedProduct,
      key_code: key,
      platform: selectedPlatform || null,
      status: 'available',
      imported_by: user?.user?.id,
      imported_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from('product_keys')
      .insert(keysToInsert)
      .select();

    setSaving(false);
    if (error) {
      toast.error(`Erro ao importar: ${error.message}`);
      return;
    }

    await adminLog({
      action: 'import_product_keys',
      entity: 'product_keys',
      reason: `Importacao de ${data?.length || 0} chaves para produto ${products.find((p) => p.id === selectedProduct)?.title}`,
      payload: { product_id: selectedProduct, count: data?.length || 0 },
    });

    toast.success(`${data?.length || 0} chaves importadas com sucesso!`);
    setDialogOpen(false);
    setCsvText('');
    load();
  };

  const revokeKey = async (key) => {
    try {
      const { error } = await supabase
        .from('product_keys')
        .update({ status: 'revoked' })
        .eq('id', key.id);

      if (error) throw error;

      await adminLog({
        action: 'revoke_product_key',
        entity: 'product_keys',
        entity_id: key.id,
        reason: `Chave "${key.key_code}" revogada`,
        payload: { key_code: key.key_code, product: key.product_title },
      });

      toast.success('Chave revogada!');
      load();
    } catch (error) {
      toast.error(error.message || 'Erro ao revogar chave');
    }
  };

  const deleteKey = async (key) => {
    try {
      const { error } = await supabase
        .from('product_keys')
        .delete()
        .eq('id', key.id);

      if (error) throw error;

      await adminLog({
        action: 'delete_product_key',
        entity: 'product_keys',
        entity_id: key.id,
        reason: `Chave "${key.key_code}" excluida`,
        payload: { key_code: key.key_code },
      });

      toast.success('Chave excluida!');
      load();
    } catch (error) {
      toast.error(error.message || 'Erro ao excluir chave');
    }
  };

  const exportData = () => {
    setExporting(true);
    const data = keys.map((k) => ({
      Codigo: k.key_code,
      Produto: k.product_title || '—',
      Plataforma: k.platform || '—',
      Status: STATUS_LABELS[k.status] || k.status,
      'Importada em': formatDateTime(k.imported_at),
      'Vendida em': k.sold_at ? formatDateTime(k.sold_at) : '—',
      'Expira em': k.expires_at ? formatDateTime(k.expires_at) : '—',
    }));
    exportCsv(`chaves-${new Date().toISOString().slice(0, 10)}.csv`, data);
    setExporting(false);
    toast.success('Dados exportados!');
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <AdminPageHeader
        icon={Key}
        title="Chaves de Ativacao"
        subtitle="Gerenciamento de chaves de jogos digitais"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportData} disabled={exporting}>
              <Download className="h-4 w-4 mr-1" />
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Exportar'}
            </Button>
            <Button onClick={() => setDialogOpen(true)}>
              <Upload className="h-4 w-4 mr-1" /> Importar Chaves
            </Button>
          </div>
        }
      />

      <Card className="border-border/50">
        <CardContent className="p-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Buscar chave..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44">
              <Filter className="h-3 w-3 mr-1" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Produto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os produtos</SelectItem>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setStatusFilter('all'); setProductFilter('all'); }}>
            Limpar
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Codigo</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Plataforma</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead>Importada</TableHead>
                <TableHead className="text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="p-0">
                    <EstadoVazio titulo="Nenhuma chave encontrada" />
                  </TableCell>
                </TableRow>
              ) : (
                keys.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="font-mono text-sm">{k.key_code}</TableCell>
                    <TableCell className="text-sm">{k.product_title || '—'}</TableCell>
                    <TableCell className="text-sm">{k.platform || '—'}</TableCell>
                    <TableCell className="text-center">
                      <Badge className={STATUS_COLORS[k.status] || ''}>
                        {STATUS_LABELS[k.status] || k.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(k.imported_at)}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {k.status === 'available' && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => revokeKey(k)}>
                            <X className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteKey(k)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                      {k.status === 'sold' && (
                        <span className="text-xs text-muted-foreground">Entregue</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) setDialogOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar Chaves</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Produto *</Label>
              <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Plataforma (opcional)</Label>
              <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma</SelectItem>
                  <SelectItem value="Steam">Steam</SelectItem>
                  <SelectItem value="Epic">Epic Games</SelectItem>
                  <SelectItem value="Xbox">Xbox</SelectItem>
                  <SelectItem value="PlayStation">PlayStation</SelectItem>
                  <SelectItem value="Nintendo">Nintendo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Chaves (uma por linha)</Label>
              <Textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                rows={8}
                placeholder="CHAVE-1&#10;CHAVE-2&#10;CHAVE-3"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Cole as chaves, uma por linha. Cada linha sera importada como uma chave individual.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={importKeys} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Importar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
