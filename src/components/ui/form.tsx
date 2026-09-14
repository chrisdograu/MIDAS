import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { Slot } from "@radix-ui/react-slot";
import { 
  Controller, 
  ControllerProps, 
  FieldPath, 
  FieldValues, 
  FormProvider, 
  useFormContext,
  useFieldArray as useRHFFieldArray,
} from "react-hook-form";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

const Form = FormProvider;

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
  name: TName;
};

const FormFieldContext = React.createContext<FormFieldContextValue>({} as FormFieldContextValue);

const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  ...props
}: ControllerProps<TFieldValues, TName>) => {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
};

// GAP-FO03: FieldArray support
const useFieldArray = useRHFFieldArray;

const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext);
  const itemContext = React.useContext(FormItemContext);
  const { getFieldState, formState } = useFormContext();

  if (!fieldContext) {
    throw new Error("useFormField should be used within <FormField>");
  }

  const fieldState = getFieldState(fieldContext.name, formState);
  const { id } = itemContext || { id: React.useId() };

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  };
};

type FormItemContextValue = {
  id: string;
};

const FormItemContext = React.createContext<FormItemContextValue>({} as FormItemContextValue);

const FormItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const id = React.useId();
    return (
      <FormItemContext.Provider value={{ id }}>
        <div ref={ref} className={cn("space-y-2", className)} {...props} />
      </FormItemContext.Provider>
    );
  },
);
FormItem.displayName = "FormItem";

// GAP-FO02: Input com máscara
interface FormControlProps extends React.ComponentPropsWithoutRef<typeof Slot> {
  mask?: (value: string) => string;
  onMaskedChange?: (value: string) => void;
}

const FormControl = React.forwardRef<React.ElementRef<typeof Slot>, FormControlProps>(
  ({ mask, onMaskedChange, onChange, ...props }, ref) => {
    const { error, formItemId, formDescriptionId, formMessageId } = useFormField();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let value = e.target.value;
      if (mask) {
        value = mask(value);
        e.target.value = value;
      }
      if (onMaskedChange) onMaskedChange(value);
      if (onChange) onChange(e);
    };

    return (
      <Slot
        ref={ref}
        id={formItemId}
        aria-describedby={!error ? `${formDescriptionId}` : `${formDescriptionId} ${formMessageId}`}
        aria-invalid={!!error}
        onChange={handleChange}
        {...props}
      />
    );
  },
);
FormControl.displayName = "FormControl";

const FormLabel = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => {
  const { error, formItemId } = useFormField();
  return <Label ref={ref} className={cn(error && "text-destructive", className)} htmlFor={formItemId} {...props} />;
});
FormLabel.displayName = "FormLabel";

const FormDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => {
    const { formDescriptionId } = useFormField();
    return <p ref={ref} id={formDescriptionId} className={cn("text-sm text-muted-foreground", className)} {...props} />;
  },
);
FormDescription.displayName = "FormDescription";

// GAP-FO01: Validação assíncrona
interface FormMessageProps extends React.HTMLAttributes<HTMLParagraphElement> {
  asyncValidation?: Promise<string | null>;
}

const FormMessage = React.forwardRef<HTMLParagraphElement, FormMessageProps>(
  ({ className, children, asyncValidation, ...props }, ref) => {
    const { error, formMessageId } = useFormField();
    const [asyncError, setAsyncError] = React.useState<string | null>(null);

    React.useEffect(() => {
      if (!asyncValidation) return;
      let mounted = true;
      asyncValidation.then((result) => {
        if (mounted) setAsyncError(result);
      });
      return () => { mounted = false; };
    }, [asyncValidation]);

    const body = asyncError || (error ? String(error?.message) : children);

    if (!body) return null;

    return (
      <p ref={ref} id={formMessageId} className={cn("text-sm font-medium text-destructive", className)} {...props}>
        {body}
      </p>
    );
  },
);
FormMessage.displayName = "FormMessage";

export { 
  useFormField, 
  Form, 
  FormItem, 
  FormLabel, 
  FormControl, 
  FormDescription, 
  FormMessage, 
  FormField,
  useFieldArray,
};