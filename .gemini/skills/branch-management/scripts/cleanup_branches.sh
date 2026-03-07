#!/bin/bash

# Parse arguments
DRY_RUN=0
if [[ "$1" == "--dry-run" ]]; then
    DRY_RUN=1
    echo "=========================================="
    echo "  DRY RUN MODE: No branches will be deleted"
    echo "=========================================="
fi

echo "Starting safe branch cleanup (Local & Remote)..."

# Execute a gh command with exponential backoff
gh_with_backoff() {
    local max_retries=8
    local retry_count=0
    local backoff_time=2
    local output
    
    while true; do
        output=$("$@" 2>gh_error.log)
        local exit_code=$?
        
        if [[ $exit_code -eq 0 ]]; then
            echo "$output"
            return 0
        fi
        
        # Check if it's a rate limit error
        if grep -qi "rate limit" gh_error.log; then
            if [[ $retry_count -lt $max_retries ]]; then
                echo "⚠️  GitHub API rate limit hit. Retrying in $backoff_time seconds... (Attempt $((retry_count + 1))/$max_retries)" >&2
                sleep $backoff_time
                retry_count=$((retry_count + 1))
                backoff_time=$((backoff_time * 2))
                continue
            else
                echo "❌ GitHub API rate limit exceeded and max retries reached." >&2
                cat gh_error.log >&2
                exit 1
            fi
        else
            # Not a rate limit error, exit immediately
            echo "❌ GitHub API Error:" >&2
            cat gh_error.log >&2
            exit 1
        fi
    done
}

# Ensure GitHub CLI is available
if ! command -v gh &> /dev/null; then
    echo "Warning: GitHub CLI (gh) is not installed. Squash-merged branches won't be detected."
    HAS_GH=0
else
    HAS_GH=1
    echo "Fetching recently merged PRs from GitHub..."
    gh_with_backoff gh pr list --state merged --limit 200 --json headRefName -q ".[].headRefName" > merged_prs.txt
fi

# Helper function to get the PR commit safely
get_pr_commit() {
    local branch=$1
    gh_with_backoff gh pr view "$branch" --json commits -q ".commits[-1].oid"
}

echo ""
echo "--- Cleaning up REMOTE branches ---"
# 1. Clean up remote branches that are strictly merged into origin/main
merged_remotes=$(git branch -r --merged origin/main | grep "origin/" | grep -v "origin/main" | grep -v "origin/HEAD" | sed 's#^ *origin/##')

for branch in $merged_remotes; do
    if [[ $DRY_RUN -eq 1 ]]; then
        echo "[DRY RUN] Would delete fully merged remote branch: origin/$branch"
    else
        echo "✅ Deleting fully merged remote branch: origin/$branch"
        git push origin --delete "$branch" >/dev/null 2>&1
    fi
done

# 2. Clean up remote branches that were squash-merged
if [[ $HAS_GH -eq 1 ]]; then
    all_remotes=$(git branch -r | grep "origin/" | grep -v "origin/main" | grep -v "origin/HEAD" | sed 's#^ *origin/##')
    for branch in $all_remotes; do
        if grep -q "^${branch}$" merged_prs.txt 2>/dev/null; then
            # Get the exact commit hash currently on the remote branch
            remote_commit=$(git ls-remote origin "refs/heads/$branch" | awk '{print $1}')
            
            # Use our safe helper function
            pr_commit=$(get_pr_commit "$branch")
            
            # If the remote branch hasn't received any new commits since the PR merged, it's safe to delete
            if [[ -n "$remote_commit" && "$remote_commit" == "$pr_commit" ]]; then
                if [[ $DRY_RUN -eq 1 ]]; then
                    echo "[DRY RUN] Would delete squash-merged remote branch: origin/$branch"
                else
                    echo "✅ Deleting squash-merged remote branch: origin/$branch"
                    git push origin --delete "$branch" >/dev/null 2>&1
                fi
            fi
        fi
    done
fi

echo ""
echo "--- Pruning remote-tracking branches ---"
if [[ $DRY_RUN -eq 1 ]]; then
    echo "[DRY RUN] Would prune stale remote-tracking branches"
else
    # This cleans up local references to remote branches that no longer exist
    git fetch --prune >/dev/null 2>&1
    echo "✅ Pruned stale remote-tracking branches"
fi

echo ""
echo "--- Cleaning up LOCAL branches ---"
branches=$(git for-each-ref --format="%(refname:short)" refs/heads | grep -v "^main$")
current_branch=$(git branch --show-current)

for branch in $branches; do
    # Skip the branch we are currently on
    if [[ "$branch" == "$current_branch" ]]; then
        continue
    fi
    
    # 1. Try a normal, safe delete first (for standard merges/fast-forwards)
    # We check if it is fully merged into main to simulate git branch -d for dry run
    is_merged=$(git branch --merged main | grep -E "^\s*${branch}$")
    
    if [[ -n "$is_merged" ]]; then
        if [[ $DRY_RUN -eq 1 ]]; then
            echo "[DRY RUN] Would delete fully merged local branch: $branch"
        else
            git branch -d "$branch" >/dev/null 2>&1
            echo "✅ Deleted fully merged local branch: $branch"
        fi
        continue
    fi

    # 2. If safe delete failed, check if it was squash-merged via GitHub PR
    if [[ $HAS_GH -eq 1 ]] && grep -q "^${branch}$" merged_prs.txt 2>/dev/null; then
        local_commit=$(git rev-parse "$branch")
        pr_commit=$(get_pr_commit "$branch")
        
        if [[ "$local_commit" == "$pr_commit" ]]; then
            if [[ $DRY_RUN -eq 1 ]]; then
                echo "[DRY RUN] Would delete squash-merged local branch: $branch"
            else
                git branch -D "$branch" >/dev/null 2>&1
                echo "✅ Deleted squash-merged local branch: $branch"
            fi
            continue
        fi
    fi

    # If both checks fail, we skip it to prevent data loss.
    echo "⏭️  Skipped local branch: $branch (Contains unmerged work or PR commit mismatch)"
done

# Cleanup temporary files
rm -f merged_prs.txt gh_error.log

echo ""
echo "Cleanup complete!"