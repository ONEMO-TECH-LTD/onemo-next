# Magnetic-Grid Candidate Enumerator — Complete Package

This archive contains two packages:

- `magnetic-grid-measurement-kernel/` — the accepted kernel v1.0.0, byte-for-byte unchanged, including its original 18-test golden suite and `SHA256SUMS` manifest.
- `enumerator/` — the neutral candidate enumerator v1.0.0, contract, source, compiled output, fixture, and tests.

From this directory:

```bash
npm run build
npm test
```

`npm test` verifies the complete-package checksum manifest, verifies the accepted kernel checksums, runs all 18 original kernel tests unchanged, runs the enumerator tests, and verifies both manifests again.

Public enumerator API:

```ts
enumerateCandidates(input)
serializeCanonical(value)
```

The exact candidate contract is in `enumerator/CONTRACT.md`.

Integrity manifest:

```bash
npm run verify:package
```
