import logging
import os
import re
import sys
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse
import httpx
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Dive, DiveRoute, DiveSite, DivingCenter, DivingOrganization, User
from generate_static_content import get_dive_site_slug, get_diving_center_slug, slugify
from static_html import (
    _site_rating_stats,
    dive_route_meta_description,
    dive_route_schema,
    dive_site_meta_description,
    dive_site_schema,
    diving_center_meta_description,
    diving_center_schema,
    render_dive_route_main,
    render_dive_site_main,
    render_diving_center_main,
    render_homepage_main,
    render_listing_main,
    render_seo_page,
    resolve_html_template,
    escape_text,
)

logger = logging.getLogger("divemap.seo")

router = APIRouter()

# Global in-memory cache for SPA index.html template
_spa_template_cache: Optional[str] = None


async def get_spa_template() -> Optional[str]:
    """
    Fetch the SPA built index.html shell to inject pre-rendered content.
    Caches the template in-memory. Fetches from nginx or frontend dev servers,
    or falls back to disk files. Returns None if all sources fail.
    """
    global _spa_template_cache
    if _spa_template_cache is not None:
        return _spa_template_cache

    urls = [
        "http://nginx/index.html",
        "http://frontend:3000/",
    ]

    async with httpx.AsyncClient() as client:
        for url in urls:
            try:
                # Set Host: localhost header to bypass Vite's internal Host Validation
                response = await client.get(url, timeout=1.5, headers={"Host": "localhost"})
                if response.status_code == 200 and response.text:
                    logger.info(f"Successfully fetched SPA template from {url}")
                    _spa_template_cache = response.text
                    return _spa_template_cache
            except Exception as e:
                logger.debug(f"Failed to fetch SPA template from {url}: {e}")

    # Local disk fallbacks
    template_path = resolve_html_template()
    if template_path and os.path.isfile(template_path):
        try:
            with open(template_path, "r", encoding="utf-8") as f:
                _spa_template_cache = f.read()
            logger.info(f"Successfully read SPA template from disk: {template_path}")
            return _spa_template_cache
        except Exception as e:
            logger.error(f"Failed to read SPA template from {template_path}: {e}")

    logger.warning("No SPA template could be loaded. Falling back to clean semantic-only HTML response.")
    return None


@router.get("/html/{path:path}", response_class=HTMLResponse)
async def get_prerendered_page(request: Request, path: str, db: Session = Depends(get_db)):
    """
    Dynamic server-side pre-rendering endpoint. Intercepts public crawler/human GET paths,
    populates meta/JSON-LD/content elements, and returns them in the SPA index.html wrapper.
    """
    # Build dynamic canonical base URL from request Host with validation (prevent Host Injection)
    host = request.headers.get("host", "divemap.blue")
    proto = request.headers.get("x-forwarded-proto", "https")

    allowed_dev_hosts = {"localhost", "127.0.0.1", "nginx", "frontend", "testserver"}
    host_name = host.split(":")[0].lower()  # Strip port if present

    if host_name in allowed_dev_hosts:
        base_url = f"{proto}://{host}"
    elif "divemap.gr" in host_name:
        base_url = "https://divemap.gr"
    else:
        base_url = "https://divemap.blue"

    base_url = base_url.rstrip("/")

    # Parse path elements
    clean_path = path.strip("/")
    parts = [p for p in clean_path.split("/") if p]

    page_title = "Divemap - Discover and Rate Scuba Dive Sites Worldwide"
    description = (
        "The ultimate scuba diving platform. Discover and rate dive sites, log your dives, "
        "plan trips, share underwater routes, and connect with the global diving community."
    )
    canonical = f"{base_url}/"
    main_content = ""
    json_ld: Optional[dict] = None

    # Routing
    try:
        if not parts:
            # Home page: Fetch top 20 approved dive sites for popular listings
            sites = (
                db.query(DiveSite)
                .filter(DiveSite.status == "approved", DiveSite.deleted_at.is_(None))
                .limit(20)
                .all()
            )
            site_links = []
            for s in sites:
                slug = get_dive_site_slug(s)
                link_path = f"/dive-sites/{s.id}/{slug}" if slug else f"/dive-sites/{s.id}"
                site_links.append((s.name, link_path))

            page_title = "Divemap - Discover and Rate Scuba Dive Sites Worldwide"
            canonical = f"{base_url}/"
            main_content = render_homepage_main(site_links)

        elif parts[0] == "dive-sites":
            if len(parts) == 1:
                # Dive Sites Directory Listing
                sites = (
                    db.query(DiveSite)
                    .filter(DiveSite.status == "approved", DiveSite.deleted_at.is_(None))
                    .limit(100)
                    .all()
                )
                site_links = []
                for s in sites:
                    slug = get_dive_site_slug(s)
                    link_path = f"/dive-sites/{s.id}/{slug}" if slug else f"/dive-sites/{s.id}"
                    site_links.append((s.name, link_path))

                page_title = "Divemap - Dive Sites"
                description = "Browse scuba dive sites worldwide with depth profiles, difficulty ratings, and community reviews."
                canonical = f"{base_url}/dive-sites"
                main_content = render_listing_main(
                    "Dive Sites",
                    "Comprehensive registry of dive sites including coordinates, depth profiles, difficulty, and marine life.",
                    site_links,
                )
            else:
                # Dive Site Detail
                try:
                    site_id_str = re.sub(r"\D", "", parts[1])
                    site_id = int(site_id_str)
                except ValueError:
                    raise HTTPException(status_code=404, detail="Invalid Dive Site ID")

                site = (
                    db.query(DiveSite)
                    .filter(DiveSite.id == site_id, DiveSite.status == "approved", DiveSite.deleted_at.is_(None))
                    .options(joinedload(DiveSite.difficulty), joinedload(DiveSite.ratings))
                    .first()
                )
                if not site:
                    raise HTTPException(status_code=404, detail="Dive Site not found")

                slug = get_dive_site_slug(site)
                # Check for mismatched/missing slug and return 301 Redirect for canonicalization
                requested_slug = parts[2] if len(parts) >= 3 else ""
                if requested_slug != slug:
                    redirect_path = f"/dive-sites/{site.id}/{slug}" if slug else f"/dive-sites/{site.id}"
                    return RedirectResponse(url=f"{base_url}{redirect_path}", status_code=301)

                detail_path = f"/dive-sites/{site.id}/{slug}" if slug else f"/dive-sites/{site.id}"
                avg, total = _site_rating_stats(site)
                location_parts = [site.region, site.country]
                location_suffix = ", ".join(filter(None, location_parts))
                page_title = f"Divemap - {site.name}"
                if location_suffix:
                    page_title += f" - {location_suffix}"

                main_content = render_dive_site_main(site, avg, total)
                description = dive_site_meta_description(site, avg, total)
                json_ld = dive_site_schema(base_url, detail_path, site, avg, total)
                canonical = f"{base_url}{detail_path}"

        elif parts[0] == "diving-centers":
            if len(parts) == 1:
                # Diving Centers Listing
                centers = db.query(DivingCenter).limit(100).all()
                center_links = []
                for c in centers:
                    slug = get_diving_center_slug(c)
                    link_path = f"/diving-centers/{c.id}/{slug}" if slug else f"/diving-centers/{c.id}"
                    center_links.append((c.name, link_path))

                page_title = "Divemap - Diving Centers"
                description = "Find professional diving centers, schools, and shops around the world."
                canonical = f"{base_url}/diving-centers"
                main_content = render_listing_main(
                    "Diving Centers",
                    "Directory of professional diving centers, schools, and shops.",
                    center_links,
                )
            else:
                # Diving Center Detail
                try:
                    center_id_str = re.sub(r"\D", "", parts[1])
                    center_id = int(center_id_str)
                except ValueError:
                    raise HTTPException(status_code=404, detail="Invalid Diving Center ID")

                center = db.query(DivingCenter).filter(DivingCenter.id == center_id).first()
                if not center:
                    raise HTTPException(status_code=404, detail="Diving Center not found")

                slug = get_diving_center_slug(center)
                # Check for mismatched/missing slug and return 301 Redirect for canonicalization
                requested_slug = parts[2] if len(parts) >= 3 else ""
                if requested_slug != slug:
                    redirect_path = f"/diving-centers/{center.id}/{slug}" if slug else f"/diving-centers/{center.id}"
                    return RedirectResponse(url=f"{base_url}{redirect_path}", status_code=301)

                detail_path = f"/diving-centers/{center.id}/{slug}" if slug else f"/diving-centers/{center.id}"
                location_parts = [center.city or center.region, center.country]
                location_suffix = ", ".join(filter(None, location_parts))
                page_title = f"Divemap - {center.name}"
                if location_suffix:
                    page_title += f" - {location_suffix}"

                main_content = render_diving_center_main(center)
                description = diving_center_meta_description(center)
                json_ld = diving_center_schema(base_url, detail_path, center)
                canonical = f"{base_url}{detail_path}"

        elif parts[0] == "dive-routes":
            if len(parts) == 1:
                # Dive Routes Listing
                routes = (
                    db.query(DiveRoute)
                    .filter(DiveRoute.deleted_at.is_(None))
                    .options(joinedload(DiveRoute.dive_site))
                    .limit(100)
                    .all()
                )
                route_links = []
                for r in routes:
                    slug = slugify(r.name)
                    link_path = f"/dive-routes/{r.id}/{slug}" if slug else f"/dive-routes/{r.id}"
                    route_links.append((r.name, link_path))

                page_title = "Divemap - Dive Routes"
                description = "Explore underwater navigation routes and paths shared by the Divemap community."
                canonical = f"{base_url}/dive-routes"
                main_content = render_listing_main(
                    "Dive Routes",
                    "Underwater navigation paths and routes for dive sites.",
                    route_links,
                )
            else:
                # Dive Route Detail
                try:
                    route_id_str = re.sub(r"\D", "", parts[1])
                    route_id = int(route_id_str)
                except ValueError:
                    raise HTTPException(status_code=404, detail="Invalid Dive Route ID")

                route = (
                    db.query(DiveRoute)
                    .filter(DiveRoute.id == route_id, DiveRoute.deleted_at.is_(None))
                    .options(joinedload(DiveRoute.dive_site))
                    .first()
                )
                if not route:
                    raise HTTPException(status_code=404, detail="Dive Route not found")

                slug = slugify(route.name)
                # Check for mismatched/missing slug and return 301 Redirect for canonicalization
                requested_slug = parts[2] if len(parts) >= 3 else ""
                if requested_slug != slug:
                    redirect_path = f"/dive-routes/{route.id}/{slug}" if slug else f"/dive-routes/{route.id}"
                    return RedirectResponse(url=f"{base_url}{redirect_path}", status_code=301)

                detail_path = f"/dive-routes/{route.id}/{slug}" if slug else f"/dive-routes/{route.id}"
                page_title = f"Divemap - {route.name}"

                main_content = render_dive_route_main(route, get_dive_site_slug=get_dive_site_slug)
                description = dive_route_meta_description(route)
                json_ld = dive_route_schema(base_url, detail_path, route)
                canonical = f"{base_url}{detail_path}"

        elif parts[0] == "dives":
            if len(parts) == 1:
                # Public Dives Directory Listing
                dives = (
                    db.query(Dive)
                    .filter(Dive.is_private == False)
                    .options(joinedload(Dive.user), joinedload(Dive.dive_site))
                    .order_by(Dive.id.desc())
                    .limit(100)
                    .all()
                )
                dive_links = []
                for d in dives:
                    diver = d.user.username if d.user else "Diver"
                    site_name = d.dive_site.name if d.dive_site else "Unknown Site"
                    label = f"{diver}'s dive at {site_name}"
                    slug = slugify(d.name or f"dive-by-{diver}")
                    link_path = f"/dives/{d.id}/{slug}" if slug else f"/dives/{d.id}"
                    dive_links.append((label, link_path))

                page_title = "Divemap - Public Dives"
                description = "Browse public scuba diving logs, profiles, and dive activities shared by the Divemap community."
                canonical = f"{base_url}/dives"
                main_content = render_listing_main(
                    "Public Dives",
                    "Explore recent diving activities and public logbooks shared by the community.",
                    dive_links,
                )
            else:
                # Public Dive Detail
                try:
                    dive_id_str = re.sub(r"\D", "", parts[1])
                    dive_id = int(dive_id_str)
                except ValueError:
                    raise HTTPException(status_code=404, detail="Invalid Dive ID")

                dive = (
                    db.query(Dive)
                    .filter(Dive.id == dive_id, Dive.is_private == False)
                    .options(joinedload(Dive.user), joinedload(Dive.dive_site))
                    .first()
                )
                if not dive:
                    raise HTTPException(status_code=404, detail="Dive not found")

                diver = dive.user.username if dive.user else "Diver"
                site_name = dive.dive_site.name if dive.dive_site else "Unknown Site"
                page_title = f"Divemap - {diver}'s dive at {site_name}"
                description = f"Read the log details of {diver}'s dive at {site_name}. Max depth: {dive.max_depth or 'unknown'}m, bottom time: {dive.duration or 'unknown'} mins."

                slug = slugify(dive.name or f"dive-by-{diver}")
                # Check for mismatched/missing slug and return 301 Redirect for canonicalization
                requested_slug = parts[2] if len(parts) >= 3 else ""
                if requested_slug != slug:
                    redirect_path = f"/dives/{dive.id}/{slug}" if slug else f"/dives/{dive.id}"
                    return RedirectResponse(url=f"{base_url}{redirect_path}", status_code=301)

                detail_path = f"/dives/{dive.id}/{slug}" if slug else f"/dives/{dive.id}"

                main_content = f"""<main class="seo-prerender">
                    <nav class="breadcrumbs">
                        <a href="/">Home</a> &rsaquo; 
                        <a href="/dives">Dives</a> &rsaquo; 
                        <span>{escape_text(diver)}'s Log</span>
                    </nav>
                    <h1>{escape_text(diver)}'s dive at {escape_text(site_name)}</h1>
                    <p><strong>Title:</strong> {escape_text(dive.name or 'Unnamed Dive')}</p>
                    <p><strong>Diver:</strong> <a href="/users/{escape_text(diver)}">{escape_text(diver)}</a></p>
                    <p><strong>Dive Site:</strong> {escape_text(site_name)}</p>
                    <p><strong>Max Depth:</strong> {dive.max_depth or 'Unknown'} m</p>
                    <p><strong>Duration:</strong> {dive.duration or 'Unknown'} mins</p>
                    <p><strong>Notes:</strong> {escape_text(dive.dive_information or 'No notes provided.')}</p>
                </main>"""
                canonical = f"{base_url}{detail_path}"

        elif parts[0] == "users":
            if len(parts) >= 2:
                username = parts[1]
                # Validate username structure (alphanumeric, underscores, hyphens only) to prevent malicious URL parsing
                if not re.match(r"^[a-zA-Z0-9_\-]+$", username):
                    raise HTTPException(status_code=404, detail="Invalid username format")

                user = db.query(User).filter(User.username == username).first()
                if not user:
                    raise HTTPException(status_code=404, detail="User not found")

                # Securely escape usernames and other user-controlled variables
                escaped_user = escape_text(user.username)

                if len(parts) == 2:
                    # User profile page
                    page_title = f"Divemap - User {escaped_user}"
                    description = f"View {escaped_user}'s public diving profile, contributions, and community stats on Divemap."
                    main_content = f"""<main class="seo-prerender">
                        <h1>Diver Profile: {escaped_user}</h1>
                        <p>Join {escaped_user} and the rest of the global scuba diving community on Divemap to rate dive sites and log dives.</p>
                        <nav>
                            <a href="/users/{escaped_user}/analytics">Analytics Dashboard</a> · 
                            <a href="/dive-sites">Browse Dive Sites</a>
                        </nav>
                    </main>"""
                    canonical = f"{base_url}/users/{escaped_user}"

                elif len(parts) == 3 and parts[2] == "analytics":
                    # User analytics
                    page_title = f"Divemap - {escaped_user}'s Diving Analytics"
                    description = f"Explore public diving metrics, depth distributions, and gas analytics for {escaped_user}."
                    main_content = f"""<main class="seo-prerender">
                        <h1>Diving Analytics: {escaped_user}</h1>
                        <p>Advanced statistical depth and gas calculations for diver {escaped_user}.</p>
                        <nav>
                            <a href="/users/{escaped_user}">Back to Profile</a>
                        </nav>
                    </main>"""
                    canonical = f"{base_url}/users/{escaped_user}/analytics"

                elif len(parts) >= 4 and parts[2] == "lists":
                    list_id_str = parts[3]
                    try:
                        list_id = int(list_id_str)
                    except ValueError:
                        raise HTTPException(status_code=404, detail="Invalid List ID")

                    page_title = f"Divemap - {escaped_user}'s Dive Site List"
                    description = f"Browse the custom dive site collection curated by {escaped_user} on Divemap."
                    main_content = f"""<main class="seo-prerender">
                        <h1>Custom Dive Site Collection</h1>
                        <p>A curated collection of scuba diving locations compiled by user {escaped_user}.</p>
                        <nav>
                            <a href="/users/{escaped_user}">Back to Profile</a> · 
                            <a href="/dive-sites">Browse All Sites</a>
                        </nav>
                    </main>"""
                    canonical = f"{base_url}/users/{escaped_user}/lists/{list_id}"
                else:
                    raise HTTPException(status_code=404, detail="Page not found")
            else:
                raise HTTPException(status_code=404, detail="Page not found")

        elif parts[0] == "resources":
            if len(parts) == 1:
                page_title = "Divemap - Resources"
                description = "Access helpful diving resources, organizations, and planning tools."
                main_content = """<main class="seo-prerender">
                    <h1>Diving Resources</h1>
                    <p>Explore our compiled databases of global diving organizations, system tags, and digital planning calculators.</p>
                    <ul>
                        <li><a href="/resources/tags">Diving Tags</a></li>
                        <li><a href="/resources/diving-organizations">Diving Organizations</a></li>
                        <li><a href="/resources/tools/mod">Max Depth (MOD) Planning Calculator</a></li>
                        <li><a href="/resources/tools/bestmix">Nitrox Best Mix Planning Calculator</a></li>
                    </ul>
                </main>"""
                canonical = f"{base_url}/resources"

            elif parts[1] == "tags":
                page_title = "Divemap - Diving Tags"
                description = "Browse official community tags used to categorize dive sites and marine life."
                main_content = """<main class="seo-prerender">
                    <h1>Diving Tags</h1>
                    <p>System-wide taxonomy for categorizing dive sites based on attributes, access difficulty, and marine life characteristics.</p>
                    <nav>
                        <a href="/resources">Back to Resources</a>
                    </nav>
                </main>"""
                canonical = f"{base_url}/resources/tags"

            elif parts[1] == "diving-organizations":
                orgs = db.query(DivingOrganization).all()
                org_links = []
                for o in orgs:
                    org_links.append((o.name, f"/resources/diving-organizations#{slugify(o.name)}"))

                page_title = "Divemap - Diving Organizations"
                description = "Directory of international scuba diving training organizations and certification bodies."
                main_content = render_listing_main(
                    "Diving Organizations",
                    "Directory of international scuba diving training and certification agencies.",
                    org_links,
                )
                canonical = f"{base_url}/resources/diving-organizations"

            elif parts[1] == "tools" and len(parts) >= 3:
                tool_id = parts[2]
                page_title = f"Divemap - Scuba Calculator: {tool_id.upper()}"
                description = f"Interactive dive planning calculator for {tool_id.upper()} calculations."
                main_content = f"""<main class="seo-prerender">
                    <h1>Scuba Calculator: {tool_id.upper()}</h1>
                    <p>Digital planning tool for estimating diving limits, depths, and gas mixtures.</p>
                    <nav>
                        <a href="/resources">Back to Resources</a>
                    </nav>
                </main>"""
                canonical = f"{base_url}/resources/tools/{tool_id}"
            else:
                raise HTTPException(status_code=404, detail="Page not found")

        elif parts[0] in ("about", "help", "privacy"):
            # Static Pages
            page_name = parts[0].capitalize()
            page_title = f"Divemap - {page_name}"
            canonical = f"{base_url}/{parts[0]}"

            if parts[0] == "about":
                description = "About Divemap — the ultimate scuba diving platform to discover, rate, and share dive sites."
                main_content = """<main class="seo-prerender">
                    <h1>About Divemap</h1>
                    <p>Divemap is a comprehensive, community-driven platform for scuba divers worldwide.</p>
                    <p>Our mission is to map every dive site, diving center, and underwater path across the globe, allowing divers of all levels to safely explore, rate, and log their underwater adventures.</p>
                </main>"""
            elif parts[0] == "help":
                description = "Help and Support for Divemap — FAQs, tutorials, and community guides."
                main_content = """<main class="seo-prerender">
                    <h1>Help & Support</h1>
                    <p>Need assistance with your Divemap account or logging a dive?</p>
                    <p>Browse our frequently asked questions, user guides, and tutorials, or contact our support team directly.</p>
                </main>"""
            elif parts[0] == "privacy":
                description = "Privacy Policy for Divemap — how we protect and handle your personal data."
                main_content = """<main class="seo-prerender">
                    <h1>Privacy Policy</h1>
                    <p>Your privacy is of utmost importance to us.</p>
                    <p>We only collect data necessary to provide a safe, interactive community experience. We protect your logs and personal details in accordance with general data protection regulations.</p>
                </main>"""
        else:
            # Fallback 404 for unhandled paths
            raise HTTPException(status_code=404, detail="Page not found")

    except HTTPException as he:
        # Custom crawler-friendly 404 response
        page_title = "404 - Page Not Found"
        description = "The page you are looking for does not exist on Divemap."
        main_content = """<main class="seo-prerender">
            <h1>404 - Page Not Found</h1>
            <p>Sorry, the page you are looking for does not exist or has been moved.</p>
            <nav>
                <a href="/">Go to Homepage</a> · 
                <a href="/dive-sites">Browse Dive Sites</a> · 
                <a href="/diving-centers">Browse Diving Centers</a>
            </nav>
        </main>"""
        canonical = f"{base_url}/{clean_path}"

        template_html = await get_spa_template()
        html = render_seo_page(
            template_html,
            title=page_title,
            description=description,
            canonical=canonical,
            main_content=main_content,
        )
        return HTMLResponse(content=html, status_code=he.status_code, headers={"X-Prerendered": "404"})

    template_html = await get_spa_template()
    html = render_seo_page(
        template_html,
        title=page_title,
        description=description,
        canonical=canonical,
        main_content=main_content,
        og_type="website",
        json_ld=json_ld,
    )

    return HTMLResponse(
        content=html,
        status_code=200,
        headers={
            "X-Prerendered": "1",
            "Cache-Control": "public, max-age=600, stale-while-revalidate=1200",
        },
    )
