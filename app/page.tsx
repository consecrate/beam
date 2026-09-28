"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import { useSettings } from "@/lib/client/useSettings";
import { addDays, today } from "@/lib/client/date";
import { estimateLevel, languageName } from "@/lib/langs";
import { useMinuteClock } from "@/components/Nav";

function greeting() {
  const h = new Date().getHours();
  return h < 11 ? "Guten Morgen" : h < 18 ? "Guten Tag" : "Guten Abend";
}

export default function Home() {
  const settings = useSettings();
  const lang = settings.targetLang;
  const date = today();
  const now = useMinuteClock();
  const stats = useQuery(api.stats.dashboard, { lang, today: date });
  const due = useQuery(api.review.counts, { lang, now });
  const recent = useQuery(api.lessons.recent, { lang, limit: 4 });

  const goal = settings.dailyGoal;
  const done = stats?.today.lingqsCreated ?? 0;
  const lvl = estimateLevel(stats?.known ?? 0);
  const continueLesson = recent?.find((l) => !l.completedAt) ?? recent?.[0];

  return (
    <>
      <div className="row wrap" style={{ justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1>{greeting()}! 👋</h1>
          <p className="muted">Learning {languageName(lang)} by reading.</p>
        </div>
        {stats && stats.streak > 0 && (
          <div className="chip" style={{ fontSize: 15, padding: "6px 14px" }} title="Days in a row with reading or reviews">
            🔥 {stats.streak}-day streak
          </div>
        )}
      </div>

      <div className="hero">
        <div className="card ring-wrap">
          <GoalRing value={done} goal={goal} />
          <div className="stack" style={{ gap: 8 }}>
            <h2>Today</h2>
            <p className="muted">
              {done >= goal ? "Daily goal reached. Schön!" : `${goal - done} more LingQs to reach your daily goal.`}
            </p>
            <p className="small muted">
              {stats?.today.knownAdded ?? 0} new known words · {stats?.today.wordsRead ?? 0} words read · {stats?.today.reviews ?? 0} reviews · {stats?.today.minutes ?? 0} min
            </p>
            <div className="row wrap">
              {continueLesson ? (
                <Link className="btn primary" href={`/read/${continueLesson._id}`}>▶ Continue reading</Link>
              ) : (
                <Link className="btn primary" href="/library">Start reading</Link>
              )}
              <Link className="btn" href="/review">
                🔁 Review{due && due.dueNow > 0 ? ` (${due.dueNow})` : ""}
              </Link>
            </div>
          </div>
        </div>

        <div className="card stack" style={{ gap: 8 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="muted small">Known words</span>
            <span className="chip level" title="Rough estimate from known word forms">≈ {lvl.level}</span>
          </div>
          <div style={{ fontSize: "2.6rem", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1 }}>{(stats?.known ?? 0).toLocaleString()}</div>
          {lvl.next && (
            <>
              <div className="progress"><div style={{ width: `${Math.round(lvl.progress * 100)}%` }} /></div>
              <p className="small muted">{(lvl.nextAt! - (stats?.known ?? 0)).toLocaleString()} more to reach ≈ {lvl.next}</p>
            </>
          )}
        </div>
      </div>

      <div className="stat-grid" style={{ marginTop: 16 }}>
        <Stat label="LingQs (learning)" value={stats?.learning} />
        <Stat label="Words read" value={stats?.totals.wordsRead} />
        <Stat label="Lessons completed" value={stats?.totals.lessonsCompleted} />
        <Stat label="Reading time" value={stats ? `${Math.round(stats.totals.minutes / 6) / 10} h` : undefined} />
      </div>

      <div className="section-head">
        <h2>Known words, last 90 days</h2>
      </div>
      <div className="card">{stats ? <KnownChart history={stats.history} known={stats.known} today={date} /> : <div className="skeleton" style={{ height: 180 }} />}</div>

      <div className="section-head">
        <h2>Activity</h2>
        <span className="small muted">Last 6 months</span>
      </div>
      <div className="card">{stats ? <Heatmap history={stats.history} today={date} /> : <div className="skeleton" style={{ height: 90 }} />}</div>

      {recent && recent.length > 0 && (
        <>
          <div className="section-head">
            <h2>Recently read</h2>
            <Link href="/library" className="small muted">Library →</Link>
          </div>
          <div className="lesson-grid">
            {recent.map((l) => (
              <Link key={l._id} href={`/read/${l._id}`} className="lesson-card">
                <div className="row">
                  {l.level && <span className="chip level">{l.level}</span>}
                  {l.completedAt && <span className="chip good">✓ Done</span>}
                </div>
                <h3>{l.title}</h3>
                <span className="small muted">{l.wordCount} words{l.pageCount ? ` · page ${Math.min(l.progressPage + 1, l.pageCount)}/${l.pageCount}` : ""}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number | string | undefined }) {
  return (
    <div className="stat">
      <div className="value">{value === undefined ? "–" : typeof value === "number" ? value.toLocaleString() : value}</div>
      <div className="label">{label}</div>
    </div>
  );
}

function GoalRing({ value, goal }: { value: number; goal: number }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, goal ? value / goal : 0);
  return (
    <svg width="112" height="112" viewBox="0 0 112 112" role="img" aria-label={`${value} of ${goal} LingQs today`} style={{ flex: "none" }}>
      <circle cx="56" cy="56" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="10" />
      <circle cx="56" cy="56" r={r} fill="none" stroke={pct >= 1 ? "var(--good)" : "var(--accent)"} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} transform="rotate(-90 56 56)" />
      <text x="56" y="54" textAnchor="middle" fontSize="24" fontWeight="800" fill="var(--text)">{value}</text>
      <text x="56" y="72" textAnchor="middle" fontSize="12" fill="var(--muted)">/ {goal} LingQs</text>
    </svg>
  );
}

type Day = { date: string; knownAdded: number; lingqsCreated: number; wordsRead: number; reviews: number; minutes: number };

function KnownChart({ history, known, today: t }: { history: Day[]; known: number; today: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const points = useMemo(() => {
    const by = new Map(history.map((d) => [d.date, d.knownAdded]));
    // Walk backwards from today's total, so the line ends at the real count.
    const out: { date: string; value: number }[] = [];
    let v = known;
    for (let i = 0; i < 90; i++) {
      const d = addDays(t, -i);
      out.push({ date: d, value: v });
      v = Math.max(0, v - (by.get(d) ?? 0));
    }
    return out.reverse();
  }, [history, known, t]);

  const W = 720, H = 180, P = { l: 44, r: 12, t: 12, b: 24 };
  const max = Math.max(10, ...points.map((p) => p.value));
  const x = (i: number) => P.l + (i / (points.length - 1)) * (W - P.l - P.r);
  const y = (v: number) => P.t + (1 - v / max) * (H - P.t - P.b);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join("");
  const area = `${line}L${x(points.length - 1)},${y(0)}L${x(0)},${y(0)}Z`;
  const ticks = [0, Math.round(max / 2), max];
  const h = hover !== null ? points[hover] : null;

  return (
    <div style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={`Known words over the last 90 days, now ${known}`}
        onMouseMove={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * W;
          const i = Math.round(((px - P.l) / (W - P.l - P.r)) * (points.length - 1));
          setHover(Math.max(0, Math.min(points.length - 1, i)));
        }}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((tk) => (
          <g key={tk}>
            <line x1={P.l} x2={W - P.r} y1={y(tk)} y2={y(tk)} stroke="var(--border)" strokeDasharray={tk ? "2 4" : undefined} />
            <text x={P.l - 8} y={y(tk) + 4} fontSize="11" textAnchor="end" fill="var(--muted)">{tk.toLocaleString()}</text>
          </g>
        ))}
        <text x={P.l} y={H - 6} fontSize="11" fill="var(--muted)">{points[0].date.slice(5)}</text>
        <text x={W - P.r} y={H - 6} fontSize="11" fill="var(--muted)" textAnchor="end">today</text>
        <path d={area} fill="var(--accent)" opacity="0.12" />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
        {h && hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={P.t} y2={y(0)} stroke="var(--muted)" strokeWidth="1" />
            <circle cx={x(hover)} cy={y(h.value)} r="5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />
          </g>
        )}
      </svg>
      {h && hover !== null && (
        <div className="tip" style={{ left: `${(x(hover) / W) * 100}%`, bottom: "auto", top: 0 }}>
          {h.date}: {h.value.toLocaleString()} known
        </div>
      )}
    </div>
  );
}

function Heatmap({ history, today: t }: { history: Day[]; today: string }) {
  const by = new Map(history.map((d) => [d.date, d]));
  const weeks = 26;
  const end = new Date(`${t}T12:00:00`);
  const startOffset = weeks * 7 - 1 + ((end.getDay() + 6) % 7) - 6; // align columns to Mon–Sun
  const cells: { date: string; score: number; d?: Day }[] = [];
  for (let i = startOffset; i >= 0; i--) {
    const date = addDays(t, -i);
    const d = by.get(date);
    const score = d ? d.wordsRead / 100 + d.reviews / 10 + d.lingqsCreated / 5 + d.minutes / 10 : 0;
    cells.push({ date, score, d });
  }
  const shade = (s: number) => (s <= 0 ? undefined : s < 2 ? 0.3 : s < 5 ? 0.5 : s < 10 ? 0.75 : 1);
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="heatmap">
        {cells.map((c) => {
          const o = shade(c.score);
          return (
            <div
              key={c.date}
              title={c.d ? `${c.date}: ${c.d.wordsRead} words read, ${c.d.lingqsCreated} LingQs, ${c.d.reviews} reviews, ${c.d.minutes} min` : `${c.date}: no activity`}
              style={o ? { background: `color-mix(in srgb, var(--accent) ${o * 100}%, var(--surface-2))` } : undefined}
            />
          );
        })}
      </div>
      <div className="row small muted" style={{ gap: 6 }}>
        Less
        {[0, 0.3, 0.5, 0.75, 1].map((o) => (
          <span key={o} style={{ width: 11, height: 11, borderRadius: 3, display: "inline-block", background: o ? `color-mix(in srgb, var(--accent) ${o * 100}%, var(--surface-2))` : "var(--surface-2)" }} />
        ))}
        More
      </div>
    </div>
  );
}
