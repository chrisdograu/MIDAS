import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// GAP-SK02: Shimmer animation
const shimmer = "relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent";

// GAP-SK01: Tamanhos
type Size = 'sm' | 'md' | 'lg';

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'h-3 w-16',
  md: 'h-4 w-24',
  lg: 'h-5 w-32',
};

export function GameCardSkeleton({ size = 'md' }: { size?: Size }) {
  return (
    <div className={cn("space-y-2", shimmer)}>
      <Skeleton className={cn("aspect-[3/4] w-full rounded-lg", size === 'sm' ? 'max-w-32' : size === 'lg' ? 'max-w-48' : 'max-w-40')} />
      <Skeleton className={cn(SIZE_CLASSES[size], "w-3/4")} />
      <Skeleton className={cn(SIZE_CLASSES[size], "w-1/2")} />
    </div>
  );
}

export function GameCardGridSkeleton({ count = 8, size = 'md' }: { count?: number; size?: Size }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {Array.from({ length: count }).map((_, i) => <GameCardSkeleton key={i} size={size} />)}
    </div>
  );
}

export function FeedItemSkeleton({ count = 1 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={cn("flex gap-3 p-3 rounded-lg border border-border bg-card/40", shimmer)}>
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </>
  );
}

export function RadarSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      <Skeleton className="h-5 w-40" />
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className={cn("w-44 shrink-0 space-y-2", shimmer)}>
            <Skeleton className="aspect-[3/4] w-full rounded-lg" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function OpportunityRowSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-48" />
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className={cn("w-36 shrink-0", shimmer)}>
            <Skeleton className="aspect-[3/4] w-full rounded-lg mb-2" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TimelineSkeleton({ count = 5 }: { count?: number }) {
  return (
    <ol className="relative border-l border-border ml-3 space-y-4 py-2">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="ml-4">
          <span className="absolute -left-2 w-4 h-4 rounded-full bg-muted ring-4 ring-background" />
          <div className={cn("flex items-center gap-3 bg-card border border-border rounded-lg px-3 py-2", shimmer)}>
            <Skeleton className="w-10 h-10 rounded shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-2.5 w-1/3" />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

// GAP-SK03: List Item Skeleton
export function ListItemSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={cn("flex items-center gap-3 p-3 rounded-lg border border-border bg-card/40", shimmer)}>
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-8 w-16 rounded-lg shrink-0" />
        </div>
      ))}
    </div>
  );
}

// GAP-SK04: Detail Skeleton
export function DetailSkeleton({ withImage = true }: { withImage?: boolean }) {
  return (
    <div className="space-y-6">
      {withImage && (
        <div className="relative aspect-[21/9] w-full rounded-xl overflow-hidden bg-muted">
          <div className="absolute inset-0 flex items-center justify-center">
            <Skeleton className="h-12 w-48" />
          </div>
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-6">
        <div className="sm:w-1/3 lg:w-1/4">
          <Skeleton className="aspect-[3/4] w-full rounded-xl" />
        </div>
        <div className="flex-1 space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <Skeleton className="h-24 w-full" />
          <div className="flex gap-3">
            <Skeleton className="h-10 w-32 rounded-lg" />
            <Skeleton className="h-10 w-32 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Profile Skeleton com suporte a tamanhos
export function ProfileSkeleton({ size = 'md' }: { size?: Size }) {
  const avatarSize = size === 'sm' ? 'h-16 w-16' : size === 'lg' ? 'h-28 w-28' : 'h-20 w-20';
  return (
    <div className="space-y-6">
      <div className={cn("flex items-center gap-4", shimmer)}>
        <Skeleton className={cn(avatarSize, "rounded-full")} />
        <div className="flex-1 space-y-2">
          <Skeleton className={cn(SIZE_CLASSES[size], "w-40")} />
          <Skeleton className={cn(SIZE_CLASSES[size], "w-60")} />
          <Skeleton className={cn(SIZE_CLASSES[size], "w-32")} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
      </div>
      <GameCardGridSkeleton count={6} size={size} />
    </div>
  );
}

export function GameCardListSkeleton({ count = 6, size = 'md' }: { count?: number; size?: Size }) {
  return <GameCardGridSkeleton count={count} size={size} />;
}

// Exportações padrão
export default {
  GameCardSkeleton,
  GameCardGridSkeleton,
  FeedItemSkeleton,
  RadarSkeleton,
  OpportunityRowSkeleton,
  TimelineSkeleton,
  ListItemSkeleton,
  DetailSkeleton,
  ProfileSkeleton,
};