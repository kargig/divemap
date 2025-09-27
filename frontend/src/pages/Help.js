import {
  Map,
  Anchor,
  Award,
  Building,
  Search,
  Upload,
  Edit,
  Plus,
  Calendar,
  MapPin,
  Star,
  MessageSquare,
  FileText,
  Users,
  Eye,
  BarChart3,
  Smartphone,
  Globe,
  X,
} from 'lucide-react';
import { useState } from 'react';

import usePageTitle from '../hooks/usePageTitle';

const Help = () => {
  // Set page title
  usePageTitle('Divemap - Help');

  // Modal state for full-size image viewing
  const [modalImage, setModalImage] = useState(null);
  const [modalAlt, setModalAlt] = useState('');

  const openModal = (src, alt) => {
    setModalImage(src);
    setModalAlt(alt);
  };

  const closeModal = () => {
    setModalImage(null);
    setModalAlt('');
  };

  return (
    <div className='max-w-4xl mx-auto'>
      <div className='bg-white rounded-lg shadow-lg p-8'>
        <div className='text-center mb-8'>
          <div className='flex justify-center items-center mb-4'>
            <h1 className='text-4xl font-bold text-gray-900'>Help & User Guide</h1>
          </div>
          <p className='text-xl text-gray-600'>
            Learn how to use Divemap&apos;s comprehensive features to discover dive sites, log your
            dives with interactive profiles, and connect with the global diving community.
          </p>
          <div className='mt-4 text-sm text-gray-500'>Last Updated: September 27, 2025</div>
        </div>

        <div className='space-y-8'>
          {/* Getting Started */}
          <section>
            <h2 className='text-2xl font-semibold text-gray-900 mb-4 flex items-center'>
              <Map className='h-6 w-6 text-blue-600 mr-2' />
              Getting Started
            </h2>
            <div className='bg-blue-50 rounded-lg p-6'>
              <p className='text-gray-700 mb-4'>
                Welcome to Divemap! This comprehensive platform helps you discover dive sites, log
                your dives with interactive profiles, and connect with the global diving community.
              </p>
              <div className='grid md:grid-cols-2 gap-4 text-sm'>
                <div className='flex items-start'>
                  <Plus className='h-4 w-4 text-blue-600 mr-2 mt-0.5' />
                  <span>Create an account to access all features</span>
                </div>
                <div className='flex items-start'>
                  <Eye className='h-4 w-4 text-blue-600 mr-2 mt-0.5' />
                  <span>Browse dive sites and centers without an account</span>
                </div>
                <div className='flex items-start'>
                  <BarChart3 className='h-4 w-4 text-blue-600 mr-2 mt-0.5' />
                  <span>Import dive profiles from Subsurface XML files</span>
                </div>
                <div className='flex items-start'>
                  <Smartphone className='h-4 w-4 text-blue-600 mr-2 mt-0.5' />
                  <span>Mobile-optimized interface with touch support</span>
                </div>
                <div className='flex items-start'>
                  <Star className='h-4 w-4 text-blue-600 mr-2 mt-0.5' />
                  <span>Rate and review dive sites and centers</span>
                </div>
                <div className='flex items-start'>
                  <MessageSquare className='h-4 w-4 text-blue-600 mr-2 mt-0.5' />
                  <span>Leave comments and share experiences</span>
                </div>
              </div>
            </div>
          </section>

          {/* Discovering Dive Sites */}
          <section>
            <h2 className='text-2xl font-semibold text-gray-900 mb-4 flex items-center'>
              <MapPin className='h-6 w-6 text-blue-600 mr-2' />
              Discovering Dive Sites
            </h2>
            <div className='space-y-4'>
              <div className='bg-white border border-gray-200 rounded-lg p-6'>
                <h3 className='text-lg font-semibold text-gray-900 mb-3 flex items-center'>
                  <Search className='h-5 w-5 text-blue-600 mr-2' />
                  Advanced Search & Filter
                </h3>
                <div className='mb-4'>
                  <button
                    className='w-full rounded-lg border border-gray-200 shadow-sm cursor-pointer hover:opacity-90 transition-opacity p-0 bg-transparent'
                    onClick={() =>
                      openModal(
                        '/help-screenshots/dive-sites-search-interface.png',
                        'Dive Sites Search Interface showing search bar, quick filters, and sorting options'
                      )
                    }
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openModal(
                          '/help-screenshots/dive-sites-search-interface.png',
                          'Dive Sites Search Interface showing search bar, quick filters, and sorting options'
                        );
                      }
                    }}
                    aria-label='View full-size image of Dive Sites Search Interface'
                  >
                    <img
                      src='/help-screenshots/dive-sites-search-interface.png'
                      alt='Dive Sites Search Interface showing search bar, quick filters, and sorting options'
                      className='w-full rounded-lg'
                    />
                  </button>
                  <p className='text-xs text-gray-500 mt-2 text-center'>
                    Search interface with fuzzy search, quick filters, and sorting options
                  </p>
                </div>
                <div className='mb-4'>
                  <button
                    className='w-full rounded-lg border border-gray-200 shadow-sm cursor-pointer hover:opacity-90 transition-opacity p-0 bg-transparent'
                    onClick={() =>
                      openModal(
                        '/help-screenshots/dive-sites-advanced-filters.png',
                        'Advanced Filters Interface showing difficulty, rating, country, region, and tag filters'
                      )
                    }
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openModal(
                          '/help-screenshots/dive-sites-advanced-filters.png',
                          'Advanced Filters Interface showing difficulty, rating, country, region, and tag filters'
                        );
                      }
                    }}
                    aria-label='View full-size image of Advanced Filters Interface'
                  >
                    <img
                      src='/help-screenshots/dive-sites-advanced-filters.png'
                      alt='Advanced Filters Interface showing difficulty, rating, country, region, and tag filters'
                      className='w-full rounded-lg'
                    />
                  </button>
                  <p className='text-xs text-gray-500 mt-2 text-center'>
                    Advanced filtering options with difficulty, rating, location, and tag-based
                    filters
                  </p>
                </div>
                <div className='space-y-3 text-sm text-gray-700'>
                  <div className='flex items-start'>
                    <span className='font-semibold mr-2'>•</span>
                    <span>
                      <strong>Fuzzy Search:</strong> Intelligent search across names, locations, and
                      descriptions with relevance scoring
                    </span>
                  </div>
                  <div className='flex items-start'>
                    <span className='font-semibold mr-2'>•</span>
                    <span>
                      <strong>Multi-Criteria Filtering:</strong> Filter by difficulty, depth,
                      country, region, and rating
                    </span>
                  </div>
                  <div className='flex items-start'>
                    <span className='font-semibold mr-2'>•</span>
                    <span>
                      <strong>Tag-Based Search:</strong> Find dive sites with specific
                      characteristics using our comprehensive tag system
                    </span>
                  </div>
                  <div className='flex items-start'>
                    <span className='font-semibold mr-2'>•</span>
                    <span>
                      <strong>Geographic Discovery:</strong> Location-based search with distance
                      calculations
                    </span>
                  </div>
                  <div className='flex items-start'>
                    <span className='font-semibold mr-2'>•</span>
                    <span>
                      <strong>Smart Sorting:</strong> Sort by relevance, rating, distance, or
                      alphabetical order
                    </span>
                  </div>
                </div>
              </div>

              <div className='bg-white border border-gray-200 rounded-lg p-6'>
                <h3 className='text-lg font-semibold text-gray-900 mb-3 flex items-center'>
                  <Map className='h-5 w-5 text-blue-600 mr-2' />
                  Interactive Map Views
                </h3>
                <div className='space-y-4 text-sm text-gray-700'>
                  <div>
                    <h4 className='font-semibold text-gray-900 mb-2'>Dedicated Map View (/map)</h4>
                    <div className='mb-3'>
                      <button
                        className='w-full rounded-lg border border-gray-200 shadow-sm cursor-pointer hover:opacity-90 transition-opacity p-0 bg-transparent'
                        onClick={() =>
                          openModal(
                            '/help-screenshots/dedicated-map-view.png',
                            'Dedicated Map View showing full-screen map with comprehensive controls and multi-data type support'
                          )
                        }
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openModal(
                              '/help-screenshots/dedicated-map-view.png',
                              'Dedicated Map View showing full-screen map with comprehensive controls and multi-data type support'
                            );
                          }
                        }}
                        aria-label='View full-size image of Dedicated Map View'
                      >
                        <img
                          src='/help-screenshots/dedicated-map-view.png'
                          alt='Dedicated Map View showing full-screen map with comprehensive controls and multi-data type support'
                          className='w-full rounded-lg'
                        />
                      </button>
                      <p className='text-xs text-gray-500 mt-2 text-center'>
                        Full-screen dedicated map interface with comprehensive controls
                      </p>
                    </div>
                    <div className='space-y-2 ml-4'>
                      <div className='flex items-start'>
                        <span className='font-semibold mr-2'>•</span>
                        <span>
                          <strong>Full-Screen Experience:</strong> Dedicated map interface with
                          comprehensive controls
                        </span>
                      </div>
                      <div className='flex items-start'>
                        <span className='font-semibold mr-2'>•</span>
                        <span>
                          <strong>Multi-Data Type Support:</strong> Toggle between dive sites,
                          dives, diving centers, and dive trips
                        </span>
                      </div>
                      <div className='flex items-start'>
                        <span className='font-semibold mr-2'>•</span>
                        <span>
                          <strong>Advanced Controls:</strong> Location finder, reset view, share
                          map, and fullscreen mode
                        </span>
                      </div>
                      <div className='flex items-start'>
                        <span className='font-semibold mr-2'>•</span>
                        <span>
                          <strong>Progressive Clustering:</strong> Performance-optimized clustering
                          with zoom-based breakdown
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className='font-semibold text-gray-900 mb-2'>
                      Filtered Map View (Dive Sites → Map)
                    </h4>
                    <div className='mb-3'>
                      <button
                        className='w-full rounded-lg border border-gray-200 shadow-sm cursor-pointer hover:opacity-90 transition-opacity p-0 bg-transparent'
                        onClick={() =>
                          openModal(
                            '/help-screenshots/dive-sites-filtered-map-view.png',
                            'Filtered Map View showing search results on map with context-aware filtering'
                          )
                        }
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openModal(
                              '/help-screenshots/dive-sites-filtered-map-view.png',
                              'Filtered Map View showing search results on map with context-aware filtering'
                            );
                          }
                        }}
                        aria-label='View full-size image of Filtered Map View'
                      >
                        <img
                          src='/help-screenshots/dive-sites-filtered-map-view.png'
                          alt='Filtered Map View showing search results on map with context-aware filtering'
                          className='w-full rounded-lg'
                        />
                      </button>
                      <p className='text-xs text-gray-500 mt-2 text-center'>
                        Map view of filtered dive sites based on search criteria
                      </p>
                    </div>
                    <div className='space-y-2 ml-4'>
                      <div className='flex items-start'>
                        <span className='font-semibold mr-2'>•</span>
                        <span>
                          <strong>Search-Integrated:</strong> Map view of filtered dive sites based
                          on search criteria
                        </span>
                      </div>
                      <div className='flex items-start'>
                        <span className='font-semibold mr-2'>•</span>
                        <span>
                          <strong>Context-Aware:</strong> Shows only dive sites matching your
                          current search and filters
                        </span>
                      </div>
                      <div className='flex items-start'>
                        <span className='font-semibold mr-2'>•</span>
                        <span>
                          <strong>Quick Toggle:</strong> Switch between list and map views of your
                          search results
                        </span>
                      </div>
                      <div className='flex items-start'>
                        <span className='font-semibold mr-2'>•</span>
                        <span>
                          <strong>Mobile Touch Support:</strong> Touch-optimized interactions for
                          mobile devices
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className='bg-white border border-gray-200 rounded-lg p-6'>
                <h3 className='text-lg font-semibold text-gray-900 mb-3 flex items-center'>
                  <Star className='h-5 w-5 text-blue-600 mr-2' />
                  Dive Site Details
                </h3>
                <div className='space-y-3 text-sm text-gray-700'>
                  <div className='flex items-start'>
                    <span className='font-semibold mr-2'>•</span>
                    <span>
                      <strong>Comprehensive Information:</strong> Detailed descriptions, access
                      instructions, marine life, and safety information
                    </span>
                  </div>
                  <div className='flex items-start'>
                    <span className='font-semibold mr-2'>•</span>
                    <span>
                      <strong>Community Reviews:</strong> 1-10 scale ratings with detailed comments
                      from other divers
                    </span>
                  </div>
                  <div className='flex items-start'>
                    <span className='font-semibold mr-2'>•</span>
                    <span>
                      <strong>Rich Media:</strong> Photo and video galleries with cloud storage
                      integration
                    </span>
                  </div>
                  <div className='flex items-start'>
                    <span className='font-semibold mr-2'>•</span>
                    <span>
                      <strong>Geographic Data:</strong> GPS coordinates, country, region, and
                      precise location mapping
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Adding New Content */}
          <section>
            <h2 className='text-2xl font-semibold text-gray-900 mb-4 flex items-center'>
              <Plus className='h-6 w-6 text-blue-600 mr-2' />
              Adding New Content
            </h2>
            <div className='space-y-4'>
              <div className='bg-green-50 rounded-lg p-4'>
                <h3 className='text-lg font-semibold text-gray-900 mb-2'>Adding a New Dive Site</h3>
                <p className='text-gray-700 mb-3'>
                  Help the community by adding dive sites that aren&apos;t yet in our database.
                </p>
                <div className='space-y-2 text-sm text-gray-600'>
                  <div className='flex items-center'>
                    <MapPin className='h-4 w-4 mr-2' />
                    <span>Provide accurate location coordinates</span>
                  </div>
                  <div className='flex items-center'>
                    <Anchor className='h-4 w-4 mr-2' />
                    <span>Include maximum depth and difficulty level</span>
                  </div>
                  <div className='flex items-center'>
                    <FileText className='h-4 w-4 mr-2' />
                    <span>Add a detailed description and tips</span>
                  </div>
                </div>
              </div>

              <div className='bg-green-50 rounded-lg p-4'>
                <h3 className='text-lg font-semibold text-gray-900 mb-2'>
                  Comprehensive Dive Logging
                </h3>
                <p className='text-gray-700 mb-3'>
                  Keep track of your diving adventures with our comprehensive dive logging system
                  featuring interactive profiles and detailed statistics.
                </p>
                <div className='mb-4'>
                  <button
                    className='w-full rounded-lg border border-gray-200 shadow-sm cursor-pointer hover:opacity-90 transition-opacity p-0 bg-transparent'
                    onClick={() =>
                      openModal(
                        '/help-screenshots/dives-logging-interface.png',
                        'Dive Logging Interface showing dive list with detailed statistics and import functionality'
                      )
                    }
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openModal(
                          '/help-screenshots/dives-logging-interface.png',
                          'Dive Logging Interface showing dive list with detailed statistics and import functionality'
                        );
                      }
                    }}
                    aria-label='View full-size image of Dive Logging Interface'
                  >
                    <img
                      src='/help-screenshots/dives-logging-interface.png'
                      alt='Dive Logging Interface showing dive list with detailed statistics and import functionality'
                      className='w-full rounded-lg'
                    />
                  </button>
                  <p className='text-xs text-gray-500 mt-2 text-center'>
                    Dive logging interface with detailed statistics, import functionality, and
                    comprehensive dive information
                  </p>
                </div>
                <div className='space-y-2 text-sm text-gray-600'>
                  <div className='flex items-center'>
                    <Calendar className='h-4 w-4 mr-2' />
                    <span>Record dive date, duration, and depth with detailed statistics</span>
                  </div>
                  <div className='flex items-center'>
                    <MapPin className='h-4 w-4 mr-2' />
                    <span>Link your dive to a specific dive site with automatic matching</span>
                  </div>
                  <div className='flex items-center'>
                    <BarChart3 className='h-4 w-4 mr-2' />
                    <span>Upload dive profile XML files for interactive visualization</span>
                  </div>
                  <div className='flex items-center'>
                    <Upload className='h-4 w-4 mr-2' />
                    <span>Upload photos and videos with cloud storage integration</span>
                  </div>
                  <div className='flex items-center'>
                    <FileText className='h-4 w-4 mr-2' />
                    <span>Add detailed notes about marine life, conditions, and equipment</span>
                  </div>
                  <div className='flex items-center'>
                    <Eye className='h-4 w-4 mr-2' />
                    <span>Control privacy settings for each dive (public/private)</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Dive Profile Visualization */}
          <section>
            <h2 className='text-2xl font-semibold text-gray-900 mb-4 flex items-center'>
              <BarChart3 className='h-6 w-6 text-blue-600 mr-2' />
              Dive Profile Visualization
            </h2>
            <div className='space-y-4'>
              <div className='bg-white border border-gray-200 rounded-lg p-6'>
                <h3 className='text-lg font-semibold text-gray-900 mb-3 flex items-center'>
                  <BarChart3 className='h-5 w-5 text-blue-600 mr-2' />
                  Interactive Dive Charts
                </h3>
                <div className='mb-4'>
                  <button
                    className='w-full rounded-lg border border-gray-200 shadow-sm cursor-pointer hover:opacity-90 transition-opacity p-0 bg-transparent'
                    onClick={() =>
                      openModal(
                        '/help-screenshots/dive-profile-visualization.png',
                        'Interactive Dive Profile Chart showing depth vs time with temperature overlay and export options'
                      )
                    }
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openModal(
                          '/help-screenshots/dive-profile-visualization.png',
                          'Interactive Dive Profile Chart showing depth vs time with temperature overlay and export options'
                        );
                      }
                    }}
                    aria-label='View full-size image of Interactive Dive Profile Chart'
                  >
                    <img
                      src='/help-screenshots/dive-profile-visualization.png'
                      alt='Interactive Dive Profile Chart showing depth vs time with temperature overlay and export options'
                      className='w-full rounded-lg'
                    />
                  </button>
                  <p className='text-xs text-gray-500 mt-2 text-center'>
                    Interactive dive profile visualization with depth, temperature, and export
                    functionality
                  </p>
                </div>
                <div className='space-y-3 text-sm text-gray-700'>
                  <div className='flex items-start'>
                    <span className='font-semibold mr-2'>•</span>
                    <span>
                      <strong>Depth vs Time Charts:</strong> Real-time dive profile visualization
                      with depth, temperature, and gas data
                    </span>
                  </div>
                  <div className='flex items-start'>
                    <span className='font-semibold mr-2'>•</span>
                    <span>
                      <strong>Mobile Touch Support:</strong> Pan and zoom functionality optimized
                      for mobile devices
                    </span>
                  </div>
                  <div className='flex items-start'>
                    <span className='font-semibold mr-2'>•</span>
                    <span>
                      <strong>Smart Sampling:</strong> Automatic performance optimization for large
                      dive datasets (1000+ samples)
                    </span>
                  </div>
                  <div className='flex items-start'>
                    <span className='font-semibold mr-2'>•</span>
                    <span>
                      <strong>Export Functionality:</strong> PNG and PDF export capabilities for
                      dive profiles
                    </span>
                  </div>
                  <div className='flex items-start'>
                    <span className='font-semibold mr-2'>•</span>
                    <span>
                      <strong>Gas Change Markers:</strong> Visual indicators for gas changes during
                      dives
                    </span>
                  </div>
                  <div className='flex items-start'>
                    <span className='font-semibold mr-2'>•</span>
                    <span>
                      <strong>Decompression Status:</strong> Clear visualization of decompression
                      requirements
                    </span>
                  </div>
                </div>
              </div>

              <div className='bg-white border border-gray-200 rounded-lg p-6'>
                <h3 className='text-lg font-semibold text-gray-900 mb-3 flex items-center'>
                  <Upload className='h-5 w-5 text-blue-600 mr-2' />
                  Importing Dive Profiles
                </h3>
                <div className='space-y-3 text-sm text-gray-700'>
                  <div className='flex items-start'>
                    <span className='font-semibold mr-2'>•</span>
                    <span>
                      <strong>Subsurface XML Import:</strong> Import detailed dive profiles from
                      Subsurface and other dive computer software
                    </span>
                  </div>
                  <div className='flex items-start'>
                    <span className='font-semibold mr-2'>•</span>
                    <span>
                      <strong>Automatic Site Matching:</strong> Dive sites are automatically matched
                      or created during import
                    </span>
                  </div>
                  <div className='flex items-start'>
                    <span className='font-semibold mr-2'>•</span>
                    <span>
                      <strong>Batch Import:</strong> Import multiple dives at once with review and
                      edit capabilities
                    </span>
                  </div>
                  <div className='flex items-start'>
                    <span className='font-semibold mr-2'>•</span>
                    <span>
                      <strong>Privacy Controls:</strong> Set individual dives as public or private
                      during import
                    </span>
                  </div>
                  <div className='flex items-start'>
                    <span className='font-semibold mr-2'>•</span>
                    <span>
                      <strong>Data Validation:</strong> Automatic validation and error handling for
                      imported data
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Editing and Managing */}
          <section>
            <h2 className='text-2xl font-semibold text-gray-900 mb-4 flex items-center'>
              <Edit className='h-6 w-6 text-blue-600 mr-2' />
              Editing and Managing Your Content
            </h2>
            <div className='space-y-4'>
              <div className='bg-gray-50 rounded-lg p-4'>
                <h3 className='text-lg font-semibold text-gray-900 mb-2'>Editing Your Dives</h3>
                <p className='text-gray-700 mb-3'>
                  You can edit your own dives to add more details or correct information.
                </p>
                <div className='space-y-2 text-sm text-gray-600'>
                  <div className='flex items-center'>
                    <Edit className='h-4 w-4 mr-2' />
                    <span>Find the edit button on your dive details page</span>
                  </div>
                  <div className='flex items-center'>
                    <Upload className='h-4 w-4 mr-2' />
                    <span>Add or remove photos and videos</span>
                  </div>
                  <div className='flex items-center'>
                    <FileText className='h-4 w-4 mr-2' />
                    <span>Update dive notes and conditions</span>
                  </div>
                </div>
              </div>

              <div className='bg-gray-50 rounded-lg p-4'>
                <h3 className='text-lg font-semibold text-gray-900 mb-2'>Managing Your Profile</h3>
                <p className='text-gray-700 mb-3'>
                  Keep your profile up to date with your diving certifications and preferences.
                </p>
                <div className='space-y-2 text-sm text-gray-600'>
                  <div className='flex items-center'>
                    <Users className='h-4 w-4 mr-2' />
                    <span>Update your diving certifications</span>
                  </div>
                  <div className='flex items-center'>
                    <Award className='h-4 w-4 mr-2' />
                    <span>Add diving organizations you belong to</span>
                  </div>
                  <div className='flex items-center'>
                    <Eye className='h-4 w-4 mr-2' />
                    <span>Control your profile visibility</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Community Features */}
          <section>
            <h2 className='text-2xl font-semibold text-gray-900 mb-4 flex items-center'>
              <Users className='h-6 w-6 text-blue-600 mr-2' />
              Community Features
            </h2>
            <div className='space-y-4'>
              <div className='bg-purple-50 rounded-lg p-4'>
                <h3 className='text-lg font-semibold text-gray-900 mb-2'>Rating and Reviewing</h3>
                <p className='text-gray-700 mb-3'>
                  Share your experiences to help other divers make informed decisions.
                </p>
                <div className='space-y-2 text-sm text-gray-600'>
                  <div className='flex items-center'>
                    <Star className='h-4 w-4 mr-2' />
                    <span>Rate dive sites and diving centers from 1 to 5 stars</span>
                  </div>
                  <div className='flex items-center'>
                    <MessageSquare className='h-4 w-4 mr-2' />
                    <span>Leave detailed comments about your experience</span>
                  </div>
                  <div className='flex items-center'>
                    <Award className='h-4 w-4 mr-2' />
                    <span>Your diving credentials will be displayed with your reviews</span>
                  </div>
                </div>
              </div>

              <div className='bg-purple-50 rounded-lg p-4'>
                <h3 className='text-lg font-semibold text-gray-900 mb-2'>Diving Centers</h3>
                <p className='text-gray-700 mb-3'>
                  Discover and review diving centers, including gear rental costs and services.
                </p>
                <div className='space-y-2 text-sm text-gray-600'>
                  <div className='flex items-center'>
                    <Building className='h-4 w-4 mr-2' />
                    <span>Browse diving centers by location</span>
                  </div>
                  <div className='flex items-center'>
                    <Star className='h-4 w-4 mr-2' />
                    <span>Read reviews from other divers</span>
                  </div>
                  <div className='flex items-center'>
                    <Anchor className='h-4 w-4 mr-2' />
                    <span>See which dive sites they operate at</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Mobile & Accessibility */}
          <section>
            <h2 className='text-2xl font-semibold text-gray-900 mb-4 flex items-center'>
              <Smartphone className='h-6 w-6 text-blue-600 mr-2' />
              Mobile & Accessibility
            </h2>
            <div className='space-y-4'>
              <div className='bg-white border border-gray-200 rounded-lg p-6'>
                <h3 className='text-lg font-semibold text-gray-900 mb-3 flex items-center'>
                  <Smartphone className='h-5 w-5 text-blue-600 mr-2' />
                  Mobile Optimization
                </h3>
                <div className='space-y-3 text-sm text-gray-700'>
                  <div className='flex items-start'>
                    <span className='font-semibold mr-2'>•</span>
                    <span>
                      <strong>Touch-Optimized Interface:</strong> All interactions designed for
                      mobile touch devices
                    </span>
                  </div>
                  <div className='flex items-start'>
                    <span className='font-semibold mr-2'>•</span>
                    <span>
                      <strong>Responsive Design:</strong> Mobile-first approach with adaptive
                      layouts
                    </span>
                  </div>
                  <div className='flex items-start'>
                    <span className='font-semibold mr-2'>•</span>
                    <span>
                      <strong>Progressive Clustering:</strong> Performance-optimized map clustering
                      for mobile devices
                    </span>
                  </div>
                  <div className='flex items-start'>
                    <span className='font-semibold mr-2'>•</span>
                    <span>
                      <strong>Chart Interactions:</strong> Pan and zoom functionality optimized for
                      mobile touch
                    </span>
                  </div>
                </div>
              </div>

              <div className='bg-white border border-gray-200 rounded-lg p-6'>
                <h3 className='text-lg font-semibold text-gray-900 mb-3 flex items-center'>
                  <Globe className='h-5 w-5 text-blue-600 mr-2' />
                  Accessibility Features
                </h3>
                <div className='space-y-3 text-sm text-gray-700'>
                  <div className='flex items-start'>
                    <span className='font-semibold mr-2'>•</span>
                    <span>
                      <strong>High Contrast Mode:</strong> Enhanced visibility for dive profile
                      charts
                    </span>
                  </div>
                  <div className='flex items-start'>
                    <span className='font-semibold mr-2'>•</span>
                    <span>
                      <strong>Keyboard Navigation:</strong> Full keyboard support for all
                      interactive elements
                    </span>
                  </div>
                  <div className='flex items-start'>
                    <span className='font-semibold mr-2'>•</span>
                    <span>
                      <strong>Screen Reader Support:</strong> Proper ARIA labels and semantic HTML
                      structure
                    </span>
                  </div>
                  <div className='flex items-start'>
                    <span className='font-semibold mr-2'>•</span>
                    <span>
                      <strong>Alternative Data Views:</strong> Chart data available in accessible
                      formats
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Tips and Best Practices */}
          <section>
            <h2 className='text-2xl font-semibold text-gray-900 mb-4 flex items-center'>
              <Star className='h-6 w-6 text-blue-600 mr-2' />
              Tips and Best Practices
            </h2>
            <div className='bg-blue-50 rounded-lg p-4'>
              <div className='space-y-3 text-sm text-gray-700'>
                <div className='flex items-start'>
                  <span className='font-semibold mr-2'>•</span>
                  <span>Be accurate with dive site locations and depths to help other divers</span>
                </div>
                <div className='flex items-start'>
                  <span className='font-semibold mr-2'>•</span>
                  <span>
                    Include helpful details in your reviews like water temperature and visibility
                  </span>
                </div>
                <div className='flex items-start'>
                  <span className='font-semibold mr-2'>•</span>
                  <span>
                    Use the advanced search and filter features to find dive sites that match your
                    skill level
                  </span>
                </div>
                <div className='flex items-start'>
                  <span className='font-semibold mr-2'>•</span>
                  <span>
                    Import your dive profiles from Subsurface for comprehensive dive tracking
                  </span>
                </div>
                <div className='flex items-start'>
                  <span className='font-semibold mr-2'>•</span>
                  <span>
                    Export your dive profiles as PNG or PDF for sharing and record keeping
                  </span>
                </div>
                <div className='flex items-start'>
                  <span className='font-semibold mr-2'>•</span>
                  <span>Respect the community by providing constructive and honest feedback</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Full-size image modal */}
      {modalImage && (
        <div
          className='fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[9999] p-4'
          role='dialog'
          aria-modal='true'
          aria-label='Full-size image viewer'
        >
          <button
            className='absolute inset-0 w-full h-full bg-transparent'
            onClick={closeModal}
            onKeyDown={e => {
              if (e.key === 'Escape') {
                closeModal();
              }
            }}
            aria-label='Close modal'
          />
          <div className='relative max-w-7xl max-h-full'>
            <button
              onClick={closeModal}
              className='absolute top-4 right-4 z-[10000] bg-black bg-opacity-50 hover:bg-opacity-75 text-white rounded-full p-2 transition-colors'
              aria-label='Close full-size image'
            >
              <X className='h-6 w-6' />
            </button>
            <img
              src={modalImage}
              alt={modalAlt}
              className='max-w-full max-h-full object-contain rounded-lg shadow-2xl'
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Help;
