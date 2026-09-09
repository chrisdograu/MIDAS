import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const tooltipContentVariants = cva(
  "z-50 overflow-hidden rounded-md border px-3 py-1.5 text-sm shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
  {
    variants: {
      variant: {
        default: "bg-popover text-popover-foreground",
        dark: "bg-foreground text-background",
        primary: "bg-primary text-primary-foreground",
        destructive: "bg-destructive text-destructive-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

// GAP-TP01: Tooltip com delay customizado
interface TooltipProviderProps extends React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Provider> {
  /** GAP-TP01: Delay para abrir em ms */
  delayDuration?: number;
  /** GAP-TP01: Delay para pular em ms */
  skipDelayDuration?: number;
}

const TooltipProvider = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Provider>,
  TooltipProviderProps
>(({ delayDuration = 700, skipDelayDuration = 300, ...props }, ref) => (
  <TooltipPrimitive.Provider 
    ref={ref}
    delayDuration={delayDuration}
    skipDelayDuration={skipDelayDuration}
    {...props} 
  />
));
TooltipProvider.displayName = TooltipPrimitive.Provider.displayName;

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

// GAP-TP04: Tooltip com rich content e cores customizadas
interface TooltipContentProps
  extends React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>,
    VariantProps<typeof tooltipContentVariants> {
  /** GAP-TP03: Cor de fundo customizada */
  color?: string;
  /** GAP-TP03: Cor do texto customizada */
  textColor?: string;
  /** GAP-TP04: Conteúdo rico (ReactNode) */
  children?: React.ReactNode;
  /** GAP-TP02: Lado do tooltip */
  side?: "top" | "right" | "bottom" | "left";
  /** GAP-TP02: Alinhamento do tooltip */
  align?: "start" | "center" | "end";
}

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  TooltipContentProps
>(({ 
  className, 
  sideOffset = 4,
  side = "top",
  align = "center",
  variant = "default",
  color,
  textColor,
  children,
  ...props 
}, ref) => {
  // GAP-TP03: Cores customizadas
  const customStyles: React.CSSProperties = {};
  if (color) customStyles.backgroundColor = color;
  if (textColor) customStyles.color = textColor;

  return (
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      side={side}
      align={align}
      className={cn(
        tooltipContentVariants({ variant }),
        className,
      )}
      style={customStyles}
      {...props}
    >
      <div className="max-w-sm">
        {children}
      </div>
    </TooltipPrimitive.Content>
  );
});
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { 
  Tooltip, 
  TooltipTrigger, 
  TooltipContent, 
  TooltipProvider,
  tooltipContentVariants,
};