"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type {
  PipelineStage,
  StageStatus,
  BlueprintReport,
  BlueprintTokenResult,
  BlueprintViolation,
  SaveResult,
} from "../types";

// ─── Constants ────────────────────────────────────────────────────────────────

const INITIAL_STAGES: PipelineStage[] = [
  { id: "input", label: "INPUT", status: "pending" },
  { id: "validate", label: "VALIDATE", status: "pending" },
  { id: "generate", label: "GENERATE", status: "pending" },
  { id: "output", label: "OUTPUT", status: "pending" },
];

const OUTPUT_FILES = [
  { filename: "primitives.css", tab: "CSS Variables", label: "Primitives" },
  { filename: "semantic.css", tab: "Tailwind v4", label: "Semantic (@theme)" },
  { filename: "semantic-inline.css", tab: "Shopify Liquid", label: "Semantic inline (:root)" },
  { filename: "aliases.css", tab: "Next.js", label: "Aliases" },
];

// ─── Small UI helpers ─────────────────────────────────────────────────────────

function StatusDot({ status }: { status: StageStatus }) {
  const cls: Record<StageStatus, string> = {
    pending: "bg-zinc-600",
    running: "bg-amber-400 animate-pulse",
    pass: "bg-emerald-500",
    warn: "bg-amber-400",
    error: "bg-red-500",
    saved: "bg-indigo-400",
  };
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${cls[status]}`}
    />
  );
}

function StageLabel({ status }: { status: StageStatus }) {
  const map: Record<StageStatus, { text: string; cls: string }> = {
    pending: { text: "pending", cls: "text-zinc-600" },
    running: { text: "running…", cls: "text-amber-400" },
    pass: { text: "pass", cls: "text-emerald-400" },
    warn: { text: "warn", cls: "text-amber-400" },
    error: { text: "error", cls: "text-red-400" },
    saved: { text: "saved", cls: "text-indigo-400" },
  };
  const { text, cls } = map[status];
  return <span className={`text-xs font-mono ${cls}`}>{text}</span>;
}

function Btn({
  onClick,
  disabled,
  variant = "primary",
  children,
  className = "",
}: {
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "amber" | "ghost";
  children: React.ReactNode;
  className?: string;
}) {
  const base =
    "px-4 py-2 text-sm font-semibold rounded border transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
  const variants = {
    primary:
      "border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-500 hover:border-indigo-500",
    amber:
      "border-amber-600 bg-amber-950 text-amber-300 hover:bg-amber-900",
    ghost:
      "border-zinc-600 bg-zinc-800 text-zinc-200 hover:bg-zinc-700",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin w-4 h-4 text-amber-400 inline-block mr-2"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v8H4z"
      />
    </svg>
  );
}

// ─── Stepper ─────────────────────────────────────────────────────────────────

function Stepper({
  stages,
  activeId,
  onStageClick,
}: {
  stages: PipelineStage[];
  activeId: string;
  onStageClick: (id: PipelineStage["id"]) => void;
}) {
  return (
    <div className="flex items-center gap-0">
      {stages.map((stage, i) => (
        <div key={stage.id} className="flex items-center">
          <button
            type="button"
            onClick={() => onStageClick(stage.id)}
            className={`flex items-center gap-2 px-4 py-2.5 border rounded text-xs font-semibold uppercase tracking-wide transition-colors ${
              stage.id === activeId
                ? "border-indigo-500 bg-indigo-950 text-indigo-200"
                : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
            }`}
          >
            <StatusDot status={stage.status} />
            <span>{stage.label}</span>
            <StageLabel status={stage.status} />
            {stage.count !== undefined && stage.count > 0 && (
              <span className="px-1 py-0.5 rounded bg-red-900 text-red-300 text-xs font-mono">
                {stage.count}
              </span>
            )}
          </button>
          {i < stages.length - 1 && (
            <span className="mx-1 text-zinc-600 text-sm">→</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Stage 1: INPUT ───────────────────────────────────────────────────────────

interface FigmaCollectionInfo {
  name: string;
  tokenCount: number;
  modes: string[];
  tier: string;
}

function deriveCollectionTier(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("primitive")) return "primitive";
  if (lower.includes("alias")) return "alias";
  if (lower.includes("semantic")) return "semantic";
  if (lower.includes("component")) return "component";
  return "other";
}

function extractCollections(json: unknown[]): FigmaCollectionInfo[] {
  const collections: FigmaCollectionInfo[] = [];
  // Figma Variables Pro export: array of { collectionName: { modes: { modeName: {...} } } }
  for (const entry of json) {
    if (typeof entry !== "object" || entry === null) continue;
    const colName = Object.keys(entry as Record<string, unknown>)[0];
    if (!colName) continue;
    const colValue = (entry as Record<string, unknown>)[colName];
    if (typeof colValue !== "object" || colValue === null) continue;
    const colObj = colValue as { modes?: Record<string, unknown> };
    const modes = Object.keys(colObj.modes ?? {});
    let tokenCount = 0;
    function countTokens(obj: unknown): void {
      if (typeof obj !== "object" || obj === null) return;
      const o = obj as Record<string, unknown>;
      if ("$value" in o || "$type" in o) { tokenCount++; return; }
      for (const [k, v] of Object.entries(o)) {
        if (!k.startsWith("$")) countTokens(v);
      }
    }
    for (const modeVal of Object.values(colObj.modes ?? {})) {
      countTokens(modeVal);
    }
    collections.push({
      name: colName,
      tokenCount,
      modes,
      tier: deriveCollectionTier(colName),
    });
  }
  return collections;
}

function InputStage({
  onFileLoaded,
}: {
  onFileLoaded: (json: unknown, filename: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.name.endsWith(".json")) {
        setError("Only .json files are accepted");
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target?.result as string) as unknown;
          setError(null);
          onFileLoaded(json, file.name);
        } catch {
          setError("Failed to parse JSON — is this a valid Figma export?");
        }
      };
      reader.readAsText(file);
    },
    [onFileLoaded]
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors cursor-pointer ${
          dragging
            ? "border-indigo-400 bg-indigo-950/30"
            : "border-zinc-600 bg-zinc-900 hover:border-zinc-400"
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="text-4xl mb-3 text-zinc-500">⬆</div>
        <div className="text-zinc-300 text-sm font-semibold">
          Drop Figma Variables JSON here
        </div>
        <div className="text-zinc-500 text-xs mt-1">
          or click to browse
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleChange}
        />
      </div>
      {error && (
        <div className="text-sm text-red-400 font-mono bg-red-950/30 border border-red-700 rounded px-3 py-2">
          {error}
        </div>
      )}
    </div>
  );
}

function InputStageLoaded({
  filename,
  collections,
  totalTokens,
  onValidate,
}: {
  filename: string;
  collections: FigmaCollectionInfo[];
  totalTokens: number;
  onValidate: () => void;
}) {
  const tierColors: Record<string, string> = {
    primitive: "bg-blue-950 text-blue-300 border-blue-800",
    alias: "bg-purple-950 text-purple-300 border-purple-800",
    semantic: "bg-teal-950 text-teal-300 border-teal-800",
    component: "bg-orange-950 text-orange-300 border-orange-800",
    other: "bg-zinc-800 text-zinc-300 border-zinc-700",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-sm font-mono">
        <span className="text-emerald-400">✓</span>
        <span className="text-zinc-300 font-semibold">{filename}</span>
        <span className="text-zinc-500">
          {collections.length} collections, {totalTokens.toLocaleString()} total variables
        </span>
      </div>

      <div className="rounded border border-zinc-700 overflow-hidden">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="bg-zinc-800 border-b border-zinc-700">
              <th className="text-left px-3 py-2 text-zinc-400 font-semibold uppercase tracking-wide">Collection</th>
              <th className="text-right px-3 py-2 text-zinc-400 font-semibold uppercase tracking-wide">Tokens</th>
              <th className="text-left px-3 py-2 text-zinc-400 font-semibold uppercase tracking-wide">Modes</th>
              <th className="text-left px-3 py-2 text-zinc-400 font-semibold uppercase tracking-wide">Tier</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {collections.map((col) => (
              <tr key={col.name} className="bg-zinc-900 hover:bg-zinc-800 transition-colors">
                <td className="px-3 py-2 text-zinc-200">{col.name}</td>
                <td className="px-3 py-2 text-right text-zinc-300">{col.tokenCount.toLocaleString()}</td>
                <td className="px-3 py-2 text-zinc-400">{col.modes.join(", ")}</td>
                <td className="px-3 py-2">
                  <span className={`inline-block px-1.5 py-0.5 rounded border text-xs ${tierColors[col.tier] ?? tierColors.other}`}>
                    {col.tier}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <Btn onClick={onValidate} variant="primary">
          Validate →
        </Btn>
      </div>
    </div>
  );
}

// ─── Stage 2: VALIDATE ────────────────────────────────────────────────────────

type ValidateFilter = "all" | "error" | "warn" | "pass" | "info";

function ValidateStage({
  report,
  isRunning,
  onGenerate,
}: {
  report: BlueprintReport | null;
  isRunning: boolean;
  onGenerate: () => void;
}) {
  const [filter, setFilter] = useState<ValidateFilter>("all");
  const [selectedToken, setSelectedToken] = useState<BlueprintTokenResult | null>(null);

  if (isRunning) {
    return (
      <div className="flex items-center gap-3 text-zinc-400 py-8">
        <Spinner />
        <span className="text-sm">Running blueprint validator…</span>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="text-zinc-500 text-sm py-8 text-center">
        Upload and load a Figma JSON file first, then click Validate.
      </div>
    );
  }

  const { summary, results } = report;

  const filtered = results.filter((r) => {
    if (filter === "all") return true;
    return r.status === filter;
  });

  const statusConfig: Record<string, { badge: string; dot: string }> = {
    pass: { badge: "bg-emerald-950 text-emerald-300 border-emerald-700", dot: "bg-emerald-500" },
    warn: { badge: "bg-amber-950 text-amber-300 border-amber-700", dot: "bg-amber-400" },
    error: { badge: "bg-red-950 text-red-300 border-red-700", dot: "bg-red-500" },
    info: { badge: "bg-sky-950 text-sky-300 border-sky-700", dot: "bg-sky-400" },
  };

  const filterBtns: { id: ValidateFilter; label: string; count: number; cls: string }[] = [
    { id: "all", label: "All", count: summary.total, cls: "border-zinc-600 text-zinc-300" },
    { id: "error", label: "Errors", count: summary.error, cls: "border-red-700 text-red-300" },
    { id: "warn", label: "Warnings", count: summary.warn, cls: "border-amber-700 text-amber-300" },
    { id: "pass", label: "Passing", count: summary.pass, cls: "border-emerald-700 text-emerald-300" },
    { id: "info", label: "Info", count: summary.info, cls: "border-sky-700 text-sky-300" },
  ];

  const generateLabel =
    summary.error > 0
      ? `Generate (${summary.error} errors)`
      : "Generate →";

  return (
    <div className="space-y-4">
      {/* Summary badges */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-zinc-500 font-mono mr-1">
          {report.timestamp.slice(0, 16).replace("T", " ")} — {report.source}
        </span>
        <span className="text-xs font-mono text-red-300">
          {summary.error} errors
        </span>
        <span className="text-xs font-mono text-amber-300">
          {summary.warn} warnings
        </span>
        <span className="text-xs font-mono text-emerald-300">
          {summary.pass} passing
        </span>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {filterBtns.map((btn) => (
          <button
            key={btn.id}
            type="button"
            onClick={() => setFilter(btn.id)}
            className={`px-3 py-1 text-xs font-mono rounded border transition-colors ${
              filter === btn.id
                ? `${btn.cls} bg-zinc-800`
                : "border-zinc-700 text-zinc-500 hover:border-zinc-500"
            }`}
          >
            {btn.label} ({btn.count})
          </button>
        ))}
      </div>

      {/* Token results table */}
      <div className="rounded border border-zinc-700 overflow-hidden max-h-96 overflow-y-auto">
        <table className="w-full text-xs font-mono">
          <thead className="sticky top-0 z-10">
            <tr className="bg-zinc-800 border-b border-zinc-700">
              <th className="text-left px-3 py-2 text-zinc-400 font-semibold uppercase tracking-wide w-20">Status</th>
              <th className="text-left px-3 py-2 text-zinc-400 font-semibold uppercase tracking-wide w-36">Collection</th>
              <th className="text-left px-3 py-2 text-zinc-400 font-semibold uppercase tracking-wide">Token path</th>
              <th className="text-left px-3 py-2 text-zinc-400 font-semibold uppercase tracking-wide">Violation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-zinc-600">
                  No results for this filter.
                </td>
              </tr>
            )}
            {filtered.map((result, i) => {
              const cfg = statusConfig[result.status] ?? statusConfig.pass;
              const firstViolation = result.violations[0];
              return (
                <tr
                  key={`${result.collection}:${result.tokenPath}:${i}`}
                  className={`bg-zinc-900 cursor-pointer transition-colors ${
                    selectedToken === result ? "bg-zinc-800" : "hover:bg-zinc-800"
                  }`}
                  onClick={() =>
                    setSelectedToken(selectedToken === result ? null : result)
                  }
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                      <span className={`px-1 py-0.5 rounded border text-xs ${cfg.badge}`}>
                        {result.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-zinc-400 truncate max-w-36">{result.collection}</td>
                  <td className="px-3 py-2 text-zinc-200 truncate max-w-64">{result.tokenPath}</td>
                  <td className="px-3 py-2 text-zinc-400 truncate max-w-48">
                    {firstViolation?.description ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Detail panel for selected token */}
      {selectedToken && selectedToken.violations.length > 0 && (
        <ViolationDetailPanel token={selectedToken} onClose={() => setSelectedToken(null)} />
      )}

      {/* CTA */}
      <div className="flex justify-end">
        <Btn
          onClick={onGenerate}
          variant={summary.error > 0 ? "amber" : "primary"}
          className={summary.error > 0 ? "border-2 border-amber-500" : ""}
        >
          {generateLabel}
        </Btn>
      </div>
    </div>
  );
}

function ViolationDetailPanel({
  token,
  onClose,
}: {
  token: BlueprintTokenResult;
  onClose: () => void;
}) {
  const severityColors: Record<BlueprintViolation["severity"], string> = {
    error: "text-red-300",
    warn: "text-amber-300",
    info: "text-sky-300",
  };

  return (
    <div className="rounded border border-zinc-600 bg-zinc-900 p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-mono text-zinc-400">Token</div>
          <div className="text-sm font-mono text-zinc-100">{token.tokenPath}</div>
          <div className="text-xs font-mono text-zinc-500 mt-0.5">{token.collection}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-zinc-500 hover:text-zinc-300 text-sm ml-4"
        >
          ✕
        </button>
      </div>
      <div className="space-y-2">
        {token.violations.map((v, i) => (
          <div
            key={`${v.ruleId}-${i}`}
            className="rounded bg-zinc-950 border border-zinc-700 px-3 py-2 space-y-1"
          >
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold font-mono ${severityColors[v.severity]}`}>
                {v.severity.toUpperCase()}
              </span>
              <span className="text-xs font-mono text-zinc-500">{v.ruleId}</span>
            </div>
            <div className="text-xs text-zinc-300">{v.description}</div>
            {v.segment && (
              <div className="text-xs font-mono text-zinc-500">
                Segment:{" "}
                <span className="text-amber-300">
                  {v.segment}
                </span>{" "}
                (index {v.segmentIndex})
              </div>
            )}
            {v.suggestedFix && (
              <div className="text-xs text-emerald-400">
                Fix: {v.suggestedFix}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Stage 3: GENERATE ────────────────────────────────────────────────────────

interface LogLine {
  text: string;
  type: "stdout" | "stderr";
}

function GenerateStage({
  logLines,
  isRunning,
  exitCode,
  onViewOutput,
  onRetry,
}: {
  logLines: LogLine[];
  isRunning: boolean;
  exitCode: number | null;
  onViewOutput: () => void;
  onRetry: () => void;
}) {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logLines]);

  const lineColor = (type: LogLine["type"], text: string) => {
    if (type === "stderr" || text.toLowerCase().includes("error")) return "text-red-400";
    if (text.toLowerCase().includes("warn")) return "text-amber-300";
    return "text-zinc-300";
  };

  const success = exitCode === 0;

  return (
    <div className="space-y-4">
      {/* Log panel */}
      <div
        ref={logRef}
        className="h-72 overflow-y-auto rounded border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs space-y-0.5"
      >
        {logLines.length === 0 && (
          <div className="text-zinc-600">
            {isRunning ? "Starting build…" : "No output yet."}
          </div>
        )}
        {logLines.map((l, i) => (
          <div key={i} className={lineColor(l.type, l.text)}>
            {l.text}
          </div>
        ))}
        {isRunning && (
          <div className="text-amber-400 animate-pulse">
            <Spinner />running…
          </div>
        )}
      </div>

      {/* Status */}
      {!isRunning && exitCode !== null && (
        <div
          className={`text-sm font-semibold font-mono ${
            success ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {success ? "✓ Build complete" : "✗ Build failed (exit code " + exitCode + ")"}
        </div>
      )}

      {/* CTA */}
      <div className="flex justify-end gap-2">
        {!isRunning && exitCode !== null && !success && (
          <Btn onClick={onRetry} variant="ghost">
            Retry
          </Btn>
        )}
        {!isRunning && success && (
          <Btn onClick={onViewOutput} variant="primary">
            View Output →
          </Btn>
        )}
      </div>
    </div>
  );
}

// ─── Stage 4: OUTPUT ─────────────────────────────────────────────────────────

const OUTPUT_TABS = OUTPUT_FILES.map((f) => f.tab);

function OutputStage({
  validationErrorCount,
  onSave,
  isSaving,
  saveResults,
}: {
  validationErrorCount: number;
  onSave: (force: boolean) => void;
  isSaving: boolean;
  saveResults: SaveResult[] | null;
}) {
  const [activeTab, setActiveTab] = useState(OUTPUT_TABS[0]);
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  // Ref-based dedup guard: mutable, no re-render needed, safe to write inside effects
  const inflight = useRef<Set<string>>(new Set());
  const [loadingFile, setLoadingFile] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const activeFile =
    OUTPUT_FILES.find((f) => f.tab === activeTab) ?? OUTPUT_FILES[0];

  useEffect(() => {
    const fname = activeFile.filename;
    if (fileContents[fname] || inflight.current.has(fname)) return;
    inflight.current.add(fname);
    fetch(`/api/dev/output?file=${fname}`)
      .then((r) => r.json() as Promise<{ content?: string; error?: string }>)
      .then((data) => {
        if (data.content) {
          setFileContents((prev) => ({ ...prev, [fname]: data.content! }));
        }
        setLoadingFile(false);
      })
      .catch(() => { setLoadingFile(false); })
      .finally(() => { inflight.current.delete(fname); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFile.filename]);

  const content = fileContents[activeFile.filename];
  const isCurrentFileFetched = Boolean(content);
  const isCurrentFileInflight = inflight.current.has(activeFile.filename);

  useEffect(() => {
    if (!isCurrentFileFetched && isCurrentFileInflight) {
      setLoadingFile(true);
    }
  }, [isCurrentFileFetched, isCurrentFileInflight]);

  const handleSaveClick = () => {
    if (validationErrorCount > 0) {
      setShowConfirmModal(true);
    } else {
      onSave(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex border-b border-zinc-700">
        {OUTPUT_FILES.map((f) => (
          <button
            key={f.tab}
            type="button"
            onClick={() => setActiveTab(f.tab)}
            className={`px-4 py-2.5 text-xs font-semibold transition-colors border-b-2 -mb-px ${
              activeTab === f.tab
                ? "border-indigo-500 text-indigo-300"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {f.tab}
            <span className="ml-1.5 text-zinc-600 font-mono font-normal">
              {f.label}
            </span>
          </button>
        ))}
      </div>

      {/* Code block */}
      <div className="rounded border border-zinc-700 bg-zinc-950 h-80 overflow-auto">
        {loadingFile ? (
          <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
            <Spinner />
            Loading…
          </div>
        ) : content ? (
          <pre className="p-4 text-xs font-mono text-zinc-300 whitespace-pre leading-relaxed">
            {content}
          </pre>
        ) : (
          <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
            File not found — run Generate first.
          </div>
        )}
      </div>

      {/* Save section */}
      <div className="rounded border border-zinc-700 bg-zinc-900 p-4 space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Output Targets
        </div>
        <div className="text-xs font-mono text-zinc-500 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-indigo-300 w-28">onemo-next</span>
            <span>src/app/tokens/</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-indigo-300 w-28">onemo-theme</span>
            <span>../onemo-theme/assets/tokens/</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div>
            {validationErrorCount > 0 && (
              <span className="text-xs font-mono text-amber-300">
                ⚠ {validationErrorCount} naming errors detected
              </span>
            )}
          </div>
          <Btn
            onClick={handleSaveClick}
            disabled={isSaving}
            variant={validationErrorCount > 0 ? "amber" : "primary"}
          >
            {isSaving ? "Saving…" : "Save to all targets"}
          </Btn>
        </div>

        {/* Save results */}
        {saveResults && (
          <div className="space-y-3 pt-2 border-t border-zinc-700">
            {saveResults.map((r) => (
              <div key={r.name}>
                <div className="text-xs font-mono font-semibold text-zinc-300 mb-1">
                  {r.name}{" "}
                  <span className="text-zinc-600 font-normal">{r.path}</span>
                </div>
                <div className="space-y-0.5">
                  {r.files.map((f) => (
                    <div
                      key={f.filename}
                      className="flex items-center gap-2 text-xs font-mono"
                    >
                      <span
                        className={f.written ? "text-emerald-400" : "text-red-400"}
                      >
                        {f.written ? "✓" : "✗"}
                      </span>
                      <span className="text-zinc-300">{f.filename}</span>
                      <span className="text-zinc-600">
                        {f.written ? `${(f.bytes / 1024).toFixed(1)} KB` : "failed"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirm modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-zinc-900 border border-zinc-600 rounded-lg p-6 max-w-sm w-full mx-4 space-y-4">
            <div className="text-sm font-semibold text-amber-300">
              Save with errors?
            </div>
            <div className="text-sm text-zinc-300">
              {validationErrorCount} naming error
              {validationErrorCount !== 1 ? "s" : ""} detected. The generated
              files may not follow the ONEMO naming blueprint. Save anyway?
            </div>
            <div className="flex justify-end gap-2">
              <Btn
                onClick={() => setShowConfirmModal(false)}
                variant="ghost"
              >
                Cancel
              </Btn>
              <Btn
                onClick={() => {
                  setShowConfirmModal(false);
                  onSave(true);
                }}
                variant="amber"
              >
                Save anyway
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Root Dashboard ───────────────────────────────────────────────────────────

export default function DashboardV2() {
  const [stages, setStages] = useState<PipelineStage[]>(INITIAL_STAGES);
  const [activeStage, setActiveStage] = useState<PipelineStage["id"]>("input");

  // Input state
  const [loadedJson, setLoadedJson] = useState<unknown>(null);
  const [loadedFilename, setLoadedFilename] = useState<string>("");
  const [collections, setCollections] = useState<FigmaCollectionInfo[]>([]);
  const [totalTokens, setTotalTokens] = useState(0);

  // Validate state
  const [validateReport, setValidateReport] = useState<BlueprintReport | null>(null);
  const [validateRunning, setValidateRunning] = useState(false);

  // Generate state
  const [logLines, setLogLines] = useState<LogLine[]>([]);
  const [generateRunning, setGenerateRunning] = useState(false);
  const [generateExitCode, setGenerateExitCode] = useState<number | null>(null);

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [saveResults, setSaveResults] = useState<SaveResult[] | null>(null);

  const updateStage = useCallback(
    (id: PipelineStage["id"], patch: Partial<PipelineStage>) => {
      setStages((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
      );
    },
    []
  );

  // ── Input handlers ─────────────────────────────────────────────────────────

  const handleFileLoaded = useCallback(
    (json: unknown, filename: string) => {
      setLoadedJson(json);
      setLoadedFilename(filename);
      const cols = extractCollections(json as unknown[]);
      setCollections(cols);
      const total = cols.reduce((sum, c) => sum + c.tokenCount, 0);
      setTotalTokens(total);
      updateStage("input", { status: "pass" });
    },
    [updateStage]
  );

  // ── Validate handlers ──────────────────────────────────────────────────────

  const runValidate = useCallback(async () => {
    if (!loadedJson) return;
    setValidateRunning(true);
    setActiveStage("validate");
    updateStage("validate", { status: "running" });

    try {
      const res = await fetch("/api/dev/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ figmaJson: loadedJson }),
      });
      const data = (await res.json()) as BlueprintReport & { error?: string };
      if (!res.ok || data.error) {
        updateStage("validate", { status: "error" });
      } else {
        setValidateReport(data);
        const errCount = data.summary.error;
        updateStage("validate", {
          status: errCount > 0 ? "error" : "pass",
          count: errCount + data.summary.warn,
        });
      }
    } catch {
      updateStage("validate", { status: "error" });
    } finally {
      setValidateRunning(false);
    }
  }, [loadedJson, updateStage]);

  // ── Generate handlers ──────────────────────────────────────────────────────

  const runGenerate = useCallback(() => {
    setLogLines([]);
    setGenerateExitCode(null);
    setGenerateRunning(true);
    setActiveStage("generate");
    updateStage("generate", { status: "running" });

    const es = new EventSource("/api/dev/generate");

    es.onmessage = (e: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(e.data) as
          | { line: string; type: "stdout" | "stderr" }
          | { done: true; exitCode: number };

        if ("done" in payload) {
          es.close();
          setGenerateRunning(false);
          setGenerateExitCode(payload.exitCode);
          updateStage("generate", {
            status: payload.exitCode === 0 ? "pass" : "error",
          });
          if (payload.exitCode === 0) {
            updateStage("output", { status: "pass" });
          }
        } else {
          setLogLines((prev) => [
            ...prev,
            { text: payload.line, type: payload.type },
          ]);
        }
      } catch {
        // malformed SSE line
      }
    };

    es.onerror = () => {
      es.close();
      setGenerateRunning(false);
      setGenerateExitCode(1);
      updateStage("generate", { status: "error" });
    };
  }, [updateStage]);

  // ── Save handlers ──────────────────────────────────────────────────────────

  const runSave = useCallback(
    async (force: boolean) => {
      setIsSaving(true);
      setSaveResults(null);
      try {
        const res = await fetch("/api/dev/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ force }),
        });
        const data = (await res.json()) as
          | { results: SaveResult[] }
          | { error: string };
        if ("results" in data) {
          setSaveResults(data.results);
          updateStage("output", { status: "saved" });
        }
      } catch {
        // save failed silently
      } finally {
        setIsSaving(false);
      }
    },
    [updateStage]
  );

  // ── Stage navigation ───────────────────────────────────────────────────────

  const handleStageClick = (id: PipelineStage["id"]) => {
    setActiveStage(id);
  };

  const validationErrorCount = validateReport?.summary.error ?? 0;

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
              <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-800">
                v2
              </span>
            </div>
            <p className="text-xs text-zinc-500 font-mono mt-0.5">
              /dev/tokens — design token pipeline: validate → generate → save
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-6 py-8 space-y-6">
        {/* Stepper */}
        <Stepper
          stages={stages}
          activeId={activeStage}
          onStageClick={handleStageClick}
        />

        {/* Active stage content */}
        <div className="rounded border border-zinc-800 bg-zinc-900 p-6">
          {activeStage === "input" && (
            <>
              <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-400 mb-4">
                Stage 1 — Input
              </h2>
              {loadedJson ? (
                <InputStageLoaded
                  filename={loadedFilename}
                  collections={collections}
                  totalTokens={totalTokens}
                  onValidate={runValidate}
                />
              ) : (
                <InputStage onFileLoaded={handleFileLoaded} />
              )}
            </>
          )}

          {activeStage === "validate" && (
            <>
              <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-400 mb-4">
                Stage 2 — Validate
              </h2>
              <ValidateStage
                report={validateReport}
                isRunning={validateRunning}
                onGenerate={runGenerate}
              />
            </>
          )}

          {activeStage === "generate" && (
            <>
              <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-400 mb-4">
                Stage 3 — Generate
              </h2>
              <GenerateStage
                logLines={logLines}
                isRunning={generateRunning}
                exitCode={generateExitCode}
                onViewOutput={() => setActiveStage("output")}
                onRetry={runGenerate}
              />
            </>
          )}

          {activeStage === "output" && (
            <>
              <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-400 mb-4">
                Stage 4 — Output
              </h2>
              <OutputStage
                validationErrorCount={validationErrorCount}
                onSave={runSave}
                isSaving={isSaving}
                saveResults={saveResults}
              />
            </>
          )}
        </div>
      </main>

      <footer className="border-t border-zinc-800 px-6 py-4 mt-8">
        <div className="max-w-screen-xl mx-auto text-xs font-mono text-zinc-600 text-center">
          Not available in production — NODE_ENV={process.env.NODE_ENV ?? "development"}
        </div>
      </footer>
    </div>
  );
}
