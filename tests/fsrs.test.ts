import { describe, expect, it } from "vitest";
import { newCard, previewIntervals, schedule } from "../lib/fsrs";

const DAY = 86_400_000;

describe("FSRS scheduling", () => {
  it("uses short learning steps for new cards and graduates on Good", () => {
    const now = Date.now();
    const again = schedule(newCard(), 1, now);
    expect(again.due - now).toBe(60_000);
    const good = schedule(newCard(), 3, now);
    expect(good.card.state).toBe(1);
    const graduated = schedule(good.card, 3, good.due);
    expect(graduated.card.state).toBe(2);
    expect(graduated.due - good.due).toBeGreaterThanOrEqual(DAY);
  });

  it("grows intervals with successful reviews and orders ratings", () => {
    let now = Date.now();
    let card = schedule(newCard(), 4, now).card;
    let last = 0;
    for (let i = 0; i < 5; i++) {
      now += 10 * DAY;
      const r = schedule(card, 3, now);
      expect(r.due - now).toBeGreaterThan(last);
      last = r.due - now;
      card = r.card;
    }
    const p = [1, 2, 3, 4].map((g) => schedule(card, g as 1 | 2 | 3 | 4, now + 30 * DAY).due);
    expect(p[0]).toBeLessThan(p[1]);
    expect(p[1]).toBeLessThan(p[2]);
    expect(p[2]).toBeLessThan(p[3]);
  });

  it("lapses move the card to relearning and count lapses", () => {
    const now = Date.now();
    const card = schedule(newCard(), 4, now).card;
    const r = schedule(card, 1, now + 5 * DAY);
    expect(r.card.state).toBe(3);
    expect(r.card.lapses).toBe(1);
    expect(r.card.stability).toBeLessThan(card.stability);
  });

  it("previews labels", () => {
    const labels = previewIntervals(newCard(), Date.now());
    expect(labels[1]).toBe("1m");
    expect(labels[3]).toBe("10m");
    expect(labels[4]).toMatch(/d$/);
  });
});
