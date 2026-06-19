import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import ProtectedRoute from '@/components/ProtectedRoute';
import PolyfaunaOS from '@/components/PolyfaunaOS';
import LoginPage from '@/pages/LoginPage';
import SignupPage from '@/pages/SignupPage';
import UserDashboard from '@/pages/UserDashboard';
import AdminDashboard from '@/pages/AdminDashboard';
import ValidatePage from '@/pages/ValidatePage';

function App() {
  return (
    <Router>
      <AuthProvider>
      <TooltipProvider delayDuration={400}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/validate" element={<ValidatePage />} />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <UserDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute requireAdmin={true}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/*" element={<PolyfaunaOS />} />
        </Routes>
      </TooltipProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
