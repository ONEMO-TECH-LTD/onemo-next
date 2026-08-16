# Browser verification status

A browser smoke page and Playwright runner are included.

Execution in this container was blocked before page execution:

- Chromium navigation returned `ERR_BLOCKED_BY_ADMINISTRATOR` for both localhost and `file:` attempts.
- A WebKit executable was not installed.

Consequently:

- Node execution is verified;
- browser-oriented ESM/React source is built;
- browser runtime and physical-device performance are **not claimed as passed** in this delivery environment.

Run `python scripts/browser-smoke.py` in an environment that permits local navigation, then perform the benchmark page on representative iPhone/iPad Safari and Android Chrome hardware.
