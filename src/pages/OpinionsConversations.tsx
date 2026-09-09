// Área "Conversas de Opiniões" — lista todas as conversas vinculadas a opiniões
// onde o usuário é autor ou respondente. NÃO se mistura com DM normal.
import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, MessageSquare, Gamepad2, Sparkles, Inbox, Archive, CheckCircle2, Clock, EyeOff, Filter } from 'lucide-react';
import EstadoVazio from '@/components/EstadoVazio';
import BuscaInput from '@/components/BuscaInput';
import { formatDate, formatRelativeTime } from '@/lib/format';
import { toast } from 'sonner';
import { dbWrite } from '@/lib/dbWrite';
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
import { Button } from '@/components/ui/button';

interface Row {
  conv_id: string;
  opinion_id: string;
  product_id: string;
  product_title: string;
  product_image: string | null;
  opinion_text: string;
  opinion_author_id: string;
  opinion_author_name: string | null;
  other_id: string;
  other_name: string | null;
  other_avatar: string | null;
  last_message: string | null;
  last_at: string;
  unread: number;
  i_am_author: boolean;
  is_archived?: boolean;
}

// GAP-537: Arquivar conversa
async function archiveConversation(convId: string, userId: string, archive: boolean): Promise<boolean> {
  const { error } = await dbWrite(
    supabase
      .from('opinion_conversations')
      .update({ archived_at: archive ? new Date().toISOString() : null })
      .eq('id', convId)
      .or(`author_id.eq.${userId},responder_id.eq.${userId}`)
  );
  if (error) {
    toast.error('Erro ao arquivar conversa');
    return false;
  }
  toast.success(archive ? 'Conversa arquivada' : 'Conversa restaurada');
  return true;
}

// GAP-535: Contar mensagens não lidas
async function countUnreadMessages(convId: string, userId: string): Promise<number> {
  const { count } = await supabase
    .from('game_opinion_replies')
    .select('*', { count: 'exact', head: true })
    .eq('conversation_id', convId)
    .neq('sender_id', userId)
    .is('read_at', null);
  return count || 0;
}

export default function OpinionsConversations() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  
  // GAP-536: Filtro por status (lida/não lida)
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  
  // GAP-537: Estado para dialog de arquivamento
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [archiveAction, setArchiveAction] = useState<'archive' | 'restore'>('archive');

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: convs } = await supabase
        .from('opinion_conversations')
        .select('id, opinion_id, author_id, responder_id, created_at, updated_at, archived_at')
        .or(`author_id.eq.${user.id},responder_id.eq.${user.id}`)
        .order('updated_at', { ascending: false });

      if (!convs || convs.length === 0) { setRows([]); setLoading(false); return; }

      const opinionIds = [...new Set(convs.map(c => c.opinion_id))];
      const userIds = new Set<string>();
      convs.forEach(c => { userIds.add(c.author_id); userIds.add(c.responder_id); });

      const [{ data: opinions }, { data: profiles }, { data: lastMsgs }] = await Promise.all([
        supabase.from('game_opinions').select('id, text, product_id, user_id').in('id', opinionIds),
        supabase.from('profiles').select('id, display_name, avatar_url').in('id', [...userIds]),
        supabase.from('game_opinion_replies').select('conversation_id, text, created_at, sender_id, read_at').in('conversation_id', convs.map(c => c.id)).order('created_at', { ascending: false }),
      ]);

      const productIds = [...new Set((opinions || []).map((o: any) => o.product_id))];
      const { data: products } = productIds.length
        ? await supabase.from('produtos').select('id, title, image_url').in('id', productIds)
        : { data: [] as any[] };

      const profMap = new Map((profiles || []).map(p => [p.id, p]));
      const opMap = new Map((opinions || []).map((o: any) => [o.id, o]));
      const prodMap = new Map((products || []).map((p: any) => [p.id, p]));
      const lastByConv = new Map<string, { text: string; created_at: string; sender_id: string; read_at: string | null }>();
      
      // GAP-535: Contar não lidas por conversa
      const unreadCounts = new Map<string, number>();
      (lastMsgs || []).forEach((m: any) => {
        if (!lastByConv.has(m.conversation_id)) {
          lastByConv.set(m.conversation_id, { 
            text: m.text, 
            created_at: m.created_at, 
            sender_id: m.sender_id,
            read_at: m.read_at 
          });
        }
        // Contar não lidas
        if (m.sender_id !== user.id && !m.read_at) {
          unreadCounts.set(m.conversation_id, (unreadCounts.get(m.conversation_id) || 0) + 1);
        }
      });

      const result: Row[] = convs.map(c => {
        const op: any = opMap.get(c.opinion_id);
        const prod: any = op ? prodMap.get(op.product_id) : null;
        const i_am_author = c.author_id === user.id;
        const other_id = i_am_author ? c.responder_id : c.author_id;
        const other = profMap.get(other_id);
        const author = profMap.get(c.author_id);
        const last = lastByConv.get(c.id);
        return {
          conv_id: c.id,
          opinion_id: c.opinion_id,
          product_id: op?.product_id || '',
          product_title: prod?.title || 'Jogo',
          product_image: prod?.image_url || null,
          opinion_text: op?.text || '',
          opinion_author_id: c.author_id,
          opinion_author_name: author?.display_name || null,
          other_id,
          other_name: other?.display_name || null,
          other_avatar: other?.avatar_url || null,
          last_message: last?.text || null,
          last_at: last?.created_at || c.updated_at || c.created_at,
          unread: unreadCounts.get(c.id) || 0,
          i_am_author,
          is_archived: !!c.archived_at,
        };
      }).sort((a, b) => +new Date(b.last_at) - +new Date(a.last_at));

      setRows(result);
      setLoading(false);
    })();
  }, [user?.id]);

  // GAP-538: Verificar se há resposta recente (últimas 24h)
  const isRecent = (lastAt: string): boolean => {
    const diff = Date.now() - new Date(lastAt).getTime();
    return diff < 24 * 60 * 60 * 1000;
  };

  const termo = busca.trim().toLowerCase();
  let visiveis = termo
    ? rows.filter(r => `${r.product_title || ''} ${r.other_name || ''} ${r.opinion_author_name || ''} ${r.last_message || ''}`.toLowerCase().includes(termo))
    : rows;
  
  // GAP-536: Filtrar por não lidas
  if (showUnreadOnly) {
    visiveis = visiveis.filter(r => r.unread > 0);
  }

  // GAP-537: Arquivar/restaurar
  const handleArchive = async (convId: string, archive: boolean) => {
    const success = await archiveConversation(convId, user!.id, archive);
    if (success) {
      setRows(prev => prev.map(r => 
        r.conv_id === convId 
          ? { ...r, is_archived: archive } 
          : r
      ));
    }
  };

  if (!user) return <Navigate to="/auth" replace />;

  // Contagem de não lidas total
  const totalUnread = rows.reduce((sum, r) => sum + r.unread, 0);

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <header className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-display font-bold">Conversas de Opiniões</h1>
          {/* GAP-535: Badge de não lidas */}
          {totalUnread > 0 && (
            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-destructive text-destructive-foreground font-semibold">
              {totalUnread} não lidas
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Conversas privadas iniciadas a partir de opiniões em jogos. Separadas das suas mensagens diretas.
        </p>
      </header>

      {rows.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <BuscaInput 
            value={busca} 
            onChange={setBusca} 
            placeholder="Buscar por jogo, pessoa ou mensagem..." 
            className="flex-1"
          />
          
          {/* GAP-536: Filtro por não lidas */}
          <button
            onClick={() => setShowUnreadOnly(!showUnreadOnly)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              showUnreadOnly 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            {showUnreadOnly ? 'Não lidas' : 'Todas'}
            {!showUnreadOnly && totalUnread > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/20 text-destructive">
                {totalUnread}
              </span>
            )}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <EstadoVazio
          icone={MessageSquare}
          titulo="Nenhuma conversa de opinião ainda"
          descricao="Responda a uma opinião na página de um jogo para iniciar uma."
        />
      ) : visiveis.length === 0 ? (
        <EstadoVazio 
          icone={MessageSquare} 
          titulo={showUnreadOnly ? 'Todas as conversas lidas!' : 'Nenhuma conversa encontrada'} 
          descricao={showUnreadOnly ? 'Não há mensagens não lidas.' : 'Tente outro termo de busca.'}
          acao={showUnreadOnly ? { label: 'Mostrar todas', onClick: () => setShowUnreadOnly(false) } : undefined}
        />
      ) : (
        <ul className="space-y-2">
          {visiveis.map(r => {
            const isRecentMsg = isRecent(r.last_at);
            
            return (
              <li key={r.conv_id} className={`relative ${r.is_archived ? 'opacity-50' : ''}`}>
                <Link
                  to={`/perfil/${r.opinion_author_id}/jogo/${r.product_id}/opniao/${r.opinion_id}/conversa/${r.conv_id}`}
                  className="block bg-card border border-border rounded-xl p-3 hover:border-primary/40 transition-colors"
                >
                  <div className="flex gap-3">
                    <div className="w-12 h-12 rounded-lg bg-secondary overflow-hidden shrink-0 relative">
                      {r.product_image ? (
                        <img src={r.product_image} alt="" className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <Gamepad2 className="h-4 w-4" />
                        </div>
                      )}
                      {/* GAP-535: Badge de não lidas */}
                      {r.unread > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                          {r.unread}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs text-muted-foreground truncate">{r.product_title}</span>
                        <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                          {r.i_am_author ? 'Sua opinião' : `Opinião de ${r.opinion_author_name || '...'}`}
                        </span>
                        {/* GAP-538: Badge de resposta recente */}
                        {isRecentMsg && !r.i_am_author && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-success/20 text-success font-medium animate-pulse">
                            Nova
                          </span>
                        )}
                        {r.is_archived && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                            Arquivada
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium truncate">com {r.other_name || 'usuário'}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                        {r.last_message || <span className="italic">— sem mensagens ainda —</span>}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[10px] text-muted-foreground">{formatDate(r.last_at)}</span>
                      {r.unread > 0 && (
                        <span className="text-[9px] text-primary font-medium">Não lida</span>
                      )}
                    </div>
                  </div>
                </Link>
                
                {/* GAP-537: Botão de arquivar */}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setArchivingId(r.conv_id);
                    setArchiveAction(r.is_archived ? 'restore' : 'archive');
                    setShowArchiveDialog(true);
                  }}
                  className="absolute top-3 right-3 p-1 rounded hover:bg-secondary transition-colors"
                  title={r.is_archived ? 'Restaurar' : 'Arquivar'}
                >
                  {r.is_archived ? (
                    <Inbox className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                  ) : (
                    <Archive className="h-3.5 w-3.5 text-muted-foreground hover:text-muted-foreground" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* GAP-537: Dialog de confirmação de arquivamento */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {archiveAction === 'archive' ? 'Arquivar conversa?' : 'Restaurar conversa?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {archiveAction === 'archive' 
                ? 'A conversa será arquivada e não aparecerá mais na lista principal. Você pode restaurá-la a qualquer momento.'
                : 'A conversa será restaurada e aparecerá novamente na lista principal.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={async () => {
                if (archivingId) {
                  await handleArchive(archivingId, archiveAction === 'archive');
                }
                setShowArchiveDialog(false);
                setArchivingId(null);
              }}
              className={archiveAction === 'archive' ? 'bg-warning hover:bg-warning/90' : ''}
            >
              {archiveAction === 'archive' ? 'Arquivar' : 'Restaurar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}