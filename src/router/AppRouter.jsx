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
import OrganisationPage from '../components/referentiels/OrganisationPage';
import OrganisationDetailPage from '../components/referentiels/OrganisationDetailPage';
import EditeursPage from '../components/referentiels/EditeursPage';
import EditeurDetailPage from '../components/referentiels/EditeurDetailPage';
import RevendeursPage from '../components/referentiels/RevendeursPage';
import RevendeurDetailPage from '../components/referentiels/RevendeurDetailPage';
import ContactsPage from '../components/referentiels/ContactsPage';
import ContactDetailPage from '../components/referentiels/ContactDetailPage';
import LogicielsPage from '../components/referentiels/LogicielsPage';
import ProduitDetailPage from '../components/referentiels/ProduitDetailPage';
import LicencesPage from '../components/deploiement/LicencesPage';
import LicenceDetailPage from '../components/deploiement/LicenceDetailPage';
import AffectationsPage from '../components/deploiement/AffectationsPage';
import AffectationDetailPage from '../components/deploiement/AffectationDetailPage';
import InventairePage from '../components/deploiement/InventairePage';
import InventaireDetailPage from '../components/deploiement/InventaireDetailPage';
import ContratsPage from '../components/contrats/ContratsPage';
import ContratDetailPage from '../components/contrats/ContratDetailPage';
import CommandesPage from '../components/contrats/CommandesPage';
import CommandeDetailPage from '../components/contrats/CommandeDetailPage';
import FacturesPage from '../components/contrats/FacturesPage';
import DocumentDetailPage from '../components/contrats/DocumentDetailPage';
import BudgetPage from '../pages/budget/BudgetPage';
import OldBudgetPage from '../components/contrats/BudgetPage';
import ReportsConformitePage from '../pages/rapports/ReportsConformitePage';
import ReportsOptimisationPage from '../pages/rapports/ReportsOptimisationPage';
import ReportViewPage from '../pages/rapports/ReportViewPage';
import CustomReportBuilderPage from '../pages/rapports/CustomReportBuilderPage';

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

            {/* Referentiels */}
            <Route path="/referentiels/organisation" element={<OrganisationPage />} />
            <Route path="/referentiels/organisation/:id" element={<OrganisationDetailPage />} />
            <Route path="/referentiels/editeurs" element={<EditeursPage />} />
            <Route path="/referentiels/editeurs/:id" element={<EditeurDetailPage />} />
            <Route path="/referentiels/revendeurs" element={<RevendeursPage />} />
            <Route path="/referentiels/revendeurs/:id" element={<RevendeurDetailPage />} />
            <Route path="/referentiels/contacts" element={<ContactsPage />} />
            <Route path="/referentiels/contacts/:id" element={<ContactDetailPage />} />
            <Route path="/referentiels/logiciels" element={<LogicielsPage />} />
            <Route path="/referentiels/logiciels/:id" element={<ProduitDetailPage />} />

            {/* Deploiement */}
            <Route path="/conformite/licences" element={<LicencesPage />} />
            <Route path="/conformite/licences/:id" element={<LicenceDetailPage />} />
            <Route path="/conformite/affectations" element={<AffectationsPage />} />
            <Route path="/conformite/affectations/:id" element={<AffectationDetailPage />} />
            <Route path="/conformite/inventaire" element={<InventairePage />} />
            <Route path="/conformite/inventaire/:id" element={<InventaireDetailPage />} />

            {/* Droits d'usage */}
            <Route path="/contrats/liste" element={<ContratsPage />} />
            <Route path="/contrats/liste/:id" element={<ContratDetailPage />} />
            <Route path="/contrats/commandes" element={<CommandesPage />} />
            <Route path="/contrats/commandes/:id" element={<CommandeDetailPage />} />
            <Route path="/contrats/factures" element={<FacturesPage />} />
            <Route path="/contrats/factures/:id" element={<DocumentDetailPage />} />
            <Route path="/contrats/budget" element={<OldBudgetPage />} />
            <Route path="/budget" element={<BudgetPage />} />

            {/* Rapports - manager_dsi + financier uniquement */}
            <Route element={<ProtectedRoute allowedProfils={['manager_dsi', 'financier']} />}>
              <Route path="/rapports" element={<Navigate to="/rapports/conformite" replace />} />
              <Route path="/rapports/conformite" element={<ReportsConformitePage />} />
              <Route path="/rapports/optimisation" element={<ReportsOptimisationPage />} />
              <Route path="/rapports/personnalise" element={<CustomReportBuilderPage />} />
              <Route path="/rapports/vue/:reportId" element={<ReportViewPage />} />
            </Route>
          </Route>
        </Route>

        {/* Root redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
