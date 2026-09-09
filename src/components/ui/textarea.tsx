import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertCircle } from "lucide-react";

import { cn } from "@/lib/utils";

// GAP-TE04: Variantes de tamanho
const textareaVariants = cva(
  "flex w-full rounded-md border bg-background px-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      size: {
        sm: "min-h-[60px] py-1.5 text-xs",
        md: "min-h-[80px] py-2 text-sm",
        lg: "min-h-[120px] py-3 text-base",
      },
      variant: {
        default: "border-input",
        // GAP-TE03: Estado de erro
        error: "border-destructive focus-visible:ring-destructive",
      },
    },
    defaultVariants: {
      size: "md",
      variant: "default",
    },
  }
);

export interface TextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "size">,
    VariantProps<typeof textareaVariants> {
  /** GAP-TE03: Estado de erro */
  error?: boolean;
  /** GAP-TE03: Mensagem de erro */
  errorMessage?: string;
  /** GAP-TE02: Mostrar contador de caracteres */
  showCount?: boolean;
  /** GAP-TE01: Auto-resize baseado no conteúdo */
  autoResize?: boolean;
  /** GAP-TE01: Altura mínima para auto-resize */
  minRows?: number;
  /** GAP-TE01: Altura máxima para auto-resize */
  maxRows?: number;
  /** GAP-TE02: Label do campo */
  label?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ 
    className, 
    size = "md",
    variant = "default",
    error = false,
    errorMessage,
    showCount = false,
    autoResize = false,
    minRows = 2,
    maxRows = 10,
    label,
    maxLength,
    value,
    defaultValue,
    onChange,
    ...props 
  }, ref) => {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);
    const [currentValue, setCurrentValue] = React.useState<string>(
      (value || defaultValue || "") as string
    );
    const [rows, setRows] = React.useState(minRows);

    // GAP-TE01: Auto-resize
    const handleResize = React.useCallback(() => {
      if (!autoResize || !textareaRef.current) return;
      
      const textarea = textareaRef.current;
      const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 20;
      const padding = parseFloat(getComputedStyle(textarea).paddingTop) + 
                      parseFloat(getComputedStyle(textarea).paddingBottom);
      
      // Reset height to calculate proper scroll height
      textarea.style.height = "auto";
      
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = maxRows * lineHeight + padding;
      const minHeight = minRows * lineHeight + padding;
      
      const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
      textarea.style.height = `${newHeight}px`;
      
      const newRows = Math.round((newHeight - padding) / lineHeight);
      setRows(Math.min(Math.max(newRows, minRows), maxRows));
    }, [autoResize, minRows, maxRows]);

    // GAP-TE01: Auto-resize no mount e changes
    React.useEffect(() => {
      if (autoResize) {
        handleResize();
      }
    }, [autoResize, handleResize, currentValue]);

    // GAP-TE01: Observar mudanças de tamanho da fonte
    React.useEffect(() => {
      if (!autoResize) return;
      
      const resizeObserver = new ResizeObserver(() => handleResize());
      if (textareaRef.current) {
        resizeObserver.observe(textareaRef.current);
      }
      
      return () => resizeObserver.disconnect();
    }, [autoResize, handleResize]);

    // Handler com auto-resize
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      setCurrentValue(newValue);
      
      if (autoResize) {
        handleResize();
      }
      
      onChange?.(e);
    };

    // GAP-TE02: Contador de caracteres
    const charCount = currentValue?.length || 0;
    const isOverLimit = maxLength && charCount > maxLength;
    const displayVariant = error || isOverLimit ? "error" : variant;

    // Combinar refs
    const setRefs = React.useCallback(
      (element: HTMLTextAreaElement | null) => {
        textareaRef.current = element;
        if (typeof ref === "function") {
          ref(element);
        } else if (ref) {
          (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = element;
        }
      },
      [ref]
    );

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label className="text-sm font-medium">
            {label}
            {maxLength && showCount && (
              <span className="ml-2 text-xs text-muted-foreground">
                ({charCount}/{maxLength})
              </span>
            )}
          </label>
        )}
        
        <textarea
          className={cn(
            textareaVariants({ size, variant: displayVariant }),
            autoResize && "overflow-hidden resize-none",
            className,
          )}
          ref={setRefs}
          maxLength={maxLength}
          value={value ?? currentValue}
          defaultValue={defaultValue}
          onChange={handleChange}
          rows={autoResize ? rows : undefined}
          {...props}
        />
        
        {/* GAP-TE02: Contador de caracteres abaixo */}
        {showCount && maxLength && !label && (
          <div className="flex justify-end">
            <span className={cn(
              "text-xs",
              isOverLimit ? "text-destructive" : "text-muted-foreground"
            )}>
              {charCount}/{maxLength}
            </span>
          </div>
        )}
        
        {/* GAP-TE03: Mensagem de erro */}
        {(error || isOverLimit) && errorMessage && (
          <div className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea, textareaVariants };