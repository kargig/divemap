import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from 'react-query';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';

import Navbar from './components/Navbar';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import About from './pages/About';
import Admin from './pages/Admin';
import AdminDives from './pages/AdminDives';
import AdminDiveSiteAliases from './pages/AdminDiveSiteAliases';
import AdminDiveSites from './pages/AdminDiveSites';
import AdminDivingCenters from './pages/AdminDivingCenters';
import AdminDivingOrganizations from './pages/AdminDivingOrganizations';
import AdminNewsletters from './pages/AdminNewsletters';
import AdminOwnershipRequests from './pages/AdminOwnershipRequests';
import AdminTags from './pages/AdminTags';
import AdminUsers from './pages/AdminUsers';
import CreateDive from './pages/CreateDive';
import CreateDiveSite from './pages/CreateDiveSite';
import CreateDivingCenter from './pages/CreateDivingCenter';
import DiveDetail from './pages/DiveDetail';
import DiveMap from './pages/DiveMap';
import DiveMapView from './pages/DiveMapView';
import Dives from './pages/Dives';
import DiveSiteDetail from './pages/DiveSiteDetail';
import DiveSiteMap from './pages/DiveSiteMap';
import DiveSites from './pages/DiveSites';
import DiveTrips from './pages/DiveTrips';
import DivingCenterDetail from './pages/DivingCenterDetail';
import DivingCenters from './pages/DivingCenters';
import EditDive from './pages/EditDive';
import EditDiveSite from './pages/EditDiveSite';
import EditDivingCenter from './pages/EditDivingCenter';
import Help from './pages/Help';
import Home from './pages/Home';
import Login from './pages/Login';
import Profile from './pages/Profile';
import Register from './pages/Register';
import UserProfile from './pages/UserProfile';

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

// Protected route for admin/moderator or owner
const ProtectedEditRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const { id } = useParams();

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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <div className='min-h-screen bg-gray-50'>
            <Navbar />
            <main className='container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 pt-20 sm:pt-24'>
              <Routes>
                <Route path='/' element={<Home />} />
                <Route path='/about' element={<About />} />
                <Route path='/help' element={<Help />} />
                <Route path='/login' element={<Login />} />
                <Route path='/register' element={<Register />} />
                <Route path='/user/:username' element={<UserProfile />} />
                <Route path='/dive-sites' element={<DiveSites />} />
                <Route path='/dive-sites/:id' element={<DiveSiteDetail />} />
                <Route path='/dive-sites/:id/map' element={<DiveSiteMap />} />
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
                  path='/admin/dive-sites/create'
                  element={
                    <ProtectedRoute requireAdmin={true}>
                      <CreateDiveSite />
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
                  path='/admin/diving-centers/create'
                  element={
                    <ProtectedRoute requireAdmin={true}>
                      <CreateDivingCenter />
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
                <Route path='/dives' element={<Dives />} />
                <Route
                  path='/dives/map'
                  element={
                    <ProtectedRoute>
                      <DiveMapView />
                    </ProtectedRoute>
                  }
                />
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
                <Route
                  path='/admin/dives'
                  element={
                    <ProtectedRoute requireAdmin={true}>
                      <AdminDives />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path='/admin/dives/map'
                  element={
                    <ProtectedRoute requireAdmin={true}>
                      <DiveMap />
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
                <Route path='/dive-trips' element={<DiveTrips />} />
              </Routes>
            </main>
            <Toaster
              position='top-right'
              toastOptions={{
                duration: 500,
                style: {
                  marginTop: '4rem', // Add top margin to appear below navbar
                  zIndex: 9999, // Ensure it's above other elements but below navbar dropdown
                },
              }}
            />
          </div>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
