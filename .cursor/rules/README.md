# Cursor Rules for Divemap Project

This directory contains organized Cursor rules that replace the monolithic
`.cursorrules` file. Rules are organized by domain and scope for better
maintainability and clarity.

## Rule Organization

### Project-Wide Rules (`.cursor/rules/`)

- **`project-standards.mdc`** -
  Core project standards, Docker management, and environment requirements
- **`git-standards.mdc`** -
  Git commit rules, workflow standards, and branch management
- **`testing-standards.mdc`** - Testing requirements and environment setup
- **`documentation-standards.mdc`** - Documentation standards and templates
- **`compliance-checklist.mdc`** - Compliance checklist and enforcement rules
- **`todo-implementation.mdc`** - Todo Implementation Program workflow

### Domain-Specific Rules

- **`backend/.cursor/rules/migrations.mdc`** -
  Database migration rules and Alembic requirements
- **`frontend/.cursor/rules/code-quality.mdc`** -
  Frontend code quality, ESLint validation, and formatting standards

## Rule Types and Metadata

Each rule file uses proper MDC format with metadata:

### Always Apply Rules

- **`project-standards.mdc`** - Core environment and Docker management
  - `alwaysApply: true` - Always included in model context
  - `globs: ["**/*"]` - Applies to all files
- **`git-standards.mdc`** - Git workflow and commit standards
  - `alwaysApply: true` - Always included in model context
  - `globs: ["**/*"]` - Applies to all files
- **`testing-standards.mdc`** - Testing requirements
  - `alwaysApply: true` - Always included in model context
  - `globs: ["**/*"]` - Applies to all files
- **`compliance-checklist.mdc`** - Compliance enforcement
  - `alwaysApply: true` - Always included in model context
  - `globs: ["**/*"]` - Applies to all files

### Auto-Attached Rules

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
- **`todo-implementation.mdc`** - Applied when working with todo-related files
  - `alwaysApply: false` - Auto-attached based on glob patterns
  - `globs: ["docs/development/todo.md", "docs/development/work/**/*",
"docs/development/done/**/*"]`

## Benefits of New Structure

1. **Modularity** - Each rule file focuses on a specific domain
2. **Maintainability** - Easier to update specific areas without affecting
others
3. **Clarity** - Clear separation of concerns and responsibilities
4. **Performance** - Only relevant rules are loaded based on context
5. **Version Control** - Better tracking of changes to specific rule areas
6. **Cursor Compliance** - All files are under 500 lines as recommended
7. **Proper Metadata** - Each rule has clear description, globs, and alwaysApply
properties

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
