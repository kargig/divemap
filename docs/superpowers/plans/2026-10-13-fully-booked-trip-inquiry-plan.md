# Design & Implementation Plan: Fully-Booked Trip Inquiries & Offline Spots Access

- **Date:** 2026-10-13
- **Status:** Approved Draft for Implementation
- **Author:** AI Software Architect & Senior Frontend Engineer
- **Parent Specifications:**
  - `docs/superpowers/specs/2026-09-27-divemap-octo-booking-system-design.md`
  - `docs/superpowers/specs/2026-10-08-booking-system-public-discovery-bridge-design.md`

---

## 1. Context & Business Rationale

Diving center operators frequently reserve a portion of boat or trip capacity for offline bookings, walk-ins, phone reservations, local club divers, or private instructors. Furthermore, scheduled trips frequently experience last-minute cancellations or itinerary adjustments.

Currently:
1. When a trip has `is_bookable=True` but all online seats are taken (`seats_available <= 0`), `TripCard.jsx` marks the trip as `"Fully booked"` but leaves the primary button as `"Book Now"`, pointing directly to the checkout wizard.
2. In `TripDetail.jsx`, the main hero CTA and booking tab encourage the user to `"Proceed to Booking Wizard"`.
3. In `BookingWizard.jsx`, there is no initial capacity validation. A user going through the 5-step process will only encounter an error upon hold/confirmation.

**Goal:** Turn fully booked trips from a dead-end into a high-conversion inquiry channel. When online seats reach zero, provide divers with an immediate, friction-free way to contact the center via **In-App B2C Chat**, **WhatsApp**, **Phone**, or **Email** with pre-composed trip context (trip title, date, time, dive sites) asking about reserved spots or cancellation waitlists.

---

## 2. Architecture & Design

### 2.1 Reusable Inquiry Modal: `TripWaitlistInquiryModal.jsx`
- **Location:** `frontend/src/components/booking/TripWaitlistInquiryModal.jsx`
- **Props:**
  - `isOpen` (boolean): modal visibility
  - `onClose` (function): modal dismissal handler
  - `trip` (object): trip details (title, date, time, dive sites, description)
  - `divingCenter` (object): center details (id, name, phone, email, website)
- **Features:**
  - Informative banner explaining: *"Online spots for this departure are currently full. However, dive centers frequently hold reserved boat spots or receive last-minute cancellations. Contact them directly to check for availability or join their waitlist."*
  - Pre-composed message tailored with trip specifics:
    > *"Hi [Center Name]! I noticed online spots are full for '[Trip Title]' on [Date] at [Time] (Dive sites: [Sites]). Do you have any reserved boat spots available or a cancellation waitlist I could join?"*
  - Direct 1-click contact actions:
    1. **Divemap In-App Chat:** Calls `createChatRoom` with the center (`diving_center_id`), sends or opens the room at `/messages?room=<id>` with pre-filled context. If the user is unauthenticated, prompts login or offers direct off-platform options.
    2. **WhatsApp:** Opens `https://wa.me/<cleanPhone>?text=<encodedMessage>` if a center phone exists.
    3. **Phone Call:** `tel:${center.phone}`.
    4. **Email:** `mailto:${center.email}?subject=<encodedSubject>&body=<encodedMessage>`.
    5. **Copy Message:** Quick button to copy inquiry text to clipboard.

### 2.2 `TripCard.jsx` (List & Grid Views)
- Calculate:
  ```js
  const isFullyBooked = trip.is_bookable && trip.seats_available !== undefined && trip.seats_available !== null && trip.seats_available <= 0;
  ```
- **List & Grid Badge:**
  - If `isFullyBooked`, show an amber badge:
    ```jsx
    <span className='inline-flex items-center text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded'>
      Online spots full
    </span>
    ```
- **Action Buttons:**
  - If `trip.is_bookable && trip.octo_slot_id`:
    - When `!isFullyBooked`: Render standard green `"Book Now"` button linking to `/book/:slotId`.
    - When `isFullyBooked`: Render an amber/blue button: `"Inquire / Waitlist"` or `"Check Spots"` that opens `TripWaitlistInquiryModal`.

### 2.3 `TripDetail.jsx`
- **Header Actions:**
  - If `isFullyBooked`: Replace `"Book Online"` button with `"Inquire for Spots"` (amber/blue) opening `TripWaitlistInquiryModal`.
- **Booking Tab:**
  - When `isFullyBooked`:
    - Replace the green `"Reserve Your Seat Online"` banner with an amber-themed `"All Online Spots Reserved"` card.
    - Emphasize that additional boat capacity or cancellations may be available.
    - Replace the `"Proceed to Booking Wizard"` button with `"Inquire About Openings"`, which either opens `TripWaitlistInquiryModal` or scrolls smoothly to the contact details card with pre-filled actions.

### 2.4 `BookingWizard.jsx`
- In `fetchContext`, inspect `data.slot.seats_available`.
- If `seats_available !== undefined && seats_available <= 0`:
  - Display an early gate card:
    - Title: `"Departure Currently Full"`
    - Subtitle: `"All online slots for this departure have been booked."`
    - Action buttons:
      - `"Inquire with Center"` (triggers WhatsApp / Phone / Email / Chat).
      - `"Back to Dive Trips"` (`/dive-trips`).

---

## 3. Implementation Plan & Checklist

- [x] **Task 1: Create `TripWaitlistInquiryModal.jsx`**
  - Implement full modal with responsive layout, dark mode support, and touch-friendly buttons.
  - Implement message template composer with trip and dive site names.
  - Integrate In-App Chat (`createChatRoom`), WhatsApp (`wa.me`), Phone (`tel:`), and Email (`mailto:`).
  - Add copy-to-clipboard functionality.

- [x] **Task 2: Update `TripCard.jsx`**
  - Add `isFullyBooked` state logic.
  - Render amber badge for full trips.
  - Update List and Grid action buttons to open `TripWaitlistInquiryModal` when `isFullyBooked`.

- [x] **Task 3: Update `TripDetail.jsx`**
  - Add `isFullyBooked` state logic.
  - Update header action buttons.
  - Update Booking tab banner and CTA to support inquiry flow.
  - Wire modal opening.

- [x] **Task 4: Guard `BookingWizard.jsx`**
  - Add capacity check after loading context.
  - Render full-slot gate with contact triggers if `seats_available <= 0`.

- [x] **Task 5: Verification & Quality Control**
  - Run `make lint-frontend` and ensure 0 errors.
  - Verify visually using Chrome DevTools MCP tools.
  - Confirm 0 console errors.
