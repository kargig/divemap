# Dive Site Creation Tags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable users to seamlessly select and create tags/labels during the dive site creation flow, ensuring the same capability and UX consistency as the edit form.

**Architecture:** Integrate available tags querying and new tag creation mutations within `CreateDiveSite.jsx`. Upon successful creation of a dive site, the client captures the new site's ID and executes parallel POST requests to the tag-association endpoint, ensuring tags are linked successfully.

**Tech Stack:** React (Vite), React Query, Axios, React Hook Form, Tailwind CSS, Lucide Icons.

## Global Constraints
- **eslint compliance:** Zero eslint warnings or errors in frontend code. Run `make lint-frontend` to verify.
- **Responsive design:** Mobile-first layout. Horizontal scrolling on mobile is strictly forbidden. Ensure tag selectors wrap and stack beautifully.
- **Consistent UI styles:** Use established `UI_COLORS` and standard Tailwind CSS classes. No redundant styled wrappers.

---

### Task 1: UI State & Imports

**Files:**
- Modify: `frontend/src/pages/CreateDiveSite.jsx:1-120`

**Interfaces:**
- Consumes: `Tag` icon from `lucide-react`
- Produces: React states for managing selected tags, new tag form, and tag visibility in `CreateDiveSite` component scope.

- [ ] **Step 1: Update imports in `CreateDiveSite.jsx`**
  Modify imports from `lucide-react` to include the `Tag` icon:
  ```javascript
  import { ArrowLeft, Save, X, Tag } from 'lucide-react';
  ```

- [ ] **Step 2: Add Tag management state variables**
  Add the following state declarations right below other state variables inside the `CreateDiveSite` component:
  ```javascript
  // Tag management state
  const [selectedTags, setSelectedTags] = useState([]);
  const [newTagName, setNewTagName] = useState('');
  const [newTagDescription, setNewTagDescription] = useState('');
  const [showTagForm, setShowTagForm] = useState(false);
  ```

- [ ] **Step 3: Run linter to verify state and imports are correct**
  Run: `make lint-frontend`
  Expected: Success (or unused variable warnings that will be resolved as we proceed).

---

### Task 2: Fetch and Create Tags (React Query)

**Files:**
- Modify: `frontend/src/pages/CreateDiveSite.jsx:121-200`

**Interfaces:**
- Consumes: `/api/v1/tags/` API endpoints (GET to list, POST to create)
- Produces: `availableTags` array and `createTagMutation` function via React Query

- [ ] **Step 1: Fetch available tags**
  Integrate the `useQuery` hook to retrieve existing tags from the backend:
  ```javascript
  // Fetch all available tags
  const { data: availableTags = [] } = useQuery(
    ['available-tags'],
    () => api.get('/api/v1/tags/').then(res => res.data),
  );
  ```

- [ ] **Step 2: Add tag creation mutation**
  Integrate the `useMutation` hook to allow users to create new tags dynamically:
  ```javascript
  // Tag mutations
  const createTagMutation = useMutation(tagData => api.post('/api/v1/tags/', tagData), {
    onSuccess: newTag => {
      queryClient.invalidateQueries(['available-tags']);
      setSelectedTags(prev => [...prev, newTag.id]);
      setNewTagName('');
      setNewTagDescription('');
      setShowTagForm(false);
      toast.success('Tag created and selected successfully');
    },
    onError: error => {
      toast.error(extractErrorMessage(error) || 'Failed to create tag');
    },
  });
  ```

- [ ] **Step 3: Validate syntax and run the frontend build**
  Run: `docker exec divemap_frontend npm run build`
  Expected: Build succeeds without syntax or import errors.

---

### Task 3: Render Tags Section in Form

**Files:**
- Modify: `frontend/src/pages/CreateDiveSite.jsx:800-1050` (insert between Media and Form Actions)

**Interfaces:**
- Consumes: `availableTags` list and `selectedTags` state
- Produces: Fully interactive Tailwind CSS-styled section for managing, selecting, and creating tags.

- [ ] **Step 1: Insert Tag Management HTML structure**
  Locate the form actions boundary (just before `Form Actions` or above `<div className='flex justify-end space-x-4 pt-6 border-t'>`) and insert the following Tailwind-compatible Tags interface code:
  ```jsx
              {/* Tags Management */}
              <div className='border-t pt-6'>
                <div className='flex items-center justify-between mb-4'>
                  <h3 className='text-lg font-semibold text-gray-900'>Tags</h3>
                  <button
                    type='button'
                    onClick={() => setShowTagForm(!showTagForm)}
                    className='flex items-center px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-colors'
                  >
                    <Tag className='w-4 h-4 mr-2' />
                    Add Tag
                  </button>
                </div>

                {/* Add Tag Form */}
                {showTagForm && (
                  <div className='bg-gray-50 p-4 rounded-md mb-4'>
                    <div className='space-y-4'>
                      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                        <div>
                          <label
                            htmlFor='new_tag_name'
                            className='block text-sm font-medium text-gray-700 mb-1'
                          >
                            Tag Name *
                          </label>
                          <input
                            id='new_tag_name'
                            type='text'
                            value={newTagName}
                            onChange={e => setNewTagName(e.target.value)}
                            required
                            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                          />
                        </div>
                        <div>
                          <label
                            htmlFor='new_tag_description'
                            className='block text-sm font-medium text-gray-700 mb-1'
                          >
                            Description
                          </label>
                          <input
                            id='new_tag_description'
                            type='text'
                            value={newTagDescription}
                            onChange={e => setNewTagDescription(e.target.value)}
                            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                          />
                        </div>
                      </div>
                      <div className='flex space-x-2'>
                        <button
                          type='button'
                          onClick={() => {
                            if (!newTagName.trim()) {
                              toast.error('Tag name is required');
                              return;
                            }
                            createTagMutation.mutate({
                              name: newTagName,
                              description: newTagDescription,
                            });
                          }}
                          disabled={createTagMutation.isLoading}
                          className='px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-colors disabled:opacity-50'
                        >
                          {createTagMutation.isLoading ? 'Adding...' : 'Add Tag'}
                        </button>
                        <button
                          type='button'
                          onClick={() => setShowTagForm(false)}
                          className='px-4 py-2 text-white rounded-md hover:bg-gray-800'
                          style={{ backgroundColor: UI_COLORS.neutral }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Available Tags */}
                <div className='mb-6'>
                  <h4 className='text-sm font-semibold text-gray-800 mb-3'>Select Tags</h4>
                  <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3'>
                    {Array.isArray(availableTags) && availableTags.length > 0 ? (
                      availableTags.map(tag => (
                        <label
                          key={tag.id}
                          className='flex items-center space-x-2 cursor-pointer p-2 rounded hover:bg-gray-50 border border-gray-100 transition-colors'
                        >
                          <input
                            type='checkbox'
                            checked={selectedTags.includes(tag.id)}
                            onChange={e => {
                              if (e.target.checked) {
                                setSelectedTags(prev => [...prev, tag.id]);
                              } else {
                                setSelectedTags(prev => prev.filter(id => id !== tag.id));
                              }
                            }}
                            className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                          />
                          <span className='text-sm font-medium text-gray-700 truncate' title={tag.name}>
                            {tag.name}
                          </span>
                        </label>
                      ))
                    ) : (
                      <p className='text-gray-500 text-sm col-span-full'>No tags available</p>
                    )}
                  </div>
                </div>

                {/* Selected Tags Summary */}
                <div className='mb-6'>
                  <h4 className='text-sm font-semibold text-gray-800 mb-3'>
                    Selected Tags ({selectedTags.length})
                  </h4>
                  <div className='flex flex-wrap gap-2'>
                    {selectedTags.length > 0 ? (
                      selectedTags.map(tagId => {
                        const tag = availableTags.find(t => t.id === tagId);
                        return tag ? (
                          <span
                            key={tagId}
                            className='px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium'
                          >
                            {tag.name}
                          </span>
                        ) : null;
                      })
                    ) : (
                      <p className='text-gray-500 text-sm'>No tags selected</p>
                    )}
                  </div>
                </div>
              </div>
  ```

- [ ] **Step 2: Run linter to ensure perfect tag formatting and styles**
  Run: `make lint-frontend`
  Expected: Success.

---

### Task 4: Submit-Time Tag Association

**Files:**
- Modify: `frontend/src/pages/CreateDiveSite.jsx:140-180` (inside `createDiveSiteMutation`)

**Interfaces:**
- Consumes: Result of `POST /api/v1/dive-sites/` mutation
- Produces: Sequenced backend calls to link the selected tags using the generated site ID.

- [ ] **Step 1: Rewrite `createDiveSiteMutation` async logic**
  Integrate parallel tag mapping right inside `createDiveSiteMutation`'s main resolver function:
  ```javascript
  const createDiveSiteMutation = useMutation(
    async data => {
      // Create the main dive site first
      const response = await api.post('/api/v1/dive-sites/', data);
      const siteId = response.data.id;

      // Associate selected tags sequentially or in parallel
      if (selectedTags.length > 0 && siteId) {
        const tagPromises = selectedTags.map(tagId =>
          api.post(`/api/v1/tags/dive-sites/${siteId}/tags`, { tag_id: tagId })
        );
        await Promise.all(tagPromises);
      }

      return response.data;
    },
    // Keep existing onSuccess and onError handlers...
  ```

- [ ] **Step 2: Re-run linter to verify zero compliance errors**
  Run: `make lint-frontend`
  Expected: Success.

---

### Task 5: Testing & Verification

**Files:**
- Test: Manual browser validation & verification commands

- [ ] **Step 1: Perform code validation and build check**
  Run: `docker exec divemap_frontend npm run build`
  Expected: Build succeeds.

- [ ] **Step 2: Use Chrome DevTools MCP to load and verify Create Page**
  Load: `http://localhost/dive-sites/create` (or navigate via UI)
  Verify: Form loads completely, "Tags" section is displayed with checkboxes, and no errors exist in the console.

- [ ] **Step 3: Run comprehensive verification**
  Run: `make lint-frontend`
  Expected: Success.
