import { useEffect, useState } from 'react';
import { Building2, Plus, Search, Edit, Trash2, Loader2, Download, ChevronLeft, ChevronRight, Globe } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { adminLog, exportCsv } from '../lib/adminLog';
import EstadoVazio from '@/components/EstadoVazio';
import { formatDateTime } from '@/lib/format';

interface Publisher {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  bio: string | null;
  logo_url: string | null;
  banner_url: string | null;
  website: string | null;
  founded_year: number | null;
  country: string | null;
  headquarters: string | null;
  employees: number | null;
  parent_company: string | null;
  notable_games: string[] | null;
  social_links: any;
  wikipedia_url: string | null;
  created_at: string;
  updated_at: string;
  _game_count?: number;
}

const ITEMS_PER_PAGE = 20;

export default function AdminPublishers() {
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Publisher | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Publisher | null>(null);
  const [exporting, setExporting] = useState(false);

  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    bio: '',
    logo_url: '',
    banner_url: '',
    website: '',
    founded_year: '',
    country: '',
    headquarters: '',
    employees: '',
    parent_company: '',
    notable_games: '',
    wikipedia_url: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('publishers')
        .select('*')
        .order('name');
      
      if (search) {
        query = query.ilike('name', `%${search}%`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      const pubIds = (data || []).map(p => p.id);
      let gameCounts = new Map();
      
      if (pubIds.length > 0) {
        const { data: games } = await supabase
          .from('produtos')
          .select('publisher_id')
          .in('publisher_id', pubIds);
        
        const counts = new Map<string, number>();
        games?.forEach(g => {
          counts.set(g.publisher_id, (counts.get(g.publisher_id) || 0) + 1);
        });
        gameCounts = counts;
      }
      
      setPublishers((data || []).map(p => ({
        ...p,
        _game_count: gameCounts.get(p.id) || 0,
      })));
    } catch (error) {
      toast.error('Erro ao carregar publicadoras');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [search]);

  const generateSlug = (name: string) => {
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
      description: '',
      bio: '',
      logo_url: '',
      banner_url: '',
      website: '',
      founded_year: '',
      country: '',
      headquarters: '',
      employees: '',
      parent_company: '',
      notable_games: '',
      wikipedia_url: '',
    });
    setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (p: Publisher) => {
    setEditing(p);
    setForm({
      name: p.name || '',
      slug: p.slug || '',
      description: p.description || '',
      bio: p.bio || '',
      logo_url: p.logo_url || '',
      banner_url: p.banner_url || '',
      website: p.website || '',
      founded_year: p.founded_year ? String(p.founded_year) : '',
      country: p.country || '',
      headquarters: p.headquarters || '',
      employees: p.employees ? String(p.employees) : '',
      parent_company: p.parent_company || '',
      notable_games: (p.notable_games || []).join(', '),
      wikipedia_url: p.wikipedia_url || '',
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    
    const slug = form.slug.trim() || generateSlug(form.name);
    setSaving(true);
    
    const payload = {
      name: form.name.trim(),
      slug: slug,
      description: form.description.trim() || null,
      bio: form.bio.trim() || null,
      logo_url: form.logo_url.trim() || null,
      banner_url: form.banner_url.trim() || null,
      website: form.website.trim() || null,
      founded_year: form.founded_year ? parseInt(form.founded_year) : null,
      country: form.country.trim() || null,
      headquarters: form.headquarters.trim() || null,
      employees: form.employees ? parseInt(form.employees) : null,
      parent_company: form.parent_company.trim() || null,
      notable_games: form.notable_games ? form.notable_games.split(',').map(s => s.trim()).filter(Boolean) : null,
      wikipedia_url: form.wikipedia_url.trim() || null,
    };
    
    try {
      if (editing) {
        const { error } = await supabase
          .from('publishers')
          .update(payload)
          .eq('id', editing.id);
        
        if (error) throw error;
        
        await adminLog({
          action: 'update_publisher',
          entity: 'publishers',
          entity_id: editing.id,
          reason: `Publicadora "${payload.name}" atualizada`,
          payload: { before: { name: editing.name }, after: { name: payload.name } },
        });
        
        toast.success('Publicadora atualizada!');
      } else {
        const { data, error } = await supabase
          .from('publishers')
          .insert(payload)
          .select('id')
          .single();
        
        if (error) throw error;
        
        await adminLog({
          action: 'create_publisher',
          entity: 'publishers',
          entity_id: data?.id,
          reason: `Publicadora "${payload.name}" criada`,
          payload: { name: payload.name, slug: payload.slug },
        });
        
        toast.success('Publicadora criada!');
      }
      
      setDialogOpen(false);
      resetForm();
      load();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar publicadora');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('publishers')
        .delete()
        .eq('id', deleteTarget.id);
      
      if (error) throw error;
      
      await adminLog({
        action: 'delete_publisher',
        entity: 'publishers',
        entity_id: deleteTarget.id,
        reason: `Publicadora "${deleteTarget.name}" excluída`,
        payload: { name: deleteTarget.name },
      });
      
      toast.success('Publicadora excluída!');
      setDeleteTarget(null);
      load();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao excluir publicadora');
    } finally {
      setSaving(false);
    }
  };

  const exportData = () => {
    setExporting(true);
    const data = publishers.map(p => ({
      Nome: p.name,
      Slug: p.slug,
      País: p.country || '',
      Sede: p.headquarters || '',
      'Ano de Fundação': p.founded_year || '',
      'Jogos Notáveis': (p.notable_games || []).join(', '),
      'Jogos na Plataforma': p._game_count || 0,
      Website: p.website || '',
      'Criado em': formatDateTime(p.created_at),
    }));
    exportCsv(`publicadoras-${new Date().toISOString().slice(0, 10)}.csv`, data);
    setExporting(false);
    toast.success('Dados exportados!');
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <AdminPageHeader
        icon={Building2}
        title="Publicadoras"
        subtitle="Gerenciamento de publicadoras de jogos"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportData} disabled={exporting}>
              <Download className="h-4 w-4 mr-1" />
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Exportar'}
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> Nova Publicadora
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
              placeholder="Buscar publicadora..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Publicadora</TableHead>
                <TableHead>País</TableHead>
                <TableHead className="text-center">Jogos</TableHead>
                <TableHead>Ano</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {publishers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="p-0">
                    <EstadoVazio titulo="Nenhuma publicadora encontrada" />
                  </TableCell>
                </TableRow>
              ) : (
                publishers.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {p.logo_url ? (
                          <img src={p.logo_url} alt={p.name} className="w-8 h-8 rounded object-cover" loading="lazy" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-sm">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.slug}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{p.country || '—'}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{p._game_count || 0}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{p.founded_year || '—'}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(p)}>
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
            <DialogTitle>{editing ? 'Editar Publicadora' : 'Nova Publicadora'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={form.name}
                onChange={e => {
                  setForm({ ...form, name: e.target.value });
                  if (!form.slug) {
                    setForm(f => ({ ...f, slug: generateSlug(e.target.value) }));
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input
                value={form.slug}
                onChange={e => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Descrição</Label>
              <Textarea
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Logo URL</Label>
              <Input
                value={form.logo_url}
                onChange={e => setForm({ ...form, logo_url: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Banner URL</Label>
              <Input
                value={form.banner_url}
                onChange={e => setForm({ ...form, banner_url: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Website</Label>
              <Input
                value={form.website}
                onChange={e => setForm({ ...form, website: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Ano de Fundação</Label>
              <Input
                type="number"
                value={form.founded_year}
                onChange={e => setForm({ ...form, founded_year: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>País</Label>
              <Input
                value={form.country}
                onChange={e => setForm({ ...form, country: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Sede</Label>
              <Input
                value={form.headquarters}
                onChange={e => setForm({ ...form, headquarters: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Jogos Notáveis</Label>
              <Input
                value={form.notable_games}
                onChange={e => setForm({ ...form, notable_games: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Wikipedia URL</Label>
              <Input
                value={form.wikipedia_url}
                onChange={e => setForm({ ...form, wikipedia_url: e.target.value })}
              />
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
            <AlertDialogTitle>Excluir publicadora?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "<b>{deleteTarget?.name}</b>"?
              {deleteTarget && deleteTarget._game_count && deleteTarget._game_count > 0 && (
                <span className="block mt-2 text-warning">
                  ⚠️ Esta publicadora possui <b>{deleteTarget._game_count}</b> jogos vinculados.
                </span>
              )}
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