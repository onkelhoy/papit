---
name: papit-planner
description: How to read the papit GitHub backlog and shape raw ideas, bugs and audit findings into well-defined GitHub issues (INVEST-checked, titled so they work as branch names, with milestone and labels), then file them via gh once confirmed. Load for any backlog, issue or planning work.
---

# Planner

Load `papit-global` first.

## Scope
Process only. You never write or edit code. You:
- **read**: summarise the open backlog, find the issue behind a request, report which issues a branch would close
- **shape**: turn an idea, bug report or audit finding into a well-defined issue
- **file**: create/edit issues once the user confirms the draft
- **plan**: propose an order of work across issues when asked

## Tooling
GitHub CLI against `onkelhoy/papit`:
```bash
gh issue list --state open --limit 100
gh issue view <n> --comments
gh issue create --title "<title>" --body-file <file> [--label bug] [--milestone "<name>"]
gh issue edit <n> --add-label ... --milestone ...
gh issue comment <n> --body "..."
```
If `gh` is missing or unauthenticated (`gh auth status`), say so plainly and stop: "run `brew install gh` then `! gh auth login`". Reading the public repo through `curl https://api.github.com/repos/onkelhoy/papit/issues` is fine as a read-only fallback. **Never** pretend an issue was filed.

## Issue shape
- **Title**: short, lowercase, works as the branch short-name after `{TYPE}/{N}-` (existing style: `input`, `game-engine`, `drag list`, `language picker`). Name the subject, e.g. `switch space key`, not `fix bug`.
- **Body**: minimal. The implementing agent figures out the how.
  ```markdown
  <1–3 lines: what and why. For bugs: what happens vs what should, plus a minimal repro.>

  package: @papit/<name>            ← one line per affected package

  ## acceptance
  - <observable outcome>
  - tests + README + description updated (definition of done)
  ```
  Skip `## acceptance` for spikes, where the deliverable is a decision written to a doc.
- **Labels**: `bug` for defects, `enhancement` for improvements to something existing, `documentation` for docs-only. New packages need no label.
- **Milestone**: when one fits: `monorepo core` (tooling, engine, cross-cutting), `form` (form controls), `language`, `showcase`.

## Granularity: one issue per concrete thing
- One package per issue by default, since a branch lands one issue. A bug in `@papit/web-component` that breaks every component is **one** engine issue, not one per component.
- Don't bundle unrelated findings because they came from the same audit. Issues #82 and #83 are the anti-pattern: long lists no single branch can close. When touching them, propose splitting them into per-package issues and linking them back.
- Split when INVEST's **Small** fails, e.g. "input + select + textarea" → three issues.
- Unknown scope → a spike issue first, build issues after it concludes.

## INVEST check
Independent, Negotiable, Valuable, Estimable, Small, Testable. If an issue has no observable acceptance, it isn't ready.

## Filing
Always draft the full issue(s) and show them before creating anything. Batch drafts in one message when there are several. After filing, report number + URL for each. That number is the `TICKET-ID` for the branch.

## Known sources to turn into issues
- `CONSID-FINDINGS.md` at the repo root (untracked): six findings from wrapping `@papit/button` in React. #1 is a blocker in `@papit/web-component` (constructor-time `setAttribute`).
- The definition-of-done backlog in `papit-testing` (stub tests) and `papit-documentation` (template READMEs, bad descriptions). Group these per package: "switch: definition of done", not one issue per missing file.
