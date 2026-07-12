# SQLAlchemy Eager Loading Golden Rule

To maintain high performance and prevent memory bloat (O(N) issues), always use the correct eager loading strategy based on the relationship type:

1. **Use `joinedload` for Many-to-One or One-to-One relationships.**
   * Example: Fetching the `DivingCenter` that belongs to a `Trip`.
   * Why: It uses a single `LEFT OUTER JOIN`. Since the mapping is 1:1, it doesn't multiply rows, allowing SQL-level `LIMIT` and `OFFSET` to work correctly.

2. **Use `selectinload` for One-to-Many or Many-to-Many collections.**
   * Example: Fetching the multiple `Dives` that belong to a `Trip`.
   * Why: It executes a separate `SELECT ... WHERE ID IN (...)` query for the collection. This prevents the "row multiplication" problem that causes SQLAlchemy to silently drop `LIMIT` clauses and fetch the entire table into Python memory for deduplication.

**Warning:** Combining `joinedload` on a collection with `.limit()` or `.offset()` is a performance anti-pattern that leads to massive memory spikes and slow response times.