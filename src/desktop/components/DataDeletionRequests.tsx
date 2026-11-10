import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { formatDateTime } from '@/lib/format';
import { toast } from 'sonner';

interface DeletionRequest {
  id: string; user_id: string; status: string; requested_at: string; scheduled_for: string; completed_at: string | null;
}

export default function DataDeletionRequests() {
  const [authorized, setAuthorized] = useState(false);
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<DeletionRequest | null>(null);
  const [completing, setCompleting] = useState(false);
  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('data_deletion_requests').select('*').order('requested_at', { ascending: false }).limit(100);
    setLoading(false);
    if (error) { toast.error('Não foi possível carregar as solicitações'); return; }
    setRequests(data || []);
  };
  useEffect(() => {
    let active = true;
    void supabase.rpc('is_admin_pleno').then(({ data, error }) => {
      if (!active || error) return;
      setAuthorized(Boolean(data));
      if (data) void load();
    });
    return () => { active = false; };
  }, []);
  const complete = async () => {
    if (!pending || completing) return;
    setCompleting(true);
    const { error } = await supabase.rpc('admin_complete_data_deletion', { _request_id: pending.id });
    setCompleting(false);
    if (error) { toast.error(error.message); return; }
    setPending(null);
    toast.success('Anonimização concluída e registrada.');
    await load();
  };
  if (!authorized) return null;
  return (
    <section className="space-y-3 border-t border-border pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2"><Trash2 className="h-5 w-5 text-destructive" />Solicitações de exclusão de dados</h2>
        <Button variant="ghost" size="icon" aria-label="Atualizar solicitações" title="Atualizar solicitações" onClick={load} disabled={loading}><RefreshCw className="h-4 w-4" /></Button>
      </div>
      {loading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : requests.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma solicitação registrada.</p> : (
        <div className="divide-y divide-border">
          {requests.map(request => <div key={request.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium break-all">Conta {request.user_id}</p>
              <p className="text-xs text-muted-foreground">Solicitado em {formatDateTime(request.requested_at)} · Prazo {formatDateTime(request.scheduled_for)}</p>
              <p className="text-xs text-muted-foreground">{request.status}{request.completed_at ? ` · Concluído em ${formatDateTime(request.completed_at)}` : ''}</p>
            </div>
            {['solicitado', 'agendado'].includes(request.status) && <Button variant="destructive" size="sm" onClick={() => setPending(request)}><Trash2 className="h-4 w-4" />Concluir anonimização</Button>}
          </div>)}
        </div>
      )}
      <AlertDialog open={Boolean(pending)} onOpenChange={open => { if (!open && !completing) setPending(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Concluir anonimização?</AlertDialogTitle>
            <AlertDialogDescription>Os dados pessoais desta conta serão removidos do perfil e o acesso será bloqueado. Posts e registros necessários por obrigação legal serão preservados. Esta ação é irreversível.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={completing}>Cancelar</AlertDialogCancel><Button variant="destructive" onClick={complete} isLoading={completing}>Confirmar anonimização</Button></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}