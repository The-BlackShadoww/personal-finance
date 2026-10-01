"use client";

import { ArrowRight, Check, Clock, Lightbulb } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { GuideShot } from "@/components/guide/GuideShot";
import {
  GUIDE_RHYTHM,
  GUIDE_STEPS,
  type GuideStep,
} from "@/components/guide/steps";
import { PageHeader } from "@/components/layouts/PageHeader";
import { Reveal } from "@/components/motion/Reveal";
import { buttonClass } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";

const DONE_KEY = "pf-guide-done";
const TOTAL_MINUTES = GUIDE_STEPS.reduce((sum, step) => sum + step.minutes, 0);

/** Steps the viewer ticked off, remembered on this browser only. */
function useDoneSteps() {
  const [done, setDone] = useState<string[]>([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(DONE_KEY) ?? "[]");
      if (Array.isArray(saved))
        setDone(saved.filter((id) => typeof id === "string"));
    } catch {
      // Storage unavailable or corrupt: start with nothing ticked.
    }
  }, []);

  function toggle(id: string) {
    setDone((current) => {
      const next = current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id];
      try {
        window.localStorage.setItem(DONE_KEY, JSON.stringify(next));
      } catch {
        // Progress just won't survive a reload.
      }
      return next;
    });
  }

  return { done, toggle };
}

/** The step whose section is in the upper part of the viewport. */
function useActiveStep() {
  const [active, setActive] = useState(GUIDE_STEPS[0].id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible.length) setActive(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    GUIDE_STEPS.forEach((step) => {
      const element = document.getElementById(step.id);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, []);

  return active;
}

export default function GuidePage() {
  const { done, toggle } = useDoneSteps();
  const active = useActiveStep();
  const doneCount = GUIDE_STEPS.filter((step) => done.includes(step.id)).length;

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Guide"
        title="Get set up, step by step."
        aside="Everything the app does, in the order that works best."
        description={
          <>
            {GUIDE_STEPS.length} steps, about {TOTAL_MINUTES} minutes in all.
            Each step says where to go, what to click and what you should see.
            Tick a step off when it&rsquo;s done. Your progress is saved on this
            device.
          </>
        }
        actions={
          <a href={`#${GUIDE_STEPS[0].id}`} className={buttonClass()}>
            Start with step 1 <ArrowRight size={13} weight="bold" />
          </a>
        }
      />

      <div className="grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-14">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card-muted p-4">
            <div className="flex items-baseline justify-between">
              <p className="text-[13px] text-muted">Your progress</p>
              <p className="num text-[13px] text-foreground">
                {doneCount} / {GUIDE_STEPS.length}
              </p>
            </div>
            <div
              className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-3"
              role="progressbar"
              aria-label="Guide progress"
              aria-valuemin={0}
              aria-valuemax={GUIDE_STEPS.length}
              aria-valuenow={doneCount}
            >
              <div
                className="h-full rounded-full bg-[var(--ds-series-income)] transition-[width] duration-500"
                style={{ width: `${(doneCount / GUIDE_STEPS.length) * 100}%` }}
              />
            </div>
          </div>
          <nav aria-label="Guide steps" className="mt-4 hidden lg:block">
            <ol className="space-y-0.5">
              {GUIDE_STEPS.map((step, index) => {
                const isDone = done.includes(step.id);
                const isActive = active === step.id;
                return (
                  <li key={step.id}>
                    <a
                      href={`#${step.id}`}
                      aria-current={isActive ? "step" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-[6px] px-2.5 py-1.5 text-[13px] transition-colors",
                        isActive
                          ? "bg-surface-2 text-foreground"
                          : "text-muted hover:text-foreground",
                      )}
                    >
                      <StepBadge index={index} done={isDone} small />
                      <span className="truncate">
                        {step.title.replace(/\.$/, "")}
                      </span>
                    </a>
                  </li>
                );
              })}
              <li>
                <a
                  href="#rhythm"
                  className="flex items-center gap-2.5 rounded-[6px] px-2.5 py-1.5 text-[13px] text-muted transition-colors hover:text-foreground"
                >
                  <span
                    className="grid h-5 w-5 place-items-center rounded-full border border-dashed border-line-strong"
                    aria-hidden="true"
                  />
                  Your routine
                </a>
              </li>
            </ol>
          </nav>
        </aside>

        <div className="min-w-0 space-y-20">
          {GUIDE_STEPS.map((step, index) => (
            <StepSection
              key={step.id}
              step={step}
              index={index}
              done={done.includes(step.id)}
              onToggle={() => toggle(step.id)}
            />
          ))}

          <Reveal>
            <section id="rhythm" className="scroll-mt-24">
              <p className="eyebrow">Afterwards</p>
              <h2 className="mt-3 text-[26px] font-[380] leading-[1.15] tracking-[-0.02em] text-foreground md:text-[30px]">
                Your routine.{" "}
                <span className="text-ghost">
                  A few minutes now and then is enough.
                </span>
              </h2>
              <ul className="card mt-6 divide-y divide-line">
                {GUIDE_RHYTHM.map((item) => (
                  <li
                    key={item.when}
                    className="flex flex-col gap-1 px-6 py-4 sm:flex-row sm:items-baseline sm:gap-6"
                  >
                    <span className="w-44 shrink-0 text-[14px] text-foreground">
                      {item.when}
                    </span>
                    <span className="text-[14px] leading-relaxed text-muted">
                      {item.what}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/dashboard" className={buttonClass()}>
                  Go to Overview <ArrowRight size={13} weight="bold" />
                </Link>
                <Link
                  href="/accounts"
                  className={buttonClass({ variant: "secondary" })}
                >
                  Add an account
                </Link>
              </div>
            </section>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

function StepBadge({
  index,
  done,
  small,
}: {
  index: number;
  done: boolean;
  small?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "num grid shrink-0 place-items-center rounded-full transition-colors",
        small ? "h-5 w-5 text-[11px]" : "h-9 w-9 text-[14px]",
        done
          ? "bg-green-bg text-green-fg"
          : "border border-line-strong text-foreground",
      )}
    >
      {done ? <Check size={small ? 11 : 15} weight="bold" /> : index + 1}
    </span>
  );
}

function StepSection({
  step,
  index,
  done,
  onToggle,
}: {
  step: GuideStep;
  index: number;
  done: boolean;
  onToggle: () => void;
}) {
  const [primary, ...rest] = step.shots;
  // A tall dialog sits beside the page shot rather than below it.
  const split =
    rest.length === 1 &&
    (primary.kind === "dialog" || rest[0].kind === "dialog");

  return (
    <section
      id={step.id}
      aria-labelledby={`${step.id}-title`}
      className="scroll-mt-24"
    >
      <Reveal>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <StepBadge index={index} done={done} />
          <span className="eyebrow">Step {index + 1}</span>
          <span className="inline-flex items-center gap-1 text-[13px] text-faint">
            <Clock size={12} weight="bold" aria-hidden="true" /> {step.minutes}{" "}
            min
          </span>
        </div>
        <h2
          id={`${step.id}-title`}
          className="mt-4 text-[26px] font-[380] leading-[1.15] tracking-[-0.02em] text-foreground md:text-[30px]"
        >
          {step.title} <span className="text-ghost">{step.aside}</span>
        </h2>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted">
          {step.intro}
        </p>
      </Reveal>

      <div className="mt-8 space-y-10">
        <Reveal className="max-w-3xl">
          <ol className="space-y-4">
            {step.actions.map((action, actionIndex) => (
              <li key={actionIndex} className="flex gap-3.5">
                <span className="num mt-[3px] grid h-5 w-5 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] text-muted">
                  {actionIndex + 1}
                </span>
                <p className="text-[14px] leading-[1.75] text-foreground">
                  {action}
                </p>
              </li>
            ))}
          </ol>

          {step.tip ? (
            <div className="mt-6 flex gap-3 rounded-[10px] bg-blue-bg px-4 py-3.5 text-[13px] leading-relaxed text-blue-fg">
              <Lightbulb
                size={16}
                weight="bold"
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <p>{step.tip}</p>
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Link
              href={step.where.href}
              className={buttonClass({ variant: "secondary", size: "sm" })}
            >
              Open {step.where.label} <ArrowRight size={12} weight="bold" />
            </Link>
            <button
              type="button"
              onClick={onToggle}
              aria-pressed={done}
              className={buttonClass({
                variant: done ? "ghost" : "primary",
                size: "sm",
                className: done
                  ? "text-green-fg hover:text-green-fg"
                  : undefined,
              })}
            >
              <Check size={12} weight="bold" />
              {done ? "Done" : "Mark as done"}
            </button>
          </div>
        </Reveal>

        <Reveal delay={0.06}>
          {split ? (
            <div className="grid items-start gap-5 sm:grid-cols-[minmax(0,2.3fr)_minmax(0,1fr)]">
              {[primary, rest[0]]
                .sort(
                  (a, b) =>
                    Number(a.kind === "dialog") - Number(b.kind === "dialog"),
                )
                .map((shot) => (
                  <GuideShot
                    key={shot.name}
                    shot={shot}
                    sizes={
                      shot.kind === "dialog"
                        ? "(min-width: 1280px) 280px, 30vw"
                        : "(min-width: 1280px) 640px, 70vw"
                    }
                  />
                ))}
            </div>
          ) : (
            <div className="space-y-6">
              <GuideShot
                shot={primary}
                sizes="(min-width: 1280px) 940px, 100vw"
              />
              {rest.length ? (
                <div
                  className={cn(
                    "grid gap-5",
                    rest.length > 1 && "sm:grid-cols-2",
                  )}
                >
                  {rest.map((shot) => (
                    <GuideShot
                      key={shot.name}
                      shot={shot}
                      sizes={
                        rest.length > 1
                          ? "(min-width: 1280px) 460px, 50vw"
                          : "(min-width: 1280px) 940px, 100vw"
                      }
                    />
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </Reveal>
      </div>
    </section>
  );
}
