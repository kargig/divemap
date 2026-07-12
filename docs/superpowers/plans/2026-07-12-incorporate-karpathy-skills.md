# Incorporating Andrej Karpathy Developer Guidelines Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Incorporate Andrej Karpathy's developer guidelines into the instructions and configuration files for Gemini, Claude, and Cursor to ensure high-fidelity, simple, and surgical code changes.

**Architecture:** We will integrate these guidelines across three distinct integration layers: Gemini instructions (`GEMINI.md`), Claude instructions (`CLAUDE.md`), and Cursor rules (`.cursor/rules/karpathy-skills.mdc`).

**Tech Stack:** Markdown (`.md`), Cursor Markdown Rule Metadata (`.mdc`), Agent Instruction Files.

## Global Constraints
- **Agent Tooling Constraint:** NEVER use shell commands like `cat << 'EOF'` or `echo ... > ...` to write or edit files. Use native `write_file` or `replace` tools.
- **Git Commit Constraint:** NEVER commit automatically without explicit user instructions.

---

### Task 1: Incorporate Karpathy Guidelines into GEMINI.md

**Files:**
- Modify: `GEMINI.md` (Add a major section at the bottom of the file)

**Interfaces:**
- Consumes: Andrej Karpathy CLAUDE.md verbatim rules.
- Produces: Updated GEMINI.md file containing the new guidelines.

- [ ] **Step 1: Prepare the modification for GEMINI.md**
We will add a new major section at the bottom of `/home/kargig/src/divemap/GEMINI.md` to ensure Gemini (in default and planning modes) is aware of these guidelines.

- [ ] **Step 2: Apply the change to GEMINI.md**
Use the `replace` tool to append the new section to `GEMINI.md`.

```markdown
## Andrej Karpathy's Developer Guidelines
These behavioral guidelines are designed to reduce common LLM coding mistakes by biasing toward caution, simplicity, and precision.

### 1. Think Before Coding
**Don't assume. Don't hide confusion. Surface tradeoffs.**
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First
**Minimum code that solves the problem. Nothing speculative.**
- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.
- Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes
**Touch only what you must. Clean up only your own mess.**
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.
- When your changes create orphans, remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.
- The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution
**Define success criteria. Loop until verified.**
- Transform tasks into verifiable goals (e.g., write reproducing tests first).
- For multi-step tasks, state a brief plan showing each step and its verification check.
```

- [ ] **Step 3: Verify GEMINI.md has been modified correctly**
Read the last 30 lines of `GEMINI.md` using `read_file` to confirm the guidelines are present and well-formatted.

---

### Task 2: Create CLAUDE.md in Project Root

**Files:**
- Create: `CLAUDE.md`

**Interfaces:**
- Consumes: Raw Andrej Karpathy guidelines, project-specific build/test/lint commands.
- Produces: Complete, high-utility CLAUDE.md instruction file in the workspace root.

- [ ] **Step 1: Construct the content for CLAUDE.md**
We will combine the Karpathy guidelines with the specific development, testing, and linting commands for this project as defined in `GEMINI.md` and the `Makefile`.

```markdown
# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## Project Commands

### 1. Environment & Setup
- Start stack: `docker-compose up -d`
- Stop stack: `docker-compose down`
- Docker container names: `divemap_db`, `divemap_backend`, `divemap_frontend`

### 2. Testing Commands
- **Backend Tests (ONLY Approved Method):** `cd backend && ./docker-test-github-actions.sh [tests/test_file.py]` (Never run pytest directly in backend container as it wipes the DB!)
- **Frontend Tests:** `cd frontend && npm test` or `node tests/run_frontend_tests.js`
- **All Tests:** `make test`

### 3. Linting & Formatting Commands
- **Frontend Linting:** `make lint-frontend` (Outputs errors to `frontend-lint-errors.log`)

---

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.
```

- [ ] **Step 2: Write CLAUDE.md file**
Use `write_file` to create `/home/kargig/src/divemap/CLAUDE.md`.

- [ ] **Step 3: Verify CLAUDE.md has been created successfully**
Read the file using `read_file` to ensure it is correctly placed and well-formatted.

---

### Task 3: Create Cursor Rule for Karpathy Skills

**Files:**
- Create: `.cursor/rules/karpathy-skills.mdc`

**Interfaces:**
- Consumes: Verbatim Karpathy rules and Cursor rule markdown metadata format.
- Produces: `.cursor/rules/karpathy-skills.mdc` which always applies to all files in the project.

- [ ] **Step 1: Construct the MDC rule content**
The MDC rule should have the appropriate metadata frontmatter so Cursor understands it applies universally (`globs: ["**/*"]` and `alwaysApply: true`).

```markdown
---
description: Behavioral guidelines to reduce common LLM coding mistakes based on Andrej Karpathy's principles (Think Before Coding, Simplicity First, Surgical Changes, Goal-Driven Execution)
globs: ["**/*"]
alwaysApply: true
---

# Andrej Karpathy's Coding Principles

Universal guidelines to minimize over-engineering, speculative code, and accidental regressions.

## 1. Think Before Coding
**Don't assume. Don't hide confusion. Surface tradeoffs.**
- State your assumptions explicitly before implementing. If uncertain, ask.
- If multiple interpretations exist, present them—do not pick one silently.
- If a simpler approach exists, say so. Push back when instructions are suboptimal.
- If anything is unclear, stop immediately and ask.

## 2. Simplicity First
**Minimum code that solves the problem. Nothing speculative.**
- Write the absolute minimum code required to solve the task. No extra abstractions.
- No unrequested "flexibility", "configurability", or features.
- Avoid error handling for impossible scenarios.
- If a solution is 200 lines and could be 50, rewrite it entirely.
- Ask: "Would a senior engineer say this is overcomplicated?" If so, simplify.

## 3. Surgical Changes
**Touch only what you must. Clean up only your own mess.**
- Do not modify adjacent code, comments, or formatting unless directly related to the task.
- Do not refactor anything that isn't broken.
- Strictly match the existing style of the file, even if you disagree with it.
- If you notice unrelated dead code, mention it to the user—do not delete it.
- Remove imports, variables, and functions that *your* changes made unused. Never touch pre-existing unused elements.
- Ensure every changed line traces directly back to the user's request.

## 4. Goal-Driven Execution
**Define success criteria. Loop until verified.**
- Transform vague tasks into specific, testable criteria (e.g., "Write reproducing tests first").
- For multi-step tasks, provide a brief plan where each step lists a verification check.
- Loop through implementation and testing until success criteria are completely met.
```

- [ ] **Step 2: Create the file**
Use `write_file` to save the rule to `/home/kargig/src/divemap/.cursor/rules/karpathy-skills.mdc`.

- [ ] **Step 3: Verify the file is created and well-formatted**
Read `.cursor/rules/karpathy-skills.mdc` using `read_file` to ensure accurate content and frontmatter.
