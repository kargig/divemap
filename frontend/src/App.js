import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import DiveSites from './pages/DiveSites';
import DiveSiteDetail from './pages/DiveSiteDetail';
import EditDiveSite from './pages/EditDiveSite';
import DivingCenters from './pages/DivingCenters';
import DivingCenterDetail from './pages/DivingCenterDetail';
import EditDivingCenter from './pages/EditDivingCenter';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import AdminDiveSites from './pages/AdminDiveSites';
import AdminDivingCenters from './pages/AdminDivingCenters';
import AdminDivingOrganizations from './pages/AdminDivingOrganizations';
import AdminTags from './pages/AdminTags';
import AdminUsers from './pages/AdminUsers';
import CreateDiveSite from './pages/CreateDiveSite';
import CreateDivingCenter from './pages/CreateDivingCenter';
import DiveSiteMap from './pages/DiveSiteMap';
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
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (requireAdmin && !user.is_admin) {
    return <Navigate to="/" replace />;
  }
  
  return children;
};

// Protected route for admin/moderator
const ProtectedEditRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (!user.is_admin && !user.is_moderator) {
    return <Navigate to="/" replace />;
  }
  
  return children;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <div className="min-h-screen bg-gray-50">
            <Navbar />
            <main className="container mx-auto px-4 py-8 pt-24">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/user/:username" element={<UserProfile />} />
                <Route path="/dive-sites" element={<DiveSites />} />
                <Route 
                  path="/dive-sites/:id" 
                  element={<DiveSiteDetail />} 
                />
                <Route 
                  path="/dive-sites/:id/map" 
                  element={<DiveSiteMap />} 
                />
                <Route 
                  path="/dive-sites/:id/edit" 
                  element={
                    <ProtectedEditRoute>
                      <EditDiveSite />
                    </ProtectedEditRoute>
                  } 
                />
                <Route path="/diving-centers" element={<DivingCenters />} />
                <Route 
                  path="/diving-centers/:id" 
                  element={<DivingCenterDetail />} 
                />
                <Route 
                  path="/diving-centers/:id/edit" 
                  element={
                    <ProtectedEditRoute>
                      <EditDivingCenter />
                    </ProtectedEditRoute>
                  } 
                />
                <Route 
                  path="/profile" 
                  element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/admin" 
                  element={
                    <ProtectedRoute requireAdmin={true}>
                      <Admin />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/admin/dive-sites" 
                  element={
                    <ProtectedRoute requireAdmin={true}>
                      <AdminDiveSites />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/admin/dive-sites/create" 
                  element={
                    <ProtectedRoute requireAdmin={true}>
                      <CreateDiveSite />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/admin/diving-centers" 
                  element={
                    <ProtectedRoute requireAdmin={true}>
                      <AdminDivingCenters />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/admin/diving-centers/create" 
                  element={
                    <ProtectedRoute requireAdmin={true}>
                      <CreateDivingCenter />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/admin/diving-organizations" 
                  element={
                    <ProtectedRoute requireAdmin={true}>
                      <AdminDivingOrganizations />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/admin/tags" 
                  element={
                    <ProtectedRoute requireAdmin={true}>
                      <AdminTags />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/admin/users" 
                  element={
                    <ProtectedRoute requireAdmin={true}>
                      <AdminUsers />
                    </ProtectedRoute>
                  } 
                />
              </Routes>
            </main>
            <Toaster 
              position="top-right" 
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