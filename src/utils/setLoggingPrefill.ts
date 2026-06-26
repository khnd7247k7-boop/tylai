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

/** After editing set N, mirror empty fields on set N+1 when still blank. */
export function cascadeStringSetFieldToNext(
  sets: Array<{ setNumber: number; weight: string; reps: string; completed?: boolean }>,
  setIndex: number,
  field: 'weight' | 'reps',
  value: string
): typeof sets {
  if (setIndex < 0 || setIndex >= sets.length - 1) return sets;
  const next = [...sets];
  const successor = { ...next[setIndex + 1] };
  if (field === 'weight' && successor.weight.trim() === '') {
    successor.weight = value;
  }
  if (field === 'reps' && successor.reps.trim() === '') {
    successor.reps = value;
  }
  next[setIndex + 1] = successor;
  return next;
}
