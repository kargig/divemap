# Admin Menu & Dashboard Restructuring Plan

## 1. Current State & Issues
Currently, the Admin section consists of 19+ independent pages. 
- **No Persistent Navigation:** Once an admin clicks into a specific section (e.g., "User Management"), they lose access to the admin menu and must use the browser back button or return to `/admin` to navigate elsewhere.
- **Flat Routing:** All admin routes in `App.jsx` are top-level siblings without a shared layout wrapper.
- **Directory-Style Dashboard:** `Admin.jsx` acts purely as a directory of links (a grid of cards) rather than a true dashboard that surfaces actionable insights or pending tasks.

## 2. Proposed Architecture: `AdminLayout`
Introduce a dedicated layout wrapper (`AdminLayout.jsx`) for all `/admin/*` routes. 

### Key Features of the Layout:
- **Persistent Sidebar:** A vertical navigation menu on the left side (desktop) containing categorized links to all admin pages.
- **Top Header:** A sticky top bar containing breadcrumbs to show the current location (e.g., `Admin / Content / Dive Sites`), a collapse toggle for the sidebar, and a quick "Back to Main Site" button.
- **Mobile Support:** On mobile devices, the sidebar will convert into a slide-out drawer (hamburger menu) or a collapsible top menu to save screen space.

## 3. Logical Categorization (Sidebar Structure)
To prevent overwhelming the user, the sidebar will group the 19+ pages into logical, collapsible categories:

**🏠 Dashboard**
- Overview (The new `/admin` landing page)

**📝 Content Management**
- Dives (`/admin/dives`)
- Dive Sites (`/admin/dive-sites`)
- Dive Routes (`/admin/dive-routes`)
- Diving Centers (`/admin/diving-centers`)
- Diving Organizations (`/admin/diving-organizations`)
- Pending Edits (`/admin/dive-sites/edit-requests`)
- Tags (`/admin/tags`)
- Newsletters (`/admin/newsletters`)

**👥 User & Community Management**
- Users (`/admin/users`)
- Ownership Requests (`/admin/ownership-requests`)
- Notification Prefs (`/admin/notification-preferences`)

**🤖 AI & Support**
- Chatbot History (`/admin/chat-history`)
- Chatbot Feedback (`/admin/chat-feedback`)

**⚙️ System & Analytics**
- System Metrics (`/admin/system-metrics`)
- General Statistics (`/admin/general-statistics`)
- Growth Visualizations (`/admin/growth-visualizations`)
- Recent Activity (`/admin/recent-activity`)
- Auth Audit Logs (`/admin/audit-logs`)

## 4. Dashboard Redesign (`Admin.jsx`)
Transform the main `/admin` page from a static link directory into an active summary dashboard.
- **Actionable Widgets:** Show numbers requiring attention (e.g., "5 Pending Ownership Requests", "12 Pending Dive Site Edits").
- **System Health Snippet:** Display high-level system status or recent activity briefly.
- **Quick Links:** Keep a small section of frequently used actions.

## 5. Implementation Steps
1. **Create `AdminLayout.jsx`**: Build the responsive layout with the sidebar and top header (incorporating Lucide icons).
2. **Update Routing in `App.jsx`**: Wrap all existing `<ProtectedRoute requireAdmin={true}>` routes within the new `<AdminLayout>`.
3. **Refactor `Admin.jsx`**: Remove the grid of 14+ large cards. Replace it with summary statistics and pending action widgets (mocked initially, or wired to existing endpoints if available).
4. **Standardize Tables**: Ensure existing pages (like `AdminUsers.jsx` or `AdminDiveSites.jsx`) stretch nicely within the new layout container.
