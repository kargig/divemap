import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, User, Map, Home, Settings, Building } from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="bg-blue-600 text-white shadow-lg">
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
                  <Link to="/admin" className="flex items-center space-x-1 hover:text-blue-200 transition-colors">
                    <Settings className="h-5 w-5" />
                    <span>Admin</span>
                  </Link>
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
    </nav>
  );
};

export default Navbar; 