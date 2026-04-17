import {
  Menu,
  Home,
  Database,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Notebook,
  Building2,
  Award,
  Tags,
  FileText,
  Route,
  Crown,
  Bell,
  MessageSquare,
  History,
  Activity,
  BarChart3,
  Shield,
  Clock,
  LayoutDashboard,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';

const AdminLayout = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const sidebarRef = useRef(null);

  // Responsive / Layout state
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Foldable categories state
  const [expandedCategories, setExpandedCategories] = useState(() => {
    const saved = localStorage.getItem('divemap_admin_expanded_categories');
    return saved
      ? JSON.parse(saved)
      : {
          Dashboard: true,
          'Content Management': true,
          Community: true,
          'AI & Support': true,
          'System & Analytics': true,
        };
  });

  // Persistent scroll position
  useEffect(() => {
    const savedScrollPos = window.sessionStorage.getItem('divemap_admin_sidebar_scroll');
    if (savedScrollPos && sidebarRef.current) {
      sidebarRef.current.scrollTop = parseInt(savedScrollPos, 10);
    }
  }, []);

  const handleSidebarScroll = e => {
    window.sessionStorage.setItem('divemap_admin_sidebar_scroll', e.target.scrollTop);
  };

  // Initialize sidebar state from localStorage on mount (desktop only)
  useEffect(() => {
    const savedState = localStorage.getItem('divemap_admin_sidebar_open');
    if (savedState !== null) {
      setIsSidebarOpen(JSON.parse(savedState));
    }

    // Auto-close mobile menu on route change
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const toggleSidebar = () => {
    const newState = !isSidebarOpen;
    setIsSidebarOpen(newState);
    localStorage.setItem('divemap_admin_sidebar_open', JSON.stringify(newState));
  };

  const toggleCategory = title => {
    setExpandedCategories(prev => {
      const newState = { ...prev, [title]: !prev[title] };
      localStorage.setItem('divemap_admin_expanded_categories', JSON.stringify(newState));
      return newState;
    });
  };

  const navCategories = [
    {
      title: 'Dashboard',
      icon: <LayoutDashboard className='h-5 w-5' />,
      links: [{ name: 'Overview', path: '/admin', icon: <Home className='h-4 w-4' />, end: true }],
    },
    {
      title: 'Content Management',
      icon: <Database className='h-5 w-5' />,
      links: [
        { name: 'Dives', path: '/admin/dives', icon: <Notebook className='h-4 w-4' /> },
        { name: 'Dive Sites', path: '/admin/dive-sites', icon: <MapPin className='h-4 w-4' /> },
        {
          name: 'Pending Edits',
          path: '/admin/dive-sites/edit-requests',
          icon: <FileText className='h-4 w-4' />,
        },
        { name: 'Dive Routes', path: '/admin/dive-routes', icon: <Route className='h-4 w-4' /> },
        {
          name: 'Diving Centers',
          path: '/admin/diving-centers',
          icon: <Building2 className='h-4 w-4' />,
        },
        {
          name: 'Organizations',
          path: '/admin/diving-organizations',
          icon: <Award className='h-4 w-4' />,
        },
        { name: 'Tags', path: '/admin/tags', icon: <Tags className='h-4 w-4' /> },
        { name: 'Newsletters', path: '/admin/newsletters', icon: <FileText className='h-4 w-4' /> },
      ],
    },
    {
      title: 'Community',
      icon: <Users className='h-5 w-5' />,
      links: [
        { name: 'Users', path: '/admin/users', icon: <Users className='h-4 w-4' /> },
        {
          name: 'Ownership Requests',
          path: '/admin/ownership-requests',
          icon: <Crown className='h-4 w-4' />,
        },
        {
          name: 'Notifications',
          path: '/admin/notification-preferences',
          icon: <Bell className='h-4 w-4' />,
        },
      ],
    },
    {
      title: 'AI & Support',
      icon: <MessageSquare className='h-5 w-5' />,
      links: [
        {
          name: 'Chat History',
          path: '/admin/chat-history',
          icon: <History className='h-4 w-4' />,
        },
        {
          name: 'Chat Feedback',
          path: '/admin/chat-feedback',
          icon: <MessageSquare className='h-4 w-4' />,
        },
      ],
    },
    {
      title: 'System & Analytics',
      icon: <Settings className='h-5 w-5' />,
      links: [
        {
          name: 'System Metrics',
          path: '/admin/system-metrics',
          icon: <Activity className='h-4 w-4' />,
        },
        {
          name: 'General Stats',
          path: '/admin/general-statistics',
          icon: <BarChart3 className='h-4 w-4' />,
        },
        {
          name: 'Growth',
          path: '/admin/growth-visualizations',
          icon: <BarChart3 className='h-4 w-4' />,
        },
        {
          name: 'Activity Log',
          path: '/admin/recent-activity',
          icon: <Clock className='h-4 w-4' />,
        },
        { name: 'Audit Logs', path: '/admin/audit-logs', icon: <Shield className='h-4 w-4' /> },
      ],
    },
  ];

  if (!user?.is_admin) {
    return (
      <div className='flex items-center justify-center h-screen bg-gray-50'>
        <div className='text-center p-8 bg-white rounded-lg shadow-md max-w-md'>
          <Shield className='h-16 w-16 text-red-500 mx-auto mb-4' />
          <h2 className='text-2xl font-bold text-gray-900 mb-2'>Access Denied</h2>
          <p className='text-gray-600 mb-6'>
            You need administrator privileges to access this area.
          </p>
          <button
            onClick={() => navigate('/')}
            className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors'
          >
            Return to Main Site
          </button>
        </div>
      </div>
    );
  }

  // Generate breadcrumbs based on current path
  const generateBreadcrumbs = () => {
    const paths = location.pathname.split('/').filter(Boolean);
    if (paths.length <= 1)
      return <span className='text-gray-900 font-medium'>Dashboard Overview</span>;

    // Find the current active link name
    let activeLinkName = '';
    let categoryName = '';

    for (const category of navCategories) {
      const activeLink = category.links.find(link =>
        link.end ? location.pathname === link.path : location.pathname.startsWith(link.path)
      );
      if (activeLink) {
        activeLinkName = activeLink.name;
        categoryName = category.title;
        break;
      }
    }

    return (
      <div className='flex items-center text-sm'>
        <span className='text-gray-500 hidden sm:inline'>{categoryName}</span>
        <span className='mx-2 text-gray-400 hidden sm:inline'>/</span>
        <span className='text-gray-900 font-medium'>
          {activeLinkName || paths[paths.length - 1]}
        </span>
      </div>
    );
  };

  return (
    <div className='flex h-screen bg-gray-50 overflow-hidden font-sans'>
      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div
          className='fixed inset-0 bg-gray-900/50 z-40 md:hidden backdrop-blur-sm'
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-gray-900 text-gray-100 transition-all duration-300 ease-in-out flex flex-col shadow-xl md:shadow-none
          ${isMobileMenuOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0'}
          ${isSidebarOpen ? 'md:w-64' : 'md:w-20'}
        `}
      >
        <div className='flex flex-col h-full'>
          <div className='p-4 border-b border-gray-800 flex items-center justify-between shrink-0'>
            <div
              className={`flex items-center overflow-hidden transition-all duration-300 ${isSidebarOpen ? 'opacity-100' : 'w-0 opacity-0 md:w-auto md:opacity-100'}`}
            >
              <Shield className='h-8 w-8 text-blue-400 shrink-0' />
              <span
                className={`ml-3 font-bold text-xl text-white whitespace-nowrap transition-all duration-300 ${!isSidebarOpen ? 'md:hidden' : ''}`}
              >
                Admin Panel
              </span>
            </div>
          </div>

          <div
            ref={sidebarRef}
            onScroll={handleSidebarScroll}
            className='flex-1 overflow-y-auto py-4 overflow-x-hidden custom-scrollbar'
          >
            <div className='px-3 space-y-4'>
              {navCategories.map((category, idx) => {
                const isExpanded = expandedCategories[category.title];

                return (
                  <div key={idx} className='space-y-1'>
                    <button
                      onClick={() => toggleCategory(category.title)}
                      className={`w-full px-3 mb-2 flex items-center text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-white transition-colors focus:outline-none ${!isSidebarOpen ? 'md:justify-center' : 'justify-between'}`}
                    >
                      <div className='flex items-center'>
                        {!isSidebarOpen ? (
                          <span title={category.title} className='hidden md:block'>
                            {category.icon}
                          </span>
                        ) : (
                          <span>{category.title}</span>
                        )}
                        <span className='md:hidden'>{category.title}</span>
                      </div>
                      {isSidebarOpen && (
                        <ChevronDown
                          className={`h-3 w-3 transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`}
                        />
                      )}
                    </button>

                    <div
                      className={`space-y-1 overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}
                    >
                      {category.links.map((link, linkIdx) => (
                        <NavLink
                          key={linkIdx}
                          to={link.path}
                          end={link.end}
                          title={!isSidebarOpen ? link.name : undefined}
                          className={({ isActive }) =>
                            `flex items-center px-3 py-2 rounded-md transition-colors group ${
                              isActive
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                            } ${!isSidebarOpen ? 'md:justify-center' : ''}`
                          }
                        >
                          <span className='shrink-0'>{link.icon}</span>
                          <span
                            className={`ml-3 whitespace-nowrap transition-all duration-300 ${!isSidebarOpen ? 'md:hidden' : ''}`}
                          >
                            {link.name}
                          </span>
                        </NavLink>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className='p-4 border-t border-gray-800 shrink-0'>
            <button
              onClick={() => navigate('/')}
              className={`flex items-center w-full px-3 py-2 text-sm font-medium text-gray-300 bg-gray-800 rounded-md hover:bg-gray-700 hover:text-white transition-colors ${!isSidebarOpen ? 'md:justify-center' : ''}`}
              title={!isSidebarOpen ? 'Back to Main Site' : undefined}
            >
              <ExternalLink className='h-4 w-4 shrink-0' />
              <span
                className={`ml-2 whitespace-nowrap transition-all duration-300 ${!isSidebarOpen ? 'md:hidden' : ''}`}
              >
                Back to Main Site
              </span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'md:ml-64' : 'md:ml-20'}`}
      >
        {/* Top Header */}
        <header className='bg-white shadow-sm border-b border-gray-200 z-10 shrink-0 h-16'>
          <div className='flex items-center justify-between px-4 sm:px-6 h-full'>
            <div className='flex items-center'>
              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className='p-2 mr-3 text-gray-500 rounded-md hover:bg-gray-100 md:hidden focus:outline-none focus:ring-2 focus:ring-blue-500'
                aria-label='Open sidebar'
              >
                <Menu className='h-6 w-6' />
              </button>

              {/* Desktop Collapse Toggle */}
              <button
                onClick={toggleSidebar}
                className='hidden md:flex p-1.5 mr-4 text-gray-500 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-200'
                aria-label='Toggle sidebar'
                title={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              >
                {isSidebarOpen ? (
                  <ChevronLeft className='h-5 w-5' />
                ) : (
                  <ChevronRight className='h-5 w-5' />
                )}
              </button>

              {/* Breadcrumbs */}
              {generateBreadcrumbs()}
            </div>

            {/* Header Right Actions */}
            <div className='flex items-center space-x-4'>
              <div className='hidden sm:flex items-center text-sm text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full border border-gray-200'>
                <div className='w-2 h-2 bg-green-500 rounded-full mr-2'></div>
                Admin Mode
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className='flex-1 overflow-auto bg-gray-50/50 relative'>
          <Outlet />
        </main>
      </div>

      {/* Custom Scrollbar Styles for Sidebar */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #374151;
          border-radius: 20px;
        }
      `,
        }}
      />
    </div>
  );
};

export default AdminLayout;
