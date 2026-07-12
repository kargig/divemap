# Frontend Core

The frontend is a React application built with Vite and Tailwind CSS.

## Navigation
- Mobile Design: `mem:mobile-first-design`
- UI Icons: `mem:ui-icons`
- Button Standards: `mem:frontend/button_standards`

## Key Locations
- `frontend/src/pages/`: Page components.
- `frontend/src/components/`: Reusable UI components.
- `frontend/src/api.js`: API client and endpoint definitions.
- `frontend/src/utils/formHelpers.js`: Zod validation schemas.

## Invariants
- **Validation**: Use Zod schemas from `formHelpers.js`.
- **Styling**: Tailwind CSS only. Avoid custom CSS unless necessary.
- **Verification**: Zero console errors policy.
