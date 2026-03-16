---
name: ecc
description: Apply Everything-Claude-Code style workflows and standards in this repo. Use when planning/implementing features, writing or reviewing React/TypeScript code, doing security review, TDD, verification loops, or when the user references ECC / Everything Claude Code. This skill routes to the repo’s local ECC library under _agent/skills/ and _agent/rules/.
---

# ECC (Everything Claude Code) for this repo

This repository already includes an ECC-style library under `_agent/` (untracked in git status at session start). Use it as the source of truth for workflows and checklists.

## Quick routing (read these when relevant)

- **Coding standards / style**: `_agent/skills/coding-standards/SKILL.md`
- **Frontend patterns (React)**: `_agent/skills/frontend-patterns/SKILL.md`
- **Backend patterns (if adding APIs)**: `_agent/skills/backend-patterns/SKILL.md`
- **Security review checklist**: `_agent/skills/security-review/SKILL.md`
- **TDD workflow**: `_agent/skills/tdd-workflow/SKILL.md`
- **Verification loop**: `_agent/skills/verification-loop/SKILL.md`
- **E2E testing (Playwright patterns)**: `_agent/skills/e2e-testing/SKILL.md`
- **Performance / cost awareness**: `_agent/skills/cost-aware-llm-pipeline/SKILL.md`

## Repo standards (rules)

When you need the “always follow” rules, consult:

- `_agent/rules/common/*.md`
- `_agent/rules/typescript/*.md`

Prefer the repo’s local rules over generic advice when they conflict.

## Default workflow for changes in this repo

When implementing a non-trivial change:

1. **Plan**: identify files/components impacted; prefer small cohesive modules.
2. **Security**: if touching auth, Firestore, user input, or secrets, read `_agent/skills/security-review/SKILL.md` first.
3. **Tests**: follow `_agent/skills/tdd-workflow/SKILL.md` where practical.
4. **Verify**: run the repo’s build/lint/test commands (see `package.json` scripts) and fix issues.

