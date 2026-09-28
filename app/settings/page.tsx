"use client";

import { useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { useSettings } from "@/lib/client/useSettings";
import { LANGUAGES } from "@/lib/langs";
import { speak, speechAvailable, voicesFor } from "@/lib/client/speech";

interface Status {
  provider: string;
  model: string;
}

const PROVIDER_TEXT: Record<string, string> = {
  subscription: "Your Claude subscription, through Claude Code (Claude Agent SDK)",
  api: "Anthropic API key (ANTHROPIC_API_KEY)",
  mock: "Mock responses (offline test mode)",
};

export default function SettingsPage() {
  const s = useSettings();
  const update = useMutation(api.settings.update);
  const [status, setStatus] = useState<Status | null>(null);
  const [test, setTest] = useState<{ busy: boolean; result?: string; ok?: boolean }>({ busy: false });
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  // Speech support is only known in the browser; decide after mount to keep hydration consistent.
  const [canSpeak, setCanSpeak] = useState<boolean | null>(null);
  useEffect(() => setCanSpeak(speechAvailable()), []);

  useEffect(() => {
    fetch("/api/ai/status").then((r) => r.json()).then(setStatus).catch(() => {});
  }, []);

  useEffect(() => {
    if (!speechAvailable()) return;
    const load = () => setVoices(voicesFor(s.targetLang));
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, [s.targetLang]);

  const runTest = async () => {
    setTest({ busy: true });
    const res = await fetch("/api/ai/status", { method: "POST" }).then((r) => r.json()).catch((e) => ({ ok: false, error: String(e) }));
    setTest({ busy: false, ok: res.ok, result: res.ok ? `“${res.sample}” in ${(res.ms / 1000).toFixed(1)}s` : res.error });
  };

  return (
    <div className="settings-grid">
      <h1>Settings</h1>

      <section className="card">
        <h2>Claude</h2>
        <div className="setting-row">
          <div>
            <div>Connection</div>
            <div className="small muted">
              {status ? `${PROVIDER_TEXT[status.provider] ?? status.provider} · ${status.model}` : "…"}
            </div>
            {test.result && (
              <div className="small" style={{ color: test.ok ? "var(--good)" : "var(--danger)", marginTop: 4 }}>
                {test.ok ? "✓ " : "✗ "}
                {test.result}
              </div>
            )}
          </div>
          <button className="btn" onClick={runTest} disabled={test.busy}>{test.busy ? "Testing…" : "Test"}</button>
        </div>
        <p className="small muted" style={{ marginTop: 8 }}>
          With no API key set, Beam uses your Claude Pro/Max subscription through Claude Code on this machine. Log in once by running{" "}
          <code className="inline">claude</code> and choosing your Claude account (or put a{" "}
          <code className="inline">CLAUDE_CODE_OAUTH_TOKEN</code> from <code className="inline">claude setup-token</code> in{" "}
          <code className="inline">.env.local</code>). Set <code className="inline">ANTHROPIC_API_KEY</code> instead to use the API, which
          answers faster.
        </p>
      </section>

      <section className="card">
        <h2>Language</h2>
        <div className="setting-row">
          <div>
            <div>I&apos;m learning</div>
            <div className="small muted">Starter lessons are available for German; other languages use imports and AI stories.</div>
          </div>
          <select className="select" style={{ width: "auto" }} value={s.targetLang} onChange={(e) => update({ targetLang: e.target.value })}>
            {Object.values(LANGUAGES).map((l) => (
              <option key={l.code} value={l.code}>{l.flag} {l.name}</option>
            ))}
          </select>
        </div>
        <div className="setting-row">
          <div>Daily goal (LingQs)</div>
          <input className="input" type="number" min={1} max={500} style={{ width: 90 }} value={s.dailyGoal} onChange={(e) => update({ dailyGoal: Math.max(1, Number(e.target.value) || 1) })} />
        </div>
      </section>

      <section className="card">
        <h2>Reading</h2>
        <Toggle label="Mark remaining new words as known on page turn" hint="LingQ's core loop: words you didn't need to look up count as known." value={s.autoKnownOnPageTurn} onChange={(v) => update({ autoKnownOnPageTurn: v })} />
        <Toggle label="Show translations on hover" hint="Peek at the in-context meaning of blue words without creating a LingQ." value={s.hoverTranslations} onChange={(v) => update({ hoverTranslations: v })} />
        <Toggle label="Color noun genders" hint="Underline nouns in blue (der), red (die) or green (das) once Beam knows their gender." value={s.showGenderColors} onChange={(v) => update({ showGenderColors: v })} />
        <div className="setting-row">
          <div>Text size</div>
          <input type="range" min={15} max={34} value={s.fontSize} onChange={(e) => update({ fontSize: Number(e.target.value) })} />
        </div>
        <div className="setting-row">
          <div>Theme</div>
          <div className="segmented">
            {(["system", "light", "dark"] as const).map((t) => (
              <button key={t} className={s.theme === t ? "on" : ""} onClick={() => update({ theme: t })}>
                {t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Voice</h2>
        {canSpeak === null ? null : !canSpeak ? (
          <p className="muted">This browser has no speech synthesis.</p>
        ) : (
          <>
            <div className="setting-row">
              <div>
                <div>Voice</div>
                <div className="small muted">{voices.length ? `${voices.length} voices for this language` : "No voice for this language is installed. Add one in your OS language settings."}</div>
              </div>
              <select className="select" style={{ width: "auto", maxWidth: 260 }} value={s.ttsVoice ?? ""} onChange={(e) => update({ ttsVoice: e.target.value })}>
                <option value="">Best available</option>
                {voices.map((v) => (
                  <option key={v.name} value={v.name}>{v.name}</option>
                ))}
              </select>
            </div>
            <div className="setting-row">
              <div>Speed ({s.ttsRate.toFixed(2)}×)</div>
              <input type="range" min={0.5} max={1.3} step={0.05} value={s.ttsRate} onChange={(e) => update({ ttsRate: Number(e.target.value) })} />
            </div>
            <div className="setting-row">
              <div>Try it</div>
              <button className="btn" onClick={() => speak("Guten Tag! Schön, dass du Deutsch lernst.", { lang: s.targetLang, rate: s.ttsRate, voice: s.ttsVoice })}>🔊 Play sample</button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="setting-row">
      <div>
        <div>{label}</div>
        {hint && <div className="small muted">{hint}</div>}
      </div>
      <label className="switch">
        <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
        <span />
      </label>
    </div>
  );
}
