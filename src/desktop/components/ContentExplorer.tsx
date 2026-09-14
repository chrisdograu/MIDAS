// Rodada 24 · item 4 — moderação proativa.
// Moderacao.tsx só olhava a tabela `denuncias` (reativo). Aqui o moderador
// navega o conteúdo social direto, por tipo/autor/data, com a mesma remoção.
import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, Trash2, ExternalLink, ChevronLeft, ChevronRight, Filter, Eye, Gamepad2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDateTime } from '@/lib/format';
import { adminLog } from '../lib/adminLog';

type ContentKind = 'reviews_completas' | 'game_opinions' | 'game_screenshots' | 'game_clips';

const KINDS: Record<ContentKind, { label: string; table: string; select: string; titleField: string; bodyField?: string; gameField?: string }> = {
  reviews_completas: { 
    label: 'Reviews completas', 
    table: 'reviews_completas', 
    select: 'id, analise, recomendacao, user_id, created_at, product_id', 
    titleField: 'recomendacao', 
    bodyField: 'analise',
    gameField: 'product_id'
  },
  game_opinions: { 
    label: 'Opiniões', 
    table: 'game_opinions', 
    select: 'id, text, images, user_id, created_at, game_id', 
    titleField: 'text',
    gameField: 'game_id'
  },
  game_screenshots: { 
    label: 'Screenshots', 
    table: 'game_screenshots', 
    select: 'id, caption, images, user_id, created_at, game_id', 
    titleField: 'caption',
    gameField: 'game_id'
  },
  game_clips: { 
    label: 'Clipes', 
    table: 'game_clips', 
    select: 'id, title, video_url, user_id, created_at, game_id', 
    titleField: 'title',
    gameField: 'game_id'
  },
};

interface Row {
  id: string; user_id: string; created_at: string;
  label: string; body: string | null; media: string | null;
  author: string; game_title?: string | null;
}

interface Props {
  onLogRemoval: (authorId: string, refType: string, refId: string, reason: string) => Promise<void>;
}

const ITEMS_PER_PAGE = 30;

export default function ContentExplorer({ onLogRemoval }: Props) {
  const [kind, setKind] = useState<ContentKind>('reviews_completas');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [author, setAuthor] = useState('');
  const [gameSearch, setGameSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [confirm, setConfirm] = useState<Row | null>(null);
  const [reason, setReason] = useState('');
  const [removing, setRemoving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState<Row | null>(null);
  const [orderBy, setOrderBy] = useState('recentes');
  const [gameMap, setGameMap] = useState<Map<string, string>>(new Map());

  const cfg = KINDS[kind];
  const hasGameField = !!cfg.gameField;

  // GAP-D371: Buscar títulos dos jogos
  const loadGameTitles = async (gameIds: string[]) => {
    if (!gameIds.length) return;
    const { data } = await supabase
      .from('produtos')
      .select('id, title')
      .in('id', gameIds);
    const map = new Map<string, string>();
    (data || []).forEach(p => map.set(p.id, p.title));
    setGameMap(map);
  };

  const load = async (reset: boolean = true) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);

    const currentPage = reset ? 0 : page;
    const fromIdx = currentPage * ITEMS_PER_PAGE;

    try {
      let q = (supabase as any).from(cfg.table).select(cfg.select, { count: 'exact' });

      if (from) q = q.gte('created_at', new Date(from).toISOString());
      if (to) q = q.lte('created_at', new Date(`${to}T23:59:59`).toISOString());
      
      // GAP-D374: Ordenação
      if (orderBy === 'antigas') {
        q = q.order('created_at', { ascending: true });
      } else {
        q = q.order('created_at', { ascending: false });
      }

      const { data, error, count } = await q.range(fromIdx, fromIdx + ITEMS_PER_PAGE - 1);
      if (error) throw error;

      const list = (data as any[]) || [];
      const ids = [...new Set(list.map(r => r.user_id).filter(Boolean))];
      const gameIds = hasGameField ? [...new Set(list.map(r => r[cfg.gameField!]).filter(Boolean))] : [];

      const [profiles, gameData] = await Promise.all([
        ids.length ? supabase.from('profiles').select('id, display_name').in('id', ids) : { data: [] as any[] },
        gameIds.length ? supabase.from('produtos').select('id, title').in('id', gameIds) : { data: [] as any[] },
      ]);

      const pm = new Map<string, string>((profiles.data || []).map((p: any) => [p.id, p.display_name || 'Usuário']));
      const gm = new Map<string, string>((gameData.data || []).map((p: any) => [p.id, p.title]));

      const processed = list.map(r => ({
        id: r.id,
        user_id: r.user_id,
        created_at: r.created_at,
        label: r[cfg.titleField] || '(sem título)',
        body: cfg.bodyField ? r[cfg.bodyField] || null : null,
        media: r.video_url || (Array.isArray(r.images) ? r.images[0] : null) || null,
        author: pm.get(r.user_id) || 'Usuário',
        game_title: hasGameField && r[cfg.gameField!] ? gm.get(r[cfg.gameField!]) || null : null,
      }));

      if (reset) {
        setRows(processed);
        setHasMore((data || []).length === ITEMS_PER_PAGE);
        setPage(1);
      } else {
        setRows(prev => [...prev, ...processed]);
        setHasMore((data || []).length === ITEMS_PER_PAGE);
        setPage(currentPage + 1);
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao carregar conteúdo');
    } finally {
      if (reset) setLoading(false);
      else setLoadingMore(false);
    }
  };

  useEffect(() => { load(true); }, [kind, from, to, orderBy]);

  // GAP-D371: Filtrar por jogo
  const filtered = useMemo(() => {
    const q = author.trim().toLowerCase();
    const gq = gameSearch.trim().toLowerCase();
    return rows.filter(r => {
      const matchAuthor = !q || r.author.toLowerCase().includes(q);
      const matchGame = !gq || (r.game_title || '').toLowerCase().includes(gq);
      return matchAuthor && matchGame;
    });
  }, [rows, author, gameSearch]);

  // GAP-D373: Preview do conteúdo
  const openPreview = (row: Row) => {
    setPreviewContent(row);
    setPreviewOpen(true);
  };

  // GAP-D372: adminLog detalhado
  const remove = async () => {
    if (!confirm) return;
    if (!reason.trim()) { toast.error('Informe o motivo da remoção.'); return; }
    setRemoving(true);

    try {
      const { error } = await (supabase as any).from(cfg.table).delete().eq('id', confirm.id);
      if (error) throw error;

      await adminLog({
        action: `delete_${kind}`,
        entity: cfg.table,
        entity_id: confirm.id,
        reason: reason.trim(),
        payload: {
          tipo: kind,
          autor: confirm.author,
          autor_id: confirm.user_id,
          titulo: confirm.label,
          conteudo: confirm.body?.slice(0, 200) || null,
          jogo: confirm.game_title || null,
        }
      });

      await onLogRemoval(confirm.user_id, kind, confirm.id, reason.trim());
      
      toast.success('Conteúdo removido e autor notificado');
      setConfirm(null);
      setReason('');
      load(true);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao remover conteúdo');
    } finally {
      setRemoving(false);
    }
  };

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);
  const realHasMore = (page + 1) * ITEMS_PER_PAGE < filtered.length;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1">
          <Label className="text-xs">Tipo de conteúdo</Label>
          <Select value={kind} onValueChange={v => setKind(v as ContentKind)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(KINDS) as ContentKind[]).map(k => (
                <SelectItem key={k} value={k}>{KINDS[k].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Autor</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Nome do autor" value={author} onChange={e => setAuthor(e.target.value)} />
          </div>
        </div>
        {hasGameField && (
          <div className="space-y-1">
            <Label className="text-xs">Jogo</Label>
            <div className="relative">
              <Gamepad2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Nome do jogo" value={gameSearch} onChange={e => setGameSearch(e.target.value)} />
            </div>
          </div>
        )}
        <div className="space-y-1">
          <Label className="text-xs">De</Label>
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Até</Label>
          <Input type="date" value={to} onChange={e => setTo(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Ordenar</Label>
          <Select value={orderBy} onValueChange={setOrderBy}>
            <SelectTrigger>
              <Filter className="h-3 w-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recentes">Mais recentes</SelectItem>
              <SelectItem value="antigas">Mais antigas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{filtered.length} itens</span>
        <Button variant="ghost" size="sm" onClick={() => { setAuthor(''); setGameSearch(''); setFrom(''); setTo(''); setOrderBy('recentes'); }}>
          Limpar filtros
        </Button>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : paginated.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Nenhum conteúdo neste filtro</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead>Conteúdo</TableHead>
                  <TableHead>Autor</TableHead>
                  {hasGameField && <TableHead>Jogo</TableHead>}
                  <TableHead>Data</TableHead>
                  <TableHead className="text-center w-36">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map(r => (
                  <TableRow key={r.id} className="border-border hover:bg-muted/30">
                    <TableCell className="max-w-[420px]">
                      <p className="text-sm truncate font-medium">{r.label}</p>
                      {r.body && <p className="text-xs text-muted-foreground truncate">{r.body}</p>}
                    </TableCell>
                    <TableCell className="text-sm">{r.author}</TableCell>
                    {hasGameField && (
                      <TableCell className="text-sm text-muted-foreground">
                        {r.game_title || '—'}
                      </TableCell>
                    )}
                    <TableCell className="text-xs text-muted-foreground">{formatDateTime(r.created_at)}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openPreview(r)} title="Visualizar">
                          <Eye className="h-4 w-4" />
                        </Button>
                        {r.media && (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={r.media} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => { setConfirm(r); setReason(''); }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* GAP-D370: Paginação */}
      {filtered.length > ITEMS_PER_PAGE && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Mostrando {Math.min((page + 1) * ITEMS_PER_PAGE, filtered.length)} de {filtered.length}
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs flex items-center px-2">{page + 1} / {totalPages || 1}</span>
            <Button variant="outline" size="sm" disabled={!realHasMore} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* GAP-D373: Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              Visualizar conteúdo
            </DialogTitle>
          </DialogHeader>
          {previewContent && (
            <div className="space-y-3 py-2">
              <div>
                <Label className="text-xs text-muted-foreground">Autor</Label>
                <p className="text-sm font-medium">{previewContent.author}</p>
              </div>
              {previewContent.game_title && (
                <div>
                  <Label className="text-xs text-muted-foreground">Jogo</Label>
                  <p className="text-sm">{previewContent.game_title}</p>
                </div>
              )}
              <div>
                <Label className="text-xs text-muted-foreground">Título</Label>
                <p className="text-sm font-semibold">{previewContent.label}</p>
              </div>
              {previewContent.body && (
                <div>
                  <Label className="text-xs text-muted-foreground">Conteúdo</Label>
                  <p className="text-sm whitespace-pre-wrap bg-muted/30 p-3 rounded-lg border border-border max-h-48 overflow-y-auto">
                    {previewContent.body}
                  </p>
                </div>
              )}
              {previewContent.media && (
                <div>
                  <Label className="text-xs text-muted-foreground">Mídia</Label>
                  <a href={previewContent.media} target="_blank" rel="noreferrer" className="text-primary hover:underline text-sm">
                    {previewContent.media.slice(0, 80)}...
                  </a>
                </div>
              )}
              <div>
                <Label className="text-xs text-muted-foreground">Data</Label>
                <p className="text-sm text-muted-foreground">{formatDateTime(previewContent.created_at)}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirm} onOpenChange={o => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover conteúdo de {confirm?.author}?</AlertDialogTitle>
            <AlertDialogDescription>
              A remoção é definitiva, fica registrada no histórico de moderação e o autor é notificado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label>Motivo <span className="text-destructive">*</span></Label>
            <Textarea rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="Ex: conteúdo com spoiler não sinalizado / linguagem abusiva" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button variant="destructive" onClick={remove} disabled={removing}>
              {removing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Remover
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}