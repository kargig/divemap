---
name: xss-protection
description: Guidelines and workflows for detecting and fixing Cross-Site Scripting (XSS) vulnerabilities in frontend code. Use this skill when auditing frontend components, reviewing PRs with user-generated content, or investigating reported XSS issues.
---

# XSS Protection Skill

This skill provides a systematic approach to identifying, reproducing, and mitigating XSS vulnerabilities.

## Detection Workflow

1.  **Identify Sinks:** Search for code locations where strings are interpreted as HTML.
    - Grep for: `innerHTML`, `dangerouslySetInnerHTML`, `bindPopup`, `L.divIcon`.
2.  **Trace Sources:** Determine if the data reaching these sinks comes from an untrusted source (User input, API response, URL params).
3.  **Audit Utils:** Check text processing utilities (linkifiers, decoders, formatters) for greedy regex or unsafe DOM APIs.

## Mitigation Patterns

- **Sanitization:** Use `DOMPurify.sanitize()` for any HTML string before rendering.
- **Escaping:** Use `lodash/escape` to escape individual variables before template interpolation.
- **Safe Decoding:** Use `DOMParser` or regex for entity decoding to prevent script execution.
- **Protocol Whitelisting:** Validate URL protocols to only allow `http:` and `https:`.

## Pre-Commit Detection

To prevent XSS from entering the repository:

1.  **Linting:** Ensure `eslint-plugin-react` is configured with `react/no-danger`.
2.  **SAST:** Use static analysis tools (e.g., SonarQube, Snyk, Semgrep) in CI/CD.
3.  **Audit Scripts:** Use a local grep-based script to flag dangerous sinks in new changes.

## Advanced References

- [Dangerous Patterns](references/patterns.md)
- [Best Practices](references/best-practices.md)
