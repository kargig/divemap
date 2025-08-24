# JavaScript Style Rules for Divemap Frontend

This document outlines the JavaScript/React coding standards and best practices based on our ESLint configuration and the fixes we've implemented.

## Table of Contents

1. [Import Organization](#import-organization)
2. [PropTypes Validation](#proptypes-validation)
3. [JSX Content Escaping](#jsx-content-escaping)
4. [Console Statements](#console-statements)
5. [Unused Variables and Imports](#unused-variables-and-imports)
6. [Component Structure](#component-structure)
7. [Code Quality Standards](#code-quality-standards)

## Import Organization

### Import Order Rules
Follow this strict import order to comply with ESLint `import/order` rules:

```javascript
// 1. Built-in Node.js modules (if any)
import path from 'path';

// 2. External packages (alphabetically ordered)
import { Calendar, Clock, Star } from 'lucide-react';
import { Feature, Point } from 'ol';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

// 3. PropTypes (must come after external packages)
import PropTypes from 'prop-types';

// 4. Internal imports (relative paths)
import { getDifficultyLabel } from '../utils/difficultyHelpers';
import './Component.css';
```

### Import Order Examples

#### ✅ CORRECT - Map Components
```javascript
import { Feature } from 'ol';
import { Point } from 'ol/geom';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import Map from 'ol/Map';
import { fromLonLat } from 'ol/proj';
import OSM from 'ol/source/OSM';
import VectorSource from 'ol/source/Vector';
import { Style, Icon } from 'ol/style';
import View from 'ol/View';
import PropTypes from 'prop-types';
import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

import { getDifficultyLabel, getDifficultyColorClasses } from '../utils/difficultyHelpers';
```

#### ✅ CORRECT - Regular Components
```javascript
import { AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';
```

#### ❌ WRONG - Incorrect Order
```javascript
import PropTypes from 'prop-types';  // Too early
import { useState, useEffect } from 'react';
import { Feature } from 'ol';  // Should be before React
```

### Import Order Checklist
- [ ] Built-in modules first (if any)
- [ ] External packages in alphabetical order
- [ ] PropTypes after external packages
- [ ] React imports after external packages
- [ ] Internal imports last
- [ ] No blank lines between import groups (ESLint handles this)

## PropTypes Validation

### Required PropTypes for All Components
Every React component must have PropTypes validation:

```javascript
import PropTypes from 'prop-types';

const MyComponent = ({ title, count, onAction, children }) => {
  // Component implementation
};

MyComponent.propTypes = {
  title: PropTypes.string.isRequired,
  count: PropTypes.number,
  onAction: PropTypes.func.isRequired,
  children: PropTypes.node,
};

MyComponent.defaultProps = {
  count: 0,
  children: null,
};

export default MyComponent;
```

### PropTypes Types Reference
```javascript
// Basic types
PropTypes.string.isRequired
PropTypes.number
PropTypes.bool
PropTypes.object
PropTypes.array

// Complex types
PropTypes.func
PropTypes.node
PropTypes.element
PropTypes.oneOf(['option1', 'option2'])
PropTypes.oneOfType([PropTypes.string, PropTypes.number])

// Array/object with specific content
PropTypes.arrayOf(PropTypes.string)
PropTypes.objectOf(PropTypes.number)
PropTypes.shape({
  id: PropTypes.number.isRequired,
  name: PropTypes.string.isRequired,
  optional: PropTypes.bool,
})
```

### PropTypes Examples from Our Codebase

#### ✅ Avatar Component
```javascript
Avatar.propTypes = {
  src: PropTypes.string,
  alt: PropTypes.string,
  size: PropTypes.oneOf(['xs', 'sm', 'md', 'lg', 'xl', '2xl']),
  className: PropTypes.string,
  fallbackText: PropTypes.string,
};

Avatar.defaultProps = {
  size: 'md',
  className: '',
  fallbackText: null,
};
```

#### ✅ ImportDivesModal Component
```javascript
ImportDivesModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func,
};
```

## JSX Content Escaping

### Entity Escaping Rules
Always escape quotes and apostrophes in JSX content:

```javascript
// ❌ WRONG - Unescaped entities
<p>You'll need to select a file</p>
<code>TOKEN="your_token_here"</code>

// ✅ CORRECT - Escaped entities
<p>You&apos;ll need to select a file</p>
<code>TOKEN=&quot;your_token_here&quot;</code>
```

### Common Entity Escapes
```javascript
// Apostrophes
"don't" → "don&apos;t"
"you'll" → "you&apos;ll"
"it's" → "it&apos;s"

// Quotes
"example" → "&quot;example&quot;"
'example' → "&apos;example&apos;"

// Special characters
"&" → "&amp;"
"<" → "&lt;"
">" → "&gt;"
```

### Examples from Our Fixes

#### ✅ API.js - Fixed Quotes
```javascript
// Before (❌)
&nbsp;&nbsp;-H "Authorization: Bearer YOUR_TOKEN_HERE" \

// After (✅)
&nbsp;&nbsp;-H &quot;Authorization: Bearer YOUR_TOKEN_HERE&quot; \
```

#### ✅ ImportDivesModal.js - Fixed Apostrophes
```javascript
// Before (❌)
Select one or more Subsurface XML files to import your dives. You'll be able to

// After (✅)
Select one or more Subsurface XML files to import your dives. You&apos;ll be able to
```

## Console Statements

### Console Statement Rules
**NEVER use console statements in production code:**

```javascript
// ❌ WRONG - Console statements
console.log('Debug info');
console.error('Error occurred');
console.warn('Warning message');

// ✅ CORRECT - Remove or replace with proper logging
// Use toast notifications, error boundaries, or proper error handling
toast.error('Error occurred');
```

### Console Statement Removal Examples

#### ✅ DiveMap.js - Removed Console
```javascript
// Before (❌)
} catch (error) {
  console.error('Error creating map:', error);
}

// After (✅)
} catch (error) {
  // Error creating map, handle gracefully
}
```

#### ✅ DiveSitesMap.js - Removed Console
```javascript
// Before (❌)
} catch (error) {
  console.warn('Invalid coordinates:', coordinates);
}

// After (✅)
} catch (error) {
  // Invalid coordinates, skip this feature
}
```

## Unused Variables and Imports

### Unused Variable Rules
Remove all unused variables, parameters, and imports:

```javascript
// ❌ WRONG - Unused variables
const MyComponent = ({ title, description, unused }) => {
  return <div>{title}</div>; // description and unused are never used
};

// ✅ CORRECT - Only include what you use
const MyComponent = ({ title }) => {
  return <div>{title}</div>;
};
```

### Unused Import Removal Examples

#### ✅ Navbar.js - Removed Unused Import
```javascript
// Before (❌)
import { Award, LogOut, User, Settings } from 'lucide-react';

// After (✅)
import { LogOut, User, Settings } from 'lucide-react';
```

#### ✅ DivingCentersMap.js - Removed Unused Parameters
```javascript
// Before (❌)
const fitMapToDivingCenters = (features, vectorSource, divingCenters) => {
  // divingCenters parameter never used
};

// After (✅)
const fitMapToDivingCenters = (features, vectorSource) => {
  // Only use what you need
};
```

## Component Structure

### Component Organization
Follow this structure for all components:

```javascript
import PropTypes from 'prop-types';
// Other imports...

const ComponentName = ({ prop1, prop2 }) => {
  // 1. Hooks
  const [state, setState] = useState(initialValue);
  const ref = useRef(null);
  
  // 2. Effects
  useEffect(() => {
    // Effect logic
  }, [dependencies]);
  
  // 3. Event handlers
  const handleClick = () => {
    // Handler logic
  };
  
  // 4. Helper functions
  const helperFunction = () => {
    // Helper logic
  };
  
  // 5. Render
  return (
    <div>
      {/* JSX content */}
    </div>
  );
};

// 6. PropTypes
ComponentName.propTypes = {
  prop1: PropTypes.string.isRequired,
  prop2: PropTypes.number,
};

// 7. Default props
ComponentName.defaultProps = {
  prop2: 0,
};

// 8. Export
export default ComponentName;
```

## Code Quality Standards

### ESLint Rules Compliance
Ensure all code passes these ESLint rules:

### Floating Search and Filter Boxes Requirements
- **ALWAYS implement floating search and filter boxes using the exact pattern from `docs/development/floating-search-filters-guide.md`**
- **ALWAYS use `sticky top-16 z-[70]` for the sticky container to ensure proper positioning below navbar**
- **ALWAYS ensure search box and filters are direct children of the same sticky container**
- **NEVER use borders between search and filters sections - use padding only**
- **ALWAYS verify z-index is higher than navbar z-index (typically `z-[70]` vs `z-[60]`)**
- **ALWAYS test floating behavior on both desktop and mobile devices**
- **ALWAYS ensure no gaps exist between navbar, search box, and filters**
- **ALWAYS use solid white background with shadow to prevent content showing through**

```javascript
// ✅ Complexity - Keep functions simple
complexity: ['warn', 20]  // Maximum complexity of 20

// ✅ Function length - Keep functions focused
max-lines-per-function: ['warn', 600]  // Maximum 600 lines

// ✅ Line length - Keep lines readable
max-len: ['warn', { code: 100 }]  // Maximum 100 characters

// ✅ No trailing whitespace
'no-trailing-spaces': 'error'

// ✅ Consistent formatting
'prettier/prettier': 'error'
```

### Code Quality Checklist
Before committing any JavaScript/React code:

- [ ] All imports are properly ordered
- [ ] PropTypes are defined for all components
- [ ] No unescaped quotes or apostrophes in JSX
- [ ] No console statements
- [ ] No unused variables or imports
- [ ] All ESLint warnings are resolved
- [ ] Prettier formatting is applied
- [ ] Code complexity is under 20
- [ ] Functions are under 600 lines
- [ ] Lines are under 100 characters

## Quick Fix Commands

### Automated Fixes
```bash
# Fix import order and basic issues
docker exec divemap_frontend sh -c "cd /app && npx eslint src --fix"

# Format code with Prettier
docker exec divemap_frontend sh -c "cd /app && npx prettier --write src/"

# Check current warning count
docker exec divemap_frontend sh -c "cd /app && npx eslint src --format=compact | wc -l"
```

### Manual Fixes
```bash
# Fix specific file
docker exec divemap_frontend sh -c "cd /app && npx eslint src/components/ComponentName.js --fix"

# Check specific file
docker exec divemap_frontend sh -c "cd /app && npx eslint src/components/ComponentName.js"
```

## Best Practices Summary

1. **Import Order**: Built-in → External → PropTypes → Internal
2. **PropTypes**: Always define for every component
3. **Entity Escaping**: Escape all quotes and apostrophes in JSX
4. **Console Removal**: Never use console statements
5. **Unused Code**: Remove all unused variables and imports
6. **Code Quality**: Keep functions simple and focused
7. **Consistent Formatting**: Use Prettier for consistent style
8. **ESLint Compliance**: Resolve all warnings before committing

Following these rules will ensure consistent, maintainable, and high-quality JavaScript/React code throughout the Divemap frontend.
