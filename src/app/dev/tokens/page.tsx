import { readFileSync } from "fs";
import path from "path";
import type { TokenMapping, ValidationReport } from "./types";
import SummaryStats from "./components/SummaryStats";
import TokenTable from "./components/TokenTable";
import ValidationPanel from "./components/ValidationPanel";

function loadData(): { mapping: TokenMapping; validation: ValidationReport } {
  const mappingPath = path.join(process.cwd(), "scripts", "token-mapping.json");
  const validationPath = path.join(
    process.cwd(),
    "src",
    "app",
    "tokens",
    "validation-report.json"
  );

  const mapping: TokenMapping = JSON.parse(readFileSync(mappingPath, "utf-8"));
  const validation: ValidationReport = JSON.parse(
    readFileSync(validationPath, "utf-8")
  );

  return { mapping, validation };
}

export default function DevTokensPage() {
  const { mapping, validation } = loadData();

  const tokens = mapping.tokens;

  // Deduplicated, sorted filter options
  const collections = [...new Set(tokens.map((t) => t.figmaCollection))].sort();
  const tiers = [...new Set(tokens.map((t) => t.tier))].sort();
  const categories = [...new Set(tokens.map((t) => t.category))].sort();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900 px-6 py-4">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-700 uppercase tracking-wide font-bold">
                dev only
              </span>
              <h1 className="text-lg font-semibold text-zinc-100">
                Token Pipeline Dashboard
              </h1>
            </div>
            <p className="text-xs text-zinc-500 font-mono mt-0.5">
              /dev/tokens &mdash; design token mapping &amp; validation
            </p>
          </div>
          <div className="text-right text-xs font-mono text-zinc-600">
            <div>mapping: {new Date(mapping.generated).toLocaleString()}</div>
            <div>
              validation: {new Date(validation.timestamp).toLocaleString()}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-6 py-8 space-y-10">
        {/* Summary */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-400 mb-4">
            Summary
          </h2>
          <SummaryStats mapping={mapping} validation={validation} />
        </section>

        {/* Token table */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-400 mb-4">
            Token mapping
          </h2>
          <TokenTable
            tokens={tokens}
            collections={collections}
            tiers={tiers}
            categories={categories}
          />
        </section>

        {/* Validation */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-400 mb-4">
            Validation checks
          </h2>
          <ValidationPanel validation={validation} />
        </section>
      </main>

      <footer className="border-t border-zinc-800 px-6 py-4 mt-8">
        <div className="max-w-screen-xl mx-auto text-xs font-mono text-zinc-600 text-center">
          Not available in production &mdash; NODE_ENV={process.env.NODE_ENV}
        </div>
      </footer>
    </div>
  );
}
