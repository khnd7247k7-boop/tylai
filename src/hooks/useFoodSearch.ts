import debounce from 'lodash/debounce';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  searchFoodCatalog,
  type FoodCatalogSearchMeta,
} from '../api/foodCatalog';
import type { FoodSearchHit } from '../types/fdcApi';
import { rememberFoodQuery, loadRecentFoodQueries } from '../utils/fdcRecentQueries';
import { rankFoodSearchResults } from '../utils/fdcSearchRank';

export interface UseFoodSearchOptions {
  /** When false, clears state and cancels pending searches. */
  enabled: boolean;
  /**
   * When this property is present, the hook debounces off `controlledQuery` (parent-owned string, e.g. meal name).
   * Omit entirely for internal query state (standalone search UI).
   */
  controlledQuery?: string;
}

const defaultMeta: FoodCatalogSearchMeta = {
  source: 'fatsecret',
  usedFallback: false,
};

export function useFoodSearch(options: UseFoodSearchOptions) {
  const { enabled } = options;
  const isControlled = 'controlledQuery' in options;
  const controlledQuery = isControlled ? options.controlledQuery ?? '' : '';

  const [internalQuery, setInternalQuery] = useState('');
  const [results, setResults] = useState<FoodSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<FoodCatalogSearchMeta>(defaultMeta);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const searchRequestIdRef = useRef(0);
  const lastGoodFatSecretRef = useRef<{ query: string; hits: FoodSearchHit[] } | null>(null);

  useEffect(() => {
    if (!isControlled) {
      loadRecentFoodQueries().then(setRecentQueries);
    }
  }, [isControlled]);

  const runSearch = useCallback(
    async (raw: string) => {
      const q = raw.trim();
      if (!enabled) return;
      if (!q) {
        setResults([]);
        setError(null);
        setLoading(false);
        setMeta(defaultMeta);
        return;
      }
      const requestId = ++searchRequestIdRef.current;
      setLoading(true);
      setError(null);
      try {
        const { hits, meta: nextMeta } = await searchFoodCatalog(q);
        if (requestId !== searchRequestIdRef.current) return;
        // Don't clobber a good FatSecret result with a later USDA fallback for the same query
        // (FatSecret IP allowlist often succeeds once then flaps).
        if (
          nextMeta.usedFallback &&
          lastGoodFatSecretRef.current?.query === q &&
          lastGoodFatSecretRef.current.hits.length > 0
        ) {
          setResults(lastGoodFatSecretRef.current.hits);
          setMeta({ source: 'fatsecret', usedFallback: false });
          return;
        }
        const ranked = rankFoodSearchResults(q, hits);
        setResults(ranked);
        setMeta(nextMeta);
        if (!nextMeta.usedFallback && ranked.length > 0) {
          lastGoodFatSecretRef.current = { query: q, hits: ranked };
        }
        if (ranked.length > 0) {
          await rememberFoodQuery(q);
          if (!isControlled) {
            setRecentQueries(await loadRecentFoodQueries());
          }
        }
      } catch (e) {
        if (requestId !== searchRequestIdRef.current) return;
        setResults([]);
        setMeta(defaultMeta);
        setError(e instanceof Error ? e.message : 'Search failed');
      } finally {
        if (requestId === searchRequestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [enabled, isControlled]
  );

  const debouncedSearch = useMemo(() => debounce((q: string) => void runSearch(q), 500), [runSearch]);

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

  useEffect(() => {
    if (!enabled) {
      debouncedSearch.cancel();
      setResults([]);
      setError(null);
      setLoading(false);
      setMeta(defaultMeta);
      if (!isControlled) setInternalQuery('');
      return;
    }

    if (!isControlled) return;

    const q = controlledQuery.trim();
    if (!q) {
      debouncedSearch.cancel();
      setResults([]);
      setError(null);
      setLoading(false);
      setMeta(defaultMeta);
      return;
    }
    debouncedSearch(q);
    return () => debouncedSearch.cancel();
  }, [enabled, isControlled, controlledQuery, debouncedSearch]);

  const setQuery = useCallback(
    (text: string) => {
      if (isControlled) return;
      setInternalQuery(text);
      const q = text.trim();
      if (!q) {
        debouncedSearch.cancel();
        setResults([]);
        setError(null);
        setLoading(false);
        setMeta(defaultMeta);
        return;
      }
      if (!enabled) return;
      debouncedSearch(q);
    },
    [debouncedSearch, enabled, isControlled]
  );

  const applyRecentQuery = useCallback(
    (q: string) => {
      if (isControlled) return;
      setInternalQuery(q);
      if (!enabled) return;
      debouncedSearch.cancel();
      void runSearch(q);
    },
    [debouncedSearch, enabled, isControlled, runSearch]
  );

  const query = isControlled ? controlledQuery : internalQuery;

  return {
    query,
    setQuery,
    results,
    loading,
    error,
    meta,
    recentQueries,
    refreshRecent: () => void loadRecentFoodQueries().then(setRecentQueries),
    applyRecentQuery,
  };
}
