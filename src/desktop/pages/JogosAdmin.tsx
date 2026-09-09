import { useEffect, useMemo, useState } from 'react';
import { Gamepad2, Loader2, Plus, Search, Edit, Download, Star, Eye, ChevronLeft, ChevronRight, Category, Tag } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { adminLog, exportCsv } from '../lib/adminLog';
import EstadoVazio from '@/components/EstadoVazio';
import { formatCurrency } from '@/lib/format';

const ESTADOS = ['ativo', 'oculto', 'somente_forum', 'somente_loja', 'descontinuado'] as const;
type Estado = typeof ESTADOS[number];
const LABELS: Record<Estado, string> = { 
  ativo: 'Ativo', 
  oculto: 'Oculto', 
  somente_forum: 'Somente Fórum', 
  somente_loja: 'Somente Loja', 
  descontinuado: 'Descontinuado' 
};

interface Jogo { 
  id: string; 
  title: string; 
  estado_publicacao: Estado; 
  stock: number; 
  price: number; 
  featured: boolean; 
  is_active: boolean; 
  awaiting_first_stock: boolean;
  category_id: string | null;
  category_name: string | null;
  platform: string[] | null;
}

const PAGE_SIZE = 20;

export default function JogosAdmin() {
  const [jogos, setJogos] = useState<Jogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Jogo | null>(null);
  const [form, setForm] = useState({ price: '', stock: '' });
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('produtos')
      .select('id, title, estado_publicacao, stock, price, featured, is_active, awaiting_first_stock, category_id, platform')
      .order('updated_at', { ascending: false });
    
    // GAP-D150: Buscar nomes das categorias
    const catIds = [...new Set((data || []).map(p => p.category_id).filter(Boolean))] as string[];
    const { data: categories } = catIds.length
      ? await supabase.from('categorias').select('id, name').in('id', catIds)
      : { data: [] as any[] };
    const catMap = new Map(categories?.map(c => [c.id, c.name]) || []);
    
    setJogos((data || []).map((p: any) => ({
      ...p,
      category_name: p.category_id ? (catMap.get(p.category_id) || null) : null,
      platform: p.platform || [],
    })));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // GAP-D149: Paginação
  const filtered = useMemo(() => {
    let result = jogos.filter(j =>
      (estadoFilter === 'all' || j.estado_publicacao === estadoFilter) &&
      (!search || j.title.toLowerCase().includes(search.toLowerCase()))
    );
    return result;
  }, [jogos, estadoFilter, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const updateEstado = async (j: Jogo, estado: Estado) => {
    const patch: any = { estado_publicacao: estado, is_active: estado === 'ativo' || estado === 'somente_loja' };
    if ((estado === 'ativo' || estado === 'somente_loja') && j.stock > 0) patch.awaiting_first_stock = false;
    const { error } = await supabase.from('produtos').update(patch).eq('id', j.id);
    if (error) return toast.error(error.message);
    await adminLog({ 
      action: 'jogo_estado_update', 
      entity: 'produto', 
      entity_id: j.id, 
      reason: `Estado alterado: ${LABELS[j.estado_publicacao]} → ${LABELS[estado]}`,
      payload: { from: j.estado_publicacao, to: estado, title: j.title } 
    });
    toast.success('Estado atualizado'); 
    load();
  };

  const toggleFeatured = async (j: Jogo, val: boolean) => {
    const { error } = await supabase.from('produtos').update({ featured: val }).eq('id', j.id);
    if (error) return toast.error(error.message);
    await adminLog({ 
      action: 'jogo_featured_update', 
      entity: 'produto', 
      entity_id: j.id, 
      reason: val ? 'Adicionado aos destaques' : 'Removido dos destaques',
      payload: { from: j.featured, to: val, title: j.title } 
    });
    setJogos(prev => prev.map(p => p.id === j.id ? { ...p, featured: val } : p));
    toast.success(val ? 'Destacado na Home' : 'Removido dos destaques');
  };

  // GAP-D143: Edição inline
  const openEdit = (j: Jogo) => { 
    setEditing(j); 
    setForm({ price: String(j.price), stock: String(j.stock) }); 
  };

  const saveEdit = async () => {
    if (!editing) return;
    const price = Number(form.price); 
    const stock = Number(form.stock);
    if (isNaN(price) || isNaN(stock)) return toast.error('Valores inválidos');
    if (price < 0 || stock < 0) return toast.error('Valores não podem ser negativos');
    
    const patch: any = { price, stock };
    if (stock > 0 && editing.awaiting_first_stock) patch.awaiting_first_stock = false;
    
    const { error } = await supabase.from('produtos').update(patch).eq('id', editing.id);
    if (error) return toast.error(error.message);
    
    await adminLog({ 
      action: 'jogo_update', 
      entity: 'produto', 
      entity_id: editing.id, 
      reason: `Atualização de preço/estoque`,
      payload: { 
        before: { price: editing.price, stock: editing.stock }, 
        after: { price, stock },
        title: editing.title,
      } 
    });
    
    toast.success('Atualizado'); 
    setEditing(null); 
    load();
  };

  // GAP-D146: Link para edição completa
  const goToFullEdit = (id: string) => {
    navigate(`/desktop/jogos/${id}/editar`);
  };

  // GAP-D148: Exportação
  const exportData = () => {
    const data = filtered.map(j => ({
      Título: j.title,
      Preço: formatCurrency(Number(j.price)),
      Estoque: j.stock,
      Estado: LABELS[j.estado_publicacao],
      Destaque: j.featured ? 'Sim' : 'Não',
      Ativo: j.is_active ? 'Sim' : 'Não',
      Categoria: j.category_name || '—',
      Plataformas: (j.platform || []).join(', '),
    }));
    exportCsv('jogos.csv', data);
    toast.success('Exportado com sucesso');
  };

  return (
    <div className="p-6 space-y-6">
      <AdminPageHeader 
        icon={Gamepad2} 
        title="Jogos — atributos específicos" 
        subtitle="Gênero, plataforma, hype e destaque editorial · Produtos permanece a fonte única de catálogo/estoque"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={exportData}>
              <Download className="h-4 w-4 mr-1" /> Exportar
            </Button>
            <Button onClick={() => navigate('/desktop/jogos/novo')}>
              <Plus className="h-4 w-4 mr-1" /> Novo jogo
            </Button>
          </>
        } 
      />

      <Card className="border-border/50">
        <CardContent className="p-4 flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[200px]">
            <Label className="text-xs">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Título..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Estado</Label>
            <Select value={estadoFilter} onValueChange={setEstadoFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {ESTADOS.map(e => <SelectItem key={e} value={e}>{LABELS[e]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={() => { setSearch(''); setEstadoFilter('all'); setPage(0); }}>
            Limpar
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-20 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : paginated.length === 0 ? (
            <EstadoVazio titulo="Nenhum jogo encontrado" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Plataformas</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                  <TableHead className="text-center">Estoque</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead className="text-center">Destaque</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map(j => (
                  <TableRow key={j.id} className="border-border hover:bg-muted/30">
                    <TableCell className="font-medium">{j.title}</TableCell>
                    <TableCell>
                      {j.category_name ? (
                        <Badge variant="outline" className="text-[10px]">
                          <Category className="h-3 w-3 mr-0.5" /> {j.category_name}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-0.5">
                        {(j.platform || []).slice(0, 2).map(p => (
                          <Badge key={p} variant="secondary" className="text-[8px] py-0 h-4">{p}</Badge>
                        ))}
                        {(j.platform || []).length > 2 && (
                          <Badge variant="secondary" className="text-[8px] py-0 h-4">+{(j.platform || []).length - 2}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(Number(j.price))}</TableCell>
                    <TableCell className="text-center">
                      <span className={j.stock <= 0 ? 'text-destructive' : j.stock <= 5 ? 'text-warning' : ''}>
                        {j.stock}
                      </span>
                      {j.awaiting_first_stock && (
                        <Badge variant="outline" className="ml-1 text-[10px]">aguardando</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={j.estado_publicacao === 'ativo' ? 'default' : 'secondary'}>
                        {LABELS[j.estado_publicacao]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="inline-flex items-center gap-2">
                        <Switch 
                          checked={j.featured} 
                          onCheckedChange={(v) => toggleFeatured(j, v)} 
                          aria-label="Destacar na Home" 
                        />
                        {j.featured && <Star className="h-3.5 w-3.5 text-primary fill-primary" />}
                      </div>
                    </TableCell>
                    <TableCell className="text-right space-x-1 whitespace-nowrap">
                      <Select value={j.estado_publicacao} onValueChange={(v) => updateEstado(j, v as Estado)}>
                        <SelectTrigger className="w-[140px] inline-flex h-8 text-xs">
                          <SelectValue placeholder="Estado" />
                        </SelectTrigger>
                        <SelectContent>
                          {ESTADOS.map(e => <SelectItem key={e} value={e}>{LABELS[e]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="outline" onClick={() => openEdit(j)}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => goToFullEdit(j.id)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* GAP-D149: Paginação */}
      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {filtered.length > 0 
              ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, filtered.length)} de ${filtered.length}` 
              : '0 resultados'}
          </span>
          <div className="flex gap-2 items-center">
            <Button 
              size="sm" 
              variant="outline" 
              disabled={page <= 0} 
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>Página {page + 1} / {totalPages || 1}</span>
            <Button 
              size="sm" 
              variant="outline" 
              disabled={page >= totalPages - 1} 
              onClick={() => setPage(p => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* GAP-D143: Modal de edição inline */}
      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-primary" /> Editar — {editing?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            <div>
              <Label>Preço (R$)</Label>
              <Input 
                type="number" 
                step="0.01" 
                min="0"
                value={form.price} 
                onChange={e => setForm({ ...form, price: e.target.value })} 
              />
            </div>
            <div>
              <Label>Estoque</Label>
              <Input 
                type="number" 
                min="0"
                value={form.stock} 
                onChange={e => setForm({ ...form, stock: e.target.value })} 
              />
            </div>
          </div>
          <Button onClick={saveEdit} className="w-full">
            Salvar alterações
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}