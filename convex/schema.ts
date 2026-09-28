import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const srsValidator = v.object({
  stability: v.number(),
  difficulty: v.number(),
  reps: v.number(),
  lapses: v.number(),
  state: v.union(v.literal(0), v.literal(1), v.literal(2), v.literal(3)),
  lastReview: v.optional(v.number()),
});

export const lessonSource = v.union(
  v.literal("starter"),
  v.literal("paste"),
  v.literal("file"),
  v.literal("url"),
  v.literal("ai"),
  v.literal("simplified"),
);

export default defineSchema({
  // Lesson metadata; kept small so the library list stays cheap.
  lessons: defineTable({
    lang: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    level: v.optional(v.string()),
    source: lessonSource,
    sourceUrl: v.optional(v.string()),
    collection: v.optional(v.string()),
    wordCount: v.number(),
    uniqueCount: v.number(),
    progressPage: v.number(),
    pageCount: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    lastOpenedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_lang_created", ["lang", "createdAt"])
    .index("by_lang_opened", ["lang", "lastOpenedAt"]),

  // Lesson text and vocabulary keys, split out of `lessons` to keep lists light.
  lessonBodies: defineTable({
    lessonId: v.id("lessons"),
    text: v.string(),
    terms: v.array(v.string()),
  }).index("by_lesson", ["lessonId"]),

  // A word or phrase the learner has seen. Terms absent from this table are "new".
  // status: 1-4 learning (LingQ strength), 5 known, 0 ignored.
  words: defineTable({
    lang: v.string(),
    term: v.string(),
    isPhrase: v.boolean(),
    status: v.number(),
    translation: v.optional(v.string()),
    notes: v.optional(v.string()),
    lemma: v.optional(v.string()),
    pos: v.optional(v.string()),
    gender: v.optional(v.string()),
    context: v.optional(v.string()),
    lessonId: v.optional(v.id("lessons")),
    srs: v.optional(srsValidator),
    srsDue: v.optional(v.number()),
    searchText: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    knownAt: v.optional(v.number()),
  })
    .index("by_term", ["lang", "term"])
    .index("by_due", ["lang", "srsDue"])
    .index("by_status", ["lang", "status", "updatedAt"])
    .index("by_updated", ["lang", "updatedAt"])
    .index("by_phrase", ["lang", "isPhrase"])
    .searchIndex("search", { searchField: "searchText", filterFields: ["lang", "status"] }),

  // Running totals per language, maintained by every status change.
  counts: defineTable({
    lang: v.string(),
    known: v.number(),
    learning: v.number(),
    ignored: v.number(),
  }).index("by_lang", ["lang"]),

  // Activity per local calendar day.
  daily: defineTable({
    lang: v.string(),
    date: v.string(),
    knownAdded: v.number(),
    lingqsCreated: v.number(),
    wordsRead: v.number(),
    reviews: v.number(),
    minutes: v.number(),
    lessonsCompleted: v.number(),
  }).index("by_lang_date", ["lang", "date"]),

  settings: defineTable({
    targetLang: v.string(),
    nativeLang: v.string(),
    dailyGoal: v.number(),
    autoKnownOnPageTurn: v.boolean(),
    hoverTranslations: v.boolean(),
    showGenderColors: v.boolean(),
    ttsRate: v.number(),
    ttsVoice: v.optional(v.string()),
    fontSize: v.number(),
    theme: v.union(v.literal("system"), v.literal("light"), v.literal("dark")),
  }),

  // Cached Claude responses keyed by a hash of the request.
  aiCache: defineTable({
    key: v.string(),
    kind: v.string(),
    value: v.any(),
    createdAt: v.number(),
  }).index("by_key", ["key"]),
});
