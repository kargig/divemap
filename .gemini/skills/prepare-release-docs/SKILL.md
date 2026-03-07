# Prepare Release Documentation

This skill guides the agent in updating project documentation and changelogs when a feature branch is ready to be merged. It ensures consistency across `README.md`, `changelog.md`, and the frontend `Changelog.js` page.

## Usage

Activate this skill when:
- A feature branch is complete and ready for merging.
- You need to update documentation to reflect new changes.
- The user asks to "prepare release docs" or "update changelogs".

## Workflow

1.  **Analyze Changes**:
    - Use `git log main..HEAD --oneline` or `git diff --stat main..HEAD` to understand the scope of changes (features, bug fixes, infrastructure, database migrations).
    - Identify key themes (e.g., "AI Chatbot", "Performance Overhaul").

2.  **Update `README.md`**:
    - Add new major features to the **Features** section.
    - Update the **Tech Stack** if new libraries/services were added.
    - Ensure the "Quick Start" or "Configuration" sections are updated if setup steps changed (e.g., new env vars).

3.  **Update `docs/maintenance/changelog.md`**:
    - Create a new entry at the top under `## [Latest Release] - <Current Date>`.
    - Use the standard format:
        ```markdown
        ### ⚙️ New Features
        #### **Feature Name - ✅ COMPLETE**
        Description...
        **Core Features:**
        - Item 1...
        **Technical Implementation:**
        - Details...

        ### 🔧 Improvements
        ...
        ### 🐛 Bug Fixes
        ...
        ```
    - Verify migration files are listed if applicable.

4.  **Update `frontend/src/pages/Changelog.js`**:
    - Add a new object to the `releases` array at the top.
    - **Format**:
        ```javascript
        {
          date: 'Month DD, YYYY',
          title: 'Release Title',
          tag: 'Latest Release', // Only for the newest one
          sections: [
            {
              title: 'Major Features',
              type: 'feature', // Options: feature, improvement, bugfix, database, security, infra, ux
              color: 'blue', // Match type color (see getIcon function)
              items: [
                'Feature 1: Description.',
                'Feature 2: Description.',
              ],
            },
            // ... other sections
          ],
        },
        ```
    - **Crucial**: Remove the `tag: 'Latest Release'` property from the *previous* release entry.
    - Update the footer text: `Last updated: Month DD, YYYY`.

5.  **Finalize Tasks**:
    - Move completed project plans from `docs/development/work/` to `docs/development/done/`.
    - Update `spec/todo.md` to mark relevant tasks as completed.

## Style Guidelines

- **Tone**: Professional, concise, and user-focused.
- **Formatting**:
    - Use bolding for feature names.
    - Ensure dates are formatted as "Month DD, YYYY" (e.g., February 15, 2026).
    - In `Changelog.js`, keep items short (1-2 sentences).
