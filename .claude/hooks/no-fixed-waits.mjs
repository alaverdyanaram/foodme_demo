// ─────────────────────────────────────────────────────────────────────────────
// HOOK: no-fixed-waits            (PreToolUse · Write|Edit · test files only)
//
// Blocks a test edit that ADDS a fixed sleep: Playwright `waitForTimeout(...)`,
// Java `Thread.sleep(...)` / `TimeUnit.X.sleep(...)`, or an awaited
// `setTimeout` used as a delay.
//
// Why: the backend adds 200–1500 ms of random latency to every API call, so a
// fixed wait is either too short (flaky) or too long (slow). Wait for the
// outcome instead: Playwright web-first assertions (`expect(locator)
// .toBeVisible()`, `toHaveURL`, `page.waitForResponse`), `expect.poll`, or
// Awaitility-style polling in Java.
//
// Only lines the edit adds are checked, so the course's existing planted
// flaky tests (FM-FLAKE-xx) can still be edited. Exit 2 = edit blocked and the
// reason is shown to Claude.
// ─────────────────────────────────────────────────────────────────────────────

import { addedLines, block, isTestFile, readPayload } from "./lib/test-edit.mjs";

const RULES = [
  { re: /\bwaitForTimeout\s*\(/, what: "page.waitForTimeout(...)" },
  { re: /\bThread\s*\.\s*sleep\s*\(/, what: "Thread.sleep(...)" },
  { re: /\bTimeUnit\s*\.\s*\w+\s*\.\s*sleep\s*\(/, what: "TimeUnit.*.sleep(...)" },
  { re: /new\s+Promise\s*\(.*setTimeout\s*\(/, what: "new Promise(r => setTimeout(r, ms))" },
  { re: /\bawait\s+(sleep|delay|wait)\s*\(\s*\d/, what: "await sleep/delay(<ms>)" },
];

const payload = await readPayload();
const file = payload.tool_input?.file_path;
if (!file || !isTestFile(file)) process.exit(0);

const hits = [];
for (const { text } of addedLines(payload)) {
  for (const { re, what } of RULES) if (re.test(text)) hits.push(`  • ${what}:  ${text}`);
}

if (hits.length) {
  block(`
Blocked by hook no-fixed-waits: this test edit adds a fixed sleep.
${hits.join("\n")}

FoodMe's API latency is random (200–1500 ms), so fixed waits make tests flaky or slow.
Wait for the outcome instead:
  • Playwright: await expect(locator).toBeVisible() / toHaveText() / toHaveURL(),
    or await page.waitForResponse(r => r.url().includes("/api/...")).
  • Polling a value: await expect.poll(() => ...).toBe(...).
  • Java: assert on the result directly (MockMvc is synchronous), or poll with a timeout.
`);
}
