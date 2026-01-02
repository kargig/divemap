import { registerSW } from 'virtual:pwa-register';

import { useEffect } from 'react';
import { toast } from 'react-hot-toast';

const PWAUpdater = () => {
  useEffect(() => {
    const updateSW = registerSW({
      onNeedRefresh() {
        toast(
          t => (
            <div className='flex flex-col gap-2 min-w-[200px]'>
              <span className='font-medium text-gray-800'>New content available!</span>
              <div className='flex items-center gap-2 justify-end mt-1'>
                <button
                  className='px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-md transition-colors'
                  onClick={() => toast.dismiss(t.id)}
                >
                  Dismiss
                </button>
                <button
                  className='px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors shadow-sm'
                  onClick={() => {
                    updateSW(true);
                    toast.dismiss(t.id);
                  }}
                >
                  Refresh
                </button>
              </div>
            </div>
          ),
          {
            duration: Infinity,
            position: 'bottom-right',
            className: 'shadow-lg border border-gray-100',
          }
        );
      },
      onOfflineReady() {
        toast.success('App is ready to work offline!', {
          duration: 4000,
          position: 'bottom-right',
          className: 'shadow-md',
        });
      },
    });
  }, []);

  return null;
};

export default PWAUpdater;
