import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// GAP-TB04: Variantes de tamanho
const tableVariants = cva("w-full caption-bottom text-sm", {
  variants: {
    size: {
      default: "",
      compact: "text-xs [&_td]:py-2 [&_th]:py-2 [&_td]:px-3 [&_th]:px-3",
    },
  },
  defaultVariants: {
    size: "default",
  },
});

// GAP-TB02: Striped rows
const tableRowVariants = cva(
  "border-b transition-colors data-[state=selected]:bg-muted",
  {
    variants: {
      striped: {
        true: "even:bg-muted/30",
        false: "",
      },
      hoverable: {
        true: "hover:bg-muted/50",
        false: "",
      },
    },
    defaultVariants: {
      striped: false,
      hoverable: true,
    },
  }
);

interface TableProps extends React.HTMLAttributes<HTMLTableElement>, VariantProps<typeof tableVariants> {
  /** GAP-TB01: Header fixo ao rolar */
  stickyHeader?: boolean;
  /** GAP-TB02: Listras alternadas nas linhas */
  striped?: boolean;
  /** GAP-TB03: Efeito hover nas linhas */
  hoverable?: boolean;
  /** GAP-TB01: Altura máxima para scroll */
  maxHeight?: string | number;
}

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ 
    className, 
    size = "default",
    stickyHeader = false,
    striped = false,
    hoverable = true,
    maxHeight,
    children,
    ...props 
  }, ref) => {
    // GAP-TB01: Wrapper com scroll para sticky header
    const tableContent = (
      <table 
        ref={ref} 
        className={cn(tableVariants({ size }), className)} 
        {...props}
      >
        {children}
      </table>
    );

    if (stickyHeader || maxHeight) {
      return (
        <div 
          className={cn(
            "relative w-full overflow-auto",
            maxHeight && typeof maxHeight === 'number' && `max-h-[${maxHeight}px]`,
            maxHeight && typeof maxHeight === 'string' && `max-h-[${maxHeight}]`,
          )}
          style={maxHeight && typeof maxHeight === 'number' ? { maxHeight: `${maxHeight}px` } : undefined}
        >
          {tableContent}
        </div>
      );
    }

    return tableContent;
  }
);
Table.displayName = "Table";

interface TableHeaderProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  /** GAP-TB01: Header fixo */
  sticky?: boolean;
}

const TableHeader = React.forwardRef<HTMLTableSectionElement, TableHeaderProps>(
  ({ className, sticky = false, ...props }, ref) => (
    <thead 
      ref={ref} 
      className={cn(
        "[&_tr]:border-b",
        sticky && "sticky top-0 z-10 bg-background",
        className
      )} 
      {...props} 
    />
  )
);
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
  )
);
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tfoot 
      ref={ref} 
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )} 
      {...props} 
    />
  )
);
TableFooter.displayName = "TableFooter";

// GAP-TB02: Striped e GAP-TB03: Hover
interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  striped?: boolean;
  hoverable?: boolean;
}

const TableRow = React.forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ className, striped = false, hoverable = true, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        tableRowVariants({ striped, hoverable }),
        className
      )}
      {...props}
    />
  )
);
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        "h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  )
);
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td ref={ref} className={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", className)} {...props} />
  )
);
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, ...props }, ref) => (
    <caption ref={ref} className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />
  )
);
TableCaption.displayName = "TableCaption";

export { 
  Table, 
  TableHeader, 
  TableBody, 
  TableFooter, 
  TableHead, 
  TableRow, 
  TableCell, 
  TableCaption,
  tableVariants,
  tableRowVariants,
};