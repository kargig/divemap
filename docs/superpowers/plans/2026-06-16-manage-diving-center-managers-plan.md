# Diving Center Manager Administration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the ability for approved diving center owners, administrators, and moderators to add, list, and remove diving center managers directly from the frontend.

**Architecture:** Extend backend Pydantic schemas, add secure REST endpoints under `/api/v1/diving-centers/{id}/managers` with strict role-based permission checks, write comprehensive unit tests, expose frontend client methods, and build a beautiful "Team Management" component inside the center's Management tab.

**Tech Stack:** Python (FastAPI, SQLAlchemy), React, React Query, Tailwind CSS.

---

### Task 1: Backend Schemas Extension

**Files:**
- Modify: `backend/app/schemas/__init__.py`

- [ ] **Step 1: Add manager request and response schemas**
  Add the following schemas to the end of `backend/app/schemas/__init__.py` to facilitate manager representation:

```python
class DivingCenterManagerResponse(BaseModel):
    user_id: int
    username: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    avatar_url: Optional[str] = None

class DivingCenterManagerCreate(BaseModel):
    username: str
```

- [ ] **Step 2: Commit**
  Stage the schema changes.

---

### Task 2: Backend API Endpoints Implementation

**Files:**
- Modify: `backend/app/routers/diving_centers.py`

- [ ] **Step 1: Implement GET, POST, and DELETE endpoints**
  Insert the following secure endpoints under the other sub-routes (e.g., near line 1450) of `backend/app/routers/diving_centers.py`:

```python
@router.get("/{diving_center_id}/managers", response_model=List[DivingCenterManagerResponse])
async def get_diving_center_managers(
    diving_center_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all managers associated with a diving center."""
    # 1. Fetch diving center
    center = db.query(DivingCenter).filter(DivingCenter.id == diving_center_id).first()
    if not center:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Diving center not found")

    # 2. Check if current_user has access (Admin, Moderator, Owner, or Manager)
    is_owner = center.owner_id == current_user.id and center.ownership_status == OwnershipStatus.approved
    is_manager = db.query(DivingCenterManager).filter(
        DivingCenterManager.diving_center_id == diving_center_id,
        DivingCenterManager.user_id == current_user.id
    ).first() is not None

    if not current_user.is_admin and not current_user.is_moderator and not is_owner and not is_manager:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to view managers")

    # 3. Fetch managers
    managers = db.query(User).join(DivingCenterManager, User.id == DivingCenterManager.user_id).filter(
        DivingCenterManager.diving_center_id == diving_center_id
    ).all()

    return [
        DivingCenterManagerResponse(
            user_id=u.id,
            username=user.username,
            full_name=u.full_name,
            email=u.email,
            avatar_url=u.avatar_url
        ) for u in managers
    ]


@router.post("/{diving_center_id}/managers", response_model=DivingCenterManagerResponse)
async def add_diving_center_manager(
    diving_center_id: int,
    manager_create: DivingCenterManagerCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Add a new manager to a diving center. Only approved owners or admins/moderators can do this."""
    # 1. Fetch diving center
    center = db.query(DivingCenter).filter(DivingCenter.id == diving_center_id).first()
    if not center:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Diving center not found")

    # 2. Check permissions (Admin, Moderator, or Approved Owner)
    is_owner = center.owner_id == current_user.id and center.ownership_status == OwnershipStatus.approved
    if not current_user.is_admin and not current_user.is_moderator and not is_owner:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only approved owners or administrators can add managers")

    # 3. Find user to add as manager
    target_user = db.query(User).filter(User.username == manager_create.username).first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_442_UNPROCESSABLE_ENTITY, detail="User not found")

    # 4. Check if already owner
    if center.owner_id == target_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The owner is already a manager by default")

    # 5. Check if already manager
    existing_manager = db.query(DivingCenterManager).filter(
        DivingCenterManager.diving_center_id == diving_center_id,
        DivingCenterManager.user_id == target_user.id
    ).first()
    if existing_manager:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This user is already a manager of this center")

    # 6. Create manager association
    new_manager = DivingCenterManager(diving_center_id=diving_center_id, user_id=target_user.id)
    db_session.add(new_manager)
    db_session.commit()

    return DivingCenterManagerResponse(
        user_id=target_user.id,
        username=target_user.username,
        full_name=target_user.full_name,
        email=target_user.email,
        avatar_url=target_user.avatar_url
    )


@router.delete("/{diving_center_id}/managers/{user_id}", response_model=dict)
async def remove_diving_center_manager(
    diving_center_id: int,
    user_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Remove a manager from a diving center. Only approved owners or admins/moderators can do this."""
    # 1. Fetch diving center
    center = db.query(DivingCenter).filter(DivingCenter.id == diving_center_id).first()
    if not center:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Diving center not found")

    # 2. Check permissions (Admin, Moderator, or Approved Owner)
    is_owner = center.owner_id == current_user.id and center.ownership_status == OwnershipStatus.approved
    if not current_user.is_admin and not current_user.is_moderator and not is_owner:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only approved owners or administrators can remove managers")

    # 3. Find and delete manager association
    assoc = db.query(DivingCenterManager).filter(
        DivingCenterManager.diving_center_id == diving_center_id,
        DivingCenterManager.user_id == user_id
    ).first()
    
    if not assoc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Manager association not found")

    db_session.delete(assoc)
    db_session.commit()

    return {"status": "success", "message": "Manager removed successfully"}
```

- [ ] **Step 2: Commit**
  Stage the backend router updates.

---

### Task 3: Backend API Unit Tests

**Files:**
- Modify: `backend/tests/test_diving_centers.py`

- [ ] **Step 1: Write TDD tests for manager endpoints**
  Add tests inside `backend/tests/test_diving_centers.py` to assert correct CRUD operations and roles:

```python
    def test_manager_crud_endpoints(self, client, auth_headers, test_user, test_user_other, test_diving_center, db_session):
        """Test listing, adding, and removing managers with correct ownership checks."""
        from app.models import OwnershipStatus
        
        # Make test_user the approved owner of the center
        test_diving_center.owner_id = test_user.id
        test_diving_center.ownership_status = OwnershipStatus.approved
        db_session.commit()

        # 1. Add test_user_other as manager
        response = client.post(
            f"/api/v1/diving-centers/{test_diving_center.id}/managers",
            json={"username": test_user_other.username},
            headers=auth_headers
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["username"] == test_user_other.username

        # 2. List managers (owned user)
        response = client.get(
            f"/api/v1/diving-centers/{test_diving_center.id}/managers",
            headers=auth_headers
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]["username"] == test_user_other.username

        # 3. Try to add same manager again (Expect 400 Bad Request)
        response = client.post(
            f"/api/v1/diving-centers/{test_diving_center.id}/managers",
            json={"username": test_user_other.username},
            headers=auth_headers
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

        # 4. Remove manager
        response = client.delete(
            f"/api/v1/diving-centers/{test_diving_center.id}/managers/{test_user_other.id}",
            headers=auth_headers
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["status"] == "success"
```

- [ ] **Step 2: Run tests to verify correctness**
  Run: `cd backend && ./docker-test-github-actions.sh tests/test_diving_centers.py`
  Expected: PASS

- [ ] **Step 3: Commit**
  Stage the modified tests.

---

### Task 4: Frontend API Service Extension

**Files:**
- Modify: `frontend/src/services/divingCenters.js`

- [ ] **Step 1: Write client methods**
  Expose the dynamic Axios endpoints for team management inside `frontend/src/services/divingCenters.js`:

```javascript
/**
 * Fetch all managers associated with a diving center.
 * @param {number} centerId - ID of diving center
 * @returns {Promise<Array>} List of managers
 */
export const getCenterManagers = async (centerId) => {
  const response = await api.get(`/api/v1/diving-centers/${centerId}/managers`);
  return response.data;
};

/**
 * Associate a user as a manager of a diving center by username.
 * @param {number} centerId - ID of diving center
 * @param {string} username - Username of target user
 * @returns {Promise<Object>} Added manager details
 */
export const addCenterManager = async (centerId, username) => {
  const response = await api.post(`/api/v1/diving-centers/${centerId}/managers`, { username });
  return response.data;
};

/**
 * Remove a manager association from a diving center.
 * @param {number} centerId - ID of diving center
 * @param {number} userId - ID of user manager to remove
 * @returns {Promise<Object>} Success status
 */
export const removeCenterManager = async (centerId, userId) => {
  const response = await api.delete(`/api/v1/diving-centers/${centerId}/managers/${userId}`);
  return response.data;
};
```

- [ ] **Step 2: Verify linting**
  Run: `make lint-frontend`
  Expected: PASS

- [ ] **Step 3: Commit**
  Stage the modified frontend services.

---

### Task 5: Frontend UI Management Tab Integration

**Files:**
- Modify: `frontend/src/pages/DivingCenterDetail.jsx`

- [ ] **Step 1: Build the Team / Managers sub-section inside the Management Tab**
  Introduce a list of managers, an add manager form, and delete/trash triggers. Only visible to the approved owner of the center or admin/moderator roles.

Add state hooks inside the `DivingCenterDetail` component:
```javascript
  const [managerUsername, setManagerUsername] = useState('');
  
  // Queries & Mutations for Managers
  const { data: managers = [], refetch: refetchManagers } = useQuery(
    ['diving-center-managers', id],
    () => getCenterManagers(id),
    {
      enabled: !!id && shouldShowManage, // Only load if permitted
    }
  );

  const addManagerMutation = useMutation(
    username => addCenterManager(id, username),
    {
      onSuccess: () => {
        toast.success('Manager added successfully!');
        setManagerUsername('');
        refetchManagers();
      },
      onError: error => {
        toast.error(getErrorMessage(error) || 'Failed to add manager');
      }
    }
  );

  const removeManagerMutation = useMutation(
    userId => removeCenterManager(id, userId),
    {
      onSuccess: () => {
        toast.success('Manager removed successfully!');
        refetchManagers();
      },
      onError: error => {
        toast.error(getErrorMessage(error) || 'Failed to remove manager');
      }
    }
  );
```

Render a beautiful, mobile-friendly managers list strictly inside the `activeTab === 'manage'` render section in `DivingCenterDetail.jsx`. Include an input field with type `text`, a button to submit, and a table/list with standard responsive styling using wrapping (`flex-wrap`) and Lucide Icons (`Trash2`, `UserPlus`, `Users`):

```jsx
              {/* Only show manager admin section to owners or admins */}
              {isOwner || isAdmin || isModerator ? (
                <div className='bg-white p-6 rounded-2xl border border-gray-100 shadow-sm mt-8'>
                  <h3 className='text-lg font-bold text-gray-900 mb-4 flex items-center gap-2'>
                    <Users className='h-5 w-5 text-blue-600' />
                    <span>Team Management</span>
                  </h3>
                  <p className='text-sm text-gray-500 mb-6 leading-relaxed'>
                    As the owner, you can authorize other registered users to help manage this diving center profile. 
                    Authorized managers can create and edit dive trips, reply to messages, and update announcement broadcasts.
                  </p>

                  {/* Add Manager Form */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!managerUsername.trim()) return;
                      addManagerMutation.mutate(managerUsername.trim());
                    }}
                    className='flex flex-wrap sm:flex-nowrap gap-3 mb-6'
                  >
                    <input
                      type='text'
                      placeholder='Enter username of the user to add as manager...'
                      value={managerUsername}
                      onChange={(e) => setManagerUsername(e.target.value)}
                      className='w-full px-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20'
                    />
                    <button
                      type='submit'
                      disabled={addManagerMutation.isLoading}
                      className='inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-all shadow-sm shrink-0'
                    >
                      <UserPlus className='h-4 w-4' />
                      <span>{addManagerMutation.isLoading ? 'Adding...' : 'Add Manager'}</span>
                    </button>
                  </form>

                  {/* Managers List */}
                  {managers.length === 0 ? (
                    <div className='text-center py-6 border border-dashed border-gray-200 rounded-xl bg-gray-50/50'>
                      <p className='text-sm text-gray-400 font-medium'>No authorized managers added yet.</p>
                    </div>
                  ) : (
                    <div className='divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden'>
                      {managers.map(manager => (
                        <div key={manager.user_id} className='flex items-center justify-between p-4 bg-white hover:bg-gray-50/50 transition-colors'>
                          <div className='flex items-center gap-3'>
                            <Avatar src={manager.avatar_url} alt={manager.username} size='md' />
                            <div>
                              <p className='text-sm font-bold text-gray-900'>{manager.username}</p>
                              {manager.full_name && <p className='text-xs text-gray-500'>{manager.full_name}</p>}
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to revoke manager access for ${manager.username}?`)) {
                                removeManagerMutation.mutate(manager.user_id);
                              }
                            }}
                            className='p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors'
                            title='Revoke access'
                          >
                            <Trash2 className='h-4 w-4' />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
```

- [ ] **Step 2: Verify linting & browser rendering**
  Run: `make lint-frontend`
  Expected: PASS

- [ ] **Step 3: Commit**
  Stage `frontend/src/pages/DivingCenterDetail.jsx`.
