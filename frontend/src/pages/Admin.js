import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Users, MapPin, Building2, Tags, Settings, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Admin = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user?.is_admin) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Access denied. Admin privileges required.</p>
      </div>
    );
  }

  const adminCards = [
    {
      title: 'Dive Sites Management',
      description: 'Manage all dive sites, view details, edit information, and delete sites.',
      icon: <MapPin className="h-8 w-8 text-blue-600" />,
      href: '/admin/dive-sites',
      color: 'bg-blue-50 border-blue-200 hover:bg-blue-100'
    },
    {
      title: 'Diving Centers Management',
      description: 'Manage all diving centers, contact information, locations, and ratings.',
      icon: <Building2 className="h-8 w-8 text-green-600" />,
      href: '/admin/diving-centers',
      color: 'bg-green-50 border-green-200 hover:bg-green-100'
    },
    {
      title: 'Tag Management',
      description: 'Create, edit, and delete tags used to categorize dive sites.',
      icon: <Tags className="h-8 w-8 text-purple-600" />,
      href: '/admin/tags',
      color: 'bg-purple-50 border-purple-200 hover:bg-purple-100'
    },
    {
      title: 'User Management',
      description: 'Manage user accounts, roles, permissions, and account status.',
      icon: <Users className="h-8 w-8 text-orange-600" />,
      href: '/admin/users',
      color: 'bg-orange-50 border-orange-200 hover:bg-orange-100'
    }
  ];

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-2">Manage all aspects of the dive site platform</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {adminCards.map((card, index) => (
          <div
            key={index}
            onClick={() => navigate(card.href)}
            className={`${card.color} border rounded-lg p-6 cursor-pointer transition-all duration-200 transform hover:scale-105`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center mb-4">
                  {card.icon}
                  <h3 className="text-xl font-semibold text-gray-900 ml-3">
                    {card.title}
                  </h3>
                </div>
                <p className="text-gray-600 mb-4">
                  {card.description}
                </p>
                <div className="flex items-center text-blue-600 font-medium">
                  <span>Manage</span>
                  <ArrowRight className="h-4 w-4 ml-2" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 p-6 bg-gray-50 rounded-lg">
        <div className="flex items-center mb-4">
          <Settings className="h-6 w-6 text-gray-600 mr-3" />
          <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg border">
            <h4 className="font-medium text-gray-900 mb-2">System Overview</h4>
            <p className="text-sm text-gray-600">View platform statistics and system health</p>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <h4 className="font-medium text-gray-900 mb-2">Recent Activity</h4>
            <p className="text-sm text-gray-600">Monitor recent user actions and changes</p>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <h4 className="font-medium text-gray-900 mb-2">Backup & Export</h4>
            <p className="text-sm text-gray-600">Export data and manage backups</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Admin; 