import { Navigate, Route, Routes } from 'react-router';
import { RequireAuth } from './auth/RequireAuth';
import { AppLayout } from './layout/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { EmployeeDetailPage } from './pages/employees/EmployeeDetailPage';
import { EmployeesPage } from './pages/employees/EmployeesPage';
import { LoginPage } from './pages/LoginPage';
import { SiteEditPage } from './pages/sites/SiteEditPage';
import { SitesPage } from './pages/sites/SitesPage';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="employees/:id" element={<EmployeeDetailPage />} />
        <Route path="sites" element={<SitesPage />} />
        <Route path="sites/new" element={<SiteEditPage />} />
        <Route path="sites/:id" element={<SiteEditPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
