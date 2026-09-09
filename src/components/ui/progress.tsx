import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

// GAP-PR01: Variantes de cor
const VARIANT_CLASSES = {
  default: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
};

interface ProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  variant?: "default" | "success" | "warning" | "destructive";
  /** GAP-PR03: Mostrar label */
  showLabel?: boolean;
  /** GAP-PR02: Animar entrada */
  animateIn?: boolean;
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value, variant = "default", showLabel = false, animateIn = true, ...props }, ref) => {
  const [displayValue, setDisplayValue] = React.useState(animateIn ? 0 : value || 0);

  React.useEffect(() => {
    if (animateIn) {
      const timer = setTimeout(() => setDisplayValue(value || 0), 100);
      return () => clearTimeout(timer);
    }
    setDisplayValue(value || 0);
  }, [value, animateIn]);

  return (
    <div className="relative w-full">
      <ProgressPrimitive.Root
        ref={ref}
        className={cn("relative h-4 w-full overflow-hidden rounded-full bg-secondary", className)}
        {...props}
      >
        <ProgressPrimitive.Indicator
          className={cn(
            "h-full w-full flex-1 transition-all duration-500 ease-out",
            VARIANT_CLASSES[variant]
          )}
          style={{ transform: `translateX(-${100 - (displayValue || 0)}%)` }}
        />
      </ProgressPrimitive.Root>
      {showLabel && (
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-white">
          {Math.round(displayValue || 0)}%
        </span>
      )}
    </div>
  );
});
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };