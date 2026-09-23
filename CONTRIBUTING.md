# Contributing

How work flows through papit: issue → branch → commits → one squashed commit → PR → merge. Humans and Claude agents follow the same rules.

## 1. Issue first

Every piece of work starts from a GitHub issue. Its number is the `TICKET-ID` below and is what closes it on merge.

## 2. Branch

```
{TYPE}/{TICKET-ID}-short-name
```

| TYPE       | Use for                              |
| ---------- | ------------------------------------ |
| `feature`  | new package or capability            |
| `bugfix`   | fixing a reported bug                |
| `hotfix`   | urgent fix straight to a release     |
| `refactor` | restructuring without new behaviour  |
| `setup`    | tooling, CI, workflow, repo config   |

Examples: `feature/9-input`, `bugfix/99-list-part-keys`, `setup/111-claude`.

Never commit to `main` directly. Stay on one branch until the issue is done.

## 3. Commits

```
{CTYPE}: message
{CTYPE}: [package] message        # when the branch touches several packages
```

| CTYPE     | Use for                                                 |
| --------- | ------------------------------------------------------- |
| `add`     | wholly new file, feature or package                     |
| `feat`    | enhancement to existing functionality                   |
| `fix`     | bug fix                                                 |
| `ref`     | refactor, no behaviour change                           |
| `clean`   | tidy-up: formatting, dead code, naming                  |
| `test`    | tests only (new, backfilled or fixed)                   |
| `docs`    | README, JSDoc, docs/ only                               |
| `version` | version bumps / `npm run version:sync`                  |
| `dep`     | dependency changes (add, upgrade, audit)                |
| `wip`     | work in progress, not expected to be final              |

**Granularity — TDD:**

1. The failing test is its own commit (`test: [switch] space toggles`).
2. The implementation that makes it pass is a separate commit (`add` / `feat` / `fix`).
3. Follow-up fixes are their own commits too.
4. Unrelated concerns (docs, version, deps) never ride along in a test or implementation commit.

Commits get squashed at merge time, and the `changelog:` in the squash message is what keeps this history. Keep messages honest.

## 4. Definition of done

A package is done when it has all five:

- **code**: `src/`, zero runtime dependencies outside `@papit/*` (build it from scratch)
- **tests**: real tests in `tests/`, not the scaffold stubs (`should work`, `available in DOM`)
- **asset**: `asset/` (translations, icons, images the package ships)
- **README**: following the package README skeleton, not the scaffold template
- **package.json description**: one or two clear, correctly spelled sentences

Public API also carries JSDoc: short, and only what the signature can't already tell you.

## 5. Merge

The branch is squashed into **one commit**, rebased onto `main`, pushed, and merged through a GitHub PR with a merge commit.

1. Update and rebase:

   ```bash
   git fetch origin
   git rebase origin/main
   ```

2. Squash into one commit. Either `git rebase -i origin/main` and squash everything, or equivalently:

   ```bash
   git log --reverse --format='- %s' origin/main..HEAD   # the changelog source
   git reset --soft $(git merge-base origin/main HEAD)
   git commit                                             # message format below
   ```

3. Push and open the PR (title = branch name, body = the same message):

   ```bash
   git push --force-with-lease -u origin <branch>
   gh pr create --base main --title "<branch>" --body-file <message-file>
   ```

4. Merge with a merge commit, then clean up:

   ```bash
   gh pr merge <pr> --merge --delete-branch
   git checkout main && git pull --ff-only
   ```

### Squash message

```
feature/9-input

closes: #9

note: attribute part updated in web component affecting many packages

changelog:
- add: @papit/input package
- fix: make sure raw is returned as value
- test: form value and default value
```

- **`closes: #N`**: GitHub closes the issue when this lands on `main`. `issue: #N` does **not** close anything.
- **`note:`**: optional, one line each. Use it for side effects on other packages or follow-ups.
- **`changelog:`**: one line per meaningful commit, verbatim, oldest first. Leave out noise (`wip: dump`, `fix: typo`) and keep everything that tells the story.

Rebase-squash tips in vim: `:2,$s/^pick /s /` squashes everything into the first commit, and `:%s/\([^:]\+\): /- \1: /g` to turn messages into changelog lines.
