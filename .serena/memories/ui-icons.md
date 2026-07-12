# Divemap UI Icon Standardization

To ensure visual consistency across the frontend, use the following standardized Lucide icons (or custom assets) for common diving and profile metrics.

## Diving Metrics
- **Max Depth**: `DepthIcon` (Custom SVG Component)
  - *Context*: Used in Dive details, Site details, and Profile summaries.
- **Duration / Time**: `Clock` (Lucide)
  - *Context*: Dive duration, member since, timestamps.
- **Visibility**: `Eye` (Lucide)
  - *Context*: Underwater visibility in meters.
- **Temperature**: `Thermometer` (Lucide)
  - *Context*: Water or air temperature.
- **Max Deco Time / Deco Info**: `Droplets` (Lucide)
  - *Note*: Always accompany with "Deco:" text label for clarity.
- **Gases (O2, Nitrox, EAN, Trimix)**: `Wind` (Lucide)
  - *Normalization*: Use `formatGases` helper to convert "Nitrox XX%" to "EANXX".
- **Total Dives / Dive Logs**: `Notebook` (Lucide)
  - *Context*: Representing cumulative diving experience and log entries.

## Equipment
- **Single Tank**: `/single.png` (Custom Asset)
- **Double / Twin Tanks**: `/doubles.png` (Custom Asset)
- **General Equipment**: `Cylinder` (Lucide) - *Use custom PNGs for specific tank configs where possible.*

## Profile & Social
- **Email**: `Mail` (Lucide)
- **Username / Full Name**: `User` (Lucide)
- **Buddy Visibility / Privacy**: `Shield` (Lucide)
- **Social Media**: Use `getSocialMediaIcon(platform)` helper from `SocialMediaIcons.jsx`.
- **Dive Sites**: `MapPin` (Lucide)
- **Map / Geographic View**: `Map` (Lucide)
- **General Location / Address**: `MapPin` (Lucide)

## Implementation Notes
1. **Consistency First**: If adding a new metric, check if an icon already exists for a similar concept.
2. **Helper Usage**: Always use `formatGases` for gas-related text formatting.
3. **Accessibility**: Provide `title` or `alt` tags for icons, especially when they represent data without accompanying text.
