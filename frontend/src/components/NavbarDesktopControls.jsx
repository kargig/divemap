import { Dropdown } from 'antd';
import {
  Home,
  MapPin,
  Settings,
  Activity,
  Clock,
  FileText,
  Info,
  ChevronDown,
  User,
  Map,
  MessageSquare,
  Building,
  Tags,
  Notebook,
  Calendar,
  HelpCircle,
  Shield,
  Code,
  Bell,
  BarChart3,
  Award,
  Calculator,
  Compass,
  Route,
  LogOut,
  Users,
  Crown,
  History,
  Trophy,
} from 'lucide-react';
import { useQuery } from 'react-query';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';

import GlobalSearchBar from './GlobalSearchBar';
import NotificationBell from './NotificationBell';
import Button from './ui/Button';
import ChatDropdown from './UserChat/ChatDropdown';

const NavbarDesktopControls = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <>
      {/* Desktop Search Bar */}
      <div className='hidden md:flex flex-1 max-w-xl mx-6'>
        <GlobalSearchBar
          className='w-full'
          inputClassName='bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder-gray-300 focus:bg-white focus:text-gray-900'
          placeholder='Search dives, sites, centers...'
        />
      </div>

      {/* Desktop Navigation */}
      <div className='hidden md:flex items-center space-x-6'>
        <Link
          to='/'
          className='flex items-center space-x-1 text-white hover:text-blue-200 transition-colors'
        >
          <Home className='h-6 w-6' />
          <span className='text-sm'>Home</span>
        </Link>

        <Link
          to='/map'
          className='flex items-center space-x-1 text-white hover:text-blue-200 transition-colors'
        >
          <MapPin className='h-6 w-6' />
          <span className='text-sm'>Map</span>
        </Link>

        <Dropdown
          menu={{
            items: [
              {
                key: 'dive-log',
                label: 'Dive Log',
                icon: <Notebook className='h-4 w-4' />,
                onClick: () => navigate('/dives'),
              },
              {
                key: 'dive-sites',
                label: 'Dive Sites',
                icon: <Map className='h-4 w-4' />,
                onClick: () => navigate('/dive-sites'),
              },
              {
                key: 'dive-routes',
                label: 'Dive Routes',
                icon: <Route className='h-4 w-4' />,
                onClick: () => navigate('/dive-routes'),
              },
              {
                key: 'diving-centers',
                label: 'Diving Centers',
                icon: <Building className='h-4 w-4' />,
                onClick: () => navigate('/diving-centers'),
              },
              {
                key: 'dive-trips',
                label: 'Dive Trips',
                icon: <Calendar className='h-4 w-4' />,
                onClick: () => navigate('/dive-trips'),
              },
              {
                key: 'tools',
                label: 'Tools',
                icon: <Calculator className='h-4 w-4' />,
                onClick: () => navigate('/resources/tools'),
              },
              {
                key: 'diving-organizations',
                label: 'Diving Organizations',
                icon: <Award className='h-4 w-4' />,
                onClick: () => navigate('/resources/diving-organizations'),
              },
              {
                key: 'tags',
                label: 'Tags',
                icon: <Tags className='h-4 w-4' />,
                onClick: () => navigate('/resources/tags'),
              },
            ],
          }}
          trigger={['click']}
          placement='bottomRight'
        >
          <button className='flex items-center space-x-1 text-white hover:text-blue-200 transition-colors'>
            <Compass className='h-6 w-6' />
            <span className='text-sm'>Dive / Explore</span>
            <ChevronDown className='h-4 w-4' />
          </button>
        </Dropdown>

        <Link
          to='/leaderboard'
          className='flex items-center space-x-1 text-white hover:text-blue-200 transition-colors'
        >
          <Trophy className='h-6 w-6' />
          <span className='text-sm'>Community</span>
        </Link>

        <Dropdown
          menu={{
            items: [
              {
                key: 'about',
                label: 'About',
                icon: <Info className='h-4 w-4' />,
                onClick: () => navigate('/about'),
              },
              {
                key: 'api-docs',
                label: 'API',
                icon: <Code className='h-4 w-4' />,
                onClick: () => navigate('/api-docs'),
              },
              {
                key: 'changelog',
                label: 'Changelog',
                icon: <FileText className='h-4 w-4' />,
                onClick: () => navigate('/changelog'),
              },
              {
                key: 'help',
                label: 'Help',
                icon: <HelpCircle className='h-4 w-4' />,
                onClick: () => navigate('/help'),
              },
              {
                key: 'privacy',
                label: 'Privacy',
                icon: <Shield className='h-4 w-4' />,
                onClick: () => navigate('/privacy'),
              },
            ],
          }}
          trigger={['click']}
          placement='bottomRight'
        >
          <button
            className='flex items-center text-white hover:text-blue-200 transition-colors'
            title='Info'
          >
            <Info className='h-6 w-6' />
          </button>
        </Dropdown>

        {user ? (
          <div className='flex items-center space-x-4'>
            <ChatDropdown />
            <NotificationBell />

            {user.is_admin && (
              <button
                onClick={() => navigate('/admin')}
                className='flex items-center space-x-1 text-white hover:text-blue-200 transition-colors'
                title='Admin Panel'
              >
                <Shield className='h-6 w-6' />
                <span className='text-sm'>Admin Panel</span>
              </button>
            )}

            <Link
              to='/profile'
              className='flex items-center space-x-1 text-white hover:text-blue-200 transition-colors'
            >
              <User className='h-6 w-6' />
              <span className='text-sm'>{user.username}</span>
            </Link>

            <button
              onClick={handleLogout}
              className='flex items-center text-white hover:text-blue-200 transition-colors ml-2'
              title='Logout'
            >
              <LogOut className='h-6 w-6' />
            </button>
          </div>
        ) : (
          <div className='flex items-center space-x-4'>
            <Button
              to='/login'
              variant='primary'
              size='md'
              className='bg-blue-700 hover:bg-blue-800 border !border-blue-400 hover:!border-blue-300'
            >
              Login
            </Button>
            <Button to='/register' variant='white' size='md'>
              Register
            </Button>
          </div>
        )}
      </div>
    </>
  );
};

export default NavbarDesktopControls;
