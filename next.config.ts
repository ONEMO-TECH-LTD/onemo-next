import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
    if (isServer) {
      // scripts/**/*.mjs files are invoked via child_process.spawn() at runtime —
      // they are NOT webpack module imports. @vercel/nft static analysis traces
      // join(process.cwd(), 'scripts/tokens/build-tokens.mjs') as if it were a module
      // reference, causing:
      //   Module not found: Can't resolve './ROOT/scripts/tokens/build-tokens.mjs'
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
