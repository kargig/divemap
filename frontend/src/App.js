import PropTypes from 'prop-types';
import { Suspense, lazy } from 'react';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from 'react-query';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import ChatWidget from './components/Chat/ChatWidget';
import EmailVerificationBanner from './components/EmailVerificationBanner';
import Navbar from './components/Navbar';
import PWAUpdater from './components/PWAUpdater';
import ReportIssueButton from './components/ReportIssueButton';
import { SessionManager } from './components/SessionManager';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';

// Lazy load pages
const About = lazy(() => import('./pages/About'));
const Admin = lazy(() => import('./pages/Admin'));
const AdminDives = lazy(() => import('./pages/AdminDives'));
const AdminDiveSiteAliases = lazy(() => import('./pages/AdminDiveSiteAliases'));
const AdminDiveSites = lazy(() => import('./pages/AdminDiveSites'));
const AdminDiveRoutes = lazy(() => import('./pages/AdminDiveRoutes'));
const AdminDivingCenters = lazy(() => import('./pages/AdminDivingCenters'));
const AdminDivingOrganizationCertifications = lazy(
  () => import('./pages/AdminDivingOrganizationCertifications')
);
const AdminDivingOrganizations = lazy(() => import('./pages/AdminDivingOrganizations'));
const AdminGeneralStatistics = lazy(() => import('./pages/AdminGeneralStatistics'));
const AdminGrowthVisualizations = lazy(() => import('./pages/AdminGrowthVisualizations'));
const AdminNewsletters = lazy(() => import('./pages/AdminNewsletters'));
const AdminNotificationPreferences = lazy(() => import('./pages/AdminNotificationPreferences'));
const AdminOwnershipRequests = lazy(() => import('./pages/AdminOwnershipRequests'));
const AdminRecentActivity = lazy(() => import('./pages/AdminRecentActivity'));
const AdminSystemMetrics = lazy(() => import('./pages/AdminSystemMetrics'));
const AdminTags = lazy(() => import('./pages/AdminTags'));
const AdminUsers = lazy(() => import('./pages/AdminUsers'));
const AdminAuditLogs = lazy(() => import('./pages/AdminAuditLogs'));
const AdminChatFeedback = lazy(() => import('./pages/AdminChatFeedback'));
const AdminChatHistory = lazy(() => import('./pages/AdminChatHistory'));
const API = lazy(() => import('./pages/API'));
const Changelog = lazy(() => import('./pages/Changelog'));
const CheckYourEmail = lazy(() => import('./pages/CheckYourEmail'));
const CreateDive = lazy(() => import('./pages/CreateDive'));
const CreateDiveSite = lazy(() => import('./pages/CreateDiveSite'));
const CreateDivingCenter = lazy(() => import('./pages/CreateDivingCenter'));
const CreateTrip = lazy(() => import('./pages/CreateTrip'));
const DiveDetail = lazy(() => import('./pages/DiveDetail'));
const DiveRouteDrawing = lazy(() => import('./pages/DiveRouteDrawing'));
const DiveRoutes = lazy(() => import('./pages/DiveRoutes'));
const Dives = lazy(() => import('./pages/Dives'));
const DiveSiteDetail = lazy(() => import('./pages/DiveSiteDetail'));
const DiveSiteMap = lazy(() => import('./pages/DiveSiteMap'));
const DiveSites = lazy(() => import('./pages/DiveSites'));
const DiveTrips = lazy(() => import('./pages/DiveTrips'));
const DivingCenterDetail = lazy(() => import('./pages/DivingCenterDetail'));
const DivingCenters = lazy(() => import('./pages/DivingCenters'));
const DivingOrganizationsPage = lazy(() => import('./pages/DivingOrganizationsPage'));
const DivingTagsPage = lazy(() => import('./pages/DivingTagsPage'));
const EditDive = lazy(() => import('./pages/EditDive'));
const EditDiveSite = lazy(() => import('./pages/EditDiveSite'));
const EditDivingCenter = lazy(() => import('./pages/EditDivingCenter'));
const Help = lazy(() => import('./pages/Help'));
const Home = lazy(() => import('./pages/Home'));
const IndependentMapView = lazy(() => import('./pages/IndependentMapView'));
const Login = lazy(() => import('./pages/Login'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const NotificationPreferencesPage = lazy(() => import('./pages/NotificationPreferences'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Profile = lazy(() => import('./pages/Profile'));
const Buddies = lazy(() => import('./pages/Buddies'));
const Register = lazy(() => import('./pages/Register'));
const Messages = lazy(() => import('./pages/Messages'));
const Resubscribe = lazy(() => import('./pages/Resubscribe'));
const RouteDetail = lazy(() => import('./pages/RouteDetail'));
const Tools = lazy(() => import('./pages/Tools'));
const TripDetail = lazy(() => import('./pages/TripDetail'));
const Unsubscribe = lazy(() => import('./pages/Unsubscribe'));
const UserProfile = lazy(() => import('./pages/UserProfile'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const NotFound = lazy(() => import('./pages/NotFound'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Loading Fallback
const LoadingFallback = () => (
  <div className='flex justify-center items-center h-screen'>Loading...</div>
);

// Protected route component
const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingFallback />;
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
    return <LoadingFallback />;
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
    return <LoadingFallback />;
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
              <PWAUpdater />
              <Navbar />
              <SessionManager />
              <main className='container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 pt-16'>
                <EmailVerificationBanner />
                <Suspense fallback={<LoadingFallback />}>
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
                    <Route path='/forgot-password' element={<ForgotPassword />} />
                    <Route path='/reset-password' element={<ResetPassword />} />
                    <Route path='/register' element={<Register />} />
                    <Route path='/messages' element={<Messages />} />
                    <Route path='/verify-email' element={<VerifyEmail />} />
                    <Route path='/check-email' element={<CheckYourEmail />} />
                    <Route path='/unsubscribe' element={<Unsubscribe />} />
                    <Route path='/resubscribe' element={<Resubscribe />} />
                    <Route path='/users/:username' element={<UserProfile />} />
                    <Route
                      path='/buddies'
                      element={
                        <ProtectedRoute>
                          <Buddies />
                        </ProtectedRoute>
                      }
                    />
                    <Route path='/dive-sites' element={<DiveSites />} />
                    <Route path='/dive-sites/:id' element={<DiveSiteDetail />} />
                    <Route path='/dive-sites/:id/:slug' element={<DiveSiteDetail />} />
                    <Route path='/dive-sites/:id/map' element={<DiveSiteMap />} />
                    <Route path='/dive-routes' element={<DiveRoutes />} />
                    <Route
                      path='/dive-sites/:diveSiteId/dive-route'
                      element={
                        <ProtectedRoute>
                          <DiveRouteDrawing />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path='/dive-sites/:diveSiteId/route/:routeId'
                      element={<RouteDetail />}
                    />
                    <Route
                      path='/dive-sites/:diveSiteId/route/:routeId/:slug'
                      element={<RouteDetail />}
                    />
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
                    <Route path='/diving-centers/:id/:slug' element={<DivingCenterDetail />} />
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
                      path='/admin/dive-routes'
                      element={
                        <ProtectedRoute requireAdmin={true}>
                          <AdminDiveRoutes />
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
                      path='/admin/audit-logs'
                      element={
                        <ProtectedRoute requireAdmin={true}>
                          <AdminAuditLogs />
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
                    <Route
                      path='/admin/chat-feedback'
                      element={
                        <ProtectedRoute requireAdmin={true}>
                          <AdminChatFeedback />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path='/admin/chat-history'
                      element={
                        <ProtectedRoute requireAdmin={true}>
                          <AdminChatHistory />
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
                    <Route path='/dives/:id/:slug' element={<DiveDetail />} />
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
                    <Route path='/dive-trips/:id/:slug' element={<TripDetail />} />

                    <Route path='/index.html' element={<Navigate to='/' replace />} />
                    <Route path='/index.htm' element={<Navigate to='/' replace />} />
                    <Route path='*' element={<NotFound />} />
                  </Routes>
                </Suspense>
                <ReportIssueButton />
                <ChatWidget />
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
