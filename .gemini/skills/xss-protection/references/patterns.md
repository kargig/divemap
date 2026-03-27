# Dangerous XSS Patterns

These patterns should be flagged during security audits as they are common entry points for XSS vulnerabilities.

## 1. Unsafe DOM Manipulation
Avoid direct assignment to properties that interpret strings as HTML.
- `element.innerHTML = ...`
- `element.outerHTML = ...`
- `$(element).html(...)` (jQuery)

## 2. Unsafe React Props
React escapes text by default, but provides a bypass for intentional HTML rendering.
- `dangerouslySetInnerHTML={{ __html: ... }}`

## 3. Unsafe Entity Decoding
Commonly used to "clean" text, but often implemented dangerously.
- Creating a dummy `div` and setting `innerHTML` just to read `textContent`.
- **Dangerous Example:**
  ```javascript
  const decode = (html) => {
    const div = document.createElement('div');
    div.innerHTML = html; // <--- SCRIPT EXECUTION POINT
    return div.textContent;
  };
  ```

## 4. Greedy Regex in Linkifiers
Regex that doesn't stop at quotes or angle brackets can allow attribute breakouts.
- **Dangerous:** `/(https?:\/\/[^\s]+)/`
- **Safer:** `/(https?:\/\/[^\s<>"]+)/`

## 5. Unsafe Pseudo-protocols
Always validate URL protocols.
- `javascript:alert(1)`
- `data:text/html,...`
- `vbscript:...`

## 6. Unescaped Script Tags in JSON-LD
`JSON.stringify` does not escape forward slashes in `</script>`.
- **Dangerous:** `<script type="application/ld+json">{JSON.stringify(schema)}</script>`
- **Fix:** `JSON.stringify(schema).replace(/<\/script>/g, '<\\/script>')`
