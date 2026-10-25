import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.database import get_db  # noqa: E402
from generate_static_content import generate_content  # noqa: E402


def test_sitemap_includes_all_help_subpaths():
    db = next(get_db())
    try:
        files = generate_content(db, r2_client=None)
        sitemap_xml = files.get("sitemap.xml", "")
        expected_help_paths = [
            "/help",
            "/help/getting-started",
            "/help/global-map",
            "/help/directories",
            "/help/log-and-import",
            "/help/sites-and-media",
            "/help/tools-and-planning",
            "/help/community",
            "/help/business-portal",
        ]
        for path in expected_help_paths:
            assert path in sitemap_xml, (
                f"Expected {path} to be present in generated sitemap"
            )
    finally:
        db.close()
