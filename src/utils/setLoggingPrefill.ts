/** Copy weight/reps from the prior set in the same exercise for faster logging. */

export function prefillNumericSetFromPrevious<
  T extends { weight: number; reps: number; completed: boolean },
>(sets: T[], targetIndex: number): T[] {
  if (targetIndex <= 0 || targetIndex >= sets.length) return sets;
  const prev = sets[targetIndex - 1];
  const target = sets[targetIndex];
  if (target.completed) return sets;
  const next = [...sets];
  next[targetIndex] = {
    ...target,
    weight: prev.weight,
    reps: prev.reps,
  };
  return next;
}

export function prefillStringSetFromPrevious(
  sets: Array<{ setNumber: number; weight: string; reps: string; completed?: boolean }>,
  targetIndex: number
): typeof sets {
  if (targetIndex <= 0 || targetIndex >= sets.length) return sets;
  const prev = sets[targetIndex - 1];
  const target = sets[targetIndex];
  const next = [...sets];
  next[targetIndex] = {
    ...target,
    weight: target.weight.trim() !== '' ? target.weight : prev.weight,
    reps: target.reps.trim() !== '' ? target.reps : prev.reps,
  };
  return next;
}

/**
 * After editing set N, copy the value onto following sets that are still blank
 * or that we already auto-filled (so typing "150" does not leave set 2 stuck on "1").
 * Stops at the first set the user clearly customized. Clearing set N does not wipe later sets.
 */
export function cascadeStringSetFieldToNext(
  sets: Array<{ setNumber: number; weight: string; reps: string; completed?: boolean }>,
  setIndex: number,
  field: 'weight' | 'reps',
  value: string
): typeof sets {
  if (setIndex < 0 || setIndex >= sets.length - 1) return sets;
  const next = [...sets];
  const trimmed = value.trim();
  if (trimmed === '') return next;
  for (let i = setIndex + 1; i < next.length; i++) {
    const successor = { ...next[i] };
    const current = successor[field].trim();
    const stillAutoFilled =
      current === '' || trimmed.startsWith(current) || current.startsWith(trimmed);
    if (!stillAutoFilled) break;
    successor[field] = value;
    next[i] = successor;
  }
  return next;
}

/** How many set rows to generate from a plan value like 3 or "4-6". */
export function resolveSetSlotCount(sets: unknown, fallback = 3): number {
  if (typeof sets === 'number' && Number.isFinite(sets) && sets > 0) {
    return Math.min(20, Math.floor(sets));
  }
  if (typeof sets === 'string') {
    const n = parseInt(sets.split(/[-–—]/)[0].trim(), 10);
    if (Number.isFinite(n) && n > 0) return Math.min(20, n);
  }
  return fallback;
}

export function plannedWeightInput(weight: unknown): string {
  if (weight == null || weight === '') return '';
  if (typeof weight === 'number') {
    return Number.isFinite(weight) && weight > 0 ? String(weight) : '';
  }
  const s = String(weight).trim();
  return s && s !== '0' ? s : '';
}

export function plannedRepsInput(ex: { reps?: unknown; repsPrescription?: unknown }): string {
  const raw = ex.repsPrescription ?? ex.reps;
  if (raw == null || raw === '') return '';
  const s = String(raw).trim();
  return s && s !== '0' ? s : '';
}
