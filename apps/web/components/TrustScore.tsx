import type { TrustScore as TrustScoreType } from "@openeyes/shared";

const LEVEL_COLOR: Record<string, string> = {
  high: "var(--color-trust-high)",
  medium: "var(--color-trust-medium)",
  low: "var(--color-trust-low)",
};

/**
 * The explainable trust chain: a ring with the aggregate probability, plus the
 * weighted signal breakdown. Never just a number — always the evidence.
 */
export function TrustScore({ trust }: { trust: TrustScoreType }) {
  const pct = Math.round(trust.score * 100);
  const color = LEVEL_COLOR[trust.level] ?? "var(--color-mist)";

  return (
    <div className="border-edge bg-surface rounded-2xl border p-6">
      <div className="flex items-center gap-5">
        <div
          className="grid size-20 shrink-0 place-items-center rounded-full"
          style={{
            background: `conic-gradient(${color} ${pct * 3.6}deg, var(--color-edge) 0deg)`,
          }}
        >
          <div className="bg-surface grid size-15 place-items-center rounded-full">
            <span className="text-xl font-bold">{pct}%</span>
          </div>
        </div>
        <div>
          <div className="text-mist text-xs uppercase tracking-wide">
            Trust score
          </div>
          <div className="text-lg font-semibold capitalize" style={{ color }}>
            {trust.level} corroboration
          </div>
          <div className="text-mist text-xs">
            A probability, not a verdict.
          </div>
        </div>
      </div>

      <ul className="mt-6 space-y-3">
        {trust.signals.map((s) => (
          <li key={s.key}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{s.label}</span>
              <span className="text-mist">{Math.round(s.value * 100)}%</span>
            </div>
            <div className="bg-edge mt-1 h-1.5 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full"
                style={{ width: `${s.value * 100}%`, background: color }}
              />
            </div>
            <div className="text-mist mt-1 text-xs">{s.detail}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
