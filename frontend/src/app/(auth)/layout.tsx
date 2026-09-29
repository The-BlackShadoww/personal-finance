"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Logo } from "@/components/brand/Logo";
import { Sparkline } from "@/components/charts/Sparkline";
import { EASE_OUT_EXPO } from "@/components/motion/Reveal";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

type AuthLayoutProps = {
  children: ReactNode;
};

export default function AuthLayout({ children }: AuthLayoutProps) {
  const reduceMotion = useReducedMotion();
  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[1fr_1.05fr]">
      <div className="flex min-h-screen flex-col px-6 py-6 md:px-12">
        <div className="flex items-center justify-between">
          <Logo />
          <ThemeToggle />
        </div>
        <motion.section
          initial={reduceMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE_OUT_EXPO }}
          className="mx-auto flex w-full max-w-[380px] flex-1 flex-col justify-center py-16"
        >
          {children}
        </motion.section>
        <p className="text-[12px] text-faint">Private by default. Built for everyday decisions.</p>
      </div>

      <aside className="relative hidden overflow-clip p-3 lg:block">
        <div className="grain relative h-full overflow-clip rounded-[12px] bg-surface-2">
          <motion.img
            src="https://picsum.photos/seed/quiet-ridge/1400/1800"
            alt=""
            className="photo absolute inset-0 h-full w-full object-cover"
            initial={reduceMotion ? false : { scale: 1.08, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1.8, ease: EASE_OUT_EXPO }}
          />
          <div className="absolute inset-0 bg-[linear-gradient(to_top,rgb(0_0_0/0.35),transparent_45%)]" aria-hidden="true" />

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: EASE_OUT_EXPO, delay: 0.5 }}
            className="absolute left-1/2 top-1/2 w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-[12px] border border-white/40 bg-white/85 p-5 text-[#161514] shadow-[0_24px_60px_rgb(0_0_0/0.18)] backdrop-blur-xl"
          >
            <div className="flex items-center justify-between text-[12px] text-[#71706f]">
              <span>Kept this month</span>
              <span className="rounded-full bg-[#edf3ec] px-2 py-0.5 text-[10px] uppercase tracking-[0.05em] text-[#346538]">On track</span>
            </div>
            <p className="num mt-2 text-[34px] font-[360] leading-none tracking-[-0.04em]">$2,418.60</p>
            <div className="mt-4 flex items-end justify-between">
              <p className="text-[12px] text-[#71706f]">
                31.2% savings rate
                <br />
                <span className="text-[#161514]">+4.1 pts vs August</span>
              </p>
              <Sparkline values={[12, 18, 15, 22, 19, 27, 31]} color="#2a78d6" width={110} height={40} />
            </div>
          </motion.div>

          <div className="absolute inset-x-8 bottom-8 flex items-end justify-between text-white">
            <p className="max-w-xs text-[22px] leading-[1.2] tracking-[-0.02em]">
              A quieter way to see where your money goes.
            </p>
          </div>
        </div>
      </aside>
    </main>
  );
}
