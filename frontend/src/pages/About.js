import {
  ExternalLink,
  Map,
  Anchor,
  Building,
  Award,
  Calendar,
  Users,
  Shield,
  Globe,
  Code,
  Database,
  Zap,
  Smartphone,
  Wind,
  Activity,
  PenTool,
  Image,
  Search,
  Upload,
  Calculator,
  Server,
  Cpu,
} from 'lucide-react';

import usePageTitle from '../hooks/usePageTitle';

const About = () => {
  // Set page title
  usePageTitle('Divemap - About');

  return (
    <div className='max-w-5xl mx-auto'>
      <div className='bg-white rounded-lg shadow-lg p-8'>
        {/* Hero Section */}
        <div className='text-center mb-10'>
          <div className='flex justify-center items-center mb-4'>
            <h1 className='text-4xl font-bold text-gray-900'>About Divemap</h1>
          </div>
          <p className='text-xl text-gray-600 max-w-3xl mx-auto'>
            The advanced open-source platform for scuba divers. Discover sites, analyze dive
            telemetry, plan technical dives, and connect with the global community.
          </p>
        </div>

        {/* Mission & PWA */}
        <div className='grid md:grid-cols-2 gap-8 mb-10'>
          <div>
            <h2 className='text-2xl font-semibold text-gray-900 mb-4 flex items-center'>
              <Anchor className='h-6 w-6 text-blue-600 mr-2' />
              What is Divemap?
            </h2>
            <p className='text-gray-700 mb-4'>
              Divemap is an open-source platform designed to connect the global diving community. It
              provides a comprehensive solution for discovering dive sites, managing diving centers,
              tracking certifications, and logging dive experiences.
            </p>
            <p className='text-gray-700'>
              Whether you're logging your first open water dive or planning a trimix expedition,
              Divemap provides the data and tools you need in a modern, accessible interface.
            </p>
          </div>

          <div className='bg-blue-50 rounded-lg p-6'>
            <h2 className='text-2xl font-semibold text-gray-900 mb-4 flex items-center'>
              <Smartphone className='h-6 w-6 text-blue-600 mr-2' />
              Mobile First & PWA
            </h2>
            <p className='text-gray-700 mb-4'>
              Install Divemap as a native app on iOS, Android, and Desktop.
            </p>
            <ul className='space-y-2 text-gray-700'>
              <li className='flex items-center'>
                <Zap className='h-4 w-4 text-blue-600 mr-2' />
                Offline-ready architecture
              </li>
              <li className='flex items-center'>
                <Zap className='h-4 w-4 text-blue-600 mr-2' />
                Touch-optimized interactive charts
              </li>
              <li className='flex items-center'>
                <Zap className='h-4 w-4 text-blue-600 mr-2' />
                Full feature parity across all devices
              </li>
            </ul>
          </div>
        </div>

        {/* Advanced Features Grid (New Features) */}
        <div className='mb-12'>
          <h2 className='text-2xl font-semibold text-gray-900 mb-6 flex items-center border-b pb-2'>
            <Globe className='h-6 w-6 text-blue-600 mr-2' />
            Advanced Diving Tools
          </h2>
          <div className='grid md:grid-cols-3 gap-6'>
            <div className='p-4 border rounded-lg hover:shadow-md transition-shadow'>
              <h3 className='text-lg font-semibold text-gray-900 mb-2 flex items-center'>
                <Activity className='h-5 w-5 text-green-600 mr-2' />
                Dive Telemetry
              </h3>
              <p className='text-sm text-gray-600'>
                Visualize dive profiles with interactive charts. Analyze depth, temperature,
                decompression ceilings, and gas switches with precision.
              </p>
            </div>

            <div className='p-4 border rounded-lg hover:shadow-md transition-shadow'>
              <h3 className='text-lg font-semibold text-gray-900 mb-2 flex items-center'>
                <Wind className='h-5 w-5 text-blue-500 mr-2' />
                Weather Intelligence
              </h3>
              <p className='text-sm text-gray-600'>
                Real-time wind overlays and intelligent site suitability recommendations based on
                live weather data.
              </p>
            </div>

            <div className='p-4 border rounded-lg hover:shadow-md transition-shadow'>
              <h3 className='text-lg font-semibold text-gray-900 mb-2 flex items-center'>
                <PenTool className='h-5 w-5 text-orange-500 mr-2' />
                Route Planning
              </h3>
              <p className='text-sm text-gray-600'>
                Draw and measure complex multi-segment dive routes. Add markers for points of
                interest and share them with buddies.
              </p>
            </div>

            <div className='p-4 border rounded-lg hover:shadow-md transition-shadow'>
              <h3 className='text-lg font-semibold text-gray-900 mb-2 flex items-center'>
                <Calculator className='h-5 w-5 text-purple-600 mr-2' />
                Tech Tools
              </h3>
              <p className='text-sm text-gray-600'>
                Built-in physics engine for MOD, Best Mix, SAC Rate, and Minimum Gas (Rock Bottom)
                calculations.
              </p>
            </div>

            <div className='p-4 border rounded-lg hover:shadow-md transition-shadow'>
              <h3 className='text-lg font-semibold text-gray-900 mb-2 flex items-center'>
                <Upload className='h-5 w-5 text-gray-600 mr-2' />
                Seamless Import
              </h3>
              <p className='text-sm text-gray-600'>
                Migrate effortlessly from Subsurface. Import your entire XML logbook and
                automatically match sites.
              </p>
            </div>

            <div className='p-4 border rounded-lg hover:shadow-md transition-shadow'>
              <h3 className='text-lg font-semibold text-gray-900 mb-2 flex items-center'>
                <Image className='h-5 w-5 text-pink-600 mr-2' />
                Media Gallery
              </h3>
              <p className='text-sm text-gray-600'>
                Immersive lightbox experience for dive photos and videos with deep linking and
                drag-and-drop organization.
              </p>
            </div>
          </div>
        </div>

        {/* Core Capabilities (Restored & Enhanced) */}
        <div className='grid md:grid-cols-2 gap-8 mb-8'>
          <div>
            <h2 className='text-2xl font-semibold text-gray-900 mb-4 flex items-center'>
              <Database className='h-6 w-6 text-blue-600 mr-2' />
              Comprehensive Ecosystem
            </h2>
            <div className='space-y-3 text-gray-700'>
              <p>
                <strong>Dive Site Management:</strong> Complete CRUD operations with detailed
                information including maximum depth, aliases, country, and region.
              </p>
              <p>
                <strong>Diving Center Management:</strong> Full management with gear rental costs,
                services (Nitrox/Trimix), and dive site associations.
              </p>
              <p>
                <strong>Ratings & Comments:</strong> Community-driven rating system with user
                comments and diving credentials display.
              </p>
              <p>
                <strong>Global Search:</strong> <Search className='inline h-4 w-4' /> Unified navbar
                search to find sites, centers, or users instantly.
              </p>
            </div>
          </div>

          <div>
            <h2 className='text-2xl font-semibold text-gray-900 mb-4 flex items-center'>
              <Cpu className='h-6 w-6 text-purple-600 mr-2' />
              AI & Automation
            </h2>
            <div className='space-y-3 text-gray-700'>
              <p>
                <strong>Smart Newsletter Parsing:</strong> OpenAI integration automatically extracts
                dive trips from center newsletters.
              </p>
              <p>
                <strong>Intelligent Matching:</strong> Algorithms to match diving centers and
                locations from unstructured text.
              </p>
              <p>
                <strong>Alias Recognition:</strong> Smart detection of dive sites using known
                aliases and variations.
              </p>
              <p>
                <strong>Trip Aggregation:</strong> Automatically organizes extracted trips into a
                searchable global calendar.
              </p>
            </div>
          </div>
        </div>

        {/* Technology Stack (Restored) */}
        <div className='bg-gray-50 rounded-lg p-6 mb-8'>
          <h2 className='text-2xl font-semibold text-gray-900 mb-4 flex items-center'>
            <Code className='h-6 w-6 text-blue-600 mr-2' />
            Technology Stack
          </h2>
          <div className='grid md:grid-cols-2 gap-6'>
            <div>
              <h3 className='text-lg font-semibold text-gray-900 mb-2'>Frontend</h3>
              <ul className='space-y-1 text-gray-700'>
                <li>• React with React Router DOM</li>
                <li>• React Query for data management</li>
                <li>• Tailwind CSS & Ant Design for styling</li>
                <li>• Leaflet for interactive maps</li>
                <li>• Google Identity Services for OAuth</li>
                <li>• Vite for high-performance tooling</li>
              </ul>
            </div>
            <div>
              <h3 className='text-lg font-semibold text-gray-900 mb-2'>Backend</h3>
              <ul className='space-y-1 text-gray-700'>
                <li>• Python with FastAPI (High Performance)</li>
                <li>• SQLAlchemy ORM (Async)</li>
                <li>• Alembic for database migrations</li>
                <li>• MySQL 8.0 database (Spatial Support)</li>
                <li>• Docker containerization</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Security & Performance (Restored) */}
        <div className='mb-10'>
          <h2 className='text-2xl font-semibold text-gray-900 mb-4 flex items-center'>
            <Shield className='h-6 w-6 text-green-600 mr-2' />
            Security & Performance
          </h2>
          <div className='grid md:grid-cols-2 gap-6 text-gray-700'>
            <ul className='space-y-2'>
              <li className='flex items-start'>
                <Server className='h-4 w-4 text-green-600 mr-2 mt-1' />
                <span>
                  <strong>Authentication:</strong> Secure JWT-based auth with Google OAuth and
                  automatic refresh token rotation.
                </span>
              </li>
              <li className='flex items-start'>
                <Server className='h-4 w-4 text-green-600 mr-2 mt-1' />
                <span>
                  <strong>Rate Limiting:</strong> Comprehensive API rate limiting with admin
                  exemptions to prevent abuse.
                </span>
              </li>
              <li className='flex items-start'>
                <Server className='h-4 w-4 text-green-600 mr-2 mt-1' />
                <span>
                  <strong>Input Validation:</strong> Rigorous Pydantic (backend) and Zod (frontend)
                  schema validation.
                </span>
              </li>
            </ul>
            <ul className='space-y-2'>
              <li className='flex items-start'>
                <Zap className='h-4 w-4 text-green-600 mr-2 mt-1' />
                <span>
                  <strong>Infrastructure:</strong> Reverse Proxy architecture with Nginx and
                  Cloudflare Turnstile protection.
                </span>
              </li>
              <li className='flex items-start'>
                <Zap className='h-4 w-4 text-green-600 mr-2 mt-1' />
                <span>
                  <strong>Optimization:</strong> Pre-compiled wheels, IPv6 support, and `orjson`
                  serialization for speed.
                </span>
              </li>
              <li className='flex items-start'>
                <Zap className='h-4 w-4 text-green-600 mr-2 mt-1' />
                <span>
                  <strong>Database:</strong> Alembic-based version-controlled schema management.
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className='text-center bg-gray-900 text-white rounded-xl p-8'>
          <h2 className='text-2xl font-semibold mb-4 text-white'>Open Source & Community</h2>
          <p className='text-gray-300 mb-6 max-w-2xl mx-auto'>
            Divemap is an open-source project licensed under the Apache License 2.0. We welcome
            contributions from developers and divers worldwide.
          </p>
          <div className='flex justify-center space-x-4'>
            <a
              href='https://github.com/kargig/divemap'
              target='_blank'
              rel='noopener noreferrer'
              className='inline-flex items-center px-6 py-3 bg-white text-gray-900 rounded-lg hover:bg-gray-100 transition-colors'
            >
              <Code className='h-5 w-5 mr-2' />
              View Source
            </a>
            <a
              href='/register'
              className='inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors'
            >
              <Users className='h-5 w-5 mr-2' />
              Sign Up Free
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;
