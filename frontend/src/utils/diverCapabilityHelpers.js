/**
 * Extracts and formats objective diver capabilities and gear habits
 * from a UserPublicProfile payload without artificial titles.
 */
export function getDiverCapabilitySummary(profile) {
  if (!profile) return null;

  const certStats = profile.certification_stats || {};
  const divingStats = profile.diving_stats || {};
  const stats = profile.stats || {};

  // 1. Max Certified Depth
  const maxCertDepthStr =
    certStats.max_depth_str || (certStats.max_depth ? `${certStats.max_depth}m` : 'Recreational');

  // 2. Deepest Logged Dive
  const deepestLoggedVal = divingStats.max_depth ?? stats.max_depth ?? null;
  const deepestDiveStr = deepestLoggedVal
    ? `${parseFloat(deepestLoggedVal).toFixed(1)}m`
    : 'None logged';

  // 3. Max Deco Time
  let maxDecoStr = 'No Deco';
  if (certStats.max_deco_time) {
    maxDecoStr = String(certStats.max_deco_time)
      .replace(/minutes?/i, 'min')
      .trim();
  } else if (divingStats.max_deco_time) {
    maxDecoStr = `${divingStats.max_deco_time} min`;
  }

  // 4. Best Gas
  let bestGasStr = 'Air';
  if (certStats.max_trimix_pct) {
    bestGasStr = `Trimix (${certStats.max_trimix_pct})`;
  } else if (certStats.max_nitrox_pct > 21) {
    bestGasStr = `Nitrox ${certStats.max_nitrox_pct}%`;
  } else if (certStats.best_gases && certStats.best_gases.length > 0) {
    bestGasStr = certStats.best_gases[0];
  }

  // 5. Primary Cylinder Rig
  let primaryRigStr = 'Single';
  if (certStats.largest_tanks && certStats.largest_tanks.length > 0) {
    primaryRigStr = certStats.largest_tanks[0];
  } else if (divingStats.gear_preferences?.tanks) {
    const tanks = divingStats.gear_preferences.tanks;
    const sorted = Object.entries(tanks).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) primaryRigStr = sorted[0][0];
  }
  if (certStats.max_stages > 0) {
    primaryRigStr += ` + ${certStats.max_stages} Stg`;
  }

  // 6. Seasonal Thermal Versatility
  const suits = divingStats.suit_preferences || divingStats.gear_preferences?.suits || {};
  const hasDrysuit = (suits.dry_suit || suits.Drysuit || 0) > 0;
  const hasWetsuit =
    (suits.wet_suit || suits.Wetsuit || 0) > 0 || (suits.shortie || suits.Shorty || 0) > 0;
  let thermalVersatilityStr = 'Tropical / Wetsuit';
  if (hasDrysuit && hasWetsuit) {
    thermalVersatilityStr = 'Drysuit & Wetsuit Versatile';
  } else if (hasDrysuit) {
    thermalVersatilityStr = 'Drysuit Primary';
  } else if (hasWetsuit) {
    thermalVersatilityStr = 'Wetsuit Primary';
  }

  // 7. Experience & Currency
  const totalDives =
    stats.total_dives !== undefined
      ? stats.total_dives
      : (profile.number_of_dives || 0) +
        (stats.dives_created || 0) +
        (stats.buddy_dives_count || 0);
  let yearsActive = '';
  if (profile.member_since) {
    const years = Math.max(
      1,
      new Date().getFullYear() - new Date(profile.member_since).getFullYear()
    );
    yearsActive = ` · ${years}+ yrs`;
  }
  const experienceStr = `${totalDives} Dives${yearsActive}`;

  return {
    maxCertDepthStr,
    deepestDiveStr,
    maxDecoStr,
    bestGasStr,
    primaryRigStr,
    thermalVersatilityStr,
    experienceStr,
  };
}
