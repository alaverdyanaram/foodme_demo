// ─────────────────────────────────────────────────────────────────────────────
// HOOK: require-assertions        (PostToolUse · Write|Edit · test files only)
//
// After a test file is saved, reads the whole file and reports every test that
// contains no assertion:
//   • Playwright / Vitest: each test(...) / it(...) body must contain expect(...),
//     expect.poll / expect.soft, .toPass(...) or assert...(...).
//   • JUnit: each @Test method must contain andExpect(...), assert...(...),
//     assertThat(...), verify(...) or fail(...).
//
// Why: a test without an assertion can only fail if something crashes, so it
// stays green while the behaviour it claims to cover is broken.
//
// This runs after the save (the whole file is needed, and it lets a test be
// written in two steps). It can't undo the write: exit 2 sends the list back to
// Claude, which must add assertions before moving on. If a test really asserts
// through a helper, put `// assertions: <helper name>` inside its body.
// ─────────────────────────────────────────────────────────────────────────────

import { existsSync, readFileSync } from "node:fs";
import { block, isTestFile, normalize, readPayload } from "./lib/test-edit.mjs";

const JS_ASSERT = /\bexpect(\.(poll|soft))?\s*\(|\.toPass\s*\(|\bassert\w*\s*\(|\/\/\s*assertions:/;
const JAVA_ASSERT = /\.andExpect\s*\(|\bassert\w*\s*\(|\bverify\s*\(|\bfail\s*\(|\/\/\s*assertions:/;

/** Index of the brace matching the "{" at `open`, skipping strings and comments. */
function matchBrace(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    const next = src[i + 1];
    if (c === "/" && next === "/") { i = src.indexOf("\n", i); if (i < 0) return -1; continue; }
    if (c === "/" && next === "*") { i = src.indexOf("*/", i + 2) + 1; if (i <= 0) return -1; continue; }
    if (c === '"' || c === "'" || c === "`") {
      for (i++; i < src.length && src[i] !== c; i++) if (src[i] === "\\") i++;
      continue;
    }
    if (c === "{") depth++;
    if (c === "}" && --depth === 0) return i;
  }
  return -1;
}

const lineOf = (src, index) => src.slice(0, index).split("\n").length;

function jsTests(src) {
  const found = [];
  // test("..", ...) / it("..", ...) and test.only / test.fixme(...) — not describe/beforeEach/step/skip.
  const re = /(?<![\w.])(test|it)(\.(only|fixme|fail|slow))?\s*\(\s*(["'`])((?:\\.|(?!\4).)*)\4/g;
  for (let m; (m = re.exec(src)); ) {
    const arrow = src.indexOf("=>", re.lastIndex);
    const fn = src.indexOf("function", re.lastIndex);
    let start = [arrow, fn].filter((x) => x >= 0).sort((a, b) => a - b)[0];
    if (start === undefined) continue;
    if (start === fn) start = src.indexOf(")", start);
    const open = src.indexOf("{", start);
    const close = open >= 0 ? matchBrace(src, open) : -1;
    if (close < 0) continue;
    found.push({ name: m[5], line: lineOf(src, m.index), body: src.slice(open, close + 1) });
  }
  return found;
}

function javaTests(src) {
  const found = [];
  const re = /@Test\b[\s\S]*?\bvoid\s+(\w+)\s*\([^)]*\)[^{;]*\{/g;
  for (let m; (m = re.exec(src)); ) {
    const open = re.lastIndex - 1;
    const close = matchBrace(src, open);
    if (close < 0) continue;
    found.push({ name: m[1], line: lineOf(src, m.index), body: src.slice(open, close + 1) });
  }
  return found;
}

const payload = await readPayload();
const file = payload.tool_input?.file_path ?? payload.tool_response?.filePath;
if (!file || !isTestFile(file) || !existsSync(file)) process.exit(0);

const src = readFileSync(file, "utf8");
const isJava = file.endsWith(".java");
const tests = isJava ? javaTests(src) : jsTests(src);
const missing = tests.filter((t) => !(isJava ? JAVA_ASSERT : JS_ASSERT).test(t.body));

if (missing.length) {
  block(`
Hook require-assertions: ${normalize(file).split("/apps/").pop()} has ${missing.length} test(s) without an assertion.
${missing.map((t) => `  • line ${t.line}: ${t.name}`).join("\n")}

A test with no assertion stays green even when the behaviour is broken. Add a
check on the outcome the test is about:
  • Playwright/Vitest: await expect(...).toHaveText(...) / toBe(...) / toHaveURL(...)
  • JUnit + MockMvc: .andExpect(status().isOk()).andExpect(jsonPath("$.field").value(...))
If the assertions live in a helper the test calls, add  // assertions: <helper>  in the test body.
`);
}
