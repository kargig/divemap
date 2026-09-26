# SEO Indexing Fixes Implementation Plan

> **For agentic workers:** Use subagent-driven-development or executing-plans. Steps use checkbox syntax.

**Goal:** Shrink crawl budget noise, add path-based geo hubs without duplicate canonicals, prerender `/map`, preserve in-app search.

**Architecture:** Additive `/dive-sites/{country}[/{region}]` routes reuse `DiveSites` + API filters; sitemap filters substantial dive logs; nginx/seo.py prerender hubs + map.

**Tech Stack:** FastAPI, React Router, Nginx, SQLAlchemy.

## Global Constraints
- Python venv: `backend/divemap_venv`
- Do not break GlobalSearchBar / DesktopSearchBar on hubs
- Never put `?country=` / `?region=` in sitemap
- Chrome DevTools verification required for search

### Tasks (status)

- [x] Design spec `docs/superpowers/specs/2026-09-25-seo-indexing-fixes-design.md`
- [x] `backend/app/seo_geo.py` helpers + substantial dive filter
- [x] Sitemap trim + geo hubs + priority cleanup in `generate_static_content.py`
- [x] Frontend `DiveSitePathGate` + `DiveSites` path sync + SEO canonical
- [x] Backend prerender geo hubs + map; nginx include `map`
- [x] Breadcrumbs/schema path hubs on site detail
- [x] `SEO.jsx` `noindex` + `canonicalPath` props
- [ ] Backend tests pass (`test_seo_geo`, `test_seo_router` geo/map)
- [ ] Chrome DevTools: search on `/dive-sites`, country hub, region hub
