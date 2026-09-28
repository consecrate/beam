import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Agent SDK spawns a bundled Claude Code binary and linkedom ships large
  // CommonJS internals; both must be loaded from node_modules, not bundled.
  serverExternalPackages: ["@anthropic-ai/claude-agent-sdk", "linkedom"],
};

export default nextConfig;
