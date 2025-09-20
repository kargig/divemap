import { ExternalLink, FileText, Github, Calendar, Users, Code, Shield } from 'lucide-react';
import React from 'react';

import usePageTitle from '../hooks/usePageTitle';

const Changelog = () => {
  // Set page title
  usePageTitle('Divemap - Changelog');
  return (
    <div className='min-h-screen bg-gray-50 pt-20'>
      <div className='max-w-4xl mx-auto px-4 py-8'>
        {/* Header */}
        <div className='text-center mb-12'>
          <div className='flex justify-center mb-4'>
            <FileText className='h-16 w-16 text-blue-600' />
          </div>
          <h1 className='text-4xl font-bold text-gray-900 mb-4'>Changelog</h1>
          <p className='text-xl text-gray-600 max-w-2xl mx-auto'>
            Track all recent changes, improvements, and bug fixes to the Divemap application
          </p>
        </div>

        {/* Main Content */}
        <div className='bg-white rounded-lg shadow-lg p-8 mb-8'>
          <div className='prose prose-lg max-w-none'>
            <h2 className='text-2xl font-semibold text-gray-900 mb-6 flex items-center'>
              <Calendar className='h-6 w-6 mr-3 text-blue-600' />
              Latest Release - August 24, 2025
            </h2>

            <div className='grid md:grid-cols-2 gap-6 mb-8'>
              <div className='bg-blue-50 p-6 rounded-lg border border-blue-200'>
                <h3 className='text-lg font-semibold text-blue-900 mb-3 flex items-center'>
                  🚀 Major Features
                </h3>
                <ul className='text-blue-800 space-y-2'>
                  <li>• Nginx Reverse Proxy Architecture with Refresh Token Authentication</li>
                  <li>• Enhanced Newsletter Parsing System with Greek Date Support</li>
                  <li>• Diving Center Reverse Geocoding System</li>
                  <li>• Comprehensive Hero Section and Logo Integration</li>
                </ul>
              </div>

              <div className='bg-green-50 p-6 rounded-lg border border-green-200'>
                <h3 className='text-lg font-semibold text-green-900 mb-3 flex items-center'>
                  🔧 API Changes
                </h3>
                <ul className='text-green-800 space-y-2'>
                  <li>• Rate Limiting Enhancements (1.5x multiplier)</li>
                  <li>• Dive Sites API Improvements</li>
                  <li>• Diving Centers API Enhancements</li>
                  <li>• Enhanced Authorization System</li>
                </ul>
              </div>
            </div>

            <div className='grid md:grid-cols-2 gap-6 mb-8'>
              <div className='bg-orange-50 p-6 rounded-lg border border-orange-200'>
                <h3 className='text-lg font-semibold text-orange-900 mb-3 flex items-center'>
                  🐛 Bug Fixes
                </h3>
                <ul className='text-orange-800 space-y-2'>
                  <li>• Frontend Linting and Code Quality</li>
                  <li>• UI/UX Issues Resolution</li>
                  <li>• Nginx and Infrastructure Fixes</li>
                  <li>• Database and Backend Fixes</li>
                </ul>
              </div>

              <div className='bg-purple-50 p-6 rounded-lg border border-purple-200'>
                <h3 className='text-lg font-semibold text-purple-900 mb-3 flex items-center'>
                  🔒 Security Enhancements
                </h3>
                <ul className='text-purple-800 space-y-2'>
                  <li>• Comprehensive Authentication System</li>
                  <li>• Token Rotation & Audit Logging</li>
                  <li>• Enhanced Authorization Controls</li>
                  <li>• Security Monitoring & Logging</li>
                </ul>
              </div>
            </div>

            <div className='bg-gray-50 p-6 rounded-lg border border-gray-200 mb-8'>
              <h3 className='text-lg font-semibold text-gray-900 mb-3 flex items-center'>
                🚀 Infrastructure Changes
              </h3>
              <ul className='text-gray-800 space-y-2'>
                <li>• Nginx Reverse Proxy Architecture for Development & Production</li>
                <li>• Docker and Container Updates with Optimized Builds</li>
                <li>• Fly.io Production Deployment with SSL Termination</li>
                <li>• Enhanced Environment Management and Configuration</li>
              </ul>
            </div>
          </div>
        </div>

        {/* GitHub Link Section */}
        <div className='bg-white rounded-lg shadow-lg p-8 mb-8'>
          <div className='text-center'>
            <div className='flex justify-center mb-4'>
              <Github className='h-12 w-12 text-gray-800' />
            </div>
            <h2 className='text-2xl font-semibold text-gray-900 mb-4'>View Complete Changelog</h2>
            <p className='text-gray-600 mb-6 max-w-2xl mx-auto'>
              For detailed information about all changes, bug fixes, and improvements, visit our
              complete changelog on GitHub. This includes comprehensive technical details, file
              changes, and implementation specifics.
            </p>
            <a
              href='https://github.com/kargig/divemap/blob/main/docs/maintenance/changelog.md'
              target='_blank'
              rel='noopener noreferrer'
              className='inline-flex items-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-lg hover:shadow-xl'
            >
              <FileText className='h-5 w-5 mr-2' />
              View Full Changelog
              <ExternalLink className='h-4 w-4 ml-2' />
            </a>
          </div>
        </div>

        {/* Additional Information */}
        <div className='bg-white rounded-lg shadow-lg p-8'>
          <h2 className='text-2xl font-semibold text-gray-900 mb-6 text-center'>
            What&apos;s in the Changelog?
          </h2>

          <div className='grid md:grid-cols-3 gap-6'>
            <div className='text-center'>
              <div className='flex justify-center mb-3'>
                <Users className='h-8 w-8 text-blue-600' />
              </div>
              <h3 className='font-semibold text-gray-900 mb-2'>User Experience</h3>
              <p className='text-gray-600 text-sm'>
                New features, UI improvements, and mobile optimizations that enhance how you
                interact with Divemap.
              </p>
            </div>

            <div className='text-center'>
              <div className='flex justify-center mb-3'>
                <Code className='h-8 w-8 text-green-600' />
              </div>
              <h3 className='font-semibold text-gray-900 mb-2'>Technical Improvements</h3>
              <p className='text-gray-600 text-sm'>
                API enhancements, performance optimizations, and backend improvements that make the
                platform faster and more reliable.
              </p>
            </div>

            <div className='text-center'>
              <div className='flex justify-center mb-3'>
                <Shield className='h-8 w-8 text-purple-600' />
              </div>
              <h3 className='font-semibold text-gray-900 mb-2'>Security & Stability</h3>
              <p className='text-gray-600 text-sm'>
                Security enhancements, bug fixes, and infrastructure updates that keep your data
                safe and the platform stable.
              </p>
            </div>
          </div>

          <div className='mt-8 text-center'>
            <p className='text-gray-600 mb-4'>
              The changelog follows the{' '}
              <a
                href='https://keepachangelog.com/en/1.1.0/'
                target='_blank'
                rel='noopener noreferrer'
                className='text-blue-600 hover:text-blue-800 underline'
              >
                Keep a Changelog
              </a>{' '}
              standard for clear, user-friendly documentation of all changes.
            </p>
            <p className='text-sm text-gray-500'>Last updated: August 24, 2025</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Changelog;
