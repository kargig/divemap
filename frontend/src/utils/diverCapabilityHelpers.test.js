import { describe, it, expect } from 'vitest';

import { getDiverCapabilitySummary } from './diverCapabilityHelpers';

describe('getDiverCapabilitySummary', () => {
  it('extracts non-contradictory depth, deco, and seasonal thermal gear', () => {
    const mockProfile = {
      certification_stats: {
        max_depth_str: '45m',
        best_gases: ['EAN100', 'Air'],
        largest_tanks: ['Doubles'],
        max_stages: 1,
        max_deco_time: '25 minutes',
      },
      diving_stats: {
        max_depth: 62.0,
        longest_dive_minutes: 105,
        gear_preferences: {
          suits: { Drysuit: 9, Wetsuit: 8 },
          tanks: { Singles: 34, Doubles: 2 },
        },
      },
      stats: { total_dives: 339 },
      member_since: '2025-08-07',
    };

    const summary = getDiverCapabilitySummary(mockProfile);
    expect(summary.maxCertDepthStr).toBe('45m');
    expect(summary.deepestDiveStr).toBe('62.0m');
    expect(summary.maxDecoStr).toBe('25 min');
    expect(summary.primaryRigStr).toBe('Doubles + 1 Stg');
    expect(summary.thermalVersatilityStr).toContain('Drysuit & Wetsuit');
    expect(summary.bestGasStr).toBe('EAN100');
  });

  it('handles null profile gracefully', () => {
    expect(getDiverCapabilitySummary(null)).toBeNull();
  });

  it('handles invalid or unparseable member_since dates without NaN', () => {
    const summary = getDiverCapabilitySummary({
      stats: { total_dives: 10 },
      member_since: 'invalid-date-string',
    });
    expect(summary.experienceStr).toBe('10 Dives');
    expect(summary.experienceStr).not.toContain('NaN');
  });
});
