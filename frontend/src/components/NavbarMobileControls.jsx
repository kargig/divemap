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
  User,
  Crown,
  MessageSquare,
  Trophy,
} from 'lucide-react';
import { useState } from 'react';
import { useQuery } from 'react-query';
import { useNavigate, Link } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';

import Avatar from './Avatar';
import GlobalSearchBar from './GlobalSearchBar';
import Logo from './Logo';
import NotificationBell from './NotificationBell';
import ChatDropdown from './UserChat/ChatDropdown';

const ThemedListItem = ({ label, onClick }) => (
  <List.Item
    onClick={onClick}
    className='text-white'
    arrow={false}
    style={{
      '--padding-left': '0',
      '--padding-right': '0',
      '--inner-padding-right': '0',
      '--padding-top': '0px',
      '--padding-bottom': '0px',
      '--adm-list-item-min-height': '32px',
    }}
  >
    <div className='flex items-center gap-3'>
      <div className='w-1 h-1 rounded-full bg-blue-200/80 flex-none' />
      <span className='text-[15px]'>{label}</span>
    </div>
  </List.Item>
);

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
    '--adm-color-background': '#0072B2',
    '--adm-color-box': '#0072B2', // Ensures list background is blue
    '--adm-color-text': '#ffffff', // White-ish for better contrast
    '--adm-color-weak': '#ffffff', // Force weak text to white
    '--adm-color-text-secondary': '#bfdbfe', // blue-200 for secondary text
    '--adm-list-item-content-active': 'rgba(0, 0, 0, 0.2)', // Darken on click instead of lighten
    color: '#ffffff', // Force text color inheritance
  };

  return (
    <>
      <div className='md:hidden flex items-center gap-1 sm:gap-3'>
        {user && <ChatDropdown />}
        {user && <NotificationBell />}
        <button
          onClick={toggleMobileMenu}
          className='text-white hover:text-blue-200 transition-colors ml-0'
          aria-label={isMobileMenuOpen ? 'Close mobile menu' : 'Open mobile menu'}
        >
          {isMobileMenuOpen ? (
            <X className='h-6 w-6' />
          ) : (
            <MenuIcon className='h-6 w-6 scale-150' />
          )}
        </button>
      </div>

      <Popup
        visible={isMobileMenuOpen}
        onMaskClick={closeMobileMenu}
        position='right'
        bodyStyle={{
          width: '100vw',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#0072B2',
        }}
      >
        <div style={customTheme} className='flex flex-col h-full'>
          <div className='flex-none p-4 border-b border-blue-400/30 flex justify-between items-center'>
            {user ? (
              <Link
                to='/profile'
                onClick={closeMobileMenu}
                className='flex items-center gap-3 text-white overflow-hidden'
              >
                <Avatar
                  src={user.avatar_full_url || user.avatar_url}
                  username={user.username}
                  size='sm'
                  className='border border-blue-300/30'
                />
                <span className='font-semibold text-lg truncate'>{user.username}</span>
              </Link>
            ) : (
              <Logo size='small' showText={true} textOnly={false} textClassName='text-white' />
            )}
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
                prefix={<Map className='h-5 w-5 text-blue-100' />}
                onClick={() => handleNavigate('/map')}
                arrow={false}
              >
                Map
              </List.Item>

              <Collapse
                style={{
                  '--border-top': 'none',
                  '--border-bottom': 'none',
                }}
              >
                <Collapse.Panel
                  key='diving'
                  title={
                    <div className='flex items-center gap-2'>
                      <Compass className='h-5 w-5 text-blue-100' />
                      <span>Dive / Explore</span>
                    </div>
                  }
                >
                  <div className='ml-6 pl-4 border-l border-blue-200/30'>
                    <List
                      style={{
                        '--border-top': 'none',
                        '--border-bottom': 'none',
                        '--border-inner': 'none',
                        '--adm-color-text': '#ffffff',
                        '--adm-color-weak': '#ffffff',
                      }}
                    >
                      <ThemedListItem label='Dive Log' onClick={() => handleNavigate('/dives')} />
                      <ThemedListItem
                        label='Dive Sites'
                        onClick={() => handleNavigate('/dive-sites')}
                      />
                      <ThemedListItem
                        label='Dive Routes'
                        onClick={() => handleNavigate('/dive-routes')}
                      />
                      <ThemedListItem
                        label='Diving Centers'
                        onClick={() => handleNavigate('/diving-centers')}
                      />
                      <ThemedListItem
                        label='Dive Trips'
                        onClick={() => handleNavigate('/dive-trips')}
                      />
                      <ThemedListItem
                        label='Tools'
                        onClick={() => handleNavigate('/resources/tools/mod')}
                      />
                      <ThemedListItem
                        label='Diving Organizations'
                        onClick={() => handleNavigate('/resources/diving-organizations')}
                      />
                      <ThemedListItem
                        label='Tags'
                        onClick={() => handleNavigate('/resources/tags')}
                      />
                    </List>
                  </div>
                </Collapse.Panel>
              </Collapse>

              <Collapse
                style={{
                  '--border-top': 'none',
                  '--border-bottom': 'none',
                }}
              >
                <Collapse.Panel
                  key='community'
                  title={
                    <div className='flex items-center gap-2'>
                      <Users className='h-5 w-5 text-blue-100' />
                      <span>Community</span>
                    </div>
                  }
                >
                  <div className='ml-6 pl-4 border-l border-blue-200/30'>
                    <List
                      style={{
                        '--border-top': 'none',
                        '--border-bottom': 'none',
                        '--border-inner': 'none',
                        '--adm-color-text': '#ffffff',
                        '--adm-color-weak': '#ffffff',
                      }}
                    >
                      <ThemedListItem
                        label='Leaderboard'
                        onClick={() => handleNavigate('/leaderboard')}
                      />
                      {user && (
                        <ThemedListItem
                          label='Buddies'
                          onClick={() => handleNavigate('/buddies')}
                        />
                      )}
                    </List>
                  </div>
                </Collapse.Panel>
              </Collapse>

              <Collapse
                style={{
                  '--border-top': 'none',
                  '--border-bottom': 'none',
                }}
              >
                <Collapse.Panel
                  key='info'
                  title={
                    <div className='flex items-center gap-2'>
                      <Info className='h-5 w-5 text-blue-100' />
                      <span>Info</span>
                    </div>
                  }
                >
                  <div className='ml-6 pl-4 border-l border-blue-200/30'>
                    <List
                      style={{
                        '--border-top': 'none',
                        '--border-bottom': 'none',
                        '--border-inner': 'none',
                        '--adm-color-text': '#ffffff',
                        '--adm-color-weak': '#ffffff',
                      }}
                    >
                      <ThemedListItem label='About' onClick={() => handleNavigate('/about')} />
                      <ThemedListItem label='API' onClick={() => handleNavigate('/api-docs')} />
                      <ThemedListItem
                        label='Changelog'
                        onClick={() => handleNavigate('/changelog')}
                      />
                      <ThemedListItem label='Help' onClick={() => handleNavigate('/help')} />
                      <ThemedListItem label='Privacy' onClick={() => handleNavigate('/privacy')} />
                    </List>
                  </div>
                </Collapse.Panel>
              </Collapse>

              {user?.is_admin && (
                <List.Item
                  prefix={<Shield className='h-5 w-5 text-blue-100' />}
                  onClick={() => handleNavigate('/admin')}
                  className='text-white'
                  arrow={true}
                >
                  Admin Panel
                </List.Item>
              )}

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
