# Divemap Backend Serialization & Database Integrity Conventions

## 1. Namespace Conflict: Curated Lists vs. Paginated Search
* **The Rule:** Do NOT use schemas named `DiveSiteList...` for user curated lists or collections.
* **Why:** `DiveSiteListResponse` is already declared and used by the project to format standard paginated search directories (`total`, `page`, `page_size`, etc.).
* **Standard:** All curated list/favorites collections must utilize the `UserDiveSiteList...` schema namespace (e.g., `UserDiveSiteListResponse`, `UserDiveSiteListCreate`).

## 2. Nested DiveSite Tags Serialization (`ResponseValidationError` 500 Error)
* **The Rule:** Any custom router/endpoint returning nested `DiveSite` entries inside other models (such as curated lists, itineraries, or search filters) MUST sanitize the nested tags in-memory before returning the payload.
* **Why:** The base `DiveSiteResponse` schema specifies `tags: List[dict] = []`. However, standard SQLAlchemy relational loading fetches `DiveSite.tags` as SQLAlchemy model objects (`DiveSiteTag`). During serialization, Pydantic V2 fails to parse these model objects as dicts, throwing a `ResponseValidationError` (resulting in a 500 Internal Server Error in production).
* **Workaround Pattern:** Strip or manually serialize the nested tags in-memory before returning:
  ```python
  for item in list_items:
      if item.dive_site:
          item.dive_site.tags = [] # Or serialize them to dicts
  ```

## 3. Read-Only Transaction Boundaries inside GET Endpoints
* **The Rule:** Any initialization helper (like checking or ensuring standard user favorites/wishlists folders exist) called from inside a `GET` request endpoint MUST return immediately if the target data already exists. It must NEVER call `db.commit()` or `db.add()` unless a write actually takes place.
* **Why:** Read-only requests should not trigger transaction writes. Calling `db.commit()` unconditionally inside a read-only endpoint intercepts the caller's thread-session scope, prevents subsequent rollback operations in complex views, and can cause stale data or session corruption.
