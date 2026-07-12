# Mobile Card Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize list view cards across the app by adding consistent left borders, removing redundant "View Details" text buttons, and adding a globally visible, clickable chevron arrow pointing to details.

**Architecture:** We will modify five frontend React components/pages that render the list views. The changes are purely structural and styling (Tailwind CSS).

**Tech Stack:** React, Tailwind CSS

---

### Task 1: Update Dives Card

**Files:**
- Modify: `frontend/src/pages/Dives.jsx`

- [ ] **Step 1: Replace chevron with clickable link**

We will update the chevron icon at the bottom of the dive item to be a clickable link wrapping the icon, and remove the `sm:hidden` class so it appears on desktop. We also add `ml-auto` to push it right if needed.

Find in `frontend/src/pages/Dives.jsx` (around line 1056):
```jsx
                      </div>
                      <ChevronRight className='w-4 h-4 text-gray-300 sm:hidden' />
                    </div>
```

Replace with:
```jsx
                      </div>
                      <Link
                        to={`/dives/${dive.id}/${getDiveSlug(dive)}`}
                        className='w-8 h-8 ml-auto inline-flex items-center justify-center bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-lg transition-all group'
                        title='View Details'
                      >
                        <ChevronRight className='w-4 h-4 transition-transform group-hover:translate-x-0.5 flex-shrink-0' />
                      </Link>
                    </div>
```

- [ ] **Step 2: Verify Dives page UI**

Run: `node frontend/tests/run_frontend_tests.js` (Note: we don't have explicit visual tests in this project, so manual verification via MCP is required if subagent is used, but for the plan, we just ensure no syntax errors).
Also, use Serena tool `mcp_serena_replace_content` for surgical replacements.

### Task 2: Update Dive Site Card

**Files:**
- Modify: `frontend/src/components/DiveSiteCard.jsx`

- [ ] **Step 1: Replace chevron with clickable link**

Find in `frontend/src/components/DiveSiteCard.jsx` (inside `DiveSiteListCard` component):
```jsx
            </div>

            <ChevronRight className='w-4 h-4 text-gray-300 sm:hidden' />
          </div>
```

Replace with:
```jsx
            </div>

            <Link
              to={`/dive-sites/${site.id}/${slugify(site.name)}`}
              className='w-8 h-8 ml-auto inline-flex items-center justify-center bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-lg transition-all group'
              title='View Details'
            >
              <ChevronRight className='w-4 h-4 transition-transform group-hover:translate-x-0.5 flex-shrink-0' />
            </Link>
          </div>
```

### Task 3: Update Dive Routes Card

**Files:**
- Modify: `frontend/src/pages/DiveRoutes.jsx`

- [ ] **Step 1: Replace "View Route" text link with chevron icon button**

Find in `frontend/src/pages/DiveRoutes.jsx`:
```jsx
                  {/* Footer: Creator & Actions */}
                  <div className='flex items-center justify-end'>
                    <Link
                      to={`/dive-sites/${route.dive_site_id}/route/${route.id}/${slugify(route.name)}`}
                      className='inline-flex items-center gap-1 text-[11px] sm:text-sm font-bold sm:font-semibold text-blue-600 hover:text-blue-800 transition-colors group'
                    >
                      View Route
                      <ChevronRight className='w-3 h-3 sm:w-4 sm:h-4 transition-transform group-hover:translate-x-0.5' />
                    </Link>
                  </div>
```

Replace with:
```jsx
                  {/* Footer: Creator & Actions */}
                  <div className='flex items-center justify-end'>
                    <Link
                      to={`/dive-sites/${route.dive_site_id}/route/${route.id}/${slugify(route.name)}`}
                      className='w-8 h-8 inline-flex items-center justify-center bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-lg transition-all group'
                      title='View Route Details'
                    >
                      <ChevronRight className='w-4 h-4 transition-transform group-hover:translate-x-0.5 flex-shrink-0' />
                    </Link>
                  </div>
```

### Task 4: Update Trip Card

**Files:**
- Modify: `frontend/src/components/TripCard.jsx`

- [ ] **Step 1: Add left border and update border styling**

Find in `frontend/src/components/TripCard.jsx` (around line 77):
```jsx
  const cardClasses = isGrid
    ? 'bg-white rounded-xl shadow-md overflow-hidden border border-gray-100 flex flex-col h-full hover:shadow-lg transition-shadow duration-300'
    : `bg-white rounded-xl shadow-md overflow-hidden border border-gray-100 mb-6 hover:shadow-lg transition-shadow duration-300 relative ${
        !user ? 'pointer-events-none' : ''
      }`;
```

Replace with:
```jsx
  const cardClasses = isGrid
    ? 'bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[rgb(45,107,138)] overflow-hidden flex flex-col h-full hover:shadow-md transition-shadow duration-300'
    : `bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[rgb(45,107,138)] mb-6 hover:shadow-md transition-shadow duration-300 relative ${
        !user ? 'pointer-events-none' : ''
      }`;
```

- [ ] **Step 2: Remove "View Details" button from header area**

Find in `frontend/src/components/TripCard.jsx`:
```jsx
                <Link
                  to={tripUrl}
                  className='inline-flex items-center gap-2 px-4 py-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors font-medium border border-blue-100 sm:border-transparent'
                >
                  View Details
                  <ChevronRight className='w-4 h-4' />
                </Link>
```
Remove this entire `<Link>` block. Be careful to preserve the enclosing `</div>` and other action buttons (Edit/Delete).

- [ ] **Step 3: Add chevron to list view footer**

Find in `frontend/src/components/TripCard.jsx` (around line 348, the footer section for non-grid):
```jsx
        {/* Footer info: Added/Updated */}
        {!isGrid && (
          <div className='flex flex-row flex-wrap items-center gap-y-1 text-[10px] sm:text-xs text-gray-400 mt-auto pt-3 border-t border-gray-50'>
            {trip.created_at && (
              <div className='flex items-center'>
```

Replace with:
```jsx
        {/* Footer info: Added/Updated */}
        {!isGrid && (
          <div className='flex flex-row flex-wrap items-center gap-y-1 text-[10px] sm:text-xs text-gray-400 mt-auto pt-3 border-t border-gray-50'>
            <div className='flex flex-wrap gap-y-1 flex-1'>
              {trip.created_at && (
                <div className='flex items-center'>
                  <span className='font-medium text-gray-500 mr-1'>Added:</span>
                  <span className='whitespace-nowrap'>
                    {new Date(trip.created_at).toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              )}
              {trip.updated_at && trip.updated_at !== trip.created_at && (
                <div className='flex items-center ml-2 sm:ml-3 pl-2 sm:pl-3 border-l border-gray-200'>
                  <span className='font-medium text-gray-500 mr-1'>Updated:</span>
                  <span className='whitespace-nowrap'>
                    {new Date(trip.updated_at).toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              )}
            </div>
            
            {user && (
              <Link
                to={tripUrl}
                className='w-8 h-8 ml-auto inline-flex items-center justify-center bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-lg transition-all group shrink-0'
                title='View Trip Details'
              >
                <ChevronRight className='w-4 h-4 transition-transform group-hover:translate-x-0.5 flex-shrink-0' />
              </Link>
            )}
          </div>
        )}
```

### Task 5: Standardize Diving Centers Card Action Row

**Files:**
- Modify: `frontend/src/pages/DivingCenters.jsx`

- [ ] **Step 1: Update chevron button classes to match others**

Find in `frontend/src/pages/DivingCenters.jsx`:
```jsx
                            <Link
                              to={`/diving-centers/${center.id}/${slugify(center.name)}`}
                              className='w-8 h-8 inline-flex items-center justify-center bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 active:scale-95 transition-all'
                              title='View Details'
                            >
                              <ChevronRight className='w-4 h-4 text-gray-600 flex-shrink-0' />
                            </Link>
```

Replace with:
```jsx
                            <Link
                              to={`/diving-centers/${center.id}/${slugify(center.name)}`}
                              className='w-8 h-8 inline-flex items-center justify-center bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-lg transition-all group ml-auto sm:ml-0'
                              title='View Details'
                            >
                              <ChevronRight className='w-4 h-4 transition-transform group-hover:translate-x-0.5 flex-shrink-0' />
                            </Link>
```
Note: Added `group` for the hover transform, and adjusted the colors to `bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-600`.

### Task 6: Final Verification

- [ ] **Step 1: Run linter and verify**

```bash
docker exec divemap_frontend npm run lint
```
(If the container is not running or if `make lint-frontend` is preferred: `make lint-frontend`)

- [ ] **Step 2: Commit changes**

Since the task is essentially standardizing classes, an overall commit is good:
```bash
# User handles the commit manually using commit-message.txt or agent uses serena tools if requested
```