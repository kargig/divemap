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
  Award,
  Anchor,
  Crown,
  Calendar,
  FileText,
  Menu,
  X,
  Info,
  HelpCircle,
  Activity,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';

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
    <nav className='bg-blue-600 text-white shadow-lg fixed top-0 left-0 right-0 z-50'>
      <div className='container mx-auto px-4'>
        <div className='flex justify-between items-center h-16'>
          <Link to='/' className='flex items-center space-x-2' onClick={closeMobileMenu}>
            <Map className='h-8 w-8' />
            <span className='text-xl font-bold'>Divemap</span>
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
                <div className='absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50'>
                  <Link
                    to='/about'
                    className='flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100'
                    onClick={() => setShowInfoDropdown(false)}
                  >
                    <Info className='h-4 w-4 mr-2' />
                    About
                  </Link>
                  <Link
                    to='/help'
                    className='flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100'
                    onClick={() => setShowInfoDropdown(false)}
                  >
                    <HelpCircle className='h-4 w-4 mr-2' />
                    Help
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
                      <div className='absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50'>
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
          <div className='md:hidden bg-blue-700 border-t border-blue-500'>
            <div className='px-2 pt-2 pb-3 space-y-1'>
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
                  to='/help'
                  className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors'
                  onClick={closeMobileMenu}
                >
                  <HelpCircle className='h-4 w-4 mr-3' />
                  <span>Help</span>
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
          className='fixed inset-0 z-40'
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
