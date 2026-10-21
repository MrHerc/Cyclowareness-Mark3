import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: ComponentProps<"section">) {
  return <section className={cn("rounded-xl border border-line bg-surface shadow-raised", className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    // The action moves under the title once the title would get less than ~10rem next to it (phones, narrow
    // columns), instead of squeezing the title into a sliver under the action.
    <header className={cn("flex flex-wrap items-start gap-3 px-5 pt-5 sm:px-6 sm:pt-6", className)}>
      <div className="flex min-w-0 flex-[1_1_10rem] items-start gap-3">
        {icon ? <span className="grid size-9 shrink-0 place-items-center rounded-sm bg-brand-50 text-brand-600 [&_svg]:size-[1.1rem]">{icon}</span> : null}
        <div className="min-w-0 flex-1">
          <h2 className="text-title-sm font-semibold text-ink">{title}</h2>
          {description ? <p className="mt-1 text-caption text-ink-muted">{description}</p> : null}
        </div>
      </div>
      {action ? <div className="max-w-full shrink-0">{action}</div> : null}
    </header>
  );
}

export function CardBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("p-5 sm:p-6", className)} {...props} />;
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn("border-line", className)} />;
}
