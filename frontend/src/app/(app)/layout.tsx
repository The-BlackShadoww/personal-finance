"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { Sidebar } from "@/components/layouts/Sidebar";

const PAGE_NAMES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/account": "Account",
  "/transactions": "Transactions",
  "/budgets": "Budgets",
  "/reports": "Reports",
  "/settings": "Settings",
};

type AppLayoutProps = {
  children: ReactNode;
};

export default function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const pageName = PAGE_NAMES[pathname] ?? "";

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-line bg-surface/90 px-5 py-3 backdrop-blur-xl md:px-10">
          <div className="mx-auto flex max-w-[1580px] items-center justify-between gap-4">
            <span className="text-sm font-semibold text-foreground">{pageName}</span>
            <Link
              href="/transactions"
              className="inline-flex h-8 items-center gap-1.5 rounded-control bg-primary px-3 text-xs font-semibold text-white shadow-[0_2px_8px_rgb(33_66_231_/_28%)] transition hover:bg-primary-hover"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Transactions
            </Link>
          </div>
        </header>
        <main className="min-h-[calc(100vh-4rem)] px-5 py-8 text-foreground md:px-10 md:py-10">
          <div className="mx-auto w-full max-w-[1580px]">{children}</div>
        </main>
        <footer className="border-t border-line px-5 py-5 text-xs text-muted md:px-10">
          <div className="mx-auto flex max-w-[1580px] justify-center items-center text-center">
            <span className="text-muted">
              Personal Finance
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}

