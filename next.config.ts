import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This repository carries required webpack aliases below, so development and production must run
  // the same bundler. Allow the loopback hostname used by local browser probes to hydrate normally.
  // LAN IPs are allowed too so mobile devices on the same Wi-Fi can hydrate the dev probes.
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.*", "10.*"],
  outputFileTracingRoot: process.cwd(),
  // Vercel's deploy step rejects the agent-vendor dirs' symlinks ("is not a valid symlink") —
  // every preview on this project failed on it. They are not runtime code; keep them out of
  // every serverless function's traced output. The grid bench's asset-lib routes DO read
  // _WIP/v3.5 from disk at runtime, so those routes explicitly trace their libraries in.
  // `.next/lock` is a TRANSIENT build lock: it exists while `next build` runs and is gone by the
  // time Vercel deploys. The tracer recorded it as a dependency of the asset-lib [file] route
  // (whose dynamic path it cannot resolve statically, so it casts a very wide net), and the
  // deploy step then lstat'd a file that no longer existed — "ENOENT ... /.next/lock", which
  // failed every deployment. The build output itself is handled by the builder, never by the
  // dependency trace, so excluding the whole directory from tracing is safe.
  outputFileTracingExcludes: {
    "*": [".claude/**", ".codex/**", ".cursor/**", ".gemini/**", ".grok/**", ".agents/**", ".next/**", "_prototypes/**", "studio-v2/**"],
  },
  outputFileTracingIncludes: {
    "/effect-creator/grid-magnet/asset-lib": ["_WIP/v3.5/asset-lib/**", "_WIP/v3.5/cutouts/**"],
    "/effect-creator/grid-magnet/asset-lib/[file]": ["_WIP/v3.5/asset-lib/**", "_WIP/v3.5/cutouts/**"],
  },
  // Effect-creator G5: cross-origin isolation so onnxruntime-web's wasm fallback can run
  // MULTI-THREADED (SharedArrayBuffer needs COOP+COEP). Without these headers a device without
  // WebGPU falls back to SINGLE-threaded wasm — historically a 30–60 s page freeze per Magic run.
  // Scoped to the effect-creator dev routes so the rest of the app keeps loose embedding rules.
  async headers() {
    return [
      {
        source: "/effect-creator/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
      {
        // cutout-lab runs the same self-hosted onnxruntime WASM as the effect-creator routes —
        // same isolation headers (the proven mobile-Safari setup for these artifacts).
        source: "/cutout-lab",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
      {
        // A dedicated worker spawned from a crossOriginIsolated page is BLOCKED unless the worker
        // script's own response carries a compatible COEP — and the worker chunk is served from
        // /_next/*, outside the route rule above. COEP on a plain <script> chunk response is inert,
        // so this is safe for every other route; it only unblocks worker creation.
        source: "/_next/:path*",
        headers: [{ key: "Cross-Origin-Embedder-Policy", value: "require-corp" }],
      },
    ];
  },
  webpack(config, { isServer, webpack }) {
    // Creator v5 (DEC-v5-02): force ALL `paper` imports — ours (vector-core/paper-kernel) AND
    // paperjs-round-corners' internal one — to the HEADLESS core build. The default `paper`
    // (= paper-full) pulls dist/node/self.js + jsdom, which webpack can't bundle for the browser
    // (build break). paper-core is the same path math we use, with no DOM/node deps. `$` = exact
    // match, so the 'paper/dist/paper-core' specifier itself is untouched.
    config.resolve = config.resolve || {};
    config.resolve.alias = { ...(config.resolve.alias || {}), paper$: "paper/dist/paper-core" };
    // opencv.js (cutout-wand v2) is an Emscripten UMD that probes node's fs/path/crypto at runtime;
    // in the browser bundle those must resolve to empty stubs (standard Emscripten-on-webpack shim).
    if (!isServer) {
      config.resolve.fallback = { ...(config.resolve.fallback || {}), fs: false, path: false, crypto: false };
    }
    if (isServer) {
      // paper is CLIENT-ONLY: the editor + geometry kernel run in the browser, and the page SSRs to
      // null (open=false) without ever calling resolve()'s radius path. paper-core still STATICALLY
      // pulls node/self.js → jsdom/canvas, which aren't in the SSR/static-gen build — so stub paper to
      // an empty module server-side. The kernel's functions are only invoked client-side.
      config.resolve.alias["paper$"] = false;
      config.resolve.alias["paper/dist/paper-core$"] = false;
      // scripts/**/*.mjs files are invoked via child_process.spawn() at runtime —
      // they are NOT webpack module imports. @vercel/nft static analysis traces
      // join(process.cwd(), 'scripts/<name>.mjs') as if it were a module
      // reference, causing:
      //   Module not found: Can't resolve './ROOT/scripts/<name>.mjs'
      // IgnorePlugin prevents webpack from trying to resolve these paths.
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /scripts\/.*\.mjs$/,
        })
      );
    }
    return config;
  },
};

export default nextConfig;
