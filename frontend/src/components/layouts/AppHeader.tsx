"use client";

import { GearSix, List, Plus, SignOut, X } from "@phosphor-icons/react";
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { EASE_OUT_EXPO } from "@/components/motion/Reveal";
import { buttonClass } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/lib/api/auth";
import { clearAccessToken } from "@/lib/api/client";
import { useProfile } from "@/lib/hooks/useProfile";import { prefetchRoute } from "@/lib/query/prefetchRoute";
import { cn } from "@/lib/utils/cn";

export const NAVIGATION = [
  { href: "/dashboard", label: "Overview" },
  { href: "/accounts", label: "Accounts" },
  { href: "/goals", label: "Goals" },
  { href: "/transactions", label: "Transactions" },
  { href: "/budgets", label: "Plan" },
  { href: "/reports", label: "Reports" },
  { href: "/settings", label: "Settings" },
];

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => setScrolled(latest > 8));

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // Hover, keyboard focus and touch all signal an imminent navigation.
  function prefetchHandlers(href: string) {
    const prefetch = () => prefetchRoute(queryClient, href);
    return { onMouseEnter: prefetch, onFocus: prefetch, onTouchStart: prefetch };
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await authApi.logout();
    } finally {
      clearAccessToken();
      queryClient.clear();
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl transition-[border-color] duration-300",
          scrolled || menuOpen ? "border-line" : "border-transparent",
        )}
      >
        <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-6 px-5 md:px-8">
          <Logo href="/dashboard" />

          <nav aria-label="Main navigation" className="ml-4 hidden items-center gap-0.5 lg:flex">
            {NAVIGATION.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  {...prefetchHandlers(item.href)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative rounded-[6px] px-3 py-1.5 text-[14px] transition-colors duration-200",
                    active ? "text-foreground" : "text-muted hover:text-foreground",
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute inset-0 rounded-[6px] bg-surface-2"
                      transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
                    />
                  ) : null}
                  <span className="relative">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            <Link
              href="/transactions"
              className={buttonClass({ size: "sm", className: "hidden sm:inline-flex" })}
            >
              <Plus size={14} weight="bold" aria-hidden="true" />
              Transactions
            </Link>
            <ThemeToggle />
            <UserMenu onLogout={handleLogout} isLoggingOut={isLoggingOut} />
            <button
              type="button"
              aria-label={menuOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              className="grid h-9 w-9 place-items-center rounded-[6px] text-foreground transition-colors hover:bg-surface-2 lg:hidden"
            >
              {menuOpen ? <X size={18} weight="bold" /> : <List size={18} weight="bold" />}
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {menuOpen ? (
          <motion.div
            className="fixed inset-x-0 bottom-0 top-16 z-40 flex flex-col overflow-y-auto bg-background px-5 pb-8 pt-6 lg:hidden"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <nav aria-label="Mobile navigation" className="flex flex-col">
              {NAVIGATION.map((item, index) => {
                const active = pathname === item.href;
                return (
                  <motion.div
                    key={item.href}
                    initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: EASE_OUT_EXPO, delay: 0.04 * index }}
                  >
                    <Link
                      href={item.href}
                      {...prefetchHandlers(item.href)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center justify-between border-b border-line py-4 text-[28px] tracking-[-0.02em]",
                        active ? "text-foreground" : "text-ghost",
                      )}
                    >
                      {item.label}
                      {active ? <span className="h-2 w-2 rounded-full bg-foreground" /> : null}
                    </Link>
                  </motion.div>
                );
              })}
            </nav>
            <div className="mt-auto flex flex-col gap-2 pt-8">
              <Link href="/transactions" className={buttonClass({ size: "lg" })}>
                <Plus size={16} weight="bold" /> Transactions
              </Link>
              <button
                type="button"
                disabled={isLoggingOut}
                onClick={handleLogout}
                className={buttonClass({ variant: "secondary", size: "lg" })}
              >
                <SignOut size={16} weight="bold" />
                {isLoggingOut ? "Logging out…" : "Log out"}
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function UserMenu({ onLogout, isLoggingOut }: { onLogout: () => void; isLoggingOut: boolean }) {
  const { data: profile } = useProfile();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const initial = profile?.name?.trim()?.charAt(0)?.toUpperCase() ?? "";

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative hidden lg:block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((value) => !value)}
        className="ml-1 grid h-8 w-8 place-items-center overflow-hidden rounded-full border border-line bg-surface-2 text-[13px] text-foreground transition-transform hover:scale-105"
      >
        {profile?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          initial || <span className="h-1.5 w-1.5 rounded-full bg-muted" />
        )}
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ type: "spring", stiffness: 500, damping: 34 }}
            style={{ originX: 1, originY: 0 }}
            className="absolute right-0 top-11 w-60 rounded-[10px] border border-line bg-surface p-1.5 shadow-[var(--ds-shadow-pop)]"
          >
            <div className="border-b border-line px-3 pb-3 pt-2">
              <p className="truncate text-[14px] text-foreground">{profile?.name ?? "Your account"}</p>
              <p className="truncate text-[12px] text-muted">{profile?.email ?? ""}</p>
            </div>
            <div className="pt-1.5">
              <Link
                href="/settings"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-[6px] px-3 py-2 text-[14px] text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                <GearSix size={15} weight="bold" /> Settings
              </Link>
              <button
                type="button"
                role="menuitem"
                disabled={isLoggingOut}
                onClick={onLogout}
                className="flex w-full items-center gap-2.5 rounded-[6px] px-3 py-2 text-[14px] text-muted transition-colors hover:bg-red-bg hover:text-red-fg disabled:opacity-50"
              >
                <SignOut size={15} weight="bold" />
                {isLoggingOut ? "Logging out…" : "Log out"}
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
