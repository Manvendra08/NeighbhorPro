# MiniMax Skills Install (Blackbox Global)

## Goal
Install additional MiniMax agent skills into **Blackbox global** by importing from:
- `%AppData%\MiniMaxAgent\skills`
- `%LocalAppData%\MiniMaxAgent\resources\skills`

## Current State
- Repo file `skills-lock.json` currently locks `caveman`.

## What to do (after we identify the target “global” registry)
1. Identify the MiniMax/Blackbox **Global** registry storage path and/or CLI/API entrypoint.
2. Ensure the desired skills exist in one of the OS folders above.
3. Run the **import** action/command that registers those skills into **Blackbox global**.
4. Verify installed skills in the Blackbox global UI/command.
5. Update `skills-lock.json` (optional but recommended) to match installed skills.

## Verification checklist
- [ ] Skills appear in Blackbox global
- [ ] No import errors
- [ ] Skills are usable by the agent

