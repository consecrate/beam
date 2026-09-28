"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { type ReactNode, useState } from "react";

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  const [client] = useState(() => (url ? new ConvexReactClient(url) : null));
  if (!client) return <SetupNeeded />;
  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}

function SetupNeeded() {
  return (
    <main className="page">
      <div className="card stack" style={{ maxWidth: 640, margin: "60px auto" }}>
        <h1>Almost there</h1>
        <p>
          Beam stores your library and vocabulary in Convex, and <code className="inline">NEXT_PUBLIC_CONVEX_URL</code> isn&apos;t set yet.
        </p>
        <p>
          Run <code className="inline">npm run dev</code>. The first run of <code className="inline">npx convex dev</code> sets up a
          deployment (a local one needs no account) and writes the URL to <code className="inline">.env.local</code>. Then reload this page.
        </p>
      </div>
    </main>
  );
}
