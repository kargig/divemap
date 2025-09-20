import {
  Map,
  Anchor,
  Award,
  Building,
  Search,
  Upload,
  Edit,
  Plus,
  Filter,
  Calendar,
  MapPin,
  Star,
  MessageSquare,
  FileText,
  Users,
  Eye,
} from 'lucide-react';

import usePageTitle from '../hooks/usePageTitle';

const Help = () => {
  // Set page title
  usePageTitle('Divemap - Help');
  return (
    <div className='max-w-4xl mx-auto'>
      <div className='bg-white rounded-lg shadow-lg p-8'>
        <div className='text-center mb-8'>
          <div className='flex justify-center items-center mb-4'>
            <h1 className='text-4xl font-bold text-gray-900'>Help & User Guide</h1>
          </div>
          <p className='text-xl text-gray-600'>
            Learn how to use Divemap&apos;s features to discover dive sites, log your dives, and
            connect with the diving community.
          </p>
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
                Welcome to Divemap! This guide will help you navigate the platform and make the most
                of its features.
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
              <div className='bg-gray-50 rounded-lg p-4'>
                <h3 className='text-lg font-semibold text-gray-900 mb-2'>Browse Dive Sites</h3>
                <p className='text-gray-700 mb-3'>
                  Navigate to the &quot;Dive Sites&quot; section to explore dive locations around
                  the world.
                </p>
                <div className='space-y-2 text-sm text-gray-600'>
                  <div className='flex items-center'>
                    <Search className='h-4 w-4 mr-2' />
                    <span>Use the search bar to find specific dive sites</span>
                  </div>
                  <div className='flex items-center'>
                    <Filter className='h-4 w-4 mr-2' />
                    <span>Apply filters by country, region, or maximum depth</span>
                  </div>
                  <div className='flex items-center'>
                    <Map className='h-4 w-4 mr-2' />
                    <span>View dive sites on an interactive map</span>
                  </div>
                </div>
              </div>

              <div className='bg-gray-50 rounded-lg p-4'>
                <h3 className='text-lg font-semibold text-gray-900 mb-2'>Dive Site Details</h3>
                <p className='text-gray-700 mb-3'>
                  Click on any dive site to view detailed information including ratings, comments,
                  and location details.
                </p>
                <div className='space-y-2 text-sm text-gray-600'>
                  <div className='flex items-center'>
                    <Star className='h-4 w-4 mr-2' />
                    <span>See community ratings and read reviews</span>
                  </div>
                  <div className='flex items-center'>
                    <MessageSquare className='h-4 w-4 mr-2' />
                    <span>Read comments from other divers</span>
                  </div>
                  <div className='flex items-center'>
                    <Map className='h-4 w-4 mr-2' />
                    <span>View the exact location on a map</span>
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
                <h3 className='text-lg font-semibold text-gray-900 mb-2'>Logging Your Dives</h3>
                <p className='text-gray-700 mb-3'>
                  Keep track of your diving adventures with our comprehensive dive logging system.
                </p>
                <div className='space-y-2 text-sm text-gray-600'>
                  <div className='flex items-center'>
                    <Calendar className='h-4 w-4 mr-2' />
                    <span>Record dive date, duration, and depth</span>
                  </div>
                  <div className='flex items-center'>
                    <MapPin className='h-4 w-4 mr-2' />
                    <span>Link your dive to a specific dive site</span>
                  </div>
                  <div className='flex items-center'>
                    <Upload className='h-4 w-4 mr-2' />
                    <span>Upload photos and videos from your dive</span>
                  </div>
                  <div className='flex items-center'>
                    <FileText className='h-4 w-4 mr-2' />
                    <span>Add notes about marine life and conditions</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Importing Dives */}
          <section>
            <h2 className='text-2xl font-semibold text-gray-900 mb-4 flex items-center'>
              <Upload className='h-6 w-6 text-blue-600 mr-2' />
              Importing Dives from Subsurface
            </h2>
            <div className='bg-yellow-50 rounded-lg p-4'>
              <p className='text-gray-700 mb-3'>
                Easily import your existing dive logs from Subsurface XML files.
              </p>
              <div className='space-y-2 text-sm text-gray-600'>
                <div className='flex items-center'>
                  <FileText className='h-4 w-4 mr-2' />
                  <span>Export your dive log as XML from Subsurface</span>
                </div>
                <div className='flex items-center'>
                  <Upload className='h-4 w-4 mr-2' />
                  <span>Use the import feature in the Dives section</span>
                </div>
                <div className='flex items-center'>
                  <MapPin className='h-4 w-4 mr-2' />
                  <span>Dive sites will be automatically matched or created</span>
                </div>
                <div className='flex items-center'>
                  <Edit className='h-4 w-4 mr-2' />
                  <span>Review and edit imported data before saving</span>
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
                    Use the search and filter features to find dive sites that match your skill
                    level
                  </span>
                </div>
                <div className='flex items-start'>
                  <span className='font-semibold mr-2'>•</span>
                  <span>
                    Keep your dive log updated for better tracking of your diving progress
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
    </div>
  );
};

export default Help;
