// End-to-end smoke test. Needs `npm run e2e:backend` and `npm run e2e:next` running.
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = process.env.SHOTS || "e2e/shots";
const errors = [];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));
const step = (name) => console.log(`• ${name}`);
const expect = (cond, msg) => { if (!cond) throw new Error(`Assertion failed: ${msg}`); };

step("library lists starter lessons");
await page.goto(`${BASE}/library`);
await page.getByText("Hallo! Ich heiße Lena.").waitFor();
await page.getByText("100% new").first().waitFor({ timeout: 15000 }).catch(() => {});
await page.screenshot({ path: `${OUT}/1-library.png`, fullPage: true });

step("open lesson and select a word");
await page.getByText("Der verlorene Schlüssel").click();
await page.waitForURL(/\/read\//);
const reading = page.getByTestId("reading");
await reading.waitFor();
const word = reading.locator(".w", { hasText: /^Schlüssel$/ }).first();
await word.click();
await page.getByTestId("translation").waitFor();
const tr = await page.getByTestId("translation").textContent();
expect(tr && tr.length > 0, "translation shown");
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/2-reader-word.png` });

step("save LingQ with Enter, then set status 3 with the keyboard");
await page.keyboard.press("Enter");
await page.waitForFunction(() => document.querySelector(".w.sel")?.className.includes("s-1"));
await page.keyboard.press("3");
await page.waitForFunction(() => document.querySelector(".w.sel")?.className.includes("s-3"));

step("drag across words to make a phrase");
const w1 = reading.locator(".w", { hasText: /^fängt$/ }).first();
const w2 = reading.locator(".w", { hasText: /^Arbeit$/ }).first();
await w1.hover();
await page.mouse.down();
await w2.hover();
await page.mouse.up();
await page.getByText("phrase", { exact: false }).first().waitFor();
await page.getByRole("button", { name: "＋ Save as LingQ" }).click();
await page.waitForFunction(() => document.querySelectorAll(".w.in-phrase").length > 0 || document.querySelectorAll(".w.sel").length > 1);

step("sentence translate + explain");
await page.getByRole("button", { name: "Translate" }).click();
await page.getByText("Mock translation of the sentence.").first().waitFor();
await page.getByRole("button", { name: "Explain" }).click();
await page.getByText("Mock grammar point.").waitFor();
await page.screenshot({ path: `${OUT}/3-reader-phrase.png` });

step("next page marks new words known, with undo toast");
await page.keyboard.press("Escape");
const newBefore = await reading.locator(".w.s-new").count();
expect(newBefore > 0, "has new words");
await page.keyboard.press("n");
await page.getByText(/Marked \d+ words? as known/).waitFor();
await page.screenshot({ path: `${OUT}/4-reader-page2.png` });

step("finish the lesson");
for (let i = 0; i < 10; i++) {
  const btn = page.getByRole("button", { name: /Finish lesson|Next →/ });
  if (!(await btn.count())) break;
  const label = await btn.textContent();
  await btn.click();
  if (label.includes("Finish")) break;
  await page.waitForTimeout(300);
}
await page.getByText("Lesson complete!").waitFor();

step("review the LingQs");
await page.goto(`${BASE}/review`);
await page.getByTestId("flashcard").waitFor();
await page.screenshot({ path: `${OUT}/5-review-front.png` });
await page.keyboard.press(" ");
await page.getByRole("button", { name: /Good/ }).waitFor();
await page.screenshot({ path: `${OUT}/6-review-back.png` });
await page.keyboard.press("3");
await page.waitForTimeout(500);

step("cloze mode");
await page.getByRole("button", { name: "Cloze" }).click();
if (await page.getByLabel("Your answer").count()) {
  await page.getByLabel("Your answer").fill("fängt an");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/7-review-cloze.png` });
}

step("vocabulary");
await page.goto(`${BASE}/vocab`);
await page.locator(".vocab-table").waitFor();
await page.screenshot({ path: `${OUT}/8-vocab.png` });

step("dashboard");
await page.goto(`${BASE}/`);
await page.getByText("Known words").first().waitFor();
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/9-home.png`, fullPage: true });

step("settings + AI test");
await page.goto(`${BASE}/settings`);
await page.getByRole("button", { name: "Test" }).click();
await page.getByText(/✓/).first().waitFor();
await page.screenshot({ path: `${OUT}/10-settings.png`, fullPage: true });

step("generate a story");
await page.goto(`${BASE}/library`);
await page.getByRole("button", { name: "✨ Generate story" }).click();
await page.getByRole("button", { name: "✨ Generate", exact: true }).click();
await page.waitForURL(/\/read\//);
await page.getByText("Eine kleine Geschichte").waitFor();

step("import pasted text");
await page.goto(`${BASE}/library`);
await page.getByRole("button", { name: "＋ Import" }).click();
await page.getByPlaceholder("Paste German text here…").fill("Das ist ein Test. Ich lerne Deutsch mit Beam.");
await page.getByRole("button", { name: "Create lesson" }).click();
await page.waitForURL(/\/read\//);
await page.getByTestId("reading").waitFor();

step("mobile reader + dark mode");
const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: "dark" });
mobile.on("pageerror", (e) => errors.push(`mobile pageerror: ${e.message}`));
await mobile.goto(page.url());
await mobile.getByTestId("reading").waitFor();
await mobile.locator(".w").nth(3).click();
await mobile.waitForTimeout(600);
await mobile.screenshot({ path: `${OUT}/11-mobile-reader-dark.png` });
const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
expect(overflow <= 1, `no horizontal scroll on mobile (overflow ${overflow}px)`);

await browser.close();
const relevant = errors.filter((e) => !/Download the React DevTools|favicon/.test(e));
if (relevant.length) {
  console.log("\nBrowser errors:\n" + relevant.join("\n"));
  process.exit(1);
}
console.log("\nAll steps passed.");
