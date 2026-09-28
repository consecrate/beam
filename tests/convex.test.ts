import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

const modules = import.meta.glob("../convex/**/*.ts");
const DATE = "2026-09-28";
const setup = () => convexTest(schema, modules);

describe("lessons", () => {
  it("seeds starter lessons once and reports coverage", async () => {
    const t = setup();
    expect(await t.mutation(api.seed.ensureStarterLessons, { lang: "de" })).toBe(8);
    expect(await t.mutation(api.seed.ensureStarterLessons, { lang: "de" })).toBe(0);
    const list = await t.query(api.lessons.list, { lang: "de" });
    expect(list).toHaveLength(8);
    expect(list[0].title).toBe("Hallo! Ich heiße Lena.");
    const cov = await t.query(api.lessons.coverage, { id: list[0]._id });
    expect(cov!.newPct).toBe(100);
  });

  it("splits long imports into numbered parts", async () => {
    const t = setup();
    const text = Array.from({ length: 40 }, (_, i) => `Absatz ${i}. ` + "Das ist gut. ".repeat(30)).join("\n\n");
    const id = await t.mutation(api.lessons.create, { lang: "de", title: "Buch", text, source: "paste" });
    const list = await t.query(api.lessons.list, { lang: "de" });
    expect(list.length).toBeGreaterThan(1);
    const first = await t.query(api.lessons.get, { id });
    expect(first!.title).toMatch(/^Buch \(1\/\d+\)$/);
  });
});

describe("words", () => {
  it("tracks statuses, counts, daily stats and the review queue", async () => {
    const t = setup();
    const lessonId = await t.mutation(api.lessons.create, { lang: "de", title: "T", text: "Der Hund fängt an zu bellen.", source: "paste" });

    await t.mutation(api.words.setStatus, { lang: "de", term: "Hund", status: 1, date: DATE, translation: "dog", context: "Der Hund fängt an zu bellen.", lessonId, gender: "m" });
    await t.mutation(api.words.setStatus, { lang: "de", term: "fängt an", status: 1, date: DATE, translation: "starts" });
    const changed = await t.mutation(api.words.markNewAsKnown, { lang: "de", terms: ["der", "hund", "fängt", "an", "zu", "bellen"], date: DATE, lessonId });
    expect(changed.sort()).toEqual(["an", "bellen", "der", "fängt", "zu"]);

    const data = await t.query(api.words.forLesson, { lessonId });
    const byTerm = new Map(data!.words.map((w) => [w.term, w]));
    expect(byTerm.get("hund")).toMatchObject({ status: 1, translation: "dog", gender: "m" });
    expect(byTerm.get("bellen")!.status).toBe(5);
    expect(data!.phrases).toEqual([{ term: "fängt an", status: 1, translation: "starts" }]);

    let dash = await t.query(api.stats.dashboard, { lang: "de", today: DATE });
    expect(dash).toMatchObject({ known: 5, learning: 2, streak: 1 });
    expect(dash.today).toMatchObject({ knownAdded: 5, lingqsCreated: 2 });

    // Undo the page turn.
    await t.mutation(api.words.undoMarkKnown, { lang: "de", terms: changed, date: DATE });
    dash = await t.query(api.stats.dashboard, { lang: "de", today: DATE });
    expect(dash.known).toBe(0);
    expect(dash.today.knownAdded).toBe(0);

    // Review: both LingQs are due; Good raises the status and schedules ahead.
    const due = await t.query(api.review.due, { lang: "de", now: Date.now() + 1000 });
    expect(due.map((w) => w.term).sort()).toEqual(["fängt an", "hund"]);
    const hund = due.find((w) => w.term === "hund")!;
    const res = await t.mutation(api.review.rate, { id: hund._id, rating: 3, date: DATE });
    expect(res.due).toBeGreaterThan(Date.now());
    expect((await t.query(api.words.get, { lang: "de", term: "hund" }))!.status).toBe(2);

    // Marking known removes it from reviews and updates counts.
    await t.mutation(api.review.rate, { id: hund._id, rating: 4, date: DATE, markKnown: true });
    const after = await t.query(api.words.get, { lang: "de", term: "hund" });
    expect(after!.status).toBe(5);
    expect(after!.srsDue).toBeUndefined();
    dash = await t.query(api.stats.dashboard, { lang: "de", today: DATE });
    expect(dash).toMatchObject({ known: 1, learning: 1 });
    expect(dash.today.reviews).toBe(2);
  });

  it("lists, searches and exports vocabulary", async () => {
    const t = setup();
    await t.mutation(api.words.setStatus, { lang: "de", term: "Schlüssel", status: 2, date: DATE, translation: "key" });
    await t.mutation(api.words.setStatus, { lang: "de", term: "Treppe", status: 5, date: DATE });
    expect((await t.query(api.words.list, { lang: "de", filter: "learning" })).map((w) => w.term)).toEqual(["schlüssel"]);
    expect((await t.query(api.words.list, { lang: "de", filter: "known" })).map((w) => w.term)).toEqual(["treppe"]);
    expect((await t.query(api.words.list, { lang: "de", filter: "all" })).length).toBe(2);
    expect((await t.query(api.words.list, { lang: "de", filter: "all", search: "key" })).map((w) => w.term)).toEqual(["schlüssel"]);
    expect(await t.query(api.words.exportLearning, { lang: "de", includeKnown: false })).toHaveLength(1);
    expect(await t.query(api.words.forStory, { lang: "de" })).toEqual([{ term: "schlüssel", translation: "key" }]);
  });
});

describe("settings, cache, streaks", () => {
  it("merges settings with defaults", async () => {
    const t = setup();
    expect((await t.query(api.settings.get, {})).targetLang).toBe("de");
    await t.mutation(api.settings.update, { fontSize: 25 });
    await t.mutation(api.settings.update, { theme: "dark" });
    expect(await t.query(api.settings.get, {})).toMatchObject({ fontSize: 25, theme: "dark", dailyGoal: 20 });
  });

  it("stores and reads AI cache entries", async () => {
    const t = setup();
    await t.mutation(api.aiCache.putMany, { entries: [{ key: "a", kind: "word", value: { translation: "x" } }] });
    expect(await t.query(api.aiCache.getMany, { keys: ["a", "b"] })).toEqual({ a: { translation: "x" } });
  });

  it("counts consecutive active days", async () => {
    const t = setup();
    for (const date of ["2026-09-25", "2026-09-26", "2026-09-27"]) {
      await t.mutation(api.stats.logActivity, { lang: "de", date, wordsRead: 100 });
    }
    expect((await t.query(api.stats.dashboard, { lang: "de", today: "2026-09-28" })).streak).toBe(3);
    await t.mutation(api.stats.logActivity, { lang: "de", date: "2026-09-28", minutes: 2 });
    expect((await t.query(api.stats.dashboard, { lang: "de", today: "2026-09-28" })).streak).toBe(3);
    await t.mutation(api.stats.logActivity, { lang: "de", date: "2026-09-28", wordsRead: 10 });
    expect((await t.query(api.stats.dashboard, { lang: "de", today: "2026-09-28" })).streak).toBe(4);
  });
});
