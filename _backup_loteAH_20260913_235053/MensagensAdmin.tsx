import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, MessageSquare, Search, Filter, Eye, ShieldAlert, Ban, AlertTriangle, CheckCircle2, XCircle, ChevronRight, ChevronLeft, Download, Clock, User, Lock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { formatDateTime } from '@/lib/format';
import { dbWrite } from '@/lib/dbWrite';
import { adminLog } from '../lib/adminLog';

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
  read_at: string | null;
  sender?: {
    display_name: string;
    avatar_url: string | null;
  };
}

interface Conversation {
  id: string;
  participant_1: string;
  participant_2: string;
  channel: string;
  status: string;
  created_at: string;
  updated_at: string;
  participant_1_profile?: { display_name: string };
  participant_2_profile?: { display_name: string };
  last_message?: string;
  last_message_at?: string;
  message_count?: number;
}

// GAP-D160: Verificar se há denúncia associada
async function getReportForConversation(convId: string): Promise<{ id: string; reason: string; status: string; created_at: string } | null> {
  const { data } = await supabase
    .from('denuncias')
    .select('id, reason, status, created_at')
    .eq('target_type', 'conversation')
    .eq('target_id', convId)
    .neq('status', 'resolved')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data as any || null;
}

// GAP-D162: Registrar acesso admin a mensagens
async function logAdminAccess(adminId: string, convId: string, reportId: string, reportReason: string) {
  await dbWrite(
    supabase.from('admin_logs').insert({
      admin_id: adminId,
      action: 'view_private_messages',
      entity: 'conversation',
      entity_id: convId,
      reason: `Acesso via denúncia ${reportId}`,
      payload: { 
        denuncia_id: reportId,
        denuncia_motivo: reportReason,
        acesso_em: new Date().toISOString(),
      },
    })
  );
}

export default function MensagensAdmin() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [search, setSearch] = useState('');
  const [channel, setChannel] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // GAP-D160: Estado para denúncia
  const [reportInfo, setReportInfo] = useState<{ id: string; reason: string; status: string; created_at: string } | null>(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [viewingMessages, setViewingMessages] = useState(false);

  const ITEMS_PER_PAGE = 30;

  // Carregar conversas
  const loadConversations = async (reset: boolean = false) => {
    const currentPage = reset ? 0 : page;
    const from = currentPage * ITEMS_PER_PAGE;

    if (reset) setLoading(true);
    else setLoadingMore(true);

    try {
      let query = supabase
        .from('conversas')
        .select('*, participant_1_profile:profiles!participant_1(display_name), participant_2_profile:profiles!participant_2(display_name)')
        .order('updated_at', { ascending: false });

      if (channel !== 'all') {
        query = query.eq('channel', channel);
      }
      if (status !== 'all') {
        query = query.eq('status', status);
      }
      // TODO: filtrar por display_name via join não funciona no PostgREST.
      // Mover para uma view ou RPC que traga os nomes já resolvidos.
      if (search) {
        const term = search.replace(/[%_]/g, '');
        query = query.or(
          `participant_1_profile.display_name.ilike.%${term}%,participant_2_profile.display_name.ilike.%${term}%`
        );
      }

      const { data, error } = await query.range(from, from + ITEMS_PER_PAGE - 1);

      if (error) throw error;

      // Buscar todas as mensagens das conversas em 1 query (evita N+1)
      const convs = data || [];
      const convIds = convs.map((c: any) => c.id);
      const { data: allMsgs } = convIds.length
        ? await supabase
            .from('mensagens')
            .select('conversation_id, content, created_at')
            .in('conversation_id', convIds)
            .order('created_at', { ascending: false })
        : { data: [] as any[] };

      // Agrupar por conversa
      const msgsByConv = new Map<string, { last: any; count: number }>();
      (allMsgs || []).forEach((m: any) => {
        const cur = msgsByConv.get(m.conversation_id);
        if (!cur) {
          msgsByConv.set(m.conversation_id, { last: m, count: 1 });
        } else {
          cur.count += 1;
        }
      });

      const enriched = convs.map((c: any) => {
        const stats = msgsByConv.get(c.id);
        return {
          ...c,
          last_message: stats?.last?.content || null,
          last_message_at: stats?.last?.created_at || null,
          message_count: stats?.count || 0,
        };
      });

      if (reset) {
        setConversations(enriched);
      } else {
        setConversations(prev => [...prev, ...enriched]);
      }

      setHasMore((data || []).length === ITEMS_PER_PAGE);
      setPage(currentPage + 1);
    } catch (error) {
      toast.error('Erro ao carregar conversas');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadConversations(true);
  }, [channel, status, search]);

  // GAP-D160: Verificar denúncia antes de abrir mensagens
  const handleOpenConversation = async (conv: Conversation) => {
    const report = await getReportForConversation(conv.id);

    if (!report) {
      toast.error('❌ Esta conversa não possui uma denúncia associada. Acesso negado.');
      return;
    }

    setReportInfo(report);
    setSelectedConv(conv);
    setReportDialogOpen(true);
  };

  // GAP-D160: Confirmar acesso com denúncia
  const confirmAccess = async () => {
    if (!selectedConv || !user || !reportInfo) return;

    setViewingMessages(true);
    setReportDialogOpen(false);

    // GAP-D162: Registrar acesso
    await logAdminAccess(user.id, selectedConv.id, reportInfo.id, reportInfo.reason);

    // Carregar mensagens
    const { data } = await supabase
      .from('mensagens')
      .select('*, sender:profiles!sender_id(display_name, avatar_url)')
      .eq('conversation_id', selectedConv.id)
      .order('created_at', { ascending: true });

    setMessages(data || []);
    toast.success(`🔓 Acesso autorizado via denúncia #${reportInfo.id.slice(0, 8)}`);
  };

  const getParticipantName = (conv: Conversation) => {
    const otherId = conv.participant_1 === user?.id ? conv.participant_2 : conv.participant_1;
    const otherProfile = conv.participant_1 === user?.id
      ? conv.participant_2_profile
      : conv.participant_1_profile;
    return otherProfile?.display_name || otherId.slice(0, 8);
  };

  const getChannelBadge = (channel: string) => {
    const colors: Record<string, string> = {
      personal: 'bg-primary/10 text-primary border-primary/30',
      seller: 'bg-accent/10 text-accent border-accent/30',
      tournament: 'bg-warning/10 text-warning border-warning/30',
      group: 'bg-success/10 text-success border-success/30',
    };
    return (
      <Badge variant="outline" className={colors[channel] || ''}>
        {channel}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            Mensagens Privadas
          </h1>
          <p className="text-sm text-muted-foreground">
            🔒 Apenas conversas com denúncia associada. {conversations.length} conversas carregadas.
          </p>
        </div>
      </div>

      {/* Filtros - GAP-D163 */}
      <div className="bg-card border border-border rounded-xl p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Busca</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nome do usuário..."
                className="pl-8 h-9 text-sm"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Canal</Label>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="personal">Pessoal</SelectItem>
                <SelectItem value="seller">Vendedor</SelectItem>
                <SelectItem value="tournament">Torneio</SelectItem>
                <SelectItem value="group">Grupo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="accepted">Ativos</SelectItem>
                <SelectItem value="archived">Arquivados</SelectItem>
                <SelectItem value="blocked">Bloqueados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Lista de conversas */}
      <Card className="border-border/50">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-xs">Participantes</TableHead>
                <TableHead className="text-xs">Canal</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Mensagens</TableHead>
                <TableHead className="text-xs">Última</TableHead>
                <TableHead className="text-xs text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {conversations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    Nenhuma conversa encontrada
                  </TableCell>
                </TableRow>
              ) : (
                conversations.map((conv) => (
                  <TableRow key={conv.id} className="border-border hover:bg-muted/30">
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        {getParticipantName(conv)}
                      </div>
                    </TableCell>
                    <TableCell>{getChannelBadge(conv.channel)}</TableCell>
                    <TableCell>
                      <Badge variant={conv.status === 'accepted' ? 'secondary' : 'outline'}>
                        {conv.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{conv.message_count || 0}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {conv.last_message_at ? formatDateTime(conv.last_message_at) : '—'}
                      {conv.last_message && (
                        <div className="text-xs truncate max-w-[150px] text-muted-foreground/60">
                          {conv.last_message}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => handleOpenConversation(conv)}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        Ver mensagens
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Paginação */}
      {hasMore && conversations.length > 0 && (
        <div className="flex justify-center mt-4">
          <Button
            variant="outline"
            onClick={() => loadConversations(false)}
            disabled={loadingMore}
            className="text-sm"
          >
            {loadingMore ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <ChevronRight className="h-4 w-4 mr-2" />
            )}
            Carregar mais
          </Button>
        </div>
      )}

      {/* GAP-D160/GAP-D161: Dialog de verificação de denúncia com banner */}
      <AlertDialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-warning">
              <ShieldAlert className="h-5 w-5" />
              Verificação de Denúncia
            </AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-3">
                <p>
                  Para acessar esta conversa privada, é necessário que exista uma denúncia associada.
                </p>
                {/* GAP-D161: Banner com motivo da denúncia */}
                {reportInfo && (
                  <div className="bg-destructive/10 border border-destructive/30 p-4 rounded-lg text-sm space-y-2">
                    <div className="flex items-center gap-2 text-destructive font-semibold">
                      <AlertTriangle className="h-4 w-4" />
                      Denúncia #{reportInfo.id.slice(0, 8)}
                    </div>
                    <p><strong>Status:</strong> <Badge variant="outline" className="border-warning/50 text-warning">{reportInfo.status}</Badge></p>
                    <p><strong>Data:</strong> {formatDateTime(reportInfo.created_at)}</p>
                    <div className="bg-background/50 p-3 rounded-lg">
                      <p className="text-xs text-muted-foreground font-medium">Motivo da denúncia:</p>
                      <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">{reportInfo.reason}</p>
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  ⚠️ Este acesso será registrado no log de auditoria com o motivo da denúncia.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAccess} className="bg-warning hover:bg-warning/90">
              <Eye className="h-4 w-4 mr-2" />
              Autorizar acesso
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Visualizador de mensagens */}
      <Dialog open={viewingMessages} onOpenChange={setViewingMessages}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Conversa Privada
              <Badge variant="outline" className="ml-2 text-[10px] font-mono border-warning/50 text-warning">
                <Lock className="h-3 w-3 mr-0.5" /> Denúncia
              </Badge>
            </DialogTitle>
            <DialogDescription>
              {selectedConv && (
                <div className="text-sm text-muted-foreground">
                  Canal: {selectedConv.channel} · {getParticipantName(selectedConv)}
                  {reportInfo && (
                    <span className="ml-2 text-xs text-warning">
                      (Acesso via denúncia #{reportInfo.id.slice(0, 8)})
                    </span>
                  )}
                </div>
              )}
              {/* GAP-D161: Motivo da denúncia no topo das mensagens */}
              {reportInfo && (
                <div className="mt-2 p-2 bg-warning/10 border border-warning/30 rounded-lg text-xs">
                  <span className="font-semibold text-warning">📋 Motivo da denúncia:</span>
                  <span className="text-foreground ml-1">{reportInfo.reason}</span>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-3">
            {messages.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma mensagem nesta conversa.
              </p>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-3 rounded-lg ${
                    msg.sender_id === selectedConv?.participant_1
                      ? 'bg-primary/10 ml-8'
                      : 'bg-secondary/50 mr-8'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium">
                      {msg.sender?.display_name || msg.sender_id.slice(0, 8)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDateTime(msg.created_at)}
                      {msg.read_at && (
                        <span className="ml-2 text-success">✓ Visto</span>
                      )}
                    </span>
                  </div>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{msg.content}</p>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => setViewingMessages(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}