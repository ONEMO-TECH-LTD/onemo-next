# `ui/` — the logic system's UI submodule

Dan, 2026-08-11: **"even necessary ui logic must be a submodule in the module of the logic system"**.

Law 1.1 allows the admin shell its own logic file "by necessity only". This is where that necessary
logic lives — inside the logic system, not scattered through the app directory.

**What belongs here:** logic a surface genuinely needs that is not the engine's — the camera, and
reading a picture in from another module. It is the logic sub's second job, verbatim: *"the rest of
the logic bridging the engine to any ui or other modules"* (law 1.1a).

**What does not:** anything computing the grid. Every such number comes from the engine through the
bridge — a span, a band, a magnet position. If a file in here multiplies a pitch or a padding, it is
in the wrong place.

**Portability (law 1.1a).** `engine.ts`, `spec.ts` and `bridge.ts` are what travels, and they import
nothing outward. This submodule is the adapter and may reach outward — `trace-cutout` calls the
Cutout Lab's tracer — which is exactly why it is separated from the three files that must not.
