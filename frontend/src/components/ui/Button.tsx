import * as React from "react";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "link";
type Size = "sm" | "md" | "lg" | "icon" | "icon-sm";

const base =
  "relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap font-medium outline-none transition-[background-color,color,border-color,transform,opacity] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&_svg]:shrink-0";

const variants: Record<Variant, string> = {
  primary: "bg-strong text-strong-foreground hover:bg-strong-hover",
  secondary:
    "border border-line bg-surface text-foreground hover:border-line-strong hover:bg-surface-2",
  ghost: "text-muted hover:bg-surface-2 hover:text-foreground",
  danger: "bg-red-fg text-white hover:opacity-90 dark:text-[#171717]",
  link: "h-auto px-0 text-foreground underline-offset-4 hover:underline",
};

const sizes: Record<Size, string> = {
  sm: "h-8 rounded-[6px] px-3 text-[13px]",
  md: "h-10 rounded-[6px] px-4 text-[14px]",
  lg: "h-12 rounded-[6px] px-5 text-[15px]",
  icon: "h-10 w-10 rounded-[6px]",
  "icon-sm": "h-8 w-8 rounded-[6px]",
};

export function buttonClass({
  variant = "primary",
  size = "md",
  className,
}: { variant?: Variant; size?: Size; className?: string } = {}) {
  return cn(base, variants[variant], variant === "link" ? "" : sizes[size], className);
}

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      data-slot="button"
      className={buttonClass({ variant, size, className })}
      {...props}
    />
  ),
);

Button.displayName = "Button";
