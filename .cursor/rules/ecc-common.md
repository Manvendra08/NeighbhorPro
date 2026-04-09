---
description: ECC common rules (concise). Applies repo-wide. Prefer immutability, small cohesive files, explicit error handling, and boundary validation. When uncertain, consult _agent/rules/common/*.md.
globs: ["**/*"]
alwaysApply: true
---

## ECC common (project)

- **Immutability**: avoid mutating objects/arrays; prefer creating new values.
- **Small cohesive files**: extract responsibilities; avoid “god components/modules”.
- **Error handling**: handle failures explicitly; no silent catches; present user-friendly messages in UI paths.
- **Validate at boundaries**: treat user input and external data as untrusted; validate early with clear errors.
- **Security hygiene**: never commit secrets; avoid logging sensitive data.

If you need the full canon, read:
- `_agent/rules/common/coding-style.md`
- `_agent/rules/common/development-workflow.md`
- `_agent/rules/common/security.md`

