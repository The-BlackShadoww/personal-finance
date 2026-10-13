import { useCallback, useLayoutEffect, useRef, useState, type Ref } from "react";

type FieldElement = HTMLInputElement | HTMLSelectElement;

// Custom Select and DateInput keep a visually hidden native element as the
// source of truth, so they stay drop-in compatible with plain `value/onChange`
// props and with react-hook-form's `register()` (which reads and writes
// `element.value` directly). This hook mirrors that element's value into
// React state and lets the custom UI commit a new value as a real change.
export function useNativeField<T extends FieldElement>(forwardedRef: Ref<T> | undefined) {
  const nodeRef = useRef<T | null>(null);
  const [value, setValue] = useState("");

  const sync = useCallback(() => {
    const node = nodeRef.current;
    if (!node) return;
    setValue(node.value);
  }, []);

  const ref = useCallback(
    (node: T | null) => {
      nodeRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) (forwardedRef as { current: T | null }).current = node;
    },
    [forwardedRef],
  );

  // Programmatic writes (react-hook-form `reset`/`setValue`, controlled
  // re-renders) do not fire events, so observe the `value` property itself.
  useLayoutEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    const own = Object.getOwnPropertyDescriptor(node, "value");
    const base = own ?? Object.getOwnPropertyDescriptor(Object.getPrototypeOf(node), "value");
    if (!base?.get || !base.set) return;
    const { get, set } = base;
    Object.defineProperty(node, "value", {
      configurable: true,
      enumerable: base.enumerable,
      get() {
        return get.call(this);
      },
      set(next) {
        set.call(this, next);
        queueMicrotask(sync);
      },
    });
    sync();
    return () => {
      if (own) Object.defineProperty(node, "value", own);
      else delete (node as unknown as Record<string, unknown>).value;
    };
  }, [sync]);

  // Controlled selects are updated through option.selected, not `.value`.
  useLayoutEffect(() => {
    const node = nodeRef.current;
    if (node && node.value !== value) sync();
  });

  const commit = useCallback(
    (next: string) => {
      const node = nodeRef.current;
      if (!node || node.value === next) return;
      // Use the prototype setter so React's value tracker notices the change,
      // then fire the event React listens to for this element type.
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(node), "value")?.set;
      setter?.call(node, next);
      node.dispatchEvent(new Event(node instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
      sync();
    },
    [sync],
  );

  const blur = useCallback(() => {
    nodeRef.current?.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
  }, []);

  return { ref, nodeRef, value, commit, blur };
}
