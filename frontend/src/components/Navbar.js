import {
  LogOut,
  User,
  Map,
  Home,
  Settings,
  Building,
  ChevronDown,
  Users,
  MapPin,
  Tags,
  Anchor,
  Crown,
  Calendar,
  FileText,
  Menu,
  X,
  Info,
  HelpCircle,
  Activity,
  Clock,
  Shield,
  Code,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';

import Logo from './Logo';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showAdminDropdown, setShowAdminDropdown] = useState(false);
  const [showInfoDropdown, setShowInfoDropdown] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
    setShowAdminDropdown(false);
    setShowInfoDropdown(false);
  };

  return (
    <nav className='text-white shadow-lg fixed top-0 left-0 right-0 z-[60] relative overflow-hidden' 
         style={{
           backgroundColor: '#2d6b8a'
         }}>
      {/* Sea Components Background */}
      <div className='absolute inset-0 pointer-events-none'>
        {/* Shell - positioned on the left side */}
        <div className='absolute left-8 top-2 opacity-60 navbar-sea-component'>
          <img 
            src='/arts/divemap_shell.png' 
            alt='Shell' 
            className='w-8 h-8 object-contain'
          />
        </div>
        
        {/* Fish - positioned on the right side */}
        <div className='absolute right-16 top-3 opacity-70 navbar-sea-component'>
          <img 
            src='/arts/divemap_fish.png' 
            alt='Fish' 
            className='w-6 h-6 object-contain'
          />
        </div>
        
        {/* Small bubble - positioned near the center */}
        <div className='absolute left-1/4 top-4 opacity-50 navbar-sea-component'>
          <img 
            src='/arts/divemap_bubble_small.png' 
            alt='Bubble' 
            className='w-4 h-4 object-contain'
          />
        </div>
        
        {/* Coral - positioned more to the left */}
        <div className='absolute left-1/3 top-2 opacity-65 navbar-sea-component'>
          <img 
            src='/arts/divemap_coral.png' 
            alt='Coral' 
            className='w-10 h-10 object-contain'
          />
        </div>
        
        {/* Second Shell - positioned next to coral */}
        <div className='absolute left-1/2 top-0 opacity-55 navbar-sea-component'>
          <img 
            src='/arts/divemap_shell.png' 
            alt='Shell 2' 
            className='w-6 h-6 object-contain'
          />
        </div>
        
        {/* Additional Small Bubble - near coral */}
        <div className='absolute left-3/5 top-1 opacity-45 navbar-sea-component'>
          <img 
            src='/arts/divemap_bubble_small.png' 
            alt='Bubble 2' 
            className='w-3 h-3 object-contain'
          />
        </div>
        
        {/* Big Fish - positioned next to coral */}
        <div className='absolute left-2/3 top-0 opacity-75 navbar-sea-component'>
          <img 
            src='/arts/divemap_bubble_fish_big.png' 
            alt='Big Fish' 
            className='w-8 h-8 object-contain'
          />
        </div>
        
        {/* Additional Big Bubble - right side */}
        <div className='absolute right-8 top-0 opacity-35 navbar-sea-component'>
          <img 
            src='/arts/divemap_bubble_big.png' 
            alt='Big Bubble 2' 
            className='w-5 h-5 object-contain'
          />
        </div>
        
        {/* Color bubble - positioned on the right */}
        <div className='absolute right-1/3 top-0 opacity-40 navbar-sea-component'>
          <img 
            src='/arts/divemap_bubble_color.png' 
            alt='Color Bubble' 
            className='w-5 h-5 object-contain'
          />
        </div>
        
        {/* Big bubble - positioned on the left */}
        <div className='absolute left-1/4 top-1 opacity-30 navbar-sea-component'>
          <img 
            src='/arts/divemap_bubble_big.png' 
            alt='Big Bubble' 
            className='w-6 h-6 object-contain'
          />
        </div>
      </div>
      
      <div className='container mx-auto px-4 relative z-10'>
        <div className='flex justify-between items-center h-16'>
          <Link to='/' className='flex items-center space-x-2' onClick={closeMobileMenu}>
            <Logo size='small' showText={true} textOnly={false} textClassName='text-white' />
          </Link>

          {/* Desktop Navigation */}
          <div className='hidden md:flex items-center space-x-6'>
            <Link
              to='/'
              className='flex items-center space-x-1 hover:text-blue-200 transition-colors'
            >
              <Home className='h-5 w-5' />
              <span>Home</span>
            </Link>

            <Link
              to='/dives'
              className='flex items-center space-x-1 hover:text-blue-200 transition-colors'
            >
              <Anchor className='h-5 w-5' />
              <span>Dives</span>
            </Link>

            <Link
              to='/dive-sites'
              className='flex items-center space-x-1 hover:text-blue-200 transition-colors'
            >
              <Map className='h-5 w-5' />
              <span>Dive Sites</span>
            </Link>

            <Link
              to='/diving-centers'
              className='flex items-center space-x-1 hover:text-blue-200 transition-colors'
            >
              <Building className='h-5 w-5' />
              <span>Diving Centers</span>
            </Link>

            <Link
              to='/dive-trips'
              className='flex items-center space-x-1 hover:text-blue-200 transition-colors'
            >
              <Calendar className='h-5 w-5' />
              <span>Dive Trips</span>
            </Link>

            <div className='relative'>
              <button
                onClick={() => setShowInfoDropdown(!showInfoDropdown)}
                className='flex items-center space-x-1 hover:text-blue-200 transition-colors'
              >
                <Info className='h-5 w-5' />
                <span>Info</span>
                <ChevronDown className='h-4 w-4' />
              </button>

              {showInfoDropdown && (
                <div className='absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-[60]'>
                  <Link
                    to='/about'
                    className='flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100'
                    onClick={() => setShowInfoDropdown(false)}
                  >
                    <Info className='h-4 w-4 mr-2' />
                    About
                  </Link>
                  <Link
                    to='/api'
                    className='flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100'
                    onClick={() => setShowInfoDropdown(false)}
                  >
                    <Code className='h-4 w-4 mr-2' />
                    API
                  </Link>
                  <Link
                    to='/help'
                    className='flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100'
                    onClick={() => setShowInfoDropdown(false)}
                  >
                    <HelpCircle className='h-4 w-4 mr-2' />
                    Help
                  </Link>
                  <Link
                    to='/privacy'
                    className='flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100'
                    onClick={() => setShowInfoDropdown(false)}
                  >
                    <Shield className='h-4 w-4 mr-2' />
                    Privacy
                  </Link>
                </div>
              )}
            </div>

            {user ? (
              <div className='flex items-center space-x-4'>
                {user.is_admin && (
                  <div className='relative'>
                    <button
                      onClick={() => setShowAdminDropdown(!showAdminDropdown)}
                      className='flex items-center space-x-1 hover:text-blue-200 transition-colors'
                    >
                      <Settings className='h-5 w-5' />
                      <span>Admin</span>
                      <ChevronDown className='h-4 w-4' />
                    </button>

                    {showAdminDropdown && (
                      <div className='absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-[60]'>
                        <Link
                          to='/admin'
                          className='flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100'
                          onClick={() => setShowAdminDropdown(false)}
                        >
                          <Settings className='h-4 w-4 mr-2' />
                          Dashboard
                        </Link>
                        <Link
                          to='/admin/dives'
                          className='flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100'
                          onClick={() => setShowAdminDropdown(false)}
                        >
                          <Anchor className='h-4 w-4 mr-2' />
                          Dives
                        </Link>
                        <Link
                          to='/admin/dive-sites'
                          className='flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100'
                          onClick={() => setShowAdminDropdown(false)}
                        >
                          <MapPin className='h-4 w-4 mr-2' />
                          Dive Sites
                        </Link>
                        <Link
                          to='/admin/diving-centers'
                          className='flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100'
                          onClick={() => setShowAdminDropdown(false)}
                        >
                          <Building className='h-4 w-4 mr-2' />
                          Diving Centers
                        </Link>
                        <Link
                          to='/admin/tags'
                          className='flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100'
                          onClick={() => setShowAdminDropdown(false)}
                        >
                          <Tags className='h-4 w-4 mr-2' />
                          Tags
                        </Link>
                        <Link
                          to='/admin/newsletters'
                          className='flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100'
                          onClick={() => setShowAdminDropdown(false)}
                        >
                          <FileText className='h-4 w-4 mr-2' />
                          Newsletter Management
                        </Link>
                        <Link
                          to='/admin/ownership-requests'
                          className='flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100'
                          onClick={() => setShowAdminDropdown(false)}
                        >
                          <Crown className='h-4 w-4 mr-2' />
                          Ownership Requests
                        </Link>
                        <Link
                          to='/admin/system-overview'
                          className='flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100'
                          onClick={() => setShowAdminDropdown(false)}
                        >
                          <Activity className='h-4 w-4 mr-2' />
                          System Overview
                        </Link>
                        <Link
                          to='/admin/recent-activity'
                          className='flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100'
                          onClick={() => setShowAdminDropdown(false)}
                        >
                          <Clock className='h-4 w-4 mr-2' />
                          Recent Activity
                        </Link>
                        <Link
                          to='/admin/users'
                          className='flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100'
                          onClick={() => setShowAdminDropdown(false)}
                        >
                          <Users className='h-4 w-4 mr-2' />
                          Users
                        </Link>
                      </div>
                    )}
                  </div>
                )}

                <Link
                  to='/profile'
                  className='flex items-center space-x-1 hover:text-blue-200 transition-colors'
                >
                  <User className='h-5 w-5' />
                  <span>{user.username}</span>
                </Link>

                <button
                  onClick={handleLogout}
                  className='flex items-center space-x-1 hover:text-blue-200 transition-colors'
                >
                  <LogOut className='h-5 w-5' />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <div className='flex items-center space-x-4'>
                <Link
                  to='/login'
                  className='px-4 py-2 rounded-md bg-blue-700 hover:bg-blue-800 transition-colors'
                >
                  Login
                </Link>
                <Link
                  to='/register'
                  className='px-4 py-2 rounded-md bg-white text-blue-600 hover:bg-gray-100 transition-colors'
                >
                  Register
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className='md:hidden'>
            <button
              onClick={toggleMobileMenu}
              className='text-white hover:text-blue-200 transition-colors'
            >
              {isMobileMenuOpen ? <X className='h-6 w-6' /> : <Menu className='h-6 w-6' />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className='md:hidden bg-blue-700 border-t border-blue-500 relative z-[60]'>
            <div className='px-2 pt-2 pb-3 space-y-1 mobile-menu-container'>
              <Link
                to='/'
                className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors'
                onClick={closeMobileMenu}
              >
                <Home className='h-5 w-5 mr-3' />
                <span>Home</span>
              </Link>

              <Link
                to='/dives'
                className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors'
                onClick={closeMobileMenu}
              >
                <Anchor className='h-5 w-5 mr-3' />
                <span>Dives</span>
              </Link>

              <Link
                to='/dive-sites'
                className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors'
                onClick={closeMobileMenu}
              >
                <Map className='h-5 w-5 mr-3' />
                <span>Dive Sites</span>
              </Link>

              <Link
                to='/diving-centers'
                className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors'
                onClick={closeMobileMenu}
              >
                <Building className='h-5 w-5 mr-3' />
                <span>Diving Centers</span>
              </Link>

              <Link
                to='/dive-trips'
                className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors'
                onClick={closeMobileMenu}
              >
                <Calendar className='h-5 w-5 mr-3' />
                <span>Dive Trips</span>
              </Link>

              <div className='px-3 py-2'>
                <div className='text-xs text-blue-200 mb-2'>INFO</div>
                <Link
                  to='/about'
                  className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors'
                  onClick={closeMobileMenu}
                >
                  <Info className='h-4 w-4 mr-3' />
                  <span>About</span>
                </Link>
                <Link
                  to='/api'
                  className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors'
                  onClick={closeMobileMenu}
                >
                  <Code className='h-4 w-4 mr-3' />
                  <span>API</span>
                </Link>
                <Link
                  to='/help'
                  className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors'
                  onClick={closeMobileMenu}
                >
                  <HelpCircle className='h-4 w-4 mr-3' />
                  <span>Help</span>
                </Link>
                <Link
                  to='/privacy'
                  className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors'
                  onClick={closeMobileMenu}
                >
                  <Shield className='h-4 w-4 mr-3' />
                  <span>Privacy</span>
                </Link>
              </div>

              {user ? (
                <>
                  <div className='border-t border-blue-500 pt-2 mt-2'>
                    <Link
                      to='/profile'
                      className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors'
                      onClick={closeMobileMenu}
                    >
                      <User className='h-5 w-5 mr-3' />
                      <span>{user.username}</span>
                    </Link>

                    {user.is_admin && (
                      <div className='px-3 py-2'>
                        <div className='text-xs text-blue-200 mb-2'>ADMIN</div>
                        <Link
                          to='/admin'
                          className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors'
                          onClick={closeMobileMenu}
                        >
                          <Settings className='h-4 w-4 mr-3' />
                          <span>Dashboard</span>
                        </Link>
                        <Link
                          to='/admin/dives'
                          className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors'
                          onClick={closeMobileMenu}
                        >
                          <Anchor className='h-4 w-4 mr-3' />
                          <span>Dives</span>
                        </Link>
                        <Link
                          to='/admin/dive-sites'
                          className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors'
                          onClick={closeMobileMenu}
                        >
                          <MapPin className='h-4 w-4 mr-3' />
                          <span>Dive Sites</span>
                        </Link>
                        <Link
                          to='/admin/diving-centers'
                          className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors'
                          onClick={closeMobileMenu}
                        >
                          <Building className='h-4 w-4 mr-3' />
                          <span>Diving Centers</span>
                        </Link>
                        <Link
                          to='/admin/tags'
                          className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors'
                          onClick={closeMobileMenu}
                        >
                          <Tags className='h-4 w-4 mr-3' />
                          <span>Tags</span>
                        </Link>
                        <Link
                          to='/admin/newsletters'
                          className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors'
                          onClick={closeMobileMenu}
                        >
                          <FileText className='h-4 w-4 mr-3' />
                          <span>Newsletter Management</span>
                        </Link>
                        <Link
                          to='/admin/ownership-requests'
                          className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors'
                          onClick={closeMobileMenu}
                        >
                          <Crown className='h-4 w-4 mr-3' />
                          <span>Ownership Requests</span>
                        </Link>
                        <Link
                          to='/admin/system-overview'
                          className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors'
                          onClick={closeMobileMenu}
                        >
                          <Activity className='h-4 w-4 mr-3' />
                          <span>System Overview</span>
                        </Link>
                        <Link
                          to='/admin/recent-activity'
                          className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors'
                          onClick={closeMobileMenu}
                        >
                          <Clock className='h-4 w-4 mr-3' />
                          <span>Recent Activity</span>
                        </Link>
                        <Link
                          to='/admin/users'
                          className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors'
                          onClick={closeMobileMenu}
                        >
                          <Users className='h-4 w-4 mr-3' />
                          <span>Users</span>
                        </Link>
                      </div>
                    )}

                    <button
                      onClick={() => {
                        handleLogout();
                        closeMobileMenu();
                      }}
                      className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors w-full'
                    >
                      <LogOut className='h-5 w-5 mr-3' />
                      <span>Logout</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className='border-t border-blue-500 pt-2 mt-2 space-y-2'>
                  <Link
                    to='/login'
                    className='block px-3 py-2 text-white hover:text-blue-200 transition-colors'
                    onClick={closeMobileMenu}
                  >
                    Login
                  </Link>
                  <Link
                    to='/register'
                    className='block px-3 py-2 text-white hover:text-blue-200 transition-colors'
                    onClick={closeMobileMenu}
                  >
                    Register
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Click outside to close dropdowns */}
      {(showAdminDropdown || showInfoDropdown) && (
        <div
          className='fixed inset-0 z-[55]'
          onClick={() => {
            setShowAdminDropdown(false);
            setShowInfoDropdown(false);
          }}
          onKeyDown={event => {
            if (event.key === 'Escape') {
              setShowAdminDropdown(false);
              setShowInfoDropdown(false);
            }
          }}
          role='button'
          tabIndex={0}
        />
      )}
    </nav>
  );
};

export default Navbar;
