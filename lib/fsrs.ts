// FSRS-4.5 spaced-repetition scheduler (Free Spaced Repetition Scheduler).
// Reference: https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm

export type Rating = 1 | 2 | 3 | 4; // Again, Hard, Good, Easy
export const RATING_LABELS: Record<Rating, string> = { 1: "Again", 2: "Hard", 3: "Good", 4: "Easy" };

/** 0 = new, 1 = learning, 2 = review, 3 = relearning */
export type CardState = 0 | 1 | 2 | 3;

export interface SrsCard {
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  state: CardState;
  lastReview?: number;
}

const W = [
  0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461,
  2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755,
];
const DECAY = -0.5;
const FACTOR = 19 / 81;
const DAY = 86_400_000;
const MINUTE = 60_000;

export const DEFAULT_RETENTION = 0.9;
const MAX_INTERVAL_DAYS = 3650;

export function newCard(): SrsCard {
  return { stability: 0, difficulty: 0, reps: 0, lapses: 0, state: 0 };
}

export function retrievability(elapsedDays: number, stability: number): number {
  if (stability <= 0) return 0;
  return Math.pow(1 + (FACTOR * elapsedDays) / stability, DECAY);
}

function intervalDays(stability: number, retention: number): number {
  const i = (stability / FACTOR) * (Math.pow(retention, 1 / DECAY) - 1);
  return Math.min(MAX_INTERVAL_DAYS, Math.max(1, Math.round(i)));
}

const clampD = (d: number) => Math.min(10, Math.max(1, d));
const initDifficulty = (g: Rating) => clampD(W[4] - (g - 3) * W[5]);
const initStability = (g: Rating) => Math.max(0.1, W[g - 1]);

function nextDifficulty(d: number, g: Rating): number {
  const next = d - W[6] * (g - 3);
  return clampD(W[7] * initDifficulty(4) + (1 - W[7]) * next);
}

function recallStability(d: number, s: number, r: number, g: Rating): number {
  const hard = g === 2 ? W[15] : 1;
  const easy = g === 4 ? W[16] : 1;
  return s * (1 + Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp((1 - r) * W[10]) - 1) * hard * easy);
}

function forgetStability(d: number, s: number, r: number): number {
  return Math.min(s, W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp((1 - r) * W[14]));
}

// Same-day review adjustment (the FSRS-5 short-term term with w17 = 0.5, w18 = 0).
function shortTermStability(s: number, g: Rating): number {
  return s * Math.exp(0.5 * (g - 3));
}

export interface ScheduleResult {
  card: SrsCard;
  due: number;
  /** Human-readable interval, e.g. "10m", "3d". */
  label: string;
}

/** Computes the next state of a card for a rating at time `now`. */
export function schedule(card: SrsCard, rating: Rating, now: number, retention = DEFAULT_RETENTION): ScheduleResult {
  let { stability: s, difficulty: d, reps, lapses, state } = card;
  let dueIn: number;

  if (state === 0) {
    d = initDifficulty(rating);
    s = initStability(rating);
    if (rating === 1) { dueIn = 1 * MINUTE; state = 1; }
    else if (rating === 2) { dueIn = 6 * MINUTE; state = 1; }
    else if (rating === 3) { dueIn = 10 * MINUTE; state = 1; }
    else { dueIn = intervalDays(s, retention) * DAY; state = 2; }
  } else if (state === 1 || state === 3) {
    // (Re)learning steps: short intervals until graduated with Good/Easy.
    s = shortTermStability(s, rating);
    d = nextDifficulty(d, rating);
    if (rating === 1) dueIn = 5 * MINUTE;
    else if (rating === 2) dueIn = 10 * MINUTE;
    else { dueIn = intervalDays(s, retention) * DAY; state = 2; }
  } else {
    const elapsed = card.lastReview ? Math.max(0, (now - card.lastReview) / DAY) : 0;
    const r = retrievability(elapsed, s);
    d = nextDifficulty(d, rating);
    if (rating === 1) {
      s = forgetStability(card.difficulty, s, r);
      lapses += 1;
      state = 3;
      dueIn = 10 * MINUTE;
    } else {
      s = recallStability(card.difficulty, s, r, rating);
      dueIn = intervalDays(s, retention) * DAY;
    }
  }

  reps += 1;
  return {
    card: { stability: s, difficulty: d, reps, lapses, state, lastReview: now },
    due: now + dueIn,
    label: formatInterval(dueIn),
  };
}

/** Previews the interval for every rating (for the answer buttons). */
export function previewIntervals(card: SrsCard, now: number): Record<Rating, string> {
  return {
    1: schedule(card, 1, now).label,
    2: schedule(card, 2, now).label,
    3: schedule(card, 3, now).label,
    4: schedule(card, 4, now).label,
  };
}

export function formatInterval(ms: number): string {
  if (ms < 60 * MINUTE) return `${Math.max(1, Math.round(ms / MINUTE))}m`;
  if (ms < DAY) return `${Math.round(ms / (60 * MINUTE))}h`;
  const days = ms / DAY;
  if (days < 30) return `${Math.round(days)}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}
