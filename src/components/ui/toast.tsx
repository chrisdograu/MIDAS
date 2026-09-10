import * as React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast";
import { cva, type VariantProps } from "class-variance-authority";
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react";

import { cn } from "@/lib/utils";

const ToastProvider = ToastPrimitives.Provider;

// GAP-TO01: Posições do toast
type ToastPosition = 
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

// GAP-TO04: Variantes de cor
type ToastVariant = "default" | "destructive" | "success" | "error" | "warning" | "info";

// Mapeamento de ícones por variante
const variantIcons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  default: null,
};

// Mapeamento de cores por variante
const variantColors = {
  success: "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300",
  error: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
  warning: "border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300",
  info: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  default: "border bg-background text-foreground",
};

// GAP-TO03: Toast com ícone
interface ToastIconProps {
  variant?: ToastVariant;
  icon?: React.ReactNode;
}

const ToastIcon = ({ variant = "default", icon }: ToastIconProps) => {
  if (icon) {
    return <span className="shrink-0">{icon}</span>;
  }
  
  const IconComponent = variantIcons[variant];
  if (!IconComponent) return null;
  
  const iconColors = {
    success: "text-green-500",
    error: "text-red-500",
    warning: "text-yellow-500",
    info: "text-blue-500",
    default: "text-foreground",
  };

  return (
    <IconComponent 
      className={cn("h-5 w-5 shrink-0", iconColors[variant])} 
    />
  );
};

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center gap-3 overflow-hidden rounded-md border p-4 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full",
  {
    variants: {
      variant: {
        default: variantColors.default,
        success: variantColors.success,
        error: variantColors.error,
        warning: variantColors.warning,
        info: variantColors.info,
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface ToastProps
  extends React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root>,
    VariantProps<typeof toastVariants> {
  /** GAP-TO03: Ícone do toast */
  icon?: React.ReactNode;
  /** GAP-TO02: Duração em ms */
  duration?: number;
  /** GAP-TO04: Variante de cor */
  variant?: ToastVariant;
}

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  ToastProps
>(({ className, variant = "default", icon, children, ...props }, ref) => {
  return (
    <ToastPrimitives.Root 
      ref={ref} 
      className={cn(toastVariants({ variant }), className)} 
      {...props}
    >
      <div className="flex items-start gap-3 w-full">
        <ToastIcon variant={variant} icon={icon} />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </ToastPrimitives.Root>
  );
});
Toast.displayName = ToastPrimitives.Root.displayName;

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors group-[.destructive]:border-muted/40 hover:bg-secondary group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 group-[.destructive]:focus:ring-destructive disabled:pointer-events-none disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
ToastAction.displayName = ToastPrimitives.Action.displayName;

type ToastActionElement = React.ReactElement<typeof ToastAction>;

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity group-hover:opacity-100 group-[.destructive]:text-red-300 hover:text-foreground group-[.destructive]:hover:text-red-50 focus:opacity-100 focus:outline-none focus:ring-2 group-[.destructive]:focus:ring-red-400 group-[.destructive]:focus:ring-offset-red-600",
      className,
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
));
ToastClose.displayName = ToastPrimitives.Close.displayName;

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title ref={ref} className={cn("text-sm font-semibold", className)} {...props} />
));
ToastTitle.displayName = ToastPrimitives.Title.displayName;

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description ref={ref} className={cn("text-sm opacity-90", className)} {...props} />
));
ToastDescription.displayName = ToastPrimitives.Description.displayName;

// GAP-TO01: ToastViewport com posição customizada
interface ToastViewportProps extends React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport> {
  position?: ToastPosition;
}

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  ToastViewportProps
>(({ className, position = "bottom-right", ...props }, ref) => {
  const positionClasses = {
    "top-left": "top-0 left-0",
    "top-center": "top-0 left-1/2 -translate-x-1/2",
    "top-right": "top-0 right-0",
    "bottom-left": "bottom-0 left-0",
    "bottom-center": "bottom-0 left-1/2 -translate-x-1/2",
    "bottom-right": "bottom-0 right-0",
  };

  return (
    <ToastPrimitives.Viewport
      ref={ref}
      className={cn(
        "fixed z-[100] flex max-h-screen w-full flex-col p-4 gap-2",
        positionClasses[position],
        position === "bottom-center" || position === "top-center"
          ? "items-center"
          : position === "bottom-left" || position === "top-left"
          ? "items-start"
          : "items-end",
        className,
      )}
      {...props}
    />
  );
});
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

export {
  type ToastProps,
  type ToastActionElement,
  type ToastPosition,
  type ToastVariant,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
  ToastIcon,
  variantIcons,
  variantColors,
};