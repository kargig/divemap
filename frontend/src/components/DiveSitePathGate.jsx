import React from 'react';
import { useParams } from 'react-router-dom';

import DiveSiteDetail from '../pages/DiveSiteDetail';
import DiveSites from '../pages/DiveSites';
import { isNumericDiveSiteId } from '../utils/geoHubs';

/**
 * Disambiguates /dive-sites/:id and /dive-sites/:id/:slug:
 * - numeric id → DiveSiteDetail
 * - non-numeric → DiveSites geo hub (country / country+region)
 */
const DiveSitePathGate = () => {
  const { id, slug } = useParams();

  if (isNumericDiveSiteId(id)) {
    return <DiveSiteDetail />;
  }

  return <DiveSites geoCountrySlug={id} geoRegionSlug={slug || undefined} />;
};

export default DiveSitePathGate;
