---
name: github-maintainer-workflows
description: "Use when handling class-level GitHub maintainer work: small issue-to-PR flows, CI debugging, contribution summaries, README contribution refreshes, or repo-maintenance PRs like adding a license."
version: 1.0.0
author: Hermes Agent Curator
license: MIT
metadata:
  hermes:
    tags: [GitHub, PRs, CI, maintainer, contributions, README, workflow]
    related_skills: [github-auth, github-issues, github-repo-management]
---

# GitHub Maintainer Workflows

## Overview
This umbrella skill covers recurring GitHub maintainer/operator work that was previously split across several narrow session-shaped skills. Use it for end-to-end PR work, fixing failing checks, summarizing contribution history, refreshing profile contribution sections, and small repo-maintenance changes like adding a license.

## When to Use
- User wants a GitHub issue turned into a branch, fix, PR, and merge
- A PR has failing CI and needs log-first debugging
- User wants a summary of merged PRs / solved issues across repos
- A GitHub profile README needs its contribution section refreshed
- A small repo hygiene task should be handled through the normal issue-to-branch-to-PR loop

Do not use for:
- Initial auth/setup only -> `github-auth`
- Repository creation/forking/release management only -> `github-repo-management`
- Pure issue triage with no code/PR work -> `github-issues`

## Core Workflow
1. Inspect auth, remotes, branch state, and working tree before changing anything.
2. Identify whether the task is:
   - issue-to-PR execution
   - CI debugging
   - contribution reporting
   - profile README refresh
   - repo-maintenance PR (license/docs/hygiene)
3. Use the smallest task-specific path below.
4. Run scoped verification before commit/push.
5. Report URLs, branch names, verification results, and any limits.

## Shared Rules
- Prefer the smallest correct change set.
- Do not bundle unrelated cleanups into maintenance PRs.
- In dirty repos, stage only intended files.
- In WSL-on-Windows workflows, prefer the real PowerShell binary when the user’s tooling requires Windows-native execution.
- If local tooling mutates generated files (`uv.lock`, build artifacts, CRLF churn), restore accidental changes before commit unless they are part of scope.

## Workflow A - Small Issue to PR to Merge
Use this when finding or implementing a modest issue fix.

1. Pick a low-risk, open, unsolved issue.
2. Create a clean branch or worktree from the correct base.
3. Inspect code and tests before editing.
4. Make the smallest fix.
5. Run the narrowest relevant test/lint/typecheck slice first.
6. Commit with a clear message only when the task includes commit/PR creation.
7. Push to the fork or origin as requested.
8. Open PR and verify checks.

## Workflow B - PR CI Debugging
Use this when checks are already failing.

1. Inspect failing checks before changing code.
2. Read the actual failed logs.
3. Reproduce the exact failing command locally.
4. Fix the smallest root cause first.
5. Re-run only the affected check(s), then broader validation if needed.
6. Re-check PR status after push.

### Frequent failure classes
- formatter drift (`ruff format --check`)
- missing type attributes / `Any` leaks in mypy
- xdist-only or isolation-sensitive tests
- env-vs-config precedence mismatches
- accidental lockfile rewrites from `uv`

## Workflow C - Contribution Summary
Use this when the user wants merged-PR / solved-issue reporting.

1. Detect GitHub auth (`gh` preferred, API fallback acceptable).
2. Collect merged PRs authored by the user.
3. Extract issues explicitly closed by those PRs.
4. Optionally collect authored-and-closed issues.
5. Group by repository and summarize in portfolio-friendly language.

## Workflow D - Profile README Contribution Refresh
Use this when a profile repo has a specific contributions block that should update only after enough new merged work accumulates.

1. Read repo state and last `README.md`-touching commit.
2. Count merged PRs since that timestamp.
3. Compare against the user’s threshold.
4. Patch only the contribution block, not the whole README.
5. Watch for CRLF / whole-file diff noise.
6. Stage only `README.md` if the repo is otherwise dirty.

## Workflow E - Repo Maintenance PRs
Use this for small hygiene changes where the operational pattern matters more than the file content.

1. Confirm the exact requested change and branch target.
2. Open or link an issue if the workflow calls for it.
3. Create a focused branch.
4. Modify only the requested file(s).
5. Commit/push only with explicit permission where required.
6. Open/merge PR and report final URLs.

### Example class
- Add MIT `LICENSE`
- README subsection refresh
- minor policy/doc files
- narrow repository metadata updates

## Common Pitfalls
1. Treating contribution summaries as the same thing as authored closed issues - they are not.
2. Fixing CI without reading logs first.
3. Letting line-ending normalization make a tiny README change look huge.
4. Accidentally staging unrelated local modifications.
5. Using wrapper PowerShell executables in WSL when the real Windows binary is required.
6. Making commits/pushes when the user asked only for local changes or analysis.

## Verification Checklist
- [ ] Auth and target repo/branch verified
- [ ] Scope matched to one of the workflow classes above
- [ ] Minimal local validation run
- [ ] Only intended files changed/staged
- [ ] URLs / branch / commit / PR status captured for final report
