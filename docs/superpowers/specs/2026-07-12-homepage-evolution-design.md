# Design Specification: Homepage Evolution & Experience Polish

**Author:** Gemini CLI  
**Date:** Sunday, 12 July 2026  
**Status:** Approved Specification  

---

## 1. Executive Summary
The Divemap home page currently suffers from vertical spacing bloat, particularly due to a large static logo banner on desktop and a tall mobile hero header. This is followed by separate, static sections for community statistics and a "Daily Feature" widget. 

This specification introduces a unified, dynamic, and immersive experience for first-time visitors by:
1.  **Merging** the hero area, community stats, and daily featured widgets into a single interactive **3-Slide Morphing Hero Carousel** with modern underwater CSS animations, integrated hover safeguards, and a hero fuzzy search bar.
2.  **Removing** the redundant, duplicate static sections lower down on the homepage.
3.  **Introducing** an interactive, high-engagement **"Scuba Sandbox" Quick-Calculator Tabbed Widget** below the features grid to drive instant engagement.
4.  **Replacing** the duplicated bottom footer CTA with a highly engaging, privacy-safe **"Live Pulse" Recent Activity Feed**.

---

## 2. Detailed Technical Design & Components

### 2.1 Component 1: The Morphing Hero Carousel (`frontend/src/pages/Home.jsx`)
The hero banner area will be redesigned as a responsive, self-contained carousel container featuring three dynamic slides.

*   **Slide 1: Brand Introduction & Quick Search (Zero-Friction Gateway)**
    *   Displays a compact Brand Icon, Logo, and core site value propositions (Discover, Rate, and Log Dives).
    *   **Fuzzy Search Integration:** Embeds the central Axios-backed Fuzzy Search bar directly below the brand description, allowing visitors to search for world-famous dive locations (e.g., 'Blue Hole', 'Zenobia') instantly from their first second on the landing page.
*   **Slide 2: Our Growing Community Stats**
    *   Embeds the live counting statistics (`Dives Logged`, `Dive Sites`, `Reviews`, `Diving Centers`, `Organized Trips`) using the existing `AnimatedCounter` component.
*   **Slide 3: Daily Featured Item**
    *   Renders the dynamic `DailyFeatureSnippet` directly inside the slide based on the current day of the month (`getDate() % 6`), keeping the page alive with rotation.

#### Spacing, Timing & Interaction Mechanics
*   **Auto-rotation:** The slides will transition automatically every $6$ seconds using a smooth horizontal translation or slide-fade.
*   **Manual Controls:** Interactive pagination indicator dots and minimal left/right navigation arrows.
*   **Autoplay Hover-Pause Safeguard:** To prevent the UI from feeling frantic or frustrating, autoplay will pause immediately whenever a user hovers over the hero container or interacts with a navigation button/input, resuming only when they move their cursor away.

#### Aesthetic & Ambient Ocean Layer
*   **Slow-Moving Wave Divider:** An animated HTML-based SVG path applied as a bottom mask to the hero container. The waves will slowly deform and float horizontally using subtle CSS `keyframes` animation.
*   **Micro-Bubbles:** Semi-transparent circular div elements styled as bubbles that float vertically with varying speeds and random animation-delays.

---

### 2.2 Component 2: Page Clean-up & Reorganisation
To avoid redundant content and massive vertical scrolling, the following actions are taken:
*   **Remove** the old, static `Our Growing Community` section from its current position below the features grid.
*   **Remove** the old, static `Daily Feature Section` that previously rendered the `DailyFeatureSnippet` at the bottom of the page.
*   This tightens the middle of the homepage significantly, channeling user focus directly onto the primary interactive CTA links.

---

### 2.3 Component 3: The "Scuba Sandbox" Interactive Tab-Widget
Located below the features grid, the **"Scuba Sandbox"** is an interactive, compact card providing immediate dive-planning utility.
*   **Layout:** High-contrast, clean-bordered card with a tab bar selector: `[ MOD | Best Mix | Weight ]`.
*   **Tabs & Core Physics Integration:**
    1.  **MOD Calculator Tab:** Uses the shared `calculateMOD` formula. Calculates maximum operating depth based on a Nitrox O2 slider input (21% to 40%) and maximum partial pressure of oxygen ($P\text{O}_2$) (1.2 to 1.6).
    2.  **Best Mix Tab:** Calculates the recommended Nitrox oxygen percentage ($FO_2$) based on depth (10m to 40m) and targeted $P\text{O}_2$.
    3.  **Weight Tab:** Estimates recommended diving lead (in kg) based on body weight slider (40kg to 120kg), wetsuit thickness select dropdown (None, 3mm, 5mm, 7mm), and water type (Fresh / Salt).
*   **Friction Reduction:** Standard HTML sliders and inputs to keep it highly reactive, simple, and clean, with a call-to-action button linking to the full advanced calculators page.

---

### 2.4 Component 4: The "Live Pulse" Recent Activity Feed
The duplicative "Ready to Start Your Diving Journey?" CTA block at the bottom will be removed and replaced by a sleek, dynamic community timeline feed.

#### Privacy-Safe Guidelines (Zero-PII Compliance)
To prevent leakage of PII (Personally Identifiable Information) or sensitive social graphs:
*   **No Friendship/Buddy events:** Friendship connections will be omitted from the feed entirely to protect user social graphs and privacy.
*   **Filtered Event Types:** The feed will display only strictly public, non-sensitive contribution events:
    1.  *Public Dives Logged:* "User `A` logged a public dive at `Site X`" (only if the dive log is explicitly marked as public).
    2.  *Public Site Reviews:* "User `B` rated `Site Y` [5 Stars]" (showing rating stars and public review text).
    3.  *Public Site Additions:* "User `C` added a new dive site `Site Z`".
*   **Anonymized Displays:** Only public usernames and public dive site names are displayed. No real names, emails, private profiles, or coordinates are exposed.

#### Frontend Interface
*   Includes a pulsing green "Live" activity dot indicator at the top of the feed card.
*   Up to 4 feed cards rendered in a vertical timeline, wrapping cleanly on mobile devices.
*   All user and site names are links, allowing fast click-through to explore public pages.

---

## 3. Responsive Layout Standards (Mobile-First)

*   **No Horizontal Scrolling:** Elements must fit comfortably within narrow mobile viewports. On mobile screens (`max-w-md`), the Carousel container, Scuba Sandbox tabs, and the Recent Activity cards will stack vertically and scale dynamically.
*   **Unified Padding:** Padding inside cards will be set to `p-3.5 sm:p-5` and outer page borders will use responsive margin rules to optimize writing space on smaller viewports.

---

## 4. Verification & Testing Plan

### 4.1 Frontend UI Verification
*   Verify that the homepage loads with zero console errors using Chrome DevTools `list_console_messages`.
*   Ensure that there is no horizontal scrolling on mobile viewports.
*   Validate navigation click-throughs from Carousel slides and Recent Activity cards.

### 4.2 Security & Privacy Compliance Audit
*   Audit the `/api/public/recent-activity` FastAPI output payload to ensure that absolutely no private fields (`email`, `first_name`, `last_name`, `coordinates` for private dives) are returned in the JSON response.
