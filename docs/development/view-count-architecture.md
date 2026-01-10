# View Count Architecture & Update Patterns

**Status:** Current Implementation  
**Last Updated:** January 10, 2026

## Overview

This document explains the architectural decisions behind how `view_count` updates are handled in the Divemap application, specifically focusing on the conflict between activity tracking and data integrity timestamps (`updated_at`).

## Current Situation: The "Silent Update" Pattern

### The Problem
We store `view_count` directly on main entity tables (`dive_sites`, `diving_centers`, `dives`, etc.). These tables also have an `updated_at` column configured with MySQL's `ON UPDATE CURRENT_TIMESTAMP` behavior and SQLAlchemy's `onupdate=func.now()`.

Normally, **any** write to a row triggers an update to the timestamp. However, strictly speaking, a "View" event is metadata *about* the usage of the entity, not an edit to the entity's content. Updating `updated_at` on every view creates misleading audit trails (e.g., "Updated 1 second ago" when the description hasn't changed in years).

### The Solution
We utilize a specific SQLAlchemy pattern to perform a "silent update" — incrementing the counter while forcibly preserving the existing timestamp.

```python
# Increment view count without updating updated_at
db.query(Entity).filter(Entity.id == entity_id).update(
    {
        Entity.view_count: Entity.view_count + 1,
        Entity.updated_at: Entity.updated_at  # Explicitly set to self to prevent trigger
    },
    synchronize_session=False
)
db.commit()
```

### Justification
1.  **Pragmatism**: This solves the UX issue immediately without requiring a complex database migration or application refactor.
2.  **Simplicity**: It maintains a simple schema where `view_count` is easily accessible without JOINs.
3.  **Safety**: It overrides the automatic timestamp behavior *only* for this specific action, ensuring that legitimate content edits still update the timestamp automatically.

### Technical Context
- **MySQL**: The `ON UPDATE CURRENT_TIMESTAMP` definition on the column means the database *will* update the time unless the column is explicitly included in the `UPDATE` statement with a value.
- **SQLAlchemy**: Standard ORM updates (`obj.view_count += 1; session.commit()`) trigger `onupdate` event handlers. The `db.query().update()` method bypasses the ORM unit-of-work process, allowing for raw SQL generation that we can control precisely.

---

## Future-Proofing: Scaling & Refactoring

While the current approach is efficient for our current scale, it introduces **row locking** on the main content table. Every reader (viewer) effectively becomes a writer, which can block actual editors under high load.

### Trigger for Refactoring
We should migrate away from this pattern if we observe:
1.  **Database Locking/Contention**: Users editing dive sites experience delays because the row is locked by view increments.
2.  **Deadlocks**: Frequent deadlocks appearing in error logs regarding entity tables.
3.  **High Write IOPS**: Excessive write operations on the main tables affecting read performance.

### Recommended Strategy: Separate Statistics Table

The industry-standard solution for scaling is to separate volatile statistics from stable content.

#### Schema Design
Create a 1-to-1 table for statistics:
```sql
CREATE TABLE dive_site_stats (
    dive_site_id INT PRIMARY KEY,
    view_count INT DEFAULT 0,
    last_viewed_at TIMESTAMP,
    FOREIGN KEY (dive_site_id) REFERENCES dive_sites(id) ON DELETE CASCADE
);
```

#### Benefits
- **Performance**: Updates to `view_count` only lock the stats row, leaving the main content row free for reading/editing.
- **Semantics**: `updated_at` on the main table returns to being a pure "Content Edited" timestamp without workarounds.
- **Caching**: The main `dive_site` object (heavy) can be cached aggressively (e.g., for hours), while the lightweight `view_count` can be fetched or updated in real-time.

### Advanced Strategy: Event Sourcing

If business requirements evolve to need **Unique Views** or **Historical Trends** (e.g., "Views per day"), a counter is insufficient.

**Approach**:
1.  Stop updating a counter in the transactional DB.
2.  Log "View Events" to a time-series database (e.g., ClickHouse, InfluxDB) or an analytics service (Google Analytics, Mixpanel).
3.  Periodically aggregate counts back to the main DB for display, or query the analytics DB directly for dashboards.
