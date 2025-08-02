import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, User, Map, Home, Settings, Building, ChevronDown, Users, MapPin, Tags, Award, Anchor, Crown } from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showAdminDropdown, setShowAdminDropdown] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="bg-blue-600 text-white shadow-lg fixed top-0 left-0 right-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center space-x-2">
            <Map className="h-8 w-8" />
            <span className="text-xl font-bold">Divemap</span>
          </Link>

          <div className="flex items-center space-x-6">
            <Link to="/" className="flex items-center space-x-1 hover:text-blue-200 transition-colors">
              <Home className="h-5 w-5" />
              <span>Home</span>
            </Link>
            
            {user && (
              <Link to="/dives" className="flex items-center space-x-1 hover:text-blue-200 transition-colors">
                <Anchor className="h-5 w-5" />
                <span>Dives</span>
              </Link>
            )}
            
            <Link to="/dive-sites" className="flex items-center space-x-1 hover:text-blue-200 transition-colors">
              <Map className="h-5 w-5" />
              <span>Dive Sites</span>
            </Link>
            
            <Link to="/diving-centers" className="flex items-center space-x-1 hover:text-blue-200 transition-colors">
              <Building className="h-5 w-5" />
              <span>Diving Centers</span>
            </Link>
            
            {user ? (
              <div className="flex items-center space-x-4">
                {user.is_admin && (
                  <div className="relative">
                    <button
                      onClick={() => setShowAdminDropdown(!showAdminDropdown)}
                      className="flex items-center space-x-1 hover:text-blue-200 transition-colors"
                    >
                      <Settings className="h-5 w-5" />
                      <span>Admin</span>
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    
                    {showAdminDropdown && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
                        <Link
                          to="/admin"
                          className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100"
                          onClick={() => setShowAdminDropdown(false)}
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          Dashboard
                        </Link>
                        <Link
                          to="/admin/dive-sites"
                          className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100"
                          onClick={() => setShowAdminDropdown(false)}
                        >
                          <MapPin className="h-4 w-4 mr-2" />
                          Dive Sites
                        </Link>
                        <Link
                          to="/admin/diving-centers"
                          className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100"
                          onClick={() => setShowAdminDropdown(false)}
                        >
                          <Building className="h-4 w-4 mr-2" />
                          Diving Centers
                        </Link>
                        <Link
                          to="/admin/diving-organizations"
                          className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100"
                          onClick={() => setShowAdminDropdown(false)}
                        >
                          <Award className="h-4 w-4 mr-2" />
                          Diving Organizations
                        </Link>
                        <Link
                          to="/admin/dives"
                          className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100"
                          onClick={() => setShowAdminDropdown(false)}
                        >
                          <Anchor className="h-4 w-4 mr-2" />
                          Dives
                        </Link>
                        <Link
                          to="/admin/tags"
                          className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100"
                          onClick={() => setShowAdminDropdown(false)}
                        >
                          <Tags className="h-4 w-4 mr-2" />
                          Tags
                        </Link>
                        <Link
                          to="/admin/users"
                          className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100"
                          onClick={() => setShowAdminDropdown(false)}
                        >
                          <Users className="h-4 w-4 mr-2" />
                          Users
                        </Link>
                        <Link
                          to="/admin/ownership-requests"
                          className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100"
                          onClick={() => setShowAdminDropdown(false)}
                        >
                          <Crown className="h-4 w-4 mr-2" />
                          Ownership Requests
                        </Link>
                      </div>
                    )}
                  </div>
                )}
                
                <Link to="/profile" className="flex items-center space-x-1 hover:text-blue-200 transition-colors">
                  <User className="h-5 w-5" />
                  <span>{user.username}</span>
                </Link>
                
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-1 hover:text-blue-200 transition-colors"
                >
                  <LogOut className="h-5 w-5" />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <Link
                  to="/login"
                  className="px-4 py-2 rounded-md bg-blue-700 hover:bg-blue-800 transition-colors"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 rounded-md bg-white text-blue-600 hover:bg-gray-100 transition-colors"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Click outside to close dropdown */}
      {showAdminDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowAdminDropdown(false)}
        />
      )}
    </nav>
  );
};

export default Navbar; 