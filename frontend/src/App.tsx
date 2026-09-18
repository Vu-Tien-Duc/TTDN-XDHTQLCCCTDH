import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute, UnauthorizedPage } from './routes';
import { MainLayout } from './layouts';
import {
  LoginPage,
  DashboardPage,
  PlaceholderPage,
  DepartmentsPage,
  ShiftsPage,
  UsersPage,
  SchedulesPage,
} from './pages';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        {/* Toast Notification Container */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: {
              background: '#1e293b',
              color: '#f8fafc',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: 500,
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)',
            },
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#ffffff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#ffffff',
              },
            },
          }}
        />

        <Routes>
          {/* 1. Tuyến đường công khai: Màn hình Đăng Nhập */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          {/* 2. Tuyến đường bảo vệ: Bắt buộc đăng nhập */}
          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />

              {/* Các phân hệ có phân quyền theo Role */}
              <Route
                path="/departments"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <DepartmentsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/users"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'truongkhoa']}>
                    <UsersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/shifts"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <ShiftsPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/schedules" element={<SchedulesPage />} />
              <Route path="/attendance" element={<PlaceholderPage />} />
              <Route path="/leave-requests" element={<PlaceholderPage />} />
              <Route
                path="/reports"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'truongkhoa']}>
                    <PlaceholderPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/audit-logs"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <PlaceholderPage />
                  </ProtectedRoute>
                }
              />
            </Route>
          </Route>

          {/* 3. Bắt mọi URL không hợp lệ -> Chuyển về Dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
