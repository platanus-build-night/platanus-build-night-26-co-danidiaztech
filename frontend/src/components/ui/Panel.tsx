import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

interface PanelProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title?: ReactNode;
  actions?: ReactNode;
  bodyClassName?: string;
}

/** A bordered content region with an optional title bar — used for the larger
 * layout panes (e.g. statement / code / review sections), as opposed to
 * Card which is for smaller discrete content blocks. */
export function Panel({ title, actions, bodyClassName, className, children, ...rest }: PanelProps) {
  return (
    <div
      className={cn(
        "flex flex-col h-full bg-surface border border-border rounded-xl overflow-hidden",
        className
      )}
      {...rest}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
          {title && <h2 className="text-sm font-semibold text-text">{title}</h2>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn("flex-1 min-h-0 overflow-auto p-4", bodyClassName)}>{children}</div>
    </div>
  );
}
