"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { useSettings } from "@/lib/client/useSettings";
import { today } from "@/lib/client/date";
import { speak } from "@/lib/client/speech";
import { newCard, previewIntervals, RATING_LABELS, type Rating } from "@/lib/fsrs";
import { tokenize } from "@/lib/text";

type Mode = "meaning" | "cloze" | "listen";

/** Splits a context sentence around the reviewed term so it can be highlighted or blanked. */
function splitContext(sentence: string, term: string, lang: string): [string, string, string] | null {
  const toks = tokenize(sentence, lang);
  const parts = term.split(" ");
  const wi = toks.map((t, i) => (t.kind === "word" ? i : -1)).filter((i) => i >= 0);
  for (let k = 0; k + parts.length <= wi.length; k++) {
    if (parts.every((p, j) => toks[wi[k + j]].term === p)) {
      const a = wi[k];
      const b = wi[k + parts.length - 1];
      const join = (from: number, to: number) => toks.slice(from, to).map((t) => t.text).join("");
      return [join(0, a), join(a, b + 1), join(b + 1, toks.length)];
    }
  }
  return null;
}

const normalizeAnswer = (s: string) =>
  s.toLocaleLowerCase("de").normalize("NFC").replace(/[^\p{L}\p{N} ]/gu, "").replace(/\s+/g, " ").trim();

export default function ReviewPage() {
  const settings = useSettings();
  const lang = settings.targetLang;
  const [sessionNow, setSessionNow] = useState(() => Date.now());
  const due = useQuery(api.review.due, { lang, now: sessionNow, limit: 200 });
  const rate = useMutation(api.review.rate);
  const [mode, setMode] = useState<Mode>("meaning");
  const [revealed, setRevealed] = useState(false);
  const [answer, setAnswer] = useState("");
  const [done, setDone] = useState(0);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  const queue = useMemo(() => (due ?? []).filter((w) => !skipped.has(w._id)), [due, skipped]);
  const card = queue[0] as Doc<"words"> | undefined;
  const ctx = card?.context ? splitContext(card.context, card.term, lang) : null;
  const intervals = card ? previewIntervals(card.srs ?? newCard(), Date.now()) : null;
  const correct = card && revealed && mode === "cloze" && ctx ? normalizeAnswer(answer) === normalizeAnswer(ctx[1]) : null;

  const say = (text: string) => speak(text, { lang, rate: settings.ttsRate, voice: settings.ttsVoice });

  useEffect(() => {
    setRevealed(false);
    setAnswer("");
    if (!card) return;
    if (mode === "listen") say(card.context ?? card.term);
    if (mode === "cloze") setTimeout(() => inputRef.current?.focus(), 30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?._id, mode]);

  const submit = async (rating: Rating, markKnown = false) => {
    if (!card) return;
    setSkipped((s) => new Set(s).add(card._id));
    setDone((d) => d + 1);
    await rate({ id: card._id, rating, date: today(), markKnown });
  };

  const reveal = () => {
    setRevealed(true);
    if (card && mode !== "listen") say(card.term);
  };

  const keys = useRef<(e: KeyboardEvent) => void>(() => {});
  keys.current = (e) => {
    if (!card || e.metaKey || e.ctrlKey || e.altKey) return;
    const typing = e.target instanceof HTMLInputElement;
    if (!revealed) {
      if (e.key === "Enter" || (e.key === " " && !typing)) {
        e.preventDefault();
        reveal();
      }
      return;
    }
    if (typing && e.key !== "Enter") return;
    if (["1", "2", "3", "4"].includes(e.key)) void submit(Number(e.key) as Rating);
    else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      void submit(correct === false ? 1 : 3);
    } else if (e.key === "k" || e.key === "K") void submit(4, true);
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => keys.current(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  return (
    <div className="review-wrap">
      <div className="row wrap" style={{ justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1>Review</h1>
          <p className="muted">{due === undefined ? "Loading…" : `${queue.length} due · ${done} reviewed this session`}</p>
        </div>
        <div className="segmented" aria-label="Card type">
          <button className={mode === "meaning" ? "on" : ""} onClick={() => setMode("meaning")}>Meaning</button>
          <button className={mode === "cloze" ? "on" : ""} onClick={() => setMode("cloze")}>Cloze</button>
          <button className={mode === "listen" ? "on" : ""} onClick={() => setMode("listen")}>Listening</button>
        </div>
      </div>

      {due === undefined ? (
        <div className="flashcard"><div className="skeleton" style={{ height: 200 }} /></div>
      ) : !card ? (
        <div className="flashcard" style={{ alignItems: "center", justifyContent: "center", textAlign: "center" }}>
          <div style={{ fontSize: 44 }}>{done ? "🎉" : "✨"}</div>
          <h2>{done ? `Done! ${done} card${done === 1 ? "" : "s"} reviewed.` : "Nothing due right now."}</h2>
          <p className="muted">New LingQs you save while reading show up here. Reading more is the best review.</p>
          <div className="row">
            <Link className="btn primary" href="/library">Read something</Link>
            <button className="btn" onClick={() => { setSessionNow(Date.now()); setSkipped(new Set()); }}>Check again</button>
          </div>
        </div>
      ) : (
        <>
          <div className="flashcard" data-testid="flashcard">
            {mode === "meaning" && (
              <>
                <div className="flash-term">{card.term}</div>
                {ctx && (
                  <div className="flash-context">
                    {ctx[0]}<mark>{ctx[1]}</mark>{ctx[2]}
                  </div>
                )}
              </>
            )}
            {mode === "cloze" && (
              <>
                <div className="flash-context" style={{ color: "var(--text)" }}>
                  {ctx ? (
                    <>
                      {ctx[0]}
                      <mark>{revealed ? ctx[1] : "＿＿＿"}</mark>
                      {ctx[2]}
                    </>
                  ) : (
                    <span className="muted">(no context saved)</span>
                  )}
                </div>
                <div className="muted" style={{ textAlign: "center" }}>Hint: {card.translation ?? "—"}</div>
                <input
                  ref={inputRef}
                  className="input cloze-input"
                  value={answer}
                  disabled={revealed}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Type the missing word"
                  aria-label="Your answer"
                />
                {revealed && correct !== null && (
                  <div style={{ textAlign: "center", fontWeight: 700, color: correct ? "var(--good)" : "var(--danger)" }}>
                    {correct ? "✓ Correct" : `✗ ${ctx?.[1]}`}
                  </div>
                )}
              </>
            )}
            {mode === "listen" && (
              <div className="stack" style={{ alignItems: "center" }}>
                <button className="btn" style={{ fontSize: 22, padding: "16px 22px" }} onClick={() => say(card.context ?? card.term)} aria-label="Play again">
                  🔊
                </button>
                <p className="muted">Listen for <b>{revealed ? card.term : "the highlighted word"}</b>. What does the sentence mean?</p>
                {revealed && ctx && (
                  <div className="flash-context">
                    {ctx[0]}<mark>{ctx[1]}</mark>{ctx[2]}
                  </div>
                )}
              </div>
            )}

            {revealed ? (
              <div className="flash-answer">
                <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{card.translation || "—"}</div>
                <div className="row wrap" style={{ justifyContent: "center" }}>
                  {card.gender && <span className={`gender ${card.gender}`}>{card.gender === "m" ? "der" : card.gender === "f" ? "die" : card.gender === "n" ? "das" : "pl."}</span>}
                  {card.lemma && card.lemma !== card.term && <span className="chip">→ {card.lemma}</span>}
                  {card.pos && <span className="chip">{card.pos}</span>}
                  <button className="btn ghost sm" onClick={() => say(card.context ?? card.term)}>🔊 sentence</button>
                </div>
                {card.notes && <div className="note-box">{card.notes}</div>}
              </div>
            ) : (
              <div style={{ marginTop: "auto", textAlign: "center" }}>
                <button className="btn primary" onClick={reveal}>
                  {mode === "cloze" ? "Check" : "Show answer"} <span className="kbd" style={{ marginLeft: 6 }}>Space</span>
                </button>
              </div>
            )}
          </div>

          {revealed && intervals && (
            <>
              <div className="rate-bar">
                {([1, 2, 3, 4] as Rating[]).map((r) => (
                  <button key={r} className={`r${r}`} onClick={() => submit(r)}>
                    {RATING_LABELS[r]}
                    <small>{intervals[r]} · {r}</small>
                  </button>
                ))}
              </div>
              <div className="row" style={{ justifyContent: "center", marginTop: 10 }}>
                <button className="btn ghost sm" onClick={() => submit(4, true)}>✓ I know this word now (K)</button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
