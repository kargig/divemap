import React, { Suspense, lazy } from 'react';
import { useParams } from 'react-router-dom';

import { isNumericDiveSiteId } from '../utils/geoHubs';

const DiveSiteDetail = lazy(() => import('../pages/DiveSiteDetail'));
const DiveSites = lazy(() => import('../pages/DiveSites'));

const PathGateFallback = () => (
  <div className='flex justify-center items-center min-h-[40vh]'>Loading...</div>
);

/**
 * Disambiguates /dive-sites/:id and /dive-sites/:id/:slug:
 * - numeric id → DiveSiteDetail
 * - non-numeric → DiveSites geo hub (country / country+region)
 *
 * Lazy-load each page so listing and detail do not share one bundle.
 */
const DiveSitePathGate = () => {
  const { id, slug } = useParams();

  return (
    <Suspense fallback={<PathGateFallback />}>
      {isNumericDiveSiteId(id) ? (
        <DiveSiteDetail />
      ) : (
        <DiveSites geoCountrySlug={id} geoRegionSlug={slug || undefined} />
      )}
    </Suspense>
  );
};

export default DiveSitePathGate;
