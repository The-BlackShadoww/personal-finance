import Link from "next/link";
import { LogoMark } from "@/components/brand/Logo";
import { buttonClass } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main className="dot-grid flex min-h-screen items-center justify-center bg-background px-6">
      <div className="card w-full max-w-md p-8 text-center md:p-10">
        <LogoMark className="mx-auto" />
        <p className="num mt-8 font-mono text-[13px] text-muted">404</p>
        <h1 className="mt-2 text-[28px] font-[380] tracking-[-0.025em]">
          Page not found.
          <span className="text-ghost"> It may have moved.</span>
        </h1>
        <Link href="/dashboard" className={buttonClass({ className: "mt-8" })}>
          Go to dashboard
        </Link>
      </div>
    </main>
  );
}
