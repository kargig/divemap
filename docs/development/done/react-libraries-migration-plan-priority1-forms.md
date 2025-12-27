# Priority 1: Form Management & Validation - Implementation Plan

## Overview

This document provides a detailed implementation plan for migrating from manual form state management (`useState`) to **React Hook Form + Zod** for form validation and state management.

**Target Library**: React Hook Form + Zod  
**Estimated Duration**: 2-3 weeks  
**Files Affected**: ~15-20 form components  
**Expected Code Reduction**: ~2000-3000 lines

---

## Prerequisites & Setup

### 1. Install Dependencies

```bash
cd frontend
npm install react-hook-form zod @hookform/resolvers
```

**Package Versions** (as of December 2025):
- `react-hook-form`: ^7.49.0+
- `zod`: ^3.22.0+
- `@hookform/resolvers`: ^3.3.0+

### 2. Create Shared Utilities ✅ **COMPLETED**

Created `frontend/src/utils/formHelpers.js` with comprehensive validation schemas and error handling:

**Key Features Implemented:**
- **Email validation**: Required, email format, max 255 characters
- **Password validation**: Stricter rules (8+ chars, uppercase, lowercase, number, special char) matching backend requirements
- **Latitude/Longitude**: Using `z.preprocess` to handle string inputs, validate ranges
- **URL validation**: Custom validation restricting to `http://` and `https://` protocols only
- **Phone validation**: International format validation with automatic `00` to `+` conversion
- **Diving center & dive site schemas**: Reusable schemas for name, description, location fields
- **Trip form schemas (tripSchemas)**: Comprehensive schemas for trip creation/editing including:
  - Trip metadata (date, time, duration, difficulty, price, currency)
  - Group size and booking management
  - Nested dive arrays with tripDiveSchema for individual dives
  - Proper handling of optional fields and null values

**Implementation Notes:**
- Used `z.preprocess` for latitude/longitude to handle string inputs from form fields
- URL validation uses JavaScript's `URL` constructor with protocol restriction
- Phone validation handles whitespace removal and international format conversion
- All optional fields use `.optional().or(z.literal(''))` pattern to allow empty strings
- Trip schemas handle complex nested structures with proper type transformations
- **Error Handling**: Added `getErrorMessage` helper for React Hook Form/Zod validation errors
  - Handles various error formats: string, object with message/msg, arrays, Zod errors
  - Returns `null` for no error (unlike API error handlers which always return strings)
  - Consolidated from multiple form components to single shared utility

### 3. Create Form Component Patterns ✅ **COMPLETED**

Created `frontend/src/components/forms/FormField.js` (reusable form field wrapper):

**Features:**
- Integrates with React Hook Form's `useFormContext`
- Displays validation errors automatically
- Supports custom error messages
- Handles required field indicators
- Consistent styling across all forms

---

## Form Components Inventory

### High Priority (Start Here - Simple Forms)

1. **Login.js** ✅ **COMPLETED**
   - Simple form: username, password
   - Turnstile integration
   - Google Sign-In (keep as-is)
   - **Complexity**: Low
   - **Status**: Migrated successfully

2. **Register.js** ✅ **COMPLETED**
   - Form: username, email, password, confirmPassword
   - Password matching validation using Zod `.refine()`
   - Turnstile integration
   - Google Sign-In (keep as-is)
   - **Complexity**: Low-Medium
   - **Status**: Migrated successfully

### Medium Priority (Moderate Complexity)

3. **CreateDiveSite.js** ✅ **COMPLETED**
   - Form: name, description, coordinates, location, difficulty, etc.
   - Coordinate validation using `z.preprocess` for string inputs
   - Handles optional fields (difficulty_code, max_depth, etc.)
   - **Complexity**: Medium
   - **Status**: Migrated successfully
   - **Notes**: Uses `mode: 'onChange'` for real-time validation feedback

4. **CreateDivingCenter.js**
   - Form: name, description, contact info, location
   - Uses `DivingCenterForm.js` component
   - **Complexity**: Medium
   - **Status**: Uses DivingCenterForm (see below)

5. **DivingCenterForm.js** ✅ **COMPLETED** (reusable component)
   - Form: name, description, email, phone, website, coordinates, location
   - Reverse geocoding integration
   - Supports both controlled and uncontrolled modes
   - **Complexity**: Medium
   - **Status**: Migrated successfully
   - **Notes**: 
     - Fixed validation error persistence issues in controlled mode
     - Uses `reValidateMode: 'onChange'` to ensure errors clear when fields become valid
     - HTML5 validation enabled (`type='email'`, `type='url'`) alongside React Hook Form validation

6. **CreateTrip.js**
   - Form: name, description, dates, dive sites
   - Date validation
   - **Complexity**: Medium
   - **Status**: Uses TripFormModal (see below)

7. **TripFormModal.js** ✅ **COMPLETED**
   - Modal form for trip creation/editing
   - Uses comprehensive tripSchemas with nested dive validation
   - **Complexity**: Medium
   - **Status**: Migrated successfully
   - **Notes**: 
     - Uses `useFieldArray` for managing dive arrays
     - Comprehensive tripSchemas with tripDiveSchema for nested validation
     - Handles trip difficulty codes, pricing, dates, and dive arrays

### High Complexity (Complex Forms - Do Last)

8. **CreateDive.js** ✅ **COMPLETED**
   - Large form: dive site, route, dates, depths, ratings, tags, media
   - Multiple dependent fields
   - Tag management
   - Media uploads
   - **Complexity**: High
   - **Status**: Migrated successfully
   - **Notes**:
     - Uses comprehensive `createDiveSchema` from formHelpers
     - Handles dependent fields (dive site → route clearing) using `watch` and `useEffect`
     - Tags, media, and buddies remain as separate state (not managed by React Hook Form)
     - Searchable dropdowns use `setValue` to update form state
     - Server-side validation errors integrated using `setError` from React Hook Form

9. **EditDive.js** ✅ **COMPLETED**
   - Similar to CreateDive but with pre-populated data
   - **Complexity**: High
   - **Status**: Migrated successfully
   - **Notes**:
     - Uses same `createDiveSchema` from formHelpers as CreateDive
     - Handles pre-populated data using `reset()` when dive data loads
     - Converts backend time format (HH:MM:SS) to form format (HH:MM) on load
     - Converts form time format (HH:MM) to backend format (HH:MM:SS) on submit
     - Tags and buddies handled separately (not in React Hook Form)
     - Backend expects `tags` field (not `tag_ids`) for tag updates

10. **EditDiveSite.js** ✅ **COMPLETED**
    - Large form with many fields
    - Tag management
    - Media management
    - Aliases management
    - Diving center associations
    - **Complexity**: High
    - **Status**: Migrated successfully

11. **EditDivingCenter.js** ✅ **COMPLETED**
    - Similar to CreateDivingCenter but with pre-populated data
    - **Complexity**: Medium-High
    - **Status**: Migrated successfully

### Admin Forms (Lower Priority)

12. **AdminDives.js** (inline edit form) ✅ **COMPLETED**
    - Modal form for editing dives
    - **Complexity**: Medium
    - **Status**: Migrated successfully

13. **Profile.js** ✅ **COMPLETED**
    - User profile editing, Change Password, Certifications
    - **Complexity**: Medium
    - **Status**: Migrated successfully

---

## Migration Strategy

### Phase 1: Foundation (Week 1)

**Goal**: Establish patterns and migrate simple forms

#### Step 1.1: Setup & Utilities (Day 1) ✅ **COMPLETED**
- [x] Install dependencies
- [x] Create `formHelpers.js` with common schemas
- [x] Create `FormField.js` reusable component
- [x] Create example migration in a test branch
- [x] Document patterns and conventions

#### Step 1.2: Migrate Login Form (Day 1-2) ✅ **COMPLETED**
- [x] Create Zod schema for login form
- [x] Replace `useState` with `useForm`
- [x] Replace manual validation with Zod schema
- [x] Update error handling
- [x] Test all scenarios (success, error, Turnstile)
- [x] Verify Google Sign-In still works

**Example Migration Pattern**:

```javascript
// Before (Login.js)
const [formData, setFormData] = useState({ username: '', password: '' });
const handleChange = (e) => {
  setFormData({ ...formData, [e.target.name]: e.target.value });
};
const handleSubmit = async (e) => {
  e.preventDefault();
  // Manual validation
  if (!formData.username || !formData.password) {
    toast.error('Please fill in all fields');
    return;
  }
  // Submit...
};

// After (Login.js)
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

const { register, handleSubmit, formState: { errors } } = useForm({
  resolver: zodResolver(loginSchema),
});

const onSubmit = async (data) => {
  // data is already validated
  // Submit...
};
```

#### Step 1.3: Migrate Register Form (Day 2-3) ✅ **COMPLETED**
- [x] Create Zod schema with password matching
- [x] Replace `useState` with `useForm`
- [x] Replace `validateForm()` with Zod schema
- [x] Update error display
- [x] Test password matching validation
- [x] Verify Turnstile integration

**Zod Schema Example**:

```javascript
const registerSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters long'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});
```

#### Step 1.4: Testing & Documentation (Day 3-4) ✅ **COMPLETED**
- [x] Write tests for migrated forms (Ongoing)
- [x] Update documentation with migration patterns
- [x] Create migration checklist template
- [x] Review and refine patterns

### Phase 2: Medium Complexity Forms (Week 2)

**Goal**: Migrate forms with moderate complexity

#### Step 2.1: CreateDiveSite Form (Day 5-6) ✅ **COMPLETED**
- [x] Create comprehensive Zod schema
- [x] Handle coordinate validation (using `z.preprocess` for string inputs)
- [x] Migrate form state
- [x] Update error handling
- [x] Test all validation scenarios
- **Key Learnings**: 
  - Use `z.preprocess` for fields that accept strings but need numeric validation
  - Handle optional fields with `.optional().or(z.literal(''))` pattern
  - Use `mode: 'onChange'` for better UX with real-time validation

**Coordinate Validation Example** (Updated - using `z.preprocess`):

```javascript
const diveSiteSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  latitude: z.preprocess(
    val => {
      if (val === '' || val === null || val === undefined) return '';
      return String(val);
    },
    z.string()
      .min(1, 'Latitude is required')
      .refine((val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num >= -90 && num <= 90;
      }, 'Latitude must be between -90 and 90')
  ),
  longitude: z.preprocess(
    val => {
      if (val === '' || val === null || val === undefined) return '';
      return String(val);
    },
    z.string()
      .min(1, 'Longitude is required')
      .refine((val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num >= -180 && num <= 180;
      }, 'Longitude must be between -180 and 180')
  ),
  // ... other fields
});
```

#### Step 2.2: DivingCenterForm Component (Day 6-7) ✅ **COMPLETED**
- [x] Create Zod schema
- [x] Handle controlled/uncontrolled mode
- [x] Migrate reverse geocoding integration
- [x] Update form state management
- [x] Test both create and edit modes
- **Key Learnings**:
  - Controlled mode requires careful state synchronization to prevent validation errors from disappearing
  - Use `reValidateMode: 'onChange'` to ensure errors clear when fields become valid
  - Debounce parent state updates (200ms) to prevent feedback loops in controlled mode
  - HTML5 validation can work alongside React Hook Form (remove `noValidate` if desired)
  - URL validation should restrict to `http://` and `https://` protocols only

#### Step 2.3: CreateDivingCenter & CreateTrip (Day 7-8) ✅ **COMPLETED**
- [x] Migrate CreateDivingCenter (uses DivingCenterForm - already completed)
- [x] Migrate TripFormModal form (comprehensive tripSchemas with nested dive validation)
- [x] Handle date validation (trip_date, trip_time with HH:MM format)
- [x] Handle nested dive arrays with useFieldArray
- [x] Test all scenarios
- **Key Learnings**:
  - Trip forms require comprehensive schemas for trip data and nested dive arrays
  - Use `useFieldArray` for managing dynamic dive arrays in trip forms
  - Trip difficulty codes need proper enum handling with null/empty string transforms
  - Trip pricing and currency validation requires proper number handling

### Phase 3: Complex Forms (Week 3)

**Goal**: Migrate large, complex forms

#### Step 3.1: CreateDive Form (Day 9-11) ✅ **COMPLETED**
- [x] Create comprehensive Zod schema (`createDiveSchema` in formHelpers.js)
- [x] Handle dependent fields (dive site → route clearing using `watch` and `useEffect`)
- [x] Migrate tag management (kept as separate state - not managed by React Hook Form)
- [x] Migrate media uploads (kept as separate state - not managed by React Hook Form)
- [x] Update form submission (uses `handleSubmit` with data transformation)
- [x] Extensive testing
- **Key Learnings**:
  - Complex forms benefit from keeping some state separate (tags, media, buddies)
  - Dependent fields can be handled with `watch()` and `useEffect` to clear related fields
  - Searchable dropdowns require `setValue` to update form state programmatically
  - Server-side validation errors should be integrated using `setError` from React Hook Form
  - Data transformations (string to number, empty to null) handled in Zod schema using `transform`

**CreateDive Schema Implementation**:

The `createDiveSchema` was added to `formHelpers.js` with comprehensive validation:

```javascript
export const createDiveSchema = z.object({
  // Required fields
  dive_date: z.string().min(1, 'Dive date is required'),

  // Optional ID fields (transform to number or null)
  dive_site_id: z.union([z.string(), z.number()])
    .optional()
    .nullable()
    .transform(val => {
      if (!val || val === '' || val === null) return null;
      const num = typeof val === 'string' ? parseInt(val, 10) : val;
      return isNaN(num) ? null : num;
    }),

  // Optional number fields with ranges
  duration: z.union([z.string(), z.number()])
    .optional()
    .nullable()
    .refine(val => {
      if (!val || val === '' || val === null) return true;
      const num = typeof val === 'string' ? parseInt(val, 10) : val;
      return !isNaN(num) && num >= 1 && num <= 1440;
    }, { message: 'Duration must be between 1 and 1440 minutes' })
    .transform(val => {
      if (!val || val === '' || val === null) return null;
      return typeof val === 'string' ? parseInt(val, 10) : val;
    }),

  // Enum fields with null handling
  difficulty_code: z.preprocess(
    val => (val === '' || val === null || val === undefined ? null : val),
    z.union([
      z.enum(['OPEN_WATER', 'ADVANCED_OPEN_WATER', 'DEEP_NITROX', 'TECHNICAL_DIVING']),
      z.null(),
    ]).optional()
  ),

  // ... other fields
});
```

**Dependent Fields Handling**:

```javascript
// Use watch() to watch field values
const diveSiteId = watch('dive_site_id');

// Clear route selection when dive site changes
useEffect(() => {
  if (diveSiteId) {
    setValue('selected_route_id', '');
  }
}, [diveSiteId, setValue]);
```

#### Step 3.2: EditDive Form (Day 11-12) ✅ **COMPLETED**
- [x] Similar to CreateDive (uses same `createDiveSchema`)
- [x] Handle pre-populated data with `reset()` when dive data loads
- [x] Test edit scenarios
- **Key Learnings**:
  - Use `reset()` in query's `onSuccess` callback to populate form with existing dive data
  - Convert backend time format (HH:MM:SS) to form format (HH:MM) when loading: `data.dive_time.substring(0, 5)`
  - Convert form time format (HH:MM) to backend format (HH:MM:SS) when submitting: `${data.dive_time}:00`
  - Backend expects `tags` field (not `tag_ids`) for tag updates in both create and update operations
  - Number fields need to be converted to strings for form inputs, then back to numbers/null for submission (handled by Zod schema transforms)
  - Tags and buddies remain as separate state, not managed by React Hook Form

**Implementation Example**:

```javascript
// In query's onSuccess callback
onSuccess: data => {
  reset({
    dive_site_id: data.dive_site_id ? data.dive_site_id.toString() : '',
    dive_time: data.dive_time ? data.dive_time.substring(0, 5) : '',
    max_depth: data.max_depth ? data.max_depth.toString() : '',
    // ... other fields
  });
  
  // Load tags and buddies separately
  if (data.tags && Array.isArray(data.tags)) {
    setSelectedTags(data.tags.map(tag => tag.id));
  }
  if (data.buddies && Array.isArray(data.buddies)) {
    setSelectedBuddies(data.buddies);
  }
}

// In onSubmit
const onSubmit = async data => {
  const diveData = {
    ...data,
    dive_time: data.dive_time && data.dive_time !== '' ? `${data.dive_time}:00` : null,
    tags: selectedTags.length > 0 ? selectedTags : [],
    buddies: selectedBuddies.length > 0 ? selectedBuddies.map(buddy => buddy.id) : [],
  };
  // ... submit
};
```

#### Step 3.3: EditDiveSite Form (Day 12-14) ✅ **COMPLETED**
- [x] Create comprehensive schema (`diveSiteSchema` in formHelpers.js)
- [x] Handle complex nested data (tags, media, aliases)
- [x] Migrate all form sections (Location, Shore Direction, Media, Tags)
- [x] Handle dependent fields (Diving Center search, nearby centers)
- [x] Extensive testing
- **Key Learnings**:
  - Complex forms often require separate state for array fields (tags, media, aliases)
  - `watch()` is essential for real-time form updates (e.g., location changes)
  - Custom API error handling needed for specific endpoints (e.g., shore direction detection)

#### Step 3.4: EditDivingCenter Form (Day 13-14) ✅ **COMPLETED**
- [x] Uses `DivingCenterForm` component (already migrated)
- [x] Handle separate state for "Diving Organizations" and "Gear Rental"
- [x] Integrate with existing API mutations
- **Key Learnings**:
  - Reusing the `DivingCenterForm` component simplified the migration significantly
  - Auxiliary data (organizations, gear) kept as separate state/mutations works well

### Phase 4: Admin & User Forms (Week 3-4)

**Goal**: Migrate remaining admin and profile forms

#### Step 4.1: AdminDives Form (Day 15) ✅ **COMPLETED**
- [x] Migrate Edit Dive modal in Admin panel
- [x] Use `createDiveSchema`
- [x] Handle Admin-specific fields
- **Key Learnings**:
  - Admin forms can reuse the same schemas as user-facing forms

#### Step 4.2: Profile Form (Day 15-16) ✅ **COMPLETED**
- [x] Migrate Profile edit form
- [x] Migrate Change Password form
- [x] Migrate Add/Edit Certification form
- [x] Create specific schemas (`profileSchema`, `certificationSchema`, `changePasswordSchema`)
- [x] Disable username and email editing (frontend UI and backend schema enforcement)
- **Key Learnings**:
  - Multiple small forms on one page can each use their own `useForm` hook independent of each other
  - Critical fields (username, email) should be disabled in UI and protected in backend API schemas

---

## Migration Checklist Template

For each form component:

### Pre-Migration
- [ ] Review current form implementation
- [ ] Identify all form fields and validation rules
- [ ] Identify dependent fields and conditional logic
- [ ] List all error handling scenarios
- [ ] Document any special integrations (Turnstile, Google, etc.)

### Migration Steps
- [ ] Install dependencies (if not already done)
- [ ] Create Zod schema matching current validation
- [ ] Replace `useState` with `useForm`
- [ ] Replace manual `handleChange` with `register`
- [ ] Replace `validateForm()` with Zod schema
- [ ] Update error display to use `formState.errors`
- [ ] Update submit handler to use `handleSubmit`
- [ ] Handle default values for edit forms
- [ ] Test all validation scenarios
- [ ] Test error handling
- [ ] Test special integrations
- [ ] Verify form submission works
- [ ] Check mobile responsiveness
- [ ] Review accessibility

### Post-Migration
- [ ] Remove unused `useState` hooks
- [ ] Remove manual validation functions
- [ ] Remove manual error state management
- [ ] Update tests if needed
- [ ] Code review
- [ ] Update documentation

---

## Lessons Learned & Best Practices

### Error Handling Consolidation ✅ **COMPLETED**

**Issue**: `getErrorMessage` functions were duplicated across multiple form components.

**Solution**: Consolidated into shared utilities:
- **`formHelpers.getErrorMessage`**: For React Hook Form/Zod validation errors (client-side)
  - Returns `null` if no error, string message if error exists
  - Handles Zod error objects, arrays, and various error formats
  - Used in: CreateDive, CreateDiveSite, DivingCenterForm, TripFormModal, Register
- **`api.extractErrorMessage`**: For API/axios error responses (server-side)
  - Always returns a string (never null)
  - Handles FastAPI/axios error payloads, Pydantic validation errors
  - Enhanced to support custom default messages
  - Used in: All pages handling API errors (DivingCenters, EditDiveSite, etc.)

**Key Distinction**:
- Form validation errors (`formHelpers.getErrorMessage`) → Client-side, can return `null`
- API errors (`api.extractErrorMessage`) → Server-side, always returns string

**Specialized Error Handlers** (kept separate):
- `ErrorPage.getErrorMessage`: Component-specific, handles HTTP status codes (502, 500+, network)
- `WindDataError.getErrorMessage`: Domain-specific, handles weather API errors (429, 500+, 404)

### Validation Error Persistence
**Issue**: In controlled mode, validation errors were disappearing after 1ms due to form resets triggered by parent state updates.

**Solution**: 
- Only initialize form on mount, don't reset on every external data change
- Use `reValidateMode: 'onChange'` to ensure errors clear when fields become valid
- Debounce parent state updates (200ms) to prevent feedback loops
- Use `isInitializedRef` to track form initialization state

### HTML5 Validation Integration
**Decision**: Allow HTML5 validation alongside React Hook Form validation.

**Implementation**:
- Use `type='email'` and `type='url'` for better mobile keyboard support
- Remove `noValidate` from form to enable browser validation popups
- React Hook Form errors display below fields, browser popups appear on submit/blur

### URL Validation
**Requirement**: Only allow `http://` and `https://` protocols.

**Implementation**: Custom validation using JavaScript's `URL` constructor:
```javascript
url: z.string().optional().refine(
  val => {
    if (!val || val.trim() === '') return true;
    try {
      const url = new URL(val);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  },
  { message: 'Please enter a valid URL starting with http:// or https://' }
)
```

### Coordinate Validation
**Issue**: Form inputs return strings, but validation needs numeric ranges.

**Solution**: Use `z.preprocess` to handle string-to-number conversion:
```javascript
latitude: z.preprocess(
  val => {
    if (val === '' || val === null || val === undefined) return '';
    return String(val);
  },
  z.string().min(1, 'Latitude is required').refine(
    val => {
      const num = parseFloat(val);
      return !isNaN(num) && num >= -90 && num <= 90;
    },
    { message: 'Latitude must be between -90 and 90' }
  )
)
```

### Trip Form Validation with Nested Arrays
**Requirement**: Trip forms need to validate trip metadata and nested dive arrays.

**Implementation**: Created comprehensive tripSchemas with tripDiveSchema:
```javascript
const tripDiveSchema = z.object({
  id: z.union([z.number(), z.string()]).optional(),
  dive_number: z.number().min(1, 'Dive number must be at least 1'),
  dive_site_id: z.union([z.number(), z.string(), z.null()])
    .optional()
    .nullable()
    .transform(val => (val === '' || val === null ? null : Number(val))),
  dive_time: z.string().optional().nullable()
    .refine(val => !val || val === '' || /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(val), {
      message: 'Please enter a valid time in HH:MM format',
    }),
  dive_duration: z.union([z.string(), z.number()])
    .optional()
    .nullable()
    .refine(val => {
      if (!val || val === '' || val === null) return true;
      const num = typeof val === 'string' ? parseInt(val, 10) : val;
      return !isNaN(num) && num >= 1 && num <= 1440;
    }, { message: 'Dive duration must be between 1 and 1440 minutes' })
    .transform(val => {
      if (!val || val === '' || val === null) return null;
      return typeof val === 'string' ? parseInt(val, 10) : val;
    }),
  dive_description: z.string().optional().nullable().or(z.literal('')),
});

export const tripSchemas = {
  dive: tripDiveSchema,
  trip: z.object({
    diving_center_id: z.union([z.number(), z.string(), z.null()])
      .optional()
      .nullable()
      .transform(val => (val === '' || val === null ? null : Number(val))),
    trip_date: z.string().min(1, 'Trip date is required'),
    trip_time: z.string().optional().nullable()
      .refine(val => !val || val === '' || /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(val), {
        message: 'Please enter a valid time in HH:MM format',
      }),
    // ... other trip fields
    dives: z.array(tripDiveSchema).default([]),
  }),
};
```

**Key Points**:
- Use `useFieldArray` from React Hook Form to manage dynamic dive arrays
- Nested schemas allow validation of complex nested structures
- Transform functions handle type conversions (string to number, empty to null)
- Time validation uses regex pattern matching for HH:MM format
- Duration validation ensures values are within reasonable ranges (1-1440 minutes)

## Common Patterns & Solutions

### Pattern 1: Conditional Validation

```javascript
const schema = z.object({
  dive_site_id: z.string().min(1, 'Dive site is required'),
  selected_route_id: z.string().optional(),
}).refine((data) => {
  // Custom validation logic
  if (someCondition) {
    return data.selected_route_id !== '';
  }
  return true;
}, {
  message: 'Route is required when condition is met',
  path: ['selected_route_id'],
});
```

### Pattern 2: Dependent Fields

```javascript
// Use watch() to watch field values
const { watch } = useForm();
const diveSiteId = watch('dive_site_id');

// Fetch routes when dive site changes
useEffect(() => {
  if (diveSiteId) {
    fetchRoutes(diveSiteId);
  }
}, [diveSiteId]);
```

### Pattern 3: File Uploads

```javascript
// File uploads stay separate from React Hook Form
const [files, setFiles] = useState([]);

// Form handles other fields
const { register, handleSubmit } = useForm();

const onSubmit = async (data) => {
  // Submit form data
  await submitForm(data);
  // Upload files separately
  await uploadFiles(files);
};
```

### Pattern 4: Arrays (Tags, Media, etc.)

```javascript
// Arrays can be managed separately or with useFieldArray
import { useFieldArray } from 'react-hook-form';

const { fields, append, remove } = useFieldArray({
  control,
  name: 'tags',
});

// Or keep separate state for complex arrays
const [tags, setTags] = useState([]);
```

**Trip Form Example** (using useFieldArray for nested dives):
```javascript
const { control, register, handleSubmit } = useForm({
  resolver: zodResolver(tripSchemas.trip),
  defaultValues: {
    dives: [],
  },
});

const { fields, append, remove } = useFieldArray({
  control,
  name: 'dives',
});

// Add new dive
const addDive = () => {
  append({
    dive_number: fields.length + 1,
    dive_site_id: null,
    dive_time: '',
    dive_duration: null,
    dive_description: '',
  });
};

// Remove dive
const removeDive = (index) => {
  remove(index);
};
```

### Pattern 5: Integration with Existing Components

```javascript
// For components like Turnstile that don't use standard inputs
const [turnstileToken, setTurnstileToken] = useState(null);

// Use setValue to update form when token is received
const { setValue } = useForm();

const handleTurnstileVerify = (token) => {
  setTurnstileToken(token);
  setValue('turnstile_token', token, { shouldValidate: true });
};
```

---

## Testing Strategy

### Unit Tests

For each migrated form:

1. **Validation Tests**
   - Test all validation rules
   - Test error messages
   - Test conditional validation

2. **Integration Tests**
   - Test form submission
   - Test error handling
   - Test special integrations (Turnstile, Google, etc.)

3. **Accessibility Tests**
   - Keyboard navigation
   - Screen reader compatibility
   - Error announcements

### Manual Testing Checklist

- [ ] All fields can be filled
- [ ] Validation errors display correctly
- [ ] Errors clear when field is corrected
- [ ] Form submits successfully
- [ ] Error handling works (network errors, validation errors)
- [ ] Mobile responsiveness maintained
- [ ] Special integrations work (Turnstile, Google Sign-In, etc.)
- [ ] Edit forms pre-populate correctly
- [ ] Dependent fields update correctly

---

## Rollback Plan

### If Migration Fails

1. **Keep Old Code**: Don't delete old form code until migration is verified
2. **Feature Flags**: Consider using feature flags to toggle between old/new forms
3. **Git Branches**: Work in feature branches, merge only after thorough testing
4. **Incremental Rollout**: Migrate one form at a time, don't migrate all at once

### Rollback Steps

1. Revert the specific form component to previous version
2. Verify form still works
3. Document issues encountered
4. Fix issues before retrying migration

---

## Success Criteria

### Code Quality
- [ ] Reduced code by 60-70% per form
- [ ] Removed all manual validation functions
- [ ] Removed manual error state management
- [ ] Consistent form patterns across all forms

### Functionality
- [ ] All forms work as before
- [ ] Validation is consistent and accurate
- [ ] Error messages are clear and helpful
- [ ] Form submission works correctly

### Developer Experience
- [ ] Easier to add new forms
- [ ] Easier to modify validation rules
- [ ] Type-safe validation (if using TypeScript)
- [ ] Better code maintainability

### User Experience
- [ ] Faster form interactions (uncontrolled components)
- [ ] Better error feedback
- [ ] Consistent form behavior
- [ ] Improved accessibility

---

## Common Pitfalls & Solutions

### Pitfall 1: Forgetting to Handle Default Values

**Problem**: Edit forms don't pre-populate

**Solution**: Use `defaultValues` in `useForm` or `reset()` when data loads

```javascript
const { reset } = useForm();

useEffect(() => {
  if (dive) {
    reset({
      name: dive.name,
      // ... map all fields
    });
  }
}, [dive, reset]);
```

### Pitfall 2: Not Handling Dependent Fields

**Problem**: Fields that depend on other fields don't update

**Solution**: Use `watch()` to watch field values

```javascript
const diveSiteId = watch('dive_site_id');

useEffect(() => {
  if (diveSiteId) {
    // Fetch dependent data
  }
}, [diveSiteId]);
```

### Pitfall 3: Complex Arrays/Objects

**Problem**: Tags, media, etc. are complex to handle

**Solution**: Keep complex arrays separate, use `useFieldArray` for simple arrays

```javascript
// Complex: Keep separate
const [tags, setTags] = useState([]);

// Simple: Use useFieldArray
const { fields, append, remove } = useFieldArray({ control, name: 'items' });
```

### Pitfall 4: Integration with Non-Standard Components

**Problem**: Turnstile, Google Sign-In don't use standard inputs

**Solution**: Use `setValue()` to update form programmatically

```javascript
const { setValue } = useForm();

const handleTurnstileVerify = (token) => {
  setValue('turnstile_token', token, { shouldValidate: true });
};
```

### Pitfall 5: Time Format Mismatch Between Frontend and Backend

**Problem**: Backend expects `HH:MM:SS` format but HTML time input provides `HH:MM` format.

**Solution**: Convert time format when loading and submitting:
- **Loading**: Strip seconds from backend time: `data.dive_time.substring(0, 5)`
- **Submitting**: Append seconds to form time: `${data.dive_time}:00`

```javascript
// When loading existing data
reset({
  dive_time: data.dive_time ? data.dive_time.substring(0, 5) : '',
  // ... other fields
});

// When submitting
const diveData = {
  ...data,
  dive_time: data.dive_time && data.dive_time !== '' ? `${data.dive_time}:00` : null,
};
```

### Pitfall 6: Backend Field Name Mismatch

**Problem**: Backend expects `tags` but frontend was sending `tag_ids`.

**Solution**: Always verify backend schema field names. The `DiveUpdate` schema expects `tags`, not `tag_ids`.

```javascript
// ✅ CORRECT
const diveData = {
  ...data,
  tags: selectedTags.length > 0 ? selectedTags : [],
};

// ❌ WRONG
const diveData = {
  ...data,
  tag_ids: selectedTags.length > 0 ? selectedTags : [],
};
```

---

## Migration Timeline

### Week 1: Foundation
- **Days 1-2**: Setup, Login form
- **Days 3-4**: Register form, testing, documentation

### Week 2: Medium Complexity
- **Days 5-6**: CreateDiveSite, DivingCenterForm
- **Days 7-8**: CreateDivingCenter, CreateTrip

### Week 3: Complex Forms
- **Days 9-11**: CreateDive, EditDive
- **Days 12-14**: EditDiveSite, final testing

### Buffer Time
- **Days 15-17**: Testing, bug fixes, documentation updates

---

## Resources

### Documentation
- [React Hook Form Documentation](https://react-hook-form.com/)
- [Zod Documentation](https://zod.dev/)
- [@hookform/resolvers](https://github.com/react-hook-form/resolvers)

### Examples
- See migrated forms in codebase after Phase 1 completion
- React Hook Form examples: https://react-hook-form.com/get-started

### Support
- React Hook Form Discord: https://discord.gg/react-hook-form
- GitHub Issues: https://github.com/react-hook-form/react-hook-form/issues

---

## Next Steps

1. **Review this plan** with the team
2. **Set up development environment** (install dependencies)
3. **Create feature branch**: `feature/migrate-forms-react-hook-form`
4. **Start with Login form** as proof of concept
5. **Iterate and refine** patterns based on first migration
6. **Continue with remaining forms** following the migration order

---

**Last Updated**: December 25, 2025  
**Status**: Phase 1, Phase 2, Phase 3, and Phase 4 Completed - Migration Complete
**Progress**: 
- ✅ Phase 1: Foundation (Login, Register) - **COMPLETED**
- ✅ Phase 2.1: CreateDiveSite - **COMPLETED**
- ✅ Phase 2.2: DivingCenterForm - **COMPLETED**
- ✅ Phase 2.3: CreateDivingCenter & TripFormModal - **COMPLETED**
- ✅ Phase 3.1: CreateDive - **COMPLETED**
- ✅ Phase 3.2: EditDive - **COMPLETED**
- ✅ Phase 3.3: EditDiveSite - **COMPLETED**
- ✅ Phase 3.4: EditDivingCenter - **COMPLETED**
- ✅ Phase 4: Admin & Profile Forms - **COMPLETED**

**Completed Forms**:
- ✅ Login.js
- ✅ Register.js
- ✅ CreateDiveSite.js
- ✅ DivingCenterForm.js (used by CreateDivingCenter.js)
- ✅ TripFormModal.js (used by CreateTrip.js)
- ✅ CreateDive.js
- ✅ EditDive.js
- ✅ EditDiveSite.js
- ✅ EditDivingCenter.js
- ✅ AdminDives.js
- ✅ Profile.js

**Additional Improvements**:
- ✅ Consolidated `getErrorMessage` functions across form components
- ✅ Enhanced `extractErrorMessage` in api.js for better API error handling
- ✅ Created comprehensive `createDiveSchema` in formHelpers.js
- ✅ Fixed time format handling (HH:MM ↔ HH:MM:SS conversion)
- ✅ Fixed tag field name (`tags` vs `tag_ids`) for backend compatibility

**Next Steps**: All planned forms have been migrated. Proceed to testing and verification.

