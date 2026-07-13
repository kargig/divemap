import {
  Shield,
  Smartphone,
  Plus,
  Share,
  X,
  MapPin,
  Anchor,
  BookOpen,
  Compass,
  Award,
  CloudSun,
  Eye,
  Key,
} from 'lucide-react';
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

const InFeedPromoCard = ({ platform }) => {
  const navigate = useNavigate();
  const [showIOSModal, setShowIOSModal] = useState(false);

  // Pool of 10 engaging, relevant feature-centric messages about Divemap
  const promoPool = useMemo(
    () => [
      {
        title: 'Log Your Dive Computer Profiles',
        message:
          'Visualize your dive data! Upload Subsurface XML, Garmin FIT, or Suunto files to generate interactive depth & temperature charts.',
        icon: <BookOpen size={16} />,
      },
      {
        title: 'Explore the Interactive Map',
        message:
          'Discover thousands of dive sites worldwide. Filter by labels, difficulty, and community ratings.',
        icon: <MapPin size={16} />,
      },
      {
        title: 'Secure Buddy Messaging System',
        message:
          'Connect with local divers! Coordinate your next underwater dive trip securely using our encrypted end-to-end chat.',
        icon: <Eye size={16} />,
      },
      {
        title: 'Wind & Wave Suitability',
        message:
          'Dive safely! Check real-time wind impact and marine conditions suggestions before packing your regulator.',
        icon: <CloudSun size={16} />,
      },
      {
        title: 'Verified Diving Centers',
        message:
          'Find premier dive centers near you. Check their rental gear prices, and view direct contact profiles.',
        icon: <Anchor size={16} />,
      },
      {
        title: 'Diving Organization Certifications',
        message:
          'Keep your credentials handy! Link your certifications (PADI, SSI, GUE, CMAS, etc.) directly on your public profile.',
        icon: <Award size={16} />,
      },
      {
        title: 'Interactive GPS Route Tracking',
        message:
          'Trace your exact path! Draw, save, and visualize 2D dive routes and coordinates directly on our maps. Never miss a point of interest again!',
        icon: <Compass size={16} />,
      },
      {
        title: 'Join the Diver Leaderboard',
        message:
          'Connect with the community, earn badges, share photos, and see where your monthly dive counts rank on the leaderboard.',
        icon: <Shield size={16} />,
      },
      {
        title: 'Personal Access Tokens (API)',
        message:
          'Power your own scripts! Generate secure personal tokens to integrate your dive logs with external platforms programmatically.',
        icon: <Key size={16} />,
      },
      {
        title: 'Scuba Physics Calculators',
        message:
          'Plan your breathing gases! Use our built-in tools to calculate MOD, Best Mix, SAC Rate, Gas Planning, and Minimum Gas limits.',
        icon: <Compass size={16} />,
      },
    ],
    []
  );

  // Deterministically pick one message per card mount to keep things fresh and avoid re-render shifting
  const selectedPromo = useMemo(() => {
    const randomIndex = Math.floor(Math.random() * promoPool.length);
    return promoPool[randomIndex];
  }, [promoPool]);

  if (platform === 'standalone') return null;

  const renderCardContent = () => {
    if (platform === 'android') {
      return (
        <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between w-full gap-3 sm:gap-4 text-left'>
          <div className='flex flex-row items-start gap-3 flex-1 min-w-0'>
            <div className='w-8 h-8 rounded-full bg-white dark:bg-gray-800 text-divemap-blue dark:text-divemap-sky flex items-center justify-center flex-shrink-0 shadow-sm animate-pulse'>
              <Smartphone size={16} />
            </div>
            <div className='min-w-0'>
              <h4 className='font-display font-bold text-gray-900 dark:text-white text-xs sm:text-sm'>
                Install Divemap App
              </h4>
              <p className='text-[10px] sm:text-xs text-gray-600 dark:text-gray-300 mt-0.5 leading-snug'>
                {selectedPromo.message} Install the app for fast access and offline support!
              </p>
            </div>
          </div>
          <div className='flex justify-end w-full sm:w-auto mt-1 sm:mt-0 flex-shrink-0'>
            <button
              onClick={() =>
                window.open(
                  'https://play.google.com/store/apps/details?id=gr.divemap.twa',
                  '_blank',
                  'noopener,noreferrer'
                )
              }
              className='px-3.5 py-1.5 bg-divemap-blue hover:bg-divemap-deep text-white text-[10px] sm:text-xs font-semibold rounded-xl transition-colors shadow-sm'
            >
              Install App
            </button>
          </div>
        </div>
      );
    }

    if (platform === 'ios') {
      return (
        <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between w-full gap-3 sm:gap-4 text-left'>
          <div className='flex flex-row items-start gap-3 flex-1 min-w-0'>
            <div className='w-8 h-8 rounded-full bg-white dark:bg-gray-800 text-divemap-blue dark:text-divemap-sky flex items-center justify-center flex-shrink-0 shadow-sm animate-pulse'>
              <Smartphone size={16} />
            </div>
            <div className='min-w-0'>
              <h4 className='font-display font-bold text-gray-900 dark:text-white text-xs sm:text-sm'>
                Add to Home Screen
              </h4>
              <p className='text-[10px] sm:text-xs text-gray-600 dark:text-gray-300 mt-0.5 leading-snug'>
                {selectedPromo.message} Install on your iPhone to access your offline dive logs
                anytime.
              </p>
            </div>
          </div>
          <div className='flex justify-end w-full sm:w-auto mt-1 sm:mt-0 flex-shrink-0'>
            <button
              onClick={() => setShowIOSModal(true)}
              className='px-3.5 py-1.5 bg-divemap-blue hover:bg-divemap-deep text-white text-[10px] sm:text-xs font-semibold rounded-xl transition-colors shadow-sm'
            >
              How to Install
            </button>

            {showIOSModal && (
              <div className='fixed inset-0 z-[1000] bg-black/60 flex items-center justify-center p-4'>
                <div className='bg-white dark:bg-gray-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative text-left'>
                  <button
                    onClick={() => setShowIOSModal(false)}
                    className='absolute top-4 right-4 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-500 dark:text-gray-400'
                    aria-label='Close installation instructions'
                  >
                    <X size={18} />
                  </button>
                  <h3 className='font-display font-bold text-lg text-gray-900 dark:text-white mb-4'>
                    Install on iPhone
                  </h3>
                  <ol className='space-y-4 text-sm text-gray-600 dark:text-gray-300'>
                    <li className='flex gap-3'>
                      <span className='w-6 h-6 rounded-full bg-divemap-surface dark:bg-gray-700 text-divemap-blue dark:text-divemap-sky flex items-center justify-center font-bold text-xs'>
                        1
                      </span>
                      <div>
                        Tap Safari's <strong>Share</strong> button{' '}
                        <Share size={16} className='inline text-gray-700 dark:text-gray-300' />.
                      </div>
                    </li>
                    <li className='flex gap-3'>
                      <span className='w-6 h-6 rounded-full bg-divemap-surface dark:bg-gray-700 text-divemap-blue dark:text-divemap-sky flex items-center justify-center font-bold text-xs'>
                        2
                      </span>
                      <div>
                        Scroll down and select <strong>"Add to Home Screen"</strong>{' '}
                        <Plus size={16} className='inline text-gray-700 dark:text-gray-300' />.
                      </div>
                    </li>
                  </ol>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Default Desktop
    return (
      <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between w-full gap-3 sm:gap-4 text-left'>
        <div className='flex flex-row items-start gap-3 flex-1 min-w-0'>
          <div className='w-8 h-8 rounded-full bg-white dark:bg-gray-800 text-divemap-blue dark:text-divemap-sky flex items-center justify-center flex-shrink-0 shadow-sm'>
            {selectedPromo.icon}
          </div>
          <div className='min-w-0'>
            <h4 className='font-display font-bold text-gray-900 dark:text-white text-xs sm:text-sm'>
              {selectedPromo.title}
            </h4>
            <p className='text-[10px] sm:text-xs text-gray-600 dark:text-gray-300 mt-0.5 leading-snug'>
              {selectedPromo.message}
            </p>
          </div>
        </div>
        <div className='flex justify-end w-full sm:w-auto mt-1 sm:mt-0 flex-shrink-0'>
          <button
            onClick={() => navigate('/register')}
            className='px-3.5 py-1.5 bg-divemap-blue hover:bg-divemap-deep text-white text-[10px] sm:text-xs font-semibold rounded-xl transition-colors shadow-sm'
          >
            Sign Up Free
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className='bg-divemap-surface dark:bg-blue-900/20 p-3.5 sm:p-5 rounded-none sm:rounded-2xl border-y sm:border border-blue-100 dark:border-blue-900/40 border-l-4 border-l-divemap-blue hover:shadow-md transition-all duration-200 flex flex-col items-center justify-center min-h-[90px] sm:min-h-[110px]'>
      {renderCardContent()}
    </div>
  );
};

export default InFeedPromoCard;
