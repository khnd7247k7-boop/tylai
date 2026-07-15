/** Superset grouping helpers for custom workouts (build + execute). */

export type SupersetFields = {
  /** Shared id for exercises performed as one alternating group. */
  supersetId?: string;
  /** 0-based order within the group (A1, A2…). */
  supersetOrder?: number;
};

export function createSupersetId(): string {
  return `ss-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Letter label for group index: 0→A, 1→B, … */
export function supersetLetter(groupIndex: number): string {
  let n = Math.max(0, groupIndex);
  let s = '';
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

export function stripSupersetFields<T extends SupersetFields>(ex: T): T {
  const next = { ...ex };
  delete next.supersetId;
  delete next.supersetOrder;
  return next;
}

/** Contiguous indices sharing `supersetId` that include `startIndex`. */
export function getSupersetGroupIndices<T extends SupersetFields>(
  exercises: T[],
  startIndex: number
): number[] {
  const id = exercises[startIndex]?.supersetId;
  if (!id) return [startIndex];
  let first = startIndex;
  while (first > 0 && exercises[first - 1]?.supersetId === id) first -= 1;
  let last = startIndex;
  while (last < exercises.length - 1 && exercises[last + 1]?.supersetId === id) last += 1;
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}

/** Map exercise index → letter (A, B…) for each contiguous group. */
export function buildSupersetLetterMap<T extends SupersetFields>(
  exercises: T[]
): Map<number, string> {
  const map = new Map<number, string>();
  let groupCount = 0;
  let i = 0;
  while (i < exercises.length) {
    const id = exercises[i]?.supersetId;
    if (!id) {
      i += 1;
      continue;
    }
    const group = getSupersetGroupIndices(exercises, i);
    const letter = supersetLetter(groupCount);
    for (const idx of group) map.set(idx, letter);
    groupCount += 1;
    i = group[group.length - 1] + 1;
  }
  return map;
}

export function formatSupersetTag(
  letter: string | undefined,
  order: number | undefined
): string | null {
  if (!letter || order == null || order < 0) return null;
  return `${letter}${order + 1}`;
}

/**
 * Group selected exercise ids into one contiguous superset.
 * Members keep relative list order; block is placed at the first selected index.
 */
export function groupExercisesAsSuperset<T extends { id: string } & SupersetFields>(
  exercises: T[],
  selectedIds: string[]
): T[] {
  const idSet = new Set(selectedIds);
  if (idSet.size < 2) return exercises;

  const selected = exercises.filter((ex) => idSet.has(ex.id));
  if (selected.length < 2) return exercises;

  const firstSelectedIndex = exercises.findIndex((ex) => idSet.has(ex.id));
  const ssId = createSupersetId();
  const grouped = selected.map((ex, order) => ({
    ...ex,
    supersetId: ssId,
    supersetOrder: order,
  }));

  const remaining = exercises.filter((ex) => !idSet.has(ex.id));
  let selectedBefore = 0;
  for (let i = 0; i < firstSelectedIndex; i++) {
    if (idSet.has(exercises[i].id)) selectedBefore += 1;
  }
  const insertPos = firstSelectedIndex - selectedBefore;
  return [
    ...remaining.slice(0, insertPos),
    ...grouped,
    ...remaining.slice(insertPos),
  ];
}

export function cleanupSingletonSupersets<T extends SupersetFields>(exercises: T[]): T[] {
  const counts = new Map<string, number>();
  for (const ex of exercises) {
    if (!ex.supersetId) continue;
    counts.set(ex.supersetId, (counts.get(ex.supersetId) || 0) + 1);
  }
  return exercises.map((ex) => {
    if (!ex.supersetId) return ex;
    if ((counts.get(ex.supersetId) || 0) < 2) return stripSupersetFields(ex);
    return ex;
  });
}

/** Remove group fields from selected ids; clean leftover singles. */
export function ungroupExercises<T extends { id: string } & SupersetFields>(
  exercises: T[],
  selectedIds: string[]
): T[] {
  const idSet = new Set(selectedIds);
  const next = exercises.map((ex) =>
    idSet.has(ex.id) ? stripSupersetFields(ex) : ex
  );

  // Re-index remaining multi-member groups by walk order
  const renumberedIds = new Set<string>();
  for (const ex of next) {
    if (ex.supersetId) renumberedIds.add(ex.supersetId);
  }
  let result = next;
  for (const ssId of renumberedIds) {
    let order = 0;
    result = result.map((ex) =>
      ex.supersetId === ssId ? { ...ex, supersetOrder: order++ } : ex
    );
  }
  return cleanupSingletonSupersets(result);
}

/**
 * After drag-reorder, pull split group members back into contiguous blocks
 * (first occurrence anchors the block).
 */
export function normalizeSupersetContiguity<T extends { id: string } & SupersetFields>(
  exercises: T[]
): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (let i = 0; i < exercises.length; i++) {
    const ex = exercises[i];
    const id = ex.supersetId;
    if (!id) {
      result.push(ex);
      continue;
    }
    if (seen.has(id)) continue;
    seen.add(id);
    const ordered = exercises.filter((e) => e.supersetId === id);
    result.push(
      ...ordered.map((e, order) => ({
        ...e,
        supersetId: id,
        supersetOrder: order,
      }))
    );
  }
  return cleanupSingletonSupersets(result);
}

export type SupersetCursor = { exerciseIndex: number; setIndex: number };

type SetLike = { completed: boolean };

/**
 * Next set in round-robin order within a superset (or linear for solo exercises).
 */
export function findNextSupersetCursor<T extends SupersetFields>(
  exercises: T[],
  setLogs: Array<{ sets: SetLike[] }>,
  fromExerciseIndex: number,
  fromSetIndex: number
): SupersetCursor | null {
  const id = exercises[fromExerciseIndex]?.supersetId;
  if (!id) {
    const sets = setLogs[fromExerciseIndex]?.sets ?? [];
    if (fromSetIndex + 1 < sets.length) {
      return { exerciseIndex: fromExerciseIndex, setIndex: fromSetIndex + 1 };
    }
    for (let i = fromExerciseIndex + 1; i < exercises.length; i++) {
      const first = setLogs[i]?.sets?.findIndex((s) => !s.completed) ?? -1;
      if (first >= 0) return { exerciseIndex: i, setIndex: first };
      if ((setLogs[i]?.sets?.length ?? 0) === 0) {
        return { exerciseIndex: i, setIndex: 0 };
      }
    }
    return null;
  }

  const group = getSupersetGroupIndices(exercises, fromExerciseIndex);
  const units: SupersetCursor[] = [];
  const maxSets = Math.max(0, ...group.map((gi) => setLogs[gi]?.sets?.length ?? 0));
  for (let setIndex = 0; setIndex < maxSets; setIndex++) {
    for (const exerciseIndex of group) {
      if (setIndex < (setLogs[exerciseIndex]?.sets?.length ?? 0)) {
        units.push({ exerciseIndex, setIndex });
      }
    }
  }

  const completedPos = units.findIndex(
    (u) => u.exerciseIndex === fromExerciseIndex && u.setIndex === fromSetIndex
  );
  for (let i = completedPos + 1; i < units.length; i++) {
    const u = units[i];
    if (!setLogs[u.exerciseIndex]?.sets?.[u.setIndex]?.completed) {
      return u;
    }
  }

  const after = group[group.length - 1] + 1;
  for (let i = after; i < exercises.length; i++) {
    const first = setLogs[i]?.sets?.findIndex((s) => !s.completed) ?? -1;
    if (first >= 0) return { exerciseIndex: i, setIndex: first };
    if ((setLogs[i]?.sets?.length ?? 0) === 0) return { exerciseIndex: i, setIndex: 0 };
  }
  return null;
}

export function isSupersetGroupComplete(
  groupIndices: number[],
  setLogs: Array<{ sets: SetLike[] }>
): boolean {
  return groupIndices.every((gi) => (setLogs[gi]?.sets ?? []).every((s) => s.completed));
}
