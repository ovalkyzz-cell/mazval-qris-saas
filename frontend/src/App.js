import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import axios from 'axios';

// Context
import { AuthProvider } from './context/AuthContext';

// Layouts
import MainLayout from './components/Layouts/MainLayout';
import AdminLayout from './components/Layouts/AdminLayout';
import ResellerLayout from './components/Layouts/ResellerLayout';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Pricing from './pages/Pricing';
import Payment from './pages/Payment';
import Transactions from './pages/Transactions';
import Chat from './pages/Chat';
import Profile from './pages/Profile';
import Settings from './pages/Settings';

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard';
import AdminUsers from './pages/admin/Users';
import AdminResellers from './pages/admin/Resellers';
import AdminTransactions from './pages/admin/Transactions';
import AdminPlans from './pages/admin/Plans';
import AdminPromos from './pages/admin/Promos';
import AdminAuditLogs from './pages/admin/AuditLogs';

// Reseller Pages
import ResellerDashboard from './pages/reseller/Dashboard';
import ResellerCustomers from './pages/reseller/Customers';

// Protected Route Component
const ProtectedRoute = ({ children, requiredRole }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await axios.get('/api/auth/me', { withCredentials: true });
        setUser(res.data.data.user);
      } catch (err) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user.role_name !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }

  return React.cloneElement(children, { user });
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Toaster position="top-right" />
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/pricing" element={<Pricing />} />

          {/* User Routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <MainLayout><Dashboard /></MainLayout>
            </ProtectedRoute>
          } />
          <Route path="/payment" element={
            <ProtectedRoute>
              <MainLayout><Payment /></MainLayout>
            </ProtectedRoute>
          } />
          <Route path="/transactions" element={
            <ProtectedRoute>
              <MainLayout><Transactions /></MainLayout>
            </ProtectedRoute>
          } />
          <Route path="/chat" element={
            <ProtectedRoute>
              <MainLayout><Chat /></MainLayout>
            </ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute>
              <MainLayout><Profile /></MainLayout>
            </ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute>
              <MainLayout><Settings /></MainLayout>
            </ProtectedRoute>
          } />

          {/* Admin Routes */}
          <Route path="/admin" element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminLayout><AdminDashboard /></AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/users" element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminLayout><AdminUsers /></AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/resellers" element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminLayout><AdminResellers /></AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/transactions" element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminLayout><AdminTransactions /></AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/plans" element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminLayout><AdminPlans /></AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/promos" element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminLayout><AdminPromos /></AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/audit-logs" element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminLayout><AdminAuditLogs /></AdminLayout>
            </ProtectedRoute>
          } />

          {/* Reseller Routes */}
          <Route path="/reseller" element={
            <ProtectedRoute requiredRole="RESELLER">
              <ResellerLayout><ResellerDashboard /></ResellerLayout>
            </ProtectedRoute>
          } />
          <Route path="/reseller/customers" element={
            <ProtectedRoute requiredRole="RESELLER">
              <ResellerLayout><ResellerCustomers /></ResellerLayout>
            </ProtectedRoute>
          } />

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
