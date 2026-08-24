export function groupKey(key: string): string {
  return key.replace(/\.(\d+)$/, "");
}

export type ConflictSlots = { days?: string[]; hours?: number[] };

export function conflicts(a: ConflictSlots, b: ConflictSlots): boolean {
  if (!a.days || !a.hours || !b.days || !b.hours) {
    return false;
  }
  for (let i = 0; i < a.days.length; i++) {
    for (let j = 0; j < b.days.length; j++) {
      if (a.days[i] === b.days[j] && a.hours[i] === b.hours[j]) {
        return true;
      }
    }
  }
  return false;
}

export type SolveResult =
  | { ok: true; schedule: string[] }
  | { ok: false; blockedOn: string };

export function solveConflictFree(
  selected: string[],
  data: Record<string, any>,
): SolveResult {
  // Group all data keys by their group key, preserving sorted data order.
  const groups: Record<string, string[]> = {};
  for (const k of Object.keys(data).sort()) {
    const g = groupKey(k);
    (groups[g] ??= []).push(k);
  }

  // Each selected key is one requirement; candidates are its group members.
  // Order follows the order of `selected` for determinism.
  const requirements = selected.map((key) => ({
    originalKey: key,
    candidates: groups[groupKey(key)] ?? [key],
  }));

  const schedule: string[] = [];
  let deepestFailedKey: string | null = null;
  let deepestFailedDepth = -1;

  function backtrack(index: number): boolean {
    if (index === requirements.length) {
      return true;
    }
    const req = requirements[index];
    for (const candidate of req.candidates) {
      const info = data[candidate];
      const clash = schedule.some((chosen) => conflicts(info, data[chosen]));
      if (!clash) {
        schedule.push(candidate);
        if (backtrack(index + 1)) {
          return true;
        }
        schedule.pop();
      }
    }
    if (deepestFailedDepth <= index) {
      deepestFailedDepth = index;
      deepestFailedKey = req.originalKey;
    }
    return false;
  }

  if (backtrack(0)) {
    return { ok: true, schedule };
  }
  return { ok: false, blockedOn: deepestFailedKey ?? selected[0] ?? "" };
}
