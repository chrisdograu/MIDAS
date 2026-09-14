#!/usr/bin/env node

/**
 * Script para implementar a FASE 2 dos gaps do Desktop
 * 
 * Como usar:
 *   node scripts/implementar-gaps-desktop-fase2.cjs
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PAGES_DIR = path.join(PROJECT_ROOT, 'src', 'desktop', 'pages');

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

function log(msg, color = RESET) { console.log(`${color}${msg}${RESET}`); }
function logSuccess(msg) { log(`✅ ${msg}`, GREEN); }
function logError(msg) { log(`❌ ${msg}`, RED); }
function logStep(msg) { log(`\n🔹 ${msg}`, BLUE); }

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf8');
  logSuccess(`Criado: ${path.basename(filePath)}`);
}

// ============================================================
// 1. AdminCuratedLists.tsx
// ============================================================

function createAdminCuratedLists() {
  const filePath = path.join(PAGES_DIR, 'AdminCuratedLists.tsx');
  
  const content = `
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
        .select(\`
          *,
          creator:profiles!created_by(display_name),
          items:curated_list_items(count),
          follows:curated_list_follows(count)
        \`)
        .order('created_at', { ascending: false });

      if (search) {
        query = query.ilike('title', \`%\${search}%\`);
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
      .replace(/[\\u0300-\\u036f]/g, '')
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
          reason: \`Lista "\${payload.title}" atualizada\`,
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
          reason: \`Lista "\${payload.title}" criada\`,
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
        reason: \`Lista "\${deleteTarget.title}" excluida\`,
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
    exportCsv(\`listas-curadas-\${new Date().toISOString().slice(0, 10)}.csv\`, data);
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
`;

  writeFile(filePath, content);
  logSuccess('AdminCuratedLists.tsx criado');
}

// ============================================================
// 2. AdminTeamMembers.tsx
// ============================================================

function createAdminTeamMembers() {
  const filePath = path.join(PAGES_DIR, 'AdminTeamMembers.tsx');
  
  const content = `
import { useEffect, useState } from 'react';
import { Users, Plus, Search, Edit, Trash2, Loader2, Download, ArrowUp, ArrowDown } from 'lucide-react';
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { adminLog, exportCsv } from '../lib/adminLog';
import EstadoVazio from '@/components/EstadoVazio';
import { formatDateTime } from '@/lib/format';

const ITEMS_PER_PAGE = 20;

export default function AdminTeamMembers() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [exporting, setExporting] = useState(false);

  const [form, setForm] = useState({
    name: '',
    slug: '',
    role: '',
    photo_url: '',
    banner_url: '',
    bio: '',
    long_description: '',
    github: '',
    linkedin: '',
    twitter: '',
    website: '',
    email: '',
    is_active: true,
  });

  const load = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('team_members')
        .select('*')
        .order('display_order', { ascending: true });

      if (search) {
        query = query.ilike('name', \`%\${search}%\`);
      }

      const { data, error } = await query;
      if (error) throw error;

      setMembers(data || []);
    } catch (error) {
      toast.error('Erro ao carregar membros');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [search]);

  const generateSlug = (name) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\\u0300-\\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const resetForm = () => {
    setForm({
      name: '',
      slug: '',
      role: '',
      photo_url: '',
      banner_url: '',
      bio: '',
      long_description: '',
      github: '',
      linkedin: '',
      twitter: '',
      website: '',
      email: '',
      is_active: true,
    });
    setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (m) => {
    setEditing(m);
    setForm({
      name: m.name || '',
      slug: m.slug || '',
      role: m.role || '',
      photo_url: m.photo_url || '',
      banner_url: m.banner_url || '',
      bio: m.bio || '',
      long_description: m.long_description || '',
      github: m.social_links?.github || '',
      linkedin: m.social_links?.linkedin || '',
      twitter: m.social_links?.twitter || '',
      website: m.social_links?.website || '',
      email: m.social_links?.email || '',
      is_active: m.is_active !== undefined ? m.is_active : true,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.role.trim()) {
      toast.error('Nome e cargo sao obrigatorios');
      return;
    }

    const slug = form.slug.trim() || generateSlug(form.name);
    setSaving(true);

    const payload = {
      name: form.name.trim(),
      slug: slug,
      role: form.role.trim(),
      photo_url: form.photo_url.trim() || null,
      banner_url: form.banner_url.trim() || null,
      bio: form.bio.trim() || null,
      long_description: form.long_description.trim() || null,
      social_links: {
        github: form.github.trim() || null,
        linkedin: form.linkedin.trim() || null,
        twitter: form.twitter.trim() || null,
        website: form.website.trim() || null,
        email: form.email.trim() || null,
      },
      is_active: form.is_active,
    };

    try {
      if (editing) {
        const { error } = await supabase
          .from('team_members')
          .update(payload)
          .eq('id', editing.id);

        if (error) throw error;

        await adminLog({
          action: 'update_team_member',
          entity: 'team_members',
          entity_id: editing.id,
          reason: \`Membro "\${payload.name}" atualizado\`,
          payload: { before: { name: editing.name }, after: { name: payload.name } },
        });

        toast.success('Membro atualizado!');
      } else {
        const maxOrder = members.reduce((max, m) => Math.max(max, m.display_order || 0), 0);
        const { data, error } = await supabase
          .from('team_members')
          .insert({ ...payload, display_order: maxOrder + 1 })
          .select('id')
          .single();

        if (error) throw error;

        await adminLog({
          action: 'create_team_member',
          entity: 'team_members',
          entity_id: data?.id,
          reason: \`Membro "\${payload.name}" criado\`,
          payload: { name: payload.name, role: payload.role },
        });

        toast.success('Membro criado!');
      }

      setDialogOpen(false);
      resetForm();
      load();
    } catch (error) {
      toast.error(error.message || 'Erro ao salvar membro');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (member) => {
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ is_active: !member.is_active })
        .eq('id', member.id);

      if (error) throw error;

      await adminLog({
        action: member.is_active ? 'deactivate_team_member' : 'activate_team_member',
        entity: 'team_members',
        entity_id: member.id,
        reason: \`Membro "\${member.name}" \${member.is_active ? 'desativado' : 'ativado'}\`,
        payload: { name: member.name, is_active: !member.is_active },
      });

      toast.success(\`Membro \${member.is_active ? 'desativado' : 'ativado'}!\`);
      load();
    } catch (error) {
      toast.error(error.message || 'Erro ao alterar status');
    }
  };

  const moveMember = async (member, direction) => {
    const index = members.findIndex((m) => m.id === member.id);
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === members.length - 1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const newOrder = [...members];
    [newOrder[index].display_order, newOrder[newIndex].display_order] =
      [newOrder[newIndex].display_order, newOrder[index].display_order];

    try {
      await supabase
        .from('team_members')
        .update({ display_order: newOrder[index].display_order })
        .eq('id', newOrder[index].id);
      await supabase
        .from('team_members')
        .update({ display_order: newOrder[newIndex].display_order })
        .eq('id', newOrder[newIndex].id);

      setMembers(newOrder);
    } catch (error) {
      toast.error('Erro ao reordenar');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', deleteTarget.id);

      if (error) throw error;

      await adminLog({
        action: 'delete_team_member',
        entity: 'team_members',
        entity_id: deleteTarget.id,
        reason: \`Membro "\${deleteTarget.name}" excluido\`,
        payload: { name: deleteTarget.name },
      });

      toast.success('Membro excluido!');
      setDeleteTarget(null);
      load();
    } catch (error) {
      toast.error(error.message || 'Erro ao excluir membro');
    } finally {
      setSaving(false);
    }
  };

  const exportData = () => {
    setExporting(true);
    const data = members.map((m) => ({
      Nome: m.name,
      Cargo: m.role,
      Ativo: m.is_active ? 'Sim' : 'Nao',
      Ordem: m.display_order || 0,
      Bio: m.bio || '',
      GitHub: m.social_links?.github || '',
      LinkedIn: m.social_links?.linkedin || '',
      Twitter: m.social_links?.twitter || '',
      'Criado em': formatDateTime(m.created_at),
    }));
    exportCsv(\`equipe-\${new Date().toISOString().slice(0, 10)}.csv\`, data);
    setExporting(false);
    toast.success('Dados exportados!');
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <AdminPageHeader
        icon={Users}
        title="Equipe"
        subtitle="Gerenciamento de membros da equipe"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportData} disabled={exporting}>
              <Download className="h-4 w-4 mr-1" />
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Exportar'}
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> Novo Membro
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
              placeholder="Buscar membro..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Membro</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="p-0">
                    <EstadoVazio titulo="Nenhum membro encontrado" />
                  </TableCell>
                </TableRow>
              ) : (
                members.map((m, index) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-sm text-muted-foreground">{index + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {m.photo_url ? (
                          <img src={m.photo_url} alt={m.name} className="w-8 h-8 rounded-full object-cover" loading="lazy" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                            <Users className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-sm">{m.name}</p>
                          <p className="text-xs text-muted-foreground">{m.slug}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{m.role}</TableCell>
                    <TableCell className="text-center">
                      <Badge className={m.is_active ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'}>
                        {m.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => moveMember(m, 'up')} disabled={index === 0}>
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => moveMember(m, 'down')} disabled={index === members.length - 1}>
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleActive(m)}>
                        {m.is_active ? 'Desativar' : 'Ativar'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(m)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(m)}>
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
            <DialogTitle>{editing ? 'Editar Membro' : 'Novo Membro'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={form.name}
                onChange={(e) => {
                  setForm({ ...form, name: e.target.value });
                  if (!form.slug) {
                    setForm((f) => ({ ...f, slug: generateSlug(e.target.value) }));
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
              />
            </div>
            <div className="space-y-2">
              <Label>Cargo *</Label>
              <Input
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                placeholder="Desenvolvedor Full Stack"
              />
            </div>
            <div className="space-y-2">
              <Label>Foto (URL)</Label>
              <Input
                value={form.photo_url}
                onChange={(e) => setForm({ ...form, photo_url: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Banner (URL)</Label>
              <Input
                value={form.banner_url}
                onChange={(e) => setForm({ ...form, banner_url: e.target.value })}
              />
            </div>
            <div className="space-y-2 flex items-center gap-2">
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
              <Label>Ativo</Label>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Bio (curta)</Label>
              <Textarea
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
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
              <Label>GitHub</Label>
              <Input value={form.github} onChange={(e) => setForm({ ...form, github: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>LinkedIn</Label>
              <Input value={form.linkedin} onChange={(e) => setForm({ ...form, linkedin: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Twitter</Label>
              <Input value={form.twitter} onChange={(e) => setForm({ ...form, twitter: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Website</Label>
              <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
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
            <AlertDialogTitle>Excluir membro?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "<b>{deleteTarget?.name}</b>" da equipe?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
`;

  writeFile(filePath, content);
  logSuccess('AdminTeamMembers.tsx criado');
}

// ============================================================
// 3. AdminChaves.tsx
// ============================================================

function createAdminChaves() {
  const filePath = path.join(PAGES_DIR, 'AdminChaves.tsx');
  
  const content = `
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
      toast.error(\`Erro ao importar: \${error.message}\`);
      return;
    }

    await adminLog({
      action: 'import_product_keys',
      entity: 'product_keys',
      reason: \`Importacao de \${data?.length || 0} chaves para produto \${products.find((p) => p.id === selectedProduct)?.title}\`,
      payload: { product_id: selectedProduct, count: data?.length || 0 },
    });

    toast.success(\`\${data?.length || 0} chaves importadas com sucesso!\`);
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
        reason: \`Chave "\${key.key_code}" revogada\`,
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
        reason: \`Chave "\${key.key_code}" excluida\`,
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
    exportCsv(\`chaves-\${new Date().toISOString().slice(0, 10)}.csv\`, data);
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
`;

  writeFile(filePath, content);
  logSuccess('AdminChaves.tsx criado');
}

// ============================================================
// FUNÇÃO PRINCIPAL
// ============================================================

function main() {
  console.log('\n🚀 Implementando FASE 2 dos gaps do DESKTOP...\n');
  console.log('='.repeat(60) + '\n');

  try {
    logStep('Criando telas novas...');
    createAdminCuratedLists();
    createAdminTeamMembers();
    createAdminChaves();

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ FASE 2 DO DESKTOP EXECUTADA COM SUCESSO!\n');

    console.log('📋 Resumo:');
    console.log('  📄 3 telas novas:');
    console.log('     - AdminCuratedLists.tsx (Listas Curadas)');
    console.log('     - AdminTeamMembers.tsx (Equipe)');
    console.log('     - AdminChaves.tsx (Chaves de Ativacao)');

    console.log('\n📌 Proximos passos:');
    console.log('  1. Reiniciar o servidor: npm run dev');
    console.log('  2. Testar as novas telas:');
    console.log('     - /desktop/listas-curadas');
    console.log('     - /desktop/equipe');
    console.log('     - /desktop/chaves');

    console.log('\n🎮 MIDIAS Desktop FASE 2 concluida!\n');

  } catch (error) {
    console.error('Erro:', error);
    process.exit(1);
  }
}

main();