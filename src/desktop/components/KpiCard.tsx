import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Tier, Tone, tierValueClass, toneText } from '@/lib/semanticTone';

// GAP-D390: Formatação automática
const formatValue = (value: string | number, format?: 'auto' | 'currency' | 'number' | 'percent'): string => {
  if (typeof value === 'string') return value;
  
  if (format === 'currency') {
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    }).format(value);
  }
  
  if (format === 'percent') {
    return new Intl.NumberFormat('pt-BR', { 
      style: 'percent', 
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(value / 100);
  }
  
  // Auto: decide baseado no tamanho
  if (format === 'auto' || !format) {
    if (Math.abs(value) >= 1_000_000) {
      return (value / 1_000_000).toFixed(1) + 'M';
    }
    if (Math.abs(value) >= 1_000) {
      return (value / 1_000).toFixed(1) + 'K';
    }
    return value.toLocaleString('pt-BR');
  }
  
  return value.toLocaleString('pt-BR');
};

/**
 * Card de KPI do backoffice seguindo o DESIGN-SYSTEM.md:
 * Regra 1 (cor = papel), Regra 2 (tier define tamanho), Regra 6/7 (espaçamento e escala).
 */
export function KpiCard({
  label,
  value,
  icon: Icon,
  tone = 'muted',
  tier = 4,
  hint,
  className,
  loading = false,
  format = 'auto',
  trend,
  trendLabel,
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  tone?: Tone;
  tier?: Tier;
  hint?: string;
  className?: string;
  loading?: boolean;
  format?: 'auto' | 'currency' | 'number' | 'percent';
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
}) {
  // GAP-D389: Estado de loading
  if (loading) {
    return (
      <Card className={cn('border-border/50', className)}>
        <CardContent className="pt-4 pb-3 px-4 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            {Icon && <Skeleton className="h-5 w-5 rounded" />}
            <Skeleton className="h-3 w-24 rounded" />
          </div>
          <Skeleton className="h-8 w-20 rounded" />
          {hint && <Skeleton className="h-3 w-32 rounded" />}
        </CardContent>
      </Card>
    );
  }

  // GAP-D390: Formatação do valor
  const formattedValue = formatValue(value, format);
  
  // Trend indicators
  const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : null;
  const trendColor = trend === 'up' ? 'text-success' : trend === 'down' ? 'text-destructive' : 'text-muted-foreground';

  return (
    <Card className={cn('border-border/50 transition-all hover:border-primary/20', className)}>
      <CardContent className="pt-4 pb-3 px-4 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {Icon && <Icon className={cn('h-5 w-5', toneText[tone])} />}
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
          </div>
          {trend && trendLabel && (
            <div className="flex items-center gap-1">
              <span className={cn('text-xs font-semibold', trendColor)}>
                {trendIcon} {trendLabel}
              </span>
            </div>
          )}
        </div>
        <p className={cn(tierValueClass[tier], toneText[tone], 'tracking-tight')}>
          {formattedValue}
        </p>
        {hint && (
          <p className="text-xs text-muted-foreground/70 mt-0.5">{hint}</p>
        )}
      </CardContent>
    </Card>
  );
}