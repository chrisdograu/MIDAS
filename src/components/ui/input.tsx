import * as React from "react";
import { cn } from "@/lib/utils";

// GAP-IN03: Tamanhos
const SIZE_CLASSES = {
  sm: "h-8 px-2 text-xs",
  md: "h-10 px-3 text-sm",
  lg: "h-12 px-4 text-base",
};

export interface InputProps extends Omit<React.ComponentProps<"input">, "size"> {
  /** GAP-IN01: Ícone à esquerda */
  leftIcon?: React.ReactNode;
  /** GAP-IN01: Ícone à direita */
  rightIcon?: React.ReactNode;
  /** GAP-IN02: Estado de erro */
  error?: boolean;
  /** GAP-IN03: Tamanho do input */
  size?: "sm" | "md" | "lg";
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, leftIcon, rightIcon, error, size = "md", ...props }, ref) => {
    return (
      <div className="relative w-full">
        {leftIcon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {leftIcon}
          </span>
        )}
        <input
          type={type}
          className={cn(
            "flex w-full rounded-md border bg-background ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            SIZE_CLASSES[size],
            leftIcon && "pl-9",
            rightIcon && "pr-9",
            error && "border-destructive focus-visible:ring-destructive",
            className,
          )}
          ref={ref}
          {...props}
        />
        {rightIcon && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {rightIcon}
          </span>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";

export { Input };