# XSS Best Practices

Follow these principles to ensure "Secure by Default" development.

## 1. Favor React's Secure Rendering
Let React handle the heavy lifting. Standard JSX text is always escaped.
- **Good:** `<div>{userContent}</div>`
- **Avoid:** Using `dangerouslySetInnerHTML` unless absolutely necessary for trusted CMS content.

## 2. Sanitize HTML strings with DOMPurify
If you MUST render HTML strings (e.g., from a CMS or for Leaflet popups), always pass them through `DOMPurify`.
- **Good:** `marker.bindPopup(DOMPurify.sanitize(popupHtml))`
- **Tip:** Use `ADD_ATTR: ['onclick']` sparingly only for trusted internal handlers.

## 3. Escape User Variables in Templates
Before interpolating user variables into an HTML string, escape them individually.
- **Good:**
  ```javascript
  const html = `<div>${lodash.escape(userName)}</div>`;
  ```

## 4. Harden Linkifiers
- Use a strict regex that stops at `< > "`.
- Validate protocols using the `URL` constructor: `['http:', 'https:'].includes(url.protocol)`.
- Use `rel="noopener noreferrer nofollow ugc"` for external user links.

## 5. Safe Entity Decoding
Use a method that doesn't interpret HTML tags.
- **Safe Method (DOMParser):**
  ```javascript
  const decode = (html) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.documentElement.textContent;
  };
  ```
- **Even Safer (Regex):** Target only entities like `&amp;` without touching the rest of the string.

## 6. Security Headers
Implement a strong Content Security Policy (CSP) to mitigate the impact of any XSS that might slip through.
- `script-src 'self'`
- `object-src 'none'`
