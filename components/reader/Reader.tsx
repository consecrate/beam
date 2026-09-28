"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { type MouseEvent as ReactMouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { parseText, normalizePhrase, normalizeTerm, type Token } from "@/lib/text";
import { useSettings } from "@/lib/client/useSettings";
import { today } from "@/lib/client/date";
import { ai } from "@/lib/client/ai";
import { speak, stopSpeaking } from "@/lib/client/speech";
import type { Gloss } from "@/lib/ai/types";
import { LEVELS } from "@/lib/langs";
import { useToast } from "../Toasts";
import { Modal } from "../Modal";
import { prefetchLookup, WordPanel } from "./WordPanel";
import { type PhraseEntry, type Selection, statusClass, type WordEntry } from "./types";

interface PhraseMark {
  term: string;
  a: number;
  b: number;
  start: boolean;
  end: boolean;
}

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);

export function Reader({ lessonId }: { lessonId: Id<"lessons"> }) {
  const router = useRouter();
  const toast = useToast();
  const settings = useSettings();
  const lesson = useQuery(api.lessons.get, { id: lessonId });
  const data = useQuery(api.words.forLesson, { lessonId });

  const lang = lesson?.lang ?? settings.targetLang;
  const native = settings.nativeLang;
  const parsed = useMemo(() => (lesson ? parseText(lesson.text, lesson.lang) : null), [lesson?.text, lesson?.lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const [page, setPage] = useState<number | null>(null);
  const [sel, setSel] = useState<Selection | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [glosses, setGlosses] = useState<Record<string, Gloss>>({});
  const [speaking, setSpeaking] = useState<number | null>(null);
  const [sentenceMode, setSentenceMode] = useState(false);
  const [focus, setFocus] = useState(0);
  const [finished, setFinished] = useState(false);
  const [session, setSession] = useState({ known: 0, lingqs: 0 });
  const [sentenceAction, setSentenceAction] = useState<{ kind: "translate" | "explain"; nonce: number } | null>(null);
  const [showSimplify, setShowSimplify] = useState(false);
  const dragging = useRef<{ sentence: number; anchor: number } | null>(null);
  const requestedGloss = useRef(new Set<string>());
  const listening = useRef(false);

  // ---------- mutations (optimistic so colors change instantly) ----------

  const setStatusM = useMutation(api.words.setStatus).withOptimisticUpdate((store, args) => {
    const cur = store.getQuery(api.words.forLesson, { lessonId });
    if (!cur) return;
    if (args.term.includes(" ")) {
      const term = normalizePhrase(args.term, args.lang);
      const others = cur.phrases.filter((p) => p.term !== term);
      const old = cur.phrases.find((p) => p.term === term);
      const phrases = args.status === 0 ? others : [...others, { term, status: args.status, translation: args.translation ?? old?.translation }];
      store.setQuery(api.words.forLesson, { lessonId }, { ...cur, phrases });
    } else {
      const term = normalizeTerm(args.term, args.lang);
      const old = cur.words.find((w) => w.term === term);
      const others = cur.words.filter((w) => w.term !== term);
      store.setQuery(api.words.forLesson, { lessonId }, {
        ...cur,
        words: [...others, { ...old, term, status: args.status, translation: args.translation ?? old?.translation, gender: args.gender ?? old?.gender }],
      });
    }
  });
  const markKnownM = useMutation(api.words.markNewAsKnown).withOptimisticUpdate((store, args) => {
    const cur = store.getQuery(api.words.forLesson, { lessonId });
    if (!cur) return;
    const have = new Set(cur.words.map((w) => w.term));
    const added = args.terms.filter((t) => !have.has(t)).map((term) => ({ term, status: 5 }));
    store.setQuery(api.words.forLesson, { lessonId }, { ...cur, words: [...cur.words, ...added] });
  });
  const undoKnownM = useMutation(api.words.undoMarkKnown);
  const openM = useMutation(api.lessons.open);
  const progressM = useMutation(api.lessons.setProgress);
  const completeM = useMutation(api.lessons.complete);
  const activityM = useMutation(api.stats.logActivity);
  const settingsM = useMutation(api.settings.update);

  const words = useMemo(() => {
    const m: Record<string, WordEntry> = Object.create(null);
    for (const w of data?.words ?? []) m[w.term] = w;
    return m;
  }, [data?.words]);
  const phrases: PhraseEntry[] = data?.phrases ?? [];
  const phraseMap = useMemo(() => new Map(phrases.map((p) => [p.term, p])), [phrases]);

  // ---------- open lesson / restore position ----------

  useEffect(() => {
    if (!lesson || !parsed || page !== null) return;
    setPage(Math.min(lesson.progressPage, Math.max(0, parsed.pages.length - 1)));
    void openM({ id: lessonId, pageCount: parsed.pages.length });
  }, [lesson, parsed, page, lessonId, openM]);

  const pageSentences = useMemo(() => (parsed && page !== null ? parsed.pages[page]?.blocks.flat() ?? [] : []), [parsed, page]);

  // ---------- phrase highlighting ----------

  const phraseMarks = useMemo(() => {
    const marks = new Map<string, PhraseMark>();
    if (!parsed || !phrases.length) return marks;
    const byFirst = new Map<string, string[][]>();
    for (const p of phrases) {
      const parts = p.term.split(" ");
      if (parts.length < 2) continue;
      byFirst.set(parts[0], [...(byFirst.get(parts[0]) ?? []), parts]);
    }
    for (const sid of pageSentences) {
      const toks = parsed.sentences[sid].tokens;
      const wi = toks.map((t, i) => (t.kind === "word" ? i : -1)).filter((i) => i >= 0);
      for (let k = 0; k < wi.length; k++) {
        for (const parts of byFirst.get(toks[wi[k]].term!) ?? []) {
          if (k + parts.length > wi.length) continue;
          if (!parts.every((w, j) => toks[wi[k + j]].term === w)) continue;
          const a = wi[k];
          const b = wi[k + parts.length - 1];
          const term = parts.join(" ");
          for (let i = a; i <= b; i++) marks.set(`${sid}:${i}`, { term, a, b, start: i === a, end: i === b });
        }
      }
    }
    return marks;
  }, [parsed, phrases, pageSentences]);

  // ---------- glosses prefetch (instant hovers and panel) ----------

  const fetchGlosses = useCallback(
    async (pageIdx: number) => {
      if (!parsed || !parsed.pages[pageIdx]) return;
      const items: { term: string; sentence: string }[] = [];
      for (const sid of parsed.pages[pageIdx].blocks.flat()) {
        const s = parsed.sentences[sid];
        for (const t of s.tokens) {
          if (t.kind !== "word" || !t.term || requestedGloss.current.has(t.term)) continue;
          const w = words[t.term];
          if (w && (w.status === 5 || w.status === 0 || w.translation)) continue;
          requestedGloss.current.add(t.term);
          items.push({ term: t.term, sentence: s.text });
        }
      }
      if (!items.length) return;
      try {
        const res = await ai.gloss(lang, native, items);
        setGlosses((g) => ({ ...g, ...res }));
      } catch (e) {
        for (const it of items) requestedGloss.current.delete(it.term);
        console.warn("Gloss prefetch failed:", e);
      }
    },
    [parsed, words, lang, native],
  );

  const dataLoaded = data !== undefined;
  useEffect(() => {
    if (page === null || !dataLoaded) return;
    void fetchGlosses(page).then(() => fetchGlosses(page + 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, dataLoaded]);

  // ---------- selection ----------

  const selInfo = useMemo(() => {
    if (!sel || !parsed) return null;
    const s = parsed.sentences[sel.sentence];
    const toks = s.tokens.slice(sel.a, sel.b + 1);
    const ws = toks.filter((t) => t.kind === "word");
    if (!ws.length) return null;
    const isPhrase = ws.length > 1;
    const term = ws.map((t) => t.term!).join(" ");
    const display = toks.map((t) => t.text).join("").trim();
    const entry = isPhrase ? phraseMap.get(term) : words[term];
    const mark = !isPhrase ? phraseMarks.get(`${sel.sentence}:${sel.a}`) : undefined;
    return { term, display, sentence: s.text, isPhrase, entry, mark };
  }, [sel, parsed, words, phraseMap, phraseMarks]);

  // Warm the detailed lookup for a word the pointer rests on, so the panel is
  // ready on click. The dwell keeps casual mouse movement from queueing calls
  // (each subscription call starts a Claude Code process).
  const warmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warm = (sid: number, i: number) => {
    if (warmTimer.current) clearTimeout(warmTimer.current);
    const t = parsed?.sentences[sid]?.tokens[i];
    const st = t?.term ? words[t.term]?.status : 5;
    if (!t?.term || st === 5 || st === 0) return;
    warmTimer.current = setTimeout(() => {
      void prefetchLookup(lang, native, t.term!, parsed!.sentences[sid].text).catch(() => {});
    }, 600);
  };

  const tokenAt = (e: ReactMouseEvent): { sid: number; i: number } | null => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-i]");
    if (!el) return null;
    return { sid: Number(el.dataset.s), i: Number(el.dataset.i) };
  };

  const onMouseDown = (e: ReactMouseEvent) => {
    const hit = tokenAt(e);
    if (!hit || e.button !== 0) return;
    e.preventDefault();
    if (e.shiftKey && sel && sel.sentence === hit.sid) {
      setSel({ sentence: hit.sid, a: Math.min(sel.a, hit.i), b: Math.max(sel.b, hit.i) });
      return;
    }
    dragging.current = { sentence: hit.sid, anchor: hit.i };
    setSel({ sentence: hit.sid, a: hit.i, b: hit.i });
  };
  const onMouseOver = (e: ReactMouseEvent) => {
    const hit = tokenAt(e);
    setHover(hit ? `${hit.sid}:${hit.i}` : null);
    if (!hit) {
      if (warmTimer.current) clearTimeout(warmTimer.current);
      return;
    }
    const d = dragging.current;
    if (d && d.sentence === hit.sid && e.buttons === 1) {
      setSel({ sentence: hit.sid, a: Math.min(d.anchor, hit.i), b: Math.max(d.anchor, hit.i) });
    } else if (!d) {
      warm(hit.sid, hit.i);
    }
  };
  useEffect(() => {
    const up = () => (dragging.current = null);
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  const extendSelection = () => {
    if (!sel || !parsed) return;
    const toks = parsed.sentences[sel.sentence].tokens;
    for (let i = sel.b + 1; i < toks.length; i++) {
      if (toks[i].kind === "word") {
        setSel({ ...sel, b: i });
        return;
      }
    }
  };

  // ---------- status changes ----------

  const setStatus = (status: number, extra: { translation?: string; lemma?: string; pos?: string; gender?: string } = {}) => {
    if (!selInfo) return;
    const wasNew = selInfo.entry === undefined;
    void setStatusM({
      lang,
      term: selInfo.term,
      status,
      date: today(),
      context: selInfo.sentence,
      lessonId,
      ...(status >= 1 && status <= 4 ? extra : { lemma: extra.lemma, pos: extra.pos, gender: extra.gender }),
    });
    if (wasNew && status >= 1 && status <= 4) setSession((s) => ({ ...s, lingqs: s.lingqs + 1 }));
    if (status === 5 && selInfo.entry?.status !== 5) setSession((s) => ({ ...s, known: s.known + 1 }));
  };

  const saveMeaning = (translation: string) => {
    if (!selInfo?.entry) return;
    void setStatusM({ lang, term: selInfo.term, status: selInfo.entry.status, date: today(), translation });
  };

  // ---------- paging ----------

  const turnPage = async (dir: 1 | -1) => {
    if (!parsed || page === null || !lesson) return;
    stopListening();
    const date = today();
    if (dir === 1) {
      const pg = parsed.pages[page];
      if (settings.autoKnownOnPageTurn) {
        const newTerms = new Set<string>();
        for (const sid of pg.blocks.flat()) {
          for (const t of parsed.sentences[sid].tokens) if (t.kind === "word" && t.term && !words[t.term]) newTerms.add(t.term);
        }
        if (newTerms.size) {
          const changed = await markKnownM({ lang, terms: [...newTerms], date, lessonId });
          if (changed.length) {
            setSession((s) => ({ ...s, known: s.known + changed.length }));
            toast(`Marked ${changed.length} word${changed.length === 1 ? "" : "s"} as known`, {
              label: "Undo",
              run: () => {
                void undoKnownM({ lang, terms: changed, date });
                setSession((s) => ({ ...s, known: Math.max(0, s.known - changed.length) }));
              },
            });
          }
        }
      }
      if (page >= lesson.progressPage) void activityM({ lang, date, wordsRead: pg.wordCount });
      if (page + 1 >= parsed.pages.length) {
        void completeM({ id: lessonId, date });
        void progressM({ id: lessonId, page: 0 });
        setFinished(true);
        setSel(null);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
    }
    const next = page + dir;
    if (next < 0 || next >= parsed.pages.length) return;
    setPage(next);
    setSel(null);
    setFocus(dir === 1 ? 0 : Number.MAX_SAFE_INTEGER);
    void progressM({ id: lessonId, page: next });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ---------- listening (TTS with sentence highlighting) ----------

  const stopListening = () => {
    listening.current = false;
    stopSpeaking();
    setSpeaking(null);
  };
  const playFrom = (idx: number) => {
    if (!parsed || !listening.current || idx >= pageSentences.length) {
      stopListening();
      return;
    }
    const sid = pageSentences[idx];
    setSpeaking(sid);
    speak(parsed.sentences[sid].text, { lang, rate: settings.ttsRate, voice: settings.ttsVoice, onEnd: () => playFrom(idx + 1) });
  };
  const toggleListen = () => {
    if (listening.current) return stopListening();
    stopSpeaking();
    listening.current = true;
    const start = sel ? Math.max(0, pageSentences.indexOf(sel.sentence)) : sentenceMode ? Math.min(focus, pageSentences.length - 1) : 0;
    playFrom(start);
  };
  useEffect(() => () => stopSpeaking(), []);

  // ---------- reading time ----------

  useEffect(() => {
    let last = Date.now();
    const mark = () => (last = Date.now());
    const events = ["mousemove", "keydown", "scroll", "click", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && Date.now() - last < 120_000) void activityM({ lang, date: today(), minutes: 1 });
    }, 60_000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, mark));
      clearInterval(timer);
    };
  }, [lang, activityM]);

  // ---------- keyboard ----------

  const navigable = useMemo(() => {
    const out: { sid: number; i: number }[] = [];
    if (!parsed) return out;
    const sids = sentenceMode ? [pageSentences[Math.min(focus, pageSentences.length - 1)]].filter((x) => x !== undefined) : pageSentences;
    for (const sid of sids) {
      parsed.sentences[sid].tokens.forEach((t, i) => {
        if (t.kind !== "word") return;
        const st = words[t.term!]?.status;
        if (st === 5 || st === 0) return;
        out.push({ sid, i });
      });
    }
    return out;
  }, [parsed, pageSentences, words, sentenceMode, focus]);

  const moveSel = (dir: 1 | -1) => {
    if (!navigable.length) return;
    const pos = sel ? navigable.findIndex((n) => n.sid === sel.sentence && n.i === sel.a) : -1;
    let idx: number;
    if (pos >= 0) idx = Math.min(navigable.length - 1, Math.max(0, pos + dir));
    else if (sel) {
      // Selection is on a known word: find the neighbor by document order.
      const after = navigable.findIndex((n) => n.sid > sel.sentence || (n.sid === sel.sentence && n.i > sel.a));
      idx = dir === 1 ? (after >= 0 ? after : navigable.length - 1) : Math.max(0, (after >= 0 ? after : navigable.length) - 1);
    } else idx = dir === 1 ? 0 : navigable.length - 1;
    const n = navigable[idx];
    setSel({ sentence: n.sid, a: n.i, b: n.i });
    document.querySelector(`[data-s="${n.sid}"][data-i="${n.i}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  const nextUnit = (dir: 1 | -1) => {
    if (sentenceMode) {
      const f = Math.min(focus, pageSentences.length - 1) + dir;
      if (f >= 0 && f < pageSentences.length) {
        setFocus(f);
        setSel(null);
        return;
      }
    }
    void turnPage(dir);
  };

  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandler.current = (e: KeyboardEvent) => {
    if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey || finished) return;
    const k = e.key;
    if (k === "ArrowRight") return e.preventDefault(), moveSel(1);
    if (k === "ArrowLeft") return e.preventDefault(), moveSel(-1);
    if (k === "PageDown" || k === "n" || k === "N") return e.preventDefault(), nextUnit(1);
    if (k === "PageUp" || k === "b" || k === "B") return e.preventDefault(), nextUnit(-1);
    if (k === "l" || k === "L") return toggleListen();
    if (k === "Escape") return setSel(null);
    if (!selInfo) return;
    if (["1", "2", "3", "4"].includes(k)) return setStatus(Number(k), { translation: selInfo.entry?.translation ?? glosses[selInfo.term]?.translation });
    if (k === "k" || k === "K" || k === "5") return setStatus(5);
    if (k === "x" || k === "X" || k === "0") return setStatus(0);
    if (k === "Enter" && !selInfo.entry) return setStatus(1, { translation: glosses[selInfo.term]?.translation });
    if (k === "p" || k === "P") return speak(selInfo.display, { lang, rate: settings.ttsRate, voice: settings.ttsVoice });
    if (k === "s" || k === "S") return speak(selInfo.sentence, { lang, rate: settings.ttsRate, voice: settings.ttsVoice });
    if (k === "t" || k === "T") return setSentenceAction({ kind: "translate", nonce: Date.now() });
    if (k === "e" || k === "E") return setSentenceAction({ kind: "explain", nonce: Date.now() });
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyHandler.current(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // ---------- render ----------

  if (lesson === null) {
    return (
      <div className="empty">
        <h2>Lesson not found</h2>
        <p style={{ marginTop: 10 }}>
          <Link className="btn" href="/library">Back to library</Link>
        </p>
      </div>
    );
  }
  if (!lesson || !parsed || page === null) {
    return (
      <div className="stack">
        <div className="skeleton" style={{ width: "40%", height: 28 }} />
        <div className="skeleton" style={{ height: 300 }} />
      </div>
    );
  }

  const totalPages = parsed.pages.length;
  const current = parsed.pages[page];
  const focusIdx = Math.min(focus, pageSentences.length - 1);
  const visibleBlocks = sentenceMode ? [[pageSentences[focusIdx]]] : current.blocks;

  const renderToken = (t: Token, sid: number, i: number) => {
    const key = `${sid}:${i}`;
    const mark = phraseMarks.get(key);
    const selected = sel && sel.sentence === sid && i >= sel.a && i <= sel.b;
    const multi = sel && sel.a !== sel.b;
    if (t.kind !== "word") {
      if (selected) return <span key={i} className="gap selm">{t.text}</span>;
      if (mark) return <span key={i} className="gap in-phrase">{t.text}</span>;
      return <span key={i}>{t.text}</span>;
    }
    const w = words[t.term!];
    const gloss = glosses[t.term!];
    let cls = `w ${statusClass(w?.status)}`;
    if (mark) cls += ` in-phrase${mark.start ? " ph-start" : ""}${mark.end ? " ph-end" : ""}`;
    if (selected) cls += multi ? ` selm${i === sel!.a ? " selm-start" : ""}${i === sel!.b ? " selm-end" : ""}` : " sel";
    const gender = w?.gender || gloss?.gender;
    if (settings.showGenderColors && gender && /^\p{Lu}/u.test(t.text) && w?.status !== 0) cls += ` g-${gender}`;
    let tip: string | undefined;
    if (hover === key && !selected && !dragging.current) {
      if (mark) tip = phraseMap.get(mark.term)?.translation;
      else if (w && w.status >= 1 && w.status <= 4) tip = w.translation ?? gloss?.translation;
      else if (!w && settings.hoverTranslations) tip = gloss?.translation;
    }
    return (
      <span key={i} className={cls} data-s={sid} data-i={i}>
        {t.text}
        {tip && <span className="tip">{tip}</span>}
      </span>
    );
  };

  const newOnPage = new Set<string>();
  const learningOnPage = new Set<string>();
  for (const sid of pageSentences) {
    for (const t of parsed.sentences[sid].tokens) {
      if (t.kind !== "word") continue;
      const st = words[t.term!]?.status;
      if (st === undefined) newOnPage.add(t.term!);
      else if (st >= 1 && st <= 4) learningOnPage.add(t.term!);
    }
  }

  return (
    <div className={`reader${sentenceMode ? " sentence-mode" : ""}`}>
      <div className="reader-main">
        <div className="reader-bar">
          <Link href="/library" className="btn ghost sm">← Library</Link>
          <div className="grow" />
          <button className={`btn sm${speaking !== null ? " primary" : ""}`} onClick={toggleListen} title="Read the page aloud (L)">
            {speaking !== null ? "■ Stop" : "▶ Listen"}
          </button>
          <button className={`btn sm${sentenceMode ? " primary" : ""}`} onClick={() => { setSentenceMode((m) => !m); setFocus(sel ? Math.max(0, pageSentences.indexOf(sel.sentence)) : 0); }} title="One sentence at a time">
            Sentence mode
          </button>
          <div className="segmented" aria-label="Text size">
            <button onClick={() => settingsM({ fontSize: Math.max(15, settings.fontSize - 1) })} aria-label="Smaller text">A−</button>
            <button onClick={() => settingsM({ fontSize: Math.min(34, settings.fontSize + 1) })} aria-label="Larger text">A+</button>
          </div>
          <button className="btn sm" onClick={() => setShowSimplify(true)} title="Rewrite this lesson at an easier level with Claude">Simplify</button>
        </div>

        <div className="row" style={{ marginBottom: 12, alignItems: "baseline" }}>
          <h1 className="reader-title grow">{lesson.title}</h1>
          {lesson.level && <span className="chip level">{lesson.level}</span>}
        </div>

        {finished ? (
          <div className="reading stack" style={{ alignItems: "center", textAlign: "center", fontFamily: "var(--font-ui)", justifyContent: "center" }}>
            <div style={{ fontSize: 48 }}>🎉</div>
            <h2>Lesson complete!</h2>
            <p className="muted">
              {lesson.wordCount} words read · {session.known} new known words · {session.lingqs} LingQs created
            </p>
            <div className="row wrap" style={{ justifyContent: "center", marginTop: 8 }}>
              <Link className="btn primary" href="/review">Review LingQs</Link>
              <Link className="btn" href="/library">Back to library</Link>
              <button className="btn" onClick={() => { setFinished(false); setPage(0); setSession({ known: 0, lingqs: 0 }); }}>Read again</button>
            </div>
          </div>
        ) : (
          <>
            <div
              className="reading"
              style={{ fontSize: sentenceMode ? settings.fontSize * 1.35 : settings.fontSize }}
              onMouseDown={onMouseDown}
              onMouseOver={onMouseOver}
              onMouseLeave={() => setHover(null)}
              data-testid="reading"
            >
              {visibleBlocks.map((block, bi) => (
                <p key={bi}>
                  {block.map((sid) => (
                    <span key={sid} className={`sent${speaking === sid ? " speaking" : ""}`}>
                      {parsed.sentences[sid].tokens.map((t, i) => renderToken(t, sid, i))}{" "}
                    </span>
                  ))}
                </p>
              ))}
            </div>

            <div className="reader-foot">
              <button className="btn" onClick={() => nextUnit(-1)} disabled={page === 0 && (!sentenceMode || focusIdx === 0)}>
                ← Back
              </button>
              <div className="stack" style={{ alignItems: "center", gap: 6 }}>
                <span className="small muted">
                  {sentenceMode ? `Sentence ${focusIdx + 1}/${pageSentences.length} · ` : ""}Page {page + 1} of {totalPages}
                </span>
                {totalPages <= 40 && (
                  <div className="page-dots" aria-hidden>
                    {parsed.pages.map((_, i) => (
                      <span key={i} className={i === page ? "cur" : i < page ? "done" : ""} />
                    ))}
                  </div>
                )}
              </div>
              <button className="btn primary" onClick={() => nextUnit(1)} title="Next page (N). Remaining blue words become known.">
                {page + 1 >= totalPages && (!sentenceMode || focusIdx >= pageSentences.length - 1) ? "Finish lesson ✓" : "Next →"}
              </button>
            </div>
            <div className="legend" style={{ marginTop: 14 }}>
              <span><i style={{ background: "var(--w-new)" }} />New ({newOnPage.size})</span>
              <span><i style={{ background: "var(--w-l1)" }} />LingQ ({learningOnPage.size})</span>
              <span><i style={{ background: "var(--w-phrase)" }} />Phrase</span>
              <span className="grow" />
              <span>
                <span className="kbd">←</span> <span className="kbd">→</span> words · <span className="kbd">1</span>–<span className="kbd">4</span> status · <span className="kbd">K</span> known · <span className="kbd">X</span> ignore · <span className="kbd">T</span> translate · <span className="kbd">N</span> next page
              </span>
            </div>
          </>
        )}
      </div>

      <aside className={`panel${selInfo ? "" : " closed"}`} aria-label="Word details">
        {selInfo ? (
          <>
            <WordPanel
              key={`${selInfo.term}|${selInfo.sentence}`}
              lang={lang}
              native={native}
              term={selInfo.term}
              display={selInfo.display}
              sentence={selInfo.sentence}
              status={selInfo.entry?.status}
              savedTranslation={selInfo.entry?.translation}
              gloss={glosses[selInfo.term]}
              isPhrase={selInfo.isPhrase}
              ttsRate={settings.ttsRate}
              ttsVoice={settings.ttsVoice}
              parentPhrase={selInfo.mark ? { term: selInfo.mark.term, translation: phraseMap.get(selInfo.mark.term)?.translation } : undefined}
              onSelectPhrase={() => selInfo.mark && setSel({ sentence: sel!.sentence, a: selInfo.mark.a, b: selInfo.mark.b })}
              sentenceAction={sentenceAction}
              onSetStatus={setStatus}
              onSaveMeaning={saveMeaning}
              onClose={() => setSel(null)}
            />
            <button className="btn ghost sm" onClick={extendSelection} title="Extend the selection to build a phrase (or shift-click / drag across words)">
              ＋ Add next word to phrase
            </button>
          </>
        ) : (
          <div className="panel-empty stack">
            <h3>Click any word</h3>
            <p>
              Blue words are new. Click one to see what it means in this sentence, then save it as a LingQ to study it. Drag across
              words (or shift-click) to look up a phrase.
            </p>
            <p>When you turn the page, the blue words you didn&apos;t look up are marked as known.</p>
          </div>
        )}
      </aside>

      {showSimplify && (
        <SimplifyModal
          onClose={() => setShowSimplify(false)}
          onDone={(id) => router.push(`/read/${id}`)}
          lessonId={lessonId}
          native={native}
          currentLevel={lesson.level}
        />
      )}
    </div>
  );
}

function SimplifyModal(props: { lessonId: string; native: string; currentLevel?: string; onClose: () => void; onDone: (id: string) => void }) {
  const [level, setLevel] = useState<string>(() => {
    const i = LEVELS.indexOf((props.currentLevel ?? "B1") as (typeof LEVELS)[number]);
    return LEVELS[Math.max(0, i - 1)] ?? "A2";
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Modal title="Simplify with Claude" onClose={props.onClose}>
      <div className="stack">
        <p className="muted">Creates an easier version of this lesson as a new lesson. Great for authentic texts that are still too hard.</p>
        <label className="field">
          Target level
          <select className="select" value={level} onChange={(e) => setLevel(e.target.value)}>
            {LEVELS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </label>
        {err && <div className="error-box">{err}</div>}
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="btn" onClick={props.onClose}>Cancel</button>
          <button
            className="btn primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setErr(null);
              try {
                const { id } = await ai.simplify(props.lessonId, props.native, level);
                props.onDone(id);
              } catch (e) {
                setErr((e as Error).message);
                setBusy(false);
              }
            }}
          >
            {busy ? "Rewriting…" : "Simplify"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
