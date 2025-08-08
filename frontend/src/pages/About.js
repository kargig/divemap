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
} from 'lucide-react';

const About = () => {
  return (
    <div className='max-w-4xl mx-auto'>
      <div className='bg-white rounded-lg shadow-lg p-8'>
        <div className='text-center mb-8'>
          <div className='flex justify-center items-center mb-4'>
            <Map className='h-12 w-12 text-blue-600 mr-3' />
            <h1 className='text-4xl font-bold text-gray-900'>About Divemap</h1>
          </div>
          <p className='text-xl text-gray-600'>
            A comprehensive web application for scuba diving enthusiasts to discover, rate, and
            review dive sites and diving centers.
          </p>
        </div>

        <div className='grid md:grid-cols-2 gap-8 mb-8'>
          <div>
            <h2 className='text-2xl font-semibold text-gray-900 mb-4 flex items-center'>
              <Anchor className='h-6 w-6 text-blue-600 mr-2' />
              What is Divemap?
            </h2>
            <p className='text-gray-700 mb-4'>
              Divemap is an open-source platform designed to connect the global diving community.
              provides a comprehensive solution for discovering dive sites, managing diving centers,
              tracking certifications, and logging dive experiences.
            </p>
            <p className='text-gray-700'>
              Built with modern web technologies, Divemap offers an intuitive interface for both
              recreational divers and diving professionals to share knowledge and experiences.
            </p>
          </div>

          <div>
            <h2 className='text-2xl font-semibold text-gray-900 mb-4 flex items-center'>
              <Globe className='h-6 w-6 text-blue-600 mr-2' />
              Key Features
            </h2>
            <ul className='space-y-2 text-gray-700'>
              <li className='flex items-center'>
                <Map className='h-4 w-4 text-blue-600 mr-2' />
                Interactive dive site mapping and discovery
              </li>
              <li className='flex items-center'>
                <Building className='h-4 w-4 text-blue-600 mr-2' />
                Diving center management and reviews
              </li>
              <li className='flex items-center'>
                <Award className='h-4 w-4 text-blue-600 mr-2' />
                Certification tracking and organization management
              </li>
              <li className='flex items-center'>
                <Calendar className='h-4 w-4 text-blue-600 mr-2' />
                Dive logging with media uploads and statistics
              </li>
              <li className='flex items-center'>
                <Users className='h-4 w-4 text-blue-600 mr-2' />
                Community-driven ratings and comments
              </li>
            </ul>
          </div>
        </div>

        <div className='bg-blue-50 rounded-lg p-6 mb-8'>
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
                <li>• Tailwind CSS for styling</li>
                <li>• OpenLayers for interactive maps</li>
                <li>• Google Identity Services for OAuth</li>
              </ul>
            </div>
            <div>
              <h3 className='text-lg font-semibold text-gray-900 mb-2'>Backend</h3>
              <ul className='space-y-1 text-gray-700'>
                <li>• Python with FastAPI</li>
                <li>• SQLAlchemy ORM</li>
                <li>• Alembic for database migrations</li>
                <li>• MySQL database</li>
                <li>• Docker containerization</li>
              </ul>
            </div>
          </div>
        </div>

        <div className='grid md:grid-cols-2 gap-8 mb-8'>
          <div>
            <h2 className='text-2xl font-semibold text-gray-900 mb-4 flex items-center'>
              <Database className='h-6 w-6 text-blue-600 mr-2' />
              Core Capabilities
            </h2>
            <div className='space-y-3 text-gray-700'>
              <p>
                <strong>Dive Logging:</strong> Comprehensive dive logging system with media uploads,
                tags, and statistics.
              </p>
              <p>
                <strong>Dive Site Management:</strong> Complete CRUD operations with detailed
                information including maximum depth, aliases, country, and region.
              </p>
              <p>
                <strong>Diving Center Management:</strong> Full management with gear rental costs
                and dive site associations.
              </p>
              <p>
                <strong>Newsletter Parsing & Diving Trips:</strong> AI-powered newsletter parsing
                with automatic dive trip extraction and management.
              </p>
              <p>
                <strong>Ratings & Comments:</strong> Community-driven rating system with user
                comments and diving credentials display.
              </p>
            </div>
          </div>

          <div>
            <h2 className='text-2xl font-semibold text-gray-900 mb-4 flex items-center'>
              <Shield className='h-6 w-6 text-blue-600 mr-2' />
              Security & Performance
            </h2>
            <div className='space-y-3 text-gray-700'>
              <p>
                <strong>Authentication:</strong> JWT-based authentication with Google OAuth
                integration.
              </p>
              <p>
                <strong>Rate Limiting:</strong> Comprehensive API rate limiting with admin
                exemptions.
              </p>
              <p>
                <strong>Input Validation:</strong> Client and server-side validation for all user
                inputs.
              </p>
              <p>
                <strong>Database Migrations:</strong> Alembic-based version-controlled schema
                management.
              </p>
              <p>
                <strong>Container Optimization:</strong> Pre-compiled wheels and IPv6 support for
                cloud deployment.
              </p>
            </div>
          </div>
        </div>

        <div className='bg-green-50 rounded-lg p-6 mb-8'>
          <h2 className='text-2xl font-semibold text-gray-900 mb-4 flex items-center'>
            <Zap className='h-6 w-6 text-green-600 mr-2' />
            Advanced Features
          </h2>
          <div className='grid md:grid-cols-2 gap-6'>
            <div>
              <h3 className='text-lg font-semibold text-gray-900 mb-2'>AI-Powered Features</h3>
              <ul className='space-y-1 text-gray-700'>
                <li>• OpenAI integration for newsletter parsing</li>
                <li>• Automatic dive trip extraction</li>
                <li>• Intelligent diving center matching</li>
                <li>• Dive site recognition using aliases</li>
              </ul>
            </div>
            <div>
              <h3 className='text-lg font-semibold text-gray-900 mb-2'>Community Features</h3>
              <ul className='space-y-1 text-gray-700'>
                <li>• User ratings and reviews</li>
                <li>• Comment system with diving credentials</li>
                <li>• Tag system for categorization</li>
                <li>• Ownership claiming for diving centers</li>
              </ul>
            </div>
          </div>
        </div>

        <div className='text-center'>
          <h2 className='text-2xl font-semibold text-gray-900 mb-4'>Open Source</h2>
          <p className='text-gray-700 mb-6'>
            Divemap is an open-source project licensed under the Apache License, Version 2.0.
            welcome contributions from the diving community and developers worldwide.
          </p>
          <a
            href='https://github.com/kargig/divemap'
            target='_blank'
            rel='noopener noreferrer'
            className='inline-flex items-center px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors'
          >
            <ExternalLink className='h-5 w-5 mr-2' />
            View on GitHub
          </a>
        </div>
      </div>
    </div>
  );
};

export default About;
