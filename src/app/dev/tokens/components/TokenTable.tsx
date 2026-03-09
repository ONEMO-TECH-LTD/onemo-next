"use client";

import { useState, useMemo } from "react";
import type { Token } from "../types";

interface TokenTableProps {
  tokens: Token[];
  collections: string[];
  tiers: string[];
  categories: string[];
}

const TIER_COLORS: Record<string, string> = {
  primitive: "bg-blue-950 text-blue-300 border-blue-800",
  alias: "bg-purple-950 text-purple-300 border-purple-800",
  semantic: "bg-teal-950 text-teal-300 border-teal-800",
  "semantic-color": "bg-cyan-950 text-cyan-300 border-cyan-800",
  component: "bg-orange-950 text-orange-300 border-orange-800",
  effects: "bg-pink-950 text-pink-300 border-pink-800",
};

const CATEGORY_COLORS: Record<string, string> = {
  colors: "bg-rose-950 text-rose-300 border-rose-800",
  color: "bg-rose-950 text-rose-300 border-rose-800",
  spacing: "bg-amber-950 text-amber-300 border-amber-800",
  typography: "bg-lime-950 text-lime-300 border-lime-800",
  breakpoints: "bg-sky-950 text-sky-300 border-sky-800",
  radius: "bg-violet-950 text-violet-300 border-violet-800",
  dimensions: "bg-indigo-950 text-indigo-300 border-indigo-800",
  containers: "bg-fuchsia-950 text-fuchsia-300 border-fuchsia-800",
  width: "bg-emerald-950 text-emerald-300 border-emerald-800",
};

function Badge({
  value,
  colorMap,
}: {
  value: string;
  colorMap: Record<string, string>;
}) {
  const cls =
    colorMap[value] ?? "bg-zinc-800 text-zinc-300 border-zinc-700";
  return (
    <span
      className={`inline-block text-xs font-mono px-1.5 py-0.5 rounded border whitespace-nowrap ${cls}`}
    >
      {value}
    </span>
  );
}

// Detect if value looks like a color
function isColorValue(value: string): boolean {
  return (
    value.startsWith("oklch(") ||
    value.startsWith("rgb(") ||
    value.startsWith("#") ||
    value.startsWith("hsl(")
  );
}

function ColorSwatch({ value }: { value: string }) {
  // Only render swatch for non-alpha colors to avoid browser inconsistencies
  try {
    return (
      <span
        className="inline-block w-3 h-3 rounded-sm border border-zinc-600 flex-shrink-0 align-middle mr-1"
        style={{ backgroundColor: value }}
        title={value}
      />
    );
  } catch {
    return null;
  }
}

const PAGE_SIZE = 50;

export default function TokenTable({
  tokens,
  collections,
  tiers,
  categories,
}: TokenTableProps) {
  const [search, setSearch] = useState("");
  const [filterCollection, setFilterCollection] = useState("");
  const [filterTier, setFilterTier] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return tokens.filter((t) => {
      if (filterCollection && t.figmaCollection !== filterCollection) return false;
      if (filterTier && t.tier !== filterTier) return false;
      if (filterCategory && t.category !== filterCategory) return false;
      if (q) {
        const haystack = `${t.figmaPath} ${t.cssProperty}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [tokens, search, filterCollection, filterTier, filterCategory]);

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page on filter/search change
  const handleSearch = (v: string) => {
    setSearch(v);
    setPage(0);
  };
  const handleCollection = (v: string) => {
    setFilterCollection(v);
    setPage(0);
  };
  const handleTier = (v: string) => {
    setFilterTier(v);
    setPage(0);
  };
  const handleCategory = (v: string) => {
    setFilterCategory(v);
    setPage(0);
  };

  const selectCls =
    "bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-mono rounded px-2 py-1.5 focus:outline-none focus:border-indigo-500";

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          placeholder="Search path or property…"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-mono rounded px-3 py-1.5 focus:outline-none focus:border-indigo-500 min-w-48 flex-1"
        />
        <select
          value={filterCollection}
          onChange={(e) => handleCollection(e.target.value)}
          className={selectCls}
        >
          <option value="">All collections</option>
          {collections.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={filterTier}
          onChange={(e) => handleTier(e.target.value)}
          className={selectCls}
        >
          <option value="">All tiers</option>
          {tiers.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={filterCategory}
          onChange={(e) => handleCategory(e.target.value)}
          className={selectCls}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <span className="text-xs text-zinc-500 font-mono ml-auto">
          {filtered.length} of {tokens.length} tokens
        </span>
      </div>

      {/* Table */}
      <div className="rounded border border-zinc-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono border-collapse">
            <thead>
              <tr className="bg-zinc-800 border-b border-zinc-700">
                <th className="text-left px-3 py-2 text-zinc-400 font-semibold uppercase tracking-wide whitespace-nowrap">
                  Figma path
                </th>
                <th className="text-left px-3 py-2 text-zinc-400 font-semibold uppercase tracking-wide whitespace-nowrap">
                  CSS property
                </th>
                <th className="text-left px-3 py-2 text-zinc-400 font-semibold uppercase tracking-wide whitespace-nowrap">
                  Value
                </th>
                <th className="text-left px-3 py-2 text-zinc-400 font-semibold uppercase tracking-wide whitespace-nowrap">
                  Tier
                </th>
                <th className="text-left px-3 py-2 text-zinc-400 font-semibold uppercase tracking-wide whitespace-nowrap">
                  Category
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {paginated.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-8 text-center text-zinc-600"
                  >
                    No tokens match the current filters.
                  </td>
                </tr>
              ) : (
                paginated.map((token, idx) => {
                  const isColor = isColorValue(token.cssValue);
                  const truncatedValue =
                    token.cssValue.length > 48
                      ? token.cssValue.slice(0, 45) + "…"
                      : token.cssValue;
                  return (
                    <tr
                      key={`${token.figmaPath}:${token.cssProperty}`}
                      className="bg-zinc-900 hover:bg-zinc-800 transition-colors"
                    >
                      <td
                        className="px-3 py-2 text-zinc-300 max-w-56 truncate"
                        title={token.figmaPath}
                      >
                        {token.figmaPath}
                      </td>
                      <td
                        className="px-3 py-2 text-indigo-300 max-w-72 truncate"
                        title={token.cssProperty}
                      >
                        {token.cssProperty}
                      </td>
                      <td
                        className="px-3 py-2 text-zinc-400 max-w-48"
                        title={token.cssValue}
                      >
                        <div className="flex items-center gap-1">
                          {isColor && <ColorSwatch value={token.cssValue} />}
                          <span className="truncate">{truncatedValue}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <Badge value={token.tier} colorMap={TIER_COLORS} />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <Badge value={token.category} colorMap={CATEGORY_COLORS} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-between text-xs font-mono text-zinc-500">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 rounded border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            ← prev
          </button>
          <span>
            page {page + 1} of {pageCount}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={page >= pageCount - 1}
            className="px-3 py-1.5 rounded border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            next →
          </button>
        </div>
      )}
    </div>
  );
}
