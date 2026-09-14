// Itens 110/118/124 — mediação de troca do marketplace C2C.
// O MIDIAS não processa o dinheiro (PIX direto entre as pessoas), então isso é
// mediação de decisão e reputação — não escrow, não reembolso.
// Fluxos: vendedor marca enviado (com rastreio) e entregue; comprador tem 72h
// pra check-in rápido (124) ou contestar (110). Item 118: se a confirmação de
// pagamento vier menos de 5 min depois da proposta, exibe fricção antes.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, PackageCheck, Truck, ShieldAlert, Clock, MessageSquare, Star, ThumbsUp, ThumbsDown, X, Bell, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import EstadoVazio from '@/components/EstadoVazio';
import ErroCarregamento from '@/components/ErroCarregamento';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime } from '@/lib/format';
import { dbWrite } from '@/lib/dbWrite';

interface Proposal {
  id: string; anuncio_id: string; proposer_id: string; offered_item: string;
  status: string; created_at: string;
  shipped_at: string | null; tracking_code: string | null; delivered_at: string | null;
  dispute_status: string | null; dispute_reason: string | null; seller_response: string | null;
  resolution: string | null; checkin_note: string | null; paid_confirmed_at: string | null;
  anuncio_title: string; seller_id: string;
  // GAP-1123: Avaliação
  buyer_rated?: boolean; seller_rated?: boolean;
  buyer_rating?: number | null; seller_rating?: number | null;
}

const URGENCY_MS = 5 * 60_000;
const WINDOW_MS = 72 * 3600_000;

// GAP-1124: Notificação de status
async function notifyStatusChange(proposalId: string, userId: string, currentUserId: string, status: string, message: string) {
  if (userId === currentUserId) return;
  await dbWrite(
    supabase.from('notifications').insert({
      user_id: userId,
      type: 'trade_update',
      title: `🔄 Atualização na negociação`,
      body: message,
      reference_type: 'trade_proposal',
      reference_id: proposalId,
    })
  );
}

// GAP-1123: Avaliar usuário
async function rateUser(
  proposalId: string,
  reviewerId: string,
  targetUserId: string,
  rating: number,
  comment: string | null,
  role: 'buyer' | 'seller',
) {
  const { error } = await supabase
    .from('avaliacoes_usuario')
    .upsert(
      {
        reviewer_id: reviewerId,
        reviewed_id: targetUserId,
        rating,
        comment: comment || null,
        trade_proposal_id: proposalId,
        role,
      },
      { onConflict: 'reviewer_id,reviewed_id,trade_proposal_id' },
    );
  if (error) throw error;
}

export default function MTrocas() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [tracking, setTracking] = useState<Record<string, string>>({});
  const [reason, setReason] = useState<Record<string, string>>({});
  const [urgencyFor, setUrgencyFor] = useState<Proposal | null>(null);
  
  // GAP-1125: Cancelar
  const [cancelFor, setCancelFor] = useState<Proposal | null>(null);
  
  // GAP-1123: Avaliação
  const [ratingFor, setRatingFor] = useState<Proposal | null>(null);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingRole, setRatingRole] = useState<'buyer' | 'seller'>('buyer');

  const load = async () => {
    if (!user) return;
    setLoading(true);
    setErro(false);
    // Sem cancel flag: a página é pequena e o usuário raramente navega durante load.
    const { data, error } = await supabase.from('trade_proposals').select('*').order('created_at', { ascending: false });
    if (error) { setErro(true); setLoading(false); return; }
    const list = (data || []) as any[];
    const adIds = [...new Set(list.map(p => p.anuncio_id))];
    const { data: ads } = adIds.length
      ? await supabase.from('anuncios').select('id, title, seller_id').in('id', adIds)
      : { data: [] as any[] };
    const adMap = new Map((ads || []).map((a: any) => [a.id, a]));
    setItems(list.map(p => ({
      ...p,
      anuncio_title: adMap.get(p.anuncio_id)?.title || 'Anúncio',
      seller_id: adMap.get(p.anuncio_id)?.seller_id || '',
      buyer_rated: p.buyer_rated || false,
      seller_rated: p.seller_rated || false,
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  const patch = async (id: string, values: Record<string, any>) => {
    setBusy(id);
    const { error } = await supabase.from('trade_proposals').update(values as any).eq('id', id);
    setBusy(null);
    if (error) { toast.error('Não foi possível atualizar'); return false; }
    load();
    
    // GAP-1124: Notificar sobre mudança de status
    if (values.status || values.shipped_at || values.delivered_at || values.dispute_status) {
      const proposal = items.find(p => p.id === id);
      if (proposal) {
        const otherId = proposal.seller_id === user?.id ? proposal.proposer_id : proposal.seller_id;
        let message = '';
        if (values.shipped_at) message = 'Vendedor marcou o item como enviado.';
        else if (values.delivered_at) message = 'Item marcado como entregue. Verifique sua negociação.';
        else if (values.dispute_status === 'open') message = 'Uma contestação foi aberta na negociação.';
        else if (values.status === 'cancelled') message = 'A negociação foi cancelada.';
        await notifyStatusChange(id, otherId, user?.id || '', values.status || 'updated', message);
      }
    }
    
    return true;
  };

  // GAP-1125: Cancelar negociação
  const cancelTrade = async (proposal: Proposal) => {
    if (proposal.status === 'cancelled') {
      toast.info('Negociação já foi cancelada');
      return;
    }
    if (proposal.shipped_at) {
      toast.error('Não é possível cancelar após o envio');
      return;
    }
    const ok = await patch(proposal.id, { status: 'cancelled' });
    if (ok) {
      toast.success('Negociação cancelada');
      setCancelFor(null);
    }
  };

  // GAP-1123: Enviar avaliação
  const submitRating = async () => {
    if (!ratingFor || !user) return;
    const targetId = ratingRole === 'buyer' ? ratingFor.proposer_id : ratingFor.seller_id;
    try {
      await rateUser(ratingFor.id, user.id, targetId, ratingValue, ratingComment || null, ratingRole);
      await patch(ratingFor.id, { 
        buyer_rated: ratingRole === 'buyer' ? true : undefined,
        seller_rated: ratingRole === 'seller' ? true : undefined,
        buyer_rating: ratingRole === 'buyer' ? ratingValue : undefined,
        seller_rating: ratingRole === 'seller' ? ratingValue : undefined,
      });
      toast.success('Avaliação enviada!');
      setRatingFor(null);
      setRatingComment('');
      setRatingValue(5);
    } catch {
      toast.error('Erro ao enviar avaliação');
    }
  };

  const confirmPayment = async (p: Proposal) => {
    const fast = Date.now() - new Date(p.created_at).getTime() < URGENCY_MS;
    if (fast) { setUrgencyFor(p); return; }
    if (await patch(p.id, { paid_confirmed_at: new Date().toISOString() })) toast.success('Pagamento confirmado');
  };

  const openDispute = async (p: Proposal) => {
    const why = (reason[p.id] || '').trim();
    if (why.length < 10) { toast.error('Descreva o problema (mín. 10 caracteres)'); return; }
    setBusy(p.id);
    const { error } = await (supabase as any).rpc('open_trade_dispute', { _proposal_id: p.id, _reason: why });
    setBusy(null);
    if (error) { toast.error(error.message || 'Não foi possível contestar'); return; }
    toast.success('Contestação registrada — moderação vai analisar');
    load();
  };

  if (!user) return null;
  if (loading) return (
    <div className="px-4 py-6 space-y-3">
      <Skeleton className="h-6 w-40" />
      {[0, 1, 2].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
    </div>
  );
  if (erro) return (
    <ErroCarregamento
      titulo="Não foi possível carregar suas negociações"
      descricao="Verifique sua conexão e tente de novo."
      onRetry={load}
      retrying={loading}
    />
  );

  return (
    <div className="pb-10">
      <button onClick={() => navigate(-1)} className="px-4 py-3 flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>
      <div className="px-4">
        <h1 className="text-xl font-bold mb-1">Minhas negociações</h1>
        <p className="text-xs text-muted-foreground mb-4">
          O MIDIAS não recebe o dinheiro da negociação — aqui a gente media a decisão e registra o histórico de cada lado.
        </p>

        {items.length === 0 && (
          <EstadoVazio
            icone={PackageCheck}
            titulo="Nenhuma negociação ainda"
            descricao="Quando você propor uma troca ou receber uma proposta, ela aparece aqui com envio, rastreio e conferência."
            acao={{ label: 'Ver marketplace', to: '/m/marketplace' }}
          />
        )}

        <div className="space-y-3">
          {items.map(p => {
            const isSeller = p.seller_id === user.id;
            const isBuyer = p.proposer_id === user.id;
            const windowOpen = !!p.delivered_at && Date.now() - new Date(p.delivered_at).getTime() < WINDOW_MS;
            const isCompleted = p.status === 'completed' || (p.delivered_at && !windowOpen && !p.dispute_status);
            const canRate = isCompleted && !(isSeller ? p.seller_rated : p.buyer_rated);
            
            return (
              <div key={p.id} className="glass rounded-xl p-4 space-y-3">
                <div>
                  <p className="text-sm font-bold">{p.anuncio_title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Oferta: {p.offered_item} · {formatDateTime(p.created_at)}
                  </p>
                  {p.status === 'cancelled' && (
                    <span className="text-xs text-destructive font-semibold">❌ Cancelada</span>
                  )}
                </div>

                {p.tracking_code && (
                  <p className="text-xs flex items-center gap-1.5"><Truck className="h-3.5 w-3.5 text-primary" /> Rastreio: <span className="font-mono">{p.tracking_code}</span></p>
                )}
                {p.delivered_at && (
                  <p className="text-xs flex items-center gap-1.5">
                    <PackageCheck className="h-3.5 w-3.5 text-success" />
                    Entregue em {formatDateTime(p.delivered_at)}
                    {windowOpen && <span className="text-muted-foreground">· janela de conferência aberta (72h)</span>}
                  </p>
                )}
                {p.dispute_status && (
                  <p className="text-xs flex items-center gap-1.5 text-warning">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    {p.dispute_status === 'open' ? 'Contestação em análise' : p.resolution || 'Contestação encerrada'}
                  </p>
                )}

                {/* GAP-1125: Cancelar (apenas antes do envio) */}
                {!p.shipped_at && p.status !== 'cancelled' && !p.dispute_status && (
                  <button
                    onClick={() => setCancelFor(p)}
                    disabled={busy === p.id}
                    className="w-full py-2 rounded-lg bg-destructive/10 text-destructive text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <X className="h-3.5 w-3.5" /> Cancelar negociação
                  </button>
                )}

                {isSeller && !p.shipped_at && p.status !== 'cancelled' && (
                  <div className="flex gap-2">
                    <input
                      value={tracking[p.id] || ''}
                      onChange={e => setTracking(s => ({ ...s, [p.id]: e.target.value }))}
                      placeholder="Código de rastreio (item físico)"
                      className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-xs"
                    />
                    <button disabled={busy === p.id}
                      onClick={() => patch(p.id, { shipped_at: new Date().toISOString(), tracking_code: tracking[p.id] || null })}
                      className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50">
                      Marcar enviado
                    </button>
                  </div>
                )}

                {isSeller && p.shipped_at && !p.delivered_at && p.status !== 'cancelled' && (
                  <button disabled={busy === p.id}
                    onClick={() => patch(p.id, { delivered_at: new Date().toISOString() })}
                    className="w-full py-2 rounded-lg bg-gradient-to-r from-primary to-accent text-primary-foreground text-xs font-semibold disabled:opacity-50">
                    Marcar como entregue (abre janela de 72h do comprador)
                  </button>
                )}

                {isSeller && p.dispute_status === 'open' && !p.seller_response && (
                  <div className="space-y-2">
                    <textarea
                      value={reason[p.id] || ''}
                      onChange={e => setReason(s => ({ ...s, [p.id]: e.target.value }))}
                      placeholder="Sua resposta à contestação"
                      className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-xs" rows={3}
                    />
                    <button disabled={busy === p.id}
                      onClick={() => patch(p.id, { seller_response: reason[p.id] })}
                      className="w-full py-2 rounded-lg bg-secondary border border-border text-xs font-semibold">
                      Responder contestação
                    </button>
                  </div>
                )}

                {isBuyer && !p.paid_confirmed_at && p.status !== 'cancelled' && (
                  <button disabled={busy === p.id} onClick={() => confirmPayment(p)}
                    className="w-full py-2 rounded-lg bg-secondary border border-border text-xs font-semibold">
                    Confirmar que paguei
                  </button>
                )}

                {isBuyer && windowOpen && p.status !== 'cancelled' && (
                  <div className="space-y-2 border-t border-border pt-3">
                    <div className="flex gap-2">
                      <input
                        value={reason[`c${p.id}`] || ''}
                        onChange={e => setReason(s => ({ ...s, [`c${p.id}`]: e.target.value }))}
                        placeholder="Como está indo até agora?"
                        className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-xs"
                      />
                      <button disabled={busy === p.id}
                        onClick={() => patch(p.id, { checkin_note: reason[`c${p.id}`] })}
                        className="px-3 py-2 rounded-lg bg-secondary border border-border text-xs font-semibold flex items-center gap-1">
                        <MessageSquare className="h-3.5 w-3.5" /> Check-in
                      </button>
                    </div>
                    {!p.dispute_status && (
                      <>
                        <textarea
                          value={reason[p.id] || ''}
                          onChange={e => setReason(s => ({ ...s, [p.id]: e.target.value }))}
                          placeholder="Deu problema? Descreva. Foto/vídeo datado ajuda (recomendado, não obrigatório)."
                          className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-xs" rows={3}
                        />
                        <button disabled={busy === p.id} onClick={() => openDispute(p)}
                          className="w-full py-2 rounded-lg bg-destructive/10 text-destructive text-xs font-semibold">
                          Contestar entrega
                        </button>
                      </>
                    )}
                  </div>
                )}

                {isBuyer && !!p.delivered_at && !windowOpen && !p.dispute_status && p.status !== 'cancelled' && (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Janela de conferência encerrada.</p>
                )}

                {/* GAP-1123: Avaliação pós-troca */}
                {canRate && p.status !== 'cancelled' && (
                  <button
                    onClick={() => {
                      setRatingFor(p);
                      setRatingRole(isSeller ? 'seller' : 'buyer');
                      setRatingValue(5);
                      setRatingComment('');
                    }}
                    className="w-full py-2 rounded-lg bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <Star className="h-3.5 w-3.5" /> Avaliar {isSeller ? 'comprador' : 'vendedor'}
                  </button>
                )}

                {isCompleted && (isSeller ? p.seller_rated : p.buyer_rated) && (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-success" /> Você já avaliou esta negociação.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Item 118 — fricção contra urgência artificial */}
      <AlertDialog open={!!urgencyFor} onOpenChange={o => !o && setUrgencyFor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Isso está indo rápido demais</AlertDialogTitle>
            <AlertDialogDescription>
              Negociações que saem da proposta para o pagamento em poucos minutos são um padrão comum de golpe.
              Confira o perfil do vendedor, o item e o combinado antes de continuar. Tem certeza que quer continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Revisar antes</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              const p = urgencyFor; setUrgencyFor(null);
              if (p && await patch(p.id, { paid_confirmed_at: new Date().toISOString() })) toast.success('Pagamento confirmado');
            }}>Continuar mesmo assim</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* GAP-1125: Cancelar confirmação */}
      <AlertDialog open={!!cancelFor} onOpenChange={o => !o && setCancelFor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar negociação?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar esta negociação? Esta ação não pode ser desfeita.
              {cancelFor?.shipped_at && ' O item já foi enviado, então não é possível cancelar.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => cancelFor && cancelTrade(cancelFor)} className="bg-destructive hover:bg-destructive/90">
              Sim, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* GAP-1123: Avaliação modal */}
      <AlertDialog open={!!ratingFor} onOpenChange={o => !o && setRatingFor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Avaliar {ratingRole === 'buyer' ? 'comprador' : 'vendedor'}</AlertDialogTitle>
            <AlertDialogDescription>
              Sua avaliação ajuda a comunidade a confiar nos outros usuários.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2 justify-center">
              {[1, 2, 3, 4, 5].map(s => (
                <button
                  key={s}
                  onClick={() => setRatingValue(s)}
                  className={`text-2xl transition-colors ${s <= ratingValue ? 'text-warning' : 'text-muted-foreground/30'}`}
                >
                  ★
                </button>
              ))}
            </div>
            <textarea
              value={ratingComment}
              onChange={e => setRatingComment(e.target.value)}
              placeholder="Deixe um comentário (opcional)..."
              rows={3}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm resize-none"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Pular</AlertDialogCancel>
            <AlertDialogAction onClick={submitRating}>
              Enviar avaliação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}