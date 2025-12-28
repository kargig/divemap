# Git Create Commit

## Overview

Create a comprehensive, focused commit message stored in `commit-message.txt`.
The user could then use this text file using: `git commit -F commit-message.txt`

## Steps

1. **Review changes**
    - Check the diff: `git diff --cached` (only take staged changes into account) not `git diff` (unstaged)
    - Understand what changed and why
2. **Ask for issue key (optional)**
    - Check the branch name for an issue key (Linear, Jira, GitHub issue, etc.)
    - If an issue key (e.g., POW-123, PROJ-456, #123) is not already available in the chat or commit context, optionally ask the user if they want to include one
    - This is optional - commits can be made without an issue key
3. **Create a comprehensive git commit message**
    - Follow 7 rules of git commit messages
    - Base the message on the actual changes in the diff

## Rules

1. **Separate subject from body** with blank line
2. **Limit subject to 50 characters**
3. **Capitalize subject line**
4. **No period** at end of subject
5. **Use imperative mood** ("Add", "Fix", "Update", "Remove")
6. **Wrap body at 72 characters**
7. **Explain what and why**, not how
