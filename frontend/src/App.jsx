import { X } from 'lucide-react';
import PropTypes from 'prop-types';
import { Suspense, lazy } from 'react';
import { Toaster, ToastBar, toast } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from 'react-query';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';

import ChatWidget from './components/Chat/ChatWidget';
import EmailVerificationBanner from './components/EmailVerificationBanner';
import Navbar from './components/Navbar';
import PWAUpdater from './components/PWAUpdater';
import ReportIssueButton from './components/ReportIssueButton';
import ScrollToTop from './components/ScrollToTop';
import { SessionManager } from './components/SessionManager';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';

// Lazy load pages
const AdminLayout = lazy(() => import('./components/AdminLayout'));
const About = lazy(() => import('./pages/About'));
const Admin = lazy(() => import('./pages/Admin'));
const AdminDives = lazy(() => import('./pages/AdminDives'));
const AdminDiveSiteAliases = lazy(() => import('./pages/AdminDiveSiteAliases'));
const AdminDiveSites = lazy(() => import('./pages/AdminDiveSites'));
const AdminEditRequests = lazy(() => import('./pages/AdminEditRequests'));
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
const AIChatHistory = lazy(() => import('./pages/AIChatHistory'));
const AIChatHistoryDetail = lazy(() => import('./pages/AIChatHistoryDetail'));
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
const Leaderboard = lazy(() => import('./pages/LeaderboardPage'));
const Login = lazy(() => import('./pages/Login'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const NotificationPreferencesPage = lazy(() => import('./pages/NotificationPreferences'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Profile = lazy(() => import('./pages/Profile'));
const Buddies = lazy(() => import('./pages/Buddies'));
const PersonalAccessTokens = lazy(() => import('./pages/PersonalAccessTokens'));
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

function AppContent() {
  const location = useLocation();
  const isAdminPath = location.pathname.startsWith('/admin');

  return (
    <div className='min-h-screen bg-gray-50'>
      <PWAUpdater />
      <Navbar />
      <SessionManager />
      <main
        className={`${isAdminPath ? 'w-full max-w-none px-0' : 'container mx-auto px-4 sm:px-6 lg:px-8'} py-4 sm:py-8 pt-16`}
      >
        <EmailVerificationBanner />
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path='/' element={<Home />} />
            <Route path='/about' element={<About />} />
            <Route path='/resources/tags' element={<DivingTagsPage />} />
            <Route path='/resources/diving-organizations' element={<DivingOrganizationsPage />} />
            <Route path='/resources/tools' element={<Tools />} />
            <Route path='/api-docs' element={<API />} />
            <Route path='/changelog' element={<Changelog />} />
            <Route path='/help' element={<Help />} />
            <Route path='/privacy' element={<Privacy />} />
            <Route path='/login' element={<Login />} />
            <Route path='/forgot-password' element={<ForgotPassword />} />
            <Route path='/reset-password' element={<ResetPassword />} />
            <Route path='/register' element={<Register />} />
            <Route
              path='/messages'
              element={
                <ProtectedRoute>
                  <Messages />
                </ProtectedRoute>
              }
            />
            <Route
              path='/ai-chat-history'
              element={
                <ProtectedRoute>
                  <AIChatHistory />
                </ProtectedRoute>
              }
            />
            <Route
              path='/ai-chat-history/:id'
              element={
                <ProtectedRoute>
                  <AIChatHistoryDetail />
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
              path='/notification-preferences'
              element={
                <ProtectedRoute>
                  <NotificationPreferencesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path='/personal-access-tokens'
              element={
                <ProtectedRoute>
                  <PersonalAccessTokens />
                </ProtectedRoute>
              }
            />
            <Route
              path='/buddies'
              element={
                <ProtectedRoute>
                  <Buddies />
                </ProtectedRoute>
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
            <Route path='/users/:username' element={<UserProfile />} />
            <Route path='/verify-email' element={<VerifyEmail />} />
            <Route path='/check-your-email' element={<CheckYourEmail />} />
            <Route path='/resubscribe' element={<Resubscribe />} />
            <Route path='/unsubscribe' element={<Unsubscribe />} />

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

            <Route path='/dive-sites' element={<DiveSites />} />
            <Route
              path='/dive-sites/create'
              element={
                <ProtectedRoute>
                  <CreateDiveSite />
                </ProtectedRoute>
              }
            />
            <Route path='/dive-sites/:id' element={<DiveSiteDetail />} />
            <Route path='/dive-sites/:id/:slug' element={<DiveSiteDetail />} />
            <Route
              path='/dive-sites/:id/edit'
              element={
                <ProtectedRoute>
                  <EditDiveSite />
                </ProtectedRoute>
              }
            />
            <Route path='/dive-sites/:id/map' element={<DiveSiteMap />} />

            <Route path='/diving-centers' element={<DivingCenters />} />
            <Route
              path='/diving-centers/create'
              element={
                <ProtectedRoute>
                  <CreateDivingCenter />
                </ProtectedRoute>
              }
            />
            <Route path='/diving-centers/:id' element={<DivingCenterDetail />} />
            <Route path='/diving-centers/:id/:slug' element={<DivingCenterDetail />} />
            <Route
              path='/diving-centers/:id/edit'
              element={
                <ProtectedRoute>
                  <EditDivingCenter />
                </ProtectedRoute>
              }
            />

            <Route path='/dive-routes' element={<DiveRoutes />} />
            <Route path='/dive-routes/:id' element={<RouteDetail />} />
            <Route path='/dive-routes/:id/:slug' element={<RouteDetail />} />
            <Route
              path='/dive-routes/:id/draw'
              element={
                <ProtectedRoute>
                  <DiveRouteDrawing />
                </ProtectedRoute>
              }
            />

            <Route path='/map' element={<IndependentMapView />} />
            <Route path='/leaderboard' element={<Leaderboard />} />

            {/* Admin Routes */}
            <Route path='/admin' element={<AdminLayout />}>
              <Route index element={<Admin />} />
              <Route path='users' element={<AdminUsers />} />
              <Route path='recent-activity' element={<AdminRecentActivity />} />
              <Route path='audit-logs' element={<AdminAuditLogs />} />
              <Route path='system-metrics' element={<AdminSystemMetrics />} />
              <Route path='general-statistics' element={<AdminGeneralStatistics />} />
              <Route path='growth-visualizations' element={<AdminGrowthVisualizations />} />
              <Route path='dive-sites' element={<AdminDiveSites />} />
              <Route path='dive-sites/edit-requests' element={<AdminEditRequests />} />
              <Route path='diving-centers' element={<AdminDivingCenters />} />
              <Route path='dives' element={<AdminDives />} />
              <Route path='dive-routes' element={<AdminDiveRoutes />} />
              <Route path='diving-organizations' element={<AdminDivingOrganizations />} />
              <Route
                path='diving-organizations/:id/certifications'
                element={<AdminDivingOrganizationCertifications />}
              />
              <Route path='tags' element={<AdminTags />} />
              <Route path='newsletters' element={<AdminNewsletters />} />
              <Route path='chat-history' element={<AdminChatHistory />} />
              <Route path='chat-feedback' element={<AdminChatFeedback />} />
              <Route path='notification-preferences' element={<AdminNotificationPreferences />} />
              <Route path='ownership-requests' element={<AdminOwnershipRequests />} />
              <Route path='dive-sites/:id/aliases' element={<AdminDiveSiteAliases />} />
            </Route>

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
          duration: 3000, // Set to 3s for a balance of readability and speed
          style: {
            marginTop: '4rem', // Add top margin to appear below navbar
            zIndex: 9999, // Ensure it's above other elements but below navbar dropdown
          },
        }}
      >
        {t => (
          <ToastBar toast={t}>
            {({ icon, message }) => (
              <>
                {icon}
                {message}
                {t.type !== 'loading' && (
                  <button
                    onClick={() => toast.dismiss(t.id)}
                    className='ml-2 hover:bg-black/5 rounded-full p-0.5 transition-colors focus:outline-none'
                    aria-label='Close'
                  >
                    <X size={14} />
                  </button>
                )}
              </>
            )}
          </ToastBar>
        )}
      </Toaster>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NotificationProvider>
          <Router>
            <ScrollToTop />
            <AppContent />
          </Router>
        </NotificationProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
