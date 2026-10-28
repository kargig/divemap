import L from 'leaflet';

/**
 * Generates an SVG string for a dive teardrop map pin inspired by sticker #16.
 *
 * Geometry & Visual Specs:
 * - ViewBox: 0 0 36 48 (without base disc) or 0 0 44 56 (with base disc)
 * - Option B see-through cutout aperture (center circle at (cx, 17) with radius 4.8)
 * - Diver-down flag (crimson red #dc2626 with 45° diagonal white stripe)
 * - Midnight navy border (#0f172a)
 * - Optional Option 1 Ground Base Disc (pedestal at pin tip for weather ratings and main site)
 * - Optional center badge (e.g., 'DC' for diving centers or trip icons)
 */
export const generateDivePinSvg = ({
  width = 36,
  height = 48,
  flagColor = '#dc2626',
  outerBorderColor = '#0f172a',
  outerBorderWidth = 2.6,
  haloColor = null,
  haloWidth = 4.5,
  baseDiscColor = null,
  isMain = false,
  isTransparentHole = true,
  badgeText = null,
  badgeFill = '#ffffff',
  badgeTextColor = null,
  isSolidColor = false,
  solidFill = null,
  diverSilhouette = false,
  maskIdSuffix = '',
} = {}) => {
  const hasBaseDisc = Boolean(baseDiscColor || isMain);
  const maskId = `pin-mask-${maskIdSuffix || Math.random().toString(36).slice(2, 9)}`;

  const vbWidth = hasBaseDisc ? 44 : 36;
  const vbHeight = hasBaseDisc ? 56 : 48;
  const cx = hasBaseDisc ? 22 : 18;

  const pinPath = hasBaseDisc
    ? 'M 22 46 C 21.5 46 9 28.5 9 17.5 C 9 9.5 14.8 4 22 4 C 29.2 4 35 9.5 35 17.5 C 35 28.5 22.5 46 22 46 Z'
    : 'M 18 46 C 17.5 46 5 28.5 5 17.5 C 5 9.5 10.8 4 18 4 C 25.2 4 31 9.5 31 17.5 C 31 28.5 18.5 46 18 46 Z';

  let baseDiscElement = '';
  if (isMain || baseDiscColor === 'gold') {
    baseDiscElement = `
      <!-- Radiant Gold Double Base Disc -->
      <ellipse cx="22" cy="49" rx="18" ry="6.5" fill="#fef3c7" stroke="#f59e0b" stroke-width="2"/>
      <ellipse cx="22" cy="49" rx="11" ry="4" fill="#f59e0b"/>
    `;
  } else if (baseDiscColor) {
    baseDiscElement = `
      <!-- Weather Condition Base Disc -->
      <ellipse cx="22" cy="49" rx="14" ry="5.5" fill="${baseDiscColor}" stroke="#ffffff" stroke-width="2"/>
      <ellipse cx="22" cy="49" rx="14" ry="5.5" stroke="#0f172a" stroke-width="1.2" fill="none"/>
    `;
  }

  let fillContent = '';
  if (isSolidColor) {
    fillContent = `<path d="${pinPath}" fill="${solidFill || flagColor}"/>`;
  } else {
    const rectW = vbWidth;
    const rectH = vbHeight;
    const stripePoints = hasBaseDisc ? '0,2 10,-6 44,36 34,44' : '-4,2 6,-6 40,36 30,44';

    fillContent = `
      <g ${isTransparentHole ? `mask="url(#${maskId})"` : ''}>
        <rect x="0" y="0" width="${rectW}" height="${rectH}" fill="${flagColor}"/>
        <polygon points="${stripePoints}" fill="#ffffff"/>
      </g>
    `;
  }

  const haloElement = haloColor
    ? `<path d="${pinPath}" stroke="${haloColor}" stroke-width="${haloWidth}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
    : '';

  let centerElement = '';
  if (badgeText) {
    centerElement = `
      <circle cx="${cx}" cy="17" r="7.5" fill="${badgeFill}" stroke="${outerBorderColor}" stroke-width="1.8"/>
      <text x="${cx}" y="20.5" text-anchor="middle" fill="${badgeTextColor || flagColor}" font-family="system-ui, -apple-system, sans-serif" font-size="8.5" font-weight="800">${badgeText}</text>
    `;
  } else if (diverSilhouette) {
    centerElement = `
      <circle cx="${cx}" cy="17" r="7.5" fill="${badgeFill}" stroke="${outerBorderColor}" stroke-width="1.8"/>
      <circle cx="${cx}" cy="14" r="2" fill="${flagColor}"/>
      <path d="M ${cx - 4} 20 Q ${cx} 23 ${cx + 4} 20" stroke="${flagColor}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    `;
  } else if (isTransparentHole) {
    centerElement = `<circle cx="${cx}" cy="17" r="4.8" stroke="${outerBorderColor}" stroke-width="1.8" fill="none"/>`;
  } else {
    centerElement = `<circle cx="${cx}" cy="17" r="4.8" fill="#ffffff" stroke="${outerBorderColor}" stroke-width="1.8"/>`;
  }

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${vbWidth} ${vbHeight}" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        ${
          isTransparentHole && !isSolidColor
            ? `
          <mask id="${maskId}">
            <rect x="0" y="0" width="${vbWidth}" height="${vbHeight}" fill="black"/>
            <path d="${pinPath}" fill="white"/>
            <circle cx="${cx}" cy="17" r="4.8" fill="black"/>
          </mask>
        `
            : ''
        }
      </defs>
      ${baseDiscElement}
      ${haloElement}
      ${fillContent}
      <path d="${pinPath}" stroke="${outerBorderColor}" stroke-width="${outerBorderWidth}" fill="none"/>
      ${centerElement}
    </svg>
  `.trim();
};

/**
 * Creates a Leaflet Icon from an SVG string.
 */
export const createLeafletIconFromSvg = (
  svgString,
  width,
  height,
  className = '',
  customAnchor = null
) => {
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
  const anchor = customAnchor || [Math.round(width / 2), height];
  const IconClass = L.Icon;
  if (typeof IconClass === 'function') {
    return new IconClass({
      iconUrl: dataUrl,
      iconSize: [width, height],
      iconAnchor: anchor,
      popupAnchor: [0, -height],
      className,
    });
  }
  return {
    options: {
      iconUrl: dataUrl,
      iconSize: [width, height],
      iconAnchor: anchor,
      popupAnchor: [0, -height],
      className,
    },
  };
};

/**
 * Standard Dive Site Icon for general map views, details, and mini-maps.
 * Accepts either an options object or a boolean for isMain.
 */
export const createDiveSiteIcon = (optionsOrIsMain = {}) => {
  const options =
    typeof optionsOrIsMain === 'boolean' ? { isMain: optionsOrIsMain } : optionsOrIsMain;

  const {
    isMain = false,
    suitability = null,
    suitabilityColor = null,
    width = null,
    height = null,
    size = null,
  } = options;

  const baseDiscColor = isMain ? 'gold' : suitabilityColor || null;
  const hasBaseDisc = Boolean(baseDiscColor);

  const w = width || (size ? size : isMain ? 40 : hasBaseDisc ? 34 : 28);
  const h = height || (hasBaseDisc ? Math.round(w * (56 / 44)) : Math.round(w * (48 / 36)));

  const svg = generateDivePinSvg({
    width: w,
    height: h,
    flagColor: '#dc2626',
    outerBorderColor: '#0f172a',
    baseDiscColor,
    isMain,
    isTransparentHole: true,
  });

  const anchorY = hasBaseDisc ? Math.round(h * (49 / 56)) : h;

  return createLeafletIconFromSvg(svg, w, h, isMain ? 'dive-site-main-pin' : 'dive-site-pin', [
    Math.round(w / 2),
    anchorY,
  ]);
};

/**
 * Amber Diver Down Flag Icon for existing nearby dive sites (<1km) during creation.
 */
export const createNearbySiteIcon = ({ width = 28, height = null } = {}) => {
  const h = height || Math.round(width * (48 / 36));
  const svg = generateDivePinSvg({
    width,
    height: h,
    flagColor: '#ea580c',
    outerBorderColor: '#0f172a',
    isTransparentHole: true,
  });
  return createLeafletIconFromSvg(svg, width, h, 'nearby-site-pin');
};

/**
 * Distinct User Target Pin Icon for LocationPickerMap with animated pulse ring.
 */
export const createUserTargetPinIcon = ({ width = 36, height = 48 } = {}) => {
  const svg = generateDivePinSvg({
    width,
    height,
    flagColor: '#dc2626',
    outerBorderColor: '#2563eb', // Blue accent border
    outerBorderWidth: 3.2,
    isTransparentHole: true,
  });

  const html = `
    <div style="position: relative; width: ${width}px; height: ${height}px; display: flex; align-items: center; justify-content: center;">
      <!-- Ground pulsing target circle -->
      <span style="position: absolute; bottom: -4px; width: ${Math.round(width * 1.2)}px; height: 16px; border-radius: 50%; background: rgba(37,99,235,0.3); border: 1.5px solid rgba(37,99,235,0.8); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
      <div style="position: relative; width: ${width}px; height: ${height}px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.35));">
        ${svg}
      </div>
    </div>
  `;

  return L.divIcon({
    className: 'custom-user-target-pin',
    html,
    iconSize: [width, height],
    iconAnchor: [Math.round(width / 2), height],
    popupAnchor: [0, -height],
  });
};

/**
 * Diving Center Icon: Ocean Blue with 'DC' emblem badge.
 */
export const createDivingCenterIcon = ({ width = 30, height = null } = {}) => {
  const h = height || Math.round(width * (48 / 36));
  const svg = generateDivePinSvg({
    width,
    height: h,
    isSolidColor: true,
    solidFill: '#0284c7',
    outerBorderColor: '#0f172a',
    badgeText: 'DC',
    badgeFill: '#ffffff',
    badgeTextColor: '#0284c7',
  });
  return createLeafletIconFromSvg(svg, width, h, 'diving-center-pin');
};

/**
 * Dive Trip Icon: Colored teardrop pin with diver emblem.
 */
export const createDiveTripIcon = ({ tripDate = null, width = 30, height = null } = {}) => {
  const h = height || Math.round(width * (48 / 36));
  let baseColor = '#0072B2';
  if (tripDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tDate = new Date(tripDate);
    if (tDate < today) {
      baseColor = '#6b7280';
    } else if (tDate.getTime() === today.getTime()) {
      baseColor = '#f59e0b';
    } else {
      baseColor = '#10b981';
    }
  }

  const svg = generateDivePinSvg({
    width,
    height: h,
    isSolidColor: true,
    solidFill: baseColor,
    outerBorderColor: '#0f172a',
    diverSilhouette: true,
    badgeFill: '#ffffff',
  });
  return createLeafletIconFromSvg(svg, width, h, 'dive-trip-pin');
};
