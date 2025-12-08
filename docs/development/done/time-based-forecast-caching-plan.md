# Time-Based Forecast Caching Implementation Plan

## Overview

Implement intelligent time-based caching for weather forecasts based on forecast reliability. Near-term forecasts (0-6 hours) are more reliable and can be cached longer, while far-term forecasts (24+ hours) are less reliable and should be refreshed more frequently.

**Related Analysis**:
- Cache size requirements: See `docs/development/cache-size-requirement-analysis.md`
- Cache TTL strategy: See `docs/development/cache-ttl-strategy-analysis.md`
- Cache size details: See `docs/development/cache-size-analysis.md`

## Current State

- **Fixed TTL**: All forecasts cached for 15 minutes regardless of forecast distance
- **In-memory cache**: Dictionary with `{"data": {...}, "timestamp": datetime.now()}` - cleaned up by Python `_cleanup_cache()` function
  - **Cache size**: `_max_cache_size = 500` entries (~175 KB memory)
  - **Issue**: Insufficient for zoom 12-13 usage patterns (single viewport ~480 entries, typical session ~1100-1600 entries)
- **Database cache**: `WindDataCache` model with `expires_at = created_at + 15 minutes` - cleaned up by MySQL event `cleanup_expired_wind_cache` (runs every 15 minutes)
- **Cache validation**: Simple age check against fixed `_cache_ttl_seconds` (15 minutes)
- **MySQL event**: Already exists and handles database cache cleanup automatically (no Python code needed for DB cleanup)

## Proposed Caching Strategy

| Forecast Distance | Cache Duration | Rationale |
|-------------------|----------------|-----------|
| 0-6 hours from now | Cache until that time (dynamic) | Near-term forecasts are most reliable, cache until forecast time |
| 6-12 hours from now | Cache for 3 hours (fixed) | Medium-term forecasts, moderate reliability |
| 12-24 hours from now | Cache for 2 hours (fixed) | Longer-term forecasts, less reliable |
| 24+ hours from now | Cache for 1 hour (fixed) | Far-term forecasts, least reliable, refresh frequently |
| Current time (None) | Cache for 1 hour (fixed) | Current conditions can change quickly |

## Cache Cleanup Architecture

The system uses a **two-tier cleanup approach**:

1. **In-Memory Cache Cleanup** (Python):
   - Handled by `_cleanup_cache()` function in `open_meteo_service.py`
   - Runs automatically when cache entries are created/accessed
   - Removes expired entries based on dynamic TTL validation
   - Limits cache size using LRU (Least Recently Used) eviction

2. **Database Cache Cleanup** (MySQL Event):
   - Handled by MySQL event `cleanup_expired_wind_cache`
   - Runs automatically every 15 minutes
   - Deletes entries where `expires_at < UTC_TIMESTAMP()`
   - Also considers `last_accessed_at` to preserve frequently used entries
   - **No Python code needed** - fully automated by MySQL
   - Event defined in migration `0044_add_last_accessed_at_to_wind_cache.py`

**For this implementation**: Only the Python in-memory cache cleanup needs updates. The MySQL event will automatically work with the new dynamic `expires_at` values without any changes.

## Implementation Plan

### Phase 1: Core TTL Calculation Function

**File**: `backend/app/services/open_meteo_service.py`

**Task**: Create `_calculate_cache_ttl()` function

```python
def _calculate_cache_ttl(target_datetime: Optional[datetime], now: datetime) -> timedelta:
    """
    Calculate cache TTL based on forecast distance from current time.
    
    Args:
        target_datetime: Forecast datetime (None for current time)
        now: Current datetime
    
    Returns:
        timedelta representing cache TTL
    """
    # Current time requests: use shortest cache (1 hour)
    if target_datetime is None:
        return timedelta(hours=1)
    
    # Past forecasts: use shortest cache (shouldn't happen, but handle gracefully)
    if target_datetime < now:
        return timedelta(hours=1)
    
    # Calculate hours until forecast
    time_until_forecast = target_datetime - now
    hours_until = time_until_forecast.total_seconds() / 3600
    
    # Apply caching rules
    if hours_until <= 6:
        # 0-6 hours: cache until forecast time (dynamic)
        return time_until_forecast
    elif hours_until <= 12:
        # 6-12 hours: cache for 3 hours
        return timedelta(hours=3)
    elif hours_until <= 24:
        # 12-24 hours: cache for 2 hours
        return timedelta(hours=2)
    else:
        # 24+ hours: cache for 1 hour
        return timedelta(hours=1)
```

**Validation**:
- Test with `target_datetime` at 2hrs, 5hrs, 6hrs, 7hrs, 10hrs, 12hrs, 15hrs, 24hrs, 36hrs from now
- Test with `target_datetime = None` (current time)
- Test with `target_datetime` in the past

### Phase 2: Update In-Memory Cache Structure

**File**: `backend/app/services/open_meteo_service.py`

**Changes**:

1. **Increase cache size** to accommodate zoom 12-13 usage patterns:
   ```python
   # Old:
   _max_cache_size = 500  # Maximum number of cache entries
   
   # New:
   _max_cache_size = 2500  # Increased to accommodate zoom 12-13 usage patterns
   # Single viewport at zoom 13: ~480 entries
   # Typical session (panning + time exploration): ~1100-1600 entries
   # Buffer: ~500-1000 entries
   # Memory cost: ~875 KB (negligible)
   ```
   
   **Rationale**: 
   - Zoom 12-13 viewports create ~300-500 cache entries per viewport
   - User sessions with panning and time slider exploration create ~1100-1600 entries
   - Current 500-entry limit causes high cache churn and performance degradation
   - Increasing to 2500 entries provides comfortable buffer with minimal memory cost

2. **Update cache entry structure** to include `target_datetime`:
   ```python
   # Old:
   _wind_cache[cache_key] = {
       "data": wind_data,
       "timestamp": datetime.now()
   }
   
   # New:
   _wind_cache[cache_key] = {
       "data": wind_data,
       "timestamp": datetime.now(),
       "target_datetime": target_datetime  # Store for TTL calculation
   }
   ```

2. **Update `_is_cache_valid()`** to use dynamic TTL:
   ```python
   def _is_cache_valid(cache_entry: Dict, target_datetime: Optional[datetime] = None) -> bool:
       """Check if a cache entry is still valid (not expired)."""
       if 'timestamp' not in cache_entry:
           return False
       
       # Get target_datetime from cache entry or parameter
       entry_target_datetime = cache_entry.get('target_datetime')
       if entry_target_datetime is None:
           entry_target_datetime = target_datetime
       
       # Calculate dynamic TTL based on target_datetime
       now = datetime.now()
       ttl = _calculate_cache_ttl(entry_target_datetime, now)
       
       # Check if cache age is less than calculated TTL
       age = now - cache_entry['timestamp']
       return age < ttl
   ```

3. **Update all cache storage locations** to include `target_datetime`:
   - Line ~488: In-memory cache storage for forecast hours
   - Line ~402: In-memory cache storage from database cache
   - Line ~528: In-memory cache storage for current data

4. **Update cache size constant**:
   - Line ~31: Update `_max_cache_size` from 500 to 2500
   - Update comment to explain rationale

5. **Update `_cleanup_cache()`** to use new validation:
   ```python
   def _cleanup_cache():
       """Remove expired entries and limit cache size."""
       global _wind_cache
       
       # Remove expired entries using dynamic TTL
       current_time = datetime.now()
       expired_keys = [
           key for key, entry in _wind_cache.items()
           if not _is_cache_valid(entry)
       ]
       for key in expired_keys:
           del _wind_cache[key]
       
       # ... rest of cleanup logic unchanged
   ```

6. **Update cache lookup calls** to pass `target_datetime`:
   - Line ~343: `_is_cache_valid(_wind_cache[cache_key])` → `_is_cache_valid(_wind_cache[cache_key], target_datetime)`
   - Line ~369: Similar update
   - Line ~375: Similar update

**Backward Compatibility**: Handle old cache entries without `target_datetime` by falling back to fixed 15-minute TTL (or extract from cache key if possible).

**Cache Size Impact**:
- **Memory increase**: From ~175 KB to ~875 KB (negligible)
- **Performance improvement**: Reduces cache churn, improves hit rate
- **User experience**: Faster map updates when panning/sliding

### Phase 3: Update Database Cache Expiration

**File**: `backend/app/services/open_meteo_service.py`

**Changes**:

1. **Update `_store_in_database_cache()`** to calculate `expires_at` using dynamic TTL:
   ```python
   def _store_in_database_cache(...):
       # ... existing code ...
       
       # Calculate expiration time using dynamic TTL
       now_utc = datetime.utcnow()
       ttl = _calculate_cache_ttl(target_datetime, now_utc)
       expires_at = now_utc + ttl
       
       # ... rest of function unchanged ...
   ```

2. **Update all calls to `_store_in_database_cache()`**:
   - Line ~517: Store individual forecast hours
   - Line ~535: Store current data

**Important Notes**:

- **Database cache queries** already check `expires_at > datetime.utcnow()`, so no changes needed to read logic.
- **MySQL event cleanup**: Database cache cleanup is already handled by MySQL event `cleanup_expired_wind_cache` (runs every 15 minutes). The event automatically deletes entries where `expires_at < UTC_TIMESTAMP()`, so it will work correctly with the new dynamic `expires_at` values without any changes needed. The event is defined in migration `0044_add_last_accessed_at_to_wind_cache.py`.
- **No Python cleanup needed for database**: Only in-memory cache needs Python-based cleanup. Database cache cleanup is handled entirely by MySQL events.

### Phase 4: Testing & Validation

**Test Cases**:

1. **Forecast at 2 hours from now**:
   - Expected: Cache TTL = 2 hours
   - Verify: Cache expires exactly 2 hours after creation

2. **Forecast at 5 hours from now**:
   - Expected: Cache TTL = 5 hours
   - Verify: Cache expires exactly 5 hours after creation

3. **Forecast at 6 hours from now**:
   - Expected: Cache TTL = 6 hours (boundary case)
   - Verify: Cache expires exactly 6 hours after creation

4. **Forecast at 7 hours from now**:
   - Expected: Cache TTL = 3 hours (fixed)
   - Verify: Cache expires 3 hours after creation (not 7 hours)

5. **Forecast at 10 hours from now**:
   - Expected: Cache TTL = 3 hours
   - Verify: Cache expires 3 hours after creation

6. **Forecast at 12 hours from now**:
   - Expected: Cache TTL = 3 hours (boundary case, still in 6-12hr range)
   - Verify: Cache expires 3 hours after creation

7. **Forecast at 15 hours from now**:
   - Expected: Cache TTL = 2 hours
   - Verify: Cache expires 2 hours after creation

8. **Forecast at 24 hours from now**:
   - Expected: Cache TTL = 2 hours (boundary case, still in 12-24hr range)
   - Verify: Cache expires 2 hours after creation

9. **Forecast at 36 hours from now**:
   - Expected: Cache TTL = 1 hour
   - Verify: Cache expires 1 hour after creation

10. **Current time request** (`target_datetime = None`):
    - Expected: Cache TTL = 1 hour
    - Verify: Cache expires 1 hour after creation

11. **Past forecast** (`target_datetime` in the past):
    - Expected: Cache TTL = 1 hour
    - Verify: Cache expires 1 hour after creation

**Validation Methods**:

1. **Unit tests**: Create test file `backend/tests/test_cache_ttl_calculation.py`
   - Test `_calculate_cache_ttl()` with all boundary cases
   - Test `_is_cache_valid()` with different cache ages and forecast distances

2. **Integration tests**: Update `backend/tests/test_open_meteo_service.py`
   - Test cache expiration times match expected TTLs
   - Test database cache `expires_at` values are correct
   - Test in-memory cache validation with dynamic TTL

3. **Manual testing**:
   - Fetch forecasts at different time distances
   - Check database `expires_at` values match expected TTLs
   - Verify cache hits/misses occur at expected times

## Files to Modify

1. **`backend/app/services/open_meteo_service.py`**:
   - Increase `_max_cache_size` from 500 to 2500
   - Add `_calculate_cache_ttl()` function
   - Update `_is_cache_valid()` function
   - Update `_cleanup_cache()` function
   - Update `_store_in_database_cache()` function
   - Update all cache entry creation to include `target_datetime`
   - Update all cache validation calls

2. **`backend/tests/test_open_meteo_service.py`** (if exists):
   - Add tests for `_calculate_cache_ttl()`
   - Add tests for dynamic cache validation
   - Update existing tests to account for new cache structure

3. **`backend/tests/test_cache_ttl_calculation.py`** (new file):
   - Comprehensive unit tests for TTL calculation
   - Boundary case tests
   - Edge case tests

## Migration Considerations

- **Existing cache entries**: Old entries without `target_datetime` will fall back to fixed 15-minute TTL (or be cleaned up naturally)
- **Database cache**: Existing entries will expire based on their current `expires_at` values (no migration needed)
- **MySQL event**: No changes needed - the existing `cleanup_expired_wind_cache` event will automatically work with new dynamic `expires_at` values
- **No breaking changes**: Changes are backward compatible

## Benefits

1. **Reduced API calls**: Near-term forecasts cached longer, reducing unnecessary API requests
2. **Better data freshness**: Far-term forecasts refreshed more frequently, ensuring users see updated predictions
3. **Improved performance**: Fewer API calls = faster response times and lower API usage
4. **Meteorologically sound**: Aligns with forecast reliability characteristics
5. **Better cache utilization**: Increased cache size (500 → 2500) reduces cache churn for zoom 12-13 usage patterns
6. **Improved user experience**: Larger cache reduces cache misses during panning and time slider exploration

## Risks & Mitigation

1. **Risk**: Cache entries without `target_datetime` (old entries)
   - **Mitigation**: Fallback to fixed 15-minute TTL, entries will naturally expire

2. **Risk**: Timezone issues when calculating TTL
   - **Mitigation**: Use consistent timezone (UTC) for all calculations

3. **Risk**: Boundary cases (exactly 6hrs, 12hrs, 24hrs)
   - **Mitigation**: Use `<=` comparisons to ensure correct bucket assignment

4. **Risk**: Performance impact of TTL calculation
   - **Mitigation**: TTL calculation is O(1) and only done on cache write/validation

5. **Risk**: Increased memory usage from larger cache
   - **Mitigation**: Memory increase is minimal (~700 KB), well within acceptable limits
   - **Benefit**: Significantly improved cache hit rate and user experience

## Success Criteria

- [ ] Cache size increased from 500 to 2500 entries
- [ ] `_calculate_cache_ttl()` correctly calculates TTL for all forecast distances

- [ ] `_calculate_cache_ttl()` correctly calculates TTL for all forecast distances
- [ ] In-memory cache entries include `target_datetime`
- [ ] `_is_cache_valid()` uses dynamic TTL based on `target_datetime`
- [ ] Database cache `expires_at` values match calculated TTLs
- [ ] All tests pass
- [ ] Cache expiration times match expected TTLs in production
- [ ] No performance regression

## Estimated Effort

- **Phase 1**: 1-2 hours (TTL calculation function + tests)
- **Phase 2**: 2-3 hours (In-memory cache updates + cache size increase)
- **Phase 3**: 1 hour (Database cache updates)
- **Phase 4**: 2-3 hours (Testing & validation)
- **Total**: 6-9 hours

**Note**: Cache size increase is a simple one-line change with significant performance benefits. No additional testing required beyond existing cache validation tests.
