"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { LogoMark } from "@/components/brand/Logo";
import { AppHeader } from "@/components/layouts/AppHeader";
import { MoneyFormatProvider } from "@/components/layouts/MoneyFormatProvider";

type AppLayoutProps = {
  children: ReactNode;
};

export default function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />
      <main className="flex-1 px-5 pb-20 pt-10 text-foreground md:px-8 md:pt-14">
        <motion.div
          key={pathname}
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="mx-auto w-full max-w-[1176px]"
        >
          <MoneyFormatProvider>{children}</MoneyFormatProvider>
        </motion.div>
      </main>
      <footer className="border-t border-line px-5 md:px-8">
        <div className="mx-auto flex h-16 max-w-[1176px] items-center justify-between text-[13px] text-muted">
          <span className="inline-flex items-center gap-2.5">
            <LogoMark className="h-3 w-3 [&>span]:h-1 [&>span]:w-1" />
            Personal Finance
          </span>
          <span className="flex items-center gap-5">
            <Link href="/guide" className="transition-colors hover:text-foreground">
              Guide
            </Link>
            <span className="num">{new Date().getFullYear()}</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
