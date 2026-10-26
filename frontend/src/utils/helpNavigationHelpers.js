export const HELP_SECTIONS = [
  {
    id: 'start',
    slug: 'getting-started',
    title: 'Getting Started',
    metaTitle: 'Getting Started with Divemap | Help Center & User Guide',
    metaDescription:
      'Learn the basics of Divemap: explore the global map, log your scuba dives, discover diving centers, and set up your PWA.',
  },
  {
    id: 'map',
    slug: 'global-map',
    title: 'Global Map',
    metaTitle: 'Interactive Diving Map Guide | Help Center & User Guide',
    metaDescription:
      'Master the Divemap interactive map. View real-time wind overlays, dive site suitability forecasts, depth contours, and center locations.',
  },
  {
    id: 'directories',
    slug: 'directories',
    title: 'Directories',
    metaTitle: 'Dive Sites & Centers Directory Guide | Help Center & User Guide',
    metaDescription:
      'Discover and search dive sites, verify diving center credentials, check organized dive trips, and claim dive businesses on Divemap.',
  },
  {
    id: 'log',
    slug: 'log-and-import',
    title: 'Log & Import',
    metaTitle: 'Dive Logging & Computer Import Guide | Help Center & User Guide',
    metaDescription:
      'Import scuba dive logs and telemetry files from Subsurface, Shearwater, MySSI, Garmin, and Suunto computers with automatic gas analysis.',
  },
  {
    id: 'media_routes',
    slug: 'sites-and-media',
    title: 'Sites & Media',
    metaTitle: 'Underwater Media & Dive Routes Guide | Help Center & User Guide',
    metaDescription:
      'Explore dive site photo galleries, contribute underwater media, and view or draw GPS dive route profiles.',
  },
  {
    id: 'tools',
    slug: 'tools-and-planning',
    title: 'Tools & Planning',
    metaTitle: 'Technical Diving Calculators & Planning Guide | Help Center',
    metaDescription:
      'Use high-precision diving calculators for MOD, Best Mix, SAC rate, Rock Bottom gas planning, and lead weight estimation.',
  },
  {
    id: 'community',
    slug: 'community',
    title: 'Community',
    metaTitle: 'Diver Community & Buddy Tagging Guide | Help Center & User Guide',
    metaDescription:
      'Connect with dive buddies, verify certifications, share logged dives on social media, and curate your public scuba profile.',
  },
  {
    id: 'business',
    slug: 'business-portal',
    title: 'Business Portal',
    metaTitle: 'Diving Center Business Portal Guide | Help Center & User Guide',
    metaDescription:
      'Manage dive centers, delegate instructor permissions, update rental equipment pricing, and publish dive trips.',
  },
];

export const DEFAULT_HELP_SECTION = HELP_SECTIONS[0];

const SLUG_TO_SECTION = new Map(HELP_SECTIONS.map(section => [section.slug, section]));
const LEGACY_TAB_TO_SLUG = new Map(HELP_SECTIONS.map(section => [section.id, section.slug]));

export const getSectionBySlug = slug => {
  if (!slug) return undefined;
  return SLUG_TO_SECTION.get(slug);
};

export const getSlugByLegacyTab = tabKey => {
  if (!tabKey) return undefined;
  return LEGACY_TAB_TO_SLUG.get(tabKey);
};
