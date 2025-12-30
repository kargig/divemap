import PropTypes from 'prop-types';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from 'react-query';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import EmailVerificationBanner from './components/EmailVerificationBanner';
import Navbar from './components/Navbar';
import ReportIssueButton from './components/ReportIssueButton';
import { SessionManager } from './components/SessionManager';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import About from './pages/About';
import Admin from './pages/Admin';
import AdminDives from './pages/AdminDives';
import AdminDiveSiteAliases from './pages/AdminDiveSiteAliases';
import AdminDiveSites from './pages/AdminDiveSites';
import AdminDivingCenters from './pages/AdminDivingCenters';
import AdminDivingOrganizationCertifications from './pages/AdminDivingOrganizationCertifications';
import AdminDivingOrganizations from './pages/AdminDivingOrganizations';
import AdminGeneralStatistics from './pages/AdminGeneralStatistics';
import AdminGrowthVisualizations from './pages/AdminGrowthVisualizations';
import AdminNewsletters from './pages/AdminNewsletters';
import AdminNotificationPreferences from './pages/AdminNotificationPreferences';
import AdminOwnershipRequests from './pages/AdminOwnershipRequests';
import AdminRecentActivity from './pages/AdminRecentActivity';
import AdminSystemMetrics from './pages/AdminSystemMetrics';
import AdminTags from './pages/AdminTags';
import AdminUsers from './pages/AdminUsers';
import API from './pages/API';
import Changelog from './pages/Changelog';
import CheckYourEmail from './pages/CheckYourEmail';
import CreateDive from './pages/CreateDive';
import CreateDiveSite from './pages/CreateDiveSite';
import CreateDivingCenter from './pages/CreateDivingCenter';
import CreateTrip from './pages/CreateTrip';
import DiveDetail from './pages/DiveDetail';
import DiveRouteDrawing from './pages/DiveRouteDrawing';
import Dives from './pages/Dives';
import DiveSiteDetail from './pages/DiveSiteDetail';
import DiveSiteMap from './pages/DiveSiteMap';
import DiveSites from './pages/DiveSites';
import DiveTrips from './pages/DiveTrips';
import DivingCenterDetail from './pages/DivingCenterDetail';
import DivingCenters from './pages/DivingCenters';
import DivingOrganizationsPage from './pages/DivingOrganizationsPage';
import DivingTagsPage from './pages/DivingTagsPage';
import EditDive from './pages/EditDive';
import EditDiveSite from './pages/EditDiveSite';
import EditDivingCenter from './pages/EditDivingCenter';
import Help from './pages/Help';
import Home from './pages/Home';
import IndependentMapView from './pages/IndependentMapView';
import Login from './pages/Login';
import NotificationPreferencesPage from './pages/NotificationPreferences';
import Notifications from './pages/Notifications';
import Privacy from './pages/Privacy';
import Profile from './pages/Profile';
import Register from './pages/Register';
import Resubscribe from './pages/Resubscribe';
import RouteDetail from './pages/RouteDetail';
import Tools from './pages/Tools';
import TripDetail from './pages/TripDetail';
import Unsubscribe from './pages/Unsubscribe';
import UserProfile from './pages/UserProfile';
import VerifyEmail from './pages/VerifyEmail';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Protected route component
const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className='flex justify-center items-center h-screen'>Loading...</div>;
  }

  if (!user) {
    return <Navigate to='/login' replace />;
  }

  if (requireAdmin && !user.is_admin) {
    return <Navigate to='/' replace />;
  }

  return children;
};

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
  requireAdmin: PropTypes.bool,
};

// Protected route for admin/moderator or owner
const ProtectedEditRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className='flex justify-center items-center h-screen'>Loading...</div>;
  }

  if (!user) {
    return <Navigate to='/login' replace />;
  }

  // Allow admin, moderator, or owners (ownership will be checked in the component)
  if (!user.is_admin && !user.is_moderator) {
    // For non-admin/non-moderator users, we'll let them through
    // The individual components will check ownership
    return children;
  }

  return children;
};

ProtectedEditRoute.propTypes = {
  children: PropTypes.node.isRequired,
};

// Protected route for trip creation (admin, moderator, or diving center owners)
const ProtectedTripCreationRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className='flex justify-center items-center h-screen'>Loading...</div>;
  }

  if (!user) {
    return <Navigate to='/login' replace />;
  }

  // Allow admin, moderator, or owners (ownership check will be done in component)
  // The component will verify ownership status
  return children;
};

ProtectedTripCreationRoute.propTypes = {
  children: PropTypes.node.isRequired,
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NotificationProvider>
          <Router>
            <div className='min-h-screen bg-gray-50'>
              <Navbar />
              <SessionManager />
              <main className='container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 pt-16'>
                <EmailVerificationBanner />
                <Routes>
                  <Route path='/' element={<Home />} />
                  <Route path='/about' element={<About />} />
                  <Route path='/resources/tags' element={<DivingTagsPage />} />
                  <Route
                    path='/resources/diving-organizations'
                    element={<DivingOrganizationsPage />}
                  />
                  <Route path='/resources/tools' element={<Tools />} />
                  <Route path='/api-docs' element={<API />} />
                  <Route path='/changelog' element={<Changelog />} />
                  <Route path='/help' element={<Help />} />
                  <Route path='/privacy' element={<Privacy />} />
                  <Route path='/login' element={<Login />} />
                  <Route path='/register' element={<Register />} />
                  <Route path='/verify-email' element={<VerifyEmail />} />
                  <Route path='/check-email' element={<CheckYourEmail />} />
                  <Route path='/unsubscribe' element={<Unsubscribe />} />
                  <Route path='/resubscribe' element={<Resubscribe />} />
                  <Route path='/users/:username' element={<UserProfile />} />
                  <Route path='/dive-sites' element={<DiveSites />} />
                  <Route path='/dive-sites/:id' element={<DiveSiteDetail />} />
                  <Route path='/dive-sites/:id/map' element={<DiveSiteMap />} />
                  <Route
                    path='/dive-sites/:diveSiteId/dive-route'
                    element={
                      <ProtectedRoute>
                        <DiveRouteDrawing />
                      </ProtectedRoute>
                    }
                  />
                  <Route path='/dive-sites/:diveSiteId/route/:routeId' element={<RouteDetail />} />
                  <Route
                    path='/dive-sites/:diveSiteId/route/:routeId/edit'
                    element={
                      <ProtectedRoute>
                        <DiveRouteDrawing />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path='/dive-sites/create'
                    element={
                      <ProtectedRoute>
                        <CreateDiveSite />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path='/dive-sites/:id/edit'
                    element={
                      <ProtectedEditRoute>
                        <EditDiveSite />
                      </ProtectedEditRoute>
                    }
                  />
                  <Route path='/diving-centers' element={<DivingCenters />} />
                  <Route path='/diving-centers/:id' element={<DivingCenterDetail />} />
                  <Route
                    path='/diving-centers/create'
                    element={
                      <ProtectedRoute>
                        <CreateDivingCenter />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path='/diving-centers/:id/edit'
                    element={
                      <ProtectedEditRoute>
                        <EditDivingCenter />
                      </ProtectedEditRoute>
                    }
                  />
                  <Route
                    path='/profile'
                    element={
                      <ProtectedRoute>
                        <Profile />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path='/notifications'
                    element={
                      <ProtectedRoute>
                        <Notifications />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path='/notifications/preferences'
                    element={
                      <ProtectedRoute>
                        <NotificationPreferencesPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path='/profile/notifications'
                    element={
                      <ProtectedRoute>
                        <Profile />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path='/admin'
                    element={
                      <ProtectedRoute requireAdmin={true}>
                        <Admin />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path='/admin/dive-sites'
                    element={
                      <ProtectedRoute requireAdmin={true}>
                        <AdminDiveSites />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path='/admin/dive-sites/:diveSiteId/aliases'
                    element={
                      <ProtectedRoute requireAdmin={true}>
                        <AdminDiveSiteAliases />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path='/admin/diving-centers'
                    element={
                      <ProtectedRoute requireAdmin={true}>
                        <AdminDivingCenters />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path='/admin/diving-organizations'
                    element={
                      <ProtectedRoute requireAdmin={true}>
                        <AdminDivingOrganizations />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path='/admin/diving-organizations/:identifier/certifications'
                    element={
                      <ProtectedRoute requireAdmin={true}>
                        <AdminDivingOrganizationCertifications />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path='/admin/tags'
                    element={
                      <ProtectedRoute requireAdmin={true}>
                        <AdminTags />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path='/admin/users'
                    element={
                      <ProtectedRoute requireAdmin={true}>
                        <AdminUsers />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path='/admin/notification-preferences'
                    element={
                      <ProtectedRoute requireAdmin={true}>
                        <AdminNotificationPreferences />
                      </ProtectedRoute>
                    }
                  />
                  <Route path='/dives' element={<Dives />} />
                  <Route
                    path='/dives/create'
                    element={
                      <ProtectedRoute>
                        <CreateDive />
                      </ProtectedRoute>
                    }
                  />
                  <Route path='/dives/:id' element={<DiveDetail />} />
                  <Route
                    path='/dives/:id/edit'
                    element={
                      <ProtectedRoute>
                        <EditDive />
                      </ProtectedRoute>
                    }
                  />

                  {/* Independent Map View Routes */}
                  <Route path='/map' element={<IndependentMapView />} />
                  <Route path='/map/dive-sites' element={<IndependentMapView />} />
                  <Route path='/map/diving-centers' element={<IndependentMapView />} />
                  <Route
                    path='/map/dives'
                    element={
                      <ProtectedRoute>
                        <IndependentMapView />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path='/admin/dives'
                    element={
                      <ProtectedRoute requireAdmin={true}>
                        <AdminDives />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path='/admin/ownership-requests'
                    element={
                      <ProtectedRoute requireAdmin={true}>
                        <AdminOwnershipRequests />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path='/admin/newsletters'
                    element={
                      <ProtectedRoute requireAdmin={true}>
                        <AdminNewsletters />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path='/admin/system-metrics'
                    element={
                      <ProtectedRoute requireAdmin={true}>
                        <AdminSystemMetrics />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path='/admin/general-statistics'
                    element={
                      <ProtectedRoute requireAdmin={true}>
                        <AdminGeneralStatistics />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path='/admin/growth-visualizations'
                    element={
                      <ProtectedRoute requireAdmin={true}>
                        <AdminGrowthVisualizations />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path='/admin/recent-activity'
                    element={
                      <ProtectedRoute requireAdmin={true}>
                        <AdminRecentActivity />
                      </ProtectedRoute>
                    }
                  />
                  <Route path='/dive-trips' element={<DiveTrips />} />
                  <Route
                    path='/dive-trips/create'
                    element={
                      <ProtectedTripCreationRoute>
                        <CreateTrip />
                      </ProtectedTripCreationRoute>
                    }
                  />
                  <Route path='/dive-trips/:id' element={<TripDetail />} />
                </Routes>
                <ReportIssueButton />
              </main>
              <Toaster
                position='top-right'
                toastOptions={{
                  duration: 2000,
                  style: {
                    marginTop: '4rem', // Add top margin to appear below navbar
                    zIndex: 9999, // Ensure it's above other elements but below navbar dropdown
                  },
                }}
              />
            </div>
          </Router>
        </NotificationProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
