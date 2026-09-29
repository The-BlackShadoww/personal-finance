"use client";

import { LogoMark } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <main className="dot-grid flex min-h-screen items-center justify-center bg-background px-6">
      <div className="card w-full max-w-md p-8 text-center md:p-10">
        <LogoMark className="mx-auto" />
        <p className="eyebrow mt-8">Something went wrong</p>
        <h1 className="mt-2 text-[28px] font-[380] tracking-[-0.025em]">Unable to load this page</h1>
        <p className="mt-3 text-[14px] text-muted">{error.message}</p>
        <Button onClick={reset} className="mt-8">
          Try again
        </Button>
      </div>
    </main>
  );
}
