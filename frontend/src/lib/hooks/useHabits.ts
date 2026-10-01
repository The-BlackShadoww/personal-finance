"use client";

import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { reviewsApi, type CompleteReviewPayload } from "@/lib/api/reviews";
import { wishlistApi, type WishlistDecision, type WishlistPayload } from "@/lib/api/wishlist";

// ---- monthly review ----

export const reviewKeys = {
  all: ["reviews"] as const,
  status: () => [...reviewKeys.all, "status"] as const,
  month: (year: number, month: number) => [...reviewKeys.all, year, month] as const,
};

export const reviewStatusQueryOptions = () =>
  queryOptions({ queryKey: reviewKeys.status(), queryFn: reviewsApi.status, staleTime: 5 * 60_000 });

export function useReviewStatus() {
  return useQuery(reviewStatusQueryOptions());
}

export function useMonthlyReview(year: number | null, month: number | null) {
  return useQuery({
    queryKey: reviewKeys.month(year ?? 0, month ?? 0),
    queryFn: () => reviewsApi.get(year as number, month as number),
    enabled: year !== null && month !== null,
  });
}

export function useCompleteReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ year, month, payload }: { year: number; month: number; payload: CompleteReviewPayload }) =>
      reviewsApi.complete(year, month, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: reviewKeys.all }),
  });
}

// ---- cooling-off list ----

export const wishlistQueryOptions = () =>
  queryOptions({ queryKey: ["wishlist"], queryFn: wishlistApi.list, staleTime: 60_000 });

export function useWishlist() {
  return useQuery(wishlistQueryOptions());
}

function useWishlistMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wishlist"] }) });
}

export const useAddWishlistItem = () => useWishlistMutation((payload: WishlistPayload) => wishlistApi.create(payload));
export const useDecideWishlistItem = () =>
  useWishlistMutation(
    ({ id, decision, transactionId }: { id: string; decision: WishlistDecision; transactionId?: string }) =>
      wishlistApi.decide(id, decision, transactionId),
  );
export const useRemoveWishlistItem = () => useWishlistMutation((id: string) => wishlistApi.remove(id));
