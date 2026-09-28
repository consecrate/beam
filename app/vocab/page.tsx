"use client";

import { useConvex, useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { useSettings } from "@/lib/client/useSettings";
import { today } from "@/lib/client/date";
import { speak } from "@/lib/client/speech";

const FILTERS: [string, string][] = [
  ["learning", "LingQs"],
  ["1", "1"],
  ["2", "2"],
  ["3", "3"],
  ["4", "4"],
  ["known", "Known"],
  ["ignored", "Ignored"],
  ["all", "All"],
];

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function csvCell(s: string) {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function VocabPage() {
  const settings = useSettings();
  const lang = settings.targetLang;
  const convex = useConvex();
  const [filter, setFilter] = useState("learning");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(200);
  const q = useDebounced(search, 250);
  const words = useQuery(api.words.list, { lang, filter, search: q || undefined, limit });

  const exportCsv = async (includeKnown: boolean) => {
    const rows = await convex.query(api.words.exportLearning, { lang, includeKnown });
    const header = ["Front", "Back", "Lemma", "Gender", "Context", "Notes", "Status"];
    const lines = [header, ...rows.map((r) => [r.term, r.translation, r.lemma, r.gender, r.context, r.notes, String(r.status)])];
    const blob = new Blob(["﻿" + lines.map((l) => l.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `beam-${lang}-vocabulary-${today()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <div className="row wrap" style={{ justifyContent: "space-between" }}>
        <div>
          <h1>Vocabulary</h1>
          <p className="muted">Your LingQs and known words. Edit meanings inline.</p>
        </div>
        <div className="row">
          <button className="btn" onClick={() => exportCsv(false)} title="CSV that imports straight into Anki">⬇ Export LingQs</button>
          <button className="btn ghost" onClick={() => exportCsv(true)}>⬇ Export all</button>
        </div>
      </div>

      <div className="toolbar" style={{ margin: "20px 0 16px" }}>
        <input className="input" style={{ maxWidth: 280 }} placeholder="Search words or meanings…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="segmented">
          {FILTERS.map(([k, label]) => (
            <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {words === undefined ? (
        <div className="skeleton" style={{ height: 240 }} />
      ) : words.length === 0 ? (
        <div className="empty card">No words here yet. Click words while reading to create LingQs.</div>
      ) : (
        <>
          <table className="vocab-table">
            <thead>
              <tr>
                <th>Word</th>
                <th>Meaning</th>
                <th className="ctx">Context</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {words.map((w) => (
                <Row key={w._id} w={w} lang={lang} rate={settings.ttsRate} voice={settings.ttsVoice} />
              ))}
            </tbody>
          </table>
          {words.length >= limit && (
            <div className="row" style={{ justifyContent: "center", marginTop: 14 }}>
              <button className="btn" onClick={() => setLimit((l) => l + 200)}>Show more</button>
            </div>
          )}
        </>
      )}
    </>
  );
}

function Row({ w, lang, rate, voice }: { w: Doc<"words">; lang: string; rate: number; voice?: string }) {
  const updateMeaning = useMutation(api.words.updateMeaning);
  const setStatus = useMutation(api.words.setStatus);
  const remove = useMutation(api.words.remove);
  const [meaning, setMeaning] = useState(w.translation ?? "");
  useEffect(() => setMeaning(w.translation ?? ""), [w.translation]);

  return (
    <tr>
      <td>
        <button className="btn ghost sm" style={{ padding: "0 4px" }} onClick={() => speak(w.term, { lang, rate, voice })} aria-label="Pronounce">🔊</button>{" "}
        <span className="term">{w.term}</span>
        <div className="small muted">
          {w.gender && <span className={`gender ${w.gender}`} style={{ fontSize: 11, marginRight: 6 }}>{w.gender === "m" ? "der" : w.gender === "f" ? "die" : w.gender === "n" ? "das" : "pl"}</span>}
          {w.lemma && w.lemma !== w.term ? `→ ${w.lemma}` : w.pos ?? ""}
        </div>
      </td>
      <td>
        <input
          className="inline-edit"
          value={meaning}
          placeholder="—"
          onChange={(e) => setMeaning(e.target.value)}
          onBlur={() => meaning !== (w.translation ?? "") && updateMeaning({ id: w._id, translation: meaning })}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          aria-label={`Meaning of ${w.term}`}
        />
      </td>
      <td className="ctx">{w.context}</td>
      <td>
        <select
          className="select"
          style={{ width: "auto", padding: "3px 6px" }}
          value={w.status}
          onChange={(e) => setStatus({ lang, term: w.term, status: Number(e.target.value), date: today() })}
          aria-label={`Status of ${w.term}`}
        >
          <option value={1}>1 · new LingQ</option>
          <option value={2}>2 · recognized</option>
          <option value={3}>3 · familiar</option>
          <option value={4}>4 · learned</option>
          <option value={5}>✓ known</option>
          <option value={0}>ignored</option>
        </select>
      </td>
      <td>
        <button className="btn ghost sm danger" onClick={() => confirm(`Remove “${w.term}”? It will show as new again.`) && remove({ id: w._id })} aria-label={`Remove ${w.term}`}>
          ✕
        </button>
      </td>
    </tr>
  );
}
