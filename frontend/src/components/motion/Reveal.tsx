"use client";

import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type HTMLMotionProps,
} from "framer-motion";
import { useEffect, useRef, type ReactNode } from "react";

export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

type RevealProps = HTMLMotionProps<"div"> & {
  delay?: number;
  y?: number;
  once?: boolean;
};

/** Fades content up into place as it enters the viewport. */
export function Reveal({ delay = 0, y = 12, once = true, children, ...props }: RevealProps) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: "0px 0px -8% 0px" }}
      transition={{ duration: 0.35, ease: EASE_OUT_EXPO, delay }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/** Parent for cascading children. Pair with <StaggerItem>. */
export function Stagger({
  children,
  step = 0.05,
  delay = 0,
  className,
  inView = false,
}: {
  children: ReactNode;
  step?: number;
  delay?: number;
  className?: string;
  inView?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const variants = {
    hidden: {},
    show: { transition: { staggerChildren: step, delayChildren: delay } },
  };
  if (inView) {
    return (
      <motion.div
        className={className}
        variants={variants}
        initial={reduceMotion ? false : "hidden"}
        whileInView="show"
        viewport={{ once: true, margin: "0px 0px -8% 0px" }}
      >
        {children}
      </motion.div>
    );
  }
  return (
    <motion.div className={className} variants={variants} initial={reduceMotion ? false : "hidden"} animate="show">
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className, y = 12, ...props }: HTMLMotionProps<"div"> & { y?: number }) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y },
        show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE_OUT_EXPO } },
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/** Number that counts from its previous value to the next one. */
export function AnimatedNumber({
  value,
  format,
  duration = 0.6,
  className,
}: {
  value: number;
  format: (value: number) => string;
  duration?: number;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const motionValue = useMotionValue(0);
  const display = useTransform(motionValue, (latest) => format(latest));

  useEffect(() => {
    if (!inView) return;
    if (reduceMotion) {
      motionValue.set(value);
      return;
    }
    const controls = animate(motionValue, value, { duration, ease: EASE_OUT_EXPO });
    return () => controls.stop();
  }, [duration, inView, motionValue, reduceMotion, value]);

  return (
    <motion.span ref={ref} className={className}>
      {display}
    </motion.span>
  );
}
