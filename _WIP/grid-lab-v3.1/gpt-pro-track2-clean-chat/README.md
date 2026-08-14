# Track 2 — the clean-chat GPT Pro delivery

`onemo-magnetic-engine-v1.0.0-source/`, copied byte-for-byte from Dan's Downloads
(`diff -rq` clean). **Not installed, not used** — preserved because Dan shared it and every GPT Pro
result belongs in the repo rather than in a Downloads folder or a `/tmp` scratch copy.

**What it is:** the complete three-layer engine GPT Pro produced from the *clean-chat* prompt
(@s62-pixel-grid-pixel's), in parallel with the forked chat that produced the installed Parts 1–3.
C++20 kernel and enumerator, a C ABI, a CLI, and a TypeScript layer with contracts, bridge, grammar
and product logic — ~3,900 lines across 24 files, with its own manifest.

**Why it is not installed:** its TypeScript suite passes here (4/4), but its C++ has a hard
`boost::multiprecision` dependency (`engine.hpp:3`, unconditional), so it was never built or
verified on this machine. Independent review also found it hardcodes bbox-centre anchoring, so it
cannot exercise O-1's centre switches, and its grammar carries only *adjacent* diagonal pairs, so
the pill's diagonal run is not expressible. The forked-chat stack was chosen on those findings.

It stays here as a reference and a fallback, unmodified.
