# Errors

## Apple sanitizer suite appeared to hang

- ASan/UBSan binaries compiled successfully, but the full deterministic corpus produced no completion after repeated waits and had to be interrupted.
- `detect_leaks=1` is unsupported by this Apple sanitizer runtime.
- Release suites are the verified local gate. Sanitizers remain an explicit release gate and are not claimed as passing in `VALIDATION.md`.
- Next attempt: run a reduced sanitizer fixture binary first, then profile the full corpus before raising its timeout.
