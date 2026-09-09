import * as React from "react";
import * as SeparatorPrimitive from "@radix-ui/react-separator";

import { cn } from "@/lib/utils";

// GAP-SE01: Cor customizada, GAP-SE02: Espaçamento
interface SeparatorProps extends React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root> {
  color?: string;
  spacing?: string | number;
}

const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  SeparatorProps
>(({ 
  className, 
  orientation = "horizontal", 
  decorative = true, 
  color,
  spacing,
  style,
  ...props 
}, ref) => {
  const spacingStyle = spacing ? {
    margin: orientation === "horizontal" 
      ? `${typeof spacing === 'number' ? spacing : spacing} 0` 
      : `0 ${typeof spacing === 'number' ? spacing : spacing}`
  } : {};

  return (
    <SeparatorPrimitive.Root
      ref={ref}
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "shrink-0",
        orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
        className,
      )}
      style={{
        ...style,
        ...spacingStyle,
        ...(color ? { backgroundColor: color } : {}),
      }}
      {...props}
    />
  );
});
Separator.displayName = SeparatorPrimitive.Root.displayName;

export { Separator };