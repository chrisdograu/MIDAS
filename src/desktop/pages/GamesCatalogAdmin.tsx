// Rodada 24 · item 3 — games_catalog não tinha nenhuma tela de administração.
// Essa tabela alimenta o autocomplete de "marcar jogo" no marketplace mobile
// (MNewAd) e a tag de jogo em MMarketplace. Antes só dava para editar via SQL.
import { useEffect, useMemo, useState } from 'react';
import { Gamepad2, Plus, Search, Edit, Trash2, Loader2, RefreshCw, Download, History } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import EstadoVazio from '@/components/EstadoVazio';
import { toast } from 'sonner';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { PLATAFORMAS } from '../components/ProdutoFormFields';
import { adminLog, exportCsv } from '../lib/adminLog';

interface GameRow {
  id: string;
  title: string;
  slug: string;
  cover_url: string | null;
  publisher: string | null;
  platforms: string[] | null;
  tags: string[] | null;
  popularity: number;
  created_at: string;
}

const empty = { title: '', slug: '', cover_url: '', publisher: '', platforms: [] as string[], tags: '', popularity: 0 };

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export default function GamesCatalogAdmin() {
  const [rows, setRows] = useState<GameRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<GameRow | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('games_catalog').select('*').order('title');
    if (error) toast.error(error.message);
    setRows((data as GameRow[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // GAP-D130: Sincronizar com JogosAdmin (produtos)
  // AVISO: esta função só reporta o estado atual, não sincroniza de verdade.
  // Para sincronizar, precisa de uma RPC que crie/atualize games_catalog a partir de produtos.
  const syncWithProducts = async () => {
    setSyncing(true);
    const { data: products } = await supabase
      .from('produtos')
      .select('id, title, catalog_game_id, platform')
      .not('catalog_game_id', 'is', null);
    
    const catalogIds = [...new Set(products?.map(p => p.catalog_game_id).filter(Boolean))] as string[];
    const { data: catalogGames } = await supabase
      .from('games_catalog')
      .select('id, title')
      .in('id', catalogIds);
    
    const catalogMap = new Map(catalogGames?.map(g => [g.id, g.title]) || []);
    
    // Verificar jogos no catálogo que não estão vinculados a nenhum produto
    const linkedIds = new Set(catalogIds);
    const unlinked = rows.filter(r => !linkedIds.has(r.id));
    
    let message = `Catálogo: ${rows.length} jogos. ${catalogIds.length} jogos vinculados a produtos.`;
    if (unlinked.length > 0) {
      message += ` ${unlinked.length} jogos sem vínculo com produtos.`;
    }
    
    await adminLog({
      action: 'sync_catalog_with_products',
      entity: 'games_catalog',
      reason: 'Sincronização com produtos',
      payload: { total: rows.length, linked: catalogIds.length, unlinked: unlinked.length },
    });
    
    toast.info(message);
    setSyncing(false);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => r.title.toLowerCase().includes(q) || (r.publisher || '').toLowerCase().includes(q));
  }, [rows, search]);

  const openNew = () => { setEditing(null); setForm(empty); setDialog(true); };
  const openEdit = (r: GameRow) => {
    setEditing(r.id);
    setForm({
      title: r.title, slug: r.slug, cover_url: r.cover_url || '', publisher: r.publisher || '',
      platforms: r.platforms || [], tags: (r.tags || []).join(', '), popularity: r.popularity || 0,
    });
    setDialog(true);
  };

  // GAP-D131: adminLog
  const save = async () => {
    if (!form.title.trim()) return toast.error('Título obrigatório');
    const slug = (form.slug.trim() || slugify(form.title)).trim();
    if (!slug) return toast.error('Slug inválido');
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      slug,
      cover_url: form.cover_url.trim() || null,
      publisher: form.publisher.trim() || null,
      platforms: form.platforms.length ? form.platforms : null,
      tags: form.tags.split(',').map(s => s.trim()).filter(Boolean),
      popularity: Number(form.popularity) || 0,
    };
    const { error } = editing
      ? await supabase.from('games_catalog').update(payload).eq('id', editing)
      : await supabase.from('games_catalog').insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    
    await adminLog({
      action: editing ? 'update_catalog_game' : 'create_catalog_game',
      entity: 'games_catalog',
      entity_id: editing || 'new',
      reason: `${editing ? 'Atualizado' : 'Criado'} jogo no catálogo: ${form.title}`,
      payload: { titulo: form.title, slug, plataformas: form.platforms },
    });
    
    toast.success(editing ? 'Jogo atualizado' : 'Jogo adicionado ao catálogo');
    setDialog(false); setForm(empty); setEditing(null); load();
  };

  const remove = async () => {
    if (!confirmDelete) return;
    const { error } = await supabase.from('games_catalog').delete().eq('id', confirmDelete.id);
    setConfirmDelete(null);
    if (error) return toast.error(error.message);
    
    await adminLog({
      action: 'delete_catalog_game',
      entity: 'games_catalog',
      entity_id: confirmDelete.id,
      reason: `Jogo removido do catálogo: ${confirmDelete.title}`,
      payload: { titulo: confirmDelete.title, slug: confirmDelete.slug },
    });
    
    toast.success('Removido do catálogo');
    load();
  };

  // Exportar
  const exportData = () => {
    setExporting(true);
    const data = rows.map(r => ({
      Título: r.title,
      Slug: r.slug,
      Publisher: r.publisher || '',
      Plataformas: (r.platforms || []).join(', '),
      Tags: (r.tags || []).join(', '),
      Popularidade: r.popularity,
    }));
    exportCsv('games_catalog.csv', data);
    setExporting(false);
    toast.success('Exportado com sucesso');
  };

  const togglePlatform = (p: string) =>
    setForm(f => ({ ...f, platforms: f.platforms.includes(p) ? f.platforms.filter(x => x !== p) : [...f.platforms, p] }));

  return (
    <div className="p-6 space-y-6">
      <AdminPageHeader
        icon={Gamepad2}
        title="Catálogo de Jogos (tags)"
        subtitle="Base usada para marcar jogos em anúncios e no fórum do mobile"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={syncWithProducts} disabled={syncing}>
              <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Sincronizando...' : 'Sincronizar'}
            </Button>
            <Button variant="outline" size="sm" onClick={exportData} disabled={exporting}>
              <Download className="h-4 w-4 mr-1" />
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Exportar'}
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por título ou publisher…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" />Novo jogo</Button>
      </div>

      <Card className="border-border/50"><CardContent className="p-0">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <EstadoVazio titulo="Nenhum jogo no catálogo" descricao="Cadastre jogos para que apareçam no fórum e nos filtros da loja." />
        ) : (
          <Table>
            <TableHeader><TableRow className="border-border">
              <TableHead>Título</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Publisher</TableHead>
              <TableHead>Plataformas</TableHead>
              <TableHead className="text-center">Popularidade</TableHead>
              <TableHead className="text-center w-32">Ações</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.map(r => (
                <TableRow key={r.id} className="border-border hover:bg-muted/30">
                  <TableCell className="font-medium text-sm">{r.title}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.slug}</TableCell>
                  <TableCell className="text-sm">{r.publisher || '—'}</TableCell>
                  <TableCell className="text-xs">{(r.platforms || []).join(', ') || '—'}</TableCell>
                  <TableCell className="text-center text-sm">{r.popularity}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center gap-1">
                      <Button variant="ghost" size="sm" aria-label={`Editar ${r.title}`} onClick={() => openEdit(r)}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" aria-label={`Excluir ${r.title}`} onClick={() => setConfirmDelete(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent></Card>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Editar jogo' : 'Novo jogo no catálogo'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>Título</Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-2"><Label>Slug</Label>
              <Input placeholder={slugify(form.title) || 'gerado automaticamente'} value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} />
            </div>
            <div className="space-y-2"><Label>Publisher</Label>
              <Input value={form.publisher} onChange={e => setForm({ ...form, publisher: e.target.value })} />
            </div>
            <div className="space-y-2"><Label>Capa (URL)</Label>
              <Input value={form.cover_url} onChange={e => setForm({ ...form, cover_url: e.target.value })} />
            </div>
            <div className="space-y-2"><Label>Plataformas</Label>
              <div className="flex flex-wrap gap-2">
                {PLATAFORMAS.map(p => (
                  <Badge key={p} onClick={() => togglePlatform(p)}
                    className={`cursor-pointer select-none ${form.platforms.includes(p) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}>
                    {p}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Tags (vírgula)</Label>
                <Input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} />
              </div>
              <div className="space-y-2"><Label>Popularidade</Label>
                <Input type="number" value={form.popularity} onChange={e => setForm({ ...form, popularity: Number(e.target.value) })} />
              </div>
            </div>
            <Button className="w-full" onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={o => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover “{confirmDelete?.title}” do catálogo?</AlertDialogTitle>
            <AlertDialogDescription>
              Anúncios e posts que marcaram este jogo perdem a tag. A ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}