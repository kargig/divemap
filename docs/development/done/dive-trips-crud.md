# Plan: Full CRUD Capabilities for Dive Trips

## Objective
Enhance dive trips management by allowing Diving Center Owners and Managers to fully manage (Create, Read, Update, Delete) their dive trips, expanding beyond the current "Create" only functionality which was heavily restricted to Admins/Moderators for updates and deletions.

## Scope & Impact
- **Backend (`backend/app/routers/newsletters.py`)**: Updated endpoint permissions and added security/privacy guardrails.
- **Frontend (`frontend/src/pages/DivingCenterDetail.jsx`, `frontend/src/pages/TripDetail.jsx`)**: Added UI controls (Edit, Delete, Share) for authorized users.
- **Frontend Components (`frontend/src/components/TripFormModal.jsx`)**: Enhanced to support both create and edit modes with optional broadcasting.

## Implemented Solution

### 1. Backend: Update API Permissions & Security
Refactored `update_parsed_trip` and `delete_parsed_trip` to authorize Diving Center Owners and Managers via the `can_manage_diving_center` dependency.

**Security Enhancements**:
- **Prompt Injection Protection**: Implemented `[BEGIN/END NEWSLETTER CONTENT]` delimiters and strict instructional guardrails in the newsletter parsing prompt.
- **Privacy Protection**: Restricted raw newsletter content exposure in API responses to authorized personnel only.
- **Attribute Injection**: Whitelisted `sort_by` fields in trip listing.
- **DoS Mitigation**: Enforced a 1MB file size limit for newsletter uploads.

### 2. Frontend: Management UI
Augmented both the Diving Center Detail page and the individual Trip Detail page.

**Changes**:
- **DivingCenterDetail.jsx**: Added "Edit" and "Delete" icons in the "Upcoming Trips" tab. Added "Create Trip" button for managers.
- **TripDetail.jsx**: Added styled "Edit Trip", "Delete Trip", and "Share" buttons.
- **TripFormModal.jsx**: Fixed a bug where the modal appeared on page load. Added a checkbox to "Broadcast update to followers" when editing.
- **Form Helpers**: Updated Zod schemas to support `HH:MM:SS` time format (standard for native browser inputs).

## Implementation Steps (Completed)
1. **Created Branch**: `feature/dive-trips-crud`.
2. **Backend Refactor**: Integrated `can_manage_diving_center` into newsletter endpoints.
3. **Security Patching**: Addressed all findings from the security audit.
4. **Frontend Integration**: Updated pages to support CRUD operations and fixed UI bugs.
5. **Testing**: 
   - Added `backend/tests/test_trip_crud_permissions.py`.
   - Verified end-to-end flow and prompt injection protection with live DeepSeek API tests.

## Verification & Testing Results
- ✅ **Backend Permissions**: Verified that owners/managers can edit/delete their own trips, while unauthorized users are blocked (403).
- ✅ **Prompt Injection**: Verified that malicious payloads are ignored by the LLM.
- ✅ **UI/UX**: Verified modal behavior, form submission, and button styling via Chrome DevTools.
- ✅ **Broadcasting**: Verified that updates can be broadcasted to followers on edit.
