# User Leaderboard Feature Plan

## Objective
Implement a leaderboard system in Divemap to highlight the most active and contributing users and diving centers across various metrics (creation, editing, reviewing, commenting, and organizing trips). This system will serve as the foundation for gamifying user engagement.

## Scope & Metrics
The leaderboard will track specific actions and aggregate them into a Unified Points System, while also displaying top performers in individual categories.

### 1. Unified Points System (Gamification)
To encourage broad participation, users will earn "Dive Points" based on their contributions. Proposed point weights (subject to future tuning):
*   **Creating a Dive Site:** 20 pts
*   **Logging a Dive:** 10 pts
*   **Creating a Diving Center:** 15 pts
*   **Editing a Dive Site:** 5 pts
*   **Reviewing a Site/Center:** 5 pts
*   **Commenting on a Site/Center:** 2 pts

*Note: The overall "Top Diver" leaderboard will rank users based on their total accumulated points.*

### 2. Individual Categories
Alongside the unified points, we will track and display leaders for specific actions:
*   **Most Dives Logged:** Count of `Dive` records per `user_id`.
*   **Most Dive Sites Created:** Count of `DiveSite` records per `created_by`.
*   **Most Diving Centers Created:** Count of `DivingCenter` records per `owner_id`.
*   **Most Dive Sites Edited:** Count of `DiveSiteEditRequest` records per `requested_by_id`. 
*   **Top Reviewer:** Sum of `SiteRating` + `CenterRating` per `user_id`.
*   **Top Commenter:** Sum of `SiteComment` + `CenterComment` per `user_id`.
*   **Most Dive Trips Organized:** Count of `ParsedDiveTrip` records per `diving_center_id` (Diving Center specific).

## Implementation Steps

### Preparation
1.  **Create Feature Branch:** Create a new branch named `feature/user-leaderboard` from `main` to isolate development.

### Backend (FastAPI)
1.  **Create a New Router:** `backend/app/routers/leaderboard.py`.
2.  **Define Pydantic Schemas:** Create response schemas in `backend/app/schemas/leaderboard.py` (e.g., `LeaderboardUserEntry`, `LeaderboardCenterEntry`, `LeaderboardPointsEntry`, `LeaderboardResponse`).
3.  **Implement Aggregation Queries:** Use SQLAlchemy to calculate counts and total points.
    *   *Unified Points Query:* A combined query or CTE that sums the weighted counts of user actions.
4.  **Implement Caching:** Use **Short-term Memory Cache** (e.g., `cachetools` TTL cache or FastAPI's memory caching mechanisms) with a 5-15 minute TTL to prevent heavy database loads on every request.
5.  **Create API Endpoints:**
    *   `GET /api/v1/leaderboard/users/overall?limit=10` (Total Points)
    *   `GET /api/v1/leaderboard/users/category/{metric}?limit=10`
    *   `GET /api/v1/leaderboard/centers?limit=10` (Trips Organized)

### Frontend (React)
1.  **Create API Service:** Add `frontend/src/services/leaderboardService.js` to fetch data from the new endpoints.
2.  **Create Leaderboard Dashboard (Dashboard Grid View):**
    *   `LeaderboardPage.jsx`: The main view showing a grid of "cards" or mini-tables.
    *   **Hero Section:** Prominently display the Top 3 "Overall Top Divers" based on the Unified Points System.
    *   **Grid Layout:** Display the top 3-5 users for individual categories (Dives, Sites, Reviews, etc.) in a responsive grid.
    *   **"View All" Modals/Pages:** Allow users to click "View All" on any grid card to see the full Top 50 for that category using a TanStack Table.
3.  **Add Navigation:** Add a link to the Leaderboard in the main navigation bar (`ui-navbar-guidelines` aware).
4.  **Styling:** Ensure the UI follows the "mobile-first" and "frontend-design" guidelines.

## Verification & Testing
1.  **Backend Tests:** Create `backend/tests/routers/test_leaderboard.py` to verify API logic, ensuring accurate point calculation and caching behavior.
2.  **Frontend Tests:** Ensure components render correctly in the grid layout and handle loading/error states.
3.  **Performance Check:** Verify the aggregation queries execute efficiently and that the memory cache is hit correctly on subsequent requests.