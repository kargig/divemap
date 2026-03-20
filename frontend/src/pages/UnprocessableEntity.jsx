import { AlertCircle, Search, Home } from 'lucide-react';
import { Link } from 'react-router-dom';

import SEO from '../components/SEO';

const UnprocessableEntity = () => {
  return (
    <div className='min-h-[70vh] flex flex-col items-center justify-center px-4 py-12 text-center'>
      <SEO
        title='Invalid Request - Divemap'
        description='The request could not be processed due to invalid data or parameters.'
        type='website'
      />

      <div className='bg-red-50 rounded-full p-6 mb-6'>
        <AlertCircle className='h-16 w-16 text-red-600 opacity-50' />
      </div>

      <h1 className='text-4xl font-extrabold text-gray-900 mb-4'>Invalid Request</h1>
      <p className='text-xl text-gray-600 mb-8 max-w-md'>
        The data requested could not be processed. This might happen if the link is malformed or
        contains invalid parameters.
      </p>

      <div className='flex flex-col sm:flex-row gap-4 w-full max-w-md justify-center'>
        <Link
          to='/'
          className='flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 md:text-lg transition-colors shadow-sm'
        >
          <Home className='h-5 w-5 mr-2' />
          Go Home
        </Link>
        <Link
          to='/dive-sites'
          className='flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-blue-600 bg-white hover:bg-gray-50 md:text-lg transition-colors shadow-sm'
        >
          <Search className='h-5 w-5 mr-2' />
          Explore Sites
        </Link>
      </div>

      <div className='mt-12 text-sm text-gray-500'>
        <p>Looking for something specific?</p>
        <div className='flex justify-center gap-4 mt-2'>
          <Link to='/diving-centers' className='hover:text-blue-600 underline'>
            Diving Centers
          </Link>
          <Link to='/dive-trips' className='hover:text-blue-600 underline'>
            Dive Trips
          </Link>
          <Link to='/dives' className='hover:text-blue-600 underline'>
            Dive Log
          </Link>
        </div>
      </div>
    </div>
  );
};

export default UnprocessableEntity;
