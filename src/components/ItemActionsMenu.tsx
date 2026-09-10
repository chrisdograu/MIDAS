import { useState, ReactNode, KeyboardEvent, useCallback } from 'react';
import { MoreVertical, Copy, Flag, Trash2, Link as LinkIcon, Check, Pencil, Share2, Bookmark, Ban, Pin, Clock } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { toast } from 'sonner';
import { ReportDialog } from '@/components/ReportDialog';
import { cn } from '@/lib/utils';

type ReportType =
  | 'profile'
  | 'anuncio'
  | 'forum_post'
  | 'comentario_forum'
  | 'review'
  | 'comentario_review'
  | 'mensagem'
  | 'conversa';

// GAP-IA01: Item de ação customizável
interface ActionItem {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  tone?: 'default' | 'destructive' | 'primary';
  shortcut?: string;
  disabled?: boolean;
  separator?: boolean;
}

// GAP-IA03: Componente de confirm dialog
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function DefaultConfirmDialog({ 
  open, 
  title, 
  message, 
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;
  
  return (
    <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl p-6 max-w-sm w-full border border-border shadow-xl">
        <h4 className="text-lg font-semibold text-foreground">{title}</h4>
        <p className="text-sm text-muted-foreground mt-2">{message}</p>
        <div className="flex gap-2 mt-4">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-lg bg-secondary text-sm font-semibold hover:bg-secondary/70 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

interface Props {
  /** Texto a ser copiado (mensagem, conteúdo do post, comentário). */
  copyText?: string;
  /** Link absoluto/relativo a ser copiado (compartilhar). */
  shareUrl?: string;
  /** Se true mostra a opção de excluir e chama onDelete. */
  canDelete?: boolean;
  onDelete?: () => void | Promise<void>;
  deleteConfirm?: string;
  deleteConfirmTitle?: string;
  canEdit?: boolean;
  onEdit?: () => void;
  /** Se setado, mostra a opção "Denunciar" e abre o ReportDialog. */
  reportType?: ReportType;
  reportTargetId?: string;
  reportLabel?: string;
  /** Cor/tamanho do botão. */
  className?: string;
  iconClassName?: string;
  /** Slot para itens extras no menu. */
  extra?: ReactNode;
  /** GAP-IA01: Ações customizadas */
  items?: ActionItem[];
  /** GAP-IA02: Atalhos de teclado habilitados */
  enableShortcuts?: boolean;
  /** GAP-IA04: Mostrar separadores entre grupos */
  showSeparators?: boolean;
  /** GAP-IA03: Componente de confirm dialog customizado */
  ConfirmDialogComponent?: React.ComponentType<ConfirmDialogProps>;
  /** GAP-IA03: Desabilitar confirm dialog */
  disableConfirm?: boolean;
}

export function ItemActionsMenu({
  copyText,
  shareUrl,
  canDelete,
  onDelete,
  deleteConfirm = 'Tem certeza que deseja excluir?',
  deleteConfirmTitle = 'Confirmar exclusão',
  canEdit,
  onEdit,
  reportType,
  reportTargetId,
  reportLabel,
  className = '',
  iconClassName = 'h-4 w-4',
  extra,
  items = [],
  enableShortcuts = true,
  showSeparators = true,
  ConfirmDialogComponent = DefaultConfirmDialog,
  disableConfirm = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const close = () => setOpen(false);

  const doCopy = async (text: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(msg);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      toast.error('Não foi possível copiar');
    }
    close();
  };

  const handleDelete = () => {
    close();
    if (disableConfirm) {
      onDelete?.();
      return;
    }
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    setConfirmOpen(false);
    await onDelete?.();
  };

  // GAP-IA02: Atalhos de teclado
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!open || !enableShortcuts) return;
    
    const key = e.key.toLowerCase();
    const actions: Record<string, () => void> = {};
    
    if (copyText) actions['c'] = () => doCopy(copyText, 'Texto copiado');
    if (shareUrl) actions['l'] = () => {
      const abs = shareUrl.startsWith('http') ? shareUrl : `${window.location.origin}${shareUrl}`;
      doCopy(abs, 'Link copiado');
    };
    if (canEdit && onEdit) actions['e'] = () => { close(); onEdit(); };
    if (reportType && reportTargetId) actions['r'] = () => { close(); setReportOpen(true); };
    if (canDelete) actions['d'] = handleDelete;
    
    if (key === 'escape') { setOpen(false); return; }
    if (key in actions) {
      e.preventDefault();
      actions[key]();
    }
  }, [open, enableShortcuts, copyText, shareUrl, canEdit, onEdit, reportType, reportTargetId, canDelete]);

  // GAP-IA01: Construir itens do menu
  const menuItems: ActionItem[] = [
    ...items,
    ...(canEdit && onEdit ? [{ label: 'Editar', icon: <Pencil className="h-4 w-4" />, onClick: () => { close(); onEdit(); }, shortcut: 'E' }] : []),
    ...(copyText ? [{ label: 'Copiar texto', icon: copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />, onClick: () => doCopy(copyText, 'Texto copiado'), shortcut: 'C' }] : []),
    ...(shareUrl ? [{ label: 'Copiar link', icon: <LinkIcon className="h-4 w-4" />, onClick: () => {
      const abs = shareUrl.startsWith('http') ? shareUrl : `${window.location.origin}${shareUrl}`;
      doCopy(abs, 'Link copiado');
    }, shortcut: 'L' }] : []),
    ...(reportType && reportTargetId ? [{ label: 'Denunciar', icon: <Flag className="h-4 w-4" />, onClick: () => { close(); setReportOpen(true); }, shortcut: 'R', tone: 'destructive' as const }] : []),
    ...(canDelete ? [{ label: 'Excluir', icon: <Trash2 className="h-4 w-4" />, onClick: handleDelete, shortcut: 'D', tone: 'destructive' }] : []),
  ];

  // GAP-IA04: Adicionar separadores
  const renderItems = () => {
    const result: ReactNode[] = [];
    let hasSeparator = false;

    menuItems.forEach((item, index) => {
      if (item.separator && showSeparators) {
        result.push(
          <div key={`sep-${index}`} className="my-1 border-t border-border" />
        );
        hasSeparator = true;
        return;
      }

      result.push(
        <MenuItem
          key={index}
          icon={item.icon}
          label={item.label}
          onClick={item.onClick}
          tone={item.tone}
          shortcut={item.shortcut}
          disabled={item.disabled}
          className={cn(
            item.tone === 'destructive' && 'text-destructive hover:bg-destructive/10',
            item.tone === 'primary' && 'text-primary hover:bg-primary/10',
          )}
        />
      );
    });

    return result;
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            aria-label="Mais ações"
            data-item-actions-trigger="true"
            className={`p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors ${className}`}
            onKeyDown={handleKeyDown}
          >
            <MoreVertical className={iconClassName} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={4}
          onClick={(e) => e.stopPropagation()}
          onOpenAutoFocus={(e) => e.preventDefault()}
          collisionPadding={12}
          className="z-[120] w-56 p-1 rounded-xl border border-border bg-popover/95 backdrop-blur-xl shadow-2xl"
        >
          {/* GAP-IA02: Atalhos de teclado */}
          {enableShortcuts && (
            <div className="px-2.5 py-1.5 text-[10px] text-muted-foreground border-b border-border flex items-center justify-between">
              <span>Atalhos</span>
              <kbd className="px-1.5 py-0.5 bg-secondary/50 rounded text-[9px] font-mono">⌘K</kbd>
            </div>
          )}
          
          {renderItems()}
          
          {extra && (
            <>
              {showSeparators && <div className="my-1 border-t border-border" />}
              {extra}
            </>
          )}
          
          {/* GAP-IA02: Dica de atalhos */}
          {enableShortcuts && (
            <div className="px-2.5 py-1.5 border-t border-border text-[10px] text-muted-foreground mt-1">
              Pressione a letra destacada para ação rápida
            </div>
          )}
        </PopoverContent>
      </Popover>

      {reportType && reportTargetId && (
        <ReportDialog
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          targetType={reportType}
          targetId={reportTargetId}
          label={reportLabel}
        />
      )}

      {/* GAP-IA03: Confirm dialog */}
      <ConfirmDialogComponent
        open={confirmOpen}
        title={deleteConfirmTitle}
        message={deleteConfirm}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}

// GAP-IA01: Componente MenuItem com suporte a atalhos
function MenuItem({
  icon,
  label,
  onClick,
  tone = 'default',
  shortcut,
  disabled = false,
  className = '',
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  tone?: 'default' | 'destructive' | 'primary';
  shortcut?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-sm transition-colors",
        "hover:bg-muted/60",
        disabled && "opacity-50 cursor-not-allowed",
        tone === 'destructive' && "text-destructive hover:bg-destructive/10",
        tone === 'primary' && "text-primary hover:bg-primary/10",
        className,
      )}
    >
      <span className="flex items-center gap-2">
        <span className="shrink-0">{icon}</span>
        <span className="font-medium">{label}</span>
      </span>
      {shortcut && (
        <kbd className="text-[10px] text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded font-mono">
          {shortcut}
        </kbd>
      )}
    </button>
  );
}