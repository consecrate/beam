"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { useSettings } from "@/lib/client/useSettings";
import { today } from "@/lib/client/date";
import { ai } from "@/lib/client/ai";
import { subtitlesToText } from "@/lib/text";
import { LEVELS, languageName } from "@/lib/langs";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toasts";

type Filter = "all" | "progress" | "unread" | "done";

export default function LibraryPage() {
  const settings = useSettings();
  const lang = settings.targetLang;
  const lessons = useQuery(api.lessons.list, settings.loaded ? { lang } : "skip");
  const ensureStarter = useMutation(api.seed.ensureStarterLessons);
  const [filter, setFilter] = useState<Filter>("all");
  const [level, setLevel] = useState<string>("any");
  const [modal, setModal] = useState<"import" | "generate" | null>(null);
  const seeded = useRef<string | null>(null);

  useEffect(() => {
    if (lessons && lessons.length === 0 && seeded.current !== lang) {
      seeded.current = lang;
      void ensureStarter({ lang });
    }
  }, [lessons, lang, ensureStarter]);

  const shown = useMemo(() => {
    let list = lessons ?? [];
    if (filter === "progress") list = list.filter((l) => !l.completedAt && l.lastOpenedAt);
    if (filter === "unread") list = list.filter((l) => !l.lastOpenedAt);
    if (filter === "done") list = list.filter((l) => l.completedAt);
    if (level !== "any") list = list.filter((l) => l.level === level);
    return list;
  }, [lessons, filter, level]);

  return (
    <>
      <div className="row wrap" style={{ justifyContent: "space-between" }}>
        <div>
          <h1>Library</h1>
          <p className="muted">{languageName(lang)} lessons. Pick ones where 5–15% of the words are new.</p>
        </div>
        <div className="row">
          <button className="btn" onClick={() => setModal("import")}>＋ Import</button>
          <button className="btn primary" onClick={() => setModal("generate")}>✨ Generate story</button>
        </div>
      </div>

      <div className="toolbar" style={{ margin: "20px 0 16px" }}>
        <div className="segmented">
          {(
            [
              ["all", "All"],
              ["progress", "In progress"],
              ["unread", "Not started"],
              ["done", "Completed"],
            ] as [Filter, string][]
          ).map(([k, label]) => (
            <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>
              {label}
            </button>
          ))}
        </div>
        <select className="select" style={{ width: "auto" }} value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Level">
          <option value="any">All levels</option>
          {LEVELS.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
      </div>

      {lessons === undefined ? (
        <div className="lesson-grid">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="lesson-card"><div className="skeleton" style={{ height: 90 }} /></div>
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="empty card">
          <p>No lessons here yet.</p>
          <p style={{ marginTop: 12 }}>
            <button className="btn primary" onClick={() => setModal("generate")}>✨ Generate a story</button>
          </p>
        </div>
      ) : (
        <div className="lesson-grid">
          {shown.map((l) => (
            <LessonCard key={l._id} lesson={l} />
          ))}
        </div>
      )}

      {modal === "import" && <ImportModal lang={lang} onClose={() => setModal(null)} />}
      {modal === "generate" && <GenerateModal lang={lang} native={settings.nativeLang} onClose={() => setModal(null)} />}
    </>
  );
}

const SOURCE_ICON: Record<string, string> = { starter: "⭐", paste: "📝", file: "📄", url: "🌐", ai: "✨", simplified: "🪄" };

function LessonCard({ lesson }: { lesson: Doc<"lessons"> }) {
  const cov = useQuery(api.lessons.coverage, { id: lesson._id });
  const remove = useMutation(api.lessons.remove);
  const toast = useToast();
  const pages = lesson.pageCount;
  const progress = lesson.completedAt ? 1 : pages ? lesson.progressPage / pages : 0;

  return (
    <div className="lesson-card">
      <Link href={`/read/${lesson._id}`} className="stack" style={{ gap: 10 }}>
        <div className="row" style={{ paddingRight: 28 }}>
          <span title={lesson.source}>{SOURCE_ICON[lesson.source] ?? "📄"}</span>
          {lesson.level && <span className="chip level">{lesson.level}</span>}
          {lesson.completedAt && <span className="chip good">✓ Done</span>}
        </div>
        <h3>{lesson.title}</h3>
        {lesson.description && <p className="desc">{lesson.description}</p>}
        <div className="small muted row">
          <span>{lesson.wordCount} words</span>
          <span>·</span>
          {cov ? (
            <span title={`${cov.newCount} new, ${cov.learning} learning of ${cov.unique} unique words`}>
              <b style={{ color: cov.newPct > 25 ? "var(--danger)" : cov.newPct > 15 ? "var(--warn)" : "var(--good)" }}>{cov.newPct}%</b> new
            </span>
          ) : (
            <span>…</span>
          )}
        </div>
        {cov && (
          <div className="coverage-bar" aria-hidden>
            <div className="n" style={{ width: `${(cov.newCount / Math.max(1, cov.unique)) * 100}%` }} />
            <div className="l" style={{ width: `${(cov.learning / Math.max(1, cov.unique)) * 100}%` }} />
          </div>
        )}
        {progress > 0 && !lesson.completedAt && (
          <div className="progress" title="Reading progress">
            <div style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        )}
      </Link>
      <div className="card-menu">
        <button
          className="btn ghost icon sm"
          aria-label="Delete lesson"
          title="Delete lesson"
          onClick={() => {
            if (confirm(`Delete “${lesson.title}”? Your vocabulary is kept.`)) {
              void remove({ id: lesson._id });
              toast("Lesson deleted");
            }
          }}
        >
          🗑
        </button>
      </div>
    </div>
  );
}

function ImportModal({ lang, onClose }: { lang: string; onClose: () => void }) {
  const router = useRouter();
  const create = useMutation(api.lessons.create);
  const [tab, setTab] = useState<"paste" | "url" | "file">("paste");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [level, setLevel] = useState("");
  const [source, setSource] = useState<"paste" | "file" | "url">("paste");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const fetchUrl = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await ai.importUrl(url.trim());
      setTitle(res.title);
      setText(res.text);
      setSource("url");
      setTab("paste");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (file: File) => {
    setErr(null);
    const raw = await file.text();
    const isSubs = /\.(srt|vtt)$/i.test(file.name);
    setText(isSubs ? subtitlesToText(raw) : raw);
    setTitle(file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
    setSource("file");
    setTab("paste");
  };

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const id: Id<"lessons"> = await create({
        lang,
        title: title.trim() || text.trim().split(/\s+/).slice(0, 6).join(" "),
        text,
        source,
        level: level || undefined,
        sourceUrl: source === "url" ? url.trim() : undefined,
      });
      router.push(`/read/${id}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Modal title="Import a lesson" onClose={onClose}>
      <div className="stack">
        <div className="segmented">
          <button className={tab === "paste" ? "on" : ""} onClick={() => setTab("paste")}>Paste text</button>
          <button className={tab === "url" ? "on" : ""} onClick={() => setTab("url")}>From a web page</button>
          <button className={tab === "file" ? "on" : ""} onClick={() => setTab("file")}>Upload file</button>
        </div>

        {tab === "url" && (
          <div className="stack">
            <label className="field">
              Article URL
              <span className="hint">News, blogs, Wikipedia… Beam extracts the article text.</span>
              <input className="input" placeholder="https://www.tagesschau.de/…" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && fetchUrl()} />
            </label>
            <button className="btn primary" disabled={busy || !url.trim()} onClick={fetchUrl}>{busy ? "Fetching…" : "Fetch article"}</button>
          </div>
        )}

        {tab === "file" && (
          <label className="field">
            Text or subtitle file
            <span className="hint">.txt, .md, or .srt/.vtt subtitles from a show or YouTube video.</span>
            <input className="input" type="file" accept=".txt,.md,.srt,.vtt,text/plain" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </label>
        )}

        {tab === "paste" && (
          <>
            <label className="field">
              Title
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Optional" />
            </label>
            <label className="field">
              Text
              <textarea className="textarea" value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste German text here…" />
              <span className="hint">{text.trim() ? `${text.trim().split(/\s+/).length} words. Long texts are split into parts automatically.` : ""}</span>
            </label>
            <label className="field">
              Level (optional)
              <select className="select" value={level} onChange={(e) => setLevel(e.target.value)}>
                <option value="">—</option>
                {LEVELS.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </label>
          </>
        )}

        {err && <div className="error-box">{err}</div>}
        {tab === "paste" && (
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn primary" disabled={busy || !text.trim()} onClick={save}>{busy ? "Saving…" : "Create lesson"}</button>
          </div>
        )}
      </div>
    </Modal>
  );
}

const TOPICS = [
  "a mix-up at a Berlin bakery",
  "a first day at a new job",
  "a mysterious neighbor",
  "a train journey through the Alps",
  "cooking a family recipe",
  "a football match in the rain",
  "a job interview that goes strangely",
  "a lost cat in Hamburg",
];
const STYLES = ["short story", "dialogue", "news article", "diary entry", "personal letter", "explainer article"];

function GenerateModal({ lang, native, onClose }: { lang: string; native: string; onClose: () => void }) {
  const router = useRouter();
  const stats = useQuery(api.stats.dashboard, { lang, today: today() });
  const storyWords = useQuery(api.words.forStory, { lang, limit: 25 });
  const [level, setLevel] = useState<string>("A1");
  const levelTouched = useRef(false);
  useEffect(() => {
    if (!stats || levelTouched.current) return;
    const k = stats.known;
    setLevel(k < 500 ? "A1" : k < 2000 ? "A2" : k < 5000 ? "B1" : "B2");
  }, [stats]);
  const [topic, setTopic] = useState("");
  const [style, setStyle] = useState(STYLES[0]);
  const [words, setWords] = useState(300);
  const [useLingqs, setUseLingqs] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const go = async () => {
    setBusy(true);
    setErr(null);
    try {
      const { id } = await ai.generate({
        lang,
        native,
        level,
        topic: topic.trim(),
        style,
        words,
        targetWords: useLingqs ? (storyWords ?? []).map((w) => w.term) : [],
      });
      router.push(`/read/${id}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Modal title="Generate a story with Claude" onClose={onClose}>
      <div className="stack">
        <p className="muted">A fresh graded text at your level, about anything you like. Reading about things you care about is the fastest way to learn.</p>
        <label className="field">
          Topic
          <input className="input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. a detective story set in Munich" />
        </label>
        <div className="row wrap" style={{ gap: 6 }}>
          {TOPICS.map((t) => (
            <button key={t} className="chip" style={{ border: 0, cursor: "pointer" }} onClick={() => setTopic(t)}>{t}</button>
          ))}
        </div>
        <div className="row wrap">
          <label className="field grow">
            Level
            <select className="select" value={level} onChange={(e) => { levelTouched.current = true; setLevel(e.target.value); }}>
              {LEVELS.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
          <label className="field grow">
            Style
            <select className="select" value={style} onChange={(e) => setStyle(e.target.value)}>
              {STYLES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="field grow">
            Length
            <select className="select" value={words} onChange={(e) => setWords(Number(e.target.value))}>
              {[150, 300, 500, 800, 1200].map((n) => (
                <option key={n} value={n}>~{n} words</option>
              ))}
            </select>
          </label>
        </div>
        <label className="row" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={useLingqs} onChange={(e) => setUseLingqs(e.target.checked)} />
          <span>
            Weave in words I&apos;m learning{" "}
            <span className="muted small">({storyWords?.length ?? 0} LingQs{storyWords && storyWords.length > 0 ? `: ${storyWords.slice(0, 5).map((w) => w.term).join(", ")}…` : ""})</span>
          </span>
        </label>
        {err && <div className="error-box">{err}</div>}
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy} onClick={go}>{busy ? "Writing your story…" : "✨ Generate"}</button>
        </div>
      </div>
    </Modal>
  );
}
