import * as React from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";

import { cn } from "@/lib/utils";

// GAP-SA01: Scroll suave, GAP-SA02: Indicador de scroll
interface ScrollAreaProps extends React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> {
  smoothScroll?: boolean;
  showScrollIndicator?: boolean;
  /** GAP-SA03: Callback quando chegar ao final */
  onScrollEnd?: () => void;
}

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  ScrollAreaProps
>(({ 
  className, 
  children, 
  smoothScroll = true, 
  showScrollIndicator = false,
  onScrollEnd,
  ...props 
}, ref) => {
  const viewportRef = React.useRef<HTMLDivElement>(null);

  // GAP-SA03: Detectar scroll infinito
  const handleScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (!onScrollEnd) return;
    const target = e.currentTarget;
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 50;
    if (isAtBottom) {
      onScrollEnd();
    }
  }, [onScrollEnd]);

  return (
    <ScrollAreaPrimitive.Root 
      ref={ref} 
      className={cn("relative overflow-hidden", className)} 
      {...props}
    >
      <ScrollAreaPrimitive.Viewport 
        ref={viewportRef}
        className={cn(
          "h-full w-full rounded-[inherit]",
          smoothScroll && "scroll-smooth"
        )}
        onScroll={handleScroll}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      
      {/* GAP-SA02: Indicador de scroll */}
      {showScrollIndicator && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10">
          <div className="h-1 w-12 rounded-full bg-muted-foreground/20 animate-pulse" />
        </div>
      )}
      
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
});
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      "flex touch-none select-none transition-colors",
      orientation === "vertical" && "h-full w-2.5 border-l border-l-transparent p-[1px]",
      orientation === "horizontal" && "h-2.5 flex-col border-t border-t-transparent p-[1px]",
      className,
    )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
));
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName;

export { ScrollArea, ScrollBar };