# Cursor Rules for Divemap Project

This directory contains organized Cursor rules that replace the monolithic
`.cursorrules` file. Rules are organized by domain and scope for better
maintainability and clarity.

## Rule Organization

### Project-Wide Rules (`.cursor/rules/`)

- **`core-essentials.mdc`** - Core universal rules referenced by other rules
- **`project-standards.mdc`** - Core project standards, Docker management, and environment requirements
- **`git-standards.mdc`** - Git commit rules, workflow standards, and branch management
- **`testing-standards.mdc`** - Testing requirements and environment setup
- **`documentation-standards.mdc`** - Documentation standards and templates
- **`documentation-management.mdc`** - Rules for managing documentation files (prevent pollution)
- **`compliance-checklist.mdc`** - Compliance checklist and enforcement rules
- **`todo-workflow.mdc`** - Todo Implementation Program workflow (core)
- **`todo-markdown.mdc`** - Markdown formatting standards for todo files

### Domain-Specific Rules

- **`backend/.cursor/rules/migrations.mdc`** -
  Database migration rules and Alembic requirements
- **`frontend/.cursor/rules/code-quality.mdc`** -
  Frontend code quality, ESLint validation, and formatting standards

## Rule Types and Metadata

Each rule file uses proper MDC format with metadata:

### Always Apply Rules (Optimized for Token Efficiency)

- **`core-essentials.mdc`** - Core universal rules (~30 lines)
  - `alwaysApply: true` - Always included in model context
  - `globs: ["**/*"]` - Applies to all files
- **`project-standards.mdc`** - Core environment and Docker management (~40 lines, references core-essentials)
  - `alwaysApply: true` - Always included in model context
  - `globs: ["**/*"]` - Applies to all files
- **`git-standards.mdc`** - Git workflow and commit standards (~50 lines, references core-essentials)
  - `alwaysApply: true` - Always included in model context
  - `globs: ["**/*"]` - Applies to all files
- **`testing-standards.mdc`** - Testing requirements (~50 lines, condensed)
  - `alwaysApply: true` - Always included in model context
  - `globs: ["**/*", "backend/**/*", "frontend/**/*", "**/*.{py,js,jsx,ts,tsx}"]` - Applies to all files
- **`compliance-checklist.mdc`** - Compliance enforcement (~20 lines, references core-essentials)
  - `alwaysApply: true` - Always included in model context
  - `globs: ["**/*"]` - Applies to all files

**Total Always-Applied: ~190 lines** (down from ~1,019 lines - 81% reduction)

### Auto-Attached Rules (Context-Specific Loading)

- **`backend/.cursor/rules/migrations.mdc`** -
  Applied when working with migration files
  - `alwaysApply: false` - Auto-attached based on glob patterns
  - `globs: ["backend/migrations/**/*", "backend/app/models/**/*",
"backend/create_migration.py", "backend/run_migrations.py"]`
- **`frontend/.cursor/rules/code-quality.mdc`** -
  Applied when working with frontend files
  - `alwaysApply: false` - Auto-attached based on glob patterns
  - `globs: ["frontend/**/*", "src/**/*.js", "src/**/*.jsx", "src/**/*.ts",
"src/**/*.tsx"]`
- **`documentation-standards.mdc`** - Applied when working with documentation
  - `alwaysApply: false` - Auto-attached based on glob patterns
  - `globs: ["docs/**/*", "**/*.md", "**/*.txt"]`
- **`todo-workflow.mdc`** - Applied when working with todo-related files
  - `alwaysApply: false` - Auto-attached based on glob patterns (optimized)
  - `globs: ["docs/development/todo.md", "docs/development/work/**/*", "docs/development/done/**/*"]`
- **`todo-markdown.mdc`** - Applied when editing markdown files in todo workflow
  - `alwaysApply: false` - Auto-attached based on glob patterns (optimized)
  - `globs: ["docs/development/work/**/*.md", "docs/development/done/**/*.md", "docs/development/todo.md", "**/*.md"]`
- **`date-metadata.mdc`** - Applied when working with markdown/docs
  - `alwaysApply: false` - Auto-attached based on glob patterns (optimized)
  - `globs: ["**/*.md", "**/changelog*", "**/CHANGELOG*"]`

## Benefits of New Structure

1. **Modularity** - Each rule file focuses on a specific domain
2. **Maintainability** - Easier to update specific areas without affecting others
3. **Clarity** - Clear separation of concerns and responsibilities
4. **Performance** - Only relevant rules are loaded based on context
5. **Token Efficiency** - 81% reduction in always-applied rules (~1,019 → ~198 lines)
6. **Version Control** - Better tracking of changes to specific rule areas
7. **Cursor Compliance** - All files are under 500 lines as recommended
8. **Proper Metadata** - Each rule has clear description, globs, and alwaysApply properties

## Token Optimization (2025)

Rules have been optimized to reduce token usage:

- **Always-applied rules**: Reduced from ~1,019 to ~198 lines (81% reduction)
- **Context-specific loading**: Large rules (todo-implementation, date-metadata) now auto-attach
- **Content condensation**: Removed verbose examples and redundant explanations
- **Result**: ~55% token reduction for most common workflows (code editing)

See `docs/development/cursor-rules-optimization.md` for complete optimization details and verification methods.

## Migration from .cursorrules

The original `.cursorrules` file has been broken down into these focused rule
files. All functionality has been preserved while improving organization and
maintainability.

## Adding New Rules

When adding new rules:

1. Create appropriate `.mdc` file in the relevant directory
2. Use proper MDC metadata format:

   ```yaml
   ---
   description: Clear description of the rule's purpose
   globs: ["file/patterns/**/*"]  # File patterns where rule applies
   alwaysApply: true/false        # Whether to always include or auto-attach
   ---
   ```

3. Keep rules under 500 lines as recommended by Cursor
4. Update this README if adding new rule categories

## Rule Application Behavior

- **Always Apply Rules** (`alwaysApply: true`) -
  These rules are always included in the AI context
- **Auto-Attached Rules** (`alwaysApply: false`) -
  These rules are automatically included when working with files matching the glob
  patterns
- **Context-Aware Loading** -
  Backend rules only load when working in backend, frontend rules only when working
  in frontend

## Current Rule Structure

### Always-Applied Rules (5 files - ~242 lines total)
These rules are **always loaded** for every file:

1. **core-essentials.mdc** (~33 lines) - Universal rules
2. **project-standards.mdc** (~53 lines) - Docker, Python, Frontend basics
3. **git-standards.mdc** (~75 lines) - Git commit rules
4. **testing-standards.mdc** (~57 lines) - Testing requirements
5. **compliance-checklist.mdc** (~24 lines) - Compliance rules

**Total: ~242 lines always loaded**

### Context-Specific Rules (load only when needed)
These rules **auto-attach** based on file patterns:

- **todo-workflow.mdc** - Only for `docs/development/todo.md` and work/done folders
- **todo-markdown.mdc** - Only for markdown files in todo workflow
- **date-metadata.mdc** - Only for `.md` files and changelogs
- **documentation-standards.mdc** - Only for `docs/**/*` and `.md` files
- **backend/.cursor/rules/migrations.mdc** - Only for migration/model files
- **frontend/.cursor/rules/code-quality.mdc** - Only for frontend files

## How Rules Load for Different File Types

### Python File (e.g., `backend/app/routers/newsletters.py`)
- ✅ 5 always-applied rules (~242 lines)
- ❌ No context-specific rules (not a migration/model file)
- **Total: ~242 lines**

### Markdown File (e.g., `docs/README.md`)
- ✅ 5 always-applied rules (~242 lines)
- ✅ date-metadata.mdc (~76 lines)
- ✅ documentation-standards.mdc (~85 lines)
- **Total: ~403 lines**

### Todo File (e.g., `docs/development/todo.md`)
- ✅ 5 always-applied rules (~242 lines)
- ✅ todo-workflow.mdc (~152 lines)
- ✅ todo-markdown.mdc (~33 lines)
- ✅ date-metadata.mdc (~76 lines)
- **Total: ~503 lines**

### Migration File (e.g., `backend/migrations/versions/0001_initial.py`)
- ✅ 5 always-applied rules (~242 lines)
- ✅ backend/.cursor/rules/migrations.mdc (~167 lines)
- **Total: ~409 lines**
