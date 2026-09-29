import Link from "next/link";
import { cn } from "@/lib/utils/cn";

/** Solid ink square mark — a nod to the natural.com monogram. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-grid h-[18px] w-[18px] place-items-center rounded-[2px] bg-foreground transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:rotate-90",
        className,
      )}
    >
      <span className="h-[6px] w-[6px] rounded-[1px] bg-background" />
    </span>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      aria-label="Personal Finance home"
      className={cn("group inline-flex items-center gap-2.5 text-[15px] tracking-[-0.01em]", className)}
    >
      <LogoMark />
      <span>Personal Finance</span>
    </Link>
  );
}
