import { Star, StarHalf } from 'lucide-react';
import { forwardRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface HalfStarRatingProps {
  rating: number;
  size?: number;
  className?: string;
  /** GAP-HS01: Cor das estrelas preenchidas */
  filledColor?: string;
  /** GAP-HS01: Cor das estrelas vazias */
  emptyColor?: string;
}

export const HalfStarDisplay = forwardRef<HTMLDivElement, HalfStarRatingProps>(function HalfStarDisplay({ 
  rating, 
  size = 16, 
  className = '',
  filledColor = 'text-price fill-price',
  emptyColor = 'text-muted-foreground'
}, ref) {
  return (
    <div
      ref={ref}
      role="img"
      aria-label={`Avaliação: ${rating.toFixed(1)} de 5`}
      className={cn("flex items-center gap-0.5", className)}
    >
      {Array.from({ length: 5 }).map((_, i) => {
        const starValue = i + 1;
        if (rating >= starValue) {
          return <Star key={i} className={filledColor} style={{ width: size, height: size }} />;
        }
        if (rating >= starValue - 0.5) {
          return (
            <div key={i} className="relative" style={{ width: size, height: size }}>
              <Star className={emptyColor} style={{ width: size, height: size }} />
              <StarHalf className={cn("absolute inset-0", filledColor)} style={{ width: size, height: size }} />
            </div>
          );
        }
        return <Star key={i} className={emptyColor} style={{ width: size, height: size }} />;
      })}
    </div>
  );
});

interface InteractiveHalfStarProps {
  value: number;
  onChange: (rating: number) => void;
  size?: number;
  /** GAP-HS04: Desabilitar interação */
  disabled?: boolean;
  /** GAP-HS01: Cor das estrelas preenchidas */
  filledColor?: string;
  /** GAP-HS01: Cor das estrelas vazias */
  emptyColor?: string;
  /** GAP-HS03: Callback quando hover */
  onHover?: (rating: number | null) => void;
}

export function InteractiveHalfStar({ 
  value, 
  onChange, 
  size = 28,
  disabled = false,
  filledColor = 'text-price fill-price',
  emptyColor = 'text-muted-foreground',
  onHover,
}: InteractiveHalfStarProps) {
  // GAP-HS03: Estado de hover
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  
  const displayValue = hoverValue !== null ? hoverValue : value;

  const handleHover = (val: number | null) => {
    if (disabled) return;
    setHoverValue(val);
    onHover?.(val);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      onChange(Math.min(5, value + 0.5));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      onChange(Math.max(0.5, value - 0.5));
    } else if (e.key === 'Home') {
      e.preventDefault();
      onChange(0.5);
    } else if (e.key === 'End') {
      e.preventDefault();
      onChange(5);
    }
  };

  return (
    <div
      role="slider"
      aria-label="Avaliação"
      aria-valuemin={0.5}
      aria-valuemax={5}
      aria-valuenow={value}
      aria-valuetext={`${value} de 5`}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={handleKeyDown}
      className={cn(
        "flex items-center gap-0.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        disabled ? "opacity-50 cursor-not-allowed" : ""
      )}
    >
      {Array.from({ length: 5 }).map((_, i) => {
        const starValue = i + 1;
        const halfValue = starValue - 0.5;
        const isFilled = displayValue >= starValue;
        const isHalf = displayValue >= halfValue && displayValue < starValue;
        
        return (
          <div 
            key={i} 
            className={cn(
              "relative",
              !disabled && "cursor-pointer"
            )}
            style={{ width: size, height: size }}
          >
            {/* GAP-HS03: Left half - clicks 0.5 */}
            <div
              className="absolute inset-0 w-1/2 z-10"
              onClick={() => !disabled && onChange(halfValue)}
              onMouseEnter={() => handleHover(halfValue)}
              onMouseLeave={() => handleHover(null)}
            />
            {/* GAP-HS03: Right half - clicks 1.0 */}
            <div
              className="absolute inset-0 left-1/2 w-1/2 z-10"
              onClick={() => !disabled && onChange(starValue)}
              onMouseEnter={() => handleHover(starValue)}
              onMouseLeave={() => handleHover(null)}
            />
            
            {isFilled ? (
              <Star 
                className={cn(
                  filledColor,
                  !disabled && "transition-transform hover:scale-110 motion-reduce:transition-none motion-reduce:hover:scale-100"
                )} 
                style={{ width: size, height: size }} 
              />
            ) : isHalf ? (
              <div className="relative" style={{ width: size, height: size }}>
                <Star className={emptyColor} style={{ width: size, height: size }} />
                <StarHalf className={cn("absolute inset-0", filledColor)} style={{ width: size, height: size }} />
              </div>
            ) : (
              <Star 
                className={cn(
                  emptyColor,
                  !disabled && "transition-transform hover:scale-110 motion-reduce:transition-none motion-reduce:hover:scale-100"
                )} 
                style={{ width: size, height: size }} 
              />
            )}
          </div>
        );
      })}
    </div>
  );
}