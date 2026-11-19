// ─────────────────────────────────────────────────────────────────────────────
// HOOK: no-fixed-test-data        (PreToolUse · Write|Edit · test files only)
//
// Blocks a test edit that ADDS a hard-coded account email, e.g.
//   email: "ann@example.com"   |   "email", "ann@example.com"
//   getByLabel("Email").fill("ann@example.com")   |   const email = "x@y.com"
//
// Why: customers are unique by email and every suite shares one database
// (Playwright web specs even run in parallel). A fixed email passes once and
// then fails with "email already registered", or collides with another test.
// Generate it instead: `e2e-${Date.now()}-${Math.random()...}@example.com`
// (TS) or "x-" + UUID.randomUUID() + "@example.com" (Java), or use the
// helpers in apps/web/e2e/auth.ts.
//
// Contact fields that don't identify an account (e.g. receiverEmail on an
// order) are allowed. Only lines the edit adds are checked. Exit 2 = edit
// blocked and the reason is shown to Claude.
// ─────────────────────────────────────────────────────────────────────────────

import { addedLines, block, isTestFile, readPayload } from "./lib/test-edit.mjs";

// A string literal that is a plain email: no ${...} interpolation, no concatenation inside.
const LITERAL_EMAIL = /(["'`])[^"'`$\s]+@[^"'`$\s]+\.[A-Za-z]{2,}\1/;

// Contexts where that literal is the identity of an account (register/login).
const ACCOUNT_CONTEXT = [
  /(?<![A-Za-z])email\s*[:=]/, // { email: "..." }  /  email = "..."
  /["']email["']\s*,/, // Map.of("email", "...")
  /getByLabel\(\s*["'`]Email["'`][^)]*\)\s*\.fill\(/i, // form field
  /\.(register|login|signUp|signIn)\w*\s*\(/i, // helper(…, "a@b.com")
];

const payload = await readPayload();
const file = payload.tool_input?.file_path;
if (!file || !isTestFile(file)) process.exit(0);

const hits = addedLines(payload)
  .filter(({ text }) => LITERAL_EMAIL.test(text) && ACCOUNT_CONTEXT.some((re) => re.test(text)))
  .map(({ text }) => `  • ${text}`);

if (hits.length) {
  block(`
Blocked by hook no-fixed-test-data: this test edit adds a hard-coded account email.
${hits.join("\n")}

Accounts are unique by email and all tests share one database, so a fixed email
fails on the second run or collides with a parallel test. Generate a unique one:
  • TypeScript: \`e2e-\${Date.now()}-\${Math.floor(Math.random() * 1e6)}@example.com\`
    (or use registerCustomerViaApi / createAccountAtCheckout from apps/web/e2e/auth.ts)
  • Java: "x-" + UUID.randomUUID() + "@example.com"
`);
}
