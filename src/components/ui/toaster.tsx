import { useToast } from "@/hooks/use-toast";
import { 
  Toast, 
  ToastClose, 
  ToastDescription, 
  ToastProvider, 
  ToastTitle, 
  ToastViewport,
  type ToastPosition,
  type ToastVariant,
} from "@/components/ui/toast";

interface ToasterProps {
  /** GAP-TO01: Posição dos toasts */
  position?: ToastPosition;
  /** GAP-TO02: Duração padrão em ms */
  duration?: number;
}

export function Toaster({ position = "bottom-right", duration = 4000 }: ToasterProps) {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, icon, duration: toastDuration, ...props }) {
        return (
          <Toast 
            key={id} 
            variant={variant as ToastVariant} 
            icon={icon}
            duration={toastDuration || duration}
            {...props}
          >
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport position={position} />
    </ToastProvider>
  );
}