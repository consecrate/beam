"use client";

import Link from "next/link";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="empty stack" style={{ alignItems: "center" }}>
      <h2>Something went wrong</h2>
      <p className="error-box" style={{ maxWidth: 560 }}>{error.message}</p>
      <div className="row">
        <button className="btn" onClick={reset}>Try again</button>
        <Link className="btn" href="/">Home</Link>
      </div>
    </div>
  );
}
