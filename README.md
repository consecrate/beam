# Beam

Beam is a reading-first language learning app in the style of LingQ, starting with German for English speakers. You read real texts. Every word you don't know is one click from a translation that fits the sentence it's in, provided by Claude Haiku through your Claude subscription. Words you save become flashcards scheduled with FSRS.

## What it does

**Reader**
- Words are colored by status, as in LingQ: **blue** is new, **yellow** (1–4) is a word you're learning, and known or ignored words are plain.
- Click a word to see its meaning *in this sentence*, its dictionary form (separable verbs resolved: *fängt … an* → *anfangen*), part of speech, noun gender with der/die/das, plural, and a short grammar or usage note.
- Drag across words, or shift-click, to look up and save **phrases** and idioms. Saved phrases stay highlighted everywhere they appear.
- Turning the page marks the blue words you didn't look up as known, with **Undo**. This is how your known-word count grows.
- Beam prefetches short glosses for every new word on the page (one batched Haiku call), so hovering over a blue word shows its meaning instantly.
- Sentence tools: **Translate** gives a natural translation. **Explain** gives a literal word-order translation, the sentence split into chunks with notes, and the key grammar points.
- **Listen** reads the page aloud with the browser's voices and highlights the current sentence. **Sentence mode** shows one sentence at a time.
- Nouns are underlined by gender (blue *der*, red *die*, green *das*) once Beam knows their gender.
- Keyboard: `←`/`→` move between words, `1`–`4` set status, `K` known, `X` ignore, `Enter` save, `T` translate, `E` explain, `P`/`S` speak the word or sentence, `L` listen, `N`/`B` next or previous page.

**Content**
- 8 original German starter lessons, graded A1 → B2.
- Import pasted text, a web article by URL (the article text is extracted automatically), or `.txt`/`.srt`/`.vtt` files (subtitles from shows or YouTube). Long texts are split into parts.
- **Generate a story** with Claude: pick the level, topic, style and length. It can weave in the words you're currently learning.
- **Simplify** rewrites any lesson at an easier CEFR level.
- The library shows each lesson's **% new words**, so you can pick texts where about 5–15% of the words are new.

**Review**: FSRS spaced repetition. Cards show the word in the sentence where you found it, in three modes: *Meaning*, *Cloze* (type the missing word) and *Listening*.

**Progress**: known words, estimated CEFR level, a daily LingQ goal, streak, words read, reading time, a 90-day known-words chart and an activity heatmap. The vocabulary page exports to CSV that imports into Anki.

## Stack

- **Next.js 16** (App Router): the UI, plus route handlers for the Claude calls and URL import.
- **Convex**: all data (lessons, vocabulary, SRS state, daily stats, settings, AI response cache). Queries are live, so status changes show up everywhere immediately.
- **Claude Haiku 4.5**. The Haiku calls run in the Next.js server on your machine, because the subscription path needs your local Claude Code login.

## Setup

Requirements: Node 20.9+ and a Claude Pro or Max subscription (or an Anthropic API key).

```bash
npm install
npm run dev
```

On the first run, `convex dev` asks where to run Convex. You can run it locally without an account, or create a free cloud project. It writes `NEXT_PUBLIC_CONVEX_URL` to `.env.local` and then starts Next.js on http://localhost:3000. The library fills with starter lessons the first time you open it.

### Using your Claude subscription

When `ANTHROPIC_API_KEY` is not set, Beam calls Haiku through the [Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk), which runs Claude Code with your subscription login. Log in once:

- Run `claude` (Claude Code) and sign in with your Claude account, **or**
- run `claude setup-token` and put the token in `.env.local` as `CLAUDE_CODE_OAUTH_TOKEN=...`.

Then open **Settings → Claude → Test** to confirm it works.

Each subscription call starts a Claude Code process, so a detailed word lookup takes a few seconds. The page-level gloss prefetch covers most of that wait: hovering or clicking a word shows its meaning right away, and the full breakdown fills in after. Every answer is cached in Convex, so the same word in the same sentence is never looked up twice. Background prefetching always leaves one slot free for your clicks.

The subscription path is for your own personal use on your own machine. Anthropic doesn't allow third-party products to offer claude.ai login to other users, so don't host Beam for other people this way.

### Using an API key instead

Put `ANTHROPIC_API_KEY=sk-ant-...` in `.env.local`. Requests go straight to the Messages API, which answers in about a second, and are billed per token. Haiku lookups are cheap.

### Configuration

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_CONVEX_URL` | set by `convex dev` | Convex deployment URL |
| `ANTHROPIC_API_KEY` | — | Use the API instead of the subscription |
| `CLAUDE_CODE_OAUTH_TOKEN` | — | Subscription token from `claude setup-token` |
| `BEAM_AI_PROVIDER` | auto | Force `subscription`, `api` or `mock` |
| `BEAM_MODEL` | `claude-haiku-4-5` | Model for all lookups |
| `BEAM_AI_CONCURRENCY` | `4` | Max simultaneous Claude calls |

Beam has no user accounts: it's a single-user app. If you deploy Convex to the cloud, treat the deployment URL as private, or add authentication first.

## Development

```bash
npm test            # unit tests + Convex function tests (convex-test, in memory)
npm run typecheck   # app and convex/ projects
```

End-to-end smoke test (Playwright). It runs the real Convex functions on an in-memory stand-in backend and uses mock AI answers, so it needs no network:

```bash
npm run e2e:next    # terminal 1: Next.js with the Convex client swapped for test shims
npm run e2e         # terminal 2: fresh backend + browser walkthrough of every screen
```

Layout:

```
app/                 pages (home, library, read/[id], review, vocab, settings) and API routes
components/reader/   the reader and word panel
convex/              schema and functions (lessons, words, review, stats, settings, aiCache, seed)
lib/text.ts          tokenizer, German sentence splitter, pagination (shared by client and Convex)
lib/fsrs.ts          FSRS scheduler
lib/ai/              Claude provider (subscription / API / mock), prompts and response types
e2e/                 stand-in backend, client shims and the smoke test
```

Other target languages (Spanish, French, Italian, Portuguese, Dutch) already work through imports and AI stories. Switch the language in Settings. Only German has starter lessons so far.
