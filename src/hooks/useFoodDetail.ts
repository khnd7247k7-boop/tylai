import { useEffect, useState } from 'react';
import { getCatalogFoodDetails, type FoodCatalogSource } from '../api/foodCatalog';
import { isFatSecretFdcId } from '../api/fatsecret';
import type { Food } from '../types/fdcApi';
import { getCachedFoodDetail, rememberFoodDetail } from '../utils/fdcDetailCache';

export function useFoodDetail(
  fdcId: number | null,
  enabled: boolean,
  source?: FoodCatalogSource | null
) {
  const [food, setFood] = useState<Food | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || fdcId == null || !Number.isFinite(fdcId) || fdcId === 0) {
      setFood(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const resolvedSource: FoodCatalogSource =
      source ?? (isFatSecretFdcId(fdcId) ? 'fatsecret' : 'usda');

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const cached = await getCachedFoodDetail(fdcId);
        if (!cancelled && cached) {
          setFood(cached);
        }
        const fresh = await getCatalogFoodDetails(fdcId, resolvedSource);
        if (cancelled) return;
        setFood(fresh);
        setError(null);
        await rememberFoodDetail(fresh);
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : 'Could not load food';
        setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fdcId, enabled, source]);

  return { food, loading, error };
}
