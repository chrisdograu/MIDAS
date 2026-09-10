import { useEffect, useState, useMemo } from 'react';
import { Library, Loader2, Search, User, BookOpen, Star, Image, MessageCircle, Users, UserPlus, Clock, Download, ChevronLeft, ChevronRight, Filter, Eye, EyeOff, Shield } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { formatDateTime, formatDate } from '@/lib/format';
import EstadoVazio from '@/components/EstadoVazio';
import { adminLog } from '../lib/adminLog';
import { Label } from '@/components/ui/label';

const PAGE_SIZE = 20;

interface ProfileView {
  id: string; display_name: string; username: string; avatar_url: string | null;
  banner_url: string | null; bio: string | null; is_private: boolean;
  theme_color: string | null; created_at: string;
  platform_connected?: string[];
  favorite_games?: any[];
  backlog_count?: number;
  compatibility_score?: number;
  total_playtime?: number;
}

interface LibraryItem {
  id: string; product_id: string; status: string; hours_played: number;
  personal_rating: number | null; status_updated_at: string; game_title: string;
  game_image: string | null; is_completed: boolean; is_platinated: boolean;
}

interface PrivacyLog {
  id: string; action: string; details: any; created_at: string;
}

export default function BibliotecaSocialAdmin() {
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [target, setTarget] = useState<ProfileView | null>(null);
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');
  const [open, setOpen] = useState(false);
  const [searched, setSearched] = useState(false);
  const [activeTab, setActiveTab] = useState('library');
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');
  const [gameSearch, setGameSearch] = useState('');
  const [privacyLogs, setPrivacyLogs] = useState<PrivacyLog[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [socialContent, setSocialContent] = useState<any[]>([]);
  const [commonGames, setCommonGames] = useState<any[]>([]);
  const [viewingContent, setViewingContent] = useState<any>(null);
  const [exporting, setExporting] = useState(false);

  const findUsers = async () => {
    if (!search.trim()) return;
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, username, avatar_url')
      .ilike('display_name', `%${search}%`)
      .limit(20);
    setUsers(data || []);
    setSearched(true);
    setLoading(false);
  };

  // GAP-D38: Abrir perfil completo
  const openProfile = async (u: any) => {
    setTarget(null);
    setLibraryItems([]);
    setPrivacyLogs([]);
    setFriends([]);
    setSocialContent([]);
    setCommonGames([]);
    setOpen(true);
    setReason('');
    setPage(0);
  };

  // GAP-D36: Confirmar acesso com justificativa
  const confirmView = async (u: any) => {
    if (reason.trim().length < 6) return toast.error('Justificativa muito curta (mínimo 6 caracteres)');
    
    setLoading(true);
    
    // GAP-D37: Registrar log de acesso
    await adminLog({
      action: 'visualizar_biblioteca_social',
      entity: 'profiles',
      entity_id: u.id,
      reason: reason.trim(),
      payload: { usuario_alvo: u.display_name || u.username },
    });

    // GAP-D38: Buscar dados completos do perfil
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*, platform_connected, favorite_games')
      .eq('id', u.id)
      .maybeSingle();

    if (profileData) {
      // Calcular estatísticas
      const { data: libStats } = await supabase
        .from('biblioteca_usuario')
        .select('status, hours_played')
        .eq('user_id', u.id);

      const totalPlaytime = libStats?.reduce((acc, item) => acc + (item.hours_played || 0), 0) || 0;
      const backlogCount = libStats?.filter(item => item.status === 'quero_jogar').length || 0;

      setTarget({
        ...profileData,
        backlog_count: backlogCount,
        total_playtime: totalPlaytime,
        compatibility_score: Math.floor(Math.random() * 40) + 60, // Simulado
      });
    }

    // GAP-D39: Buscar conteúdo social
    const [
      { data: reviews },
      { data: completas },
      { data: screenshots },
      { data: opinions }
    ] = await Promise.all([
      supabase.from('avaliacoes').select('*').eq('user_id', u.id).limit(20),
      supabase.from('reviews_completas').select('*').eq('user_id', u.id).limit(20),
      supabase.from('screenshots').select('*').eq('user_id', u.id).limit(20),
      supabase.from('opinions').select('*').eq('user_id', u.id).limit(20),
    ]);

    setSocialContent([
      ...(reviews || []).map(r => ({ ...r, type: 'review' })),
      ...(completas || []).map(r => ({ ...r, type: 'review_completa' })),
      ...(screenshots || []).map(s => ({ ...s, type: 'screenshot' })),
      ...(opinions || []).map(o => ({ ...o, type: 'opinion' })),
    ]);

    // GAP-D40: Buscar amigos
    const { data: friendsData } = await supabase
      .from('user_follows')
      .select('follower_id, followed_id, profiles:followed_id(display_name, username, avatar_url)')
      .eq('follower_id', u.id)
      .limit(20);
    setFriends(friendsData || []);

    // GAP-D41: Buscar jogos em comum (com o admin logado)
    const { data: adminUser } = await supabase.auth.getUser();
    if (adminUser?.user) {
      const { data: common } = await supabase
        .from('biblioteca_usuario')
        .select('product_id, produtos:product_id(title, image_url)')
        .eq('user_id', adminUser.user.id)
        .in('product_id', (libStats || []).map(item => item.product_id))
        .limit(10);
      setCommonGames(common || []);
    }

    // GAP-D37: Buscar logs de privacidade
    const { data: logs } = await supabase
      .from('admin_logs')
      .select('*')
      .eq('entity', 'profiles')
      .eq('entity_id', u.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setPrivacyLogs(logs || []);

    // Buscar biblioteca
    await fetchLibrary(u.id);
    setLoading(false);
    setOpen(false);
    toast.success('Acesso autorizado e registrado');
  };

  // GAP-D42: Fetch library com paginação
  const fetchLibrary = async (userId: string) => {
    const { data } = await supabase
      .from('biblioteca_usuario')
      .select('*, produtos:product_id(title, image_url, price)')
      .eq('user_id', userId)
      .order('status_updated_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    const items = (data || []).map((item: any) => ({
      id: item.id,
      product_id: item.product_id,
      status: item.status,
      hours_played: item.hours_played || 0,
      personal_rating: item.personal_rating,
      status_updated_at: item.status_updated_at,
      game_title: item.produtos?.title || 'Jogo',
      game_image: item.produtos?.image_url || null,
      is_completed: item.status === 'zerado' || item.status === 'platinado',
      is_platinated: item.status === 'platinado',
    }));
    setLibraryItems(items);
    setFilteredItems(items);
  };

  // GAP-D43: Busca por jogo na biblioteca
  const filterLibrary = () => {
    const filtered = libraryItems.filter(item => 
      item.game_title.toLowerCase().includes(gameSearch.toLowerCase())
    );
    setFilteredItems(filtered);
  };

  // GAP-D46: Filtro por status
  const filteredByStatus = useMemo(() => {
    if (statusFilter === 'all') return filteredItems;
    return filteredItems.filter(item => item.status === statusFilter);
  }, [filteredItems, statusFilter]);

  // GAP-D44: Exportar dados
  const exportData = async () => {
    if (!target) return;
    setExporting(true);
    const data = {
      usuario: target.display_name,
      biblioteca: libraryItems.map(item => ({
        jogo: item.game_title,
        status: item.status,
        horas: item.hours_played,
        nota: item.personal_rating,
      })),
      amigos: friends.map(f => f.profiles?.display_name),
      conteudo_social: socialContent.map(c => ({ tipo: c.type, data: c.created_at })),
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `biblioteca_${target.display_name}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
    toast.success('Dados exportados com sucesso');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <AdminPageHeader 
          icon={Library} 
          title="Biblioteca Social (Admin)" 
          subtitle="Visualização com auditoria obrigatória" 
        />
        {target && (
          <Button variant="outline" onClick={exportData} disabled={exporting}>
            <Download className="h-4 w-4 mr-1" />
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Exportar'}
          </Button>
        )}
      </div>

      {/* Busca de usuários */}
      <Card className="border-border/50">
        <CardContent className="p-4 flex gap-2">
          <Input 
            placeholder="Buscar usuário pelo nome" 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && findUsers()}
          />
          <Button onClick={findUsers}><Search className="h-4 w-4 mr-1" />Buscar</Button>
        </CardContent>
      </Card>

      {/* Lista de usuários encontrados */}
      {searched && !loading && users.length === 0 && (
        <Card className="border-border/50"><CardContent className="p-0">
          <EstadoVazio titulo="Nenhum usuário encontrado" descricao="Ajuste o nome buscado e tente de novo." />
        </CardContent></Card>
      )}

      {users.length > 0 && (
        <Card className="border-border/50"><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Usuário</TableHead><TableHead>Username</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {users.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-secondary overflow-hidden flex items-center justify-center text-xs font-bold">
                      {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" loading="lazy" /> : u.display_name?.[0] || '?'}
                    </div>
                    {u.display_name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">@{u.username || '—'}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => openProfile(u)}>
                      <User className="h-4 w-4 mr-1" /> Ver perfil
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}

      {/* GAP-D36: Dialog de justificativa */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>🔒 Acesso à Biblioteca Social</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Esta ação será registrada nos logs administrativos com a justificativa fornecida.
            </p>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Usuário alvo</Label>
            <p className="text-sm font-medium">{users.find(u => u.id === target?.id)?.display_name || '—'}</p>
            <Label>Justificativa</Label>
            <Textarea 
              rows={4} 
              value={reason} 
              onChange={e => setReason(e.target.value)} 
              placeholder="Ex.: Investigação de denúncia #1234, análise de comportamento suspeito, etc." 
            />
            <p className="text-xs text-muted-foreground">Mínimo 6 caracteres</p>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={() => confirmView(users.find(u => u.id === target?.id))} disabled={reason.trim().length < 6}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar e visualizar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* GAP-D38: Visualização do perfil completo */}
      {target && (
        <div className="space-y-4">
          {/* Header do perfil */}
          <Card className="border-border/50 overflow-hidden">
            <div 
              className="h-32 w-full relative"
              style={{ 
                background: target.banner_url 
                  ? `url(${target.banner_url})` 
                  : `linear-gradient(135deg, ${target.theme_color || '#14B8A6'}, ${target.theme_color || '#14B8A6'}80)`
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-4 left-6 flex items-end gap-4">
                <div className="w-16 h-16 rounded-full bg-card border-4 border-background overflow-hidden flex items-center justify-center text-2xl font-bold">
                  {target.avatar_url ? <img src={target.avatar_url} alt="" className="w-full h-full object-cover" loading="lazy" /> : target.display_name?.[0] || '?'}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{target.display_name}</h2>
                  <p className="text-sm text-white/70">@{target.username}</p>
                </div>
                {target.is_private && (
                  <Badge className="ml-2 bg-warning/80 text-black">
                    <EyeOff className="h-3 w-3 mr-1" /> Privado
                  </Badge>
                )}
              </div>
            </div>
          </Card>

          {/* Estatísticas */}
          <div className="grid grid-cols-4 gap-4">
            <Card className="border-border/50">
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <BookOpen className="h-5 w-5 text-primary" />
                <div><p className="text-lg font-bold">{libraryItems.length}</p><p className="text-xs text-muted-foreground">Jogos</p></div>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <Clock className="h-5 w-5 text-warning" />
                <div><p className="text-lg font-bold">{target.total_playtime || 0}h</p><p className="text-xs text-muted-foreground">Horas jogadas</p></div>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <Users className="h-5 w-5 text-accent" />
                <div><p className="text-lg font-bold">{friends.length}</p><p className="text-xs text-muted-foreground">Amigos</p></div>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <Star className="h-5 w-5 text-warning" />
                <div><p className="text-lg font-bold">{target.compatibility_score || 0}%</p><p className="text-xs text-muted-foreground">Compatibilidade</p></div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="library">📚 Biblioteca ({libraryItems.length})</TabsTrigger>
              <TabsTrigger value="social">💬 Social ({socialContent.length})</TabsTrigger>
              <TabsTrigger value="friends">👥 Amigos ({friends.length})</TabsTrigger>
              <TabsTrigger value="logs">📜 Logs ({privacyLogs.length})</TabsTrigger>
              <TabsTrigger value="common">🎮 Em comum ({commonGames.length})</TabsTrigger>
            </TabsList>

            {/* GAP-D42/43/46: Biblioteca com paginação, busca e filtro */}
            <TabsContent value="library" className="space-y-3 mt-4">
              <div className="flex gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <Input 
                    placeholder="Buscar por jogo..." 
                    value={gameSearch} 
                    onChange={e => { setGameSearch(e.target.value); filterLibrary(); }}
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="jogando">Jogando</SelectItem>
                    <SelectItem value="zerado">Zerado</SelectItem>
                    <SelectItem value="platinado">Platinado</SelectItem>
                    <SelectItem value="abandonado">Abandonado</SelectItem>
                    <SelectItem value="pausado">Pausado</SelectItem>
                    <SelectItem value="quero_jogar">Quero jogar</SelectItem>
                    <SelectItem value="ja_joguei">Já joguei</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => { setGameSearch(''); setStatusFilter('all'); filterLibrary(); }}>
                  <Filter className="h-4 w-4 mr-1" /> Limpar
                </Button>
              </div>

              {filteredByStatus.length === 0 ? (
                <Card className="border-border/50"><CardContent className="p-0">
                  <EstadoVazio titulo="Nenhum jogo na biblioteca" descricao="Este usuário ainda não adicionou jogos à biblioteca." />
                </CardContent></Card>
              ) : (
                <>
                  <Card className="border-border/50"><CardContent className="p-0">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Jogo</TableHead><TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-center">Horas</TableHead><TableHead className="text-center">Nota</TableHead>
                        <TableHead>Atualizado</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {filteredByStatus.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(item => (
                          <TableRow key={item.id}>
                            <TableCell className="flex items-center gap-2">
                              {item.game_image && <img src={item.game_image} alt="" className="w-8 h-8 object-cover rounded" loading="lazy" />}
                              <span className="text-sm font-medium">{item.game_title}</span>
                              {item.is_completed && <Badge className="bg-success/15 text-success text-[10px]">✅</Badge>}
                              {item.is_platinated && <Badge className="bg-warning/15 text-warning text-[10px]">💎 Platina</Badge>}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="text-xs">
                                {item.status?.replace('_', ' ') || '—'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center text-sm">{item.hours_played}h</TableCell>
                            <TableCell className="text-center">
                              {item.personal_rating ? (
                                <span className="flex items-center justify-center gap-1">
                                  <Star className="h-3 w-3 text-warning fill-warning" />
                                  {item.personal_rating}
                                </span>
                              ) : '—'}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{formatDate(item.status_updated_at)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent></Card>

                  {/* Paginação */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {filteredByStatus.length > 0 ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, filteredByStatus.length)} de ${filteredByStatus.length}` : '0 resultados'}
                    </span>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-xs flex items-center px-2">
                        {page + 1} / {Math.ceil(filteredByStatus.length / PAGE_SIZE) || 1}
                      </span>
                      <Button variant="outline" size="sm" disabled={page >= Math.ceil(filteredByStatus.length / PAGE_SIZE) - 1} onClick={() => setPage(p => p + 1)}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </TabsContent>

            {/* GAP-D39: Conteúdo Social */}
            <TabsContent value="social" className="mt-4">
              {socialContent.length === 0 ? (
                <EstadoVazio titulo="Nenhum conteúdo social" descricao="Este usuário ainda não publicou conteúdo." />
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {socialContent.map((item, i) => (
                    <div key={i} className="bg-card border border-border rounded-lg p-3 flex items-center gap-3">
                      <Badge className="text-[10px]">
                        {item.type === 'review' && '⭐ Review'}
                        {item.type === 'review_completa' && '📝 Review Completa'}
                        {item.type === 'screenshot' && '📸 Screenshot'}
                        {item.type === 'opinion' && '💬 Opinião'}
                      </Badge>
                      <span className="text-sm text-muted-foreground flex-1 truncate">
                        {item.comment || item.analise || item.content || '—'}
                      </span>
                      <span className="text-xs text-muted-foreground">{formatDate(item.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* GAP-D40: Amigos */}
            <TabsContent value="friends" className="mt-4">
              {friends.length === 0 ? (
                <EstadoVazio titulo="Nenhum amigo" descricao="Este usuário ainda não tem amigos." />
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {friends.map((f, i) => {
                    const profile = f.profiles;
                    return (
                      <div key={i} className="bg-card border border-border rounded-lg p-3 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-secondary overflow-hidden flex items-center justify-center text-xs font-bold">
                          {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" loading="lazy" /> : profile?.display_name?.[0] || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{profile?.display_name || 'Usuário'}</p>
                          <p className="text-xs text-muted-foreground truncate">@{profile?.username || '—'}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* GAP-D37: Logs de privacidade */}
            <TabsContent value="logs" className="mt-4">
              {privacyLogs.length === 0 ? (
                <EstadoVazio titulo="Nenhum log encontrado" descricao="Não há registros de alterações de privacidade para este usuário." />
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {privacyLogs.map(log => (
                    <div key={log.id} className="bg-card border border-border rounded-lg p-3 flex items-start gap-3">
                      <Shield className="h-4 w-4 text-primary mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{log.action?.replace(/_/g, ' ') || 'Ação'}</p>
                        <p className="text-xs text-muted-foreground">{log.reason || 'Sem motivo'}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{formatDateTime(log.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* GAP-D41: Jogos em comum */}
            <TabsContent value="common" className="mt-4">
              {commonGames.length === 0 ? (
                <EstadoVazio titulo="Nenhum jogo em comum" descricao="Você não tem jogos em comum com este usuário." />
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {commonGames.map((item, i) => (
                    <div key={i} className="bg-card border border-border rounded-lg p-3 flex items-center gap-2">
                      {item.produtos?.image_url && (
                        <img src={item.produtos.image_url} alt="" className="w-10 h-10 object-cover rounded" loading="lazy" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.produtos?.title || 'Jogo'}</p>
                        <p className="text-xs text-muted-foreground">Em comum</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}