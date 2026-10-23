import React from "react";
import { Root as SeparatorPrimitiveRoot } from "@radix-ui/react-separator";

import { cn } from "~/lib/utils";

const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitiveRoot>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitiveRoot>
>(
  (
    { className, orientation = "horizontal", decorative = true, ...props },
    ref,
  ) => (
    <SeparatorPrimitiveRoot
      ref={ref}
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "bg-border shrink-0",
        orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
        className,
      )}
      {...props}
    />
  ),
);
Separator.displayName = SeparatorPrimitiveRoot.displayName;

export { Separator };
