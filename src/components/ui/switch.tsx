import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";
import { Loader2 } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// GAP-SW01: Variantes de tamanho
const switchVariants = cva(
  "peer shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
  {
    variants: {
      size: {
        sm: "h-5 w-9",
        md: "h-6 w-11",
        lg: "h-7 w-12",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

const thumbVariants = cva(
  "pointer-events-none block rounded-full bg-background shadow-lg ring-0 transition-transform",
  {
    variants: {
      size: {
        sm: "h-4 w-4 data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0",
        md: "h-5 w-5 data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
        lg: "h-6 w-6 data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

interface SwitchProps
  extends React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>,
    VariantProps<typeof switchVariants> {
  /** GAP-SW02: Label acessível para o switch */
  label?: string;
  /** GAP-SW03: Estado de loading */
  loading?: boolean;
  /** GAP-SW04: Cor personalizada para estado checked */
  checkedColor?: string;
  /** GAP-SW04: Cor personalizada para estado unchecked */
  uncheckedColor?: string;
  /** GAP-SW02: Posição da label */
  labelPosition?: "left" | "right";
}

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  SwitchProps
>(({ 
  className, 
  size = "md",
  label,
  loading = false,
  checkedColor,
  uncheckedColor,
  labelPosition = "right",
  disabled,
  ...props 
}, ref) => {
  const isDisabled = disabled || loading;

  // GAP-SW04: Cores customizadas
  const customStyles = {
    ...(checkedColor && { 
      "--switch-checked": checkedColor,
      "data-[state=checked]:bg": checkedColor 
    } as React.CSSProperties),
    ...(uncheckedColor && { 
      "--switch-unchecked": uncheckedColor,
      "data-[state=unchecked]:bg": uncheckedColor 
    } as React.CSSProperties),
  };

  const switchElement = (
    <SwitchPrimitives.Root
      className={cn(
        switchVariants({ size }),
        checkedColor && "data-[state=checked]:bg-[var(--switch-checked)]",
        uncheckedColor && "data-[state=unchecked]:bg-[var(--switch-unchecked)]",
        className,
      )}
      disabled={isDisabled}
      style={customStyles}
      {...props}
      ref={ref}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          thumbVariants({ size }),
          loading && "opacity-0"
        )}
      />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className={cn(
            "animate-spin text-background",
            size === "sm" ? "h-3 w-3" : "h-4 w-4"
          )} />
        </div>
      )}
    </SwitchPrimitives.Root>
  );

  // GAP-SW02: Label acessível
  if (label) {
    return (
      <div className="flex items-center gap-3">
        {labelPosition === "left" && (
          <label className="text-sm font-medium cursor-pointer select-none">
            {label}
          </label>
        )}
        {switchElement}
        {labelPosition === "right" && (
          <label className="text-sm font-medium cursor-pointer select-none">
            {label}
          </label>
        )}
      </div>
    );
  }

  return switchElement;
});
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch, switchVariants, thumbVariants };