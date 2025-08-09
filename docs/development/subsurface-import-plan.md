# Subsurface Dive Import Plan

## Overview

This document outlines the plan to import dives from Subsurface into the Divemap system. Subsurface is an open-source dive logging application that stores dive data in a structured format within git repositories.

## Subsurface Data Structure

### Repository Structure
```
01-Divesites/           # Contains dive site files
YYYY/MM/DD-Day-HH=mm=SS/  # Date-based dive folders
  ├── Dive-Number      # General dive information
  └── Divecomputer    # Dive computer data (ignored for now)
```

### Dive File Format Example
```
duration 62:10 min
rating 4
visibility 4
tags "Canyon", "wall"
divesiteid cdef707b
buddy "jbin"
suit "Wet Aqualung"
cylinder vol=14.0l workpressure=220.0bar description="D7 220 bar" start=200.0bar end=60.0bar depth=66.019m
weightsystem weight=4.2kg description="weight"
---
```

## Data Mapping Requirements

### Core Field Mappings

| Subsurface Field | Divemap Field | Conversion Required |
|------------------|---------------|-------------------|
| `duration` | `duration` | Convert "62:10 min" to minutes (372) |
| `rating` | `user_rating` | Convert 1-5 scale to 1-10 scale (×2) |
| `visibility` | `visibility_rating` | Convert 1-5 scale to 1-10 scale (×2) |
| `tags` | `tags` | Parse comma-separated tags |
| `divesiteid` | `import_site_id` | Match to imported dive site by name |
| `buddy` | `dive_information` | Add as "Dive Buddy: jbin" |
| `suit` | `suit_type` | Map to enum: wet_suit, dry_suit, shortie |
| `cylinder` | `gas_bottles_used` | Parse volume, pressure, description |
| `weightsystem` | `dive_information` | Add as "Weights Used: 4.2kg" |

### Advanced Field Parsing

#### Cylinder Information
- Parse `vol=14.0l` → Volume
- Parse `workpressure=220.0bar` → Working pressure
- Parse `start=200.0bar end=60.0bar` → Start/End pressure
- Parse `description="D7 220 bar"` → Description
- Parse `o2=31.0%` → Oxygen percentage (EANx)
- **Note**: `depth=66.019m` is cylinder max depth, not dive depth (handled by Divecomputer files)

#### Suit Type Mapping
- "Wetsuit" → `wet_suit`
- "Wet suit" → `wet_suit`
- "Wet Aqualung" → `wet_suit`
- "Dry Suit" → `dry_suit`
- "Shortie" → `shortie`
- Default to `wet_suit` if unknown

## Implementation Phases

### Phase 1: Database Enhancements

#### 1.1 Add Missing Fields to Dive Model
```python
# Add to Dive model in backend/app/models.py
class Dive(Base):
    # ... existing fields ...

    # New fields for Subsurface import
    buddy = Column(String(255))  # Dive buddy name
    cylinder_volume = Column(DECIMAL(5, 2))  # Cylinder volume in liters
    cylinder_work_pressure = Column(DECIMAL(6, 2))  # Working pressure in bar
    cylinder_start_pressure = Column(DECIMAL(6, 2))  # Start pressure in bar
    cylinder_end_pressure = Column(DECIMAL(6, 2))  # End pressure in bar
    cylinder_description = Column(String(255))  # Cylinder description
    weights_used = Column(DECIMAL(5, 2))  # Weights in kg
    weights_description = Column(String(255))  # Weight description

    # Import metadata
    imported_from = Column(String(50), default="manual")  # "subsurface", "manual"
    import_dive_id = Column(String(100))  # Original dive ID from import source
    import_site_id = Column(String(100))  # Original site ID from import source
```

#### 1.2 Create Database Migration
```bash
cd backend
source divemap_venv/bin/activate
export PYTHONPATH="/home/kargig/src/divemap/backend/divemap_venv/lib/python3.11/site-packages:$PYTHONPATH"
python create_migration.py "Add Subsurface import fields to dives table"
```

### Phase 2: Backend API Enhancements

#### 2.1 Update Schemas
```python
# Update backend/app/schemas.py
class DiveBase(BaseModel):
    # ... existing fields ...

    # New Subsurface fields
    buddy: Optional[str] = Field(None, max_length=255)
    cylinder_volume: Optional[float] = Field(None, ge=0, le=100)
    cylinder_work_pressure: Optional[float] = Field(None, ge=0, le=500)
    cylinder_start_pressure: Optional[float] = Field(None, ge=0, le=500)
    cylinder_end_pressure: Optional[float] = Field(None, ge=0, le=500)
    cylinder_description: Optional[str] = Field(None, max_length=255)
    weights_used: Optional[float] = Field(None, ge=0, le=50)
    weights_description: Optional[str] = Field(None, max_length=255)

    # Import metadata
    imported_from: Optional[str] = Field(None, pattern=r"^(subsurface|manual)$")
    import_dive_id: Optional[str] = Field(None, max_length=100)
    import_site_id: Optional[str] = Field(None, max_length=100)
```

#### 2.2 Add Subsurface Import Endpoint
```python
# Add to backend/app/routers/dives.py
@router.post("/import-subsurface", response_model=List[DiveResponse])
async def import_subsurface_dives(
    dives_data: List[SubsurfaceDiveData],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Import dives from Subsurface format"""
    imported_dives = []

    for dive_data in dives_data:
        # Process each dive
        dive = process_subsurface_dive(dive_data, current_user, db)
        imported_dives.append(dive)

    return imported_dives
```

### Phase 3: Enhanced Import Script

#### 3.1 Create Subsurface Dive Parser
```python
# utils/subsurface_dive_parser.py
class SubsurfaceDiveParser:
    def __init__(self, backend_url: str, auth_token: str):
        self.backend_url = backend_url
        self.auth_token = auth_token
        self.session = requests.Session()
        self.session.headers.update({"Authorization": f"Bearer {auth_token}"})

    def parse_duration(self, duration_str: str) -> int:
        """Convert "62:10 min" to minutes"""
        # Implementation here

    def parse_rating(self, rating: int) -> int:
        """Convert 1-5 scale to 1-10 scale"""
        return rating * 2

    def parse_cylinder(self, cylinder_str: str) -> dict:
        """Parse cylinder information"""
        # Implementation here

    def parse_suit_type(self, suit_str: str) -> str:
        """Map suit type to enum"""
        # Implementation here

    def find_dive_site_by_subsurface_id(self, subsurface_id: str) -> Optional[int]:
        """Find dive site by Subsurface ID"""
        # Implementation here
```

#### 3.2 Create Main Import Script
```python
# utils/import_subsurface_dives.py
class SubsurfaceDiveImporter:
    def __init__(self, force: bool = False, dry_run: bool = False):
        self.force = force
        self.dry_run = dry_run
        self.parser = SubsurfaceDiveParser(BACKEND_URL, self.auth_token)
        self.stats = {
            'processed': 0,
            'created': 0,
            'skipped': 0,
            'errors': 0
        }

    def scan_dive_directories(self, base_path: str) -> List[Path]:
        """Scan for dive directories in YYYY/MM/DD-Day-HH=mm=SS format"""
        # Implementation here

    def parse_dive_file(self, dive_file: Path) -> Optional[dict]:
        """Parse a single dive file"""
        # Implementation here

    def import_dive(self, dive_data: dict) -> bool:
        """Import a single dive via API"""
        # Implementation here

    def run(self, subsurface_repo_path: str):
        """Main import process"""
        # Implementation here
```

### Phase 4: Dive Site Matching

#### 4.1 Enhance Dive Site Matching
```python
# Extend existing import_subsurface_divesite.py
class DiveSiteMatcher:
    def __init__(self, db_session):
        self.db_session = db_session
        self.site_cache = {}  # Cache dive sites by name

    def find_site_by_import_id(self, import_id: str) -> Optional[DiveSite]:
        """Find dive site by import ID"""
        # Implementation here

    def find_site_by_name(self, name: str) -> Optional[DiveSite]:
        """Find dive site by name with fuzzy matching"""
        # Implementation here

    def create_site_mapping(self, import_id: str, dive_site_id: int):
        """Create mapping between import ID and Divemap ID"""
        # Implementation here
```

### Phase 5: Tag Management

#### 5.1 Tag Processing
```python
class TagProcessor:
    def __init__(self, db_session):
        self.db_session = db_session

    def process_tags(self, tag_string: str) -> List[int]:
        """Process comma-separated tags and return tag IDs"""
        # Implementation here

    def create_tag_if_missing(self, tag_name: str) -> int:
        """Create tag if it doesn't exist"""
        # Implementation here
```

## Implementation Steps

### Step 1: Database Migration
1. Update Dive model with new fields
2. Create and run Alembic migration
3. Test migration on development database

### Step 2: Backend Updates
1. Update schemas with new fields
2. Add Subsurface import endpoint
3. Update dive creation/update logic
4. Add validation for new fields

### Step 3: Import Script Development
1. Create SubsurfaceDiveParser class
2. Implement duration parsing
3. Implement cylinder information parsing
4. Implement suit type mapping
5. Implement rating conversion

### Step 4: Dive Site Integration
1. Enhance dive site matching logic
2. Create site ID mapping system
3. Integrate with existing dive site import

### Step 5: Testing and Validation
1. Test with sample Subsurface data
2. Validate all field mappings
3. Test error handling
4. Performance testing with large datasets

## Error Handling

### Common Issues
- Missing dive site references
- Invalid date/time formats
- Unknown suit types
- Missing required fields
- Duplicate dive imports

### Error Recovery
- Skip invalid dives and continue
- Log detailed error information
- Provide summary of failed imports
- Allow partial imports

## Configuration

### Environment Variables
```bash
# Add to .env
SUBSURFACE_IMPORT_ENABLED=true
SUBSURFACE_DEFAULT_USER_ID=1
SUBSURFACE_IMPORT_BATCH_SIZE=100
```

### Import Options
```bash
# Command line options
python import_subsurface_dives.py [options]
  --repo-path PATH     # Path to Subsurface repository
  --user-id ID         # User ID for imported dives
  --dry-run           # Show what would be imported
  --force             # Skip confirmations
  --skip-existing     # Skip dives that already exist
  --batch-size N      # Number of dives to process per batch
```

## Future Enhancements

### Phase 6: Advanced Features
1. **Dive Computer Data Import**: Parse Divecomputer files for detailed dive profiles
2. **Photo Integration**: Import photos linked to dives
3. **Bulk Operations**: Support for large repository imports
4. **Incremental Updates**: Only import new/modified dives
5. **Export Back to Subsurface**: Two-way synchronization

### Phase 7: User Interface
1. **Web Import Interface**: Upload Subsurface repository via web UI
2. **Progress Tracking**: Real-time import progress
3. **Conflict Resolution**: Web-based conflict resolution interface
4. **Import History**: Track and manage import history

## Testing Strategy

### Unit Tests
- Test duration parsing
- Test rating conversion
- Test cylinder parsing
- Test suit type mapping
- Test tag processing

### Integration Tests
- Test complete import workflow
- Test error handling
- Test dive site matching
- Test API integration

### Manual Testing
- Test with real Subsurface data
- Validate all field mappings
- Test with various data formats
- Performance testing

## Documentation Updates

### API Documentation
- Document new dive fields
- Document Subsurface import endpoint
- Update API examples

### User Documentation
- Create import guide
- Document data mapping
- Troubleshooting guide

## Security Considerations

### Data Validation
- Validate all imported data
- Sanitize user inputs
- Prevent SQL injection
- Rate limiting for imports

### Access Control
- Require authentication for imports
- Validate user permissions
- Audit import activities

## Performance Considerations

### Batch Processing
- Process dives in batches
- Use database transactions
- Optimize database queries
- Memory management for large imports

### Caching
- Cache dive site lookups
- Cache tag lookups
- Cache user information

## Monitoring and Logging

### Import Logging
- Log all import activities
- Track success/failure rates
- Monitor performance metrics
- Error tracking and reporting

### Metrics
- Import success rate
- Processing time per dive
- Memory usage
- Database performance

## Rollback Plan

### Database Rollback
- Keep backup before migration
- Test migration rollback
- Document rollback procedures

### Code Rollback
- Version control for all changes
- Feature flags for new functionality
- Gradual rollout strategy

## Success Criteria

### Phase 1 Success
- [ ] Database migration completed
- [ ] New fields added to Dive model
- [ ] Backend API updated
- [ ] Basic import script functional

### Phase 2 Success
- [ ] Complete import workflow working
- [ ] All field mappings implemented
- [ ] Error handling robust
- [ ] Performance acceptable

### Phase 3 Success
- [ ] User interface for imports
- [ ] Advanced features implemented
- [ ] Comprehensive testing completed
- [ ] Documentation complete

## Timeline Estimate

- **Phase 1**: 1-2 weeks (Database and basic backend)
- **Phase 2**: 2-3 weeks (Import script and core functionality)
- **Phase 3**: 1-2 weeks (Testing and refinement)
- **Phase 4**: 1 week (Documentation and deployment)

**Total Estimated Time**: 5-8 weeks

## Dependencies

### Technical Dependencies
- Alembic for database migrations
- Requests library for API calls
- Pydantic for data validation
- SQLAlchemy for database operations

### External Dependencies
- Subsurface repository access
- Backend API availability
- Database connectivity
- User authentication

## Risk Assessment

### High Risk
- Data corruption during import
- Performance issues with large datasets
- Incompatible data formats

### Medium Risk
- User experience issues
- API rate limiting
- Memory usage with large imports

### Low Risk
- Minor UI issues
- Documentation gaps
- Testing coverage

## Conclusion

This plan provides a comprehensive approach to importing dives from Subsurface into the Divemap system. The phased implementation allows for incremental development and testing, reducing risk and ensuring quality. The modular design enables future enhancements and maintains compatibility with existing systems.

The implementation focuses on data integrity, user experience, and system performance while providing robust error handling and comprehensive testing. The plan includes rollback strategies and monitoring to ensure successful deployment and operation.
