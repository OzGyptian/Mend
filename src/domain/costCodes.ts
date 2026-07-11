export interface CostCodeLookupItem {
  id: string;
  code: string;
}

/**
 * Resolves a raw user-entered value (typed, pasted, or CSV-imported) to a
 * cost code's canonical doc id. Accepts the id itself, the code, or a
 * "CODE - NAME" formatted label (as shown in cost code pickers) and matches
 * on the code portion. Returns undefined if nothing resolves - callers
 * decide whether to fall back to the raw value or reject the input.
 */
export function resolveCostCodeId<T extends CostCodeLookupItem>(
  raw: string,
  costCodes: T[]
): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  const direct = costCodes.find((c) => c.id === trimmed || c.code === trimmed);
  if (direct) return direct.id;

  if (trimmed.includes(' - ')) {
    const codePart = trimmed.split(' - ')[0].trim();
    const parsed = costCodes.find((c) => c.id === codePart || c.code === codePart);
    if (parsed) return parsed.id;
  }

  return undefined;
}
