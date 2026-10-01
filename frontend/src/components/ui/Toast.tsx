"use client";

import { CheckCircle, WarningCircle, X } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ToastVariant = "success" | "error";

export type ToastAction = { label: string; onClick: () => void };

type Toast = {
  id: number;
  message: string;
  variant: ToastVariant;
  action?: ToastAction;
};

type ToastContextValue = {
  success: (message: string, action?: ToastAction) => void;
  error: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (message: string, variant: ToastVariant, action?: ToastAction) => {
      counter.current += 1;
      const id = counter.current;
      setToasts((current) => [...current, { id, message, variant, action }]);
      // Leave time to act on toasts that offer an action (e.g. Undo).
      window.setTimeout(() => dismiss(id), action ? 8000 : 4000);
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({
      success: (message: string, action?: ToastAction) => show(message, "success", action),
      error: (message: string) => show(message, "error"),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[80] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97, transition: { duration: 0.15 } }}
              transition={{ type: "spring", stiffness: 500, damping: 36 }}
              className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-[10px] bg-strong px-4 py-3 text-sm text-strong-foreground shadow-[var(--ds-shadow-pop)]"
              role="status"
            >
              {toast.variant === "success" ? (
                <CheckCircle size={18} weight="fill" className="shrink-0 text-income" aria-hidden="true" />
              ) : (
                <WarningCircle size={18} weight="fill" className="shrink-0 text-expense" aria-hidden="true" />
              )}
              <span className="flex-1">{toast.message}</span>
              {toast.action ? (
                <button
                  type="button"
                  onClick={() => {
                    toast.action?.onClick();
                    dismiss(toast.id);
                  }}
                  className="shrink-0 rounded-[4px] px-1.5 py-0.5 text-[13px] font-medium underline-offset-4 hover:underline"
                >
                  {toast.action.label}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss notification"
                className="grid h-6 w-6 place-items-center rounded-[4px] opacity-60 transition-opacity hover:opacity-100"
              >
                <X size={12} weight="bold" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}
