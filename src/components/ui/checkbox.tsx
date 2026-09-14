import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

// GAP-CK02: Tamanhos
const sizeClasses = {
  sm: "h-3 w-3",
  md: "h-4 w-4",
  lg: "h-5 w-5",
};

export interface CheckboxProps
  extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  /** GAP-CK02: Tamanho do checkbox */
  size?: "sm" | "md" | "lg";
  /** GAP-CK01: Estado indeterminado */
  indeterminate?: boolean;
}

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, size = "md", indeterminate, ...props }, ref) => {
  const [checked, setChecked] = React.useState(props.checked || false);

  // GAP-CK01: Suporte a indeterminate
  React.useEffect(() => {
    if (indeterminate) {
      // O Radix não tem indeterminate nativo, usamos ref do elemento
      const element = (ref as React.RefObject<HTMLButtonElement>).current;
      if (element) {
        const input = element.querySelector('input[type="checkbox"]');
        if (input) (input as HTMLInputElement).indeterminate = true;
      }
    }
  }, [indeterminate, ref]);

  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        "peer shrink-0 rounded-sm border border-primary ring-offset-background data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className={cn("flex items-center justify-center text-current")}>
        {indeterminate ? (
          <Minus className={cn("h-4 w-4", size === "sm" ? "h-3 w-3" : size === "lg" ? "h-5 w-5" : "h-4 w-4")} />
        ) : (
          <Check className={cn(size === "sm" ? "h-3 w-3" : size === "lg" ? "h-5 w-5" : "h-4 w-4")} />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };