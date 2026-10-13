import { useEffect, useState, useMemo } from 'react';
import { Building2, Plus, Search, Edit, Trash2, Loader2, Download, ChevronLeft, ChevronRight, Filter, ExternalLink, Globe, MapPin, Users, Calendar, Twitter, Youtube, Instagram, Save, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { adminLog, exportCsv } from '../lib/adminLog';
import EstadoVazio from '@/components/EstadoVazio';
import { formatDateTime } from '@/lib/format';
import { useDesktopAuth } from '@/hooks/useDesktopAuth';
import ImageGalleryField from '../components/ImageGalleryField';
import DeveloperChannelAccess from '@/components/developer/DeveloperChannelAccess';
import { useSearchParams } from 'react-router-dom';
import { escapeIlikeTerm } from '@/lib/escapeIlike';

interface Developer {
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
  social_links: {
    twitter?: string;
    youtube?: string;
    instagram?: string;
    facebook?: string;
    discord?: string;
  } | null;
  wikipedia_url: string | null;
  created_at: string;
  updated_at: string;
  _game_count?: number;
  _avg_rating?: number;
}

const ITEMS_PER_PAGE = 20;

export default function AdminDevelopers() {
  const { position } = useDesktopAuth();
  const [searchParams] = useSearchParams();
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('q') || '');
  useEffect(() => { setSearch(searchParams.get('q') || ''); }, [searchParams]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Developer | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Developer | null>(null);
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
    twitter: '',
    youtube: '',
    instagram: '',
    facebook: '',
    discord: '',
    wikipedia_url: '',
  });

  const load = async (reset: boolean = true) => {
    if (reset) setLoading(true);
    
    try {
      const currentPage = reset ? 0 : page;
      const from = currentPage * ITEMS_PER_PAGE;
      
      let query = supabase
        .from('developers')
        .select('*', { count: 'exact' })
        .order('name');
      
      if (search) {
        query = query.ilike('name', `%${escapeIlikeTerm(search)}%`);
      }
      
      const { data, error, count } = await query.range(from, from + ITEMS_PER_PAGE - 1);
      if (error) throw error;
      
      // Buscar contagem de jogos para cada desenvolvedor
      const devIds = (data || []).map(d => d.id);
      let gameCounts = new Map();
      let avgRatings = new Map();
      
      if (devIds.length > 0) {
        const { data: games } = await supabase
          .from('produtos')
          .select('developer_id, rating')
          .in('developer_id', devIds);
        
        const counts = new Map<string, number>();
        const ratings = new Map<string, number[]>();
        games?.forEach(g => {
          counts.set(g.developer_id, (counts.get(g.developer_id) || 0) + 1);
          if (g.rating) {
            if (!ratings.has(g.developer_id)) ratings.set(g.developer_id, []);
            ratings.get(g.developer_id)?.push(g.rating);
          }
        });
        
        gameCounts = counts;
        ratings.forEach((ratingsList, devId) => {
          avgRatings.set(devId, ratingsList.reduce((a, b) => a + b, 0) / ratingsList.length);
        });
      }
      
      const enriched = (data || []).map(d => ({
        ...d,
        _game_count: gameCounts.get(d.id) || 0,
        _avg_rating: avgRatings.get(d.id) || null,
      }));
      
      if (reset) {
        setDevelopers(enriched);
        setHasMore((data || []).length === ITEMS_PER_PAGE);
        setPage(1);
      } else {
        setDevelopers(prev => [...prev, ...enriched]);
        setHasMore((data || []).length === ITEMS_PER_PAGE);
        setPage(currentPage + 1);
      }
    } catch (error) {
      toast.error('Erro ao carregar desenvolvedores');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (position === 'admin') load(); }, [search, position]);

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
      twitter: '',
      youtube: '',
      instagram: '',
    facebook: '',
    discord: '',
      wikipedia_url: '',
    });
    setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (dev: Developer) => {
    setEditing(dev);
    setForm({
      name: dev.name || '',
      slug: dev.slug || '',
      description: dev.description || '',
      bio: dev.bio || '',
      logo_url: dev.logo_url || '',
      banner_url: dev.banner_url || '',
      website: dev.website || '',
      founded_year: dev.founded_year ? String(dev.founded_year) : '',
      country: dev.country || '',
      headquarters: dev.headquarters || '',
      employees: dev.employees ? String(dev.employees) : '',
      parent_company: dev.parent_company || '',
      notable_games: (dev.notable_games || []).join(', '),
      twitter: dev.social_links?.twitter || '',
      youtube: dev.social_links?.youtube || '',
      instagram: dev.social_links?.instagram || '',
      facebook: dev.social_links?.facebook || '',
      discord: dev.social_links?.discord || '',
      wikipedia_url: dev.wikipedia_url || '',
    });
    setDialogOpen(true);
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    
    const slug = form.slug.trim() || generateSlug(form.name);
    if (!slug) {
      toast.error('Slug inválido');
      return;
    }
    
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
      social_links: {
        twitter: form.twitter.trim() || null,
        youtube: form.youtube.trim() || null,
        instagram: form.instagram.trim() || null,
        facebook: form.facebook.trim() || null,
        discord: form.discord.trim() || null,
      },
      wikipedia_url: form.wikipedia_url.trim() || null,
    };
    
    try {
      if (editing) {
        const { data, error } = await supabase.from('developers').update(payload).eq('id', editing.id).select('id').maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('Não foi possível atualizar o desenvolvedor. Verifique seu acesso.');

        await adminLog({
          action: 'update_developer',
          entity: 'developers',
          entity_id: editing.id,
          reason: `Desenvolvedor "${payload.name}" atualizado`,
          payload: { before: { name: editing.name }, after: { name: payload.name } },
        });
        
        toast.success('Desenvolvedor atualizado!');
      } else {
        const { data: result, error } = await supabase.from('developers').insert(payload).select('id').single();
        if (error) throw error;

        await adminLog({
          action: 'create_developer',
          entity: 'developers',
          entity_id: result.id,
          reason: `Desenvolvedor "${payload.name}" criado`,
          payload: { name: payload.name, slug: payload.slug },
        });
        
        toast.success('Desenvolvedor criado!');
      }
      
      setDialogOpen(false);
      resetForm();
      load();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar desenvolvedor');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    
    setSaving(true);
    try {
      const { data, error } = await supabase.from('developers').delete().eq('id', deleteTarget.id).select('id').maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Não foi possível excluir o desenvolvedor. Verifique seu acesso.');

      await adminLog({
        action: 'delete_developer',
        entity: 'developers',
        entity_id: deleteTarget.id,
        reason: `Desenvolvedor "${deleteTarget.name}" excluído`,
        payload: { name: deleteTarget.name },
      });
      
      toast.success('Desenvolvedor excluído!');
      setDeleteTarget(null);
      load();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao excluir desenvolvedor');
    } finally {
      setSaving(false);
    }
  };

  const exportData = () => {
    setExporting(true);
    const data = developers.map(d => ({
      Nome: d.name,
      Slug: d.slug,
      País: d.country || '',
      Sede: d.headquarters || '',
      'Ano de Fundação': d.founded_year || '',
      Funcionários: d.employees || '',
      'Empresa Mãe': d.parent_company || '',
      'Jogos Notáveis': (d.notable_games || []).join(', '),
      'Jogos na Plataforma': d._game_count || 0,
      'Avaliação Média': d._avg_rating?.toFixed(1) || '-',
      Website: d.website || '',
      'Criado em': formatDateTime(d.created_at),
    }));
    exportCsv(`desenvolvedores-${new Date().toISOString().slice(0, 10)}.csv`, data);
    setExporting(false);
    toast.success('Dados exportados!');
  };

  const totalPages = Math.ceil(developers.length / ITEMS_PER_PAGE);
  const paginated = developers.slice(0, (page + 1) * ITEMS_PER_PAGE);

  if (position !== 'admin') return <div className="p-6 text-muted-foreground">Somente administradores podem editar desenvolvedores.</div>;

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <AdminPageHeader
        icon={Building2}
        title="Desenvolvedores"
        subtitle="Gerenciamento de estúdios e desenvolvedores de jogos"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportData} disabled={exporting}>
              <Download className="h-4 w-4 mr-1" />
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Exportar'}
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> Novo Desenvolvedor
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
              placeholder="Buscar desenvolvedor..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); }}>
            Limpar
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Desenvolvedor</TableHead>
                <TableHead>País</TableHead>
                <TableHead className="text-center">Jogos</TableHead>
                <TableHead className="text-center">Avaliação</TableHead>
                <TableHead>Ano</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="p-0">
                    <EstadoVazio titulo="Nenhum desenvolvedor encontrado" />
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map(d => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {d.logo_url ? (
                          <img src={d.logo_url} alt={d.name} className="w-8 h-8 rounded object-cover" loading="lazy" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-sm">{d.name}</p>
                          <p className="text-xs text-muted-foreground">{d.slug}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{d.country || '—'}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{d._game_count || 0}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {d._avg_rating ? (
                        <span className="text-sm font-medium text-warning">
                          {d._avg_rating.toFixed(1)} ⭐
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{d.founded_year || '—'}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(d)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(d)}>
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

      {/* Dialog de Criação/Edição */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) setDialogOpen(false); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Desenvolvedor' : 'Novo Desenvolvedor'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                aria-label="Nome do desenvolvedor"
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
                aria-label="Endereço do desenvolvedor"
                value={form.slug}
                onChange={e => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                placeholder="gerado-automaticamente"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Bio (resumo curto)</Label>
              <Textarea
                value={form.bio}
                onChange={e => setForm({ ...form, bio: e.target.value })}
                rows={2}
                maxLength={200}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Descrição (completa)</Label>
              <Textarea
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                rows={4}
              />
            </div>
            <ImageGalleryField label="Logo do desenvolvedor" value={form.logo_url ? [form.logo_url] : []} onChange={urls => setForm(f => ({ ...f, logo_url: urls[0] || '' }))} maxImages={1} folder="desenvolvedores/logos" />
            <ImageGalleryField label="Foto de capa" value={form.banner_url ? [form.banner_url] : []} onChange={urls => setForm(f => ({ ...f, banner_url: urls[0] || '' }))} maxImages={1} folder="desenvolvedores/capas" />
            <div className="space-y-2">
              <Label>Website</Label>
              <Input
                value={form.website}
                onChange={e => setForm({ ...form, website: e.target.value })}
                placeholder="https://..."
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
                placeholder="Cidade, País"
              />
            </div>
            <div className="space-y-2">
              <Label>Funcionários</Label>
              <Input
                type="number"
                value={form.employees}
                onChange={e => setForm({ ...form, employees: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Empresa Mãe</Label>
              <Input
                value={form.parent_company}
                onChange={e => setForm({ ...form, parent_company: e.target.value })}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Jogos Notáveis</Label>
              <Input
                value={form.notable_games}
                onChange={e => setForm({ ...form, notable_games: e.target.value })}
                placeholder="Elden Ring, Dark Souls, Bloodborne (separados por vírgula)"
              />
            </div>
            <div className="space-y-2">
              <Label>Twitter</Label>
              <Input
                value={form.twitter}
                onChange={e => setForm({ ...form, twitter: e.target.value })}
                placeholder="https://twitter.com/..."
              />
            </div>
            <div className="space-y-2">
              <Label>YouTube</Label>
              <Input
                value={form.youtube}
                onChange={e => setForm({ ...form, youtube: e.target.value })}
                placeholder="https://youtube.com/..."
              />
            </div>
            <div className="space-y-2">
              <Label>Instagram</Label>
              <Input
                value={form.instagram}
                onChange={e => setForm({ ...form, instagram: e.target.value })}
                placeholder="https://instagram.com/..."
              />
            </div>
            <div className="space-y-2">
              <Label>Wikipédia (link)</Label>
              <Input
                value={form.wikipedia_url}
                onChange={e => setForm({ ...form, wikipedia_url: e.target.value })}
                placeholder="https://en.wikipedia.org/wiki/..."
              />
            </div>
            <div className="space-y-2"><Label>Facebook</Label><Input value={form.facebook} onChange={e => setForm({ ...form, facebook: e.target.value })} /></div>
            <div className="space-y-2"><Label>Discord</Label><Input value={form.discord} onChange={e => setForm({ ...form, discord: e.target.value })} /></div>
            {editing && <DeveloperChannelAccess developerId={editing.id} />}
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
            <AlertDialogTitle>Excluir desenvolvedor?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "<b>{deleteTarget?.name}</b>"?
              {deleteTarget && deleteTarget._game_count && deleteTarget._game_count > 0 && (
                <span className="block mt-2 text-warning">
                  ⚠️ Este desenvolvedor possui <b>{deleteTarget._game_count}</b> jogos vinculados.
                  Eles ficarão sem desenvolvedor após a exclusão.
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