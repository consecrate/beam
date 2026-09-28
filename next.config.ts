import type { NextConfig } from "next";

// End-to-end tests swap the Convex client for shims that talk to an in-memory
// backend (see e2e/). Never enabled in normal builds.
const e2e = process.env.BEAM_E2E === "1";

const nextConfig: NextConfig = {
  // The Agent SDK spawns a bundled Claude Code binary and linkedom ships large
  // CommonJS internals; both must be loaded from node_modules, not bundled.
  serverExternalPackages: ["@anthropic-ai/claude-agent-sdk", "linkedom"],
  ...(e2e && {
    distDir: ".next-e2e",
    turbopack: {
      resolveAlias: {
        "convex/react": "./e2e/shims/convex-react.tsx",
        "convex/browser": "./e2e/shims/convex-browser.ts",
      },
    },
  }),
};

export default nextConfig;
