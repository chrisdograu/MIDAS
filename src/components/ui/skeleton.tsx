import * as React from "react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

// GAP-SK01: Variantes de tamanho
const skeletonVariants = cva("animate-pulse rounded-md bg-muted", {
  variants: {
    size: {
      sm: "h-8 w-16",
      md: "h-12 w-24",
      lg: "h-16 w-32",
      xl: "h-20 w-40",
    },
    variant: {
      default: "bg-muted",
      shimmer: "bg-gradient-to-r from-muted via-muted/50 to-muted bg-[length:200%_100%] animate-shimmer",
    },
  },
  defaultVariants: {
    size: "md",
    variant: "default",
  },
});

// GAP-SK02: Shimmer animation via Tailwind config
// Adicionar no tailwind.config.js:
// animation: { shimmer: "shimmer 2s ease-in-out infinite" },
// keyframes: { shimmer: { "0%": { backgroundPosition: "200% 0" }, "100%": { backgroundPosition: "-200% 0" } } }

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof skeletonVariants> {
  /** GAP-SK02: Habilita efeito shimmer */
  shimmer?: boolean;
}

const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, size, variant = "default", shimmer = false, ...props }, ref) => {
    const finalVariant = shimmer ? "shimmer" : variant;
    return (
      <div
        ref={ref}
        className={cn(skeletonVariants({ size, variant: finalVariant }), className)}
        {...props}
      />
    );
  }
);
Skeleton.displayName = "Skeleton";

// GAP-SK03: Skeleton para listas
interface ListItemSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Número de itens na lista */
  count?: number;
  /** Mostrar avatar/ícone */
  showAvatar?: boolean;
  /** Mostrar subtítulo */
  showSubtitle?: boolean;
}

const ListItemSkeleton = React.forwardRef<HTMLDivElement, ListItemSkeletonProps>(
  ({ className, count = 5, showAvatar = true, showSubtitle = true, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("space-y-3", className)} {...props}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            {showAvatar && <Skeleton size="sm" className="rounded-full" />}
            <div className="flex-1 space-y-2">
              <Skeleton size="sm" className="w-3/4" />
              {showSubtitle && <Skeleton size="sm" className="w-1/2" />}
            </div>
          </div>
        ))}
      </div>
    );
  }
);
ListItemSkeleton.displayName = "ListItemSkeleton";

// GAP-SK03: Skeleton para grid
interface GridSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  columns?: 2 | 3 | 4;
  count?: number;
  aspectRatio?: string;
}

const GridSkeleton = React.forwardRef<HTMLDivElement, GridSkeletonProps>(
  ({ className, columns = 3, count = 6, aspectRatio = "aspect-square", ...props }, ref) => {
    const gridCols = {
      2: "grid-cols-2",
      3: "grid-cols-3",
      4: "grid-cols-4",
    };

    return (
      <div
        ref={ref}
        className={cn(`grid ${gridCols[columns]} gap-4`, className)}
        {...props}
      >
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className={cn("space-y-2", aspectRatio)}>
            <Skeleton className="w-full h-full" />
            <Skeleton size="sm" className="w-3/4" />
            <Skeleton size="sm" className="w-1/2" />
          </div>
        ))}
      </div>
    );
  }
);
GridSkeleton.displayName = "GridSkeleton";

// GAP-SK04: Skeleton para detalhes
interface DetailSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Mostrar banner/hero */
  showHero?: boolean;
  /** Mostrar ações (botões) */
  showActions?: boolean;
  /** Número de seções de conteúdo */
  sections?: number;
}

const DetailSkeleton = React.forwardRef<HTMLDivElement, DetailSkeletonProps>(
  ({ className, showHero = true, showActions = true, sections = 3, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("space-y-6", className)} {...props}>
        {showHero && (
          <div className="space-y-4">
            <Skeleton className="w-full aspect-[16/9] rounded-xl" />
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <Skeleton size="lg" className="w-3/4" />
                <Skeleton size="sm" className="w-1/2" />
              </div>
              {showActions && (
                <div className="flex gap-2">
                  <Skeleton size="lg" className="w-24" />
                  <Skeleton size="lg" className="w-24" />
                </div>
              )}
            </div>
          </div>
        )}
        
        <div className="space-y-2">
          <Skeleton size="sm" className="w-32" />
          <Skeleton className="w-full h-20" />
        </div>

        {Array.from({ length: sections }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton size="sm" className="w-48" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="w-full h-24" />
              <Skeleton className="w-full h-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }
);
DetailSkeleton.displayName = "DetailSkeleton";

export { 
  Skeleton, 
  ListItemSkeleton, 
  GridSkeleton, 
  DetailSkeleton,
  skeletonVariants 
};