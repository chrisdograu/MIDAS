import { useState, useEffect, useMemo } from 'react';
import { Star, Trash2, Loader2, Search, Download, ChevronLeft, ChevronRight, AlertCircle, Filter } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import EstadoVazio from '@/components/EstadoVazio';
import { formatDate } from '@/lib/format';
import { adminLog } from '../lib/adminLog';

interface Review {
  id: string; reviewer_name: string; reviewed_name: string; anuncio_title: string;
  rating: number; comment: string | null; created_at: string;
  is_denunciada?: boolean;
}

const PAGE_SIZE = 50;

export default function AvaliacoesUsuario() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<Review | null>(null);
  const [search, setSearch] = useState('');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [page, setPage] = useState(0);
  const [denunciasMap, setDenunciasMap] = useState<Map<string, number>>(new Map());
  const { toast } = useToast();

  const fetchReviews = async () => {
    setLoading(true);
    const { data } = await supabase.from('avaliacoes_usuario').select('*').order('created_at', { ascending: false });
    if (!data) { setLoading(false); return; }

    const userIds = [...new Set(data.flatMap(a => [a.reviewer_id, a.reviewed_id]))];
    const anuncioIds = [...new Set(data.map(a => a.anuncio_id).filter(Boolean))] as string[];

    // GAP-D51: Buscar denúncias
    const reviewIds = data.map(a => a.id);
    const { data: denuncias } = reviewIds.length
      ? await supabase.from('denuncias').select('entity_id').eq('entity_type', 'avaliacao_usuario').in('entity_id', reviewIds)
      : { data: [] as any[] };
    const denMap = new Map<string, number>();
    denuncias?.forEach(d => denMap.set(d.entity_id, (denMap.get(d.entity_id) || 0) + 1));
    setDenunciasMap(denMap);

    const [{ data: profiles }, { data: anuncios }] = await Promise.all([
      supabase.from('profiles').select('id, display_name').in('id', userIds),
      anuncioIds.length > 0 ? supabase.from('anuncios').select('id, title').in('id', anuncioIds) : { data: [] },
    ]);

    const profileMap = new Map<string, string>((profiles || []).map(p => [p.id, p.display_name || 'Usuário'] as [string, string]));
    const anuncioMap = new Map<string, string>((anuncios || []).map(a => [a.id, a.title] as [string, string]));

    setReviews(data.map(a => ({
      id: a.id, reviewer_name: profileMap.get(a.reviewer_id) || 'Usuário',
      reviewed_name: profileMap.get(a.reviewed_id) || 'Usuário',
      anuncio_title: a.anuncio_id ? (anuncioMap.get(a.anuncio_id) || 'Anúncio') : '—',
      rating: a.rating, comment: a.comment, created_at: a.created_at,
      is_denunciada: (denMap.get(a.id) || 0) > 0,
    })));
    setLoading(false);
  };

  useEffect(() => { fetchReviews(); }, []);

  // GAP-D48: Filtros e GAP-D52: Ordenação
  const filteredReviews = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reviews.filter(r => {
      if (q && !r.reviewer_name.toLowerCase().includes(q) && !r.reviewed_name.toLowerCase().includes(q)) return false;
      if (ratingFilter !== 'all' && r.rating !== Number(ratingFilter)) return false;
      return true;
    }).sort((a, b) => {
      if (sortBy === 'recent') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortBy === 'highest') return b.rating - a.rating;
      if (sortBy === 'lowest') return a.rating - b.rating;
      return 0;
    });
  }, [reviews, search, ratingFilter, sortBy]);

  // GAP-D47: Paginação
  const paginatedReviews = filteredReviews.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filteredReviews.length / PAGE_SIZE);

  const handleDelete = async () => {
    if (!pendingDelete) return;
    const { error: err } = await supabase.from('avaliacoes_usuario').delete().eq('id', pendingDelete.id);
    if (err) { toast({ title: 'Erro na operação', description: err.message, variant: 'destructive' }); return; }
    
    // GAP-D50: adminLog
    await adminLog({
      action: 'remover_avaliacao_usuario',
      entity: 'avaliacoes_usuario',
      entity_id: pendingDelete.id,
      payload: { avaliador: pendingDelete.reviewer_name, avaliado: pendingDelete.reviewed_name, nota: pendingDelete.rating },
    });
    
    toast({ title: 'Avaliação removida' });
    setPendingDelete(null);
    fetchReviews();
  };

  // GAP-D49: Exportar CSV
  const exportCSV = () => {
    const headers = ['Avaliador', 'Avaliado', 'Anúncio', 'Nota', 'Comentário', 'Data'];
    const rows = filteredReviews.map(r => [
      r.reviewer_name,
      r.reviewed_name,
      r.anuncio_title,
      String(r.rating),
      r.comment || '',
      formatDate(r.created_at),
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `avaliacoes_usuario_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'CSV exportado com sucesso' });
  };

  const avgRating = reviews.length > 0 ? (reviews.reduce((s, a) => s + a.rating, 0) / reviews.length).toFixed(1) : '0';

  if (loading) return <div className="p-6 flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Star className="h-6 w-6 text-primary" /> Avaliações de Usuários</h1>
          <p className="text-muted-foreground text-sm">Reviews entre compradores e vendedores</p>
        </div>
        <Button variant="outline" onClick={exportCSV} className="gap-2">
          <Download className="h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total de Avaliações', value: reviews.length, color: 'text-primary' },
          { label: 'Média Geral', value: avgRating, color: 'text-warning' },
          { label: 'Negativas (≤2)', value: reviews.filter(a => a.rating <= 2).length, color: 'text-destructive' },
          { label: 'Denunciadas', value: reviews.filter(a => a.is_denunciada).length, color: 'text-orange-400' },
        ].map(s => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="py-4 px-4"><p className={`text-2xl font-bold ${s.color}`}>{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por avaliador ou avaliado..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={ratingFilter} onValueChange={setRatingFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as notas</SelectItem>
            {[5, 4, 3, 2, 1].map(r => <SelectItem key={r} value={String(r)}>{r} estrela{r > 1 ? 's' : ''}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Mais recentes</SelectItem>
            <SelectItem value="oldest">Mais antigas</SelectItem>
            <SelectItem value="highest">Maior nota</SelectItem>
            <SelectItem value="lowest">Menor nota</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow className="border-border">
              <TableHead>Avaliador</TableHead><TableHead>Avaliado</TableHead><TableHead>Anúncio</TableHead>
              <TableHead className="text-center">Nota</TableHead><TableHead>Comentário</TableHead>
              <TableHead>Data</TableHead><TableHead className="text-center w-32">Status</TableHead><TableHead className="text-center w-24">Ações</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {paginatedReviews.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="p-0"><EstadoVazio titulo="Nenhuma avaliação" /></TableCell></TableRow>
              ) : paginatedReviews.map(a => (
                <TableRow key={a.id} className="border-border hover:bg-muted/30">
                  <TableCell className="text-sm font-medium">{a.reviewer_name}</TableCell>
                  <TableCell className="text-sm">{a.reviewed_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.anuncio_title}</TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`h-3.5 w-3.5 ${i < a.rating ? 'text-warning fill-gold' : 'text-muted-foreground/30'}`} />
                      ))}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm truncate max-w-[250px]">{a.comment || '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(a.created_at)}</TableCell>
                  <TableCell className="text-center">
                    {a.is_denunciada && (
                      <Badge className="bg-warning/15 text-warning text-[10px]">
                        <AlertCircle className="h-3 w-3 mr-0.5" /> Denunciada
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button variant="ghost" size="sm" className="text-xs h-7 text-destructive" onClick={() => setPendingDelete(a)}>
                      <Trash2 className="h-3 w-3 mr-1" />Remover
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* GAP-D47: Paginação */}
          <div className="flex items-center justify-between p-4 border-t border-border">
            <span className="text-xs text-muted-foreground">
              {filteredReviews.length > 0 ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, filteredReviews.length)} de ${filteredReviews.length}` : '0 resultados'}
            </span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs flex items-center px-2">
                {page + 1} / {totalPages || 1}
              </span>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover avaliação</AlertDialogTitle>
            <AlertDialogDescription>
              Remover a avaliação de <b>{pendingDelete?.reviewer_name}</b> sobre <b>{pendingDelete?.reviewed_name}</b>?
              Esta ação não pode ser desfeita e será registrada nos logs administrativos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}