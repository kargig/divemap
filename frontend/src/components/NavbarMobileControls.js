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

  // Custom theme variables for antd-mobile to match the blue design
  const customTheme = {
    '--adm-color-background': '#2d6b8a',
    '--adm-color-box': '#2d6b8a', // Ensures list background is blue
    '--adm-color-text': '#ffffff', // White-ish for better contrast
    '--adm-color-weak': '#ffffff', // Force weak text to white
    '--adm-color-text-secondary': '#bfdbfe', // blue-200 for secondary text
    '--adm-border-color': 'rgba(255, 255, 255, 0.1)',
    '--adm-list-item-content-active': 'rgba(0, 0, 0, 0.2)', // Darken on click instead of lighten
    color: '#ffffff', // Force text color inheritance
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
        bodyStyle={{
          width: '85vw',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#2d6b8a',
        }}
      >
        <div style={customTheme} className='flex flex-col h-full'>
          <div className='flex-none p-4 border-b border-blue-400/30 flex justify-between items-center'>
            <Logo size='small' showText={true} textOnly={false} textClassName='text-white' />
            <button onClick={closeMobileMenu} className='text-white p-1'>
              <X className='h-6 w-6' />
            </button>
          </div>

          <div className='flex-none p-4'>
            <GlobalSearchBar
              className='w-full'
              inputClassName='bg-white/10 text-white placeholder-blue-200 border border-blue-400/30 focus:bg-white focus:text-gray-900 transition-colors'
              placeholder='Search dives, sites, centers...'
              popoverClassName='z-[100000]'
            />
          </div>

          <div className='flex-1 overflow-y-auto'>
            <List mode='card'>
              <List.Item
                prefix={<Home className='h-5 w-5 text-blue-100' />}
                onClick={() => handleNavigate('/')}
                arrow={false}
              >
                Home
              </List.Item>
              <List.Item
                prefix={<MapPin className='h-5 w-5 text-blue-100' />}
                onClick={() => handleNavigate('/map')}
                arrow={false}
              >
                Map
              </List.Item>

              <Collapse>
                <Collapse.Panel
                  key='diving'
                  title={
                    <div className='flex items-center gap-2'>
                      <Compass className='h-5 w-5 text-blue-100' />
                      <span>Diving</span>
                    </div>
                  }
                >
                  <List
                    style={{
                      '--border-top': 'none',
                      '--border-bottom': 'none',
                      '--adm-color-text': '#ffffff',
                      '--adm-color-weak': '#ffffff',
                    }}
                  >
                    <List.Item
                      prefix={<Anchor className='h-4 w-4 text-blue-200' />}
                      onClick={() => handleNavigate('/dives')}
                      className='text-white'
                      arrow={false}
                    >
                      Dive Log
                    </List.Item>
                    <List.Item
                      prefix={<Map className='h-4 w-4 text-blue-200' />}
                      onClick={() => handleNavigate('/dive-sites')}
                      className='text-white'
                      arrow={false}
                    >
                      Dive Sites
                    </List.Item>
                    <List.Item
                      prefix={<Route className='h-4 w-4 text-blue-200' />}
                      onClick={() => handleNavigate('/dive-routes')}
                      className='text-white'
                      arrow={false}
                    >
                      Dive Routes
                    </List.Item>
                  </List>
                </Collapse.Panel>
              </Collapse>

              <List.Item
                prefix={<Building className='h-5 w-5 text-blue-100' />}
                onClick={() => handleNavigate('/diving-centers')}
                arrow={false}
              >
                Diving Centers
              </List.Item>
              <List.Item
                prefix={<Calendar className='h-5 w-5 text-blue-100' />}
                onClick={() => handleNavigate('/dive-trips')}
                arrow={false}
              >
                Dive Trips
              </List.Item>

              <Collapse>
                <Collapse.Panel
                  key='resources'
                  title={
                    <div className='flex items-center gap-2'>
                      <Award className='h-5 w-5 text-blue-100' />
                      <span>Resources</span>
                    </div>
                  }
                >
                  <List
                    style={{
                      '--border-top': 'none',
                      '--border-bottom': 'none',
                      '--adm-color-text': '#ffffff',
                      '--adm-color-weak': '#ffffff',
                    }}
                  >
                    <List.Item
                      prefix={<Award className='h-4 w-4 text-blue-200' />}
                      onClick={() => handleNavigate('/resources/diving-organizations')}
                      className='text-white'
                      arrow={false}
                    >
                      Diving Organizations
                    </List.Item>
                    <List.Item
                      prefix={<Calculator className='h-4 w-4 text-blue-200' />}
                      onClick={() => handleNavigate('/resources/tools')}
                      className='text-white'
                      arrow={false}
                    >
                      Tools
                    </List.Item>
                    <List.Item
                      prefix={<Tags className='h-4 w-4 text-blue-200' />}
                      onClick={() => handleNavigate('/resources/tags')}
                      className='text-white'
                      arrow={false}
                    >
                      Tags
                    </List.Item>
                  </List>
                </Collapse.Panel>

                <Collapse.Panel
                  key='info'
                  title={
                    <div className='flex items-center gap-2'>
                      <Info className='h-5 w-5 text-blue-100' />
                      <span>Info</span>
                    </div>
                  }
                >
                  <List
                    style={{
                      '--border-top': 'none',
                      '--border-bottom': 'none',
                      '--adm-color-text': '#ffffff',
                      '--adm-color-weak': '#ffffff',
                    }}
                  >
                    <List.Item
                      prefix={<Info className='h-4 w-4 text-blue-200' />}
                      onClick={() => handleNavigate('/about')}
                      className='text-white'
                      arrow={false}
                    >
                      About
                    </List.Item>
                    <List.Item
                      prefix={<Code className='h-4 w-4 text-blue-200' />}
                      onClick={() => handleNavigate('/api-docs')}
                      className='text-white'
                      arrow={false}
                    >
                      API
                    </List.Item>
                    <List.Item
                      prefix={<FileText className='h-4 w-4 text-blue-200' />}
                      onClick={() => handleNavigate('/changelog')}
                      className='text-white'
                      arrow={false}
                    >
                      Changelog
                    </List.Item>
                    <List.Item
                      prefix={<HelpCircle className='h-4 w-4 text-blue-200' />}
                      onClick={() => handleNavigate('/help')}
                      className='text-white'
                      arrow={false}
                    >
                      Help
                    </List.Item>
                    <List.Item
                      prefix={<Shield className='h-4 w-4 text-blue-200' />}
                      onClick={() => handleNavigate('/privacy')}
                      className='text-white'
                      arrow={false}
                    >
                      Privacy
                    </List.Item>
                  </List>
                </Collapse.Panel>

                {user?.is_admin && (
                  <Collapse.Panel
                    key='admin'
                    title={
                      <div className='flex items-center gap-2'>
                        <Settings className='h-5 w-5 text-blue-100' />
                        <span>Admin</span>
                      </div>
                    }
                  >
                    <List
                      style={{
                        '--border-top': 'none',
                        '--border-bottom': 'none',
                        '--adm-color-text': '#ffffff',
                        '--adm-color-weak': '#ffffff',
                      }}
                    >
                      <List.Item
                        prefix={<Settings className='h-4 w-4 text-blue-200' />}
                        onClick={() => handleNavigate('/admin')}
                        className='text-white'
                        arrow={false}
                      >
                        Dashboard
                      </List.Item>
                      <List.Item
                        prefix={<Anchor className='h-4 w-4 text-blue-200' />}
                        onClick={() => handleNavigate('/admin/dives')}
                        className='text-white'
                        arrow={false}
                      >
                        Dives
                      </List.Item>
                      <List.Item
                        prefix={<MapPin className='h-4 w-4 text-blue-200' />}
                        onClick={() => handleNavigate('/admin/dive-sites')}
                        className='text-white'
                        arrow={false}
                      >
                        Dive Sites
                      </List.Item>
                      <List.Item
                        prefix={<Building className='h-4 w-4 text-blue-200' />}
                        onClick={() => handleNavigate('/admin/diving-centers')}
                        className='text-white'
                        arrow={false}
                      >
                        Diving Centers
                      </List.Item>
                      <List.Item
                        prefix={<Award className='h-4 w-4 text-blue-200' />}
                        onClick={() => handleNavigate('/admin/diving-organizations')}
                        className='text-white'
                        arrow={false}
                      >
                        Diving Organizations
                      </List.Item>
                      <List.Item
                        prefix={<Tags className='h-4 w-4 text-blue-200' />}
                        onClick={() => handleNavigate('/admin/tags')}
                        className='text-white'
                        arrow={false}
                      >
                        Tags
                      </List.Item>
                      <List.Item
                        prefix={<FileText className='h-4 w-4 text-blue-200' />}
                        onClick={() => handleNavigate('/admin/newsletters')}
                        className='text-white'
                        arrow={false}
                      >
                        Newsletters
                      </List.Item>
                      <List.Item
                        prefix={<Crown className='h-4 w-4 text-blue-200' />}
                        onClick={() => handleNavigate('/admin/ownership-requests')}
                        className='text-white'
                        arrow={false}
                      >
                        Ownership Requests
                      </List.Item>
                      <List.Item
                        prefix={<Activity className='h-4 w-4 text-blue-200' />}
                        onClick={() => handleNavigate('/admin/system-metrics')}
                        className='text-white'
                        arrow={false}
                      >
                        System Metrics
                      </List.Item>
                      <List.Item
                        prefix={<BarChart3 className='h-4 w-4 text-blue-200' />}
                        onClick={() => handleNavigate('/admin/general-statistics')}
                        className='text-white'
                        arrow={false}
                      >
                        General Statistics
                      </List.Item>
                      <List.Item
                        prefix={<BarChart3 className='h-4 w-4 text-blue-200' />}
                        onClick={() => handleNavigate('/admin/growth-visualizations')}
                        className='text-white'
                        arrow={false}
                      >
                        Growth Visualizations
                      </List.Item>
                      <List.Item
                        prefix={<Clock className='h-4 w-4 text-blue-200' />}
                        onClick={() => handleNavigate('/admin/recent-activity')}
                        className='text-white'
                        arrow={false}
                      >
                        Recent Activity
                      </List.Item>
                      <List.Item
                        prefix={<Users className='h-4 w-4 text-blue-200' />}
                        onClick={() => handleNavigate('/admin/users')}
                        className='text-white'
                        arrow={false}
                      >
                        Users
                      </List.Item>
                      <List.Item
                        prefix={<Bell className='h-4 w-4 text-blue-200' />}
                        onClick={() => handleNavigate('/admin/notification-preferences')}
                        className='text-white'
                        arrow={false}
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
                    prefix={<User className='h-5 w-5 text-blue-100' />}
                    onClick={() => handleNavigate('/profile')}
                    arrow={false}
                  >
                    {user.username}
                  </List.Item>
                  <List.Item
                    prefix={<LogOut className='h-5 w-5 text-red-300' />}
                    onClick={handleLogout}
                    className='text-red-300'
                    arrow={false}
                  >
                    Logout
                  </List.Item>
                </>
              ) : (
                <>
                  <List.Item
                    prefix={<Settings className='h-5 w-5 text-blue-100' />}
                    onClick={() => handleNavigate('/login')}
                    className='font-bold text-white'
                    arrow={false}
                  >
                    Login
                  </List.Item>
                  <List.Item onClick={() => handleNavigate('/register')} arrow={false}>
                    Register
                  </List.Item>
                </>
              )}
            </List>
          </div>
        </div>
      </Popup>
    </>
  );
};

export default NavbarMobileControls;
