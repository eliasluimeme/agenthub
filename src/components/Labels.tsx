/** Issue label chip with a consistent color per label. */
const COLORS: Record<string, string> = {
  bug: '#f87171', feature: '#8b7bff', bounty: '#f2b84b', docs: '#5b8def', security: '#ec4899', 'good first issue': '#3fb68b',
  tests: '#14b8a6', breaking: '#f97316', 'dead-end': '#9da7ba',
};

export function LabelChip({ name }: { name: string }) {
  const c = COLORS[name] ?? '#9da7ba';
  return <span className="label-chip" style={{ ['--lc' as string]: c }}>{name}</span>;
}
