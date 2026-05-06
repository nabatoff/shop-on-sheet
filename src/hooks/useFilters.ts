import { useCallback, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

const STORAGE_KEY = 'catalog_filters';
const PARAM_SEARCH = 'search';
const PARAM_SIZE = 'size';
const PARAM_CATEGORY = 'category';

interface StoredFilters {
  search?: string;
  size?: string | null;
  category?: string | null;
}

function readFromStorage(): StoredFilters {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredFilters;
    return {
      search: typeof parsed.search === 'string' ? parsed.search : '',
      size: parsed.size ?? null,
      category: parsed.category ?? null,
    };
  } catch {
    return {};
  }
}

function saveToStorage(filters: StoredFilters) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // ignore
  }
}

export function useFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const didInitFromStorage = useRef(false);

  const hasAnyParam = searchParams.has(PARAM_SEARCH) || searchParams.has(PARAM_SIZE) || searchParams.has(PARAM_CATEGORY);

  useEffect(() => {
    if (didInitFromStorage.current || hasAnyParam) return;
    didInitFromStorage.current = true;
    const stored = readFromStorage();
    if (!stored.search && !stored.size && !stored.category) return;
    const next = new URLSearchParams();
    if (stored.search) next.set(PARAM_SEARCH, stored.search);
    if (stored.size) next.set(PARAM_SIZE, stored.size);
    if (stored.category) next.set(PARAM_CATEGORY, stored.category);
    setSearchParams(next, { replace: true });
  }, [hasAnyParam, setSearchParams]);

  const searchQuery = searchParams.get(PARAM_SEARCH) ?? '';
  const selectedSize = searchParams.get(PARAM_SIZE) ?? null;
  const selectedCategory = searchParams.get(PARAM_CATEGORY) ?? null;

  const updateParams = useCallback(
    (updates: { search?: string; size?: string | null; category?: string | null }) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (updates.search !== undefined) {
            if (updates.search.trim()) next.set(PARAM_SEARCH, updates.search.trim());
            else next.delete(PARAM_SEARCH);
          }
          if (updates.size !== undefined) {
            if (updates.size) next.set(PARAM_SIZE, updates.size);
            else next.delete(PARAM_SIZE);
          }
          if (updates.category !== undefined) {
            if (updates.category) next.set(PARAM_CATEGORY, updates.category);
            else next.delete(PARAM_CATEGORY);
          }
          const toStore: StoredFilters = {
            search: next.get(PARAM_SEARCH) ?? '',
            size: next.get(PARAM_SIZE) ?? null,
            category: next.get(PARAM_CATEGORY) ?? null,
          };
          saveToStorage(toStore);
          return next;
        }
      );
    },
    [setSearchParams]
  );

  const setSearchQuery = useCallback(
    (query: string) => {
      updateParams({ search: query });
    },
    [updateParams]
  );

  const setSelectedSize = useCallback(
    (size: string | null) => {
      updateParams({ size });
    },
    [updateParams]
  );

  const setSelectedCategory = useCallback(
    (category: string | null) => {
      updateParams({ category });
    },
    [updateParams]
  );

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count += 1;
    if (selectedSize) count += 1;
    if (selectedCategory) count += 1;
    return count;
  }, [searchQuery, selectedSize, selectedCategory]);

  const clearFilters = useCallback(() => {
    setSearchParams(new URLSearchParams());
    saveToStorage({});
  }, [setSearchParams]);

  return {
    searchQuery,
    setSearchQuery,
    selectedSize,
    setSelectedSize,
    selectedCategory,
    setSelectedCategory,
    activeFiltersCount,
    clearFilters,
  };
}
