# Unify DivingCenter form and add address field

**Status:** Done
**Created:** 2025-10-06 14:05:04
**Agent PID:** 10073
**Branch:** feature/unify-divingcenter-form-add-address

## Original Todo

- Merge create and edit into a single form
- Name, description, latitude, longitude mandatory in both modes
- Reverse-geocode helper available in both modes
- Add optional address to backend schema

## Description

Unify Diving Center create and edit flows into a single reusable form component shared by both pages. Ensure required fields (name, description, latitude, longitude) are enforced in both modes and make the reverse-geocode helper always available. Extend backend to support optional address field for DivingCenter.

## Success Criteria

- [x] Functional: Single shared form used by create and edit pages
- [x] Functional: Name, description, latitude, longitude required in both modes
- [x] Functional: Reverse-geocode helper present and working in both modes
- [x] Backend: Optional address supported in models, schemas, and responses
- [x] Quality: Backend migration added with correct numbering and tested
- [x] Quality: Frontend ESLint passes in container
- [x] Quality: No regressions in create/edit flows
- [x] Documentation: Updated to reflect unified form and address field

## Implementation Plan

### Phase 1 – Backend schema and migration

- [x] Add `address` column to `DivingCenter` SQLAlchemy model (nullable)
- [x] Generate Alembic migration adding `address` (numerically ordered filename)
- [x] Update Pydantic schemas to include optional `address`:
  - [x] `DivingCenterBase` / `DivingCenterCreate` / `DivingCenterResponse`
  - [x] `DivingCenterUpdate` (optional field)
- [x] Run backend tests in container and apply migration on dev DB

### Phase 2 – Shared frontend form component

- [x] Create `components/DivingCenterForm.js` with props: `mode`, `initialValues`, `onSubmit`, `onCancel`
- [x] Include fields: name, description, email, phone, website, latitude, longitude, country, region, city, address
- [x] Always render reverse-geocode helper (both modes)
- [x] Enforce required fields in both modes: name, description, latitude, longitude
- [x] Ensure numeric parsing and validation for lat/lng

### Phase 3 – Page refactors and API wiring

- [x] Refactor `pages/CreateDivingCenter.js` to use `DivingCenterForm` and keep post-create org association flow
- [x] Refactor `pages/EditDivingCenter.js` to use `DivingCenterForm`; keep organizations and gear rental sections
- [x] Wire API payloads to include `address` on POST and PUT

### Phase 4 – Quality and documentation

- [x] Backend: Re-run tests post-refactor; verify migration applied cleanly
- [x] Frontend: Run ESLint in container and fix any issues
- [x] Manual QA: Verify create/edit flows with required validation and reverse-geocode helper
- [x] Update documentation to reflect unified form and optional `address`

## Review

- [ ] Bug that needs fixing
- [ ] Code that needs cleanup

## Notes

- Keep post-create organization linking as a distinct step if needed.
- Playwright QA: Created a center, enforced required fields, ran reverse‑geocode on edit, saved successfully without runtime errors.
