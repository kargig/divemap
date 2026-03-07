---
name: branch-management
description: Guidelines and automated scripts for managing, naming, and safely cleaning up Git branches (both local and remote) in the divemap project. Use when asked to manage branches, clean up merged branches, or understand branch conventions.
---

# Branch Management

This skill provides guidelines and automated tools for managing Git branches in the Divemap project. It ensures that branches follow the correct naming conventions and provides a robust, safe method for cleaning up stale branches that have been merged.

## Branching Conventions

When working in the Divemap project, always adhere to the following conventions:
- **Feature Branches:** ALWAYS create a feature branch for changes: `feature/[task-name-kebab-case]`.
- **Bug Fixes:** Use `fix/[issue-description-kebab-case]`.
- **No Direct Commits:** NEVER work directly on `main` or `master`. 

## Branch Cleanup

Over time, local and remote branches accumulate. Cleaning them up can be tricky because GitHub "Squash and Merge" operations change the commit hash, which makes `git branch -d` fail locally since Git cannot find the original commit in the `main` branch's history.

To solve this problem safely without losing data, this skill bundles a sophisticated cleanup script.

### The Cleanup Strategy
The bundled cleanup script (`scripts/cleanup_branches.sh`) performs a multi-stage validation before deleting any branch:

1. **Remote Cleanup:** It first cleans up remote tracking branches (`origin/*`).
   - If a branch is fully merged into `origin/main`, it deletes it.
   - For squash-merged branches, it uses the GitHub CLI (`gh`) to check if the latest commit on the PR matches the latest commit on the remote branch. If they match, it deletes the branch safely.
2. **Local Cleanup:** It performs a similar check for local branches.
   - It attempts a native safe delete (`git branch -d`).
   - If that fails, it verifies the branch against merged PRs using `gh`. It ensures the local commit hash matches the PR's pre-squash commit hash. If they match, it means no unpushed local work exists, and it deletes the branch (`git branch -D`).
3. **Resiliency:** The script includes an exponential backoff mechanism (up to 8 retries, waiting up to 256 seconds) to handle GitHub API rate limit errors gracefully, preventing silent failures.

### Running the Cleanup Script

To execute a safe cleanup of both local and remote branches:

```bash
# To perform a dry run (shows what would be deleted without making any changes)
bash scripts/cleanup_branches.sh --dry-run

# To perform the actual cleanup
bash scripts/cleanup_branches.sh
```

**Note:** The script relies on the GitHub CLI (`gh`). Ensure `gh` is installed and authenticated for squash-merge detection to function properly.
