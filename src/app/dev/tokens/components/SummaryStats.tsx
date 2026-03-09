import type { TokenMapping, ValidationReport } from "../types";

interface SummaryStatsProps {
  mapping: TokenMapping;
  validation: ValidationReport;
}

function StatCard({
  label,
  value,
  variant,
}: {
  label: string;
  value: string | number;
  variant?: "default" | "green" | "red" | "yellow";
}) {
  const variantClass =
    variant === "green"
      ? "border-emerald-700 bg-emerald-950 text-emerald-300"
      : variant === "red"
        ? "border-red-700 bg-red-950 text-red-300"
        : variant === "yellow"
          ? "border-yellow-700 bg-yellow-950 text-yellow-300"
          : "border-zinc-700 bg-zinc-800 text-zinc-100";

  return (
    <div className={`rounded border px-4 py-3 ${variantClass}`}>
      <div className="text-2xl font-bold font-mono">{value}</div>
      <div className="text-xs mt-1 opacity-70 uppercase tracking-wide">
        {label}
      </div>
    </div>
  );
}

export default function SummaryStats({ mapping, validation }: SummaryStatsProps) {
  const tokens = mapping.tokens;
  const total = mapping.totalTokens;

  // Pass rate from validation
  const passRate =
    validation.summary.total > 0
      ? Math.round((validation.summary.pass / validation.summary.total) * 100)
      : 0;

  // Category breakdown
  const byCategory = tokens.reduce<Record<string, number>>((acc, t) => {
    const cat = t.category ?? "unknown";
    acc[cat] = (acc[cat] ?? 0) + 1;
    return acc;
  }, {});

  // Tier breakdown
  const byTier = tokens.reduce<Record<string, number>>((acc, t) => {
    const tier = t.tier ?? "unknown";
    acc[tier] = (acc[tier] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total tokens" value={total} />
        <StatCard
          label="Pass rate"
          value={`${passRate}%`}
          variant={passRate === 100 ? "green" : passRate >= 80 ? "yellow" : "red"}
        />
        <StatCard
          label="Checks passed"
          value={`${validation.summary.pass} / ${validation.summary.total}`}
          variant={validation.summary.fail === 0 ? "green" : "red"}
        />
        <StatCard
          label="Violations"
          value={validation.summary.fail + validation.summary.warn}
          variant={
            validation.summary.fail > 0
              ? "red"
              : validation.summary.warn > 0
                ? "yellow"
                : "green"
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* By category */}
        <div className="rounded border border-zinc-700 bg-zinc-900 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-3">
            Tokens by category
          </div>
          <div className="space-y-1">
            {Object.entries(byCategory)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, count]) => (
                <div key={cat} className="flex items-center gap-2">
                  <div className="text-xs font-mono text-zinc-300 w-28 truncate">
                    {cat}
                  </div>
                  <div className="flex-1 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full"
                      style={{ width: `${Math.round((count / total) * 100)}%` }}
                    />
                  </div>
                  <div className="text-xs font-mono text-zinc-400 w-8 text-right">
                    {count}
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* By tier */}
        <div className="rounded border border-zinc-700 bg-zinc-900 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-3">
            Tokens by tier
          </div>
          <div className="space-y-1">
            {Object.entries(byTier)
              .sort((a, b) => b[1] - a[1])
              .map(([tier, count]) => (
                <div key={tier} className="flex items-center gap-2">
                  <div className="text-xs font-mono text-zinc-300 w-28 truncate">
                    {tier}
                  </div>
                  <div className="flex-1 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-violet-500 rounded-full"
                      style={{ width: `${Math.round((count / total) * 100)}%` }}
                    />
                  </div>
                  <div className="text-xs font-mono text-zinc-400 w-8 text-right">
                    {count}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
