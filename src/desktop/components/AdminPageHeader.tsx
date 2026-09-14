import { LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';

export function AdminPageHeader({
  icon: Icon, 
  title, 
  subtitle, 
  actions,
  pendingCount,
  pendingLabel,
}: { 
  icon: LucideIcon; 
  title: string; 
  subtitle?: string; 
  actions?: ReactNode;
  pendingCount?: number;
  pendingLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Icon className="h-6 w-6 text-primary" /> 
          {title}
          {pendingCount !== undefined && pendingCount > 0 && (
            <Badge variant="destructive" className="ml-2 text-xs">
              {pendingCount} {pendingLabel || 'pendente(s)'}
            </Badge>
          )}
        </h1>
        {subtitle && <p className="text-muted-foreground text-sm">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}