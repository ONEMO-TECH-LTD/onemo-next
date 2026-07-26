# Automated engine device evidence

One command runs the current engine through local WebKit:

```bash
npm run perf:devices
```

The report is written to `output/playwright/device-performance/latest.json`. Every row separates
**cold** (fresh door-local worker/cache) from **warm** (exact cached revisit).

## Truth boundaries

- `webkit-iphone-13` is local WebKit correctness coverage and timing. It is not a physical iPhone.
- T1 reports exact JSON SHA-256 parity against the frozen Node baselines. T2 reports discrete product
  parity: rung list, anchors, rescues, flaps, pattern, pitch, and 0.05mm topology.
- A T1-only cross-runtime float difference is reported as `DIFF`; T2 or direct-vs-worker drift fails.
- Every row names the local engine/surface and reports cold and warm independently.

Set `DEVICE_PERF_PROFILE=<profile-id>` to debug one profile. A filtered run does not claim the
real-device launch verdict.

## CPU emulation: UNSUPPORTED

Chromium's `Emulation.setCPUThrottlingRate` is page-only. The engine runs in Web Workers, where CDP
returns `Operation is only supported for pages, not workers`. The Chromium implementation enforces
this through `InspectorEmulationAgent::AssertPage`:

<https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/renderer/core/inspector/inspector_emulation_agent.cc>

No OS-level throttle substitute is included. Local device-class CPU emulation is unsupported for
this architecture; a real-device cloud is the only launch-truth path.

## Generic scenario and cloud seams

Profiles and scenarios live in `suite.config.json`; the neutral runner contains no grid imports.
Feature fixtures implement the small browser contract:

```ts
window.__ONEMO_DEVICE_PERF__ = {
  status: 'READY',
  run(scenarioId, 'cold' | 'warm'): Promise<Result>,
}
```

That lets another route or build supply scenario data without forking the runner.

The provider-neutral L3 seam connects a future `playwright-websocket` profile to
`DEVICE_PERF_CLOUD_WS_ENDPOINT`. It fails loud when the endpoint is absent. No provider SDK, account,
credential handling, signup, or paid run is included; the adapter remains pending Dan's spend
approval.
