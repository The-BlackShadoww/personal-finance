import { queryOptions, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { categoriesApi, CreateCategoryPayload, UpdateCategoryPayload } from '../api/categories';

export const categoryKeys = {
  all: ['categories'] as const,
  lists: () => [...categoryKeys.all, 'list'] as const,
};

export const categoriesQueryOptions = () =>
  queryOptions({
    queryKey: categoryKeys.lists(),
    queryFn: categoriesApi.getAll,
    staleTime: 1000 * 60 * 10,   // 10 minutes — categories rarely change
  });

export function useCategories(enabled = true) {
  return useQuery({ ...categoriesQueryOptions(), enabled });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: categoriesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCategoryPayload }) =>
      categoriesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: categoriesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
    },
  });
}
