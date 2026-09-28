"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { useSettings } from "@/lib/client/useSettings";
import { LANGUAGES } from "@/lib/langs";

const LINKS = [
  { href: "/", label: "Home", icon: "⌂" },
  { href: "/library", label: "Library", icon: "📚" },
  { href: "/review", label: "Review", icon: "🔁" },
  { href: "/vocab", label: "Vocabulary", icon: "🗂" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

export function Nav() {
  const path = usePathname();
  const settings = useSettings();
  const now = useMinuteClock();
  const counts = useQuery(api.review.counts, { lang: settings.targetLang, now });
  const lang = LANGUAGES[settings.targetLang];

  return (
    <nav className="topnav">
      <Link href="/" className="brand">
        <span className="brand-mark">B</span>
        <span>Beam</span>
      </Link>
      {LINKS.map((l) => {
        const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} className={`navlink${active ? " active" : ""}`}>
            <span aria-hidden>{l.icon}</span>
            <span className="label">{l.label}</span>
            {l.href === "/review" && counts && counts.dueNow > 0 && <span className="badge">{counts.dueNow}</span>}
          </Link>
        );
      })}
      <div className="nav-spacer" />
      {lang && (
        <span className="lang-pill" title="Target language (change in Settings)">
          {lang.flag} {lang.name}
        </span>
      )}
    </nav>
  );
}

/** A timestamp that updates once a minute, so "due now" queries stay fresh without resubscribing constantly. */
export function useMinuteClock() {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 60_000) * 60_000);
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 60_000) * 60_000), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}
