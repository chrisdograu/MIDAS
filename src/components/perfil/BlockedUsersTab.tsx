import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, UserX, ShieldOff, User, Store, AlertTriangle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface BlockedUser {
  id: string;
  blocked_id: string;
  scope: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  reason?: string | null;
}

const SCOPE_LABEL: Record<string, { label: string; icon: any; cls: string }> = {
  personal: { label: 'Perfil pessoal', icon: User, cls: 'bg-primary/15 text-primary' },
  seller: { label: 'Perfil vendedor', icon: Store, cls: 'bg-accent/15 text-accent' },
  all: { label: 'Tudo', icon: ShieldOff, cls: 'bg-destructive/15 text-destructive' },
};

export default function BlockedUsersTab() {
  const { user } = useAuth();
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblocking, setUnblocking] = useState<string | null>(null);
  // GAP-BU01: Dialog de confirmação
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; id: string; name: string }>({
    open: false,
    id: '',
    name: '',
  });

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: blocks } = await supabase
      .from('blocked_users')
      .select('id, blocked_id, scope, created_at, reason')
      .eq('blocker_id', user.id)
      .order('created_at', { ascending: false });

    if (!blocks || blocks.length === 0) { setBlocked([]); setLoading(false); return; }

    const ids = [...new Set(blocks.map(b => b.blocked_id))];
    const { data: profiles } = await supabase
      .from('profiles').select('id, display_name, avatar_url').in('id', ids);

    const map = new Map((profiles || []).map(p => [p.id, p]));
    setBlocked(blocks.map(b => {
      const p = map.get(b.blocked_id);
      return {
        id: b.id,
        blocked_id: b.blocked_id,
        scope: (b as any).scope || 'all',
        created_at: b.created_at,
        reason: (b as any).reason || null,
        display_name: p?.display_name || null,
        avatar_url: p?.avatar_url || null,
      };
    }));
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const handleUnblock = async (blockId: string) => {
    const { error } = await supabase.from('blocked_users').delete().eq('id', blockId);
    if (error) { toast.error('Erro ao desbloquear'); return; }
    toast.success('Usuário desbloqueado');
    setConfirmDialog({ open: false, id: '', name: '' });
    load();
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  if (blocked.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <ShieldOff className="h-12 w-12 mx-auto mb-3 opacity-40" />
        <p className="text-sm">Você não bloqueou nenhum usuário</p>
        <p className="text-xs mt-1">Bloqueios podem ser feitos por escopo: pessoal (@), vendedor ($) ou ambos.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {blocked.map(b => {
          const meta = SCOPE_LABEL[b.scope] || SCOPE_LABEL.all;
          const Icon = meta.icon;
          return (
            <div key={b.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-secondary/40">
              <div className="w-10 h-10 rounded-full bg-primary/20 overflow-hidden flex items-center justify-center shrink-0">
                {b.avatar_url ? (
                  <img src={b.avatar_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <UserX className="h-5 w-5 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{b.display_name || 'Usuário'}</p>
                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                  <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold", meta.cls)}>
                    <Icon className="h-3 w-3" /> {meta.label}
                  </span>
                  {/* GAP-BU02: Data do bloqueio */}
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" />
                    {formatDate(b.created_at)}
                  </span>
                  {/* GAP-BU03: Razão do bloqueio */}
                  {b.reason && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <AlertTriangle className="h-2.5 w-2.5 text-warning" />
                      {b.reason}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setConfirmDialog({ open: true, id: b.id, name: b.display_name || 'usuário' })}
                className="text-xs px-3 py-1.5 rounded-lg bg-secondary hover:bg-destructive/20 text-foreground hover:text-destructive transition-colors"
              >
                Desbloquear
              </button>
            </div>
          );
        })}
      </div>

      {/* GAP-BU01: Dialog de confirmação */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog({ open: false, id: '', name: '' })}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Desbloquear usuário
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja desbloquear <span className="font-semibold text-foreground">{confirmDialog.name}</span>?
              {confirmDialog.name && (
                <span className="block text-xs text-muted-foreground mt-1">
                  Ele poderá ver seu perfil, enviar mensagens e interagir com seu conteúdo novamente.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmDialog({ open: false, id: '', name: '' })}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleUnblock(confirmDialog.id)}
            >
              Desbloquear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}