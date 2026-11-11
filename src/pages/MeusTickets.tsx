import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, LifeBuoy, Loader2, MessageSquare, Paperclip, Plus, RefreshCw, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDateTime } from '@/lib/format';
import { isTicketClosed, loadMyTickets, loadTicketMessages, sendTicketMessage, TICKET_STATUS_LABELS, type SupportTicket, type TicketStatus } from '@/lib/ticketSupport';

const PAGE_SIZE = 15;
function Attachments({ urls }: { urls: string[] }) {
  return <div className="flex flex-wrap gap-2">{urls.filter(url => { try { return new URL(url).protocol === 'https:'; } catch { return false; } }).map((url, index) => <a key={`${url}-${index}`} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary underline"><Paperclip className="h-3 w-3" /> Anexo {index + 1}</a>)}</div>;
}

function TicketThread({ ticket }: { ticket: SupportTicket }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [reply, setReply] = useState('');
  const { data: messages = [], isLoading, isError, refetch } = useQuery({ queryKey: ['my-ticket-messages', user?.id, ticket.id], queryFn: () => loadTicketMessages(ticket.id), refetchInterval: 30000 });
  const send = useMutation({
    mutationFn: () => sendTicketMessage(ticket.id, reply),
    onSuccess: async () => { setReply(''); await queryClient.invalidateQueries({ queryKey: ['my-ticket-messages', user?.id, ticket.id] }); toast.success('Resposta enviada!'); },
    onError: () => toast.error('Não foi possível enviar sua resposta. O texto foi mantido.'),
  });
  return <section aria-label="Conversa do atendimento" className="min-w-0 space-y-5">
    <div className="flex items-start justify-between gap-3 border-b border-border pb-4"><div className="min-w-0"><h2 className="break-words text-xl font-semibold">{ticket.subject}</h2><p className="mt-1 text-xs text-muted-foreground">#{ticket.id.slice(0, 8)} · {formatDateTime(ticket.created_at)}</p></div><Badge variant="secondary">{TICKET_STATUS_LABELS[ticket.status]}</Badge></div>
    {ticket.body && <div className="space-y-2"><h3 className="text-sm font-semibold">Solicitação</h3><p className="whitespace-pre-wrap break-words text-sm">{ticket.body}</p><Attachments urls={ticket.attachments} /></div>}
    {isLoading ? <Loader2 aria-label="Carregando conversa" className="h-6 w-6 animate-spin text-primary" /> : isError ? <div><p className="text-destructive">Não foi possível carregar as mensagens.</p><Button variant="outline" onClick={() => refetch()}>Tentar novamente</Button></div> : <div className="space-y-3">{messages.map(message => <article key={message.id} className={`max-w-full rounded-lg border p-3 ${message.sender_id === user?.id ? 'border-primary/20 bg-primary/5' : 'border-border bg-muted'}`}>
      <div className="mb-2 flex flex-wrap justify-between gap-2 text-xs"><span className="font-semibold">{message.sender_id === ticket.user_id ? 'Você' : 'Equipe de suporte'}</span><span className="text-muted-foreground">{formatDateTime(message.created_at)}</span></div>
      <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p><Attachments urls={message.attachments} />
    </article>)}</div>}
    {isTicketClosed(ticket.status) ? <p className="border-t border-border pt-4 text-sm text-muted-foreground">Atendimento {TICKET_STATUS_LABELS[ticket.status].toLowerCase()}.</p> : <form className="space-y-3 border-t border-border pt-4" onSubmit={event => { event.preventDefault(); if (reply.trim() && !send.isPending) send.mutate(); }}><Label htmlFor="ticket-reply">Sua resposta</Label><Textarea id="ticket-reply" rows={4} value={reply} onChange={event => setReply(event.target.value)} disabled={send.isPending} /><Button type="submit" disabled={!reply.trim() || send.isPending}>{send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar resposta</Button></form>}
  </section>;
}

export default function MeusTickets() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState<TicketStatus | 'all'>('all');
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['my-tickets', user?.id, page, status], queryFn: () => user ? loadMyTickets(user.id, page, PAGE_SIZE, status === 'all' ? undefined : status) : Promise.resolve({ tickets: [], count: 0 }), enabled: !!user, refetchInterval: 30000 });
  const selected = data?.tickets.find(ticket => ticket.id === params.get('ticket'));
  return <div className="container mx-auto max-w-6xl px-4 py-8">
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4"><h1 className="flex items-center gap-3 text-2xl font-bold"><LifeBuoy className="h-7 w-7 text-primary" /> Meus tickets</h1><div className="flex gap-2"><Button variant="outline" size="icon" title="Atualizar atendimentos" aria-label="Atualizar atendimentos" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button><Button asChild><Link to="/contato"><Plus className="h-4 w-4" /> Novo atendimento</Link></Button></div></header>
    <div className="mb-6"><Select value={status} onValueChange={value => { setStatus(value as TicketStatus | 'all'); setPage(0); setParams({}); }}><SelectTrigger aria-label="Filtrar por status" className="w-full sm:w-64"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os status</SelectItem>{Object.entries(TICKET_STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
    {isLoading ? <Loader2 aria-label="Carregando atendimentos" className="mx-auto my-12 h-8 w-8 animate-spin text-primary" /> : isError ? <div className="space-y-3 py-10"><p className="text-destructive">Não foi possível carregar seus atendimentos.</p><Button variant="outline" onClick={() => refetch()}>Tentar novamente</Button></div> : !data?.tickets.length ? <div className="py-12 text-center"><MessageSquare className="mx-auto mb-3 h-10 w-10 text-muted-foreground" /><p className="text-muted-foreground">Nenhum atendimento encontrado.</p></div> : <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]"><div className="min-w-0">
      <div className="divide-y divide-border border-y border-border">{data.tickets.map(ticket => <Button key={ticket.id} variant="ghost" onClick={() => setParams({ ticket: ticket.id })} className={`h-auto w-full flex-col items-start gap-2 whitespace-normal rounded-none py-4 text-left ${selected?.id === ticket.id ? 'bg-primary/10' : ''}`}><span className="break-words font-semibold">{ticket.subject}</span><span className="flex w-full flex-wrap items-center justify-between gap-2"><Badge variant="secondary">{TICKET_STATUS_LABELS[ticket.status]}</Badge><span className="text-xs text-muted-foreground">{formatDateTime(ticket.created_at)}</span></span></Button>)}</div>
      <div className="mt-4 flex items-center justify-between"><p className="text-xs text-muted-foreground">{data.count} atendimentos · Página {page + 1}</p><div className="flex gap-1"><Button variant="outline" size="icon" aria-label="Página anterior" disabled={page === 0} onClick={() => { setPage(current => current - 1); setParams({}); }}><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" size="icon" aria-label="Próxima página" disabled={(page + 1) * PAGE_SIZE >= data.count} onClick={() => { setPage(current => current + 1); setParams({}); }}><ChevronRight className="h-4 w-4" /></Button></div></div>
    </div>{selected ? <TicketThread key={selected.id} ticket={selected} /> : <p className="py-8 text-sm text-muted-foreground">Selecione um atendimento.</p>}</div>}
  </div>;
}