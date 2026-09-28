"use client";

import { useEffect, useRef, useState } from "react";
import { ai } from "@/lib/client/ai";
import { speak } from "@/lib/client/speech";
import type { Gloss, SentenceExplanation, WordLookup } from "@/lib/ai/types";
import { statusLabel } from "./types";

// Client-side memo of lookups so moving back and forth between words is instant.
const lookupMemo = new Map<string, Promise<WordLookup>>();
const translationMemo = new Map<string, Promise<string>>();
const explainMemo = new Map<string, Promise<SentenceExplanation>>();

function memo<T>(map: Map<string, Promise<T>>, key: string, fn: () => Promise<T>): Promise<T> {
  let p = map.get(key);
  if (!p) {
    p = fn();
    map.set(key, p);
    p.catch(() => map.delete(key));
  }
  return p;
}

export function prefetchLookup(lang: string, native: string, term: string, sentence: string) {
  return memo(lookupMemo, `${lang}|${term}|${sentence}`, () => ai.word(lang, native, term, sentence));
}

export interface PanelProps {
  lang: string;
  native: string;
  term: string;
  display: string;
  sentence: string;
  status: number | undefined;
  savedTranslation?: string;
  gloss?: Gloss;
  isPhrase: boolean;
  ttsRate: number;
  ttsVoice?: string;
  parentPhrase?: { term: string; translation?: string };
  sentenceAction: { kind: "translate" | "explain"; nonce: number } | null;
  onSetStatus: (status: number, extra: { translation?: string; lemma?: string; pos?: string; gender?: string }) => void;
  onSaveMeaning: (translation: string) => void;
  onSelectPhrase?: () => void;
  onClose: () => void;
}

export function WordPanel(p: PanelProps) {
  const [info, setInfo] = useState<WordLookup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState(p.savedTranslation ?? "");
  const hintEdited = useRef(false);

  const [sentenceTr, setSentenceTr] = useState<string | null>(null);
  const [explain, setExplain] = useState<SentenceExplanation | null>(null);
  const [sentenceBusy, setSentenceBusy] = useState<"translate" | "explain" | null>(null);
  const [sentenceErr, setSentenceErr] = useState<string | null>(null);

  // Word lookup whenever the selection changes.
  useEffect(() => {
    let alive = true;
    setInfo(null);
    setError(null);
    hintEdited.current = false;
    setHint(p.savedTranslation ?? p.gloss?.translation ?? "");
    const t = setTimeout(() => {
      prefetchLookup(p.lang, p.native, p.term, p.sentence)
        .then((res) => {
          if (!alive) return;
          setInfo(res);
          if (!hintEdited.current && !p.savedTranslation) setHint(res.translation);
        })
        .catch((e: Error) => alive && setError(e.message));
    }, 120);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.lang, p.term, p.sentence]);

  useEffect(() => {
    if (!hintEdited.current) setHint(p.savedTranslation ?? info?.translation ?? p.gloss?.translation ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.savedTranslation]);

  // Sentence tools reset when the sentence changes.
  useEffect(() => {
    setSentenceTr(null);
    setExplain(null);
    setSentenceErr(null);
  }, [p.sentence]);

  const runSentence = async (kind: "translate" | "explain") => {
    setSentenceBusy(kind);
    setSentenceErr(null);
    try {
      if (kind === "translate") {
        setSentenceTr(await memo(translationMemo, `${p.lang}|${p.sentence}`, () => ai.sentence(p.lang, p.native, p.sentence).then((r) => r.translation)));
      } else {
        setExplain(await memo(explainMemo, `${p.lang}|${p.sentence}`, () => ai.explain(p.lang, p.native, p.sentence)));
      }
    } catch (e) {
      setSentenceErr((e as Error).message);
    } finally {
      setSentenceBusy(null);
    }
  };

  // Keyboard shortcuts (T / E) arrive from the reader as a nonce.
  useEffect(() => {
    if (p.sentenceAction) void runSentence(p.sentenceAction.kind);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.sentenceAction?.nonce]);

  const translation = info?.translation ?? p.gloss?.translation;
  const lemma = info?.lemma ?? p.gloss?.lemma;
  const gender = info?.gender || p.gloss?.gender || "";
  const isNew = p.status === undefined;

  const extra = () => ({
    translation: hint.trim() || translation,
    lemma: lemma || undefined,
    pos: info?.pos || undefined,
    gender: gender || undefined,
  });

  const say = (text: string) => speak(text, { lang: p.lang, rate: p.ttsRate, voice: p.ttsVoice });

  return (
    <>
      <div className="row" style={{ alignItems: "flex-start" }}>
        <div className="grow">
          <div className="panel-term">{p.display}</div>
          <div className="small muted">{statusLabel(p.status)}{p.isPhrase ? " · phrase" : ""}</div>
        </div>
        <button className="btn ghost icon" onClick={() => say(p.display)} title="Pronounce (P)" aria-label="Pronounce">🔊</button>
        <button className="btn ghost icon" onClick={p.onClose} title="Close (Esc)" aria-label="Close">✕</button>
      </div>

      <div className="stack" style={{ gap: 8 }}>
        {translation ? (
          <div className="panel-trans" data-testid="translation">{translation}</div>
        ) : error ? (
          <div className="error-box">{error}</div>
        ) : (
          <div className="skeleton" style={{ width: "60%", height: 22 }} />
        )}
        <div className="panel-meta">
          {info?.article && gender && <span className={`gender ${gender}`}>{info.article}</span>}
          {!info?.article && gender && <span className={`gender ${gender}`}>{gender}</span>}
          {lemma && lemma.toLowerCase() !== p.term && <span className="chip">→ {lemma}</span>}
          {info?.pos && <span className="chip">{info.pos}</span>}
          {info?.plural && <span className="chip">pl. {info.plural}</span>}
        </div>
        {info?.form && <div className="small muted">{info.form}</div>}
        {info?.expression && (
          <div className="note-box">
            <b>{info.expression}</b> — {info.expressionTranslation}
          </div>
        )}
        {info?.note && <div className="note-box">💡 {info.note}</div>}
        {info && info.alternatives.length > 0 && (
          <div className="small muted">Also: {info.alternatives.join(" · ")}</div>
        )}
        {!info && !error && translation && <div className="skeleton" style={{ width: "80%" }} />}
      </div>

      {p.parentPhrase && (
        <button className="note-box" style={{ textAlign: "left", border: 0, cursor: "pointer" }} onClick={p.onSelectPhrase}>
          Part of your phrase <b>{p.parentPhrase.term}</b>
          {p.parentPhrase.translation ? ` — ${p.parentPhrase.translation}` : ""}
        </button>
      )}

      <label className="field">
        <span>Your meaning</span>
        <input
          className="input"
          value={hint}
          placeholder={translation ?? "Meaning…"}
          onChange={(e) => {
            hintEdited.current = true;
            setHint(e.target.value);
          }}
          onBlur={() => {
            if (!isNew && hintEdited.current && hint.trim() && hint.trim() !== p.savedTranslation) p.onSaveMeaning(hint.trim());
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              (e.target as HTMLInputElement).blur();
              if (isNew) p.onSetStatus(1, extra());
            }
            e.stopPropagation();
          }}
        />
      </label>

      {isNew ? (
        <div className="new-actions">
          <button className="btn primary" onClick={() => p.onSetStatus(1, extra())} title="Create LingQ (Enter)">
            ＋ Save as LingQ
          </button>
          <button className="btn" onClick={() => p.onSetStatus(5, {})} title="I know this (K)">✓ Known</button>
          <button className="btn ghost" onClick={() => p.onSetStatus(0, {})} title="Ignore names and foreign words (X)">Ignore</button>
        </div>
      ) : (
        <div className="status-bar" role="group" aria-label="Word status">
          {[1, 2, 3, 4].map((s) => (
            <button key={s} className={`b${s}${p.status === s ? " on" : ""}`} onClick={() => p.onSetStatus(s, extra())} title={`Status ${s} (${s})`}>
              {s}
            </button>
          ))}
          <button className={`bk${p.status === 5 ? " on" : ""}`} onClick={() => p.onSetStatus(5, {})} title="Known (K)">✓</button>
          <button className={p.status === 0 ? "on" : ""} onClick={() => p.onSetStatus(0, {})} title="Ignore (X)">✕</button>
        </div>
      )}

      <div className="sentence-box stack" style={{ gap: 10 }}>
        <div className="row">
          <span className="small muted grow">Sentence</span>
          <button className="btn ghost sm" onClick={() => say(p.sentence)} title="Read sentence (S)">🔊</button>
          <button className="btn sm" onClick={() => runSentence("translate")} disabled={!!sentenceBusy} title="Translate (T)">
            {sentenceBusy === "translate" ? "…" : "Translate"}
          </button>
          <button className="btn sm" onClick={() => runSentence("explain")} disabled={!!sentenceBusy} title="Explain grammar (E)">
            {sentenceBusy === "explain" ? "…" : "Explain"}
          </button>
        </div>
        <div className="sentence-text">{p.sentence}</div>
        {sentenceErr && <div className="error-box">{sentenceErr}</div>}
        {(sentenceTr || explain) && <div className="panel-trans" style={{ fontSize: 15 }}>{explain?.translation ?? sentenceTr}</div>}
        {explain && (
          <div className="stack" style={{ gap: 10 }}>
            {explain.literal && <div className="small muted">Literally: {explain.literal}</div>}
            <div className="chunks">
              {explain.chunks.map((c, i) => (
                <div className="chunk" key={i}>
                  <b>{c.text}</b>
                  <span>
                    {c.meaning}
                    {c.note && <span className="muted small"> · {c.note}</span>}
                  </span>
                </div>
              ))}
            </div>
            {explain.grammar.length > 0 && (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>
                {explain.grammar.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </>
  );
}
