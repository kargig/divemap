# Rich Formatting Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Markdown support for descriptions in Dive Sites, Diving Centers, and Dive Trips, using `react-simplemde-editor` for editing and a unified `RichText` component for rendering.

**Architecture:** 
1.  **Rendering:** Create a `RichText` component using `react-markdown` and `dompurify` to safely render Markdown content.
2.  **Editing:** Create a `MarkdownEditor` wrapper for `react-simplemde-editor` and `easymde` that integrates with `react-hook-form`.
3.  **Integration:** Replace standard textareas in forms and plain text displays in detail views with these new components.

**Tech Stack:**
- Frontend: `react-markdown`, `remark-gfm`, `dompurify`, `react-simplemde-editor`, `easymde`, `@tailwindcss/typography`
- Backend: FastAPI, Pydantic, SQLAlchemy, `nh3`

---

### Task 1: Core Dependencies

**Files:**
- Modify: `frontend/package.json`

- [x] **Step 1: Identify missing dependencies**
Check if `react-simplemde-editor` and `easymde` are present. (They are currently NOT present).

- [x] **Step 2: Add dependencies to package.json**
```json
"react-simplemde-editor": "^5.2.0",
"easymde": "^2.18.0",
"@tailwindcss/typography": "^0.5.16"
```

- [x] **Step 3: Update local environment**
Run: `docker exec divemap_frontend npm install`
Expected: `package-lock.json` updated and libraries installed in container.

---

### Task 2: Create RichText Renderer

**Files:**
- Create: `frontend/src/components/ui/RichText.jsx`
- Create: `frontend/src/components/ui/RichText.css`

- [x] **Step 1: Create RichText component**
This component handles HTML entity decoding (for legacy data), sanitization, and Markdown rendering.

```jsx
import DOMPurify from 'dompurify';
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { decodeHtmlEntities } from '../../utils/htmlDecode';
import './RichText.css';

const RichText = ({ content, className = '' }) => {
  if (!content) return null;

  // 1. Decode entities (legacy data might be double encoded or contain &nbsp; etc)
  const decoded = decodeHtmlEntities(content);
  
  // 2. Sanitize with strict settings (Harden settings applied)
  const sanitized = DOMPurify.sanitize(decoded, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
      'blockquote', 'code', 'pre', 'hr', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td'
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target'], 
    FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['style', 'class', 'onerror', 'onload', 'onmouseover'],
  });

  return (
    <div className={`rich-text prose prose-blue dark:prose-invert max-w-none ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {sanitized}
      </ReactMarkdown>
    </div>
  );
};

export default RichText;
```

- [x] **Step 2: Add basic styling for Markdown elements**
Initial styling added, then refined with `@tailwindcss/typography`.

---

### Task 3: Create MarkdownEditor Component

**Files:**
- Create: `frontend/src/components/ui/MarkdownEditor.jsx`
- Create: `frontend/src/components/ui/MarkdownEditor.css`

- [x] **Step 1: Create MarkdownEditor wrapper**
Integrate `SimpleMDE` with `react-hook-form`'s `Controller`.

---

### Task 4: Integrate in Dive Site Pages

**Files:**
- Modify: `frontend/src/pages/DiveSiteDetail.jsx`
- Modify: `frontend/src/pages/CreateDiveSite.jsx`
- Modify: `frontend/src/pages/EditDiveSite.jsx`

- [x] **Step 1: Update Detail view to use RichText**
Replace raw description rendering with `<RichText content={diveSite.description} />`.
Do the same for `access_instructions`, `marine_life`, and `safety_information`.

- [x] **Step 2: Update Create/Edit form to use MarkdownEditor**
Wrap the `description` field in a `Controller` using the new `MarkdownEditor`.

---

### Task 5: Integrate in Diving Center Pages

**Files:**
- Modify: `frontend/src/components/DivingCenterSummaryCard.jsx`
- Modify: `frontend/src/components/DivingCenterForm.jsx`

- [x] **Step 1: Update Summary Card**
Replace the description `<p>` tag with `<RichText content={center.description} />`.

- [x] **Step 2: Update Form**
Replace the description `textarea` with `MarkdownEditor`.

---

### Task 6: Integrate in Trip Pages

**Files:**
- Modify: `frontend/src/pages/TripDetail.jsx`
- Modify: `frontend/src/components/TripFormModal.jsx`
- Modify: `frontend/src/components/TripHeader.jsx`

- [x] **Step 1: Update Trip Detail**
Use `RichText` for `trip_description` and `special_requirements`.
Also update `DiveSiteInfo` sub-component to use `RichText` for `dive_description`.

- [x] **Step 2: Update Trip Form Modal**
Update both the main trip description and the per-dive descriptions to use `MarkdownEditor`.

---

### Task 7: Verification & Sanitization

- [x] **Step 1: Verify rendering**
Enter Markdown (bold, lists, links) in the editor and verify it renders correctly in the detail views.

- [x] **Step 2: Security check (Frontend)**
Attempt to inject `<script>` tags in the Markdown and verify they are stripped by `dompurify`.

---

### Task 8: Backend Hardening (Added during execution)

**Files:**
- Modify: `backend/requirements.txt`
- Modify: `backend/app/schemas/__init__.py`
- Create: `backend/tests/test_rich_text_schemas.py`

- [x] **Step 1: Implement nh3 backend sanitization**
Add `nh3` to requirements and apply `strip_html` validator to all Pydantic schemas.

- [x] **Step 2: Add backend validation tests**
Created and passed `test_rich_text_schemas.py` using `docker-test-github-actions.sh`.

---

### Task 9: UI Refinement (Added during execution)

**Files:**
- Modify: `frontend/src/pages/Privacy.jsx`
- Modify: `frontend/src/pages/Changelog.jsx`
- Modify: `frontend/src/pages/Help.jsx`

- [x] **Step 1: Standardize long-form content**
Applied `prose` class to Privacy, Changelog, and Help documentation for better readability.

- [x] **Step 2: Visual verification**
Verified changes on both desktop and mobile views using Chrome DevTools.
