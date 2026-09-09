
import { Button } from '@/components/ui/button';
import { X, CheckSquare } from 'lucide-react';

interface BulkActionsBarProps {
  selectedCount: number;
  onClear: () => void;
  actions: {
    label: string;
    onClick: () => void;
    variant?: 'default' | 'destructive' | 'outline' | 'secondary';
    icon?: React.ReactNode;
  }[];
  className?: string;
}

export function BulkActionsBar({ selectedCount, onClear, actions, className = '' }: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className={`flex items-center gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20 ${className}`}>
      <CheckSquare className="h-4 w-4 text-primary" />
      <span className="text-sm font-semibold">{selectedCount} selecionado{selectedCount > 1 ? 's' : ''}</span>
      <div className="flex gap-1">
        {actions.map((action, index) => (
          <Button
            key={index}
            size="sm"
            variant={action.variant || 'outline'}
            onClick={action.onClick}
            className="h-8 text-xs"
          >
            {action.icon}
            {action.label}
          </Button>
        ))}
      </div>
      <Button variant="ghost" size="sm" onClick={onClear} className="h-8 text-xs ml-auto">
        <X className="h-3.5 w-3.5 mr-1" /> Limpar
      </Button>
    </div>
  );
}