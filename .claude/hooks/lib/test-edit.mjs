// Shared helpers for the test-quality hooks in .claude/hooks/.
// Reads the hook payload from stdin, decides whether the edited file is a test,
// and works out which lines the Write/Edit is *adding* (so lines that already
// exist, such as the course's planted FM-FLAKE code, never trigger a block).

import { existsSync, readFileSync } from "node:fs";

export async function readPayload() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

const TEST_FILE_PATTERNS = [
  /\/apps\/(web|admin)\/e2e\/.+\.(ts|js)$/, // Playwright specs and helpers
  /\/apps\/backend\/src\/test\/.+\.java$/, // JUnit tests
  /\.(test|spec)\.(t|j)sx?$/, // Vitest / any *.test.ts(x) / *.spec.ts(x)
];

export function normalize(path = "") {
  return path.replace(/\\/g, "/");
}

export function isTestFile(path) {
  const p = normalize(path);
  return TEST_FILE_PATTERNS.some((re) => re.test(p));
}

/** Lines the tool call adds that were not there before (trimmed, comments skipped). */
export function addedLines(payload) {
  const input = payload.tool_input ?? {};
  const pairs = [];
  if (payload.tool_name === "Write") {
    const before = existsSync(input.file_path) ? readFileSync(input.file_path, "utf8") : "";
    pairs.push([before, input.content ?? ""]);
  } else if (Array.isArray(input.edits)) {
    for (const e of input.edits) pairs.push([e.old_string ?? "", e.new_string ?? ""]);
  } else {
    pairs.push([input.old_string ?? "", input.new_string ?? ""]);
  }

  const result = [];
  for (const [before, after] of pairs) {
    const existing = new Set(before.split(/\r?\n/).map((l) => l.trim()));
    after.split(/\r?\n/).forEach((line, i) => {
      const t = line.trim();
      if (!t || existing.has(t) || /^(\/\/|\*|\/\*)/.test(t)) return;
      result.push({ text: t, index: i + 1 });
    });
  }
  return result;
}

/** Block the tool call: exit code 2 sends the message back to Claude. */
export function block(message) {
  process.stderr.write(message.trim() + "\n");
  process.exit(2);
}
