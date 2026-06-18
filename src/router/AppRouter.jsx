// AppRouter - Section 10 Specs UX v0.5
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import LoginPage from '../components/auth/LoginPage';
import ForgotPasswordPage from '../components/auth/ForgotPasswordPage';
import ResetPasswordPage from '../components/auth/ResetPasswordPage';
import TwoFactorPage from '../components/auth/TwoFactorPage';
import DashboardPage from '../components/Dashboard/DashboardPage';
import UsersPage from '../components/users/UsersPage';
import TenantSettingsPage from '../components/settings/TenantSettingsPage';
import UserSettingsPage from '../components/settings/UserSettingsPage';
import ComingSoonPage from '../pages/ComingSoonPage';
import UnauthorizedPage from '../pages/UnauthorizedPage';

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
        <Route path="/two-factor" element={<TwoFactorPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        {/* Protected routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/settings/me" element={<UserSettingsPage />} />

            {/* Manager DSI only */}
            <Route element={<ProtectedRoute allowedProfils={['manager_dsi']} />}>
              <Route path="/admin/users" element={<UsersPage />} />
              <Route path="/admin/settings" element={<TenantSettingsPage />} />
              <Route path="/admin/connectors" element={<Navigate to="/admin/settings?tab=connecteurs" replace />} />
            </Route>

            {/* Placeholders */}
            <Route path="/referentiels/*" element={<ComingSoonPage section="Référentiels" />} />
            <Route path="/contrats/*" element={<ComingSoonPage section="Contrats" />} />
            <Route path="/conformite/*" element={<ComingSoonPage section="Conformité" />} />
            <Route path="/rapports/*" element={<ComingSoonPage section="Rapports" />} />
          </Route>
        </Route>

        {/* Root redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
