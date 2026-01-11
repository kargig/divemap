import { Loader } from 'lucide-react';
import React, { Suspense, lazy } from 'react';

import { useResponsive } from '../hooks/useResponsive';

// Dynamic Imports
const AdminDivesDesktop = lazy(() => import('./AdminDivesDesktop'));
const AdminDivesMobile = lazy(() => import('./AdminDivesMobile'));

const AdminDives = () => {
  const { isMobile } = useResponsive();

  return (
    <Suspense
      fallback={
        <div className='flex justify-center items-center h-64'>
          <Loader className='animate-spin h-8 w-8 text-blue-600' />
        </div>
      }
    >
      {isMobile ? <AdminDivesMobile /> : <AdminDivesDesktop />}
    </Suspense>
  );
};

export default AdminDives;
