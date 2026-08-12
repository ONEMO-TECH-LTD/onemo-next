# Selection — everything GPT Pro provided, verbatim

No file in this folder was written, edited, reformatted or summarised by an agent. Every byte is
GPT Pro's own output, copied. Provenance and verification below.

## 01-package — the delivered source package

The `magfit-reference` package exactly as GPT Pro delivered it. All 12 files verify against the
package's own `SOURCE_MANIFEST_SHA256.txt`:

    shasum -a 256 -c <(awk '{print $1"  "$2}' SOURCE_MANIFEST_SHA256.txt)   ->  12 OK

Contents: the C++20 exact-geometry core (`src/magfit.cpp`), the C/WebAssembly ABI
(`src/magfit_c.cpp`), both public headers, the acceptance tests, the C ABI tests, the benchmark,
the CMake build, the MIT licence, the normative engine contract, and GPT's validation record.

Built and run unmodified on this machine: C++ suite PASS, C ABI suite PASS, benchmark
1.665 ms hot / 4.328 ms cold on a 1,000-vertex polygon.

## 02-transcript-code — the code GPT wrote that never became a file

136 unique fenced blocks extracted from GPT's responses only (its own output, never a prompt
quoting it back), byte-for-byte between the fences: 26 TypeScript, 4 C++, 1 C, 1 shell, 104
specification/pseudocode blocks. `INDEX.txt` records source file, line number, language, line
count and SHA-256 for each, so any block can be traced to the exact place it was written.

## 03-specs — the normative documents

`MAGFIT_V2_CORRECTION_SPEC.md` and `MAGFIT_TEAM_REVIEW_VALIDATION.md` as delivered, with GPT's
own checksum file.

## 04-transcripts — the sources

The two full conversation exports the above was extracted from, unmodified.
