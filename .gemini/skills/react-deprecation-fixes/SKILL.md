---
name: react-deprecation-fixes
description: Standard operating procedure for fixing React deprecation warnings. Use when encountering console warnings about future React API changes or deprecated features, such as defaultProps on functional components.
---

# Fixing React Deprecations

This skill provides guidelines for resolving common React deprecation warnings, ensuring the codebase is ready for future major React versions.

## Deprecated: `defaultProps` in Functional Components

**The Warning:**
`Warning: ComponentName: Support for defaultProps will be removed from function components in a future major release. Use JavaScript default parameters instead.`

**The Problem:**
Defining `Component.defaultProps = { ... }` on functional components is an anti-pattern in modern React. The React core team is removing support for it.

**The Fix:**
Remove the `defaultProps` assignment and instead use standard JavaScript default parameter syntax directly in the function signature.

**BAD Pattern (Deprecated):**

```jsx
const Avatar = ({ size, className }) => {
  return <div className={`avatar ${size} ${className}`} />;
};

Avatar.defaultProps = {
  size: 'md',
  className: '',
};
```

**GOOD Pattern (Standard ES6):**

```jsx
// Use default parameters directly in the destructuring
const Avatar = ({ size = 'md', className = '' }) => {
  return <div className={`avatar ${size} ${className}`} />;
};
```

### Action Plan
When tasked with fixing this warning:
1. Locate the component file throwing the warning.
2. Move all values from the `defaultProps` object into the component's parameter destructuring.
3. Completely delete the `Component.defaultProps = { ... }` block.
4. Run linting (`make lint-frontend`) to ensure no unused imports or syntax errors were introduced.