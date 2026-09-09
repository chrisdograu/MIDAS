// Rodada 18 — estado de conexão visível e fila de ações pendentes.
import { useEffect, useState, useCallback } from 'react';
import { CloudOff, RefreshCw, CheckCircle, X, AlertCircle, Loader2 } from 'lucide-react';
import { subscribeQueue, flushQueue, type OfflineAction, clearQueue } from '@/lib/offlineQueue';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// GAP-OF04: Estado de cancelamento
let cancelSync = false;

export function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

// GAP-OF03: Progresso do sync
interface SyncProgress {
  current: number;
  total: number;
  status: 'idle' | 'syncing' | 'completed' | 'error';
  error?: string;
}

interface OfflineBannerProps {
  /** GAP-OF01: Mostrar botão de retry manual */
  showRetry?: boolean;
  /** GAP-OF02: Persistir fila no localStorage */
  persistQueue?: boolean;
  /** GAP-OF03: Mostrar progresso */
  showProgress?: boolean;
  /** GAP-OF04: Permitir cancelar */
  allowCancel?: boolean;
  /** GAP-OF01: Auto-retry interval em ms */
  autoRetryInterval?: number;
}

export default function OfflineBanner({ 
  showRetry = true,
  persistQueue = true,
  showProgress = true,
  allowCancel = true,
  autoRetryInterval = 30000,
}: OfflineBannerProps) {
  const online = useOnline();
  const [pending, setPending] = useState<OfflineAction[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<SyncProgress>({ current: 0, total: 0, status: 'idle' });
  const [lastSyncAttempt, setLastSyncAttempt] = useState<number>(0);

  // GAP-OF02: Carregar fila do localStorage
  useEffect(() => {
    if (!persistQueue) return;
    try {
      const saved = localStorage.getItem('offline_queue');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPending(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, [persistQueue]);

  // GAP-OF02: Salvar fila no localStorage
  useEffect(() => {
    if (!persistQueue) return;
    try {
      localStorage.setItem('offline_queue', JSON.stringify(pending));
    } catch {
      // ignore
    }
  }, [pending, persistQueue]);

  useEffect(() => subscribeQueue(setPending), []);

  // GAP-OF01: Auto-retry
  useEffect(() => {
    if (!online || pending.length === 0 || syncing) return;
    
    const now = Date.now();
    if (now - lastSyncAttempt > autoRetryInterval) {
      setLastSyncAttempt(now);
      performSync();
    }
  }, [online, pending.length, syncing, lastSyncAttempt, autoRetryInterval]);

  const performSync = async () => {
    if (syncing || pending.length === 0) return;
    
    cancelSync = false;
    setSyncing(true);
    setProgress({ current: 0, total: pending.length, status: 'syncing' });

    try {
      const result = await flushQueue({
        onProgress: (current, total) => {
          setProgress({ current, total, status: 'syncing' });
        },
        onError: (error, action) => {
          console.error('Sync error:', error, action);
        },
        shouldCancel: () => cancelSync,
      });

      if (cancelSync) {
        setProgress({ current: 0, total: pending.length, status: 'idle' });
        toast.info('Sincronização cancelada');
        return;
      }

      if (result.success) {
        setProgress({ current: result.total, total: result.total, status: 'completed' });
        toast.success(`${result.total} ação(ões) sincronizada(s) com sucesso!`);
        // GAP-OF02: Limpar localStorage após sucesso
        if (persistQueue) {
          localStorage.removeItem('offline_queue');
        }
        setTimeout(() => {
          setProgress({ current: 0, total: 0, status: 'idle' });
        }, 3000);
      } else {
        setProgress({ 
          current: result.synced, 
          total: pending.length, 
          status: 'error',
          error: result.errors.length > 0 ? `${result.errors.length} erro(s) ao sincronizar` : undefined,
        });
        toast.error('Erro ao sincronizar algumas ações');
      }
    } catch (error) {
      setProgress({ 
        current: 0, 
        total: pending.length, 
        status: 'error',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    } finally {
      setSyncing(false);
    }
  };

  // GAP-OF01: Retry manual
  const handleRetry = useCallback(() => {
    if (syncing) return;
    setLastSyncAttempt(Date.now());
    performSync();
  }, [syncing, performSync]);

  // GAP-OF04: Cancelar sincronização
  const handleCancel = useCallback(() => {
    if (!syncing) return;
    cancelSync = true;
    toast.info('Cancelando sincronização...');
  }, [syncing]);

  // GAP-OF04: Limpar fila
  const handleClear = useCallback(() => {
    if (pending.length === 0) return;
    if (confirm('Tem certeza que deseja descartar todas as ações pendentes?')) {
      clearQueue();
      setPending([]);
      if (persistQueue) {
        localStorage.removeItem('offline_queue');
      }
      toast.info('Fila limpa');
    }
  }, [pending.length, persistQueue]);

  if (online && pending.length === 0 && progress.status === 'idle') return null;

  const isSyncing = syncing || progress.status === 'syncing';
  const isCompleted = progress.status === 'completed';
  const isError = progress.status === 'error';
  const showBanner = !online || pending.length > 0 || isSyncing || isCompleted || isError;

  if (!showBanner) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        role="status"
        className={cn(
          "fixed bottom-4 left-1/2 -translate-x-1/2 z-[80] px-4 py-3 rounded-xl border shadow-xl flex flex-col gap-2",
          "max-w-[calc(100vw-2rem)] w-full max-w-md",
          online && !isError ? 'bg-card border-primary/40' : 'bg-card border-destructive/40'
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Ícone */}
          <div className={cn(
            "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
            online && !isError ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'
          )}>
            {isCompleted ? (
              <CheckCircle className="h-4 w-4 text-success" />
            ) : isSyncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : online ? (
              <RefreshCw className="h-4 w-4" />
            ) : (
              <CloudOff className="h-4 w-4" />
            )}
          </div>

          {/* Mensagem */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {isCompleted ? 'Sincronizado!' : 
               isSyncing ? 'Sincronizando ações...' :
               online ? `Reenviando ${pending.length} ação(ões)...` :
               pending.length > 0 
                 ? `${pending.length} ação(ões) pendente(s)` 
                 : 'Sem conexão'}
            </p>
            {!isCompleted && !isSyncing && !online && pending.length > 0 && (
              <p className="text-xs text-muted-foreground truncate">
                Suas ações serão enviadas quando a conexão for restabelecida
              </p>
            )}
          </div>

          {/* Ações */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {isSyncing && allowCancel && (
              <button
                onClick={handleCancel}
                className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                aria-label="Cancelar sincronização"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            
            {!isSyncing && !isCompleted && online && pending.length > 0 && showRetry && (
              <button
                onClick={handleRetry}
                className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-primary"
                aria-label="Tentar novamente"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            )}
            
            {!isSyncing && !online && pending.length > 0 && allowCancel && (
              <button
                onClick={handleClear}
                className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-destructive"
                aria-label="Limpar fila"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* GAP-OF03: Barra de progresso */}
        {showProgress && (isSyncing || isCompleted || isError) && progress.total > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(progress.current / progress.total) * 100}%` }}
                className={cn(
                  "h-full rounded-full transition-colors",
                  isError ? 'bg-destructive' : isCompleted ? 'bg-success' : 'bg-primary'
                )}
              />
            </div>
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
              {progress.current}/{progress.total}
              {isError && <span className="ml-1 text-destructive">⚠️</span>}
            </span>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

/** Aviso para ações que exigem rede na hora (compra, pagamento). */
export function RequiresConnection({ children }: { children?: React.ReactNode }) {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="border border-destructive/40 bg-destructive/10 rounded-lg p-3 text-xs text-destructive">
      <p className="font-semibold flex items-center gap-1.5">
        <CloudOff className="h-3.5 w-3.5" /> Esta ação precisa de internet
      </p>
      <p className="text-muted-foreground mt-1">
        {children || 'Compras e pagamentos não podem ser feitos offline. Reconecte e tente de novo — nada foi cobrado.'}
      </p>
    </div>
  );
}