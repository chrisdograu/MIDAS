import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

// GAP-SL03: Marcações no slider
interface Mark {
  value: number;
  label?: string;
}

interface SliderProps extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  /** GAP-SL01: Step (passo) do slider */
  step?: number;
  /** GAP-SL02: Mostrar valor atual */
  showValue?: boolean;
  /** GAP-SL02: Formatar label do valor */
  formatLabel?: (value: number) => string;
  /** GAP-SL03: Marcações no slider */
  marks?: Mark[];
  /** GAP-SL04: Orientação do slider */
  orientation?: "horizontal" | "vertical";
  /** GAP-SL02: Label do slider */
  label?: string;
}

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ 
  className, 
  step = 1,
  showValue = false,
  formatLabel,
  marks,
  orientation = "horizontal",
  label,
  value,
  defaultValue,
  onValueChange,
  ...props 
}, ref) => {
  const [currentValue, setCurrentValue] = React.useState<number[]>(
    (value || defaultValue || [0]) as number[]
  );

  // GAP-SL02: Atualizar valor
  const handleValueChange = (newValue: number[]) => {
    setCurrentValue(newValue);
    onValueChange?.(newValue);
  };

  // GAP-SL02: Formatar label
  const getLabel = (val: number) => {
    if (formatLabel) return formatLabel(val);
    if (typeof val === 'number') return val.toString();
    return String(val);
  };

  // GAP-SL03: Renderizar marcas
  const renderMarks = () => {
    if (!marks || marks.length === 0) return null;
    
    const min = props.min || 0;
    const max = props.max || 100;
    const range = max - min;
    
    return (
      <div className={cn(
        "relative w-full flex justify-between px-1",
        orientation === "vertical" && "flex-col h-full"
      )}>
        {marks.map((mark) => {
          const position = ((mark.value - min) / range) * 100;
          const isActive = currentValue && currentValue[0] >= mark.value;
          
          return (
            <div
              key={mark.value}
              className={cn(
                "flex flex-col items-center",
                orientation === "vertical" && "flex-row"
              )}
              style={{
                position: "absolute",
                [orientation === "horizontal" ? "left" : "bottom"]: `${position}%`,
                transform: orientation === "horizontal" ? "translateX(-50%)" : "translateY(50%)",
              }}
            >
              <div className={cn(
                "w-0.5 h-2 rounded-full transition-colors",
                isActive ? "bg-primary" : "bg-muted-foreground/30"
              )} />
              {mark.label && (
                <span className="text-xs text-muted-foreground mt-1 whitespace-nowrap">
                  {mark.label}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className={cn(
      "relative flex items-center gap-4",
      orientation === "vertical" && "flex-col-reverse h-48",
      className
    )}>
      {label && (
        <span className="text-sm font-medium text-foreground min-w-[60px]">
          {label}
        </span>
      )}
      
      <div className={cn(
        "relative flex-1",
        orientation === "vertical" && "h-full"
      )}>
        <SliderPrimitive.Root
          ref={ref}
          step={step}
          orientation={orientation}
          value={value || currentValue}
          defaultValue={defaultValue}
          onValueChange={handleValueChange}
          className={cn(
            "relative flex touch-none select-none items-center",
            orientation === "vertical" && "flex-col h-full"
          )}
          {...props}
        >
          <SliderPrimitive.Track
            className={cn(
              "relative grow overflow-hidden rounded-full bg-secondary",
              orientation === "horizontal" ? "h-2 w-full" : "w-2 h-full"
            )}
          >
            <SliderPrimitive.Range
              className={cn(
                "absolute bg-primary",
                orientation === "horizontal" ? "h-full" : "w-full"
              )}
            />
          </SliderPrimitive.Track>
          
          <SliderPrimitive.Thumb
            className={cn(
              "block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
              "hover:border-primary/80 hover:scale-110 transition-transform"
            )}
          />
          
          {showValue && (
            <div className={cn(
              "absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-background border text-xs font-medium whitespace-nowrap",
              "transition-opacity duration-200 opacity-0 group-hover:opacity-100",
              "data-[state=open]:opacity-100"
            )}>
              {getLabel(currentValue[0] || 0)}
            </div>
          )}
        </SliderPrimitive.Root>
        
        {/* GAP-SL03: Marcas */}
        {marks && renderMarks()}
      </div>
      
      {showValue && !label && (
        <span className="text-sm font-medium text-foreground min-w-[40px] text-right">
          {getLabel(currentValue[0] || 0)}
        </span>
      )}
    </div>
  );
});
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };