"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useEffect, useState, type ReactNode } from "react";

import { ToastProvider } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api/client";
import { useThemeSync } from "@/lib/hooks/useTheme";

// A previous release persisted the query cache (financial data) under this
// localStorage key. Query data is now kept in memory only; delete any copy an
// earlier visit left behind. Safe to remove once old snapshots have expired.
const LEGACY_PERSISTED_CACHE_KEY = "pf-query-cache";

type ProvidersProps = {
  children: ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 2 * 60 * 1000,
            retry: (failureCount, error) => {
              if (
                error instanceof ApiError &&
                (error.statusCode === 401 || error.statusCode === 403)
              ) {
                return false;
              }

              return failureCount < 1;
            },
          },
        },
      }),
  );

  useThemeSync();

  useEffect(() => {
    try {
      window.localStorage.removeItem(LEGACY_PERSISTED_CACHE_KEY);
    } catch {
      // Storage unavailable (private mode): nothing can have been persisted.
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
      {process.env.NODE_ENV === "development" ? (
        <ReactQueryDevtools initialIsOpen={false} />
      ) : null}
    </QueryClientProvider>
  );
}
