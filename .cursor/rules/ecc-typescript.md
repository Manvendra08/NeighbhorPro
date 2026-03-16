---
description: ECC TypeScript/React rules (concise). Applies to TS/JS/TSX/JSX. Prefer explicit types on public APIs, avoid any, safe unknown narrowing, immutable updates, and schema validation for untrusted input. For full details consult _agent/rules/typescript/*.md.
globs: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"]
alwaysApply: true
---

## ECC TypeScript / React (project)

- **Types on public APIs**: exported functions/components should have readable types; allow inference for locals.
- **Avoid `any`**: use `unknown` for untrusted input and narrow safely.
- **React props**: use a named `type`/`interface` for props; don’t default to `React.FC`.
- **Immutable updates**: no in-place mutation (especially state).
- **Validation**: use schema validation (e.g. Zod) at boundaries; infer types from schemas.
- **No `console.log` in prod code**: remove debug logs before finishing.

Full canon:
- `_agent/rules/typescript/coding-style.md`
- `_agent/rules/typescript/security.md`
- `_agent/rules/typescript/testing.md`

