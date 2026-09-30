"use client";

import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState, type ReactNode } from "react";

import { ToastProvider } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api/client";
import {
  PERSIST_BUSTER,
  PERSIST_MAX_AGE,
  createQueryPersister,
  shouldPersistQuery,
} from "@/lib/query/persistence";

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
            // Must be at least the persistence max age, or restored queries
            // are garbage-collected before anything uses them.
            gcTime: PERSIST_MAX_AGE,
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
  const [persister] = useState(createQueryPersister);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: PERSIST_MAX_AGE,
        buster: PERSIST_BUSTER,
        dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
      }}
    >
      <ToastProvider>{children}</ToastProvider>
      {process.env.NODE_ENV === "development" ? (
        <ReactQueryDevtools initialIsOpen={false} />
      ) : null}
    </PersistQueryClientProvider>
  );
}
