// Cards are ordered by a float `position`. To drop a card between two others
// we just take the midpoint, which means a move only ever touches one row.
//
// Floats eventually run out of precision if you keep inserting into the same
// gap (~50 times in a row), so rebalance() is there for when that happens.

const GAP = 1024

export function positionBetween(before?: number, after?: number): number {
  if (before === undefined && after === undefined) return GAP
  if (before === undefined) return after! - GAP
  if (after === undefined) return before + GAP
  return (before + after) / 2
}

export function needsRebalance(before?: number, after?: number): boolean {
  if (before === undefined || after === undefined) return false
  return Math.abs(after - before) < 1e-6
}

export function rebalance<T extends { id: string }>(ordered: T[]): { id: string; position: number }[] {
  return ordered.map((t, i) => ({ id: t.id, position: (i + 1) * GAP }))
}
