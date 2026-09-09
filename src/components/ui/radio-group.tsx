import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { Circle } from "lucide-react";

import { cn } from "@/lib/utils";

// GAP-RG01: Tamanhos
const SIZE_CLASSES = {
  sm: "h-3 w-3 [&>svg]:h-2 [&>svg]:w-2",
  md: "h-4 w-4 [&>svg]:h-2.5 [&>svg]:w-2.5",
  lg: "h-5 w-5 [&>svg]:h-3 [&>svg]:w-3",
};

interface RadioGroupProps extends React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root> {
  size?: "sm" | "md" | "lg";
  /** GAP-RG02: Estado de erro */
  error?: boolean;
}

const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  RadioGroupProps
>(({ className, size = "md", error, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Root 
      className={cn("grid gap-2", className)} 
      {...props} 
      ref={ref} 
    />
  );
});
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName;

interface RadioGroupItemProps extends React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item> {
  size?: "sm" | "md" | "lg";
  error?: boolean;
}

const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  RadioGroupItemProps
>(({ className, size = "md", error, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        "aspect-square rounded-full border text-primary ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        SIZE_CLASSES[size],
        error && "border-destructive focus-visible:ring-destructive",
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
        <Circle className="fill-current text-current" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
});
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName;

export { RadioGroup, RadioGroupItem };