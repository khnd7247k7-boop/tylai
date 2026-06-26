import { useCallback } from 'react';
import type { View } from 'react-native';
import { registerTourTarget } from './tourTargetRegistry';

/** Registers a native view ref for spotlight measurement by tour target id. */
export function useTourTargetRef(targetId: string | undefined) {
  return useCallback(
    (node: View | null) => {
      if (targetId) registerTourTarget(targetId, node);
    },
    [targetId]
  );
}
