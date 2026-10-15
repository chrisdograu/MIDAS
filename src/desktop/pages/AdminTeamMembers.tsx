
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
import { useDesktopAuth } from '@/hooks/useDesktopAuth';
import ImageGalleryField from '../components/ImageGalleryField';
import { removeStoredImages, unusedImages } from '@/lib/storageCleanup';

const ITEMS_PER_PAGE = 20;

export default function AdminTeamMembers() {
  const { position } = useDesktopAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(0);

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
        query = query.ilike('name', `%${search}%`);
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

  useEffect(() => { setPage(0); if (position === 'admin') load(); }, [search, position]);

  const closeDialog = () => {
    const before = editing ? [editing.photo_url, editing.banner_url] : [];
    void removeStoredImages(unusedImages([form.photo_url, form.banner_url], before));
    setDialogOpen(false);
    resetForm();
  };

  const generateSlug = (name) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
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
      toast.error('Nome e cargo são obrigatórios');
      return;
    }

    const slug = form.slug.trim() || generateSlug(form.name);
    if (!slug) { toast.error('Informe um endereço válido para o membro'); return; }
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
        const { data, error } = await supabase
          .from('team_members')
          .update(payload)
          .eq('id', editing.id).select('id').maybeSingle();

        if (error) throw error;
        if (!data) throw new Error('Não foi possível atualizar o membro. Verifique seu acesso.');
        await removeStoredImages(unusedImages(
          [editing.photo_url, editing.banner_url],
          [payload.photo_url, payload.banner_url],
        ));

        await adminLog({
          action: 'update_team_member',
          entity: 'team_members',
          entity_id: editing.id,
          reason: `Membro "${payload.name}" atualizado`,
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
          reason: `Membro "${payload.name}" criado`,
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
        reason: `Membro "${member.name}" ${member.is_active ? 'desativado' : 'ativado'}`,
        payload: { name: member.name, is_active: !member.is_active },
      });

      toast.success(`Membro ${member.is_active ? 'desativado' : 'ativado'}!`);
      load();
    } catch (error) {
      toast.error(error.message || 'Erro ao alterar status');
    }
  };

  const moveMember = async (member, direction) => {
    const index = members.findIndex((m) => m.id === member.id);
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === members.length - 1) return;

    try {
      const { error } = await supabase.rpc('admin_move_team_member', { _member_id: member.id, _direction: direction });
      if (error) throw error;
      await load();
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
      await removeStoredImages([deleteTarget.photo_url, deleteTarget.banner_url]);

      await adminLog({
        action: 'delete_team_member',
        entity: 'team_members',
        entity_id: deleteTarget.id,
        reason: `Membro "${deleteTarget.name}" excluído`,
        payload: { name: deleteTarget.name },
      });

      toast.success('Membro excluído!');
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
      Ativo: m.is_active ? 'Sim' : 'Não',
      Ordem: m.display_order || 0,
      Bio: m.bio || '',
      GitHub: m.social_links?.github || '',
      LinkedIn: m.social_links?.linkedin || '',
      Twitter: m.social_links?.twitter || '',
      'Criado em': formatDateTime(m.created_at),
    }));
    exportCsv(`equipe-${new Date().toISOString().slice(0, 10)}.csv`, data);
    setExporting(false);
    toast.success('Dados exportados!');
  };

  if (position !== 'admin') return <div className="p-6 text-muted-foreground">Somente administradores podem editar a equipe.</div>;

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
              <Plus className="h-4 w-4 mr-1" /> Novo membro
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
                <TableHead className="text-right">Ações</TableHead>
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
                members.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE).map((m, visibleIndex) => {
                  const index = page * ITEMS_PER_PAGE + visibleIndex;
                  return (
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
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {members.length > ITEMS_PER_PAGE && <div className="flex items-center justify-end gap-2">
        <span className="text-sm text-muted-foreground">Página {page + 1} de {Math.ceil(members.length / ITEMS_PER_PAGE)}</span>
        <Button variant="outline" size="sm" onClick={() => setPage(value => Math.max(0, value - 1))} disabled={page === 0}>Anterior</Button>
        <Button variant="outline" size="sm" onClick={() => setPage(value => Math.min(Math.ceil(members.length / ITEMS_PER_PAGE) - 1, value + 1))} disabled={(page + 1) * ITEMS_PER_PAGE >= members.length}>Próxima</Button>
      </div>}

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o && !saving) closeDialog(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
             <DialogTitle>{editing ? 'Editar membro' : 'Novo membro'}</DialogTitle>
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
            <ImageGalleryField label="Foto da pessoa" value={form.photo_url ? [form.photo_url] : []} onChange={urls => setForm(f => ({ ...f, photo_url: urls[0] || '' }))} maxImages={1} folder="equipe/fotos" />
            <ImageGalleryField label="Foto de capa" value={form.banner_url ? [form.banner_url] : []} onChange={urls => setForm(f => ({ ...f, banner_url: urls[0] || '' }))} maxImages={1} folder="equipe/capas" />
            <div className="space-y-2 flex items-center gap-2">
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
              <Label>Ativo</Label>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Biografia curta</Label>
              <Textarea
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Descrição completa</Label>
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
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={saving}>Cancelar</Button>
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
