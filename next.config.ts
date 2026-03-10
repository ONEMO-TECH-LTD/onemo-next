import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack(config, { isServer, webpack }) {
    if (isServer) {
      // scripts/*.mjs files are invoked via child_process.spawn() at runtime —
      // they are NOT webpack module imports. @vercel/nft static analysis traces
      // join(process.cwd(), 'scripts/build-tokens.mjs') as if it were a module
      // reference, causing:
      //   Module not found: Can't resolve './ROOT/scripts/build-tokens.mjs'
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
