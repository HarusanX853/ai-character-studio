import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border bg-muted px-2 py-1 text-xs font-medium text-muted-foreground",
        className
      )}
      {...props}
    />
  );
}
