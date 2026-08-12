# Errors

## Apple sanitizer suite appeared to hang

- ASan/UBSan binaries compiled successfully, but the full deterministic corpus produced no completion after repeated waits and had to be interrupted.
- `detect_leaks=1` is unsupported by this Apple sanitizer runtime.
- Release suites are the verified local gate. Sanitizers remain an explicit release gate and are not claimed as passing in `VALIDATION.md`.
- Next attempt: run a reduced sanitizer fixture binary first, then profile the full corpus before raising its timeout.

## Sparse compatibility was used as an option gate

- The first all-options snapshot emitted only layouts that also satisfied the configured 96 mm sparse policy.
- That hid 64 lawful dense band-3 options on the square reference: 780 were returned instead of the independent dense oracle's 844.
- Sparse compatibility is now evidence only. Every lawful dense option remains present and carries `NotEngaged`, `Compatible`, or `Incompatible` plus its phase evidence.
- Permanent check: enabling or disabling sparse evaluation must leave dense option count, identity, and order unchanged.
