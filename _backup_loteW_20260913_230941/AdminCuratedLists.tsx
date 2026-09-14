
import { useEffect, useState } from 'react';
import { List, Plus, Search, Edit, Trash2, Loader2, Download, Filter, Check, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { adminLog, exportCsv } from '../lib/adminLog';
import EstadoVazio from '@/components/EstadoVazio';
import { formatDateTime } from '@/lib/format';

const CATEGORIES = [
  { value: 'recomendados', label: 'Recomendados' },
  { value: 'classicos', label: 'Classicos' },
  { value: 'indie', label: 'Indie' },
  { value: 'oficial', label: 'Oficial MIDIAS' },
  { value: 'comunidade', label: 'Comunidade' },
];

const ITEMS_PER_PAGE = 20;

export default function AdminCuratedLists() {
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [exporting, setExporting] = useState(false);

  const [form, setForm] = useState({
    title: '',
    slug: '',
    description: '',
    long_description: '',
    category: 'recomendados',
    is_official: false,
    is_featured: false,
    cover_image: '',
    banner_image: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('curated_lists')
        .select(`
          *,
          creator:profiles!created_by(display_name),
          items:curated_list_items(count),
          follows:curated_list_follows(count)
        `)
        .order('created_at', { ascending: false });

      if (search) {
        query = query.ilike('title', `%${search}%`);
      }
      if (categoryFilter !== 'all') {
        query = query.eq('category', categoryFilter);
      }
      if (statusFilter === 'pending') {
        query = query.is('approved_at', null);
      } else if (statusFilter === 'approved') {
        query = query.not('approved_at', 'is', null);
      } else if (statusFilter === 'official') {
        query = query.eq('is_official', true);
      }

      const { data, error } = await query;
      if (error) throw error;

      setLists((data || []).map((item) => ({
        ...item,
        creator_name: item.creator?.display_name || 'Usuario',
        item_count: item.items?.[0]?.count || 0,
        follow_count: item.follows?.[0]?.count || 0,
      })));
    } catch (error) {
      toast.error('Erro ao carregar listas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [search, categoryFilter, statusFilter]);

  const generateSlug = (title) => {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const resetForm = () => {
    setForm({
      title: '',
      slug: '',
      description: '',
      long_description: '',
      category: 'recomendados',
      is_official: false,
      is_featured: false,
      cover_image: '',
      banner_image: '',
    });
    setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (list) => {
    setEditing(list);
    setForm({
      title: list.title || '',
      slug: list.slug || '',
      description: list.description || '',
      long_description: list.long_description || '',
      category: list.category || 'recomendados',
      is_official: list.is_official || false,
      is_featured: list.is_featured || false,
      cover_image: list.cover_image || '',
      banner_image: list.banner_image || '',
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) {
      toast.error('Titulo é obrigatorio');
      return;
    }

    const slug = form.slug.trim() || generateSlug(form.title);
    setSaving(true);

    const payload = {
      title: form.title.trim(),
      slug: slug,
      description: form.description.trim() || null,
      long_description: form.long_description.trim() || null,
      category: form.category || 'recomendados',
      is_official: form.is_official,
      is_featured: form.is_featured,
      is_public: true,
      cover_image: form.cover_image.trim() || null,
      banner_image: form.banner_image.trim() || null,
    };

    try {
      if (editing) {
        const { error } = await supabase.rpc('admin_update_curated_list', {
          _id: editing.id,
          _title: payload.title,
          _slug: payload.slug,
          _description: payload.description,
          _long_description: payload.long_description,
          _category: payload.category,
          _is_official: payload.is_official,
          _is_featured: payload.is_featured,
          _is_public: true,
          _cover_image: payload.cover_image,
          _banner_image: payload.banner_image,
        });

        if (error) throw error;

        await adminLog({
          action: 'update_curated_list',
          entity: 'curated_lists',
          entity_id: editing.id,
          reason: `Lista "${payload.title}" atualizada`,
          payload: { before: { title: editing.title }, after: { title: payload.title } },
        });

        toast.success('Lista atualizada!');
      } else {
        const { data, error } = await supabase.rpc('admin_create_curated_list', {
          _title: payload.title,
          _slug: payload.slug,
          _description: payload.description,
          _long_description: payload.long_description,
          _category: payload.category,
          _is_official: payload.is_official,
          _is_featured: payload.is_featured,
          _cover_image: payload.cover_image,
          _banner_image: payload.banner_image,
          _items: null,
        });

        if (error) throw error;

        await adminLog({
          action: 'create_curated_list',
          entity: 'curated_lists',
          entity_id: data,
          reason: `Lista "${payload.title}" criada`,
          payload: { title: payload.title, category: payload.category },
        });

        toast.success('Lista criada!');
      }

      setDialogOpen(false);
      resetForm();
      load();
    } catch (error) {
      toast.error(error.message || 'Erro ao salvar lista');
    } finally {
      setSaving(false);
    }
  };

  const approveList = async (listId) => {
    try {
      const { error } = await supabase.rpc('admin_approve_curated_list', { _id: listId });
      if (error) throw error;

      await adminLog({
        action: 'approve_curated_list',
        entity: 'curated_lists',
        entity_id: listId,
        reason: 'Lista aprovada pela moderacao',
        payload: { list_id: listId },
      });

      toast.success('Lista aprovada!');
      load();
    } catch (error) {
      toast.error(error.message || 'Erro ao aprovar lista');
    }
  };

  const deleteList = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('curated_lists')
        .delete()
        .eq('id', deleteTarget.id);

      if (error) throw error;

      await adminLog({
        action: 'delete_curated_list',
        entity: 'curated_lists',
        entity_id: deleteTarget.id,
        reason: `Lista "${deleteTarget.title}" excluida`,
        payload: { title: deleteTarget.title },
      });

      toast.success('Lista excluida!');
      setDeleteTarget(null);
      load();
    } catch (error) {
      toast.error(error.message || 'Erro ao excluir lista');
    } finally {
      setSaving(false);
    }
  };

  const exportData = () => {
    setExporting(true);
    const data = lists.map((l) => ({
      Titulo: l.title,
      Slug: l.slug,
      Categoria: l.category || '—',
      Oficial: l.is_official ? 'Sim' : 'Nao',
      Destaque: l.is_featured ? 'Sim' : 'Nao',
      Aprovada: l.approved_at ? 'Sim' : 'Nao',
      Visualizacoes: l.view_count || 0,
      Seguidores: l.follow_count || 0,
      Itens: l.item_count || 0,
      Criador: l.creator_name || '—',
      'Criado em': formatDateTime(l.created_at),
    }));
    exportCsv(`listas-curadas-${new Date().toISOString().slice(0, 10)}.csv`, data);
    setExporting(false);
    toast.success('Dados exportados!');
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <AdminPageHeader
        icon={List}
        title="Listas Curadas"
        subtitle="Gerenciamento de listas curadas da comunidade"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportData} disabled={exporting}>
              <Download className="h-4 w-4 mr-1" />
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Exportar'}
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> Nova Lista
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
              placeholder="Buscar lista..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="approved">Aprovadas</SelectItem>
              <SelectItem value="official">Oficiais</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setCategoryFilter('all'); setStatusFilter('all'); }}>
            Limpar
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lista</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-center">Itens</TableHead>
                <TableHead className="text-center">Seguidores</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lists.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="p-0">
                    <EstadoVazio titulo="Nenhuma lista encontrada" />
                  </TableCell>
                </TableRow>
              ) : (
                lists.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {l.cover_image ? (
                          <img src={l.cover_image} alt={l.title} className="w-10 h-10 rounded object-cover" loading="lazy" />
                        ) : (
                          <div className="w-10 h-10 rounded bg-secondary flex items-center justify-center">
                            <List className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-sm">{l.title}</p>
                          <p className="text-xs text-muted-foreground">{l.slug}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{l.category || '—'}</Badge>
                      {l.is_official && (
                        <Badge className="ml-1 bg-primary/10 text-primary">Oficial</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{l.item_count || 0}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="gap-1">
                        <Users className="h-3 w-3" /> {l.follow_count || 0}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {!l.approved_at ? (
                        <Badge className="bg-warning/15 text-warning">Pendente</Badge>
                      ) : (
                        <Badge className="bg-success/15 text-success">Aprovada</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(l.created_at)}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {!l.approved_at && (
                        <Button size="sm" variant="outline" className="text-success" onClick={() => approveList(l.id)}>
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => openEdit(l)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(l)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) setDialogOpen(false); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Lista' : 'Nova Lista'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Titulo *</Label>
              <Input
                value={form.title}
                onChange={(e) => {
                  setForm({ ...form, title: e.target.value });
                  if (!form.slug) {
                    setForm((f) => ({ ...f, slug: generateSlug(e.target.value) }));
                  }
                }}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Slug</Label>
              <Input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Descricao Curta</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Descricao Longa</Label>
              <Textarea
                value={form.long_description}
                onChange={(e) => setForm({ ...form, long_description: e.target.value })}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Imagem de Capa (URL)</Label>
              <Input
                value={form.cover_image}
                onChange={(e) => setForm({ ...form, cover_image: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label>Banner (URL)</Label>
              <Input
                value={form.banner_image}
                onChange={(e) => setForm({ ...form, banner_image: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.is_official}
                  onCheckedChange={(v) => setForm({ ...form, is_official: v })}
                />
                <Label>Lista Oficial</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.is_featured}
                  onCheckedChange={(v) => setForm({ ...form, is_featured: v })}
                />
                <Label>Em Destaque</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lista?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "<b>{deleteTarget?.title}</b>"?
              {deleteTarget && deleteTarget.item_count && deleteTarget.item_count > 0 && (
                <span className="block mt-2 text-warning">
                  ⚠️ Esta lista possui <b>{deleteTarget.item_count}</b> itens.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteList} className="bg-destructive text-destructive-foreground" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
