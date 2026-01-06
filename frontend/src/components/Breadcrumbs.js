import { ChevronRight, Home } from 'lucide-react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

const Breadcrumbs = ({ items }) => {
  if (!items || items.length === 0) return null;

  return (
    <nav className='flex mb-4 text-sm text-gray-500 overflow-x-auto whitespace-nowrap pb-2 md:pb-0'>
      <Link
        to='/'
        className='flex items-center hover:text-blue-600 transition-colors flex-shrink-0'
      >
        <Home className='h-4 w-4 mr-1' />
        Home
      </Link>

      {items.map((item, index) => (
        <div key={index} className='flex items-center flex-shrink-0'>
          <ChevronRight className='h-4 w-4 mx-2 text-gray-400' />
          {item.to ? (
            <Link to={item.to} className='hover:text-blue-600 transition-colors'>
              {item.label}
            </Link>
          ) : (
            <span className='font-medium text-gray-900'>{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  );
};

Breadcrumbs.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      to: PropTypes.string,
    })
  ).isRequired,
};

export default Breadcrumbs;
