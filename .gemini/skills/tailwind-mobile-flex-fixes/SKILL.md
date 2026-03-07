---
name: tailwind-mobile-flex-fixes
description: Standard patterns and utility classes for fixing flexbox layout issues on mobile views. Use when UI elements (buttons, icons, avatars) extend beyond the screen, get squished, or text overflows incorrectly on narrow viewports.
---

# Fixing Mobile Flexbox Layouts with Tailwind

This skill outlines the standard patterns for ensuring flexbox layouts behave correctly on narrow mobile screens, preventing common issues like squished avatars, pushed-off buttons, and text overflowing its container.

## The Problem: Unconstrained Flex Containers

When text inside a flex container is too long, flexbox will attempt to fit everything. This often results in:
1.  **Squished Icons/Avatars:** Fixed-size elements shrink into ovals or weird shapes to make room for text.
2.  **Pushed Buttons:** Action buttons on the far right get pushed entirely off the screen, making them unclickable.
3.  **Broken Wraps:** Text wraps awkwardly, ruining vertical alignment.

## The Standard Divemap Solution

To guarantee a stable layout on mobile devices, apply this exact combination of Tailwind utility classes:

### 1. Protect Fixed Elements (`shrink-0`)

Always apply `shrink-0` to elements that must **never** change size (Avatars, Icons, Action Buttons).

```jsx
// BAD: Avatar will turn into an oval if text is long
<div className="relative">
  <Avatar src={user.avatar} size='md' />
</div>

// GOOD: Avatar retains its circular shape
<div className="relative shrink-0">
  <Avatar src={user.avatar} size='md' />
</div>
```

### 2. Constrain Text Containers (`flex-1 min-w-0`)

The container holding the text must be allowed to shrink below its content's intrinsic width. `flex-1` tells it to fill available space, but without `min-w-0`, a flex item won't shrink smaller than its content.

```jsx
// GOOD: Container will shrink when space is tight
<div className="flex-1 min-w-0">
  ...text elements...
</div>
```

### 3. Truncate Text Elements (`truncate`)

Finally, apply `truncate` to the actual text nodes inside the constrained container so they display an ellipsis (`...`) instead of wrapping or pushing layout boundaries.

```jsx
// GOOD: Text will gracefully truncate
<p className="text-sm font-bold text-gray-900 truncate">
  {user.very_long_username_that_breaks_layouts}
</p>
```

## Complete Example Pattern

When building a list item (like a user card, message preview, or notification) with an avatar on the left, text in the middle, and buttons on the right, use this structure:

```jsx
<div className="flex items-center justify-between gap-4 p-4">
  
  {/* Avatar: Must not shrink */}
  <div className="flex items-center space-x-3 min-w-0 flex-1">
    <div className="shrink-0">
      <Avatar size="md" />
    </div>
    
    {/* Text Container: Must be allowed to shrink */}
    <div className="min-w-0">
      <p className="font-semibold text-gray-900 truncate">Very Long Username Here</p>
      <p className="text-sm text-gray-500 truncate">Some supplementary text that might also be long.</p>
    </div>
  </div>

  {/* Action Buttons: Must not shrink, stay on screen */}
  <div className="flex space-x-2 shrink-0">
    <button className="px-4 py-2 bg-blue-600">Accept</button>
  </div>
  
</div>
```