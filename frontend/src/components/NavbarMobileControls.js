import { Popup, List, Collapse } from 'antd-mobile';
import {
  Menu as MenuIcon,
  X,
  Home,
  Map,
  MapPin,
  Users,
  LogOut,
  Settings,
  Activity,
  Clock,
  FileText,
  Info,
  Building,
  Tags,
  Anchor,
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
  User,
  Crown,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';

import GlobalSearchBar from './GlobalSearchBar';
import Logo from './Logo';
import NotificationBell from './NotificationBell';

const NavbarMobileControls = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
    setIsMobileMenuOpen(false);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const handleNavigate = path => {
    navigate(path);
    closeMobileMenu();
  };

  return (
    <>
      <div className='md:hidden flex items-center gap-4'>
        {user && <NotificationBell />}
        <button
          onClick={toggleMobileMenu}
          className='text-white hover:text-blue-200 transition-colors'
          aria-label={isMobileMenuOpen ? 'Close mobile menu' : 'Open mobile menu'}
        >
          {isMobileMenuOpen ? <X className='h-6 w-6' /> : <MenuIcon className='h-6 w-6' />}
        </button>
      </div>

      <Popup
        visible={isMobileMenuOpen}
        onMaskClick={closeMobileMenu}
        position='right'
        bodyStyle={{ width: '85vw', display: 'flex', flexDirection: 'column' }}
      >
        <div className='flex-none p-4 border-b border-gray-100 flex justify-between items-center bg-blue-700'>
          <Logo size='small' showText={true} textOnly={false} textClassName='text-white' />
          <button onClick={closeMobileMenu} className='text-white p-1'>
            <X className='h-6 w-6' />
          </button>
        </div>

        <div className='flex-none p-4 bg-gray-50'>
          <GlobalSearchBar
            className='w-full'
            inputClassName='bg-white text-gray-900 border border-gray-300'
            placeholder='Search dives, sites, centers...'
            popoverClassName='z-[100000]'
          />
        </div>

        <div className='flex-1 overflow-y-auto'>
          <List mode='card'>
            <List.Item
              prefix={<Home className='h-5 w-5 text-gray-500' />}
              onClick={() => handleNavigate('/')}
            >
              Home
            </List.Item>
            <List.Item
              prefix={<MapPin className='h-5 w-5 text-gray-500' />}
              onClick={() => handleNavigate('/map')}
            >
              Map
            </List.Item>

            <Collapse>
              <Collapse.Panel
                key='diving'
                title='Diving'
                arrow={<Compass className='h-5 w-5 text-gray-500' />}
              >
                <List>
                  <List.Item
                    prefix={<Anchor className='h-4 w-4' />}
                    onClick={() => handleNavigate('/dives')}
                  >
                    Dive Log
                  </List.Item>
                  <List.Item
                    prefix={<Map className='h-4 w-4' />}
                    onClick={() => handleNavigate('/dive-sites')}
                  >
                    Dive Sites
                  </List.Item>
                  <List.Item
                    prefix={<Route className='h-4 w-4' />}
                    onClick={() => handleNavigate('/dive-routes')}
                  >
                    Dive Routes
                  </List.Item>
                </List>
              </Collapse.Panel>
            </Collapse>

            <List.Item
              prefix={<Building className='h-5 w-5 text-gray-500' />}
              onClick={() => handleNavigate('/diving-centers')}
            >
              Diving Centers
            </List.Item>
            <List.Item
              prefix={<Calendar className='h-5 w-5 text-gray-500' />}
              onClick={() => handleNavigate('/dive-trips')}
            >
              Dive Trips
            </List.Item>

            <Collapse>
              <Collapse.Panel
                key='resources'
                title='Resources'
                arrow={<Award className='h-5 w-5 text-gray-500' />}
              >
                <List>
                  <List.Item
                    prefix={<Award className='h-4 w-4' />}
                    onClick={() => handleNavigate('/resources/diving-organizations')}
                  >
                    Diving Organizations
                  </List.Item>
                  <List.Item
                    prefix={<Calculator className='h-4 w-4' />}
                    onClick={() => handleNavigate('/resources/tools')}
                  >
                    Tools
                  </List.Item>
                  <List.Item
                    prefix={<Tags className='h-4 w-4' />}
                    onClick={() => handleNavigate('/resources/tags')}
                  >
                    Tags
                  </List.Item>
                </List>
              </Collapse.Panel>

              <Collapse.Panel
                key='info'
                title='Info'
                arrow={<Info className='h-5 w-5 text-gray-500' />}
              >
                <List>
                  <List.Item
                    prefix={<Info className='h-4 w-4' />}
                    onClick={() => handleNavigate('/about')}
                  >
                    About
                  </List.Item>
                  <List.Item
                    prefix={<Code className='h-4 w-4' />}
                    onClick={() => handleNavigate('/api-docs')}
                  >
                    API
                  </List.Item>
                  <List.Item
                    prefix={<FileText className='h-4 w-4' />}
                    onClick={() => handleNavigate('/changelog')}
                  >
                    Changelog
                  </List.Item>
                  <List.Item
                    prefix={<HelpCircle className='h-4 w-4' />}
                    onClick={() => handleNavigate('/help')}
                  >
                    Help
                  </List.Item>
                  <List.Item
                    prefix={<Shield className='h-4 w-4' />}
                    onClick={() => handleNavigate('/privacy')}
                  >
                    Privacy
                  </List.Item>
                </List>
              </Collapse.Panel>

              {user?.is_admin && (
                <Collapse.Panel
                  key='admin'
                  title='Admin'
                  arrow={<Settings className='h-5 w-5 text-gray-500' />}
                >
                  <List>
                    <List.Item
                      prefix={<Settings className='h-4 w-4' />}
                      onClick={() => handleNavigate('/admin')}
                    >
                      Dashboard
                    </List.Item>
                    <List.Item
                      prefix={<Anchor className='h-4 w-4' />}
                      onClick={() => handleNavigate('/admin/dives')}
                    >
                      Dives
                    </List.Item>
                    <List.Item
                      prefix={<MapPin className='h-4 w-4' />}
                      onClick={() => handleNavigate('/admin/dive-sites')}
                    >
                      Dive Sites
                    </List.Item>
                    <List.Item
                      prefix={<Building className='h-4 w-4' />}
                      onClick={() => handleNavigate('/admin/diving-centers')}
                    >
                      Diving Centers
                    </List.Item>
                    <List.Item
                      prefix={<Award className='h-4 w-4' />}
                      onClick={() => handleNavigate('/admin/diving-organizations')}
                    >
                      Diving Organizations
                    </List.Item>
                    <List.Item
                      prefix={<Tags className='h-4 w-4' />}
                      onClick={() => handleNavigate('/admin/tags')}
                    >
                      Tags
                    </List.Item>
                    <List.Item
                      prefix={<FileText className='h-4 w-4' />}
                      onClick={() => handleNavigate('/admin/newsletters')}
                    >
                      Newsletters
                    </List.Item>
                    <List.Item
                      prefix={<Crown className='h-4 w-4' />}
                      onClick={() => handleNavigate('/admin/ownership-requests')}
                    >
                      Ownership Requests
                    </List.Item>
                    <List.Item
                      prefix={<Activity className='h-4 w-4' />}
                      onClick={() => handleNavigate('/admin/system-metrics')}
                    >
                      System Metrics
                    </List.Item>
                    <List.Item
                      prefix={<BarChart3 className='h-4 w-4' />}
                      onClick={() => handleNavigate('/admin/general-statistics')}
                    >
                      General Statistics
                    </List.Item>
                    <List.Item
                      prefix={<BarChart3 className='h-4 w-4' />}
                      onClick={() => handleNavigate('/admin/growth-visualizations')}
                    >
                      Growth Visualizations
                    </List.Item>
                    <List.Item
                      prefix={<Clock className='h-4 w-4' />}
                      onClick={() => handleNavigate('/admin/recent-activity')}
                    >
                      Recent Activity
                    </List.Item>
                    <List.Item
                      prefix={<Users className='h-4 w-4' />}
                      onClick={() => handleNavigate('/admin/users')}
                    >
                      Users
                    </List.Item>
                    <List.Item
                      prefix={<Bell className='h-4 w-4' />}
                      onClick={() => handleNavigate('/admin/notification-preferences')}
                    >
                      Notifications
                    </List.Item>
                  </List>
                </Collapse.Panel>
              )}
            </Collapse>

            {user ? (
              <>
                <List.Item
                  prefix={<User className='h-5 w-5 text-gray-500' />}
                  onClick={() => handleNavigate('/profile')}
                >
                  {user.username}
                </List.Item>
                <List.Item
                  prefix={<LogOut className='h-5 w-5 text-red-500' />}
                  onClick={handleLogout}
                  className='text-red-500'
                >
                  Logout
                </List.Item>
              </>
            ) : (
              <>
                <List.Item
                  prefix={<Settings className='h-5 w-5 text-gray-500' />} // Login icon placeholder
                  onClick={() => handleNavigate('/login')}
                  className='font-bold text-blue-600'
                >
                  Login
                </List.Item>
                <List.Item onClick={() => handleNavigate('/register')}>Register</List.Item>
              </>
            )}
          </List>
        </div>
      </Popup>
    </>
  );
};

export default NavbarMobileControls;
