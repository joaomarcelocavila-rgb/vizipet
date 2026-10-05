export function toNumber(value: { toNumber(): number } | number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'object' ? value.toNumber() : Number(value);
}
