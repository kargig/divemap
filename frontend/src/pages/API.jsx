import { ExternalLink, Code, Database, Shield, Zap, BookOpen } from 'lucide-react';

import SEO from '../components/SEO';

const API = () => {
  const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  const tokenResponseExample = '{"access_token": "your_token_here"}';
  const createDiveSiteData = '{"name": "Coral Reef", "latitude": 25.7617, "longitude": -80.1918}';
  const updateDiveSiteData =
    '{"name": "Updated Coral Reef", "description": "Beautiful coral formations"}';

  return (
    <>
      <SEO 
        title='API Documentation | Divemap'
        description='Learn how to integrate with the Divemap REST API. Access interactive documentation, endpoints for dive sites, and authentication guidelines.'
      />
      <div className='max-w-4xl mx-auto'>
      <div className='bg-white rounded-lg shadow-md p-8'>
        <div className='text-center mb-8'>
          <Code className='h-16 w-16 text-blue-600 mx-auto mb-4' />
          <h1 className='text-3xl font-bold text-gray-900 mb-2'>API Documentation</h1>
          <p className='text-lg text-gray-600'>
            Learn how to integrate with the Divemap backend API
          </p>
        </div>

        <div className='grid md:grid-cols-2 gap-8 mb-8'>
          <div className='bg-blue-50 rounded-lg p-6'>
            <h2 className='text-xl font-semibold text-blue-900 mb-3 flex items-center'>
              <BookOpen className='h-5 w-5 mr-2' />
              Interactive API Docs
            </h2>
            <p className='text-blue-800 mb-4'>
              Explore the complete API documentation with interactive examples and testing
              capabilities.
            </p>
            <a
              href={`${backendUrl}/docs`}
              target='_blank'
              rel='noopener noreferrer'
              className='inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors'
            >
              <ExternalLink className='h-4 w-4 mr-2' />
              Open API Documentation
            </a>
          </div>

          <div className='bg-green-50 rounded-lg p-6'>
            <h2 className='text-xl font-semibold text-green-900 mb-3 flex items-center'>
              <Database className='h-5 w-5 mr-2' />
              Alternative Format
            </h2>
            <p className='text-green-800 mb-4'>
              View the API documentation in ReDoc format for a different reading experience.
            </p>
            <a
              href={`${backendUrl}/redoc`}
              target='_blank'
              rel='noopener noreferrer'
              className='inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors'
            >
              <ExternalLink className='h-4 w-4 mr-2' />
              Open ReDoc
            </a>
          </div>
        </div>

        <div className='bg-gray-50 rounded-lg p-6 mb-8'>
          <h2 className='text-2xl font-semibold text-gray-900 mb-4'>API Overview</h2>
          <div className='space-y-4'>
            <div className='flex items-start'>
              <Zap className='h-5 w-5 text-yellow-600 mr-3 mt-0.5' />
              <div>
                <h3 className='font-medium text-gray-900'>FastAPI Powered</h3>
                <p className='text-gray-600'>
                  Built with FastAPI for high performance, automatic validation, and comprehensive
                  documentation.
                </p>
              </div>
            </div>
            <div className='flex items-start'>
              <Shield className='h-5 w-5 text-green-600 mr-3 mt-0.5' />
              <div>
                <h3 className='font-medium text-gray-900'>Secure & Rate Limited</h3>
                <p className='text-gray-600'>
                  Includes authentication, authorization, and rate limiting to protect against
                  abuse.
                </p>
              </div>
            </div>
            <div className='flex items-start'>
              <Database className='h-5 w-5 text-blue-600 mr-3 mt-0.5' />
              <div>
                <h3 className='font-medium text-gray-900'>RESTful Design</h3>
                <p className='text-gray-600'>
                  Follows REST principles with consistent endpoint patterns and HTTP status codes.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className='bg-white border border-gray-200 rounded-lg p-6'>
          <h2 className='text-2xl font-semibold text-gray-900 mb-4'>Getting Started</h2>
          <div className='space-y-6'>
            <div>
              <h3 className='text-lg font-medium text-gray-900 mb-2'>Base URL</h3>
              <code className='bg-gray-100 px-3 py-2 rounded text-sm font-mono'>{backendUrl}</code>
            </div>

            <div>
              <h3 className='text-lg font-medium text-gray-900 mb-2'>Authentication</h3>
              <p className='text-gray-600 mb-2'>
                Most endpoints require authentication. Include your access token in the
                Authorization header:
              </p>
              <code className='bg-gray-100 px-3 py-2 rounded text-sm font-mono block overflow-x-auto'>
                Authorization: Bearer YOUR_ACCESS_TOKEN
              </code>

              <div className='mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200'>
                <h4 className='font-medium text-blue-900 mb-2'>How to Get Your Token</h4>
                <div className='space-y-4 text-blue-800 text-sm'>
                  <p>
                    For programmatic access (CLI, scripts, bots), we recommend using{' '}
                    <strong>Personal Access Tokens (PATs)</strong>. These are long-lived tokens that
                    bypass the CAPTCHA requirement.
                  </p>
                  <ol className='list-decimal list-inside space-y-2'>
                    <li>Log in to your account via the web interface.</li>
                    <li>
                      Go to your <strong>Profile</strong> settings.
                    </li>
                    <li>
                      Click on <strong>Manage API Tokens</strong> in the sidebar.
                    </li>
                    <li>
                      Generate a new token and <strong>copy it immediately</strong>.
                    </li>
                    <li>Use this token in your API requests as shown below.</li>
                  </ol>
                </div>

                <div className='mt-3 p-3 bg-white rounded border'>
                  <p className='text-blue-700 text-xs font-medium mb-2'>Example Header:</p>
                  <code className='bg-gray-100 px-2 py-1 rounded text-xs font-mono block overflow-x-auto'>
                    Authorization: Bearer dm_pat_your_token_here
                  </code>
                </div>
              </div>
            </div>

            <div>
              <h3 className='text-lg font-medium text-gray-900 mb-2'>Rate Limiting</h3>
              <p className='text-gray-600'>
                API requests are rate limited to prevent abuse. Check response headers for rate
                limit information.
              </p>
            </div>

            <div>
              <h3 className='text-lg font-medium text-gray-900 mb-2'>Response Format</h3>
              <p className='text-gray-600 mb-2'>
                All responses are returned in JSON format with consistent error handling and status
                codes.
              </p>
            </div>

            <div>
              <h3 className='text-lg font-medium text-gray-900 mb-2'>Quick Start with cURL</h3>
              <p className='text-gray-600 mb-4'>
                Here are practical examples using cURL to interact with the API:
              </p>

              <div className='space-y-4'>
                <div className='p-4 bg-blue-50 rounded-lg border border-blue-200'>
                  <h4 className='font-medium text-blue-900 mb-2'>1. List Dive Sites</h4>
                  <p className='text-blue-800 text-sm mb-3'>
                    Include your token in subsequent API requests:
                  </p>
                  <code className='bg-blue-100 px-3 py-2 rounded text-sm font-mono block overflow-x-auto text-blue-900'>
                    curl -X GET {backendUrl}/api/v1/dive-sites \
                    <br />
                    &nbsp;&nbsp;-H &quot;Authorization: Bearer dm_pat_your_token_here&quot; \
                    <br />
                    &nbsp;&nbsp;-H &quot;Content-Type: application/json&quot;
                  </code>
                </div>

                <div className='p-4 bg-purple-50 rounded-lg border border-purple-200'>
                  <h4 className='font-medium text-purple-900 mb-2'>2. Create a Dive Site</h4>
                  <p className='text-purple-800 text-sm mb-3'>
                    Example of a POST request with JSON data:
                  </p>
                  <code className='bg-purple-100 px-3 py-2 rounded text-sm font-mono block overflow-x-auto text-purple-900'>
                    curl -X POST {backendUrl}/api/v1/dive-sites \
                    <br />
                    &nbsp;&nbsp;-H &quot;Authorization: Bearer dm_pat_your_token_here&quot; \
                    <br />
                    &nbsp;&nbsp;-H &quot;Content-Type: application/json&quot; \
                    <br />
                    &nbsp;&nbsp;-d &apos;{createDiveSiteData}&apos;
                  </code>
                </div>

                <div className='p-4 bg-orange-50 rounded-lg border border-orange-200'>
                  <h4 className='font-medium text-orange-900 mb-2'>3. Update a Resource</h4>
                  <p className='text-orange-800 text-sm mb-3'>
                    Example of a PUT request to update existing data:
                  </p>
                  <code className='bg-orange-100 px-3 py-2 rounded text-sm font-mono block overflow-x-auto text-orange-900'>
                    curl -X PUT {backendUrl}/api/v1/dive-sites/123 \
                    <br />
                    &nbsp;&nbsp;-H &quot;Authorization: Bearer dm_pat_your_token_here&quot; \
                    <br />
                    &nbsp;&nbsp;-H &quot;Content-Type: application/json&quot; \
                    <br />
                    &nbsp;&nbsp;-d &apos;{updateDiveSiteData}&apos;
                  </code>
                </div>

                <div className='p-4 bg-red-50 rounded-lg border border-red-200'>
                  <h4 className='font-medium text-red-900 mb-2'>4. Delete a Resource</h4>
                  <p className='text-red-800 text-sm mb-3'>Example of a DELETE request:</p>
                  <code className='bg-red-100 px-3 py-2 rounded text-sm font-mono block overflow-x-auto text-red-900'>
                    curl -X DELETE {backendUrl}/api/v1/dive-sites/123 \
                    <br />
                    &nbsp;&nbsp;-H &quot;Authorization: Bearer dm_pat_your_token_here&quot;
                  </code>
                </div>
              </div>

              <div className='mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200'>
                <h4 className='font-medium text-gray-900 mb-2'>💡 Pro Tips</h4>
                <ul className='list-disc list-inside space-y-1 text-gray-700 text-sm'>
                  <li>
                    Save your token in a variable:{' '}
                    <code className='bg-gray-100 px-1 rounded'>
                      TOKEN=&quot;your_token_here&quot;
                    </code>
                  </li>
                  <li>
                    Use <code className='bg-gray-100 px-1 rounded'>-v</code> flag for verbose output
                    to see headers and response details
                  </li>
                  <li>
                    Add <code className='bg-gray-100 px-1 rounded'>-s</code> flag for silent mode
                    (no progress bar)
                  </li>
                  <li>
                    Use{' '}
                    <code className='bg-gray-100 px-1 rounded'>
                      -w &quot;\nHTTP Status: %{'{http_code}'}\n&quot;
                    </code>{' '}
                    to see response status codes
                  </li>
                  <li>
                    Store common headers in a file:{' '}
                    <code className='bg-gray-100 px-1 rounded'>-H @headers.txt</code>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className='mt-8 text-center'>
          <p className='text-gray-600 mb-4'>
            For detailed API specifications, examples, and testing, visit the interactive
            documentation.
          </p>
          <a
            href={`${backendUrl}/docs`}
            target='_blank'
            rel='noopener noreferrer'
            className='inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-lg font-medium'
          >
            <BookOpen className='h-5 w-5 mr-2' />
            Explore Full API Documentation
          </a>
        </div>
      </div>
    </div>
    </>
  );
};

export default API;
