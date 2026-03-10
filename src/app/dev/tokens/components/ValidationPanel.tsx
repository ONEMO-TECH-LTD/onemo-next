"use client";

import { useState } from "react";
import type { ValidationReport } from "../types";

interface ValidationPanelProps {
  validation: ValidationReport;
}

const STATUS_CONFIG = {
  pass: {
    label: "PASS",
    dot: "bg-emerald-500",
    badge: "bg-emerald-950 text-emerald-300 border-emerald-700",
    row: "hover:bg-emerald-950/30",
  },
  fail: {
    label: "FAIL",
    dot: "bg-red-500",
    badge: "bg-red-950 text-red-300 border-red-700",
    row: "hover:bg-red-950/30",
  },
  warn: {
    label: "WARN",
    dot: "bg-yellow-500",
    badge: "bg-yellow-950 text-yellow-300 border-yellow-700",
    row: "hover:bg-yellow-950/30",
  },
} as const;

const CATEGORY_ORDER = ["input", "mapping", "output"] as const;

export default function ValidationPanel({ validation }: ValidationPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const grouped = CATEGORY_ORDER.reduce<
    Record<string, typeof validation.checks>
  >((acc, cat) => {
    acc[cat] = validation.checks.filter((c) => c.category === cat);
    return acc;
  }, {});

  const toggle = (id: string) =>
    setExpanded((prev) => (prev === id ? null : id));

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-zinc-500 font-mono">
          Source: {validation.source} &mdash;{" "}
          {validation.timestamp.slice(0, 16).replace("T", " ")}
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-emerald-400">{validation.summary.pass} pass</span>
          {validation.summary.warn > 0 && (
            <span className="text-yellow-400">{validation.summary.warn} warn</span>
          )}
          {validation.summary.fail > 0 && (
            <span className="text-red-400">{validation.summary.fail} fail</span>
          )}
        </div>
      </div>

      {CATEGORY_ORDER.map((cat) => {
        const checks = grouped[cat];
        if (!checks || checks.length === 0) return null;
        return (
          <div key={cat} className="mb-4">
            <div className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-2 px-1">
              {cat}
            </div>
            <div className="rounded border border-zinc-700 divide-y divide-zinc-800 overflow-hidden">
              {checks.map((check) => {
                const cfg = STATUS_CONFIG[check.status] ?? STATUS_CONFIG.pass;
                const isOpen = expanded === check.id;
                return (
                  <div key={check.id}>
                    <button
                      type="button"
                      onClick={() => toggle(check.id)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left bg-zinc-900 ${cfg.row} transition-colors`}
                    >
                      <span
                        className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`}
                      />
                      <span className="font-mono text-sm text-zinc-200 flex-1 truncate">
                        {check.id}
                      </span>
                      <span
                        className={`text-xs font-bold px-1.5 py-0.5 rounded border font-mono ${cfg.badge}`}
                      >
                        {cfg.label}
                      </span>
                      <span className="text-zinc-600 text-xs ml-1">
                        {isOpen ? "▲" : "▼"}
                      </span>
                    </button>
                    {isOpen && (
                      <div className="bg-zinc-950 px-4 py-3 border-t border-zinc-800">
                        {check.details.map((d, i) => (
                          <div
                            key={i}
                            className="text-xs font-mono text-zinc-400 py-0.5 leading-relaxed"
                          >
                            {d}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
