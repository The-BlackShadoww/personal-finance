"use client";

import { CaretDown, Check, MagnifyingGlass } from "@phosphor-icons/react";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type Ref,
  type SelectHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils/cn";
import { useNativeField } from "./nativeField";
import { Popover } from "./Popover";

type Item =
  | { kind: "group"; label: string }
  | { kind: "option"; value: string; label: string; disabled: boolean; group?: string };

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "multiple" | "size"> & {
  ref?: Ref<HTMLSelectElement>;
  /** Show a filter box above the options. Defaults to on for long lists. */
  searchable?: boolean;
};

const SEARCH_THRESHOLD = 12;

// Drop-in replacement for <select>. Takes the same <option>/<optgroup>
// children and value/onChange (or react-hook-form register) props, but renders
// a listbox styled with the app's tokens instead of the OS menu.
export function Select({
  ref,
  id,
  className,
  children,
  disabled,
  searchable,
  style,
  title,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  ...nativeProps
}: SelectProps) {
  const field = useNativeField<HTMLSelectElement>(ref);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const typeahead = useRef({ text: "", at: 0 });

  // Read options back from the hidden native select so any children shape
  // (fragments, arrays, mixed text nodes) keeps working.
  // Runs every render on purpose; setItems bails out when nothing changed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const node = field.nodeRef.current;
    if (!node) return;
    const next: Item[] = [];
    for (const child of Array.from(node.children)) {
      if (child instanceof HTMLOptGroupElement) {
        next.push({ kind: "group", label: child.label });
        for (const option of Array.from(child.children)) {
          if (option instanceof HTMLOptionElement) next.push(readOption(option, child.label));
        }
      } else if (child instanceof HTMLOptionElement) {
        next.push(readOption(child));
      }
    }
    setItems((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next));
  });

  const options = useMemo(
    () => items.filter((item): item is Extract<Item, { kind: "option" }> => item.kind === "option"),
    [items],
  );
  const selected = options.find((option) => option.value === field.value);
  const showSearch = searchable ?? options.length > SEARCH_THRESHOLD;

  const visible = useMemo(() => filterItems(items, query), [items, query]);

  function search(next: string) {
    setQuery(next);
    // Reset the highlight in the same update so a quick ArrowDown/Enter acts
    // on the filtered list, not the previous one.
    setActive(firstEnabled(filterItems(items, next), 0, 1));
  }

  function openList() {
    if (disabled) return;
    setQuery("");
    setOpen(true);
    const index = items.findIndex((item) => item.kind === "option" && item.value === field.value);
    setActive(index >= 0 ? index : firstEnabled(items, 0, 1));
  }

  function close(refocus = true) {
    setOpen(false);
    field.blur();
    if (refocus) triggerRef.current?.focus();
  }

  function choose(item: Item | undefined) {
    if (!item || item.kind !== "option" || item.disabled) return;
    field.commit(item.value);
    close();
  }

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => (showSearch ? searchRef.current : listRef.current)?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open, showSearch]);

  useEffect(() => {
    if (!open || active < 0) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      openList();
      return;
    }
    // Typing on a closed select jumps straight to a matching option.
    if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const match = matchTypeahead(event.key);
      if (match) field.commit(match.value);
    }
  }

  function matchTypeahead(key: string) {
    const now = Date.now();
    const state = typeahead.current;
    state.text = now - state.at > 600 ? key.toLowerCase() : state.text + key.toLowerCase();
    state.at = now;
    return options.find((option) => !option.disabled && option.label.toLowerCase().startsWith(state.text));
  }

  function handleListKeyDown(event: KeyboardEvent<HTMLElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActive((index) => firstEnabled(visible, index + 1, 1, index));
        return;
      case "ArrowUp":
        event.preventDefault();
        setActive((index) => firstEnabled(visible, index - 1, -1, index));
        return;
      case "Home":
        event.preventDefault();
        setActive(firstEnabled(visible, 0, 1));
        return;
      case "End":
        event.preventDefault();
        setActive(firstEnabled(visible, visible.length - 1, -1));
        return;
      case "Enter":
        event.preventDefault();
        choose(visible[active]);
        return;
      case " ":
        if (showSearch) return;
        event.preventDefault();
        choose(visible[active]);
        return;
      case "Escape":
        // Stop here so an enclosing Modal stays open.
        event.preventDefault();
        event.stopPropagation();
        close();
        return;
      case "Tab":
        event.preventDefault();
        close();
        return;
      default:
        if (!showSearch && event.key.length === 1 && !event.metaKey && !event.ctrlKey) {
          const match = matchTypeahead(event.key);
          if (match) setActive(visible.indexOf(match));
        }
    }
  }

  const activeId = active >= 0 && visible[active]?.kind === "option" ? `${listId}-${active}` : undefined;
  const isPlaceholder = !selected || selected.value === "";

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        disabled={disabled}
        title={title}
        style={style}
        onClick={() => (open ? close() : openList())}
        onKeyDown={handleTriggerKeyDown}
        className={cn("field field-trigger", open && "field-open", className)}
      >
        <span className={cn("min-w-0 flex-1 truncate text-left", isPlaceholder && "text-muted")}>
          {selected?.label ?? " "}
        </span>
        <CaretDown
          size={13}
          weight="bold"
          aria-hidden="true"
          className={cn("shrink-0 text-muted transition-transform duration-200", open && "rotate-180")}
        />
      </button>

      <select
        {...nativeProps}
        ref={field.ref}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
      >
        {children}
      </select>

      <Popover anchorRef={triggerRef} open={open} onClose={() => close(false)}>
        {showSearch ? (
          <div className="flex items-center gap-2 border-b border-line px-3 dark:border-line-strong">
            <MagnifyingGlass size={14} className="shrink-0 text-muted" aria-hidden="true" />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => search(event.target.value)}
              onKeyDown={handleListKeyDown}
              placeholder="Search…"
              aria-label="Search options"
              aria-controls={listId}
              aria-activedescendant={activeId}
              className="h-10 w-full bg-transparent text-[14px] text-foreground outline-none placeholder:text-faint focus-visible:outline-none"
            />
          </div>
        ) : null}
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabel ? undefined : id}
          aria-activedescendant={showSearch ? undefined : activeId}
          onKeyDown={showSearch ? undefined : handleListKeyDown}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1 outline-none focus-visible:outline-none"
        >
          {visible.length === 0 ? (
            <p className="px-2.5 py-3 text-[13px] text-muted">No matches</p>
          ) : (
            visible.map((item, index) =>
              item.kind === "group" ? (
                <div
                  key={`group-${item.label}-${index}`}
                  role="presentation"
                  className="px-2.5 pb-1 pt-2.5 text-[11px] font-medium uppercase tracking-[0.06em] text-faint first:pt-1.5"
                >
                  {item.label}
                </div>
              ) : (
                <div
                  key={`${item.value}-${index}`}
                  id={`${listId}-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={item.value === field.value}
                  aria-disabled={item.disabled || undefined}
                  onPointerMove={() => !item.disabled && setActive(index)}
                  onClick={() => choose(item)}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-[6px] px-2.5 py-[7px] text-[14px] leading-snug text-foreground transition-colors duration-100",
                    index === active && "bg-surface-2 dark:bg-surface-3",
                    item.value === "" && "text-muted",
                    item.disabled && "cursor-not-allowed opacity-40",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.value === field.value ? (
                    <Check size={13} weight="bold" className="shrink-0 text-foreground" aria-hidden="true" />
                  ) : null}
                </div>
              ),
            )
          )}
        </div>
      </Popover>
    </>
  );
}

function readOption(option: HTMLOptionElement, group?: string): Item {
  return {
    kind: "option",
    value: option.value,
    label: option.label || option.textContent || "",
    disabled: option.disabled,
    group,
  };
}

// Next selectable option index from `start`, stepping by `dir`. Falls back to
// `fallback` (the current index) when the edge is reached.
function firstEnabled(list: Item[], start: number, dir: 1 | -1, fallback = -1) {
  for (let index = start; index >= 0 && index < list.length; index += dir) {
    const item = list[index];
    if (item.kind === "option" && !item.disabled) return index;
  }
  return fallback;
}

function filterItems(items: Item[], query: string): Item[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return items;
  const out: Item[] = [];
  let lastGroup: string | undefined;
  for (const item of items) {
    if (item.kind !== "option") continue;
    if (!item.label.toLowerCase().includes(needle) && !item.value.toLowerCase().includes(needle)) continue;
    // Keep group headings above their surviving options.
    if (item.group && item.group !== lastGroup) {
      out.push({ kind: "group", label: item.group });
      lastGroup = item.group;
    }
    out.push(item);
  }
  return out;
}
