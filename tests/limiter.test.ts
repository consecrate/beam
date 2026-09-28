import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { createLimiter } = await import("../lib/ai/provider");

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
};
const tick = () => new Promise((r) => setTimeout(r, 0));

describe("AI concurrency limiter", () => {
  it("never exceeds the limit and keeps one slot free for interactive calls", async () => {
    const limit = createLimiter(3);
    let active = 0;
    let peak = 0;
    const gates: ReturnType<typeof deferred>[] = [];
    const started: string[] = [];
    const job = (name: string, priority: "interactive" | "background") => {
      const gate = deferred();
      gates.push(gate);
      return limit(priority, async () => {
        started.push(name);
        active++;
        peak = Math.max(peak, active);
        await gate.promise;
        active--;
      });
    };

    const all = [job("b1", "background"), job("b2", "background"), job("b3", "background"), job("b4", "background")];
    await tick();
    expect(started).toEqual(["b1", "b2"]); // background capped at max - 1
    all.push(job("click", "interactive"));
    await tick();
    expect(started).toEqual(["b1", "b2", "click"]); // interactive takes the reserved slot
    gates[0].resolve();
    await tick();
    expect(started).toEqual(["b1", "b2", "click", "b3"]);
    gates.forEach((g) => g.resolve());
    await Promise.all(all);
    expect(started).toHaveLength(5);
    expect(peak).toBeLessThanOrEqual(3);
  });
});
