# PR Push Guardrails (Session Notes)

## Signals from this session
- User explicitly said **"no action"** and **"no commit"**.
- Pushing to upstream is a serious mistake even if credentials allow it.

## Guardrail checklist
1. If user says **no action / no commit**: do not commit or push. Limit to local edits or review output.
2. Verify remotes:
   - `git remote -v`
   - Ensure the push target is the **fork** (e.g., `DhruvGarg111/SynapseKit`) and not upstream.
3. Confirm PR head repo/branch before push:
   - `gh pr view <N> --json headRefName,headRepositoryOwner`
4. If rebase conflicts occur and `$EDITOR` is unset:
   - use `GIT_EDITOR=true git rebase --continue` to preserve the original commit message.

## Notes
- GitHub API/PR UI can lag behind branch head updates; verify with `git ls-remote` or branch API before assuming.
