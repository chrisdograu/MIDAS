import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

// GAP-SO01: Posições customizáveis
type ToastPosition = 
  | "top-left"
  | "top-center" 
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

// GAP-SO02: Duração por tipo
interface ToastOptions {
  duration?: number;
  position?: ToastPosition;
  className?: string;
  icon?: React.ReactNode;
}

// GAP-SO03: Variantes de cor
type ToastVariant = "default" | "success" | "error" | "warning" | "info";

interface ExtendedToastOptions extends ToastOptions {
  variant?: ToastVariant;
}

const Toaster = ({ 
  position = "bottom-right",
  richColors = true,
  closeButton = true,
  ...props 
}: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position={position}
      richColors={richColors}
      closeButton={closeButton}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          // GAP-SO03: Variantes de cor
          success: "group-[.toast]:border-green-500/30 group-[.toast]:bg-green-500/10",
          error: "group-[.toast]:border-red-500/30 group-[.toast]:bg-red-500/10",
          warning: "group-[.toast]:border-yellow-500/30 group-[.toast]:bg-yellow-500/10",
          info: "group-[.toast]:border-blue-500/30 group-[.toast]:bg-blue-500/10",
        },
        duration: 4000,
      }}
      {...props}
    />
  );
};

// GAP-SO02: Duração por tipo com variantes
const showToast = (
  message: string, 
  options: ExtendedToastOptions = {}
) => {
  const { variant = "default", duration, ...rest } = options;
  
  // Durações padrão por tipo
  const durations = {
    default: 4000,
    success: 3000,
    error: 6000,
    warning: 5000,
    info: 4000,
  };

  const toastFn = {
    success: toast.success,
    error: toast.error,
    warning: toast.warning,
    info: toast.info,
    default: toast,
  }[variant];

  return toastFn(message, {
    duration: duration || durations[variant],
    ...rest,
  });
};

// GAP-SO03: Toast com ícone e cor
const showToastWithVariant = (
  message: string,
  variant: ToastVariant = "default",
  options: ToastOptions = {}
) => {
  const iconMap = {
    success: "✅",
    error: "❌",
    warning: "⚠️",
    info: "ℹ️",
    default: "📌",
  };

  return showToast(message, {
    variant,
    icon: options.icon || iconMap[variant],
    ...options,
  });
};

// Conveniência
const toastWithVariant = {
  success: (message: string, options?: ToastOptions) => 
    showToastWithVariant(message, "success", options),
  error: (message: string, options?: ToastOptions) => 
    showToastWithVariant(message, "error", options),
  warning: (message: string, options?: ToastOptions) => 
    showToastWithVariant(message, "warning", options),
  info: (message: string, options?: ToastOptions) => 
    showToastWithVariant(message, "info", options),
};

export { 
  Toaster, 
  toast, 
  showToast, 
  showToastWithVariant,
  toastWithVariant 
};
export type { ToastPosition, ToastVariant, ToastOptions, ExtendedToastOptions };