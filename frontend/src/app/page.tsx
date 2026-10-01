"use client";

import {
  ArrowRight,
  Bell,
  CalendarBlank,
  ChartPieSlice,
  Check,
  Lock,
  Moon,
  ShieldCheck,
  Sun,
} from "@phosphor-icons/react";
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { Logo, LogoMark } from "@/components/brand/Logo";
import { FlowTabs } from "@/components/landing/FlowTabs";
import { HeroPreview } from "@/components/landing/HeroPreview";
import { FeedVignette, GaugeVignette, ReportVignette } from "@/components/landing/Vignettes";
import { EASE_OUT_EXPO, Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import { buttonClass } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { cn } from "@/lib/utils/cn";

const NAV = [
  { href: "#benefits", label: "Benefits" },
  { href: "#flows", label: "How it works" },
  { href: "#security", label: "Security" },
  { href: "#faq", label: "FAQ" },
];

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-background text-foreground">
      <AmbientLight />
      <SiteHeader />
      <main>
        <Hero />
        <Marquee />
        <Benefits />
        <Flows />
        <Details />
        <Security />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function AmbientLight() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">
      <div className="absolute left-[15%] top-[-30%] h-[80vh] w-[70vw] animate-drift bg-[radial-gradient(closest-side,rgb(235_104_52/0.035),transparent)] dark:bg-[radial-gradient(closest-side,rgb(255_255_255/0.03),transparent)]" />
    </div>
  );
}

function SiteHeader() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, "change", (latest) => setScrolled(latest > 12));

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-[background-color,border-color] duration-300",
        scrolled ? "border-b border-line bg-background/75 backdrop-blur-xl" : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-8 px-5 md:px-8">
        <Logo />
        <nav aria-label="Primary navigation" className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-[6px] px-3 py-1.5 text-[15px] text-foreground transition-colors hover:bg-surface-2"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <ThemeToggle />
          <Link href="/login" className={buttonClass({ variant: "ghost", size: "sm", className: "hidden text-foreground sm:inline-flex" })}>
            Log in
          </Link>
          <Link href="/register" className={buttonClass({ size: "sm", className: "group" })}>
            Get started
            <ArrowRight size={12} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */

function WordReveal({ text, className, delay = 0 }: { text: string; className?: string; delay?: number }) {
  const reduceMotion = useReducedMotion();
  return (
    <span className={className}>
      {text.split(" ").map((word, index) => (
        <span key={`${word}-${index}`} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
          <motion.span
            className="inline-block"
            initial={reduceMotion ? false : { y: "105%" }}
            animate={{ y: 0 }}
            transition={{ duration: 0.9, ease: EASE_OUT_EXPO, delay: delay + index * 0.045 }}
          >
            {word}&nbsp;
          </motion.span>
        </span>
      ))}
    </span>
  );
}

function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const previewY = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const reduceMotion = useReducedMotion();

  return (
    <section ref={ref} className="relative px-5 pb-20 pt-16 md:px-8 md:pb-28 md:pt-28">
      <div className="mx-auto max-w-[1240px]">
        <motion.a
          href="#flows"
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE_OUT_EXPO }}
          className="group inline-flex items-center gap-2 rounded-[4px] bg-surface-2 px-2 py-1 text-[14px] transition-colors hover:bg-surface-3"
        >
          Quarterly and yearly views
          <span className="text-muted">Now live</span>
          <ArrowRight size={11} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
        </motion.a>

        <h1 className="mt-20 max-w-[1080px] text-[34px] font-[360] leading-[1.12] tracking-[-0.025em] sm:text-[44px] md:mt-32 md:text-[56px]">
          <WordReveal text="Personal Finance makes your money legible." />
          <WordReveal
            text="Income. Expenses. Savings. Reports. Every number you need, in one quiet place."
            className="text-ghost"
            delay={0.25}
          />
        </h1>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE_OUT_EXPO, delay: 0.7 }}
          className="mt-10 flex flex-wrap items-center gap-2"
        >
          <Link href="/dashboard" className={buttonClass({ size: "lg", className: "group" })}>
            Open your dashboard
            <ArrowRight size={14} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link href="/register" className={buttonClass({ variant: "ghost", size: "lg", className: "text-foreground" })}>
            Create a free account
          </Link>
        </motion.div>

        <motion.div style={{ y: reduceMotion ? 0 : previewY }} className="mt-20 md:mt-28">
          <HeroPreview />
        </motion.div>
      </div>
    </section>
  );
}

function Marquee() {
  const items = [
    "Monthly summaries",
    "Category breakdowns",
    "Savings goals",
    "Low-balance alerts",
    "CSV export",
    "PDF reports",
    "Two-factor sign-in",
    "Light and dark themes",
    "Quarterly reviews",
    "Year-over-year comparison",
  ];
  return (
    <section aria-label="Capabilities" className="relative border-y border-line py-5">
      <div className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
        <div className="flex w-max animate-marquee gap-10 hover:[animation-play-state:paused]">
          {[...items, ...items].map((item, index) => (
            <span key={index} className="flex items-center gap-10 whitespace-nowrap text-[15px] text-muted">
              {item}
              <span className="h-1 w-1 rounded-full bg-ghost" aria-hidden="true" />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function SectionIntro({ eyebrow, title, aside }: { eyebrow: string; title: string; aside?: string }) {
  return (
    <Reveal className="max-w-2xl">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-4 text-[28px] font-[380] leading-[1.15] tracking-[-0.02em] md:text-[32px]">
        {title}
        {aside ? <span className="text-ghost"> {aside}</span> : null}
      </h2>
    </Reveal>
  );
}

function Benefits() {
  const cards: Array<{ title: string; body: string; visual: ReactNode }> = [
    {
      title: "Entries that stay put",
      body: "Every transaction carries its category, note, and the month it counts toward, so your totals never drift.",
      visual: <FeedVignette />,
    },
    {
      title: "Savings you can see",
      body: "A live savings rate, six-month trends, and category mix turn a pile of entries into a clear signal.",
      visual: <GaugeVignette />,
    },
    {
      title: "Records on demand",
      body: "Export any range as a CSV for spreadsheets or a formatted PDF for your accountant.",
      visual: <ReportVignette />,
    },
  ];

  return (
    <section id="benefits" className="scroll-mt-20 px-5 py-24 md:px-8 md:py-36">
      <div className="mx-auto max-w-[1240px]">
        <SectionIntro eyebrow="Benefits" title="Built around the rhythm of a real month." />
        <Stagger inView className="mt-14 grid gap-3 md:grid-cols-3">
          {cards.map((card) => (
            <StaggerItem key={card.title}>
              <article className="card card-hover group h-full p-3">
                <div className="card-muted h-[240px] overflow-hidden transition-colors duration-300 group-hover:bg-surface-3">
                  {card.visual}
                </div>
                <div className="px-3 pb-4 pt-6">
                  <h3 className="text-[15px]">{card.title}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{card.body}</p>
                </div>
              </article>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

function Flows() {
  return (
    <section id="flows" className="scroll-mt-20 px-5 py-24 md:px-8 md:py-36">
      <div className="mx-auto max-w-[1240px]">
        <SectionIntro eyebrow="How it works" title="From a single entry to a year-end picture." />
        <Reveal className="mt-14">
          <FlowTabs />
        </Reveal>
        <Reveal className="mt-12 flex flex-wrap gap-2">
          <Link href="/register" className={buttonClass({ className: "group" })}>
            Sign up for free
            <ArrowRight size={13} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link href="/login" className={buttonClass({ variant: "ghost", className: "text-foreground" })}>
            I already have an account
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function Details() {
  return (
    <section className="px-5 py-24 md:px-8 md:py-36">
      <div className="mx-auto max-w-[1240px]">
        <SectionIntro eyebrow="Details" title="The small things are handled." aside="So the big picture stays accurate." />
        <Stagger inView step={0.07} className="mt-14 grid auto-rows-[minmax(220px,auto)] gap-3 md:grid-cols-6">
          <StaggerItem className="md:col-span-4">
            <BentoCard
              icon={<CalendarBlank size={16} weight="bold" />}
              title="Period attribution"
              body="A bill paid on the 2nd can still count toward last month. You choose where every entry belongs."
            >
              <div className="flex flex-wrap gap-2">
                {["Jul 2026", "Aug 2026", "Sep 2026", "Oct 2026"].map((month, index) => (
                  <motion.span
                    key={month}
                    initial={{ opacity: 0, y: 6 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + index * 0.08 }}
                    className={cn(
                      "rounded-[6px] border px-3 py-1.5 text-[13px] num",
                      index === 2 ? "border-foreground bg-strong text-strong-foreground" : "border-line text-muted",
                    )}
                  >
                    {month}
                  </motion.span>
                ))}
              </div>
            </BentoCard>
          </StaggerItem>
          <StaggerItem className="md:col-span-2">
            <BentoCard
              icon={<Bell size={16} weight="bold" />}
              title="Low-balance alerts"
              body="Set a threshold and see a warning before an expense takes you under it."
            >
              <span className="tag bg-yellow-bg text-yellow-fg">Below $500</span>
            </BentoCard>
          </StaggerItem>
          <StaggerItem className="md:col-span-2">
            <BentoCard
              icon={<ChartPieSlice size={16} weight="bold" />}
              title="Your own categories"
              body="Colors and icons you pick, applied across every chart."
            >
              <div className="flex gap-1.5">
                {["#2a78d6", "#1baf7a", "#eb6834", "#eda100", "#7c3aed"].map((color, index) => (
                  <motion.span
                    key={color}
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ type: "spring", stiffness: 400, damping: 18, delay: 0.3 + index * 0.06 }}
                    className="h-6 w-6 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </BentoCard>
          </StaggerItem>
          <StaggerItem className="md:col-span-2">
            <BentoCard
              icon={<Lock size={16} weight="bold" />}
              title="Two-factor sign-in"
              body="Pair any authenticator app for a second check at login."
            >
              <div className="flex gap-1.5 font-mono text-[15px]">
                {"482913".split("").map((digit, index) => (
                  <span key={index} className="grid h-9 w-7 place-items-center rounded-[6px] border border-line bg-surface">
                    {digit}
                  </span>
                ))}
              </div>
            </BentoCard>
          </StaggerItem>
          <StaggerItem className="md:col-span-2">
            <BentoCard
              icon={<Moon size={16} weight="bold" />}
              title="Light and dark"
              body="A calm canvas by day, a soft charcoal one by night."
            >
              <div className="flex overflow-hidden rounded-[8px] border border-line">
                <span className="grid h-10 flex-1 place-items-center bg-white text-[#161514]">
                  <Sun size={14} weight="bold" />
                </span>
                <span className="grid h-10 flex-1 place-items-center bg-[#171717] text-[#ededec]">
                  <Moon size={14} weight="bold" />
                </span>
              </div>
            </BentoCard>
          </StaggerItem>
        </Stagger>
      </div>
    </section>
  );
}

function BentoCard({ icon, title, body, children }: { icon: ReactNode; title: string; body: string; children: ReactNode }) {
  return (
    <article className="card card-hover flex h-full flex-col justify-between gap-8 p-7 md:p-8">
      <div className="flex items-start justify-between gap-6">
        <div className="max-w-sm">
          <h3 className="text-[15px]">{title}</h3>
          <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{body}</p>
        </div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] bg-surface-2 text-foreground">{icon}</span>
      </div>
      <div>{children}</div>
    </article>
  );
}

/* ------------------------------------------------------------------ */

function Security() {
  const points = [
    ["Protected routes", "Your dashboard is reachable only with an active session."],
    ["Refresh-token sessions", "Short-lived access tokens, renewed quietly in the background."],
    ["Optional two-factor", "A time-based code from your authenticator app at every login."],
    ["Local download history", "The list of reports you exported stays on this device."],
  ];
  return (
    <section id="security" className="scroll-mt-20 px-5 py-24 md:px-8 md:py-36">
      <div className="mx-auto grid max-w-[1240px] gap-14 lg:grid-cols-2 lg:gap-20">
        <Reveal>
          <p className="eyebrow">Security</p>
          <h2 className="mt-4 text-[28px] font-[380] leading-[1.15] tracking-[-0.02em] md:text-[32px]">
            Your financial details deserve a calm, secure home.
            <span className="text-ghost"> Privacy is part of the design, not an add-on.</span>
          </h2>
          <div className="mt-10 inline-flex items-center gap-3 rounded-[8px] bg-surface-2 px-4 py-3 text-[14px]">
            <ShieldCheck size={18} weight="bold" />
            Sign-in protected with optional two-factor authentication
          </div>
        </Reveal>
        <Stagger inView className="divide-y divide-line border-y border-line">
          {points.map(([title, body]) => (
            <StaggerItem key={title} className="flex gap-4 py-6">
              <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-green-bg text-green-fg">
                <Check size={10} weight="bold" />
              </span>
              <div>
                <h3 className="text-[15px]">{title}</h3>
                <p className="mt-1 text-[15px] text-muted">{body}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

const FAQS = [
  {
    q: "What is the difference between the period and the date of a transaction?",
    a: "The period is the month an entry counts toward in your summaries. The date is when money actually moved. Rent paid on October 1st for September can live in September.",
  },
  {
    q: "How is my account balance calculated?",
    a: "Your running balance starts from the initial balance you set in Settings, then adds every income entry and subtracts every expense.",
  },
  {
    q: "How do savings goals work?",
    a: "Goals set real money aside inside your accounts — an emergency fund, a sinking fund for a known cost, or anything else. Fund them with a share of every income so you pay yourself first; what is not set aside is available to spend.",
  },
  {
    q: "Can I export my data?",
    a: "Yes. The Reports page produces a CSV or PDF for any range of months, with a preview of totals before you download.",
  },
  {
    q: "Is there a dark theme?",
    a: "Yes. Switch themes from the header at any time; the choice is remembered on your device.",
  },
];

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="scroll-mt-20 px-5 py-24 md:px-8 md:py-36">
      <div className="mx-auto grid max-w-[1240px] gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
        <SectionIntro eyebrow="FAQ" title="Questions, answered plainly." />
        <Reveal>
          <ul className="border-t border-line">
            {FAQS.map((item, index) => {
              const expanded = open === index;
              return (
                <li key={item.q} className="border-b border-line">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setOpen(expanded ? null : index)}
                    className="flex w-full items-center justify-between gap-6 py-6 text-left text-[15px] transition-colors hover:text-muted"
                  >
                    {item.q}
                    <span className="relative grid h-4 w-4 shrink-0 place-items-center" aria-hidden="true">
                      <span className="absolute h-px w-3 bg-current" />
                      <motion.span
                        className="absolute h-3 w-px bg-current"
                        animate={{ rotate: expanded ? 90 : 0, opacity: expanded ? 0 : 1 }}
                        transition={{ duration: 0.25 }}
                      />
                    </span>
                  </button>
                  <AnimatePresence initial={false}>
                    {expanded ? (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
                        className="overflow-hidden"
                      >
                        <p className="max-w-xl pb-6 text-[15px] leading-relaxed text-muted">{item.a}</p>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="px-5 pb-24 md:px-8 md:pb-36">
      <Reveal className="mx-auto max-w-[1240px]">
        <div className="card-muted relative overflow-clip px-7 py-20 md:px-16 md:py-28">
          <div className="dot-grid absolute inset-0 opacity-70 [mask-image:radial-gradient(ellipse_at_right,black,transparent_65%)]" aria-hidden="true" />
          <div className="relative max-w-2xl">
            <h2 className="text-[32px] font-[360] leading-[1.12] tracking-[-0.025em] md:text-[44px]">
              Start with one entry.
              <span className="text-ghost"> The picture builds itself from there.</span>
            </h2>
            <div className="mt-10 flex flex-wrap gap-2">
              <Link href="/register" className={buttonClass({ size: "lg", className: "group" })}>
                Create your account
                <ArrowRight size={14} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link href="/dashboard" className={buttonClass({ variant: "secondary", size: "lg" })}>
                Open the dashboard
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function SiteFooter() {
  const columns = [
    { title: "Product", links: [["Overview", "/dashboard"], ["Transactions", "/transactions"], ["Reports", "/reports"]] },
    { title: "Account", links: [["Log in", "/login"], ["Create account", "/register"], ["Settings", "/settings"]] },
    { title: "Learn", links: [["Benefits", "#benefits"], ["Security", "#security"], ["FAQ", "#faq"]] },
  ];
  return (
    <footer className="relative border-t border-line px-5 py-16 md:px-8">
      <div className="mx-auto grid max-w-[1240px] gap-12 md:grid-cols-[1.5fr_repeat(3,1fr)]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-[14px] text-muted">A quieter way to see where your money goes.</p>
        </div>
        {columns.map((column) => (
          <div key={column.title}>
            <p className="text-[14px] text-muted">{column.title}</p>
            <ul className="mt-4 space-y-2.5">
              {column.links.map(([label, href]) => (
                <li key={label}>
                  <Link href={href} className="text-[14px] transition-colors hover:text-muted">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-16 flex max-w-[1240px] items-center justify-between border-t border-line pt-6 text-[13px] text-muted">
        <span className="inline-flex items-center gap-2">
          <LogoMark className="h-3 w-3 [&>span]:h-1 [&>span]:w-1" /> Personal Finance
        </span>
        <span className="num">{new Date().getFullYear()}</span>
      </div>
    </footer>
  );
}
