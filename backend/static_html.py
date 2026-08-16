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


def format_depth(depth: Any) -> str:
    if depth is None:
        return ""
    try:
        val = float(depth)
        if val.is_integer():
            return str(int(val))
        return str(val)
    except (ValueError, TypeError):
        return str(depth)


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
        parts.append(f"Max depth: {format_depth(site.max_depth)}m.")
    if total_ratings > 0 and avg_rating is not None:
        parts.append(f"Rated {avg_rating:.1f}/10.")
        review_word = "review" if total_ratings == 1 else "reviews"
        parts.append(f"Read {total_ratings} {review_word} and see photos.")
    else:
        parts.append("Be the first to share your experience and photos!")
    if site.description:
        parts.append(truncate(strip_html_tags(site.description), 100))
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
        meta_bits.append(f"Max depth: {format_depth(site.max_depth)}m")
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
        """<section class="relative text-white overflow-hidden py-16 px-4 mb-12" style="background-color: rgb(0, 114, 178); border-radius: 1.5rem; margin-top: 1rem; position: relative;">
  <!-- Decorative background ocean pattern -->
  <div class="absolute inset-0 opacity-10" style="background-image: radial-gradient(circle at 20% 30%, rgba(255,255,255,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.1) 0%, transparent 50%); position: absolute; inset: 0;"></div>
  <div class="relative max-w-4xl mx-auto text-center" style="position: relative; max-width: 56rem; margin: 0 auto; text-align: center;">
    <h1 class="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 text-white" style="font-size: 3rem; font-weight: 800; line-height: 1.2; margin-bottom: 1.5rem;">
      Discover Amazing Dive Sites
    </h1>
    <p class="text-lg md:text-xl text-blue-100 mb-10 max-w-2xl mx-auto leading-relaxed" style="font-size: 1.125rem; color: #eff6ff; max-width: 42rem; margin: 0 auto 2.5rem auto; line-height: 1.625;">
      The ultimate scuba diving platform. Discover and rate dive sites, log your dives, plan trips, share underwater routes, and connect with the global diving community.
    </p>
    <div class="flex flex-wrap justify-center gap-4" style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
      <a href="/dive-sites" class="bg-white text-blue-700 font-semibold px-6 py-3 rounded-xl hover:bg-blue-50 transition-all shadow-md" style="background-color: white; color: rgb(0, 114, 178); padding: 0.75rem 1.5rem; border-radius: 0.75rem; font-weight: 600; text-decoration: none; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">Explore Dive Sites</a>
      <a href="/register" class="bg-blue-800/50 text-white border border-blue-400/30 font-semibold px-6 py-3 rounded-xl hover:bg-blue-800 transition-all" style="background-color: rgba(30, 58, 138, 0.4); color: white; padding: 0.75rem 1.5rem; border-radius: 0.75rem; font-weight: 600; border: 1px solid rgba(96, 165, 250, 0.3); text-decoration: none;">Join the Community</a>
    </div>
  </div>
</section>""",
        '<div class="max-w-[95vw] xl:max-w-[1600px] mx-auto px-0 sm:px-4 lg:px-6 xl:px-8">',
        '  <h2 class="text-2xl font-bold mb-8 text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-800 pb-4" style="font-size: 1.5rem; font-weight: 700; color: #0f172a; margin-bottom: 2rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.5rem;">Popular Dive Sites</h2>',
        '  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem;">',
    ]
    if featured_links:
        for label, href in featured_links[:20]:
            lines.append(f"""    <div class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between" style="border: 1px solid #e2e8f0; padding: 1.5rem; border-radius: 1rem; background-color: white; display: flex; flex-direction: column; justify-content: space-between; height: 160px; box-shadow: 0 1px 3px 0 rgba(0,0,0,0.05);">
      <div>
        <span class="text-xs font-semibold uppercase tracking-wider mb-2 block" style="font-size: 0.75rem; font-weight: 600; color: rgb(0, 114, 178); display: block; margin-bottom: 0.5rem;">DIVE SITE</span>
        <h3 class="text-lg font-bold mb-2" style="font-size: 1.125rem; font-weight: 700; margin-bottom: 0.5rem; color: #0f172a; line-height: 1.3;">
          <a href="{escape_text(href)}" class="text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400" style="color: #0f172a; text-decoration: none;">{escape_text(label)}</a>
        </h3>
      </div>
      <div class="flex items-center text-xs font-medium" style="color: rgb(0, 114, 178); font-size: 0.75rem; font-weight: 600; display: flex; align-items: center; gap: 0.25rem;">
        <span>View Details &rarr;</span>
      </div>
    </div>""")
    lines.append("  </div>")
    lines.append("</div>")
    return "\n".join(lines)


def _build_head_injection(
    *,
    title: str,
    description: str,
    canonical: str,
    base_url: Optional[str] = None,
    og_type: str = "website",
    json_ld: Optional[dict] = None,
    include_description: bool = True,
    image_url: Optional[str] = None,
) -> str:
    lines = []
    if include_description:
        lines.append(f'<meta name="description" content="{escape_text(description)}" data-rh="true" />')
    
    if not base_url and canonical.startswith(("http://", "https://")):
        match = re.match(r"(https?://[^/]+)", canonical)
        if match:
            base_url = match.group(1)
            
    resolved_base_url = base_url or ""
    logo_url = f"{resolved_base_url.rstrip('/')}/divemap_navbar_logo.png"

    lines.extend([
        f'<link rel="canonical" href="{escape_text(canonical)}" data-rh="true" />',
        '<meta name="robots" content="index, follow, max-image-preview:large" data-rh="true" />',
        f'<meta property="og:locale" content="en_US" data-rh="true" />',
        f'<meta property="og:site_name" content="Divemap" data-rh="true" />',
        f'<meta property="og:type" content="{escape_text(og_type)}" data-rh="true" />',
        f'<meta property="og:title" content="{escape_text(title)}" data-rh="true" />',
        f'<meta property="og:description" content="{escape_text(description)}" data-rh="true" />',
        f'<meta property="og:url" content="{escape_text(canonical)}" data-rh="true" />',
    ])

    if image_url:
        lines.extend([
            f'<meta property="og:image" content="{escape_text(image_url)}" data-rh="true" />',
            f'<meta property="og:image:secure_url" content="{escape_text(image_url)}" data-rh="true" />',
            f'<meta name="twitter:image" content="{escape_text(image_url)}" data-rh="true" />',
            f'<meta name="twitter:card" content="summary_large_image" data-rh="true" />',
        ])
    else:
        lines.extend([
            f'<meta property="og:image" content="{escape_text(logo_url)}" data-rh="true" />',
            f'<meta property="og:image:secure_url" content="{escape_text(logo_url)}" data-rh="true" />',
            f'<meta name="twitter:image" content="{escape_text(logo_url)}" data-rh="true" />',
            f'<meta name="twitter:card" content="summary" data-rh="true" />',
        ])

    lines.extend([
        f'<meta name="twitter:title" content="{escape_text(title)}" data-rh="true" />',
        f'<meta name="twitter:description" content="{escape_text(description)}" data-rh="true" />',
    ])

    if json_ld:
        ld_json = json.dumps(json_ld, ensure_ascii=False)
        ld_json = ld_json.replace("</", "<\\/")
        lines.append(f'<script type="application/ld+json" data-rh="true">{ld_json}</script>')
    return "\n    ".join(lines)


def render_seo_page(
    template_html: Optional[str],
    *,
    title: str,
    description: str,
    canonical: str,
    main_content: str,
    base_url: Optional[str] = None,
    og_type: str = "website",
    json_ld: Optional[dict] = None,
    image_url: Optional[str] = None,
) -> str:
    # Disable duplicate description injection since we replace the default meta description in the template below!
    head_injection = _build_head_injection(
        title=title,
        description=description,
        canonical=canonical,
        base_url=base_url,
        og_type=og_type,
        json_ld=json_ld,
        include_description=False,
        image_url=image_url,
    )

    # Gorgeous navigation header matching the real app's fixed top navbar precisely
    navbar_html = """<nav class="text-white shadow-lg fixed top-0 left-0 right-0 z-[60]" style="background-color: rgb(0, 114, 178); height: 4rem; width: 100%; font-family: system-ui, -apple-system, sans-serif;">
  <div class="container mx-auto px-4 relative z-20" style="max-width: 80rem; margin: 0 auto; padding: 0 1rem;">
    <div class="flex justify-between items-center h-16" style="display: flex; justify-content: space-between; align-items: center; height: 4rem;">
      <a class="flex items-center space-x-2" href="/" style="display: flex; align-items: center; gap: 0.5rem; text-decoration: none; color: white;">
        <img src="/divemap_navbar_logo.png" alt="Divemap Logo" class="h-10 w-10 drop-shadow-sm" style="height: 2.5rem; width: 2.5rem;">
        <span class="font-bold text-lg text-white" style="font-weight: 700; font-size: 1.125rem;">Divemap</span>
      </a>
      
      <!-- Search Combobox Mock (Middle) -->
      <div class="hidden md:flex flex-1 max-w-xl mx-6" style="display: flex; flex: 1; max-width: 36rem; margin: 0 1.5rem;">
        <div class="flex h-10 w-full items-center rounded-md border bg-white px-3 py-2 text-sm border-gray-300" style="display: flex; align-items: center; background-color: white; width: 100%; height: 2.5rem; padding: 0.5rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem;">
          <span class="text-gray-500 truncate" style="color: #6b7280; font-size: 0.875rem;">Search dives, sites, centers...</span>
        </div>
      </div>
      
      <!-- Right Nav Links -->
      <div class="flex items-center space-x-6" style="display: flex; align-items: center; gap: 1.5rem;">
        <a class="hidden sm:flex items-center space-x-1 text-white hover:text-blue-200 transition-colors text-sm" href="/" style="color: white; text-decoration: none; font-size: 0.875rem; display: flex; align-items: center; gap: 0.25rem;">
          <span>Home</span>
        </a>
        <a class="hidden sm:flex items-center space-x-1 text-white hover:text-blue-200 transition-colors text-sm" href="/map" style="color: white; text-decoration: none; font-size: 0.875rem; display: flex; align-items: center; gap: 0.25rem;">
          <span>Map</span>
        </a>
        <a class="hidden sm:flex items-center space-x-1 text-white hover:text-blue-200 transition-colors text-sm" href="/dive-sites" style="color: white; text-decoration: none; font-size: 0.875rem; display: flex; align-items: center; gap: 0.25rem;">
          <span>Dive Sites</span>
        </a>
        <div class="flex items-center space-x-4" style="display: flex; align-items: center; gap: 1rem;">
          <a class="inline-flex items-center justify-center font-medium rounded-md transition-colors px-4 py-2 text-sm bg-blue-700 hover:bg-blue-800 text-white border border-blue-400" href="/login" style="background-color: #1d4ed8; color: white; border: 1px solid #60a5fa; padding: 0.5rem 1rem; border-radius: 0.375rem; font-size: 0.875rem; font-weight: 500; text-decoration: none;">Login</a>
          <a class="inline-flex items-center justify-center font-medium rounded-md transition-colors px-4 py-2 text-sm bg-white border border-blue-600 text-blue-600" href="/register" style="background-color: white; color: rgb(0, 114, 178); border: 1px solid rgb(0, 114, 178); padding: 0.5rem 1rem; border-radius: 0.375rem; font-size: 0.875rem; font-weight: 500; text-decoration: none;">Register</a>
        </div>
      </div>
    </div>
  </div>
</nav>"""

    # Determine if this is the Homepage to apply the full-width layout
    # Home canonical is '/' or ends with port, check title or canonical
    is_homepage = "Discover and Rate" in title or canonical.rstrip("/").split("/")[-1] == "" or canonical.rstrip("/") == "https://divemap.blue"

    if is_homepage:
        styled_content = f"""{navbar_html}
<div class="min-h-screen bg-slate-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 pb-20 pt-16" style="background-color: #f8fafc; min-height: 100vh; padding-top: 4rem; padding-bottom: 5rem;">
  <div class="prose-custom">
    {main_content}
  </div>
</div>"""
    else:
        styled_content = f"""{navbar_html}
<div class="min-h-screen bg-slate-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 pb-20 pt-16" style="background-color: #f8fafc; min-height: 100vh; padding-top: 4rem; padding-bottom: 5rem;">
  <div class="max-w-[95vw] xl:max-w-[1600px] mx-auto px-0 sm:px-4 lg:px-6 xl:px-8 pt-8" style="max-width: 80rem; margin: 0 auto; padding: 2rem 1rem 0 1rem;">
    <div class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 md:p-10 shadow-sm" style="background-color: white; border: 1px solid #e2e8f0; border-radius: 1rem; padding: 2.5rem; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);">
      <div class="prose-custom">
        {main_content}
      </div>
    </div>
  </div>
</div>"""

    # Custom CSS overrides to bypass Tailwind Preflight CSS Reset defaults for crawlers/human preload state
    seo_custom_styles = """
    <style>
      .prose-custom h1 { font-size: 2.25rem; font-weight: 800; color: #0f172a; margin-bottom: 1.5rem; line-height: 1.25; font-family: system-ui, -apple-system, sans-serif; }
      .dark .prose-custom h1 { color: #60a5fa; }
      .prose-custom h2 { font-size: 1.5rem; font-weight: 700; color: #0f172a; margin-top: 2.5rem; margin-bottom: 1.25rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.5rem; font-family: system-ui, -apple-system, sans-serif; }
      .dark .prose-custom h2 { color: #f8fafc; border-color: #1e293b; }
      .prose-custom p { margin-bottom: 1.25rem; line-height: 1.625; color: #334155; font-size: 1rem; font-family: system-ui, -apple-system, sans-serif; }
      .dark .prose-custom p { color: #94a3b8; }
      .prose-custom strong { font-weight: 600; color: #0f172a; }
      .dark .prose-custom strong { color: #f1f5f9; }
      .prose-custom a { color: rgb(0, 114, 178); font-weight: 500; text-decoration: none; transition: color 0.15s; }
      .prose-custom a:hover { color: #1d4ed8; text-decoration: underline; }
      .dark .prose-custom a { color: #60a5fa; }
      .dark .prose-custom a:hover { color: #93c5fd; }
      
      .prose-custom nav[aria-label="Breadcrumb"] { font-size: 0.875rem; margin-bottom: 1.5rem; color: #64748b; font-weight: 500; font-family: system-ui, -apple-system, sans-serif; }
      .prose-custom nav[aria-label="Breadcrumb"] a { color: #64748b; text-decoration: none; }
      .prose-custom nav[aria-label="Breadcrumb"] a:hover { color: rgb(0, 114, 178); text-decoration: underline; }
      .dark .prose-custom nav[aria-label="Breadcrumb"] a { color: #94a3b8; }
      
      .prose-custom nav[aria-label="Related pages"] { margin-top: 2.5rem; padding-top: 1.5rem; border-top: 1px solid #e2e8f0; font-size: 0.875rem; }
      .dark .prose-custom nav[aria-label="Related pages"] { border-color: #1e293b; }
      
      .prose-custom ul { list-style-type: none; padding-left: 0; margin-top: 1rem; margin-bottom: 1rem; }
      .prose-custom li { padding: 0.875rem 1.25rem; margin-bottom: 0.75rem; border-radius: 0.75rem; background-color: #f8fafc; border: 1px solid #e2e8f0; transition: all 0.15s; font-family: system-ui, -apple-system, sans-serif; }
      .dark .prose-custom li { background-color: #0f172a; border-color: #1e293b; }
      .prose-custom li:hover { background-color: #eff6ff; border-color: #bfdbfe; }
      .dark .prose-custom li:hover { background-color: #1e3a8a; border-color: #3b82f6; }
      .prose-custom li a { display: block; width: 100%; font-size: 1rem; font-weight: 600; text-decoration: none; }
    </style>
    """

    head_injection = f"{head_injection}\n    {seo_custom_styles}"

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
            rf"\1\n{styled_content}\n      \2",
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
  {head_injection}
</head>
<body>
  <div id="root">
    {styled_content}
  </div>
</body>
</html>"""


