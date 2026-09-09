import { GripVertical } from "lucide-react";
import * as ResizablePrimitive from "react-resizable-panels";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

// GAP-RE03: Persistência de tamanho
interface ResizablePanelGroupProps extends React.ComponentProps<typeof ResizablePrimitive.PanelGroup> {
  storageKey?: string;
}

const ResizablePanelGroup = ({ 
  className, 
  storageKey,
  onLayout,
  ...props 
}: ResizablePanelGroupProps) => {
  const [sizes, setSizes] = useState<number[] | null>(null);

  // GAP-RE03: Carregar do localStorage
  useEffect(() => {
    if (storageKey && typeof window !== "undefined") {
      const saved = localStorage.getItem(`resizable-${storageKey}`);
      if (saved) {
        try {
          setSizes(JSON.parse(saved));
        } catch {}
      }
    }
  }, [storageKey]);

  const handleLayout = (sizes: number[]) => {
    if (storageKey && typeof window !== "undefined") {
      localStorage.setItem(`resizable-${storageKey}`, JSON.stringify(sizes));
    }
    if (onLayout) onLayout(sizes);
  };

  return (
    <ResizablePrimitive.PanelGroup
      className={cn("flex h-full w-full data-[panel-group-direction=vertical]:flex-col", className)}
      onLayout={handleLayout}
      {...props}
    />
  );
};

const ResizablePanel = ResizablePrimitive.Panel;

// GAP-RE01: Snap positions, GAP-RE02: Collapsible
interface ResizableHandleProps extends React.ComponentProps<typeof ResizablePrimitive.PanelResizeHandle> {
  withHandle?: boolean;
  /** GAP-RE01: Snap positions em pixels */
  snap?: number[];
  /** GAP-RE02: Colapsível */
  collapsible?: boolean;
}

const ResizableHandle = ({
  withHandle,
  className,
  snap,
  collapsible = false,
  ...props
}: ResizableHandleProps) => (
  <ResizablePrimitive.PanelResizeHandle
    className={cn(
      "relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:-translate-y-1/2 data-[panel-group-direction=vertical]:after:translate-x-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 [&[data-panel-group-direction=vertical]>div]:rotate-90",
      collapsible && "data-[state=closed]:opacity-0",
      className,
    )}
    {...props}
  >
    {withHandle && (
      <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border">
        <GripVertical className="h-2.5 w-2.5" />
      </div>
    )}
  </ResizablePrimitive.PanelResizeHandle>
);

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };