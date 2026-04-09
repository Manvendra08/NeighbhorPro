# Local Claude Settings

Copy `.claude/settings.local.json.template` to `.claude/settings.local.json` and fill in your local allow rules.

Recommended pattern:

1. Keep `permissions.allow` limited to the exact commands you need on your machine.
2. Prefer relative paths or repo-scoped commands instead of absolute user paths.
3. Do not commit `.claude/settings.local.json`.

Example:

```json
{
  "permissions": {
    "allow": [
      "Bash(git -C ./ log --oneline -5)"
    ]
  }
}
```
