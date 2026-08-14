"""
Server-side HTML generation for SEO (Proposal A).

Generates pre-rendered HTML pages with unique metadata and crawlable content,
using the built SPA index.html as a shell when available.
"""

from __future__ import annotations

import html
import json
import os
import re
from typing import Any, Optional

from sqlalchemy.orm import Session, joinedload

from app.models import DiveRoute, DiveSite, DivingCenter

# Re-use slug helpers from the content generator (imported at call time to avoid cycles)
STATIC_HTML_DIR = "static-html"
LISTING_LINK_LIMIT = 100


def escape_text(value: Any) -> str:
    if value is None:
        return ""
    return html.escape(str(value), quote=True)


def strip_html_tags(text: str) -> str:
    if not text:
        return ""
    return re.sub(r"<[^>]+>", "", text)


def truncate(text: str, limit: int) -> str:
    if not text or len(text) <= limit:
        return text or ""
    return text[: limit - 3].rstrip() + "..."


def resolve_html_template() -> Optional[str]:
    candidates = [
        os.getenv("STATIC_HTML_TEMPLATE"),
        os.path.join(os.path.dirname(__file__), "llm_content", "_spa_template", "index.html"),
        os.path.join(os.path.dirname(__file__), "..", "nginx", "frontend-build", "index.html"),
        os.path.join(os.path.dirname(__file__), "..", "frontend", "dist", "index.html"),
    ]
    for path in candidates:
        if path and os.path.isfile(path):
            return path
    return None


def _site_rating_stats(site: DiveSite) -> tuple[Optional[float], int]:
    ratings = getattr(site, "ratings", None) or []
    if not ratings:
        return None, 0
    total = len(ratings)
    avg = sum(r.score for r in ratings) / total
    return avg, total


def dive_site_meta_description(site: DiveSite, avg_rating: Optional[float], total_ratings: int) -> str:
    difficulty = site.difficulty.label if site.difficulty else "scuba"
    parts = [f"{site.name} is a {difficulty} dive site in {site.country or 'the world'}."]
    if site.max_depth:
        parts.append(f"Max depth: {site.max_depth}m.")
    if total_ratings > 0 and avg_rating is not None:
        parts.append(f"Read {total_ratings} reviews and see photos.")
    else:
        parts.append("Be the first to share your experience and photos!")
    return " ".join(parts)


def diving_center_meta_description(center: DivingCenter) -> str:
    parts = [center.name]
    location = ", ".join(filter(None, [center.city, center.country]))
    if location:
        parts.append(f"is a diving center in {location}.")
    else:
        parts.append("is a diving center.")
    avg = getattr(center, "average_rating", None)
    total = getattr(center, "total_ratings", 0) or 0
    if avg:
        parts.append(f"Rated {float(avg):.1f}/10 from {total} reviews.")
    if center.description:
        parts.append(truncate(strip_html_tags(center.description), 100))
    return " ".join(parts)


def dive_route_meta_description(route: DiveRoute) -> str:
    desc = f"Dive route: {route.name}"
    if route.dive_site:
        desc += f" at {route.dive_site.name}"
    if route.description:
        desc += f". {truncate(strip_html_tags(route.description), 100)}"
    return desc


def dive_site_schema(base_url: str, path: str, site: DiveSite, avg_rating: Optional[float], total_ratings: int) -> dict:
    item_list = [
        {"@type": "ListItem", "position": 1, "name": "Home", "item": base_url},
        {"@type": "ListItem", "position": 2, "name": "Dive Sites", "item": f"{base_url}/dive-sites"},
    ]
    pos = 3
    if site.country:
        item_list.append({
            "@type": "ListItem",
            "position": pos,
            "name": site.country,
            "item": f"{base_url}/dive-sites?country={site.country}",
        })
        pos += 1
    if site.region:
        item_list.append({
            "@type": "ListItem",
            "position": pos,
            "name": site.region,
            "item": f"{base_url}/dive-sites?country={site.country or ''}&region={site.region}",
        })
        pos += 1
    item_list.append({
        "@type": "ListItem",
        "position": pos,
        "name": site.name,
        "item": f"{base_url}{path}",
    })

    schema: dict[str, Any] = {
        "@context": "https://schema.org",
        "@type": ["Place", "BodyOfWater", "TouristAttraction"],
        "name": site.name,
        "description": strip_html_tags(site.description or ""),
        "geo": {
            "@type": "GeoCoordinates",
            "latitude": float(site.latitude) if site.latitude is not None else None,
            "longitude": float(site.longitude) if site.longitude is not None else None,
        },
        "address": {
            "@type": "PostalAddress",
            "addressCountry": site.country,
            "addressRegion": site.region,
        },
        "breadcrumb": {"@type": "BreadcrumbList", "itemListElement": item_list},
    }
    if total_ratings > 0 and avg_rating is not None:
        schema["aggregateRating"] = {
            "@type": "AggregateRating",
            "ratingValue": round(avg_rating, 1),
            "reviewCount": total_ratings,
            "bestRating": "10",
            "worstRating": "1",
        }
    return schema


def diving_center_schema(base_url: str, path: str, center: DivingCenter) -> dict:
    item_list = [
        {"@type": "ListItem", "position": 1, "name": "Home", "item": base_url},
        {"@type": "ListItem", "position": 2, "name": "Diving Centers", "item": f"{base_url}/diving-centers"},
    ]
    pos = 3
    if center.country:
        item_list.append({
            "@type": "ListItem",
            "position": pos,
            "name": center.country,
            "item": f"{base_url}/diving-centers?country={center.country}",
        })
        pos += 1
    if center.city:
        item_list.append({
            "@type": "ListItem",
            "position": pos,
            "name": center.city,
            "item": f"{base_url}/diving-centers?country={center.country or ''}&city={center.city}",
        })
        pos += 1
    item_list.append({
        "@type": "ListItem",
        "position": pos,
        "name": center.name,
        "item": f"{base_url}{path}",
    })

    schema: dict[str, Any] = {
        "@context": "https://schema.org",
        "@type": ["SportsActivityLocation", "LocalBusiness"],
        "name": center.name,
        "description": strip_html_tags(center.description or ""),
        "url": f"{base_url}{path}",
        "address": {
            "@type": "PostalAddress",
            "addressCountry": center.country,
            "addressRegion": center.region,
            "addressLocality": center.city,
        },
        "breadcrumb": {"@type": "BreadcrumbList", "itemListElement": item_list},
    }
    if center.latitude is not None and center.longitude is not None:
        schema["geo"] = {
            "@type": "GeoCoordinates",
            "latitude": float(center.latitude),
            "longitude": float(center.longitude),
        }
    return schema


def dive_route_schema(base_url: str, path: str, route: DiveRoute) -> dict:
    item_list = [
        {"@type": "ListItem", "position": 1, "name": "Home", "item": base_url},
        {"@type": "ListItem", "position": 2, "name": "Dive Routes", "item": f"{base_url}/dive-routes"},
    ]
    pos = 3
    if route.dive_site:
        item_list.append({
            "@type": "ListItem",
            "position": pos,
            "name": route.dive_site.name,
            "item": f"{base_url}/dive-sites/{route.dive_site.id}",
        })
        pos += 1
    item_list.append({
        "@type": "ListItem",
        "position": pos,
        "name": route.name,
        "item": f"{base_url}{path}",
    })

    schema: dict[str, Any] = {
        "@context": "https://schema.org",
        "@type": ["CreativeWork", "Map"],
        "name": route.name,
        "description": strip_html_tags(route.description or "") or dive_route_meta_description(route),
        "breadcrumb": {"@type": "BreadcrumbList", "itemListElement": item_list},
    }
    if route.dive_site:
        schema["about"] = {"@type": "Place", "name": route.dive_site.name}
    return schema


def _breadcrumb_nav(items: list[tuple[str, str]]) -> str:
    parts = []
    for idx, (label, href) in enumerate(items):
        if idx:
            parts.append(" &rsaquo; ")
        parts.append(f'<a href="{escape_text(href)}">{escape_text(label)}</a>')
    return f'<nav aria-label="Breadcrumb">{"".join(parts)}</nav>'


def _paragraph_block(label: str, value: str) -> str:
    if not value:
        return ""
    return f"<p><strong>{escape_text(label)}:</strong> {escape_text(strip_html_tags(value))}</p>"


def render_dive_site_main(site: DiveSite, avg_rating: Optional[float], total_ratings: int) -> str:
    crumbs = [("Home", "/"), ("Dive Sites", "/dive-sites")]
    if site.country:
        crumbs.append((site.country, f"/dive-sites?country={site.country}"))
    if site.region:
        crumbs.append((
            site.region,
            f"/dive-sites?country={site.country or ''}&region={site.region}",
        ))

    lines = [
        '<main class="seo-prerender">',
        _breadcrumb_nav(crumbs),
        f"<h1>{escape_text(site.name)}</h1>",
    ]

    location = ", ".join(filter(None, [site.region, site.country]))
    if location:
        lines.append(f"<p><strong>Location:</strong> {escape_text(location)}</p>")

    meta_bits = []
    if site.max_depth:
        meta_bits.append(f"Max depth: {site.max_depth}m")
    if site.difficulty:
        meta_bits.append(f"Difficulty: {site.difficulty.label}")
    if site.latitude is not None and site.longitude is not None:
        meta_bits.append(f"Coordinates: {float(site.latitude):.6f}, {float(site.longitude):.6f}")
    if meta_bits:
        lines.append(f"<p>{escape_text(' · '.join(meta_bits))}</p>")

    if total_ratings > 0 and avg_rating is not None:
        lines.append(
            f"<p><strong>Rating:</strong> {escape_text(f'{avg_rating:.1f}/10')} "
            f"({escape_text(total_ratings)} reviews)</p>"
        )

    if site.description:
        lines.append(f"<p>{escape_text(strip_html_tags(site.description))}</p>")
    if site.marine_life:
        lines.append(_paragraph_block("Marine life", site.marine_life))
    if site.access_instructions:
        lines.append(_paragraph_block("Access", site.access_instructions))
    if site.safety_information:
        lines.append(_paragraph_block("Safety", site.safety_information))

    lines.extend([
        '<nav aria-label="Related pages">',
        '<a href="/dive-sites">All Dive Sites</a>',
    ])
    if site.country:
        lines.append(f' · <a href="/dive-sites?country={escape_text(site.country)}">Dive Sites in {escape_text(site.country)}</a>')
    lines.append("</nav></main>")
    return "\n".join(lines)


def render_diving_center_main(center: DivingCenter) -> str:
    crumbs = [("Home", "/"), ("Diving Centers", "/diving-centers")]
    if center.country:
        crumbs.append((center.country, f"/diving-centers?country={center.country}"))
    if center.city:
        crumbs.append((
            center.city,
            f"/diving-centers?country={center.country or ''}&city={center.city}",
        ))

    lines = [
        '<main class="seo-prerender">',
        _breadcrumb_nav(crumbs),
        f"<h1>{escape_text(center.name)}</h1>",
    ]

    location = ", ".join(filter(None, [center.city, center.region, center.country]))
    if location:
        lines.append(f"<p><strong>Location:</strong> {escape_text(location)}</p>")
    if center.address:
        lines.append(_paragraph_block("Address", center.address))
    if center.description:
        lines.append(f"<p>{escape_text(strip_html_tags(center.description))}</p>")
    if center.website:
        lines.append(f'<p><strong>Website:</strong> <a href="{escape_text(center.website)}">{escape_text(center.website)}</a></p>')

    lines.extend([
        '<nav aria-label="Related pages">',
        '<a href="/diving-centers">All Diving Centers</a>',
        "</nav></main>",
    ])
    return "\n".join(lines)


def render_dive_route_main(route: DiveRoute, *, get_dive_site_slug=None) -> str:
    crumbs = [("Home", "/"), ("Dive Routes", "/dive-routes")]
    if route.dive_site:
        site_slug = get_dive_site_slug(route.dive_site) if get_dive_site_slug else ""
        site_path = f"/dive-sites/{route.dive_site.id}/{site_slug}" if site_slug else f"/dive-sites/{route.dive_site.id}"
        crumbs.append((route.dive_site.name, site_path))

    lines = [
        '<main class="seo-prerender">',
        _breadcrumb_nav(crumbs),
        f"<h1>{escape_text(route.name)}</h1>",
    ]

    if route.dive_site:
        lines.append(f"<p><strong>Dive site:</strong> {escape_text(route.dive_site.name)}</p>")
    if route.route_type:
        lines.append(f"<p><strong>Route type:</strong> {escape_text(route.route_type.name)}</p>")
    if route.description:
        lines.append(f"<p>{escape_text(strip_html_tags(route.description))}</p>")

    lines.extend([
        '<nav aria-label="Related pages">',
        '<a href="/dive-routes">All Dive Routes</a>',
        "</nav></main>",
    ])
    return "\n".join(lines)


def render_listing_main(title: str, intro: str, links: list[tuple[str, str]]) -> str:
    lines = [
        '<main class="seo-prerender">',
        f"<h1>{escape_text(title)}</h1>",
        f"<p>{escape_text(intro)}</p>",
        "<ul>",
    ]
    for label, href in links[:LISTING_LINK_LIMIT]:
        lines.append(f'<li><a href="{escape_text(href)}">{escape_text(label)}</a></li>')
    lines.append("</ul></main>")
    return "\n".join(lines)


def render_homepage_main(featured_links: list[tuple[str, str]]) -> str:
    lines = [
        '<main class="seo-prerender">',
        "<h1>Divemap - Discover and Rate Scuba Dive Sites Worldwide</h1>",
        "<p>The ultimate scuba diving platform. Discover and rate dive sites, log your dives, "
        "plan trips, share underwater routes, and connect with the global diving community.</p>",
        "<nav>",
        '<a href="/dive-sites">Dive Sites</a> · ',
        '<a href="/diving-centers">Diving Centers</a> · ',
        '<a href="/dive-routes">Dive Routes</a> · ',
        '<a href="/dives">Public Dives</a> · ',
        '<a href="/about">About</a>',
        "</nav>",
    ]
    if featured_links:
        lines.append("<h2>Popular Dive Sites</h2><ul>")
        for label, href in featured_links[:20]:
            lines.append(f'<li><a href="{escape_text(href)}">{escape_text(label)}</a></li>')
        lines.append("</ul>")
    lines.append("</main>")
    return "\n".join(lines)


def _build_head_injection(
    *,
    title: str,
    description: str,
    canonical: str,
    og_type: str = "website",
    json_ld: Optional[dict] = None,
) -> str:
    lines = [
        f'<meta name="description" content="{escape_text(description)}" />',
        f'<link rel="canonical" href="{escape_text(canonical)}" />',
        '<meta name="robots" content="index, follow, max-image-preview:large" />',
        f'<meta property="og:locale" content="en_US" />',
        f'<meta property="og:site_name" content="Divemap" />',
        f'<meta property="og:type" content="{escape_text(og_type)}" />',
        f'<meta property="og:title" content="{escape_text(title)}" />',
        f'<meta property="og:description" content="{escape_text(description)}" />',
        f'<meta property="og:url" content="{escape_text(canonical)}" />',
        f'<meta name="twitter:card" content="summary" />',
        f'<meta name="twitter:title" content="{escape_text(title)}" />',
        f'<meta name="twitter:description" content="{escape_text(description)}" />',
    ]
    if json_ld:
        ld_json = json.dumps(json_ld, ensure_ascii=False)
        ld_json = ld_json.replace("</", "<\\/")
        lines.append(f'<script type="application/ld+json">{ld_json}</script>')
    return "\n    ".join(lines)


def render_seo_page(
    template_html: Optional[str],
    *,
    title: str,
    description: str,
    canonical: str,
    main_content: str,
    og_type: str = "website",
    json_ld: Optional[dict] = None,
) -> str:
    head_injection = _build_head_injection(
        title=title,
        description=description,
        canonical=canonical,
        og_type=og_type,
        json_ld=json_ld,
    )

    if template_html:
        page = template_html
        page = re.sub(r"<title>[^<]*</title>", f"<title>{escape_text(title)}</title>", page, count=1)
        page = re.sub(
            r'<meta name="description" content="[^"]*"[^>]*/>',
            f'<meta name="description" content="{escape_text(description)}" data-rh="true" />',
            page,
            count=1,
        )
        page = page.replace("</title>", f"</title>\n    {head_injection}", 1)
        page = re.sub(
            r"(<div id=\"root\">).*?(</div>)",
            rf"\1\n{main_content}\n      \2",
            page,
            count=1,
            flags=re.DOTALL,
        )
        return page

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>{escape_text(title)}</title>
  {_build_head_injection(title=title, description=description, canonical=canonical, og_type=og_type, json_ld=json_ld)}
</head>
<body>
  {main_content}
</body>
</html>"""


def _write_html_file(output_dir: str, relative_path: str, content: str) -> None:
    file_path = os.path.join(output_dir, relative_path)
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)


def generate_static_html(
    db: Session,
    output_dir: str,
    base_url: str,
    *,
    get_dive_site_slug,
    get_diving_center_slug,
    slugify,
    template_path: Optional[str] = None,
) -> int:
    """
    Generate pre-rendered HTML files under output_dir/static-html/.
    Returns the number of files written.
    """
    html_root = os.path.join(output_dir, STATIC_HTML_DIR)
    if os.path.exists(html_root):
        for root, dirs, files in os.walk(html_root, topdown=False):
            for name in files:
                os.remove(os.path.join(root, name))
            for name in dirs:
                os.remove(os.path.join(root, name))

    template_path = template_path or resolve_html_template()
    template_html = None
    if template_path:
        with open(template_path, encoding="utf-8") as f:
            template_html = f.read()
        template_store = os.path.join(output_dir, "_spa_template")
        os.makedirs(template_store, exist_ok=True)
        with open(os.path.join(template_store, "index.html"), "w", encoding="utf-8") as f:
            f.write(template_html)
        print(f"📄 Using SPA template: {template_path}")
    else:
        print("⚠️ No SPA template found — generating crawler-only HTML without JS bundles.")

    sites = (
        db.query(DiveSite)
        .filter(DiveSite.status == "approved", DiveSite.deleted_at.is_(None))
        .options(joinedload(DiveSite.difficulty), joinedload(DiveSite.ratings))
        .all()
    )
    centers = db.query(DivingCenter).all()
    routes = (
        db.query(DiveRoute)
        .filter(DiveRoute.deleted_at.is_(None))
        .options(joinedload(DiveRoute.dive_site), joinedload(DiveRoute.route_type))
        .all()
    )

    count = 0

    def write_page(relative_path: str, **kwargs) -> None:
        nonlocal count
        _write_html_file(html_root, relative_path, render_seo_page(template_html, **kwargs))
        count += 1

    site_links: list[tuple[str, str]] = []
    for site in sites:
        slug = get_dive_site_slug(site)
        path = f"/dive-sites/{site.id}/{slug}" if slug else f"/dive-sites/{site.id}"
        site_links.append((site.name, path))

        avg, total = _site_rating_stats(site)
        location_parts = [site.region, site.country]
        location_suffix = ", ".join(filter(None, location_parts))
        page_title = f"Divemap - {site.name}"
        if location_suffix:
            page_title += f" - {location_suffix}"

        rel_path = f"dive-sites/{site.id}/{slug}.html" if slug else f"dive-sites/{site.id}.html"
        write_page(
            rel_path,
            title=page_title,
            description=dive_site_meta_description(site, avg, total),
            canonical=f"{base_url}{path}",
            main_content=render_dive_site_main(site, avg, total),
            og_type="website",
            json_ld=dive_site_schema(base_url, path, site, avg, total),
        )

    center_links: list[tuple[str, str]] = []
    for center in centers:
        slug = get_diving_center_slug(center)
        path = f"/diving-centers/{center.id}/{slug}" if slug else f"/diving-centers/{center.id}"
        center_links.append((center.name, path))

        location_parts = [center.city or center.region, center.country]
        location_suffix = ", ".join(filter(None, location_parts))
        page_title = f"Divemap - {center.name}"
        if location_suffix:
            page_title += f" - {location_suffix}"

        rel_path = f"diving-centers/{center.id}/{slug}.html" if slug else f"diving-centers/{center.id}.html"
        write_page(
            rel_path,
            title=page_title,
            description=diving_center_meta_description(center),
            canonical=f"{base_url}{path}",
            main_content=render_diving_center_main(center),
            og_type="website",
            json_ld=diving_center_schema(base_url, path, center),
        )

    route_links: list[tuple[str, str]] = []
    for route in routes:
        slug = slugify(route.name)
        path = f"/dive-routes/{route.id}/{slug}" if slug else f"/dive-routes/{route.id}"
        route_links.append((route.name, path))

        rel_path = f"dive-routes/{route.id}/{slug}.html" if slug else f"dive-routes/{route.id}.html"
        write_page(
            rel_path,
            title=f"Divemap - {route.name}",
            description=dive_route_meta_description(route),
            canonical=f"{base_url}{path}",
            main_content=render_dive_route_main(route, get_dive_site_slug=get_dive_site_slug),
            og_type="website",
            json_ld=dive_route_schema(base_url, path, route),
        )

    write_page(
        "index.html",
        title="Divemap - Discover and Rate Scuba Dive Sites Worldwide",
        description=(
            "The ultimate scuba diving platform. Discover and rate dive sites, log your dives, "
            "plan trips, share underwater routes, and connect with the global diving community."
        ),
        canonical=f"{base_url}/",
        main_content=render_homepage_main(site_links),
    )

    write_page(
        "dive-sites/index.html",
        title="Divemap - Dive Sites",
        description="Browse scuba dive sites worldwide with depth profiles, difficulty ratings, and community reviews.",
        canonical=f"{base_url}/dive-sites",
        main_content=render_listing_main(
            "Dive Sites",
            "Comprehensive registry of dive sites including coordinates, depth profiles, difficulty, and marine life.",
            site_links,
        ),
    )

    write_page(
        "diving-centers/index.html",
        title="Divemap - Diving Centers",
        description="Find professional diving centers, schools, and shops around the world.",
        canonical=f"{base_url}/diving-centers",
        main_content=render_listing_main(
            "Diving Centers",
            "Directory of professional diving centers, schools, and shops.",
            center_links,
        ),
    )

    write_page(
        "dive-routes/index.html",
        title="Divemap - Dive Routes",
        description="Explore underwater navigation routes and paths shared by the Divemap community.",
        canonical=f"{base_url}/dive-routes",
        main_content=render_listing_main(
            "Dive Routes",
            "Underwater navigation paths and routes for dive sites.",
            route_links,
        ),
    )

    print(f"✅ Generated {count} static HTML files in {html_root}")
    return count
