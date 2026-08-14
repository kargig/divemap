import json
import os
import sys

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from static_html import (
    dive_site_meta_description,
    render_dive_site_main,
    render_homepage_main,
    render_listing_main,
    render_seo_page,
    strip_html_tags,
)

SPA_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Generic Title</title>
    <meta name="description" content="Generic description" data-rh="true" />
  </head>
  <body>
    <noscript>Enable JS</noscript>
    <div id="root">
      <div class="initial-loading">Loading...</div>
    </div>
    <script type="module" src="/assets/index-abc123.js"></script>
  </body>
</html>
"""


class MockDifficulty:
    label = "Open Water"


class MockRating:
    def __init__(self, score):
        self.score = score


class MockSite:
    def __init__(self, **kwargs):
        self.name = kwargs.get("name", "Agia Anna")
        self.country = kwargs.get("country", "Greece")
        self.region = kwargs.get("region", "Naxos")
        self.description = kwargs.get("description", "A beautiful shore dive.")
        self.max_depth = kwargs.get("max_depth", 18)
        self.latitude = kwargs.get("latitude", 37.0)
        self.longitude = kwargs.get("longitude", 25.0)
        self.marine_life = kwargs.get("marine_life")
        self.access_instructions = kwargs.get("access_instructions")
        self.safety_information = kwargs.get("safety_information")
        self.difficulty = kwargs.get("difficulty", MockDifficulty())
        self.ratings = kwargs.get("ratings", [MockRating(9), MockRating(8)])


def test_strip_html_tags():
    assert strip_html_tags("<p>Hello <strong>world</strong></p>") == "Hello world"


def test_dive_site_meta_description_with_reviews():
    site = MockSite()
    desc = dive_site_meta_description(site, 8.5, 2)
    assert "Agia Anna" in desc
    assert "Open Water" in desc
    assert "18" in desc
    assert "2 reviews" in desc


def test_render_dive_site_main_contains_h1_and_breadcrumbs():
    site = MockSite()
    html = render_dive_site_main(site, 8.5, 2)
    assert "<h1>Agia Anna</h1>" in html
    assert 'href="/dive-sites"' in html
    assert "Greece" in html


def test_render_seo_page_injects_metadata_and_preserves_spa_shell():
    site = MockSite()
    main = render_dive_site_main(site, 8.5, 2)
    page = render_seo_page(
        SPA_TEMPLATE,
        title="Divemap - Agia Anna - Naxos, Greece",
        description="Test description",
        canonical="https://divemap.blue/dive-sites/104/agia-anna",
        main_content=main,
        json_ld={"@context": "https://schema.org", "@type": "Place", "name": "Agia Anna"},
    )

    assert "<title>Divemap - Agia Anna - Naxos, Greece</title>" in page
    assert 'meta name="description" content="Test description"' in page
    assert 'rel="canonical" href="https://divemap.blue/dive-sites/104/agia-anna"' in page
    assert "<h1>Agia Anna</h1>" in page
    assert 'src="/assets/index-abc123.js"' in page
    assert "application/ld+json" in page
    assert "Agia Anna" in page
    assert "initial-loading" not in page


def test_render_seo_page_without_template():
    page = render_seo_page(
        None,
        title="Divemap - Dive Sites",
        description="Browse dive sites.",
        canonical="https://divemap.blue/dive-sites",
        main_content=render_listing_main("Dive Sites", "Intro", [("Site A", "/dive-sites/1/a")]),
    )
    assert "<title>Divemap - Dive Sites</title>" in page
    assert "<h1>Dive Sites</h1>" in page
    assert 'href="/dive-sites/1/a"' in page


def test_render_homepage_main_has_crawlable_links():
    html = render_homepage_main([("Thistlegorm", "/dive-sites/4/ss-thistlegorm")])
    assert "Popular Dive Sites" in html
    assert 'href="/dive-sites/4/ss-thistlegorm"' in html
    assert 'href="/dive-sites"' in html


def test_json_ld_is_valid_in_output():
    page = render_seo_page(
        None,
        title="Test",
        description="Desc",
        canonical="https://divemap.blue/test",
        main_content="<main><h1>Test</h1></main>",
        json_ld={"@context": "https://schema.org", "@type": "Place", "name": "Test"},
    )
    start = page.index('application/ld+json">') + len('application/ld+json">')
    end = page.index("</script>", start)
    payload = json.loads(page[start:end])
    assert payload["@type"] == "Place"
