import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { EyeOff, Eye, AlertTriangle, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { dbWrite } from '@/lib/dbWrite';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Scope = 'feed' | 'social_library' | 'both';

interface Props {
  productId: string;
  scope?: Scope;
  className?: string;
  size?: 'sm' | 'md';
  initialMuted?: boolean;
  /** GAP-MG03: Callback para quando o mute muda */
  onMuteChange?: (muted: boolean, scope: Scope) => void;
}

// GAP-MG01: Labels por escopo
const SCOPE_LABEL: Record<Scope, string> = {
  feed: 'Feed',
  social_library: 'Biblioteca Social',
  both: 'Ambos',
};

const SCOPE_DESCRIPTION: Record<Scope, string> = {
  feed: 'Posts, reviews e fórum',
  social_library: 'Screenshots, opiniões e timeline',
  both: 'Todo conteúdo relacionado',
};

export default function MuteGameButton({
  productId,
  scope = 'both',
  className = '',
  size = 'sm',
  initialMuted = false,
  onMuteChange,
}: Props) {
  const { user } = useAuth();
  const [muted, setMuted] = useState(initialMuted);
  const [currentScope, setCurrentScope] = useState<Scope>(scope);
  const [loading, setLoading] = useState(false);
  // GAP-MG02: Dialog de confirmação
  const [showDialog, setShowDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<'mute' | 'unmute' | null>(null);

  // GAP-MG04: Sincronização em tempo real
  useEffect(() => {
    if (!user || !productId) return;

    const channel = supabase
      .channel(`mute-${user.id}-${productId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_game_mutes',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Recarregar estado
          checkMuteStatus();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, productId]);

  const checkMuteStatus = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_game_mutes' as any)
      .select('scope')
      .eq('user_id', user.id)
      .eq('product_id', productId)
      .maybeSingle();
    setMuted(!!data);
    if (data) setCurrentScope((data as any).scope || 'both');
  };

  useEffect(() => {
    checkMuteStatus();
  }, [user?.id, productId]);

  if (!user) return null;

  const handleMute = async () => {
    setLoading(true);
    const { error } = await supabase.from('user_game_mutes' as any).upsert(
      { user_id: user.id, product_id: productId, scope: currentScope } as any,
      { onConflict: 'user_id,product_id' }
    );
    setLoading(false);
    if (error) { toast.error('Erro ao silenciar'); return; }
    setMuted(true);
    toast.success(`Conteúdo deste jogo silenciado em ${SCOPE_LABEL[currentScope]}`);
    onMuteChange?.(true, currentScope);
    setShowDialog(false);
  };

  const handleUnmute = async () => {
    setLoading(true);
    await dbWrite(supabase.from('user_game_mutes' as any).delete().match({
      user_id: user.id,
      product_id: productId,
    }));
    setLoading(false);
    setMuted(false);
    toast.success('Conteúdo deste jogo voltou a aparecer');
    onMuteChange?.(false, currentScope);
    setShowDialog(false);
  };

  const confirmAction = (action: 'mute' | 'unmute') => {
    setPendingAction(action);
    setShowDialog(true);
  };

  const Icon = muted ? Eye : EyeOff;
  const label = muted ? 'Mostrar este jogo' : 'Não mostrar mais este jogo';
  const px = size === 'sm' ? 'px-2 py-1 text-[11px]' : 'px-3 py-2 text-xs';

  // GAP-MG01: Indicador de escopo no botão
  const scopeIndicator = muted && (
    <span className="text-[8px] opacity-60 ml-0.5">
      {SCOPE_LABEL[currentScope]}
    </span>
  );

  return (
    <>
      <button
        onClick={() => confirmAction(muted ? 'unmute' : 'mute')}
        disabled={loading}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md bg-secondary text-muted-foreground hover:text-foreground hover:bg-muted transition disabled:opacity-50",
          px,
          className,
          muted && "bg-primary/10 text-primary hover:bg-primary/20"
        )}
        title={label}
      >
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
        {scopeIndicator}
      </button>

      {/* GAP-MG02: Dialog de confirmação */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              {pendingAction === 'mute' ? 'Silenciar jogo' : 'Mostrar jogo novamente'}
            </DialogTitle>
            <DialogDescription>
              {pendingAction === 'mute' ? (
                <>
                  Você não verá mais conteúdo deste jogo em <strong>{SCOPE_LABEL[currentScope]}</strong>.
                  <br />
                  <span className="text-xs text-muted-foreground block mt-1">
                    ({SCOPE_DESCRIPTION[currentScope]})
                  </span>
                </>
              ) : (
                'O conteúdo deste jogo voltará a aparecer normalmente.'
              )}
            </DialogDescription>
          </DialogHeader>

          {/* GAP-MG01: Seletor de escopo ao mutar */}
          {pendingAction === 'mute' && (
            <div className="py-2">
              <p className="text-xs font-medium text-foreground mb-1.5">Onde silenciar?</p>
              <div className="flex gap-1.5">
                {(['feed', 'social_library', 'both'] as Scope[]).map(s => (
                  <button
                    key={s}
                    onClick={() => setCurrentScope(s)}
                    className={cn(
                      "flex-1 px-2 py-1.5 rounded-lg text-[10px] font-medium border transition",
                      currentScope === s
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {SCOPE_LABEL[s]}
                  </button>
                ))}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button
              variant={pendingAction === 'mute' ? 'default' : 'secondary'}
              onClick={pendingAction === 'mute' ? handleMute : handleUnmute}
              disabled={loading}
            >
              {loading ? '...' : pendingAction === 'mute' ? 'Silenciar' : 'Mostrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}