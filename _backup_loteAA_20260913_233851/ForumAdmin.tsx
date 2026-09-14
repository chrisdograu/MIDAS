import { useState, useEffect, useMemo } from 'react';
import { 
  MessageCircle, ThumbsUp, Trash2, Loader2, ArrowLeft, Search, Gamepad2, 
  User, Lock, Unlock, Pin, PinOff, Download, Filter, Calendar, 
  ChevronLeft, ChevronRight, AlertCircle, X
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import EstadoVazio from '@/components/EstadoVazio';
import { formatDate } from '@/lib/format';
import { gameDisplayName } from '@/lib/gameName';
import { adminLog, exportCsv } from '../lib/adminLog';

interface ForumPost {
  id: string;
  user_id: string;
  product_id: string;
  user_name: string;
  game_name: string;
  product_name: string;
  content: string;
  likes_count: number;
  replies_count: number;
  created_at: string;
  is_locked: boolean;
  is_pinned: boolean;
}

interface GameGroup {
  id: string;
  name: string;
  sku: string;
  count: number;
  lastAt: string;
}

const PAGE_SIZE = 20;

export default function ForumAdmin() {
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'games' | 'game-posts' | 'user-search'>('games');
  const [selectedProduct, setSelectedProduct] = useState<{ id: string; name: string } | null>(null);
  const [userQuery, setUserQuery] = useState('');
  const [gameQuery, setGameQuery] = useState('');
  const [postQuery, setPostQuery] = useState('');
  const [pendingDelete, setPendingDelete] = useState<ForumPost | null>(null);
  const [page, setPage] = useState(0);
  const [dateFilter, setDateFilter] = useState('all');
  const [bannedWords, setBannedWords] = useState<string[]>([]);
  const [bannedWordsOpen, setBannedWordsOpen] = useState(false);
  const [newBannedWord, setNewBannedWord] = useState('');
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  // GAP-D120: Carregar palavras proibidas
  useEffect(() => {
    const loadBannedWords = async () => {
      const { data } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'forum_banned_words')
        .maybeSingle();
      if (data?.value) {
        try {
          setBannedWords(JSON.parse(data.value));
        } catch {
          setBannedWords([]);
        }
      }
    };
    loadBannedWords();
  }, []);

  const fetchPosts = async () => {
    setLoading(true);
    let query = supabase.from('forum_posts').select('*');
    
    // GAP-D121: Paginação
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    query = query.range(from, to);
    
    // GAP-D122: Filtro por data
    if (dateFilter !== 'all') {
      const days = dateFilter === '7d' ? 7 : dateFilter === '30d' ? 30 : 90;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      query = query.gte('created_at', cutoff.toISOString());
    }
    
    query = query.order('created_at', { ascending: false });
    
    const { data, error } = await query;
    if (error) { toast({ title: 'Erro ao carregar o fórum', description: error.message, variant: 'destructive' }); }
    if (!data) { setLoading(false); return; }
    
    const userIds = [...new Set(data.map(p => p.user_id))];
    const prodIds = [...new Set(data.map(p => p.product_id).filter(Boolean))] as string[];
    const [{ data: profiles }, { data: prods }, { data: replies }] = await Promise.all([
      userIds.length ? supabase.from('profiles').select('id, display_name').in('id', userIds) : Promise.resolve({ data: [] as any[] }),
      prodIds.length ? supabase.from('produtos').select('id, title, catalog_game_id').in('id', prodIds) : Promise.resolve({ data: [] as any[] }),
      supabase.from('forum_replies').select('post_id').in('post_id', data.map(p => p.id)),
    ]);
    const catIds = [...new Set((prods || []).map((p: any) => p.catalog_game_id).filter(Boolean))] as string[];
    const { data: catalog } = catIds.length
      ? await supabase.from('games_catalog').select('id, title').in('id', catIds)
      : { data: [] as any[] };
    const catalogMap = new Map<string, string>((catalog || []).map((g: any) => [g.id, g.title]));
    const profileMap = new Map<string, string>((profiles || []).map(p => [p.id, p.display_name || 'Usuário']));
    const prodMap = new Map<string, { title: string; game: string }>((prods || []).map((p: any) => [p.id, {
      title: p.title,
      game: gameDisplayName(p.catalog_game_id ? catalogMap.get(p.catalog_game_id) : null, p.title),
    }]));
    const replyCount = new Map<string, number>();
    replies?.forEach(r => replyCount.set(r.post_id, (replyCount.get(r.post_id) || 0) + 1));
    setPosts(data.map(p => ({
      id: p.id,
      user_id: p.user_id,
      product_id: p.product_id || '',
      user_name: profileMap.get(p.user_id) || 'Usuário',
      game_name: (p.product_id && prodMap.get(p.product_id)?.game) || 'Jogo',
      product_name: (p.product_id && prodMap.get(p.product_id)?.title) || 'Produto',
      content: p.content,
      likes_count: p.likes_count,
      replies_count: replyCount.get(p.id) || 0,
      created_at: p.created_at || '',
      is_locked: !!(p as any).is_locked,
      is_pinned: !!(p as any).is_pinned,
    })));
    setLoading(false);
  };

  useEffect(() => { fetchPosts(); }, [page, dateFilter]);

  const confirmDelete = async () => {
    const post = pendingDelete;
    if (!post) return;
    const { error: e1 } = await supabase.from('forum_replies').delete().eq('post_id', post.id);
    if (e1) { toast({ title: 'Erro ao remover respostas', description: e1.message, variant: 'destructive' }); return; }
    const { error: e2 } = await supabase.from('forum_posts').delete().eq('id', post.id);
    if (e2) { toast({ title: 'Erro ao remover post', description: e2.message, variant: 'destructive' }); return; }
    await adminLog({
      action: 'excluir_post_forum', entity: 'forum_posts', entity_id: post.id,
      reason: 'moderação administrativa',
      payload: { autor: post.user_name, jogo: post.game_name, conteudo: post.content.slice(0, 400), respostas: post.replies_count },
    });
    toast({ title: 'Post removido' });
    setPendingDelete(null);
    fetchPosts();
  };

  // GAP-D119: Fixar/desfixar
  const togglePin = async (p: ForumPost) => {
    const next = !p.is_pinned;
    const { error } = await supabase.from('forum_posts').update({ is_pinned: next } as any).eq('id', p.id);
    if (error) { toast({ title: 'Erro ao alterar', description: error.message, variant: 'destructive' }); return; }
    await adminLog({
      action: next ? 'fixar_topico_forum' : 'desfixar_topico_forum',
      entity: 'forum_posts', entity_id: p.id,
      payload: { antes: { is_pinned: p.is_pinned }, depois: { is_pinned: next }, jogo: p.game_name, autor: p.user_name },
    });
    toast({ title: next ? 'Tópico fixado' : 'Tópico desfixado' });
    fetchPosts();
  };

  const toggleLock = async (p: ForumPost) => {
    const next = !p.is_locked;
    const { error } = await supabase.from('forum_posts').update({ is_locked: next } as any).eq('id', p.id);
    if (error) { toast({ title: 'Erro ao alterar', description: error.message, variant: 'destructive' }); return; }
    await adminLog({
      action: next ? 'trancar_topico_forum' : 'destrancar_topico_forum',
      entity: 'forum_posts', entity_id: p.id,
      payload: { antes: { is_locked: p.is_locked }, depois: { is_locked: next }, jogo: p.game_name, autor: p.user_name },
    });
    toast({ title: next ? 'Tópico trancado' : 'Tópico destrancado' });
    fetchPosts();
  };

  // GAP-D120: Gerenciar palavras proibidas
  const addBannedWord = async () => {
    if (!newBannedWord.trim()) return;
    const updated = [...bannedWords, newBannedWord.trim().toLowerCase()];
    const { error } = await supabase
      .from('site_settings')
      .upsert({
        key: 'forum_banned_words',
        value: JSON.stringify(updated),
      }, { onConflict: 'key' });
    if (error) { toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' }); return; }
    setBannedWords(updated);
    setNewBannedWord('');
    toast({ title: 'Palavra adicionada' });
  };

  const removeBannedWord = async (word: string) => {
    const updated = bannedWords.filter(w => w !== word);
    const { error } = await supabase
      .from('site_settings')
      .upsert({
        key: 'forum_banned_words',
        value: JSON.stringify(updated),
      }, { onConflict: 'key' });
    if (error) { toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' }); return; }
    setBannedWords(updated);
    toast({ title: 'Palavra removida' });
  };

  // GAP-D123: Exportar
  const exportData = () => {
    setExporting(true);
    const data = posts.map(p => ({
      Usuario: p.user_name,
      Jogo: p.game_name,
      Produto: p.product_name,
      Conteudo: p.content,
      Curtidas: p.likes_count,
      Respostas: p.replies_count,
      Data: formatDate(p.created_at),
      Status: p.is_locked ? 'Trancado' : 'Aberto',
      Fixado: p.is_pinned ? 'Sim' : 'Não',
    }));
    exportCsv('forum_posts.csv', data);
    setExporting(false);
    toast({ title: 'Exportado com sucesso' });
  };

  // Agrupamento por JOGO
  const games = useMemo(() => {
    const map = new Map<string, { id: string; name: string; sku: string; count: number; lastAt: string }>();
    posts.forEach(p => {
      const ex = map.get(p.product_id);
      if (!ex) map.set(p.product_id, { id: p.product_id, name: p.game_name, sku: p.product_name, count: 1, lastAt: p.created_at });
      else { ex.count++; if (p.created_at > ex.lastAt) ex.lastAt = p.created_at; }
    });
    const q = gameQuery.trim().toLowerCase();
    return [...map.values()]
      .filter(g => !q || g.name.toLowerCase().includes(q) || g.sku.toLowerCase().includes(q))
      .sort((a, b) => b.count - a.count);
  }, [posts, gameQuery]);

  const gamePosts = useMemo(() => {
    if (!selectedProduct) return [];
    const q = postQuery.trim().toLowerCase();
    return posts.filter(p => p.product_id === selectedProduct.id
      && (!q || p.content.toLowerCase().includes(q) || p.user_name.toLowerCase().includes(q)));
  }, [posts, selectedProduct, postQuery]);

  const userResults = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return [];
    return posts.filter(p => p.user_name.toLowerCase().includes(q));
  }, [posts, userQuery]);

  const totalPages = Math.ceil(posts.length / PAGE_SIZE);

  if (loading && page === 0) {
    return <div className="p-6 flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageCircle className="h-6 w-6 text-primary" /> Fórum
          </h1>
          <p className="text-muted-foreground text-sm">Gestão de posts agrupados por jogo</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setBannedWordsOpen(true)}>
            <AlertCircle className="h-4 w-4 mr-1" /> Palavras proibidas
          </Button>
          <Button variant="outline" size="sm" onClick={exportData} disabled={exporting}>
            <Download className="h-4 w-4 mr-1" />
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Exportar'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Jogos com posts', value: games.length, icon: Gamepad2, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Total de Posts', value: posts.length, icon: MessageCircle, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Total de Curtidas', value: posts.reduce((s, p) => s + p.likes_count, 0), icon: ThumbsUp, color: 'text-success', bg: 'bg-success/10' },
        ].map(s => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="py-4 px-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${s.bg}`}><s.icon className={`h-5 w-5 ${s.color}`} /></div>
              <div><p className="text-2xl font-bold">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs e filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1">
          <Button variant={view === 'games' ? 'default' : 'outline'} size="sm" onClick={() => { setView('games'); setSelectedProduct(null); }}>
            <Gamepad2 className="h-4 w-4 mr-1" /> Por jogo
          </Button>
          <Button variant={view === 'user-search' ? 'default' : 'outline'} size="sm" onClick={() => { setView('user-search'); setSelectedProduct(null); }}>
            <User className="h-4 w-4 mr-1" /> Buscar por usuário
          </Button>
        </div>
        
        {/* GAP-D122: Filtro por data */}
        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <Calendar className="h-3 w-3 mr-1" />
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="90d">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* GAMES list */}
      {view === 'games' && !selectedProduct && (
        <>
          <Card className="border-border/50">
            <CardContent className="py-3 px-4">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Buscar jogo..." value={gameQuery} onChange={e => setGameQuery(e.target.value)} />
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow className="border-border">
                  <TableHead>Jogo</TableHead>
                  <TableHead className="text-center">Posts</TableHead>
                  <TableHead>Última atividade</TableHead>
                  <TableHead className="w-32 text-center">Ações</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {games.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="p-0"><EstadoVazio titulo={gameQuery ? 'Nenhum jogo encontrado' : 'Nenhum post'} /></TableCell></TableRow>
                  ) : games.map(g => (
                    <TableRow key={g.id} className="border-border hover:bg-muted/30 cursor-pointer" onClick={() => { setSelectedProduct({ id: g.id, name: g.name }); setPostQuery(''); setView('game-posts'); }}>
                      <TableCell className="font-medium">
                        {g.name}
                        <span className="block text-xs text-muted-foreground font-normal">{g.sku}</span>
                      </TableCell>
                      <TableCell className="text-center"><Badge variant="secondary">{g.count}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{g.lastAt ? formatDate(g.lastAt) : '—'}</TableCell>
                      <TableCell className="text-center"><Button size="sm" variant="ghost" className="h-7 text-xs">Ver posts</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {/* GAME posts */}
      {view === 'game-posts' && selectedProduct && (
        <>
          <Button variant="ghost" size="sm" onClick={() => { setSelectedProduct(null); setView('games'); }}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-lg font-semibold">Posts em: {selectedProduct.name}</h2>
          <Card className="border-border/50">
            <CardContent className="py-3 px-4">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Buscar por conteúdo ou usuário..." value={postQuery} onChange={e => setPostQuery(e.target.value)} />
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow className="border-border">
                  <TableHead>Usuário</TableHead>
                  <TableHead>Conteúdo</TableHead>
                  <TableHead className="text-center">Curtidas</TableHead>
                  <TableHead className="text-center">Respostas</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-center w-44">Ações</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {gamePosts.map(p => (
                    <TableRow key={p.id} className="border-border hover:bg-muted/30 align-top">
                      <TableCell className="text-sm font-medium align-top">
                        {p.user_name}
                        {p.is_pinned && <Badge className="ml-1 bg-primary/15 text-primary text-[10px]">📌 Fixado</Badge>}
                        {p.is_locked && <Badge className="ml-1 bg-muted text-muted-foreground text-[10px]">🔒</Badge>}
                      </TableCell>
                      <TableCell className="text-sm align-top">
                        <div className="whitespace-pre-wrap break-words max-w-[480px]">{p.content}</div>
                      </TableCell>
                      <TableCell className="text-center text-sm align-top">{p.likes_count}</TableCell>
                      <TableCell className="text-center text-sm">{p.replies_count}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.created_at ? formatDate(p.created_at) : '—'}</TableCell>
                      <TableCell className="text-center space-x-1 whitespace-nowrap">
                        <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => togglePin(p)} title={p.is_pinned ? 'Desfixar' : 'Fixar'}>
                          {p.is_pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                        </Button>
                        <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => toggleLock(p)} title={p.is_locked ? 'Destrancar' : 'Trancar'}>
                          {p.is_locked ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                        </Button>
                        <Button variant="ghost" size="sm" className="text-xs h-7 text-destructive" onClick={() => setPendingDelete(p)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {/* USER search */}
      {view === 'user-search' && (
        <>
          <Card className="border-border/50">
            <CardContent className="py-3 px-4">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Buscar usuário por nome..." value={userQuery} onChange={e => setUserQuery(e.target.value)} />
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow className="border-border">
                  <TableHead>Usuário</TableHead>
                  <TableHead>Jogo (fórum)</TableHead>
                  <TableHead>Conteúdo</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-center w-20">Ações</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {userQuery.trim() === '' ? (
                    <TableRow><TableCell colSpan={5} className="p-0"><EstadoVazio titulo="Digite o nome de um usuário" /></TableCell></TableRow>
                  ) : userResults.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="p-0"><EstadoVazio titulo="Nenhum post encontrado" /></TableCell></TableRow>
                  ) : userResults.map(p => (
                    <TableRow key={p.id} className="border-border hover:bg-muted/30 align-top">
                      <TableCell className="text-sm font-medium align-top">{p.user_name}</TableCell>
                      <TableCell className="text-sm align-top">{p.game_name}</TableCell>
                      <TableCell className="text-sm align-top">
                        <div className="whitespace-pre-wrap break-words max-w-[380px]">{p.content}</div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground align-top">{p.created_at ? formatDate(p.created_at) : '—'}</TableCell>
                      <TableCell className="text-center align-top">
                        <Button variant="ghost" size="sm" className="text-xs h-7 text-destructive" onClick={() => setPendingDelete(p)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {/* GAP-D121: Paginação */}
      {posts.length > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {posts.length > 0 ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, posts.length)} de ${posts.length}` : '0 resultados'}
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
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={o => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir post do fórum?</AlertDialogTitle>
            <AlertDialogDescription>
              O post de {pendingDelete?.user_name} em “{pendingDelete?.game_name}” e todas as {pendingDelete?.replies_count ?? 0} respostas serão removidos. A ação não pode ser desfeita e ficará registrada nos logs.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* GAP-D120: Palavras proibidas */}
      <Dialog open={bannedWordsOpen} onOpenChange={setBannedWordsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Palavras proibidas no fórum</DialogTitle>
            <p className="text-sm text-muted-foreground">Posts que contenham estas palavras serão sinalizados para moderação.</p>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex gap-2">
              <Input 
                placeholder="Nova palavra..." 
                value={newBannedWord} 
                onChange={e => setNewBannedWord(e.target.value.toLowerCase())} 
                className="flex-1"
                onKeyDown={e => e.key === 'Enter' && addBannedWord()}
              />
              <Button onClick={addBannedWord}>Adicionar</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {bannedWords.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma palavra proibida cadastrada.</p>
              ) : (
                bannedWords.map(word => (
                  <Badge key={word} variant="destructive" className="gap-1">
                    {word}
                    <X className="h-3 w-3 cursor-pointer hover:text-white" onClick={() => removeBannedWord(word)} />
                  </Badge>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}