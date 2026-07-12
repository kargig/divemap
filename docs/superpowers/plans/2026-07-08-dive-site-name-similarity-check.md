# Dive Site Name Similarity & Distance Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent duplicate dive sites by checking for highly similar names (e.g. Elphinstone vs Elphinstone Reef) within 50km during creation.

**Architecture:** Implement a name similarity helper `is_similar_name` using Python's standard `difflib.SequenceMatcher` and a substring length-based match. In the `create_dive_site` API endpoint, perform a fast dialect-safe query to fetch up to 100 approved, non-deleted dive sites within 50km of the new site coordinates. If any of those sites has a highly similar name to the new site, raise an HTTP `409 Conflict` containing the list of conflicting sites. This ensures automatic backward compatibility with the frontend's duplicate resolution modal and moderation bypass options.

**Tech Stack:** FastAPI, Python, SQLAlchemy, MySQL, difflib, pytest

## Global Constraints
- Always use `./docker-test-github-actions.sh` to run backend tests to protect the local development database from getting wiped
- Never use `git add` or `git commit` commands directly (all commits must be presented as a draft for the user to execute)
- Strictly follow local code patterns and error structures (match existing `nearby_sites` schema in 409 payloads)

---

## File Structure & Touchpoints
- **Modify:** `backend/app/routers/dive_sites.py` — Add `is_similar_name` helper, candidate retrieval logic, and raise 409 if a duplicate name is found within 50km.
- **Modify:** `backend/tests/test_proximity_moderation.py` — Add comprehensive unit and integration tests to verify successful creation vs conflict scenarios.

---

### Task 1: Name Similarity Detection in Backend API

**Files:**
- Modify: `backend/app/routers/dive_sites.py`

**Interfaces:**
- Consumes: `DiveSiteCreate` input schema.
- Produces: Name similarity check raising `HTTPException(409)` with matching sites list under `"nearby_sites"`.

- [ ] **Step 1: Implement `is_similar_name` helper**
Add a helper function to perform case-insensitive name comparison:
1. `difflib.SequenceMatcher` ratio >= 0.70 (handling typos and suffix/prefix variations)
2. Substring match where the shorter name is at least 4 characters long (handling sub-sites or localized prefixes/suffixes like "East", "Reef", "Cave")

Show the exact implementation logic:
```python
def is_similar_name(name1: str, name2: str) -> bool:
    """
    Check if two dive site names are highly similar.
    Matches if:
    1. The SequenceMatcher ratio is >= 0.70 (handling typos and suffix/prefix variations like Elphinstone vs Elphinstone Reef/East)
    2. One is a substring of the other and the shorter name is at least 4 characters long
    """
    import difflib
    n1 = name1.lower().strip()
    n2 = name2.lower().strip()
    if n1 == n2:
        return True

    # Check SequenceMatcher ratio
    ratio = difflib.SequenceMatcher(None, n1, n2).ratio()
    if ratio >= 0.70:
        return True

    # Check substring match for names with meaningful length (>= 4 chars)
    shorter, longer = (n1, n2) if len(n1) < len(n2) else (n2, n1)
    if len(shorter) >= 4 and shorter in longer:
        return True

    return False
```

- [ ] **Step 2: Add candidate query and name comparison inside `create_dive_site`**
Within the `create_dive_site` router function (`@router.post("/")`), insert the check before creating the database entry (just after the 50m exact proximity check):
- Execute a dialect-aware query similar to `check_proximity` but with a `50000` meters (50km) radius and a limit of 100 to find candidate sites.
- Iterate over results and check `is_similar_name(dive_site.name, candidate["name"])`.
- If match is found, raise `HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"message": "A dive site with a similar name already exists nearby (within 50km).", "nearby_sites": similar_sites})`.

Expected Code Block in `create_dive_site`:
```python
    # Check for proximity and name similarity
    if not moderation_needed and dive_site.latitude and dive_site.longitude:
        # 1. Exact geographic proximity check (50m radius)
        nearby_sites = await check_proximity(request, lat=dive_site.latitude, lng=dive_site.longitude, radius_m=50, db=db)
        if nearby_sites:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "message": "Dive site is too close to existing ones.",
                    "nearby_sites": nearby_sites
                }
            )

        # 2. Name similarity check within 50km
        # Query approved, non-deleted sites within 50,000 meters (50km)
        bind = db.get_bind()
        dialect = bind.dialect.name if bind is not None else None

        if dialect == 'mysql':
            fifty_km_query = text("""
                SELECT
                    ds.id, ds.name, ds.description,
                    ds.latitude, ds.longitude,
                    ST_Distance_Sphere(ds.location, ST_SRID(POINT(:lng, :lat), 4326)) AS distance_m
                FROM dive_sites ds
                WHERE ds.location IS NOT NULL
                AND ds.deleted_at IS NULL
                AND ds.status = 'approved'
                AND ST_Distance_Sphere(ds.location, ST_SRID(POINT(:lng, :lat), 4326)) <= 50000
                ORDER BY distance_m ASC
                LIMIT 100
            """)
        else:
            fifty_km_query = text("""
                SELECT
                    ds.id, ds.name, ds.description,
                    ds.latitude, ds.longitude,
                    (6371 * acos(
                        cos(radians(:lat)) * cos(radians(ds.latitude)) *
                        cos(radians(ds.longitude) - radians(:lng)) +
                        sin(radians(:lat)) * sin(radians(ds.latitude))
                    )) * 1000 AS distance_m
                FROM dive_sites ds
                WHERE ds.latitude IS NOT NULL
                AND ds.longitude IS NOT NULL
                AND ds.deleted_at IS NULL
                AND ds.status = 'approved'
                HAVING distance_m <= 50000
                ORDER BY distance_m ASC
                LIMIT 100
            """)

        candidate_results = db.execute(
            fifty_km_query,
            {"lat": dive_site.latitude, "lng": dive_site.longitude}
        ).fetchall()

        similar_sites = []
        for row in candidate_results:
            if is_similar_name(dive_site.name, row.name):
                similar_sites.append({
                    "id": row.id,
                    "name": row.name,
                    "description": row.description,
                    "latitude": float(row.latitude) if row.latitude else None,
                    "longitude": float(row.longitude) if row.longitude else None,
                    "distance_m": round(row.distance_m, 2)
                })

        if similar_sites:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "message": "A dive site with a similar name already exists nearby (within 50km).",
                    "nearby_sites": similar_sites
                }
            )
```

---

### Task 2: Validate Implementation with Tests

**Files:**
- Modify: `backend/tests/test_proximity_moderation.py`

- [ ] **Step 1: Write similar-name-specific test cases**
Add new test methods inside the `TestProximityModeration` class:
1. `test_create_dive_site_similar_name_conflict`:
   - Setup: Create "Elphinstone" at base coordinates.
   - Act: Try to create "Elphinstone East" at coordinates 10km away.
   - Assert: Returns HTTP 409 with similar site in `"nearby_sites"`.
2. `test_create_dive_site_similar_name_far_success`:
   - Setup: Create "Elphinstone" at base coordinates.
   - Act: Try to create "Elphinstone East" at coordinates 100km away.
   - Assert: Returns HTTP 200 OK.
3. `test_create_dive_site_distinct_name_near_success`:
   - Setup: Create "Elphinstone" at base coordinates.
   - Act: Try to create "Dolphin Reef" at coordinates 10km away.
   - Assert: Returns HTTP 200 OK.
4. `test_create_dive_site_similar_name_with_moderation_bypass`:
   - Setup: Create "Elphinstone" at base coordinates.
   - Act: Try to create "Elphinstone East" at coordinates 10km away with `"moderation_needed": True`.
   - Assert: Returns HTTP 200 OK with site status `"pending"`.

Show the exact test implementations to insert:
```python
    def test_create_dive_site_similar_name_conflict(self, client, auth_headers, db_session, test_user):
        """Test that creating a site with a similar name within 50km returns 409 Conflict."""
        # Create base site at self.lat1, self.lng1 (~Athens)
        self._create_spatial_site(db_session, "Elphinstone", self.lat1, self.lng1, test_user.id)

        # Coordinates ~10km away
        lat_10km = self.lat1 + 0.09
        lng_10km = self.lng1 + 0.09

        new_site_data = {
            "name": "Elphinstone East",
            "latitude": lat_10km,
            "longitude": lng_10km,
            "difficulty_code": "OPEN_WATER"
        }

        response = client.post("/api/v1/dive-sites/", json=new_site_data, headers=auth_headers)
        assert response.status_code == status.HTTP_409_CONFLICT
        data = response.json()
        assert "A dive site with a similar name already exists nearby" in data["detail"]["message"]
        assert data["detail"]["nearby_sites"][0]["name"] == "Elphinstone"

    def test_create_dive_site_similar_name_far_success(self, client, auth_headers, db_session, test_user):
        """Test that creating a site with a similar name further than 50km succeeds."""
        self._create_spatial_site(db_session, "Elphinstone", self.lat1, self.lng1, test_user.id)

        # Coordinates ~100km away
        lat_100km = self.lat1 + 0.9
        lng_100km = self.lng1 + 0.9

        new_site_data = {
            "name": "Elphinstone East",
            "latitude": lat_100km,
            "longitude": lng_100km,
            "difficulty_code": "OPEN_WATER"
        }

        response = client.post("/api/v1/dive-sites/", json=new_site_data, headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK

    def test_create_dive_site_distinct_name_near_success(self, client, auth_headers, db_session, test_user):
        """Test that creating a site with a completely distinct name within 50km succeeds."""
        self._create_spatial_site(db_session, "Elphinstone", self.lat1, self.lng1, test_user.id)

        # Coordinates ~10km away
        lat_10km = self.lat1 + 0.09
        lng_10km = self.lng1 + 0.09

        new_site_data = {
            "name": "Dolphin Reef",
            "latitude": lat_10km,
            "longitude": lng_10km,
            "difficulty_code": "OPEN_WATER"
        }

        response = client.post("/api/v1/dive-sites/", json=new_site_data, headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK

    def test_create_dive_site_similar_name_with_moderation_bypass(self, client, auth_headers, db_session, test_user):
        """Test that setting moderation_needed=True bypasses similar name check but sets pending status."""
        self._create_spatial_site(db_session, "Elphinstone", self.lat1, self.lng1, test_user.id)

        # Coordinates ~10km away
        lat_10km = self.lat1 + 0.09
        lng_10km = self.lng1 + 0.09

        new_site_data = {
            "name": "Elphinstone East",
            "latitude": lat_10km,
            "longitude": lng_10km,
            "difficulty_code": "OPEN_WATER",
            "moderation_needed": True
        }

        response = client.post("/api/v1/dive-sites/", json=new_site_data, headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "pending"
```

- [ ] **Step 2: Run backend tests via the isolated script**
Run command:
`cd backend && ./docker-test-github-actions.sh tests/test_proximity_moderation.py`
Verify that:
- Output says: `All tests passed!`
- If any error is present, read `backend/test-failures.txt` to troubleshoot.
