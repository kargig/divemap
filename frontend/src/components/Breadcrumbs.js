import { ChevronRight, Home } from 'lucide-react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

const Breadcrumbs = ({ items }) => {
  if (!items || items.length === 0) return null;

  return (
    <nav className='flex flex-wrap items-center text-sm text-gray-500 gap-y-2'>
      <Link to='/' className='flex items-center hover:text-blue-600 transition-colors'>
        <Home className='h-3.5 w-3.5 mr-1' />
        <span className='leading-tight mt-1'>Home</span>
      </Link>

      {items.map((item, index) => (
        <div key={index} className='flex items-center'>
          <ChevronRight className='h-3.5 w-3.5 mx-2 text-gray-400 flex-shrink-0' />
          {item.to ? (
            <Link to={item.to} className='hover:text-blue-600 transition-colors flex items-center'>
              <span className='leading-tight mt-1'>{item.label}</span>
            </Link>
          ) : (
            <span className='font-medium text-gray-900 leading-tight mt-1'>{item.label}</span>
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
