import { useEffect, useState } from 'react';
import { getFoodDetails } from '../api/usda';
import type { Food } from '../types/fdcApi';
import { getCachedFoodDetail, rememberFoodDetail } from '../utils/fdcDetailCache';

export function useFoodDetail(fdcId: number | null, enabled: boolean) {
  const [food, setFood] = useState<Food | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || fdcId == null || !Number.isFinite(fdcId)) {
      setFood(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const cached = await getCachedFoodDetail(fdcId);
        if (!cancelled && cached) {
          setFood(cached);
        }
        const fresh = await getFoodDetails(fdcId);
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
  }, [fdcId, enabled]);

  return { food, loading, error };
}
