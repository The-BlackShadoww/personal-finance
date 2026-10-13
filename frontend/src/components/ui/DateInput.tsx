"use client";

import { CalendarBlank, CaretLeft, CaretRight } from "@phosphor-icons/react";
import {
  addDays,
  addMonths,
  addYears,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isValid,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  useEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from "react";
import { cn } from "@/lib/utils/cn";
import { useNativeField } from "./nativeField";
import { Popover } from "./Popover";

export type DateInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "min" | "max"> & {
  ref?: Ref<HTMLInputElement>;
  /** yyyy-MM-dd, inclusive. */
  min?: string | number;
  /** yyyy-MM-dd, inclusive. */
  max?: string | number;
};

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const ISO = "yyyy-MM-dd";

// Drop-in replacement for <input type="date">: same `yyyy-MM-dd` string value,
// works with value/onChange and react-hook-form register, but opens a calendar
// drawn with the app's tokens instead of the browser's picker.
export function DateInput({
  ref,
  id,
  className,
  disabled,
  required,
  min,
  max,
  placeholder = "Pick a date",
  style,
  title,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  ...nativeProps
}: DateInputProps) {
  const field = useNativeField<HTMLInputElement>(ref);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"days" | "months">("days");
  const [focused, setFocused] = useState(() => new Date());

  const selected = toDate(field.value);
  const minDate = toDate(min?.toString());
  const maxDate = toDate(max?.toString());
  const today = new Date();

  const outOfRange = (day: Date) =>
    (minDate !== null && day < minDate && !isSameDay(day, minDate)) ||
    (maxDate !== null && day > maxDate && !isSameDay(day, maxDate));

  function openCalendar() {
    if (disabled) return;
    setFocused(selected ?? clamp(today, minDate, maxDate));
    setView("days");
    setOpen(true);
  }

  function close(refocus = true) {
    setOpen(false);
    field.blur();
    if (refocus) triggerRef.current?.focus();
  }

  function choose(day: Date | null) {
    if (day && outOfRange(day)) return;
    field.commit(day ? format(day, ISO) : "");
    close();
  }

  // Keep keyboard focus on the roving day cell.
  useEffect(() => {
    if (!open || view !== "days") return;
    const frame = requestAnimationFrame(() =>
      gridRef.current?.querySelector<HTMLElement>(`[data-day="${format(focused, ISO)}"]`)?.focus(),
    );
    return () => cancelAnimationFrame(frame);
  }, [open, view, focused]);

  function handleGridKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, () => Date> = {
      ArrowLeft: () => addDays(focused, -1),
      ArrowRight: () => addDays(focused, 1),
      ArrowUp: () => addDays(focused, -7),
      ArrowDown: () => addDays(focused, 7),
      Home: () => startOfWeek(focused),
      End: () => endOfWeek(focused),
      PageUp: () => (event.shiftKey ? addYears(focused, -1) : addMonths(focused, -1)),
      PageDown: () => (event.shiftKey ? addYears(focused, 1) : addMonths(focused, 1)),
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      setFocused(move());
    }
  }

  function handlePanelKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      // Stop here so an enclosing Modal stays open.
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === "Tab") {
      // Keep focus inside the calendar while it is open.
      const focusable = Array.from(
        event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled]):not([tabindex='-1'])"),
      );
      const index = focusable.indexOf(document.activeElement as HTMLElement);
      event.preventDefault();
      event.stopPropagation();
      const next = (index + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length;
      focusable[next]?.focus();
    }
  }

  const monthStart = startOfMonth(focused);
  const days: Date[] = [];
  for (let day = startOfWeek(monthStart); day <= endOfWeek(endOfMonth(monthStart)); day = addDays(day, 1)) {
    days.push(day);
  }
  const canPrev = !minDate || endOfMonth(addMonths(focused, -1)) >= minDate;
  const canNext = !maxDate || startOfMonth(addMonths(focused, 1)) <= maxDate;
  const todayAllowed = !outOfRange(today);

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        data-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        disabled={disabled}
        title={title}
        style={style}
        onClick={() => (open ? close() : openCalendar())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            openCalendar();
          }
        }}
        className={cn("field field-trigger num", open && "field-open", className)}
      >
        <CalendarBlank size={15} className="shrink-0 text-muted" aria-hidden="true" />
        <span className={cn("min-w-0 flex-1 truncate text-left", !selected && "text-faint")}>
          {selected ? format(selected, "EEE, d MMM yyyy") : placeholder}
        </span>
      </button>

      <input
        {...nativeProps}
        ref={field.ref}
        type="text"
        required={required}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
      />

      <Popover anchorRef={triggerRef} open={open} onClose={() => close(false)} matchWidth={false} preferredHeight={420}>
        <div
          role="dialog"
          aria-label="Choose date"
          onKeyDown={handlePanelKeyDown}
          className="w-[18.5rem] p-3"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setView(view === "days" ? "months" : "days")}
              aria-label={view === "days" ? "Choose month and year" : "Back to days"}
              className="flex h-8 items-center gap-1.5 rounded-[6px] px-2 text-[14px] text-foreground transition-colors hover:bg-surface-2 dark:hover:bg-surface-3"
            >
              {view === "days" ? format(focused, "MMMM yyyy") : format(focused, "yyyy")}
              <CaretRight
                size={11}
                weight="bold"
                aria-hidden="true"
                className={cn("text-muted transition-transform duration-200", view === "months" && "rotate-90")}
              />
            </button>
            <div className="flex items-center gap-0.5">
              <NavButton
                label={view === "days" ? "Previous month" : "Previous year"}
                disabled={view === "days" && !canPrev}
                onClick={() => setFocused(view === "days" ? addMonths(focused, -1) : addYears(focused, -1))}
              >
                <CaretLeft size={13} weight="bold" aria-hidden="true" />
              </NavButton>
              <NavButton
                label={view === "days" ? "Next month" : "Next year"}
                disabled={view === "days" && !canNext}
                onClick={() => setFocused(view === "days" ? addMonths(focused, 1) : addYears(focused, 1))}
              >
                <CaretRight size={13} weight="bold" aria-hidden="true" />
              </NavButton>
            </div>
          </div>

          {view === "days" ? (
            <div ref={gridRef} role="grid" aria-label={format(focused, "MMMM yyyy")} onKeyDown={handleGridKeyDown}>
              <div role="row" className="grid grid-cols-7">
                {WEEKDAYS.map((weekday) => (
                  <span
                    key={weekday}
                    role="columnheader"
                    className="grid h-8 place-items-center text-[11px] font-medium uppercase tracking-[0.06em] text-faint"
                  >
                    {weekday}
                  </span>
                ))}
              </div>
              <div role="rowgroup" className="grid grid-cols-7 gap-y-0.5">
                {days.map((day) => {
                  const isSelected = selected !== null && isSameDay(day, selected);
                  const isToday = isSameDay(day, today);
                  const inMonth = isSameMonth(day, focused);
                  const blocked = outOfRange(day);
                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      role="gridcell"
                      data-day={format(day, ISO)}
                      tabIndex={isSameDay(day, focused) ? 0 : -1}
                      aria-selected={isSelected}
                      aria-current={isToday ? "date" : undefined}
                      aria-label={format(day, "EEEE, d MMMM yyyy")}
                      aria-disabled={blocked || undefined}
                      onClick={() => choose(day)}
                      className={cn(
                        "num relative mx-auto grid h-9 w-9 place-items-center rounded-[6px] text-[13px] transition-colors duration-100 focus-visible:outline-offset-0",
                        isSelected
                          ? "bg-strong text-strong-foreground hover:bg-strong-hover"
                          : inMonth
                            ? "text-foreground hover:bg-surface-2 dark:hover:bg-surface-3"
                            : "text-ghost hover:bg-surface-2 dark:hover:bg-surface-3",
                        blocked && "cursor-not-allowed text-ghost line-through decoration-1 hover:bg-transparent dark:hover:bg-transparent",
                      )}
                    >
                      {format(day, "d")}
                      {isToday && !isSelected ? (
                        <span className="absolute bottom-1 h-[3px] w-[3px] rounded-full bg-foreground" aria-hidden="true" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1 py-1">
              {Array.from({ length: 12 }, (_, month) => {
                const candidate = new Date(focused.getFullYear(), month, 1);
                const blocked =
                  (minDate !== null && endOfMonth(candidate) < minDate) || (maxDate !== null && candidate > maxDate);
                const current = month === focused.getMonth();
                return (
                  <button
                    key={month}
                    type="button"
                    disabled={blocked}
                    onClick={() => {
                      setFocused(clamp(new Date(focused.getFullYear(), month, Math.min(focused.getDate(), 28)), minDate, maxDate));
                      setView("days");
                    }}
                    className={cn(
                      "h-10 rounded-[6px] text-[13px] transition-colors duration-100 disabled:cursor-not-allowed disabled:text-ghost",
                      current
                        ? "bg-strong text-strong-foreground hover:bg-strong-hover"
                        : "text-foreground hover:bg-surface-2 dark:hover:bg-surface-3",
                    )}
                  >
                    {format(candidate, "MMM")}
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-2 flex items-center justify-between border-t border-line pt-2 dark:border-line-strong">
            <button
              type="button"
              disabled={!todayAllowed}
              onClick={() => choose(today)}
              className="h-8 rounded-[6px] px-2.5 text-[13px] text-foreground transition-colors hover:bg-surface-2 disabled:opacity-40 dark:hover:bg-surface-3"
            >
              Today
            </button>
            {!required && selected ? (
              <button
                type="button"
                onClick={() => choose(null)}
                className="h-8 rounded-[6px] px-2.5 text-[13px] text-muted transition-colors hover:bg-surface-2 hover:text-foreground dark:hover:bg-surface-3"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
      </Popover>
    </>
  );
}

function NavButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-[6px] text-muted transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-35 dark:hover:bg-surface-3"
    >
      {children}
    </button>
  );
}

function toDate(value: string | undefined | null) {
  if (!value) return null;
  const date = parseISO(value);
  return isValid(date) ? date : null;
}

function clamp(date: Date, min: Date | null, max: Date | null) {
  if (min && date < min) return min;
  if (max && date > max) return max;
  return date;
}
