---
name: papit-merge-workflow
description: How to land a finished papit branch on main via GitHub. Rebase onto origin/main, squash the branch into one commit whose message is the formatted changelog with `closes: #N`, force-push, open a PR with gh, and merge with a merge commit so the issue auto-closes. Load when a branch is ready to land, i.e. the user has said "merge" / "that's enough" / "open the PR".
---

# Merge workflow

The end state on `main`, for every landed issue:
```
*   Merge pull request #106 from onkelhoy/feature/9-input      ← GitHub merge commit
|\
| * feature/9-input                                             ← ONE squashed commit, the changelog
|/
```
Each branch becomes exactly one commit carrying the full changelog, joined to `main` by GitHub's merge commit. The PR page keeps the discussion. The squash message keeps the history.

## Preconditions
- `gh` is installed and authenticated (`gh auth status`). If not, stop and ask the user to run `brew install gh` then `! gh auth login`. Never fake a PR.
- Working tree clean, all work committed on the branch.
- Definition of done met for every package touched (see `papit-global`). If not, say what's missing before merging.
- `npm run build` and the touched packages' `npm test` pass locally.

## 1. Review the branch
```bash
git fetch origin
git log --reverse --format='%s' origin/main..HEAD
```
This list is the source for `changelog:`. Pick what goes in:
- **Keep** every commit that tells the story: `add`, `feat`, `fix`, `ref`, `test`, `docs`, `dep`, meaningful `wip`.
- **Omit** noise: `wip: dump`, `fix: typo`, repeated `version: sync`, `clean: format`. They get squashed away anyway. The changelog just doesn't mention them.
- Messages stay verbatim. Don't rewrite history into prettier prose.

Show the user the draft message (below) and get a yes before step 3.

## 2. Rebase onto main
```bash
git rebase origin/main
```
Resolve conflicts commit by commit. Re-run build + tests if anything conflicted.

## 3. Squash into one commit
The user's manual flow is `git rebase -i origin/main` → squash all. Agents can't drive the interactive editor, so use the equivalent:
```bash
git reset --soft $(git merge-base origin/main HEAD)
git commit -F <message-file>
```
Write the message file in the scratchpad, not in the repo.

### Message format
```
<branch-name>

closes: #<issue>

note: <optional, one line per side effect or follow-up>

changelog:
- <type>: <message>
- <type>: <message>
```
Rules:
- **First line is the branch name** (e.g. `feature/9-input`). That's what `main`'s history shows.
- **`closes: #N`** is required. It's GitHub's closing keyword and auto-closes the issue when the commit reaches `main`. Never write `issue: #N` (the old format, which silently leaves issues open; #108 stayed open this way). Several issues: one `closes:` line each.
- **`note:`** only when there is something a future reader needs, e.g. "attribute part updated in web-component, affects all web packages". Otherwise omit.
- **`changelog:`** oldest first, one `- ` line per kept commit, no blank lines between entries.

## 4. Push and open the PR
```bash
git push --force-with-lease -u origin <branch>
gh pr create --base main --head <branch> --title "<branch>" --body-file <message-file>
```
PR title = branch name, and the PR body = the exact squash message. `closes: #N` in the body also links the issue in GitHub's sidebar.

Force-pushing your own branch after the squash is expected. Never force-push `main`, or a branch someone else has pushed to, without explicit user approval.

## 5. Wait for CI
```bash
gh pr checks <pr> --watch
```
`pull-request.yml` builds and runs every package's tests. Red CI → fix on the branch (new commit), then redo steps 3–4 so the branch is one commit again. Never merge red.

## 6. Merge
Merging is outward-facing. Confirm with the user right before it unless they already said "merge" for this PR.
```bash
gh pr merge <pr> --merge --delete-branch
```
`--merge` = GitHub merge commit (not `--squash`, not `--rebase`), which gives the history shape above.

## 7. Verify and clean up
```bash
git checkout main
git pull --ff-only origin main
git log --oneline -2                  # merge commit + the squashed branch commit
gh issue view <issue> --json state    # must be CLOSED
git branch -D <branch>
git remote prune origin
```
If the issue is still open, the closing keyword didn't apply. Close it with `gh issue close <n> --comment "closed by #<pr>"` and tell the user.
